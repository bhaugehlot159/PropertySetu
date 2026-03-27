(() => {
  if (document.getElementById('sellerExpiryAlertProCard')) return;

  const live = window.PropertySetuLive || {};
  const isSellerPage = Boolean(document.getElementById('addPropertyForm') && document.getElementById('propertyList'));
  if (!isSellerPage) return;

  const CARD_ID = 'sellerExpiryAlertProCard';
  const STYLE_ID = 'seller-expiry-alert-pro-style';
  const LISTINGS_KEY = 'propertySetu:listings';
  const ALERT_PREFS_KEY = 'propertySetu:sellerExpiryAlertPrefs';
  const ALERT_STATE_KEY = 'propertySetu:sellerExpiryAlertState';
  const ALERT_LOG_KEY = 'propertySetu:sellerExpiryAlertLog';
  const BOOST_QUEUE_KEY = 'propertySetu:sellerBoostQueue';
  const DAY_MS = 86400000;
  const HOUR_MS = 3600000;

  const text = (value, fallback = '') => {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  };
  const numberFrom = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const escapeHtml = (value) => (
    String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  );
  const inr = (value) => `₹${numberFrom(value, 0).toLocaleString('en-IN')}`;

  const readJson = live.readJson || ((key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  });
  const writeJson = live.writeJson || ((key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // no-op
    }
  });

  const getToken = () => {
    if (typeof live.getAnyToken === 'function') return text(live.getAnyToken());
    if (typeof live.getToken === 'function') return text(live.getToken('seller') || live.getToken('admin') || live.getToken('customer'));
    return '';
  };
  const getSessionId = () => {
    if (typeof live.getAnySession === 'function') return text(live.getAnySession()?.id);
    return '';
  };

  const getPrefs = () => {
    const current = readJson(ALERT_PREFS_KEY, {});
    return {
      warningDays: clamp(numberFrom(current?.warningDays, 7), 2, 21),
      criticalDays: clamp(numberFrom(current?.criticalDays, 1), 0, 5),
      snoozeHours: clamp(numberFrom(current?.snoozeHours, 24), 1, 168),
      autoQueueCritical: current?.autoQueueCritical !== false,
      desktopNotify: current?.desktopNotify === true,
      autoAckHours: clamp(numberFrom(current?.autoAckHours, 12), 1, 72),
    };
  };
  const setPrefs = (next) => {
    const current = getPrefs();
    writeJson(ALERT_PREFS_KEY, { ...current, ...(next || {}) });
  };

  const getState = () => {
    const state = readJson(ALERT_STATE_KEY, {});
    return state && typeof state === 'object' ? state : {};
  };
  const setState = (next) => {
    writeJson(ALERT_STATE_KEY, next && typeof next === 'object' ? next : {});
  };

  const getLog = () => {
    const rows = readJson(ALERT_LOG_KEY, []);
    return Array.isArray(rows) ? rows : [];
  };
  const pushLog = (entry = {}) => {
    const rows = getLog();
    rows.unshift({
      id: `seap-log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: new Date().toISOString(),
      type: text(entry.type, 'info'),
      propertyId: text(entry.propertyId),
      title: text(entry.title),
      message: text(entry.message),
      meta: entry.meta && typeof entry.meta === 'object' ? entry.meta : {},
    });
    writeJson(ALERT_LOG_KEY, rows.slice(0, 400));
  };

  const pushAppNotification = (title, message, type = 'info') => {
    if (!title || !message) return;
    if (window.PropertySetuNotify && typeof window.PropertySetuNotify.emit === 'function') {
      window.PropertySetuNotify.emit({ title, message, audience: ['seller', 'admin'], type });
      return;
    }
    const rows = readJson('propertySetu:notifications', []);
    const next = Array.isArray(rows) ? rows : [];
    next.unshift({
      id: `seap-n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      message,
      audience: ['seller', 'admin'],
      type,
      createdAt: new Date().toISOString(),
      readBy: {},
    });
    while (next.length > 500) next.pop();
    writeJson('propertySetu:notifications', next);
    try {
      localStorage.setItem('propertySetu:notifications:ping', String(Date.now()));
    } catch {
      // no-op
    }
  };

  const maybeDesktopNotify = (title, message) => {
    const prefs = getPrefs();
    if (!prefs.desktopNotify || typeof Notification === 'undefined') return;
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, { body: message });
      } catch {
        // no-op
      }
      return;
    }
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => null);
    }
  };

  const toDateLabel = (value) => {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const expiryTsFor = (item = {}) => {
    const explicit = Date.parse(text(item.listingExpiresAt || item.featuredUntil));
    if (Number.isFinite(explicit)) return explicit;
    const createdAt = Date.parse(text(item.createdAt || item.listedAt || item.updatedAt));
    if (Number.isFinite(createdAt)) return createdAt + (30 * DAY_MS);
    return NaN;
  };

  const levelFromDiffDays = (diffDays, prefs) => {
    if (!Number.isFinite(diffDays)) return { key: 'unset', rank: 5, label: 'Expiry missing' };
    if (diffDays < 0) return { key: 'expired', rank: 0, label: `Expired ${Math.abs(diffDays)}d ago` };
    if (diffDays <= prefs.criticalDays) return { key: 'critical', rank: 1, label: `Critical: ${diffDays}d left` };
    if (diffDays <= Math.max(prefs.criticalDays + 2, 3)) return { key: 'urgent', rank: 2, label: `Urgent: ${diffDays}d left` };
    if (diffDays <= prefs.warningDays) return { key: 'warning', rank: 3, label: `Warning: ${diffDays}d left` };
    return { key: 'healthy', rank: 4, label: `Healthy: ${diffDays}d left` };
  };

  const getMyListings = () => {
    const sessionId = getSessionId();
    const rows = readJson(LISTINGS_KEY, []);
    return (Array.isArray(rows) ? rows : [])
      .filter((item) => item && typeof item === 'object')
      .filter((item) => !sessionId || text(item.ownerId) === sessionId);
  };

  const mergeByIdLocal = (incoming = []) => {
    const existing = readJson(LISTINGS_KEY, []);
    const map = new Map();
    (Array.isArray(existing) ? existing : []).forEach((item) => {
      const id = text(item?.id);
      if (id) map.set(id, item);
    });
    (Array.isArray(incoming) ? incoming : []).forEach((item) => {
      const id = text(item?.id);
      if (!id) return;
      map.set(id, { ...(map.get(id) || {}), ...item });
    });
    writeJson(LISTINGS_KEY, [...map.values()]);
  };

  const readQueue = () => {
    const rows = readJson(BOOST_QUEUE_KEY, []);
    return Array.isArray(rows) ? rows : [];
  };
  const writeQueue = (rows) => writeJson(BOOST_QUEUE_KEY, Array.isArray(rows) ? rows : []);

  const enqueueBoost = (row, reason = 'expiry-alert') => {
    const id = text(row?.id);
    if (!id) return false;
    const queue = readQueue();
    if (queue.some((item) => text(item?.propertyId) === id)) return false;
    const planId = row.levelKey === 'expired' || row.levelKey === 'critical' ? 'featured-30' : 'featured-7';
    const amount = planId === 'featured-30' ? 999 : 299;
    queue.unshift({
      propertyId: id,
      title: row.title,
      planId,
      priority: row.priority,
      amount,
      cycleDays: planId === 'featured-30' ? 30 : 7,
      queuedAt: new Date().toISOString(),
      source: reason,
    });
    writeQueue(queue.slice(0, 200));
    pushLog({
      type: 'queued',
      propertyId: id,
      title: row.title,
      message: `Added to boost queue (${planId}) from ${reason}.`,
      meta: { planId, amount, reason },
    });
    return true;
  };

  const renewLocal = (propertyId, days) => {
    const id = text(propertyId);
    if (!id) return false;
    const safeDays = Math.max(1, numberFrom(days, 30));
    const expiryIso = new Date(Date.now() + (safeDays * DAY_MS)).toISOString();
    const rows = readJson(LISTINGS_KEY, []);
    let updated = false;
    const next = (Array.isArray(rows) ? rows : []).map((item) => {
      if (text(item?.id) !== id) return item;
      updated = true;
      return {
        ...item,
        featured: true,
        featuredUntil: expiryIso,
        listingExpiresAt: expiryIso,
        updatedAt: new Date().toISOString(),
      };
    });
    if (updated) writeJson(LISTINGS_KEY, next);
    return updated;
  };

  const renewLive = async (propertyId, days) => {
    const token = getToken();
    if (!token || typeof live.request !== 'function') return;
    const safeDays = Math.max(1, numberFrom(days, 30));
    const expiryIso = new Date(Date.now() + (safeDays * DAY_MS)).toISOString();
    try {
      await live.request(`/properties/${encodeURIComponent(propertyId)}`, {
        method: 'PATCH',
        token,
        data: {
          listingExpiresAt: expiryIso,
          featuredUntil: expiryIso,
          featured: true,
        },
      });
    } catch (error) {
      if (!live.shouldFallbackToLocal || !live.shouldFallbackToLocal(error)) throw error;
    }
  };

  const buildRows = () => {
    const prefs = getPrefs();
    const state = getState();
    const rows = getMyListings().map((item) => {
      const id = text(item.id);
      const expiryTs = expiryTsFor(item);
      const diffDays = Number.isFinite(expiryTs) ? Math.ceil((expiryTs - Date.now()) / DAY_MS) : NaN;
      const diffHours = Number.isFinite(expiryTs) ? Math.ceil((expiryTs - Date.now()) / HOUR_MS) : NaN;
      const level = levelFromDiffDays(diffDays, prefs);
      const rowState = state[id] && typeof state[id] === 'object' ? state[id] : {};
      const ackUntilTs = Date.parse(text(rowState.ackUntil));
      const snoozeUntilTs = Date.parse(text(rowState.snoozeUntil));
      const suppressed = (Number.isFinite(ackUntilTs) && ackUntilTs > Date.now())
        || (Number.isFinite(snoozeUntilTs) && snoozeUntilTs > Date.now());

      const featuredUntilTs = Date.parse(text(item.featuredUntil));
      const featuredActive = Number.isFinite(featuredUntilTs) && featuredUntilTs > Date.now();
      const basePriority = level.key === 'expired' ? 92
        : level.key === 'critical' ? 84
          : level.key === 'urgent' ? 73
            : level.key === 'warning' ? 60
              : 30;
      const priceWeight = numberFrom(item.price, 0) > 0 ? 4 : 0;
      const priority = clamp(basePriority + priceWeight, 0, 100);

      return {
        id,
        title: text(item.title, id || 'Untitled'),
        price: numberFrom(item.price, 0),
        expiryTs,
        expiryLabel: Number.isFinite(expiryTs) ? toDateLabel(expiryTs) : '-',
        diffDays,
        diffHours,
        levelKey: level.key,
        levelRank: level.rank,
        levelLabel: level.label,
        suppressed,
        featuredActive,
        priority,
      };
    }).filter((row) => row.id);

    rows.sort((a, b) => {
      if (a.levelRank !== b.levelRank) return a.levelRank - b.levelRank;
      if (Number.isFinite(a.diffHours) && Number.isFinite(b.diffHours)) return a.diffHours - b.diffHours;
      return a.title.localeCompare(b.title);
    });

    const summary = {
      total: rows.length,
      expired: rows.filter((row) => row.levelKey === 'expired').length,
      critical: rows.filter((row) => row.levelKey === 'critical').length,
      urgent: rows.filter((row) => row.levelKey === 'urgent').length,
      warning: rows.filter((row) => row.levelKey === 'warning').length,
      suppressed: rows.filter((row) => row.suppressed).length,
      inQueue: readQueue().length,
    };

    return { rows, summary };
  };

  const applyAutoActions = ({ rows, silent = false } = {}) => {
    const prefs = getPrefs();
    const state = getState();
    let queueAdded = 0;
    let notifications = 0;
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      if (!row || row.suppressed) return;
      if (!['expired', 'critical', 'urgent', 'warning'].includes(row.levelKey)) return;
      const rowState = state[row.id] && typeof state[row.id] === 'object' ? state[row.id] : {};
      const alreadySeenLevel = text(rowState.lastSeenLevel);
      const levelChanged = alreadySeenLevel !== row.levelKey;

      if (prefs.autoQueueCritical && (row.levelKey === 'expired' || row.levelKey === 'critical')) {
        if (enqueueBoost(row, 'auto-expiry-alert')) queueAdded += 1;
      }

      if (levelChanged) {
        const message = `${row.title}: ${row.levelLabel}. Priority ${row.priority}.`;
        pushAppNotification('Listing Expiry Alert', message, row.levelKey === 'expired' ? 'warn' : 'info');
        maybeDesktopNotify('PropertySetu Expiry Alert', message);
        notifications += 1;
      }

      state[row.id] = {
        ...rowState,
        lastSeenLevel: row.levelKey,
        lastSeenAt: new Date().toISOString(),
      };
    });
    setState(state);

    if (!silent && (queueAdded > 0 || notifications > 0)) {
      const message = `Auto actions complete. Queue added: ${queueAdded}, Alerts: ${notifications}.`;
      setStatus(message);
      pushLog({ type: 'auto-run', message, meta: { queueAdded, notifications } });
    }
  };

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${CARD_ID} .seap-status{margin:0 0 10px;color:#1f6d3d;font-size:14px;}
#${CARD_ID} .seap-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px;}
#${CARD_ID} .seap-btn{border:1px solid #0b3d91;border-radius:8px;background:#0b3d91;color:#fff;padding:7px 11px;font-weight:700;cursor:pointer;}
#${CARD_ID} .seap-btn.alt{background:#fff;color:#0b3d91;}
#${CARD_ID} .seap-btn.warn{background:#8f4f00;border-color:#8f4f00;}
#${CARD_ID} .seap-settings{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));margin-bottom:10px;}
#${CARD_ID} .seap-settings label{display:grid;gap:4px;font-size:12px;color:#3d5674;}
#${CARD_ID} .seap-settings input{border:1px solid #ccd9ee;border-radius:8px;padding:7px 9px;}
#${CARD_ID} .seap-toggle{display:flex;align-items:center;gap:6px;font-size:12px;color:#3d5674;}
#${CARD_ID} .seap-kpi{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));margin-bottom:10px;}
#${CARD_ID} .seap-kpi-item{border:1px solid #d7e6f8;border-radius:8px;background:#f7fbff;padding:8px;}
#${CARD_ID} .seap-kpi-item small{display:block;color:#58718f;}
#${CARD_ID} .seap-kpi-item b{color:#11466e;font-size:16px;}
#${CARD_ID} .seap-wrap{overflow:auto;}
#${CARD_ID} table{width:100%;border-collapse:collapse;min-width:980px;}
#${CARD_ID} th,#${CARD_ID} td{border:1px solid #d5e2f4;padding:7px;text-align:left;font-size:13px;vertical-align:top;}
#${CARD_ID} th{background:#f3f8ff;}
#${CARD_ID} .seap-chip{display:inline-block;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:700;}
#${CARD_ID} .seap-chip.expired{background:#ffe5e5;color:#992222;}
#${CARD_ID} .seap-chip.critical{background:#fff0d9;color:#9f5d00;}
#${CARD_ID} .seap-chip.urgent{background:#eef3ff;color:#1d4f87;}
#${CARD_ID} .seap-chip.warning{background:#ecf6ff;color:#245a91;}
#${CARD_ID} .seap-chip.healthy{background:#e7f8ef;color:#19643a;}
#${CARD_ID} .seap-chip.unset{background:#f2f4f7;color:#5f6f86;}
#${CARD_ID} .seap-chip.suppressed{background:#f2f4f7;color:#5f6f86;}
#${CARD_ID} .seap-actions{display:flex;flex-wrap:wrap;gap:6px;}
#${CARD_ID} .seap-actions button{border:1px solid #cbdcf2;background:#fff;color:#12395f;border-radius:999px;padding:4px 9px;font-size:12px;cursor:pointer;}
#${CARD_ID} .seap-log{max-height:160px;overflow:auto;border:1px solid #dce6f5;border-radius:8px;padding:8px;background:#fff;}
    `;
    document.head.appendChild(style);
  }

  const card = document.createElement('div');
  card.className = 'container';
  card.id = CARD_ID;
  card.innerHTML = `
    <h2>Auto Expiry Alert Pro</h2>
    <p id="seapStatus" class="seap-status">Loading expiry alert center...</p>
    <div class="seap-toolbar">
      <button id="seapRefreshBtn" class="seap-btn" type="button">Refresh</button>
      <button id="seapAutoBtn" class="seap-btn warn" type="button">Run Auto Actions</button>
      <button id="seapAckAllBtn" class="seap-btn alt" type="button">Acknowledge Visible</button>
      <button id="seapCsvBtn" class="seap-btn alt" type="button">Export CSV</button>
    </div>
    <div class="seap-settings">
      <label>Warning Days<input id="seapWarningDaysInput" type="number" min="2" max="21" step="1"></label>
      <label>Critical Days<input id="seapCriticalDaysInput" type="number" min="0" max="5" step="1"></label>
      <label>Snooze Hours<input id="seapSnoozeHoursInput" type="number" min="1" max="168" step="1"></label>
      <label>Auto Ack Hours<input id="seapAckHoursInput" type="number" min="1" max="72" step="1"></label>
      <label class="seap-toggle"><input id="seapAutoQueueToggle" type="checkbox"> Auto-queue critical to boost</label>
      <label class="seap-toggle"><input id="seapDesktopToggle" type="checkbox"> Desktop notifications</label>
    </div>
    <div id="seapKpi" class="seap-kpi"></div>
    <div id="seapTable" class="seap-wrap"></div>
    <section style="margin-top:10px;">
      <h3 style="margin:0 0 8px;color:#11466e;">Alert Activity Log</h3>
      <div id="seapLog" class="seap-log"></div>
    </section>
  `;

  const renewalCard = document.getElementById('sellerRenewalControlCard');
  const boostCard = document.getElementById('sellerBoostOrchestratorCard');
  const anchor = boostCard || renewalCard || document.querySelector('.container');
  if (anchor) anchor.insertAdjacentElement('afterend', card);
  else document.body.appendChild(card);

  const statusEl = document.getElementById('seapStatus');
  const refreshBtn = document.getElementById('seapRefreshBtn');
  const autoBtn = document.getElementById('seapAutoBtn');
  const ackAllBtn = document.getElementById('seapAckAllBtn');
  const csvBtn = document.getElementById('seapCsvBtn');
  const warningDaysInput = document.getElementById('seapWarningDaysInput');
  const criticalDaysInput = document.getElementById('seapCriticalDaysInput');
  const snoozeHoursInput = document.getElementById('seapSnoozeHoursInput');
  const ackHoursInput = document.getElementById('seapAckHoursInput');
  const autoQueueToggle = document.getElementById('seapAutoQueueToggle');
  const desktopToggle = document.getElementById('seapDesktopToggle');
  const kpiEl = document.getElementById('seapKpi');
  const tableEl = document.getElementById('seapTable');
  const logEl = document.getElementById('seapLog');

  let model = { rows: [], summary: {} };
  let refreshTimer = null;

  const setStatus = (message, ok = true) => {
    statusEl.textContent = message;
    statusEl.style.color = ok ? '#1f6d3d' : '#8d1e1e';
  };

  const writePrefsToUi = () => {
    const prefs = getPrefs();
    warningDaysInput.value = String(numberFrom(prefs.warningDays, 7));
    criticalDaysInput.value = String(numberFrom(prefs.criticalDays, 1));
    snoozeHoursInput.value = String(numberFrom(prefs.snoozeHours, 24));
    ackHoursInput.value = String(numberFrom(prefs.autoAckHours, 12));
    autoQueueToggle.checked = prefs.autoQueueCritical;
    desktopToggle.checked = prefs.desktopNotify;
  };
  const readPrefsFromUi = () => ({
    warningDays: clamp(numberFrom(warningDaysInput.value, 7), 2, 21),
    criticalDays: clamp(numberFrom(criticalDaysInput.value, 1), 0, 5),
    snoozeHours: clamp(numberFrom(snoozeHoursInput.value, 24), 1, 168),
    autoAckHours: clamp(numberFrom(ackHoursInput.value, 12), 1, 72),
    autoQueueCritical: autoQueueToggle.checked,
    desktopNotify: desktopToggle.checked,
  });

  const renderKpi = () => {
    const s = model.summary || {};
    kpiEl.innerHTML = `
      <div class="seap-kpi-item"><small>Total</small><b>${numberFrom(s.total, 0)}</b></div>
      <div class="seap-kpi-item"><small>Expired</small><b>${numberFrom(s.expired, 0)}</b></div>
      <div class="seap-kpi-item"><small>Critical</small><b>${numberFrom(s.critical, 0)}</b></div>
      <div class="seap-kpi-item"><small>Urgent</small><b>${numberFrom(s.urgent, 0)}</b></div>
      <div class="seap-kpi-item"><small>Warning</small><b>${numberFrom(s.warning, 0)}</b></div>
      <div class="seap-kpi-item"><small>Suppressed</small><b>${numberFrom(s.suppressed, 0)}</b></div>
      <div class="seap-kpi-item"><small>Boost Queue</small><b>${numberFrom(s.inQueue, 0)}</b></div>
    `;
  };

  const renderTable = () => {
    if (!model.rows.length) {
      tableEl.innerHTML = '<p style="margin:0;color:#607da8;">No seller listings found.</p>';
      return;
    }
    tableEl.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Listing</th>
            <th>Expiry</th>
            <th>Alert Level</th>
            <th>Priority</th>
            <th>Suppression</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${model.rows.map((row) => `
            <tr>
              <td>
                <b>${escapeHtml(row.title)}</b><br>
                <small style="color:#5b6e86;">ID: ${escapeHtml(row.id)}</small><br>
                <small style="color:#5b6e86;">Price: ${escapeHtml(inr(row.price))}</small>
              </td>
              <td>${escapeHtml(row.expiryLabel)}</td>
              <td>
                <span class="seap-chip ${row.levelKey}">${escapeHtml(row.levelLabel)}</span><br>
                <small style="color:#5b6e86;">Featured: ${row.featuredActive ? 'Active' : 'No'}</small>
              </td>
              <td>${row.priority}</td>
              <td>${row.suppressed ? '<span class="seap-chip suppressed">Suppressed</span>' : '<span style="color:#1f6d3d;">Active</span>'}</td>
              <td>
                <div class="seap-actions">
                  <button type="button" data-action="ack" data-id="${escapeHtml(row.id)}">Acknowledge</button>
                  <button type="button" data-action="snooze" data-id="${escapeHtml(row.id)}">Snooze</button>
                  <button type="button" data-action="queue" data-id="${escapeHtml(row.id)}">Queue Boost</button>
                  <button type="button" data-action="renew" data-id="${escapeHtml(row.id)}">Renew 30d</button>
                  <button type="button" data-action="open" data-id="${escapeHtml(row.id)}">Open</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const renderLog = () => {
    const rows = getLog();
    if (!rows.length) {
      logEl.innerHTML = '<p style="margin:0;color:#607da8;">No activity yet.</p>';
      return;
    }
    logEl.innerHTML = rows.slice(0, 30).map((row) => `
      <p style="margin:0 0 8px;">
        <b>${escapeHtml(text(row.type, 'info').toUpperCase())}</b>
        <small style="color:#607da8;">${escapeHtml(toDateLabel(row.at))}</small><br>
        <span style="color:#385a7a;">${escapeHtml(text(row.title, row.propertyId))}</span><br>
        <span style="color:#567395;">${escapeHtml(text(row.message, '-'))}</span>
      </p>
    `).join('');
  };

  const refresh = async ({ runAuto = true, silentAuto = true } = {}) => {
    if (typeof live.syncLocalListingsFromApi === 'function') {
      try {
        await live.syncLocalListingsFromApi();
      } catch {
        // keep local
      }
    }
    model = buildRows();
    if (runAuto) applyAutoActions({ rows: model.rows, silent: silentAuto });
    renderKpi();
    renderTable();
    renderLog();
    setStatus(`Expiry alert center ready. ${numberFrom(model.summary?.expired, 0)} expired, ${numberFrom(model.summary?.critical, 0)} critical.`);
  };

  const ackListing = (id) => {
    const row = model.rows.find((item) => item.id === id);
    if (!row) return false;
    const prefs = getPrefs();
    const state = getState();
    state[id] = {
      ...(state[id] || {}),
      ackUntil: new Date(Date.now() + prefs.autoAckHours * HOUR_MS).toISOString(),
      acknowledgedAt: new Date().toISOString(),
    };
    setState(state);
    pushLog({
      type: 'ack',
      propertyId: id,
      title: row.title,
      message: `Alert acknowledged for ${prefs.autoAckHours}h.`,
    });
    return true;
  };

  const snoozeListing = (id) => {
    const row = model.rows.find((item) => item.id === id);
    if (!row) return false;
    const prefs = getPrefs();
    const state = getState();
    state[id] = {
      ...(state[id] || {}),
      snoozeUntil: new Date(Date.now() + prefs.snoozeHours * HOUR_MS).toISOString(),
      snoozedAt: new Date().toISOString(),
    };
    setState(state);
    pushLog({
      type: 'snooze',
      propertyId: id,
      title: row.title,
      message: `Alert snoozed for ${prefs.snoozeHours}h.`,
    });
    return true;
  };

  const ackAllVisible = () => {
    const state = getState();
    const prefs = getPrefs();
    let count = 0;
    model.rows.forEach((row) => {
      if (!['expired', 'critical', 'urgent', 'warning'].includes(row.levelKey)) return;
      state[row.id] = {
        ...(state[row.id] || {}),
        ackUntil: new Date(Date.now() + prefs.autoAckHours * HOUR_MS).toISOString(),
        acknowledgedAt: new Date().toISOString(),
      };
      count += 1;
    });
    setState(state);
    pushLog({ type: 'ack-all', message: `Acknowledged ${count} visible alert(s).` });
    setStatus(`Acknowledged ${count} listing alert(s).`);
  };

  const queueManual = (id) => {
    const row = model.rows.find((item) => item.id === id);
    if (!row) return false;
    const added = enqueueBoost(row, 'manual-expiry-alert');
    if (added) {
      pushAppNotification('Boost Queue Updated', `${row.title} added to boost queue from expiry center.`, 'info');
    }
    return added;
  };

  const renewOne = async (id) => {
    const row = model.rows.find((item) => item.id === id);
    if (!row) return false;
    const ok = renewLocal(id, 30);
    if (!ok) return false;
    try {
      await renewLive(id, 30);
    } catch {
      // local already updated
    }
    pushLog({
      type: 'renew',
      propertyId: id,
      title: row.title,
      message: 'Listing renewed for 30 days.',
    });
    pushAppNotification('Listing Renewed', `${row.title} renewed for 30 days.`, 'success');
    return true;
  };

  const exportCsv = () => {
    const headers = ['Property ID', 'Title', 'Price', 'Expiry', 'Alert Level', 'Priority', 'Suppressed'];
    const rows = model.rows.map((row) => ([
      row.id,
      row.title,
      String(numberFrom(row.price, 0)),
      row.expiryLabel,
      row.levelLabel,
      String(numberFrom(row.priority, 0)),
      row.suppressed ? 'yes' : 'no',
    ]));
    const quote = (value) => {
      const raw = String(value || '');
      if (!/[",\n]/.test(raw)) return raw;
      return `"${raw.replace(/"/g, '""')}"`;
    };
    const csv = [headers, ...rows].map((line) => line.map(quote).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `seller-expiry-alerts-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus('Expiry alert CSV exported.');
  };

  refreshBtn?.addEventListener('click', () => {
    setPrefs(readPrefsFromUi());
    refresh({ runAuto: false }).catch((error) => setStatus(text(error?.message, 'Refresh failed.'), false));
  });
  autoBtn?.addEventListener('click', () => {
    setPrefs(readPrefsFromUi());
    applyAutoActions({ rows: model.rows, silent: false });
    refresh({ runAuto: false }).catch(() => null);
  });
  ackAllBtn?.addEventListener('click', () => {
    ackAllVisible();
    refresh({ runAuto: false }).catch(() => null);
  });
  csvBtn?.addEventListener('click', exportCsv);

  [warningDaysInput, criticalDaysInput, snoozeHoursInput, ackHoursInput, autoQueueToggle, desktopToggle].forEach((input) => {
    input?.addEventListener('change', () => {
      setPrefs(readPrefsFromUi());
      refresh({ runAuto: false }).catch(() => null);
    });
  });

  tableEl?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = text(target.getAttribute('data-action')).toLowerCase();
    const id = text(target.getAttribute('data-id'));
    if (!action || !id) return;
    if (action === 'ack') {
      ackListing(id);
      setStatus('Alert acknowledged.');
      refresh({ runAuto: false }).catch(() => null);
      return;
    }
    if (action === 'snooze') {
      snoozeListing(id);
      setStatus('Alert snoozed.');
      refresh({ runAuto: false }).catch(() => null);
      return;
    }
    if (action === 'queue') {
      const ok = queueManual(id);
      setStatus(ok ? 'Listing added to boost queue.' : 'Listing already queued or unavailable.', ok);
      refresh({ runAuto: false }).catch(() => null);
      return;
    }
    if (action === 'renew') {
      renewOne(id)
        .then((ok) => {
          setStatus(ok ? 'Listing renewed for 30 days.' : 'Renew action failed.', ok);
          refresh({ runAuto: false }).catch(() => null);
        })
        .catch((error) => setStatus(text(error?.message, 'Renew failed.'), false));
      return;
    }
    if (action === 'open') {
      window.open(`property-details.html?id=${encodeURIComponent(id)}`, '_blank', 'noopener,noreferrer');
    }
  });

  writePrefsToUi();
  refresh({ runAuto: true, silentAuto: true }).catch((error) => {
    setStatus(text(error?.message, 'Unable to load expiry alert center.'), false);
  });

  if (refreshTimer) window.clearInterval(refreshTimer);
  refreshTimer = window.setInterval(() => {
    refresh({ runAuto: true, silentAuto: true }).catch(() => null);
  }, 60000);
})();
