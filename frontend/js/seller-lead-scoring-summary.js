(() => {
  if (document.getElementById('sellerLeadScoringCard')) return;

  const live = window.PropertySetuLive || {};
  const isSellerPage = Boolean(document.getElementById('addPropertyForm') && document.getElementById('propertyList'));
  if (!isSellerPage) return;

  const STYLE_ID = 'seller-lead-scoring-style';
  const CARD_ID = 'sellerLeadScoringCard';
  const LISTINGS_KEY = 'propertySetu:listings';
  const SELLER_ENGAGEMENT_KEY = 'propertySetu:sellerEngagement';
  const USER_VISIT_KEY = 'propertySetu:userVisits';
  const VIDEO_VISIT_KEY = 'propertySetu:videoVisits';
  const VISIT_CACHE_KEY = 'propertySetu:sellerVisitQueueCache';
  const CHAT_PREFIX = 'propertySetu:userChat:';
  const SNAPSHOT_KEY = 'propertySetu:sellerLeadScoreSnapshots';
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

  const ts = (value) => {
    const date = new Date(value || '');
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  };

  const toIso = (value) => {
    const millis = ts(value);
    return millis ? new Date(millis).toISOString() : '';
  };

  const toLabel = (value) => {
    const millis = ts(value);
    if (!millis) return '-';
    return new Date(millis).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const dayKey = (value) => {
    const millis = ts(value);
    if (!millis) return '';
    return new Date(millis).toISOString().slice(0, 10);
  };

  const notify = (title, message, type = 'info') => {
    if (!title || !message) return;
    if (window.PropertySetuNotify && typeof window.PropertySetuNotify.emit === 'function') {
      window.PropertySetuNotify.emit({ title, message, audience: ['seller', 'admin'], type });
      return;
    }
    const existing = readJson('propertySetu:notifications', []);
    const list = Array.isArray(existing) ? existing : [];
    list.unshift({
      id: `sls-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
      at: toIso(item.updatedAt || item.createdAt || item.preferredAt || item.visitAt),
      source,
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
      at: toIso(item.createdAt || item.sentAt || item.timestamp || item.at),
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
      if (ts(item.at || item.updatedAt || item.createdAt) >= ts(prev.at || prev.updatedAt || prev.createdAt)) {
        map.set(key, item);
      }
    });
    return [...map.values()];
  };

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${CARD_ID} .sls-status { margin: 0 0 10px; color: #1f6d3d; font-size: 14px; }
#${CARD_ID} .sls-toolbar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; align-items: center; }
#${CARD_ID} .sls-btn {
  border: 1px solid #0b3d91;
  border-radius: 8px;
  background: #0b3d91;
  color: #fff;
  padding: 7px 11px;
  font-weight: 700;
  cursor: pointer;
}
#${CARD_ID} .sls-btn.alt { background: #fff; color: #0b3d91; }
#${CARD_ID} .sls-btn.warn { background: #8f4f00; border-color: #8f4f00; }
#${CARD_ID} .sls-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
#${CARD_ID} .sls-panel { border: 1px solid #dce5f1; border-radius: 10px; padding: 10px; background: #fff; }
#${CARD_ID} .sls-kpi-grid { display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); margin-bottom: 10px; }
#${CARD_ID} .sls-kpi { border: 1px solid #d7e6f8; border-radius: 8px; background: #f8fbff; padding: 8px; }
#${CARD_ID} .sls-kpi small { display: block; color: #58718f; }
#${CARD_ID} .sls-kpi b { color: #11466e; font-size: 16px; }
#${CARD_ID} .sls-table-wrap { overflow: auto; }
#${CARD_ID} table { width: 100%; border-collapse: collapse; min-width: 640px; }
#${CARD_ID} th, #${CARD_ID} td { border: 1px solid #d6e1f5; padding: 7px; text-align: left; font-size: 13px; }
#${CARD_ID} th { background: #f4f8ff; color: #12466e; }
#${CARD_ID} .sls-chip { display: inline-block; border-radius: 999px; padding: 2px 8px; font-size: 11px; font-weight: 700; }
#${CARD_ID} .sls-chip.hot { background: #ffe5e5; color: #9c1f1f; }
#${CARD_ID} .sls-chip.warm { background: #fff0da; color: #9f5d00; }
#${CARD_ID} .sls-chip.cold { background: #eaf3ff; color: #1a4f86; }
#${CARD_ID} .sls-note { font-size: 12px; color: #4a617b; margin-top: 8px; line-height: 1.4; }
    `;
    document.head.appendChild(style);
  }

  const card = document.createElement('div');
  card.className = 'container';
  card.id = CARD_ID;
  card.innerHTML = `
    <h2>Auto Lead Scoring & Daily Summary</h2>
    <p id="slsStatus" class="sls-status">Preparing seller lead summary...</p>
    <div class="sls-toolbar">
      <button id="slsRefreshBtn" class="sls-btn" type="button">Refresh Scoreboard</button>
      <button id="slsSaveSnapshotBtn" class="sls-btn alt" type="button">Save Daily Snapshot</button>
      <button id="slsExportBtn" class="sls-btn alt" type="button">Export CSV</button>
      <button id="slsNotifyBtn" class="sls-btn warn" type="button">Notify Top Leads</button>
    </div>
    <div id="slsKpiGrid" class="sls-kpi-grid"></div>
    <div class="sls-grid">
      <section class="sls-panel">
        <h3 style="margin:0 0 8px;color:#11466e;">Lead Priority Board</h3>
        <div id="slsLeadTable" class="sls-table-wrap"></div>
      </section>
      <section class="sls-panel">
        <h3 style="margin:0 0 8px;color:#11466e;">Daily Snapshot History</h3>
        <div id="slsSnapshotTable" class="sls-table-wrap"></div>
      </section>
    </div>
    <p class="sls-note">Score Formula: inquiries, visits, engagement (views/saves), recency and response behavior ke basis par hot/warm/cold classification hoti hai.</p>
  `;

  const conversionCard = document.getElementById('sellerConversionAnalyticsCard');
  const visitCard = document.getElementById('sellerVisitManagerCard');
  const anchor = conversionCard || visitCard || document.querySelector('.container');
  if (anchor) {
    anchor.insertAdjacentElement('afterend', card);
  } else {
    document.body.appendChild(card);
  }

  const statusEl = document.getElementById('slsStatus');
  const kpiGridEl = document.getElementById('slsKpiGrid');
  const leadTableEl = document.getElementById('slsLeadTable');
  const snapshotTableEl = document.getElementById('slsSnapshotTable');
  const refreshBtn = document.getElementById('slsRefreshBtn');
  const saveSnapshotBtn = document.getElementById('slsSaveSnapshotBtn');
  const exportBtn = document.getElementById('slsExportBtn');
  const notifyBtn = document.getElementById('slsNotifyBtn');

  let model = {
    leads: [],
    summary: {
      totalLeads: 0,
      hotLeads: 0,
      warmLeads: 0,
      coldLeads: 0,
      avgScore: 0,
      dueToday: 0,
    },
  };

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
    const current = readJson(SELLER_ENGAGEMENT_KEY, {});
    return current && typeof current === 'object' ? current : {};
  };

  const collectLocalChats = () => {
    const chats = [];
    try {
      const size = numberFrom(localStorage.length, 0);
      for (let index = 0; index < size; index += 1) {
        const key = text(localStorage.key(index));
        if (!key.startsWith(CHAT_PREFIX)) continue;
        const listingId = key.slice(CHAT_PREFIX.length);
        const rows = readJson(key, []);
        (Array.isArray(rows) ? rows : []).forEach((entry) => {
          const chat = normalizeChat(entry, listingId);
          if (chat) chats.push(chat);
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
      const rows = Array.isArray(response?.items) ? response.items : [];
      return rows.map((entry) => normalizeChat(entry)).filter(Boolean);
    } catch {
      return [];
    }
  };

  const collectVisits = async (token) => {
    const localVisits = [];
    const fromCache = readJson(VISIT_CACHE_KEY, []);
    const fromUser = readJson(USER_VISIT_KEY, []);
    const fromVideo = readJson(VIDEO_VISIT_KEY, []);
    (Array.isArray(fromCache) ? fromCache : []).forEach((entry) => {
      const item = normalizeVisit(entry, 'cache');
      if (item) localVisits.push(item);
    });
    (Array.isArray(fromUser) ? fromUser : []).forEach((entry) => {
      const item = normalizeVisit(entry, 'user');
      if (item) localVisits.push(item);
    });
    (Array.isArray(fromVideo) ? fromVideo : []).forEach((entry) => {
      const item = normalizeVisit(entry, 'video');
      if (item) localVisits.push(item);
    });

    let liveVisits = [];
    if (token && typeof live.request === 'function') {
      try {
        const response = await live.request('/visits/owner', { token });
        const rows = Array.isArray(response?.items) ? response.items : [];
        liveVisits = rows.map((entry) => normalizeVisit(entry, 'live')).filter(Boolean);
      } catch {
        // fallback local only
      }
    }

    return uniqueBy([...liveVisits, ...localVisits], (item) => text(item.id) || `${item.propertyId}:${item.customerId}:${item.at}`);
  };

  const classify = (score) => {
    if (score >= 70) return 'hot';
    if (score >= 40) return 'warm';
    return 'cold';
  };

  const nextAction = (lead) => {
    if (lead.tier === 'hot' && (!lead.lastOutboundAt || ts(lead.lastOutboundAt) < ts(lead.lastInboundAt))) {
      return 'Follow up within 2h';
    }
    if (lead.visitCompleted > 0) return 'Upsell / referral ask';
    if (lead.visitRequested > 0) return 'Confirm visit slot';
    if (lead.tier === 'warm') return 'Share docs + pricing details';
    return 'Nurture with update';
  };

  const computeModel = ({ listings, engagementMap, chats, visits, sessionId }) => {
    const listingMap = new Map();
    listings.forEach((item) => {
      const id = text(item.id);
      if (!id) return;
      listingMap.set(id, {
        id,
        title: text(item.title, id),
      });
    });

    const leads = new Map();
    const daily = {};

    const touchDay = (at, patch) => {
      const key = dayKey(at);
      if (!key) return;
      if (!daily[key]) {
        daily[key] = { day: key, inquiries: 0, followups: 0, visitsCompleted: 0, hotLeads: 0 };
      }
      Object.entries(patch || {}).forEach(([k, v]) => {
        daily[key][k] = numberFrom(daily[key][k], 0) + numberFrom(v, 0);
      });
    };

    const ensureLead = (propertyId, counterpartId) => {
      const pid = text(propertyId);
      const cid = text(counterpartId);
      if (!pid || !cid) return null;
      const key = `${pid}::${cid}`;
      if (leads.has(key)) return leads.get(key);
      const item = {
        key,
        propertyId: pid,
        propertyTitle: text(listingMap.get(pid)?.title, pid),
        counterpartId: cid,
        customerName: '',
        inboundCount: 0,
        outboundCount: 0,
        visitRequested: 0,
        visitCompleted: 0,
        visitRejected: 0,
        lastInboundAt: '',
        lastOutboundAt: '',
        lastVisitAt: '',
        lastActivityAt: '',
        score: 0,
        tier: 'cold',
        dueHours: 0,
        action: '',
      };
      leads.set(key, item);
      return item;
    };

    (Array.isArray(chats) ? chats : []).forEach((chat) => {
      const propertyId = text(chat.propertyId);
      if (!listingMap.has(propertyId)) return;
      const senderId = text(chat.senderId);
      const receiverId = text(chat.receiverId);
      if (sessionId && senderId !== sessionId && receiverId !== sessionId) return;
      const counterpart = senderId === sessionId ? receiverId : senderId;
      const lead = ensureLead(propertyId, counterpart);
      if (!lead) return;
      const at = text(chat.at);
      if (!sessionId || receiverId === sessionId) {
        lead.inboundCount += 1;
        lead.lastInboundAt = ts(at) > ts(lead.lastInboundAt) ? at : lead.lastInboundAt;
        touchDay(at, { inquiries: 1 });
      } else if (senderId === sessionId) {
        lead.outboundCount += 1;
        lead.lastOutboundAt = ts(at) > ts(lead.lastOutboundAt) ? at : lead.lastOutboundAt;
        touchDay(at, { followups: 1 });
      }
      lead.lastActivityAt = ts(at) > ts(lead.lastActivityAt) ? at : lead.lastActivityAt;
    });

    (Array.isArray(visits) ? visits : []).forEach((visit) => {
      const propertyId = text(visit.propertyId);
      if (!listingMap.has(propertyId)) return;
      const counterpart = text(visit.customerId || visit.customerName || `visit-${visit.id}`);
      const lead = ensureLead(propertyId, counterpart);
      if (!lead) return;
      lead.customerName = text(visit.customerName, lead.customerName);
      const at = text(visit.at);
      const status = normalizeVisitStatus(visit.status);
      if (status === 'requested' || status === 'confirmed' || status === 'completed') {
        lead.visitRequested += 1;
      }
      if (status === 'completed') {
        lead.visitCompleted += 1;
        touchDay(at, { visitsCompleted: 1 });
      }
      if (status === 'rejected' || status === 'cancelled') {
        lead.visitRejected += 1;
      }
      lead.lastVisitAt = ts(at) > ts(lead.lastVisitAt) ? at : lead.lastVisitAt;
      lead.lastActivityAt = ts(at) > ts(lead.lastActivityAt) ? at : lead.lastActivityAt;
    });

    const now = Date.now();
    const rows = [...leads.values()]
      .map((lead) => {
        const engagement = engagementMap[lead.propertyId] && typeof engagementMap[lead.propertyId] === 'object'
          ? engagementMap[lead.propertyId]
          : {};
        const views = numberFrom(engagement.views, 0);
        const saves = numberFrom(engagement.saves, 0);
        const inquiries = numberFrom(engagement.inquiries, 0) + lead.inboundCount;
        const visitRequested = lead.visitRequested;
        const visitCompleted = lead.visitCompleted;
        const visitRejected = lead.visitRejected;
        const baseScore = (
          (inquiries * 10)
          + (visitRequested * 12)
          + (visitCompleted * 28)
          + Math.min(12, saves * 2)
          + Math.min(8, Math.round(views / 30))
          + (lead.outboundCount > 0 ? 4 : 0)
          - (visitRejected * 8)
        );
        const recencyHours = lead.lastActivityAt ? Math.floor((now - ts(lead.lastActivityAt)) / HOUR_MS) : 999;
        const recencyBoost = recencyHours <= 24 ? 12 : recencyHours <= 72 ? 6 : 0;
        const stalePenalty = recencyHours > 168 ? 10 : 0;
        const score = Math.max(0, Math.min(100, Math.round(baseScore + recencyBoost - stalePenalty)));
        const tier = classify(score);
        const dueHours = lead.lastInboundAt && (!lead.lastOutboundAt || ts(lead.lastOutboundAt) < ts(lead.lastInboundAt))
          ? Math.max(0, Math.floor((now - ts(lead.lastInboundAt)) / HOUR_MS))
          : 0;
        const row = {
          ...lead,
          score,
          tier,
          dueHours,
          action: '',
        };
        row.action = nextAction(row);
        return row;
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return ts(b.lastActivityAt) - ts(a.lastActivityAt);
      });

    const totalLeads = rows.length;
    const hotLeads = rows.filter((row) => row.tier === 'hot').length;
    const warmLeads = rows.filter((row) => row.tier === 'warm').length;
    const coldLeads = rows.filter((row) => row.tier === 'cold').length;
    const dueToday = rows.filter((row) => row.dueHours >= 24 && row.visitCompleted === 0).length;
    const avgScore = totalLeads
      ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / totalLeads)
      : 0;

    const today = new Date().toISOString().slice(0, 10);
    if (!daily[today]) daily[today] = { day: today, inquiries: 0, followups: 0, visitsCompleted: 0, hotLeads: 0 };
    daily[today].hotLeads = hotLeads;

    return {
      leads: rows,
      summary: {
        totalLeads,
        hotLeads,
        warmLeads,
        coldLeads,
        avgScore,
        dueToday,
      },
      dailyRows: Object.values(daily)
        .sort((a, b) => String(b.day).localeCompare(String(a.day)))
        .slice(0, 7),
    };
  };

  const getSnapshots = () => {
    const rows = readJson(SNAPSHOT_KEY, []);
    return Array.isArray(rows) ? rows : [];
  };

  const saveSnapshot = (reason = 'manual') => {
    const today = new Date().toISOString().slice(0, 10);
    const rows = getSnapshots();
    const snapshot = {
      date: today,
      reason,
      capturedAt: new Date().toISOString(),
      totalLeads: numberFrom(model.summary.totalLeads, 0),
      hotLeads: numberFrom(model.summary.hotLeads, 0),
      warmLeads: numberFrom(model.summary.warmLeads, 0),
      coldLeads: numberFrom(model.summary.coldLeads, 0),
      avgScore: numberFrom(model.summary.avgScore, 0),
      dueToday: numberFrom(model.summary.dueToday, 0),
    };
    const filtered = rows.filter((item) => text(item.date) !== today);
    filtered.unshift(snapshot);
    writeJson(SNAPSHOT_KEY, filtered.slice(0, 45));
    return snapshot;
  };

  const maybeAutoSaveSnapshot = () => {
    const today = new Date().toISOString().slice(0, 10);
    const rows = getSnapshots();
    if (rows.some((item) => text(item.date) === today)) return null;
    return saveSnapshot('auto');
  };

  const renderSummary = () => {
    const s = model.summary || {};
    kpiGridEl.innerHTML = `
      <div class="sls-kpi"><small>Total Leads</small><b>${numberFrom(s.totalLeads, 0)}</b></div>
      <div class="sls-kpi"><small>Hot</small><b>${numberFrom(s.hotLeads, 0)}</b></div>
      <div class="sls-kpi"><small>Warm</small><b>${numberFrom(s.warmLeads, 0)}</b></div>
      <div class="sls-kpi"><small>Cold</small><b>${numberFrom(s.coldLeads, 0)}</b></div>
      <div class="sls-kpi"><small>Avg Score</small><b>${numberFrom(s.avgScore, 0)}</b></div>
      <div class="sls-kpi"><small>Due 24h+</small><b>${numberFrom(s.dueToday, 0)}</b></div>
    `;
  };

  const renderLeadTable = () => {
    if (!model.leads.length) {
      leadTableEl.innerHTML = '<p style="margin:0;color:#607da8;">No lead interactions found yet.</p>';
      return;
    }
    leadTableEl.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Lead</th>
            <th>Property</th>
            <th>Score</th>
            <th>Tier</th>
            <th>Due</th>
            <th>Last Activity</th>
            <th>Next Action</th>
          </tr>
        </thead>
        <tbody>
          ${model.leads.slice(0, 18).map((lead) => `
            <tr>
              <td>${escapeHtml(lead.customerName || lead.counterpartId)}</td>
              <td>${escapeHtml(lead.propertyTitle)}</td>
              <td><b>${numberFrom(lead.score, 0)}</b></td>
              <td><span class="sls-chip ${escapeHtml(lead.tier)}">${escapeHtml(lead.tier.toUpperCase())}</span></td>
              <td>${lead.dueHours > 0 ? `${numberFrom(lead.dueHours, 0)}h` : '-'}</td>
              <td>${escapeHtml(toLabel(lead.lastActivityAt))}</td>
              <td>${escapeHtml(lead.action)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const renderSnapshotTable = () => {
    const rows = getSnapshots();
    if (!rows.length) {
      snapshotTableEl.innerHTML = '<p style="margin:0;color:#607da8;">No daily snapshots yet.</p>';
      return;
    }
    snapshotTableEl.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Total</th>
            <th>Hot</th>
            <th>Warm</th>
            <th>Cold</th>
            <th>Avg Score</th>
            <th>Due 24h+</th>
            <th>Captured</th>
          </tr>
        </thead>
        <tbody>
          ${rows.slice(0, 14).map((row) => `
            <tr>
              <td>${escapeHtml(text(row.date))}</td>
              <td>${numberFrom(row.totalLeads, 0)}</td>
              <td>${numberFrom(row.hotLeads, 0)}</td>
              <td>${numberFrom(row.warmLeads, 0)}</td>
              <td>${numberFrom(row.coldLeads, 0)}</td>
              <td>${numberFrom(row.avgScore, 0)}</td>
              <td>${numberFrom(row.dueToday, 0)}</td>
              <td>${escapeHtml(toLabel(row.capturedAt))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const exportCsv = () => {
    const headers = ['Lead', 'Property', 'Score', 'Tier', 'DueHours', 'LastActivity', 'NextAction', 'Inbound', 'Outbound', 'VisitRequested', 'VisitCompleted'];
    const rows = model.leads.map((lead) => [
      lead.customerName || lead.counterpartId,
      lead.propertyTitle,
      String(numberFrom(lead.score, 0)),
      lead.tier,
      String(numberFrom(lead.dueHours, 0)),
      lead.lastActivityAt || '',
      lead.action,
      String(numberFrom(lead.inboundCount, 0)),
      String(numberFrom(lead.outboundCount, 0)),
      String(numberFrom(lead.visitRequested, 0)),
      String(numberFrom(lead.visitCompleted, 0)),
    ]);
    const encodeCell = (value) => {
      const raw = String(value || '');
      if (!/[",\n]/.test(raw)) return raw;
      return `"${raw.replace(/"/g, '""')}"`;
    };
    const csv = [headers, ...rows].map((line) => line.map(encodeCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `seller-lead-scoreboard-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus('Lead scoring CSV exported.');
  };

  const notifyTopLeads = () => {
    const top = model.leads.filter((lead) => lead.tier === 'hot').slice(0, 3);
    if (!top.length) {
      setStatus('No hot leads available for notification.');
      return;
    }
    top.forEach((lead, index) => {
      notify(
        `Hot Lead Priority #${index + 1}`,
        `${lead.propertyTitle}: ${lead.customerName || lead.counterpartId} (Score ${lead.score}). ${lead.action}`,
        'warn',
      );
    });
    setStatus(`Top ${top.length} hot leads notified.`);
  };

  const refresh = async () => {
    setStatus('Refreshing lead scoring board...');

    const token = getToken();
    const sessionId = getSessionId();
    const listings = collectListings();
    const listingIdSet = new Set(listings.map((item) => text(item.id)).filter(Boolean));
    const engagementMap = collectEngagement();
    const [liveChats, visits] = await Promise.all([
      collectLiveChats(token),
      collectVisits(token),
    ]);
    const localChats = collectLocalChats();
    const chats = uniqueBy([...liveChats, ...localChats], (item) => text(item.id) || `${item.propertyId}:${item.senderId}:${item.receiverId}:${item.at}`)
      .filter((item) => listingIdSet.has(text(item.propertyId)));
    const filteredVisits = (Array.isArray(visits) ? visits : []).filter((item) => listingIdSet.has(text(item.propertyId)));

    model = computeModel({
      listings,
      engagementMap,
      chats,
      visits: filteredVisits,
      sessionId,
    });

    renderSummary();
    renderLeadTable();
    maybeAutoSaveSnapshot();
    renderSnapshotTable();
    setStatus(`Lead scoring ready. ${numberFrom(model.summary.hotLeads, 0)} hot leads tracked.`);
  };

  refreshBtn?.addEventListener('click', () => {
    refresh().catch((error) => setStatus(text(error?.message, 'Refresh failed.'), false));
  });
  saveSnapshotBtn?.addEventListener('click', () => {
    const saved = saveSnapshot('manual');
    renderSnapshotTable();
    setStatus(`Daily snapshot saved (${saved.date}).`);
  });
  exportBtn?.addEventListener('click', exportCsv);
  notifyBtn?.addEventListener('click', notifyTopLeads);

  refresh().catch((error) => {
    setStatus(text(error?.message, 'Unable to load lead scoring board.'), false);
  });

  window.setInterval(() => {
    refresh().catch(() => null);
  }, 90000);
})();
