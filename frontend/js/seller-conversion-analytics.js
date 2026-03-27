(() => {
  if (document.getElementById('sellerConversionAnalyticsCard')) return;

  const live = window.PropertySetuLive || {};
  const isSellerPage = Boolean(document.getElementById('addPropertyForm') && document.getElementById('propertyList'));
  if (!isSellerPage) return;

  const STYLE_ID = 'seller-conversion-analytics-style';
  const CARD_ID = 'sellerConversionAnalyticsCard';
  const LISTINGS_KEY = 'propertySetu:listings';
  const SELLER_ENGAGEMENT_KEY = 'propertySetu:sellerEngagement';
  const USER_VISIT_KEY = 'propertySetu:userVisits';
  const VIDEO_VISIT_KEY = 'propertySetu:videoVisits';
  const VISIT_CACHE_KEY = 'propertySetu:sellerVisitQueueCache';
  const CHAT_PREFIX = 'propertySetu:userChat:';
  const SETTINGS_KEY = 'propertySetu:sellerFollowupSettings';
  const TRACK_KEY = 'propertySetu:sellerFollowupReminderTrack';
  const HOUR_MS = 3600000;
  const DAY_MS = 86400000;

  const text = (value, fallback = '') => {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  };
  const numberFrom = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
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

  const getToken = () => {
    if (typeof live.getAnyToken === 'function') return text(live.getAnyToken());
    if (typeof live.getToken === 'function') return text(live.getToken('seller') || live.getToken('admin') || live.getToken('customer'));
    return '';
  };
  const getSessionId = () => {
    if (typeof live.getAnySession === 'function') return text(live.getAnySession()?.id);
    return '';
  };
  const toIso = (value) => {
    const d = new Date(value || '');
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString();
  };
  const ts = (value) => {
    const d = new Date(value || '');
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  };
  const toLabel = (value) => {
    const d = new Date(value || '');
    if (Number.isNaN(d.getTime())) return '-';
    return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  };
  const maxIso = (a, b) => {
    const at = ts(a);
    const bt = ts(b);
    if (!at && !bt) return '';
    return new Date(Math.max(at, bt)).toISOString();
  };

  const getTrack = () => {
    const map = readJson(TRACK_KEY, {});
    return map && typeof map === 'object' ? map : {};
  };
  const setTrack = (next) => writeJson(TRACK_KEY, next && typeof next === 'object' ? next : {});
  const getSettings = () => {
    const settings = readJson(SETTINGS_KEY, {});
    return {
      thresholdHours: Math.max(1, numberFrom(settings?.thresholdHours, 24)),
    };
  };
  const setSettings = (next) => {
    const current = getSettings();
    writeJson(SETTINGS_KEY, { ...current, ...(next || {}) });
  };

  const pushNotification = (title, message, type = 'warn') => {
    if (!title || !message) return;
    if (window.PropertySetuNotify && typeof window.PropertySetuNotify.emit === 'function') {
      window.PropertySetuNotify.emit({ title, message, audience: ['seller', 'admin'], type });
      return;
    }
    const existing = readJson('propertySetu:notifications', []);
    const list = Array.isArray(existing) ? existing : [];
    list.unshift({
      id: `sca-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      message,
      type,
      audience: ['seller', 'admin'],
      createdAt: new Date().toISOString(),
      readBy: {},
    });
    while (list.length > 500) list.pop();
    writeJson('propertySetu:notifications', list);
    try {
      localStorage.setItem('propertySetu:notifications:ping', String(Date.now()));
    } catch {
      // no-op
    }
  };

  const normalizeVisitStatus = (value) => {
    const raw = text(value, 'requested').toLowerCase();
    if (raw === 'scheduled') return 'requested';
    if (raw === 'confirmed') return 'confirmed';
    if (raw === 'completed') return 'completed';
    if (raw === 'rejected') return 'rejected';
    if (raw === 'cancelled') return 'cancelled';
    return 'requested';
  };
  const normalizeVisit = (item = {}, source = 'local') => {
    const property = item.property && typeof item.property === 'object' ? item.property : {};
    const propertyId = text(item.propertyId || item.listingId || property.id);
    if (!propertyId) return null;
    return {
      id: text(item.id || item._id || `${source}-${propertyId}-${Date.now()}`),
      propertyId,
      customerId: text(item.customerId || item.userId || item.buyerId),
      customerName: text(item.customerName || item.userName || item.buyerName, 'Customer'),
      status: normalizeVisitStatus(item.status || item.coreStatus),
      createdAt: toIso(item.createdAt || item.preferredAt || item.visitAt),
    };
  };
  const normalizeChat = (item = {}, listingId = '') => {
    const propertyId = text(item.propertyId || item.listingId || listingId);
    if (!propertyId) return null;
    return {
      id: text(item.id || item._id || `${propertyId}-${Date.now()}`),
      propertyId,
      senderId: text(item.senderId || item.fromUserId),
      receiverId: text(item.receiverId || item.toUserId),
      message: text(item.message),
      createdAt: toIso(item.createdAt || item.sentAt || item.timestamp),
    };
  };
  const uniqueBy = (items = [], keyFn) => {
    const map = new Map();
    (Array.isArray(items) ? items : []).forEach((item) => {
      const key = text(keyFn(item));
      if (!key) return;
      const prev = map.get(key);
      if (!prev) {
        map.set(key, item);
        return;
      }
      const pt = ts(prev.updatedAt || prev.createdAt);
      const nt = ts(item.updatedAt || item.createdAt);
      if (nt >= pt) map.set(key, item);
    });
    return [...map.values()];
  };

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${CARD_ID} .sca-status{margin:0 0 10px;color:#1f6d3d;font-size:14px;}
#${CARD_ID} .sca-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px;}
#${CARD_ID} .sca-btn{border:1px solid #0b3d91;border-radius:8px;background:#0b3d91;color:#fff;padding:7px 11px;font-weight:700;cursor:pointer;}
#${CARD_ID} .sca-btn.alt{background:#fff;color:#0b3d91;}
#${CARD_ID} .sca-btn.warn{background:#8f4f00;border-color:#8f4f00;}
#${CARD_ID} .sca-select{border:1px solid #ccd9ee;border-radius:8px;padding:6px 9px;}
#${CARD_ID} .sca-kpi-grid{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-bottom:10px;}
#${CARD_ID} .sca-kpi{border:1px solid #d7e6f8;border-radius:8px;background:#f7fbff;padding:8px;}
#${CARD_ID} .sca-kpi small{display:block;color:#58718f;}
#${CARD_ID} .sca-kpi b{color:#11466e;font-size:16px;}
#${CARD_ID} .sca-wrap{border:1px solid #dbe6f5;border-radius:10px;padding:10px;background:#fff;margin-bottom:10px;}
#${CARD_ID} table{width:100%;border-collapse:collapse;}
#${CARD_ID} th,#${CARD_ID} td{border:1px solid #d5e2f4;padding:7px;text-align:left;font-size:13px;}
#${CARD_ID} th{background:#f3f8ff;}
#${CARD_ID} .sca-lead{border:1px solid #dce6f5;border-radius:9px;padding:9px;background:#fff;margin-bottom:8px;}
#${CARD_ID} .sca-chip{display:inline-block;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:700;}
#${CARD_ID} .sca-chip.urgent{background:#ffe5e5;color:#992222;}
#${CARD_ID} .sca-chip.soon{background:#fff0d9;color:#9f5d00;}
#${CARD_ID} .sca-meta{margin:6px 0;color:#4a617b;font-size:12px;line-height:1.45;}
#${CARD_ID} .sca-actions{display:flex;flex-wrap:wrap;gap:6px;}
#${CARD_ID} .sca-actions button{border:1px solid #cbdcf2;background:#fff;color:#12395f;border-radius:999px;padding:4px 9px;font-size:12px;cursor:pointer;}
    `;
    document.head.appendChild(style);
  }

  const card = document.createElement('div');
  card.className = 'container';
  card.id = CARD_ID;
  card.innerHTML = `
    <h2>Inquiry Conversion & Follow-up Center</h2>
    <p id="scaStatus" class="sca-status">Loading conversion analytics...</p>
    <div class="sca-toolbar">
      <button id="scaRefreshBtn" class="sca-btn" type="button">Refresh</button>
      <button id="scaRunReminderBtn" class="sca-btn warn" type="button">Run Auto Reminders</button>
      <button id="scaCsvBtn" class="sca-btn alt" type="button">Export CSV</button>
      <label style="font-size:13px;color:#3d5674;">
        Follow-up due after
        <select id="scaThresholdSelect" class="sca-select">
          <option value="6">6h</option>
          <option value="12">12h</option>
          <option value="24">24h</option>
          <option value="36">36h</option>
          <option value="48">48h</option>
        </select>
      </label>
    </div>
    <div id="scaKpiGrid" class="sca-kpi-grid"></div>
    <div id="scaTableWrap" class="sca-wrap"><p style="margin:0;color:#607da8;">No property analytics available.</p></div>
    <div id="scaLeadWrap" class="sca-wrap"><p style="margin:0;color:#607da8;">No due follow-ups.</p></div>
  `;
  const visitCard = document.getElementById('sellerVisitManagerCard');
  const chatCard = document.getElementById('sellerChatInboxCard');
  const renewalCard = document.getElementById('sellerRenewalControlCard');
  const containers = Array.from(document.querySelectorAll('.container'));
  const anchor = visitCard || chatCard || renewalCard || containers[1] || containers[containers.length - 1];
  if (anchor) anchor.insertAdjacentElement('afterend', card);
  else document.body.appendChild(card);

  const statusEl = document.getElementById('scaStatus');
  const refreshBtn = document.getElementById('scaRefreshBtn');
  const runReminderBtn = document.getElementById('scaRunReminderBtn');
  const csvBtn = document.getElementById('scaCsvBtn');
  const thresholdEl = document.getElementById('scaThresholdSelect');
  const kpiGridEl = document.getElementById('scaKpiGrid');
  const tableWrapEl = document.getElementById('scaTableWrap');
  const leadWrapEl = document.getElementById('scaLeadWrap');

  let model = { rows: [], dueLeads: [], summary: {} };
  const setStatus = (message, ok = true) => {
    statusEl.textContent = message;
    statusEl.style.color = ok ? '#1f6d3d' : '#8d1e1e';
  };

  const collectListings = () => {
    const sessionId = getSessionId();
    const rows = readJson(LISTINGS_KEY, []);
    return (Array.isArray(rows) ? rows : [])
      .filter((item) => item && typeof item === 'object')
      .filter((item) => !sessionId || text(item.ownerId) === sessionId);
  };
  const collectEngagement = () => {
    const map = readJson(SELLER_ENGAGEMENT_KEY, {});
    return map && typeof map === 'object' ? map : {};
  };
  const collectLocalChats = () => {
    const chats = [];
    try {
      const keyCount = numberFrom(localStorage.length, 0);
      for (let i = 0; i < keyCount; i += 1) {
        const key = text(localStorage.key(i));
        if (!key.startsWith(CHAT_PREFIX)) continue;
        const listingId = key.slice(CHAT_PREFIX.length);
        const items = readJson(key, []);
        (Array.isArray(items) ? items : []).forEach((entry) => {
          const normalized = normalizeChat(entry, listingId);
          if (normalized) chats.push(normalized);
        });
      }
    } catch {
      // no-op
    }
    return chats;
  };
  const collectLiveChats = async (token) => {
    if (!token || typeof live.request !== 'function') return [];
    try {
      const response = await live.request('/chat/mine', { token });
      const items = Array.isArray(response?.items) ? response.items : [];
      return items.map((entry) => normalizeChat(entry)).filter(Boolean);
    } catch {
      return [];
    }
  };
  const collectVisits = async (token) => {
    const local = [];
    const cacheVisits = readJson(VISIT_CACHE_KEY, []);
    const userVisits = readJson(USER_VISIT_KEY, []);
    const videoVisits = readJson(VIDEO_VISIT_KEY, []);
    (Array.isArray(cacheVisits) ? cacheVisits : []).forEach((entry) => {
      const normalized = normalizeVisit(entry, 'cache');
      if (normalized) local.push(normalized);
    });
    (Array.isArray(userVisits) ? userVisits : []).forEach((entry) => {
      const normalized = normalizeVisit(entry, 'user');
      if (normalized) local.push(normalized);
    });
    (Array.isArray(videoVisits) ? videoVisits : []).forEach((entry) => {
      const normalized = normalizeVisit(entry, 'video');
      if (normalized) local.push(normalized);
    });
    let liveVisits = [];
    if (token && typeof live.request === 'function') {
      try {
        const response = await live.request('/visits/owner', { token });
        const items = Array.isArray(response?.items) ? response.items : [];
        liveVisits = items.map((entry) => normalizeVisit(entry, 'live')).filter(Boolean);
      } catch {
        // fallback local
      }
    }
    return uniqueBy([...liveVisits, ...local], (item) => text(item.id) || `${item.propertyId}:${item.customerId}:${item.createdAt}`);
  };

  const computeModel = ({ listings, engagementStore, chats, visits, sessionId, thresholdHours }) => {
    const listingMap = new Map();
    listings.forEach((item) => {
      const id = text(item.id);
      if (id) listingMap.set(id, item);
    });
    const propertyMap = new Map();
    const leadMap = new Map();
    const ensureRow = (propertyId) => {
      const id = text(propertyId);
      if (!id) return null;
      if (propertyMap.has(id)) return propertyMap.get(id);
      const listing = listingMap.get(id) || {};
      const row = {
        propertyId: id,
        propertyTitle: text(listing.title, id),
        inquiries: 0,
        completed: 0,
        uniqueLeads: 0,
        followUpDue: 0,
        conversionPct: 0,
        _leadSet: new Set(),
      };
      const engagement = engagementStore[id] && typeof engagementStore[id] === 'object' ? engagementStore[id] : {};
      row.inquiries += numberFrom(engagement.inquiries, 0);
      propertyMap.set(id, row);
      return row;
    };
    const ensureLead = (propertyId, counterpartId, propertyTitle) => {
      const key = `${propertyId}::${counterpartId || 'unknown'}`;
      if (leadMap.has(key)) return leadMap.get(key);
      const lead = {
        key,
        propertyId,
        propertyTitle: text(propertyTitle, propertyId),
        counterpartId: text(counterpartId, 'unknown'),
        customerName: '',
        lastInboundAt: '',
        lastOutboundAt: '',
        visitStatus: '',
        completed: false,
        closed: false,
      };
      leadMap.set(key, lead);
      return lead;
    };

    chats.forEach((chat) => {
      const propertyId = text(chat.propertyId);
      if (!propertyId) return;
      const senderId = text(chat.senderId);
      const receiverId = text(chat.receiverId);
      if (sessionId && senderId !== sessionId && receiverId !== sessionId) return;
      const row = ensureRow(propertyId);
      const counterpart = senderId === sessionId ? receiverId : senderId;
      const lead = ensureLead(propertyId, counterpart, row.propertyTitle);
      const createdAt = text(chat.createdAt);
      if (!sessionId || receiverId === sessionId) {
        row.inquiries += 1;
        if (counterpart) row._leadSet.add(counterpart);
        lead.lastInboundAt = maxIso(lead.lastInboundAt, createdAt);
      } else if (senderId === sessionId) {
        lead.lastOutboundAt = maxIso(lead.lastOutboundAt, createdAt);
      }
    });

    visits.forEach((visit) => {
      const row = ensureRow(visit.propertyId);
      const customerId = text(visit.customerId, `visit-${visit.id}`);
      row._leadSet.add(customerId);
      if (visit.status === 'completed') row.completed += 1;
      if (visit.status === 'requested' || visit.status === 'confirmed') row.inquiries += 1;
      const lead = ensureLead(visit.propertyId, customerId, row.propertyTitle);
      lead.customerName = text(visit.customerName, lead.customerName || 'Customer');
      lead.visitStatus = visit.status;
      lead.lastInboundAt = maxIso(lead.lastInboundAt, visit.createdAt);
      if (visit.status === 'completed') lead.completed = true;
      if (visit.status === 'rejected' || visit.status === 'cancelled') lead.closed = true;
    });

    const now = Date.now();
    const trackMap = getTrack();
    const dueLeads = [];
    const rows = [...propertyMap.values()].map((row) => {
      row.uniqueLeads = row._leadSet.size;
      row.inquiries = Math.max(row.inquiries, row.uniqueLeads);
      row.conversionPct = row.inquiries > 0 ? Math.round((row.completed / row.inquiries) * 100) : 0;
      return row;
    });

    [...leadMap.values()].forEach((lead) => {
      const inboundTs = ts(lead.lastInboundAt);
      const outboundTs = ts(lead.lastOutboundAt);
      if (!inboundTs) return;
      if (lead.completed || lead.closed) return;
      if (outboundTs && outboundTs >= inboundTs) return;
      const ageHours = Math.floor((now - inboundTs) / HOUR_MS);
      if (ageHours < thresholdHours) return;
      const track = trackMap[lead.key] || {};
      const handled = text(track.handledInboundAt) === text(lead.lastInboundAt);
      const snoozed = ts(track.snoozeUntil) > now;
      if (handled || snoozed) return;
      dueLeads.push({
        ...lead,
        markerInboundAt: text(lead.lastInboundAt),
        ageHours,
        priority: ageHours >= 48 ? 'urgent' : 'soon',
      });
    });

    const byProperty = dueLeads.reduce((acc, lead) => {
      acc[lead.propertyId] = (acc[lead.propertyId] || 0) + 1;
      return acc;
    }, {});
    rows.forEach((row) => {
      row.followUpDue = numberFrom(byProperty[row.propertyId], 0);
      row._leadSet = undefined;
    });

    rows.sort((a, b) => {
      if (b.followUpDue !== a.followUpDue) return b.followUpDue - a.followUpDue;
      if (b.inquiries !== a.inquiries) return b.inquiries - a.inquiries;
      return b.conversionPct - a.conversionPct;
    });
    dueLeads.sort((a, b) => b.ageHours - a.ageHours);

    const totalInquiries = rows.reduce((sum, row) => sum + numberFrom(row.inquiries, 0), 0);
    const totalCompleted = rows.reduce((sum, row) => sum + numberFrom(row.completed, 0), 0);
    const overallConversionPct = totalInquiries > 0 ? Math.round((totalCompleted / totalInquiries) * 100) : 0;
    const openLeads = [...leadMap.values()].filter((lead) => !lead.completed && !lead.closed).length;

    return {
      rows,
      dueLeads,
      summary: {
        properties: rows.length,
        totalInquiries,
        totalCompleted,
        overallConversionPct,
        openLeads,
        dueCount: dueLeads.length,
      },
    };
  };

  const render = () => {
    const summary = model.summary || {};
    kpiGridEl.innerHTML = `
      <div class="sca-kpi"><small>Properties</small><b>${numberFrom(summary.properties, 0)}</b></div>
      <div class="sca-kpi"><small>Total Inquiries</small><b>${numberFrom(summary.totalInquiries, 0)}</b></div>
      <div class="sca-kpi"><small>Completed Visits</small><b>${numberFrom(summary.totalCompleted, 0)}</b></div>
      <div class="sca-kpi"><small>Conversion</small><b>${numberFrom(summary.overallConversionPct, 0)}%</b></div>
      <div class="sca-kpi"><small>Open Leads</small><b>${numberFrom(summary.openLeads, 0)}</b></div>
      <div class="sca-kpi"><small>Follow-up Due</small><b>${numberFrom(summary.dueCount, 0)}</b></div>
    `;

    if (!model.rows.length) {
      tableWrapEl.innerHTML = '<p style="margin:0;color:#607da8;">No property analytics available yet.</p>';
    } else {
      tableWrapEl.innerHTML = `
        <h3 style="margin:0 0 8px;color:#124a72;">Property-wise Conversion</h3>
        <table>
          <thead>
            <tr>
              <th>Property</th>
              <th>Inquiries</th>
              <th>Unique Leads</th>
              <th>Completed</th>
              <th>Conversion</th>
              <th>Due Follow-ups</th>
            </tr>
          </thead>
          <tbody>
            ${model.rows.map((row) => `
              <tr>
                <td><b>${escapeHtml(row.propertyTitle)}</b><br><small style="color:#5b6e86;">${escapeHtml(row.propertyId)}</small></td>
                <td>${numberFrom(row.inquiries, 0)}</td>
                <td>${numberFrom(row.uniqueLeads, 0)}</td>
                <td>${numberFrom(row.completed, 0)}</td>
                <td>${numberFrom(row.conversionPct, 0)}%</td>
                <td>${numberFrom(row.followUpDue, 0)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    if (!model.dueLeads.length) {
      leadWrapEl.innerHTML = '<h3 style="margin:0 0 8px;color:#124a72;">Auto Follow-up Queue</h3><p style="margin:0;color:#607da8;">No due follow-ups right now.</p>';
    } else {
      leadWrapEl.innerHTML = `
        <h3 style="margin:0 0 8px;color:#124a72;">Auto Follow-up Queue</h3>
        ${model.dueLeads.map((lead) => `
          <article class="sca-lead">
            <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;">
              <b>${escapeHtml(lead.propertyTitle)}</b>
              <span class="sca-chip ${escapeHtml(lead.priority)}">${lead.priority === 'urgent' ? 'Urgent' : 'Due'}</span>
            </div>
            <div class="sca-meta">
              Lead: ${escapeHtml(lead.customerName || lead.counterpartId)}<br>
              Last inbound: ${escapeHtml(toLabel(lead.lastInboundAt))}<br>
              Pending for: <b>${numberFrom(lead.ageHours, 0)}h</b>
            </div>
            <div class="sca-actions">
              <button type="button" data-action="mark-followed" data-key="${escapeHtml(lead.key)}" data-inbound="${escapeHtml(lead.markerInboundAt)}">Mark Followed Up</button>
              <button type="button" data-action="snooze" data-key="${escapeHtml(lead.key)}">Snooze 24h</button>
              <button type="button" data-action="notify" data-key="${escapeHtml(lead.key)}">Notify Now</button>
            </div>
          </article>
        `).join('')}
      `;
    }
  };

  const runReminders = ({ silent = false } = {}) => {
    if (!model.dueLeads.length) {
      if (!silent) setStatus('No due leads for reminders.');
      return;
    }
    const now = Date.now();
    const cooldown = 12 * HOUR_MS;
    const trackMap = getTrack();
    let sent = 0;
    model.dueLeads.forEach((lead) => {
      const current = trackMap[lead.key] || {};
      const lastReminderTs = ts(current.lastReminderAt);
      const inboundChanged = text(current.lastInboundAt) !== text(lead.markerInboundAt);
      if (!inboundChanged && (now - lastReminderTs) < cooldown) return;
      pushNotification(
        'Lead Follow-up Due',
        `${lead.propertyTitle}: ${lead.customerName || lead.counterpartId} pending ${lead.ageHours}h.`
      );
      trackMap[lead.key] = {
        ...current,
        lastInboundAt: text(lead.markerInboundAt),
        lastReminderAt: new Date().toISOString(),
      };
      sent += 1;
    });
    setTrack(trackMap);
    if (!silent) setStatus(sent ? `Auto reminders sent: ${sent}` : 'Reminder cooldown active. No new reminders.');
  };

  const markFollowed = (key, inboundAt) => {
    const trackMap = getTrack();
    const current = trackMap[key] || {};
    trackMap[key] = {
      ...current,
      handledInboundAt: text(inboundAt),
      handledAt: new Date().toISOString(),
      snoozeUntil: '',
    };
    setTrack(trackMap);
  };
  const snoozeLead = (key) => {
    const trackMap = getTrack();
    const current = trackMap[key] || {};
    trackMap[key] = {
      ...current,
      snoozeUntil: new Date(Date.now() + DAY_MS).toISOString(),
    };
    setTrack(trackMap);
  };

  const exportCsv = () => {
    const headers = ['Property ID', 'Property', 'Inquiries', 'Unique Leads', 'Completed', 'Conversion %', 'Follow-up Due'];
    const rows = model.rows.map((row) => [
      row.propertyId,
      row.propertyTitle,
      String(numberFrom(row.inquiries, 0)),
      String(numberFrom(row.uniqueLeads, 0)),
      String(numberFrom(row.completed, 0)),
      String(numberFrom(row.conversionPct, 0)),
      String(numberFrom(row.followUpDue, 0)),
    ]);
    const enc = (value) => {
      const raw = String(value || '');
      if (!/[",\n]/.test(raw)) return raw;
      return `"${raw.replace(/"/g, '""')}"`;
    };
    const csv = [headers, ...rows].map((line) => line.map(enc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seller-conversion-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatus('Conversion CSV exported.');
  };

  const refresh = async ({ reminderPass = false } = {}) => {
    const settings = getSettings();
    thresholdEl.value = String(settings.thresholdHours);
    setStatus('Refreshing conversion analytics...');

    const token = getToken();
    const sessionId = getSessionId();
    const listings = collectListings();
    const engagementStore = collectEngagement();

    const [liveChats, visits] = await Promise.all([
      collectLiveChats(token),
      collectVisits(token),
    ]);
    const localChats = collectLocalChats();
    const chats = uniqueBy([...liveChats, ...localChats], (item) => text(item.id) || `${item.propertyId}:${item.senderId}:${item.receiverId}:${item.createdAt}`);

    model = computeModel({
      listings,
      engagementStore,
      chats,
      visits,
      sessionId,
      thresholdHours: settings.thresholdHours,
    });
    render();
    setStatus(`Conversion analytics ready. ${numberFrom(model.summary.dueCount, 0)} follow-up(s) due.`);
    if (reminderPass) runReminders({ silent: true });
  };

  refreshBtn?.addEventListener('click', () => {
    refresh().catch((error) => setStatus(text(error?.message, 'Refresh failed.'), false));
  });
  runReminderBtn?.addEventListener('click', () => {
    runReminders({ silent: false });
  });
  csvBtn?.addEventListener('click', exportCsv);
  thresholdEl?.addEventListener('change', () => {
    const hours = Math.max(1, numberFrom(thresholdEl.value, 24));
    setSettings({ thresholdHours: hours });
    refresh().catch((error) => setStatus(text(error?.message, 'Threshold apply failed.'), false));
  });

  leadWrapEl?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = text(target.getAttribute('data-action')).toLowerCase();
    const key = text(target.getAttribute('data-key'));
    if (!action || !key) return;
    if (action === 'mark-followed') {
      markFollowed(key, text(target.getAttribute('data-inbound')));
      setStatus('Lead marked as followed up.');
      refresh().catch(() => null);
      return;
    }
    if (action === 'snooze') {
      snoozeLead(key);
      setStatus('Lead snoozed for 24h.');
      refresh().catch(() => null);
      return;
    }
    if (action === 'notify') {
      const lead = (model.dueLeads || []).find((item) => item.key === key);
      if (!lead) return;
      pushNotification(
        'Manual Follow-up Reminder',
        `${lead.propertyTitle}: ${lead.customerName || lead.counterpartId} pending ${lead.ageHours}h.`
      );
      setStatus('Manual reminder sent.');
    }
  });

  refresh({ reminderPass: true }).catch((error) => {
    setStatus(text(error?.message, 'Unable to load conversion center.'), false);
  });
  window.setInterval(() => {
    refresh({ reminderPass: true }).catch(() => null);
  }, 60000);
})();
