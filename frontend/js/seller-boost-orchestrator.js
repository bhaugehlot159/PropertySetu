(() => {
  if (document.getElementById('sellerBoostOrchestratorCard')) return;

  const live = window.PropertySetuLive || {};
  const allowDemoFallback = Boolean(live.allowDemoFallback);
  const isSellerPage = Boolean(document.getElementById('addPropertyForm') && document.getElementById('propertyList'));
  if (!isSellerPage) return;

  const CARD_ID = 'sellerBoostOrchestratorCard';
  const STYLE_ID = 'seller-boost-orchestrator-style';
  const LISTINGS_KEY = 'propertySetu:listings';
  const ENGAGEMENT_KEY = 'propertySetu:sellerEngagement';
  const CHAT_PREFIX = 'propertySetu:userChat:';
  const SETTINGS_KEY = 'propertySetu:sellerBoostSettings';
  const QUEUE_KEY = 'propertySetu:sellerBoostQueue';
  const LOG_KEY = 'propertySetu:sellerBoostLog';
  const DAY_MS = 86400000;

  const DEFAULT_PLANS = {
    'featured-7': { id: 'featured-7', name: 'Featured - 7 Days', amount: 299, cycleDays: 7, type: 'featured' },
    'featured-30': { id: 'featured-30', name: 'Featured - 30 Days', amount: 999, cycleDays: 30, type: 'featured' },
  };

  const text = (value, fallback = '') => {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  };
  const numberFrom = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const inr = (value) => `₹${numberFrom(value, 0).toLocaleString('en-IN')}`;
  const escapeHtml = (value) => (
    String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  );

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

  const notify = (title, message, type = 'info') => {
    if (!title || !message) return;
    if (window.PropertySetuNotify && typeof window.PropertySetuNotify.emit === 'function') {
      window.PropertySetuNotify.emit({ title, message, audience: ['seller', 'admin'], type });
      return;
    }
    const rows = readJson('propertySetu:notifications', []);
    const next = Array.isArray(rows) ? rows : [];
    next.unshift({
      id: `sbo-n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

  const getToken = () => {
    if (typeof live.getAnyToken === 'function') return text(live.getAnyToken());
    if (typeof live.getToken === 'function') return text(live.getToken('seller') || live.getToken('admin') || live.getToken('customer'));
    return '';
  };
  const getSessionId = () => {
    if (typeof live.getAnySession === 'function') return text(live.getAnySession()?.id);
    return '';
  };

  const getSettings = () => {
    const current = readJson(SETTINGS_KEY, {});
    return {
      dailyBudget: clamp(numberFrom(current?.dailyBudget, 2500), 100, 25000),
      maxListingsPerRun: clamp(numberFrom(current?.maxListingsPerRun, 3), 1, 20),
      minPriority: clamp(numberFrom(current?.minPriority, 55), 20, 95),
    };
  };
  const setSettings = (next) => {
    const current = getSettings();
    writeJson(SETTINGS_KEY, { ...current, ...(next || {}) });
  };

  const getQueue = () => {
    const rows = readJson(QUEUE_KEY, []);
    const out = [];
    const seen = new Set();
    (Array.isArray(rows) ? rows : []).forEach((item) => {
      const propertyId = text(item?.propertyId || item?.id);
      if (!propertyId || seen.has(propertyId)) return;
      seen.add(propertyId);
      out.push({
        propertyId,
        title: text(item?.title, propertyId),
        planId: text(item?.planId, 'featured-7'),
        priority: clamp(numberFrom(item?.priority, 0), 0, 100),
        amount: Math.max(0, numberFrom(item?.amount, 0)),
        cycleDays: Math.max(1, numberFrom(item?.cycleDays, 7)),
        queuedAt: text(item?.queuedAt, new Date().toISOString()),
      });
    });
    return out;
  };
  const setQueue = (rows) => {
    const list = Array.isArray(rows) ? rows : [];
    writeJson(QUEUE_KEY, list);
  };

  const getLog = () => {
    const rows = readJson(LOG_KEY, []);
    return Array.isArray(rows) ? rows : [];
  };
  const pushLog = (entry = {}) => {
    const rows = getLog();
    rows.unshift({
      id: `sbo-log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: new Date().toISOString(),
      type: text(entry.type, 'info'),
      propertyId: text(entry.propertyId),
      title: text(entry.title),
      planId: text(entry.planId),
      amount: Math.max(0, numberFrom(entry.amount, 0)),
      priority: clamp(numberFrom(entry.priority, 0), 0, 100),
      message: text(entry.message),
    });
    writeJson(LOG_KEY, rows.slice(0, 400));
  };

  const getTodaySpent = () => {
    const today = new Date().toISOString().slice(0, 10);
    return getLog()
      .filter((item) => text(item?.type) === 'boosted' && text(item?.at).slice(0, 10) === today)
      .reduce((sum, item) => sum + Math.max(0, numberFrom(item?.amount, 0)), 0);
  };

  const listingAgeDays = (item = {}) => {
    const created = Date.parse(text(item.createdAt || item.listedAt || item.updatedAt));
    if (!Number.isFinite(created)) return 0;
    return Math.max(0, Math.floor((Date.now() - created) / DAY_MS));
  };
  const activeFeaturedDaysLeft = (item = {}) => {
    const expires = Date.parse(text(item.featuredUntil || item.listingExpiresAt));
    if (!Number.isFinite(expires)) return 0;
    return Math.ceil((expires - Date.now()) / DAY_MS);
  };

  const normalizePlan = (item = {}) => {
    const id = text(item.id);
    if (!id) return null;
    return {
      id,
      name: text(item.name, id),
      amount: Math.max(0, numberFrom(item.amount, 0)),
      cycleDays: Math.max(1, numberFrom(item.cycleDays, 7)),
      type: text(item.type || 'featured', 'featured'),
    };
  };

  const loadPlans = async () => {
    const plans = new Map();
    Object.values(DEFAULT_PLANS).forEach((plan) => plans.set(plan.id, { ...plan }));
    const token = getToken();
    if (!token || typeof live.request !== 'function') return plans;
    try {
      const response = await live.request('/subscriptions/plans', { token });
      const items = Array.isArray(response?.items) ? response.items : [];
      items
        .map((item) => normalizePlan(item))
        .filter(Boolean)
        .filter((item) => item.type === 'featured' || item.id === 'featured-7' || item.id === 'featured-30')
        .forEach((item) => plans.set(item.id, item));
    } catch {
      // fallback defaults
    }
    return plans;
  };

  const getMyListings = () => {
    const sessionId = getSessionId();
    const listings = readJson(LISTINGS_KEY, []);
    return (Array.isArray(listings) ? listings : [])
      .filter((item) => item && typeof item === 'object')
      .filter((item) => !sessionId || text(item.ownerId) === sessionId);
  };

  const getChatCountMap = () => {
    const map = {};
    try {
      const count = numberFrom(localStorage.length, 0);
      for (let index = 0; index < count; index += 1) {
        const key = text(localStorage.key(index));
        if (!key.startsWith(CHAT_PREFIX)) continue;
        const propertyId = key.slice(CHAT_PREFIX.length);
        const items = readJson(key, []);
        map[propertyId] = numberFrom(map[propertyId], 0) + (Array.isArray(items) ? items.length : 0);
      }
    } catch {
      // no-op
    }
    return map;
  };

  const buildModel = ({ plans }) => {
    const queue = getQueue();
    const queueMap = new Map(queue.map((item) => [item.propertyId, item]));
    const engagementStore = readJson(ENGAGEMENT_KEY, {});
    const chatCountMap = getChatCountMap();
    const rows = getMyListings().map((item) => {
      const id = text(item.id);
      const title = text(item.title, id || 'Untitled');
      const engagement = engagementStore?.[id] && typeof engagementStore[id] === 'object' ? engagementStore[id] : {};
      const views = numberFrom(item?.analytics?.views, 0) + numberFrom(item?.viewCount, 0) + numberFrom(engagement.views, 0);
      const saves = numberFrom(item?.analytics?.saves, 0) + numberFrom(engagement.saves, 0);
      const inquiries = numberFrom(engagement.inquiries, 0);
      const chats = numberFrom(chatCountMap[id], 0);
      const ageDays = listingAgeDays(item);
      const featuredDaysLeft = activeFeaturedDaysLeft(item);
      const featuredActive = featuredDaysLeft > 0;

      const visibilityGap = clamp(100 - Math.round((views * 1.8) + (saves * 6.5) + (inquiries * 9) + (chats * 2)), 0, 100);
      const momentum = clamp(Math.round((inquiries * 9) + (saves * 4) + (chats * 1.5)), 0, 60);
      const ageFactor = ageDays >= 25 ? 18 : (ageDays >= 12 ? 10 : 4);
      const featuredFactor = featuredActive ? (featuredDaysLeft <= 2 ? 18 : 0) : 30;
      const priceFactor = numberFrom(item.price, 0) > 0 ? 5 : 0;
      const boostPriority = clamp(Math.round((visibilityGap * 0.55) + (momentum * 0.35) + ageFactor + featuredFactor + priceFactor), 0, 100);

      let recommendedPlanId = 'featured-7';
      if (boostPriority >= 78 || (inquiries >= 6 && !featuredActive)) recommendedPlanId = 'featured-30';
      const plan = plans.get(recommendedPlanId) || DEFAULT_PLANS[recommendedPlanId];
      const expectedLeadLiftPct = clamp(Math.round((boostPriority * 0.45) + (inquiries * 2.5)), 12, 95);

      const queued = queueMap.get(id) || null;
      return {
        id,
        title,
        price: numberFrom(item.price, 0),
        views,
        saves,
        inquiries,
        chats,
        ageDays,
        featuredActive,
        featuredDaysLeft,
        boostPriority,
        recommendedPlanId,
        recommendedPlanName: plan?.name || recommendedPlanId,
        recommendedAmount: Math.max(0, numberFrom(plan?.amount, 0)),
        recommendedCycleDays: Math.max(1, numberFrom(plan?.cycleDays, 7)),
        expectedLeadLiftPct,
        queued,
      };
    }).filter((row) => row.id);

    rows.sort((a, b) => {
      if (b.boostPriority !== a.boostPriority) return b.boostPriority - a.boostPriority;
      if (a.featuredActive !== b.featuredActive) return a.featuredActive ? 1 : -1;
      return b.views - a.views;
    });

    const summary = {
      listings: rows.length,
      featuredActive: rows.filter((row) => row.featuredActive).length,
      candidates: rows.filter((row) => row.boostPriority >= 55).length,
      queued: queue.length,
      estimatedQueueSpend: queue.reduce((sum, item) => sum + Math.max(0, numberFrom(item.amount, 0)), 0),
      todaySpent: getTodaySpent(),
      topPick: rows[0] ? `${rows[0].title} (${rows[0].boostPriority})` : '-',
    };

    return { rows, summary, queue };
  };

  const applyLocalBoost = (propertyId, cycleDays) => {
    const id = text(propertyId);
    if (!id) return false;
    const days = Math.max(1, numberFrom(cycleDays, 7));
    const expiry = new Date(Date.now() + (days * DAY_MS)).toISOString();
    const listings = readJson(LISTINGS_KEY, []);
    let updated = false;
    const next = (Array.isArray(listings) ? listings : []).map((item) => {
      if (text(item?.id) !== id) return item;
      updated = true;
      return {
        ...item,
        featured: true,
        featuredUntil: expiry,
        listingExpiresAt: expiry,
        updatedAt: new Date().toISOString(),
      };
    });
    if (updated) writeJson(LISTINGS_KEY, next);
    return updated;
  };

  const executeBoost = async ({ row, plan }) => {
    const propertyId = text(row?.id);
    const planId = text(plan?.id);
    if (!propertyId || !planId) return { ok: false, message: 'Invalid boost payload.' };
    const amount = Math.max(0, numberFrom(plan?.amount, 0));
    const cycleDays = Math.max(1, numberFrom(plan?.cycleDays, 7));
    const token = getToken();
    if (token && typeof live.request === 'function') {
      try {
        await live.request('/subscriptions/activate', {
          method: 'POST',
          token,
          data: { planId, propertyId },
        });
        applyLocalBoost(propertyId, cycleDays);
        return { ok: true, mode: 'live', amount, cycleDays };
      } catch (error) {
        if (!live.shouldFallbackToLocal || !live.shouldFallbackToLocal(error)) {
          return { ok: false, message: text(error?.message, 'Live boost failed.') };
        }
        if (!allowDemoFallback) {
          return { ok: false, message: text(error?.message, 'Live boost failed.') };
        }
      }
    }
    if (!allowDemoFallback) {
      return { ok: false, message: 'Live boost requires seller login and active backend.' };
    }
    const localOk = applyLocalBoost(propertyId, cycleDays);
    if (!localOk) return { ok: false, message: 'Listing not found for local boost.' };
    return { ok: true, mode: 'local', amount, cycleDays };
  };

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${CARD_ID} .sbo-status{margin:0 0 10px;color:#1f6d3d;font-size:14px;}
#${CARD_ID} .sbo-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px;}
#${CARD_ID} .sbo-btn{border:1px solid #0b3d91;border-radius:8px;background:#0b3d91;color:#fff;padding:7px 11px;font-weight:700;cursor:pointer;}
#${CARD_ID} .sbo-btn.alt{background:#fff;color:#0b3d91;}
#${CARD_ID} .sbo-btn.warn{background:#8f4f00;border-color:#8f4f00;}
#${CARD_ID} .sbo-kpi{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-bottom:10px;}
#${CARD_ID} .sbo-kpi-item{border:1px solid #d7e6f8;border-radius:8px;background:#f7fbff;padding:8px;}
#${CARD_ID} .sbo-kpi-item small{display:block;color:#58718f;}
#${CARD_ID} .sbo-kpi-item b{color:#11466e;font-size:16px;}
#${CARD_ID} .sbo-settings{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));margin-bottom:10px;}
#${CARD_ID} .sbo-settings label{display:grid;gap:4px;color:#3d5674;font-size:12px;}
#${CARD_ID} .sbo-settings input{border:1px solid #ccd9ee;border-radius:8px;padding:7px 9px;}
#${CARD_ID} .sbo-wrap{overflow:auto;}
#${CARD_ID} table{width:100%;border-collapse:collapse;min-width:980px;}
#${CARD_ID} th,#${CARD_ID} td{border:1px solid #d5e2f4;padding:7px;text-align:left;font-size:13px;vertical-align:top;}
#${CARD_ID} th{background:#f3f8ff;}
#${CARD_ID} .sbo-chip{display:inline-block;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:700;}
#${CARD_ID} .sbo-chip.high{background:#ffe5e5;color:#992222;}
#${CARD_ID} .sbo-chip.mid{background:#fff0d9;color:#9f5d00;}
#${CARD_ID} .sbo-chip.low{background:#e7f8ef;color:#19643a;}
#${CARD_ID} .sbo-chip.active{background:#e7f8ef;color:#19643a;}
#${CARD_ID} .sbo-chip.pending{background:#eef3ff;color:#1d4f87;}
#${CARD_ID} .sbo-actions{display:flex;flex-wrap:wrap;gap:6px;}
#${CARD_ID} .sbo-actions button{border:1px solid #cbdcf2;background:#fff;color:#12395f;border-radius:999px;padding:4px 9px;font-size:12px;cursor:pointer;}
#${CARD_ID} .sbo-log{max-height:160px;overflow:auto;border:1px solid #dce6f5;border-radius:8px;padding:8px;background:#fff;}
    `;
    document.head.appendChild(style);
  }

  const card = document.createElement('div');
  card.className = 'container';
  card.id = CARD_ID;
  card.innerHTML = `
    <h2>Boost Orchestrator Pro</h2>
    <p id="sboStatus" class="sbo-status">Loading boost model...</p>
    <div class="sbo-toolbar">
      <button id="sboRefreshBtn" class="sbo-btn" type="button">Refresh</button>
      <button id="sboQueueTopBtn" class="sbo-btn alt" type="button">Queue Top Candidates</button>
      <button id="sboRunQueueBtn" class="sbo-btn warn" type="button">Run Queue</button>
      <button id="sboCsvBtn" class="sbo-btn alt" type="button">Export CSV</button>
    </div>
    <div class="sbo-settings">
      <label>Daily Budget (INR)<input id="sboBudgetInput" type="number" min="100" max="25000" step="100"></label>
      <label>Max Listings / Run<input id="sboRunLimitInput" type="number" min="1" max="20" step="1"></label>
      <label>Minimum Priority<input id="sboMinPriorityInput" type="number" min="20" max="95" step="1"></label>
    </div>
    <div id="sboKpi" class="sbo-kpi"></div>
    <div id="sboTable" class="sbo-wrap"></div>
    <section style="margin-top:10px;">
      <h3 style="margin:0 0 8px;color:#11466e;">Boost Activity Log</h3>
      <div id="sboLog" class="sbo-log"></div>
    </section>
  `;

  const renewalCard = document.getElementById('sellerRenewalControlCard');
  const analyticsCard = document.getElementById('sellerAnalyticsProCard');
  const anchor = renewalCard || analyticsCard || document.querySelector('.container');
  if (anchor) anchor.insertAdjacentElement('afterend', card);
  else document.body.appendChild(card);

  const statusEl = document.getElementById('sboStatus');
  const budgetInput = document.getElementById('sboBudgetInput');
  const runLimitInput = document.getElementById('sboRunLimitInput');
  const minPriorityInput = document.getElementById('sboMinPriorityInput');
  const refreshBtn = document.getElementById('sboRefreshBtn');
  const queueTopBtn = document.getElementById('sboQueueTopBtn');
  const runQueueBtn = document.getElementById('sboRunQueueBtn');
  const csvBtn = document.getElementById('sboCsvBtn');
  const kpiEl = document.getElementById('sboKpi');
  const tableEl = document.getElementById('sboTable');
  const logEl = document.getElementById('sboLog');

  let plans = new Map();
  let model = { rows: [], summary: {}, queue: [] };

  const setStatus = (message, ok = true) => {
    statusEl.textContent = message;
    statusEl.style.color = ok ? '#1f6d3d' : '#8d1e1e';
  };

  const priorityClass = (priority) => {
    const value = numberFrom(priority, 0);
    if (value >= 75) return 'high';
    if (value >= 55) return 'mid';
    return 'low';
  };

  const writeSettingsToUi = () => {
    const settings = getSettings();
    budgetInput.value = String(numberFrom(settings.dailyBudget, 2500));
    runLimitInput.value = String(numberFrom(settings.maxListingsPerRun, 3));
    minPriorityInput.value = String(numberFrom(settings.minPriority, 55));
  };
  const readSettingsFromUi = () => ({
    dailyBudget: clamp(numberFrom(budgetInput.value, 2500), 100, 25000),
    maxListingsPerRun: clamp(numberFrom(runLimitInput.value, 3), 1, 20),
    minPriority: clamp(numberFrom(minPriorityInput.value, 55), 20, 95),
  });

  const renderKpi = () => {
    const summary = model.summary || {};
    kpiEl.innerHTML = `
      <div class="sbo-kpi-item"><small>Total Listings</small><b>${numberFrom(summary.listings, 0)}</b></div>
      <div class="sbo-kpi-item"><small>Featured Active</small><b>${numberFrom(summary.featuredActive, 0)}</b></div>
      <div class="sbo-kpi-item"><small>Boost Candidates</small><b>${numberFrom(summary.candidates, 0)}</b></div>
      <div class="sbo-kpi-item"><small>Queued</small><b>${numberFrom(summary.queued, 0)}</b></div>
      <div class="sbo-kpi-item"><small>Queue Spend</small><b>${inr(summary.estimatedQueueSpend)}</b></div>
      <div class="sbo-kpi-item"><small>Spent Today</small><b>${inr(summary.todaySpent)}</b></div>
      <div class="sbo-kpi-item"><small>Top Pick</small><b>${escapeHtml(text(summary.topPick, '-'))}</b></div>
    `;
  };

  const renderTable = () => {
    if (!model.rows.length) {
      tableEl.innerHTML = '<p style="margin:0;color:#607da8;">No seller listings found for boost orchestration.</p>';
      return;
    }
    const planOptions = [...plans.values()];
    tableEl.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Listing</th>
            <th>Visibility</th>
            <th>Featured Status</th>
            <th>Priority</th>
            <th>Recommended</th>
            <th>Queue</th>
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
              <td>
                Views: ${row.views}<br>
                Saves: ${row.saves}<br>
                Inquiries: ${row.inquiries}<br>
                Chats: ${row.chats}
              </td>
              <td>
                <span class="sbo-chip ${row.featuredActive ? 'active' : 'pending'}">${row.featuredActive ? `Active (${row.featuredDaysLeft}d)` : 'Not Featured'}</span><br>
                <small style="color:#5b6e86;">Age: ${row.ageDays}d</small>
              </td>
              <td><span class="sbo-chip ${priorityClass(row.boostPriority)}">${row.boostPriority}</span></td>
              <td>
                <select data-plan-for="${escapeHtml(row.id)}">
                  ${planOptions.map((plan) => `
                    <option value="${escapeHtml(plan.id)}" ${plan.id === row.recommendedPlanId ? 'selected' : ''}>
                      ${escapeHtml(plan.name)} (${escapeHtml(inr(plan.amount))})
                    </option>
                  `).join('')}
                </select>
                <br>
                <small style="color:#5b6e86;">Lead lift: +${row.expectedLeadLiftPct}%</small>
              </td>
              <td>
                ${row.queued
    ? `<span class="sbo-chip pending">Queued</span><br><small style="color:#5b6e86;">${escapeHtml(text(row.queued.planId))} | ${escapeHtml(inr(row.queued.amount))}</small>`
    : '<span style="color:#607da8;">Not queued</span>'}
              </td>
              <td>
                <div class="sbo-actions">
                  <button type="button" data-action="queue" data-id="${escapeHtml(row.id)}">Queue</button>
                  <button type="button" data-action="boost" data-id="${escapeHtml(row.id)}">Boost Now</button>
                  ${row.queued ? `<button type="button" data-action="dequeue" data-id="${escapeHtml(row.id)}">Remove</button>` : ''}
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
      logEl.innerHTML = '<p style="margin:0;color:#607da8;">No boost activity yet.</p>';
      return;
    }
    logEl.innerHTML = rows.slice(0, 30).map((row) => `
      <p style="margin:0 0 8px;">
        <b>${escapeHtml(text(row.type, 'info').toUpperCase())}</b>
        <small style="color:#607da8;">${escapeHtml(new Date(row.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }))}</small><br>
        <span style="color:#385a7a;">${escapeHtml(text(row.title, row.propertyId))} | ${escapeHtml(text(row.planId, '-'))} | ${escapeHtml(inr(row.amount))}</span><br>
        <span style="color:#567395;">${escapeHtml(text(row.message, '-'))}</span>
      </p>
    `).join('');
  };

  const queueListing = (row, planId) => {
    const id = text(row?.id);
    if (!id) return false;
    const plan = plans.get(text(planId)) || plans.get(row.recommendedPlanId) || DEFAULT_PLANS['featured-7'];
    const queue = getQueue().filter((item) => item.propertyId !== id);
    queue.unshift({
      propertyId: id,
      title: row.title,
      planId: plan.id,
      priority: row.boostPriority,
      amount: Math.max(0, numberFrom(plan.amount, 0)),
      cycleDays: Math.max(1, numberFrom(plan.cycleDays, 7)),
      queuedAt: new Date().toISOString(),
    });
    setQueue(queue);
    pushLog({
      type: 'queued',
      propertyId: id,
      title: row.title,
      planId: plan.id,
      amount: plan.amount,
      priority: row.boostPriority,
      message: 'Listing queued for boost.',
    });
    return true;
  };

  const dequeueListing = (id) => {
    const cleanId = text(id);
    if (!cleanId) return false;
    const before = getQueue();
    const after = before.filter((item) => item.propertyId !== cleanId);
    setQueue(after);
    return before.length !== after.length;
  };

  const runQueuedBoosts = async () => {
    const settings = getSettings();
    const queue = getQueue().sort((a, b) => numberFrom(b.priority, 0) - numberFrom(a.priority, 0));
    if (!queue.length) {
      setStatus('Queue empty. Add listings first.', false);
      return;
    }

    let budgetLeft = Math.max(0, numberFrom(settings.dailyBudget, 0) - getTodaySpent());
    let remainingSlots = numberFrom(settings.maxListingsPerRun, 0);
    const minPriority = numberFrom(settings.minPriority, 55);
    let successCount = 0;
    let failedCount = 0;
    const retained = [];

    for (const item of queue) {
      if (remainingSlots <= 0) {
        retained.push(item);
        continue;
      }
      const plan = plans.get(item.planId) || DEFAULT_PLANS[item.planId] || DEFAULT_PLANS['featured-7'];
      const amount = Math.max(0, numberFrom(plan.amount, item.amount));
      if (numberFrom(item.priority, 0) < minPriority) {
        retained.push(item);
        continue;
      }
      if (amount > budgetLeft) {
        retained.push(item);
        continue;
      }

      const row = model.rows.find((entry) => entry.id === item.propertyId);
      const payloadRow = row || { id: item.propertyId, title: item.title };
      const result = await executeBoost({ row: payloadRow, plan });
      if (!result.ok) {
        failedCount += 1;
        pushLog({
          type: 'failed',
          propertyId: item.propertyId,
          title: item.title,
          planId: plan.id,
          amount,
          priority: item.priority,
          message: text(result.message, 'Queue boost failed.'),
        });
        retained.push(item);
        continue;
      }

      successCount += 1;
      budgetLeft -= amount;
      remainingSlots -= 1;
      pushLog({
        type: 'boosted',
        propertyId: item.propertyId,
        title: item.title,
        planId: plan.id,
        amount,
        priority: item.priority,
        message: result.mode === 'live' ? 'Boost activated via live payment.' : 'Boost activated in backup mode.',
      });
      notify(
        'Boost Activated',
        `${item.title} boosted with ${plan.name} (${inr(amount)}).`,
        'success',
      );
    }

    setQueue(retained);
    setStatus(`Queue run complete. Success: ${successCount}, Failed: ${failedCount}, Budget left: ${inr(budgetLeft)}.`);
    await refresh();
  };

  const exportCsv = () => {
    const headers = ['Property ID', 'Title', 'Priority', 'Views', 'Saves', 'Inquiries', 'Chats', 'Recommended Plan', 'Amount', 'Expected Lead Lift %', 'Queued'];
    const rows = (model.rows || []).map((row) => ([
      row.id,
      row.title,
      String(numberFrom(row.boostPriority, 0)),
      String(numberFrom(row.views, 0)),
      String(numberFrom(row.saves, 0)),
      String(numberFrom(row.inquiries, 0)),
      String(numberFrom(row.chats, 0)),
      row.recommendedPlanName,
      String(numberFrom(row.recommendedAmount, 0)),
      String(numberFrom(row.expectedLeadLiftPct, 0)),
      row.queued ? 'yes' : 'no',
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
    link.download = `seller-boost-orchestrator-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus('Boost orchestrator CSV exported.');
  };

  const queueTopCandidates = () => {
    const settings = getSettings();
    const candidates = (model.rows || [])
      .filter((row) => row.boostPriority >= settings.minPriority)
      .filter((row) => !row.queued)
      .slice(0, settings.maxListingsPerRun);
    if (!candidates.length) {
      setStatus('No eligible candidates for queue.', false);
      return;
    }
    candidates.forEach((row) => queueListing(row, row.recommendedPlanId));
    setStatus(`${candidates.length} top candidate(s) added to queue.`);
    refresh().catch(() => null);
  };

  const refresh = async () => {
    if (typeof live.syncLocalListingsFromApi === 'function') {
      try {
        await live.syncLocalListingsFromApi();
      } catch (error) {
        if (!allowDemoFallback) {
          setStatus(text(error?.message, 'Live listing sync failed.'), false);
        }
      }
    }
    plans = await loadPlans();
    model = buildModel({ plans });
    renderKpi();
    renderTable();
    renderLog();
    setStatus(`Boost model ready. ${numberFrom(model.summary?.candidates, 0)} candidate(s) detected.`);
  };

  refreshBtn?.addEventListener('click', () => {
    setSettings(readSettingsFromUi());
    refresh().catch((error) => setStatus(text(error?.message, 'Refresh failed.'), false));
  });
  queueTopBtn?.addEventListener('click', queueTopCandidates);
  runQueueBtn?.addEventListener('click', () => {
    setSettings(readSettingsFromUi());
    runQueuedBoosts().catch((error) => setStatus(text(error?.message, 'Queue run failed.'), false));
  });
  csvBtn?.addEventListener('click', exportCsv);

  [budgetInput, runLimitInput, minPriorityInput].forEach((input) => {
    input?.addEventListener('change', () => {
      setSettings(readSettingsFromUi());
      refresh().catch(() => null);
    });
  });

  tableEl?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = text(target.getAttribute('data-action')).toLowerCase();
    const id = text(target.getAttribute('data-id'));
    if (!action || !id) return;
    const row = (model.rows || []).find((item) => item.id === id);
    if (!row) return;

    const planSelect = tableEl.querySelector(`select[data-plan-for="${id}"]`);
    const planId = text(planSelect?.value, row.recommendedPlanId);
    const plan = plans.get(planId) || DEFAULT_PLANS[planId] || DEFAULT_PLANS['featured-7'];

    if (action === 'queue') {
      queueListing(row, planId);
      setStatus(`${row.title} added to queue (${plan.name}).`);
      refresh().catch(() => null);
      return;
    }
    if (action === 'dequeue') {
      const removed = dequeueListing(id);
      setStatus(removed ? `${row.title} removed from queue.` : 'Listing not found in queue.', removed);
      refresh().catch(() => null);
      return;
    }
    if (action === 'boost') {
      executeBoost({ row, plan })
        .then((result) => {
          if (!result.ok) {
            setStatus(text(result.message, 'Boost failed.'), false);
            pushLog({
              type: 'failed',
              propertyId: row.id,
              title: row.title,
              planId: plan.id,
              amount: plan.amount,
              priority: row.boostPriority,
              message: text(result.message, 'Manual boost failed.'),
            });
            return;
          }
          pushLog({
            type: 'boosted',
            propertyId: row.id,
            title: row.title,
            planId: plan.id,
            amount: plan.amount,
            priority: row.boostPriority,
            message: result.mode === 'live' ? 'Manual boost via live payment.' : 'Manual boost via backup mode.',
          });
          dequeueListing(row.id);
          notify('Boost Activated', `${row.title} boosted with ${plan.name}.`, 'success');
          setStatus(`${row.title} boosted (${plan.name}).`);
          refresh().catch(() => null);
        })
        .catch((error) => setStatus(text(error?.message, 'Boost failed.'), false));
      return;
    }
    if (action === 'open') {
      window.open(`property-details.html?id=${encodeURIComponent(row.id)}`, '_blank', 'noopener,noreferrer');
    }
  });

  writeSettingsToUi();
  refresh().catch((error) => {
    setStatus(text(error?.message, 'Unable to load boost orchestrator.'), false);
  });
})();
