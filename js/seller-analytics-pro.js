(() => {
  if (document.getElementById('sellerAnalyticsProCard')) return;

  const live = window.PropertySetuLive || {};
  const isSellerPage = Boolean(document.getElementById('addPropertyForm') && document.getElementById('propertyList'));
  if (!isSellerPage) return;

  const STYLE_ID = 'seller-analytics-pro-style';
  const CARD_ID = 'sellerAnalyticsProCard';
  const LISTINGS_KEY = 'propertySetu:listings';
  const MARKET_STATE_KEY = 'propertysetu-marketplace-state';
  const SELLER_ENGAGEMENT_KEY = 'propertySetu:sellerEngagement';
  const USER_VISIT_KEY = 'propertySetu:userVisits';
  const VIDEO_VISIT_KEY = 'propertySetu:videoVisits';
  const VISIT_CACHE_KEY = 'propertySetu:sellerVisitQueueCache';
  const CHAT_PREFIX = 'propertySetu:userChat:';
  const SETTINGS_KEY = 'propertySetu:sellerAnalyticsProSettings';
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
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString();
  };

  const ts = (value) => {
    const date = new Date(value || '');
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  };

  const toLabel = (value) => {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const uniqueBy = (items = [], keyFn) => {
    const map = new Map();
    (Array.isArray(items) ? items : []).forEach((item) => {
      const key = text(keyFn(item));
      if (!key) return;
      const previous = map.get(key);
      if (!previous) {
        map.set(key, item);
        return;
      }
      const previousTs = ts(previous.updatedAt || previous.createdAt || previous.at);
      const nextTs = ts(item.updatedAt || item.createdAt || item.at);
      if (nextTs >= previousTs) map.set(key, item);
    });
    return [...map.values()];
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

  const getSettings = () => {
    const settings = readJson(SETTINGS_KEY, {});
    return {
      trendDays: Math.max(7, Math.min(14, numberFrom(settings?.trendDays, 7))),
    };
  };

  const setSettings = (next) => {
    const current = getSettings();
    writeJson(SETTINGS_KEY, { ...current, ...(next || {}) });
  };

  const collectListings = (sessionId) => {
    const all = readJson(LISTINGS_KEY, []);
    return (Array.isArray(all) ? all : [])
      .filter((item) => item && typeof item === 'object')
      .filter((item) => !sessionId || text(item.ownerId) === sessionId);
  };

  const collectEngagementStore = () => {
    const store = readJson(SELLER_ENGAGEMENT_KEY, {});
    return store && typeof store === 'object' ? store : {};
  };

  const collectSaveMap = () => {
    const state = readJson(MARKET_STATE_KEY, { wishlist: [] });
    const map = {};
    (Array.isArray(state?.wishlist) ? state.wishlist : []).forEach((listingId) => {
      const id = text(listingId);
      if (!id) return;
      map[id] = numberFrom(map[id], 0) + 1;
    });
    return map;
  };

  const collectLocalChats = () => {
    const chats = [];
    try {
      const keyCount = numberFrom(localStorage.length, 0);
      for (let index = 0; index < keyCount; index += 1) {
        const key = text(localStorage.key(index));
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
    const all = [];
    const cacheVisits = readJson(VISIT_CACHE_KEY, []);
    const userVisits = readJson(USER_VISIT_KEY, []);
    const videoVisits = readJson(VIDEO_VISIT_KEY, []);
    (Array.isArray(cacheVisits) ? cacheVisits : []).forEach((entry) => {
      const normalized = normalizeVisit(entry, 'cache');
      if (normalized) all.push(normalized);
    });
    (Array.isArray(userVisits) ? userVisits : []).forEach((entry) => {
      const normalized = normalizeVisit(entry, 'user');
      if (normalized) all.push(normalized);
    });
    (Array.isArray(videoVisits) ? videoVisits : []).forEach((entry) => {
      const normalized = normalizeVisit(entry, 'video');
      if (normalized) all.push(normalized);
    });
    if (token && typeof live.request === 'function') {
      try {
        const response = await live.request('/visits/owner', { token });
        const items = Array.isArray(response?.items) ? response.items : [];
        items.forEach((entry) => {
          const normalized = normalizeVisit(entry, 'live');
          if (normalized) all.push(normalized);
        });
      } catch {
        // fallback local
      }
    }
    return uniqueBy(all, (item) => text(item.id) || `${item.propertyId}:${item.customerId}:${item.at}`);
  };

  const dateKey = (value) => {
    const millis = ts(value);
    if (!millis) return '';
    return new Date(millis).toISOString().slice(0, 10);
  };

  const rollingDayKeys = (days) => {
    const list = [];
    const today = new Date();
    for (let offset = days - 1; offset >= 0; offset -= 1) {
      const current = new Date(today.getTime() - (offset * DAY_MS));
      list.push(current.toISOString().slice(0, 10));
    }
    return list;
  };

  const buildModel = ({
    listings,
    engagementStore,
    saveMap,
    chats,
    visits,
    sessionId,
    trendDays,
  }) => {
    const listingById = new Map();
    listings.forEach((item) => {
      const id = text(item?.id);
      if (!id) return;
      listingById.set(id, item);
    });

    const days = rollingDayKeys(trendDays);
    const trendMap = new Map(days.map((key) => [key, {
      key,
      label: new Date(`${key}T00:00:00Z`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      inbound: 0,
      outbound: 0,
      visits: 0,
      completed: 0,
    }]));

    const rowMap = new Map();
    const ensureRow = (propertyId) => {
      const id = text(propertyId);
      if (!id) return null;
      if (rowMap.has(id)) return rowMap.get(id);
      const listing = listingById.get(id) || {};
      const engagement = engagementStore[id] && typeof engagementStore[id] === 'object' ? engagementStore[id] : {};
      const row = {
        propertyId: id,
        propertyTitle: text(listing.title, id),
        views: numberFrom(listing?.analytics?.views, 0) + numberFrom(listing?.viewCount, 0) + numberFrom(engagement.views, 0),
        saves: numberFrom(saveMap[id], 0) + numberFrom(engagement.saves, 0),
        inboundChats: 0,
        outboundChats: 0,
        inquiries: numberFrom(engagement.inquiries, 0),
        requestedVisits: 0,
        confirmedVisits: 0,
        completedVisits: 0,
        lastInboundAt: '',
        lastOutboundAt: '',
        pendingHours: 0,
        responseRate: 0,
        conversionRate: 0,
        qualityScore: 0,
        recommendation: '',
      };
      rowMap.set(id, row);
      return row;
    };

    chats.forEach((chat) => {
      const propertyId = text(chat.propertyId);
      if (!propertyId) return;
      const row = ensureRow(propertyId);
      if (!row) return;
      const senderId = text(chat.senderId);
      const receiverId = text(chat.receiverId);
      const at = text(chat.at);
      if (sessionId && senderId === sessionId) {
        row.outboundChats += 1;
        row.lastOutboundAt = ts(at) >= ts(row.lastOutboundAt) ? at : row.lastOutboundAt;
      }
      if (sessionId && receiverId === sessionId) {
        row.inboundChats += 1;
        row.inquiries += 1;
        row.lastInboundAt = ts(at) >= ts(row.lastInboundAt) ? at : row.lastInboundAt;
      }
      const key = dateKey(at);
      const day = trendMap.get(key);
      if (day) {
        if (sessionId && receiverId === sessionId) day.inbound += 1;
        if (sessionId && senderId === sessionId) day.outbound += 1;
      }
    });

    visits.forEach((visit) => {
      const row = ensureRow(visit.propertyId);
      if (!row) return;
      if (visit.status === 'requested') {
        row.requestedVisits += 1;
        row.inquiries += 1;
      }
      if (visit.status === 'confirmed') {
        row.confirmedVisits += 1;
        row.inquiries += 1;
      }
      if (visit.status === 'completed') {
        row.completedVisits += 1;
      }
      const key = dateKey(visit.at);
      const day = trendMap.get(key);
      if (day) {
        if (visit.status === 'requested' || visit.status === 'confirmed') day.visits += 1;
        if (visit.status === 'completed') day.completed += 1;
      }
    });

    const now = Date.now();
    const rows = [...rowMap.values()].map((row) => {
      const inbound = numberFrom(row.inboundChats, 0);
      const outbound = numberFrom(row.outboundChats, 0);
      row.responseRate = inbound > 0 ? Math.min(100, Math.round((outbound / inbound) * 100)) : (outbound > 0 ? 100 : 0);
      row.conversionRate = row.inquiries > 0 ? Math.min(100, Math.round((row.completedVisits / row.inquiries) * 100)) : 0;
      const needsReply = ts(row.lastInboundAt) > ts(row.lastOutboundAt);
      row.pendingHours = needsReply ? Math.max(0, Math.floor((now - ts(row.lastInboundAt)) / HOUR_MS)) : 0;

      const engagementScore = Math.min(35, Math.round((row.views / 40) + (row.saves * 2.2) + (row.inquiries * 2.8)));
      const conversionScore = Math.min(35, Math.round((row.completedVisits * 8) + (row.conversionRate * 0.35)));
      const responseScore = Math.min(30, Math.round(row.responseRate * 0.3));
      row.qualityScore = Math.max(0, Math.min(100, engagementScore + conversionScore + responseScore));

      if (row.pendingHours >= 48) {
        row.recommendation = 'Escalate follow-up now and offer direct WhatsApp handoff.';
      } else if (row.responseRate < 45) {
        row.recommendation = 'Increase reply speed. Use quick follow-up templates.';
      } else if (row.conversionRate < 20 && row.inquiries >= 5) {
        row.recommendation = 'Improve visit-to-close ratio with pricing + docs clarity.';
      } else {
        row.recommendation = 'Healthy pipeline. Continue current response pattern.';
      }
      return row;
    }).sort((a, b) => {
      if (b.qualityScore !== a.qualityScore) return b.qualityScore - a.qualityScore;
      if (b.inquiries !== a.inquiries) return b.inquiries - a.inquiries;
      return b.views - a.views;
    });

    const totalInquiries = rows.reduce((sum, row) => sum + numberFrom(row.inquiries, 0), 0);
    const totalCompleted = rows.reduce((sum, row) => sum + numberFrom(row.completedVisits, 0), 0);
    const pendingFollowups = rows.filter((row) => numberFrom(row.pendingHours, 0) >= 24).length;
    const underperformers = rows.filter((row) => numberFrom(row.qualityScore, 0) < 45).length;
    const avgQualityScore = rows.length
      ? Math.round(rows.reduce((sum, row) => sum + numberFrom(row.qualityScore, 0), 0) / rows.length)
      : 0;
    const topPerformer = rows[0] || null;
    const overallConversion = totalInquiries > 0 ? Math.round((totalCompleted / totalInquiries) * 100) : 0;

    const trend = [...trendMap.values()];
    const maxTrend = trend.reduce((max, row) => Math.max(max, row.inbound, row.outbound, row.visits, row.completed), 1);

    const recommendations = rows
      .filter((row) => row.pendingHours >= 24 || row.qualityScore < 45 || (row.inquiries >= 5 && row.conversionRate < 20))
      .slice(0, 5)
      .map((row) => ({
        propertyId: row.propertyId,
        propertyTitle: row.propertyTitle,
        note: row.recommendation,
      }));

    return {
      rows,
      trend,
      maxTrend,
      recommendations,
      summary: {
        properties: rows.length,
        avgQualityScore,
        overallConversion,
        pendingFollowups,
        underperformers,
        topPerformer: topPerformer ? `${topPerformer.propertyTitle} (${topPerformer.qualityScore})` : '-',
      },
    };
  };

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${CARD_ID} .sap-status{margin:0 0 10px;color:#1f6d3d;font-size:14px;}
#${CARD_ID} .sap-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px;}
#${CARD_ID} .sap-btn{border:1px solid #0b3d91;border-radius:8px;background:#0b3d91;color:#fff;padding:7px 11px;font-weight:700;cursor:pointer;}
#${CARD_ID} .sap-btn.alt{background:#fff;color:#0b3d91;}
#${CARD_ID} .sap-select{border:1px solid #ccd9ee;border-radius:8px;padding:6px 9px;}
#${CARD_ID} .sap-kpi{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-bottom:10px;}
#${CARD_ID} .sap-kpi-item{border:1px solid #d7e6f8;border-radius:8px;background:#f7fbff;padding:8px;}
#${CARD_ID} .sap-kpi-item small{display:block;color:#58718f;}
#${CARD_ID} .sap-kpi-item b{color:#11466e;font-size:16px;}
#${CARD_ID} .sap-grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));margin-bottom:10px;}
#${CARD_ID} .sap-panel{border:1px solid #dbe6f5;border-radius:10px;padding:10px;background:#fff;}
#${CARD_ID} .sap-panel h3{margin:0 0 8px;color:#124a72;}
#${CARD_ID} .sap-trend-row{display:grid;grid-template-columns:70px 1fr;gap:8px;align-items:center;margin:6px 0;}
#${CARD_ID} .sap-bars{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;}
#${CARD_ID} .sap-bar{height:12px;border-radius:4px;background:#e6eef9;position:relative;overflow:hidden;}
#${CARD_ID} .sap-bar > span{display:block;height:100%;}
#${CARD_ID} .sap-bar.inbound > span{background:#2f6fd6;}
#${CARD_ID} .sap-bar.outbound > span{background:#2f9d6b;}
#${CARD_ID} .sap-bar.visits > span{background:#9a5cce;}
#${CARD_ID} .sap-bar.completed > span{background:#df7a2f;}
#${CARD_ID} .sap-legend{display:flex;flex-wrap:wrap;gap:8px;font-size:12px;color:#49627f;margin-top:8px;}
#${CARD_ID} .sap-legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:middle;}
#${CARD_ID} table{width:100%;border-collapse:collapse;min-width:760px;}
#${CARD_ID} th,#${CARD_ID} td{border:1px solid #d5e2f4;padding:7px;text-align:left;font-size:13px;}
#${CARD_ID} th{background:#f3f8ff;}
#${CARD_ID} .sap-table-wrap{overflow:auto;}
#${CARD_ID} .sap-chip{display:inline-block;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:700;}
#${CARD_ID} .sap-chip.good{background:#e7f8ef;color:#19643a;}
#${CARD_ID} .sap-chip.warn{background:#fff0d9;color:#9f5d00;}
#${CARD_ID} .sap-chip.risk{background:#ffe5e5;color:#992222;}
#${CARD_ID} .sap-rec{border:1px solid #dce6f5;border-radius:8px;padding:8px;background:#fff;margin-bottom:8px;}
    `;
    document.head.appendChild(style);
  }

  const card = document.createElement('div');
  card.className = 'container';
  card.id = CARD_ID;
  card.innerHTML = `
    <h2>Seller Analytics Pro</h2>
    <p id="sapStatus" class="sap-status">Loading advanced analytics...</p>
    <div class="sap-toolbar">
      <button id="sapRefreshBtn" class="sap-btn" type="button">Refresh Analytics</button>
      <button id="sapRecsBtn" class="sap-btn alt" type="button">Run Action Suggestions</button>
      <button id="sapCsvBtn" class="sap-btn alt" type="button">Export CSV</button>
      <label style="font-size:13px;color:#3d5674;">
        Trend window
        <select id="sapTrendDays" class="sap-select">
          <option value="7">Last 7 days</option>
          <option value="14">Last 14 days</option>
        </select>
      </label>
    </div>
    <div id="sapKpi" class="sap-kpi"></div>
    <div class="sap-grid">
      <section class="sap-panel">
        <h3>Engagement Trend</h3>
        <div id="sapTrend"></div>
      </section>
      <section class="sap-panel">
        <h3>Action Queue</h3>
        <div id="sapRecommendations"></div>
      </section>
    </div>
    <section class="sap-panel">
      <h3>Property Performance Table</h3>
      <div id="sapTable" class="sap-table-wrap"></div>
    </section>
  `;

  const followupCard = document.getElementById('sellerFollowupWhatsappQueueCard');
  const leadCard = document.getElementById('sellerLeadScoringCard');
  const conversionCard = document.getElementById('sellerConversionAnalyticsCard');
  const anchor = followupCard || leadCard || conversionCard || document.querySelector('.container');
  if (anchor) anchor.insertAdjacentElement('afterend', card);
  else document.body.appendChild(card);

  const statusEl = document.getElementById('sapStatus');
  const refreshBtn = document.getElementById('sapRefreshBtn');
  const recsBtn = document.getElementById('sapRecsBtn');
  const csvBtn = document.getElementById('sapCsvBtn');
  const trendDaysEl = document.getElementById('sapTrendDays');
  const kpiEl = document.getElementById('sapKpi');
  const trendEl = document.getElementById('sapTrend');
  const tableEl = document.getElementById('sapTable');
  const recsEl = document.getElementById('sapRecommendations');

  let model = {
    rows: [],
    trend: [],
    maxTrend: 1,
    recommendations: [],
    summary: {},
  };

  const setStatus = (message, ok = true) => {
    statusEl.textContent = message;
    statusEl.style.color = ok ? '#1f6d3d' : '#8d1e1e';
  };

  const scoreChipClass = (score) => {
    const value = numberFrom(score, 0);
    if (value >= 65) return 'good';
    if (value >= 45) return 'warn';
    return 'risk';
  };

  const render = () => {
    const summary = model.summary || {};
    kpiEl.innerHTML = `
      <div class="sap-kpi-item"><small>Tracked Properties</small><b>${numberFrom(summary.properties, 0)}</b></div>
      <div class="sap-kpi-item"><small>Avg Quality Score</small><b>${numberFrom(summary.avgQualityScore, 0)}</b></div>
      <div class="sap-kpi-item"><small>Overall Conversion</small><b>${numberFrom(summary.overallConversion, 0)}%</b></div>
      <div class="sap-kpi-item"><small>Pending Follow-ups (24h+)</small><b>${numberFrom(summary.pendingFollowups, 0)}</b></div>
      <div class="sap-kpi-item"><small>Underperformers</small><b>${numberFrom(summary.underperformers, 0)}</b></div>
      <div class="sap-kpi-item"><small>Top Performer</small><b>${escapeHtml(text(summary.topPerformer, '-'))}</b></div>
    `;

    if (!model.trend.length) {
      trendEl.innerHTML = '<p style="margin:0;color:#607da8;">No trend data available yet.</p>';
    } else {
      trendEl.innerHTML = `
        ${model.trend.map((row) => `
          <div class="sap-trend-row">
            <small>${escapeHtml(row.label)}</small>
            <div class="sap-bars">
              <div class="sap-bar inbound" title="Inbound: ${row.inbound}"><span style="width:${Math.max(4, Math.round((row.inbound / model.maxTrend) * 100))}%"></span></div>
              <div class="sap-bar outbound" title="Outbound: ${row.outbound}"><span style="width:${Math.max(4, Math.round((row.outbound / model.maxTrend) * 100))}%"></span></div>
              <div class="sap-bar visits" title="Visits: ${row.visits}"><span style="width:${Math.max(4, Math.round((row.visits / model.maxTrend) * 100))}%"></span></div>
              <div class="sap-bar completed" title="Completed: ${row.completed}"><span style="width:${Math.max(4, Math.round((row.completed / model.maxTrend) * 100))}%"></span></div>
            </div>
          </div>
        `).join('')}
        <div class="sap-legend">
          <span><i style="background:#2f6fd6;"></i>Inbound</span>
          <span><i style="background:#2f9d6b;"></i>Outbound</span>
          <span><i style="background:#9a5cce;"></i>Visits</span>
          <span><i style="background:#df7a2f;"></i>Completed</span>
        </div>
      `;
    }

    if (!model.recommendations.length) {
      recsEl.innerHTML = '<p style="margin:0;color:#607da8;">No urgent actions. Response hygiene looks healthy.</p>';
    } else {
      recsEl.innerHTML = model.recommendations.map((item) => `
        <article class="sap-rec">
          <b>${escapeHtml(item.propertyTitle)}</b>
          <p style="margin:6px 0 0;color:#4a617b;font-size:12px;line-height:1.4;">${escapeHtml(item.note)}</p>
        </article>
      `).join('');
    }

    if (!model.rows.length) {
      tableEl.innerHTML = '<p style="margin:0;color:#607da8;">No property rows available.</p>';
      return;
    }

    tableEl.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Property</th>
            <th>Views</th>
            <th>Saves</th>
            <th>Inquiries</th>
            <th>Completed Visits</th>
            <th>Response Rate</th>
            <th>Conversion</th>
            <th>Pending (h)</th>
            <th>Quality</th>
            <th>Recommendation</th>
          </tr>
        </thead>
        <tbody>
          ${model.rows.map((row) => `
            <tr>
              <td><b>${escapeHtml(row.propertyTitle)}</b><br><small style="color:#5b6e86;">${escapeHtml(row.propertyId)}</small></td>
              <td>${numberFrom(row.views, 0)}</td>
              <td>${numberFrom(row.saves, 0)}</td>
              <td>${numberFrom(row.inquiries, 0)}</td>
              <td>${numberFrom(row.completedVisits, 0)}</td>
              <td>${numberFrom(row.responseRate, 0)}%</td>
              <td>${numberFrom(row.conversionRate, 0)}%</td>
              <td>${numberFrom(row.pendingHours, 0)}</td>
              <td><span class="sap-chip ${scoreChipClass(row.qualityScore)}">${numberFrom(row.qualityScore, 0)}</span></td>
              <td>${escapeHtml(row.recommendation)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const emitSuggestionNotifications = () => {
    if (!model.recommendations.length) {
      setStatus('No urgent action suggestions right now.');
      return;
    }
    if (window.PropertySetuNotify && typeof window.PropertySetuNotify.emit === 'function') {
      model.recommendations.slice(0, 3).forEach((item) => {
        window.PropertySetuNotify.emit({
          title: 'Seller Analytics Suggestion',
          message: `${item.propertyTitle}: ${item.note}`,
          audience: ['seller', 'admin'],
          type: 'info',
        });
      });
      setStatus(`Action suggestions issued for ${Math.min(3, model.recommendations.length)} listing(s).`);
      return;
    }
    setStatus('Suggestions prepared. Notification channel unavailable in this mode.');
  };

  const exportCsv = () => {
    const headers = [
      'Property ID',
      'Property',
      'Views',
      'Saves',
      'Inquiries',
      'Requested Visits',
      'Confirmed Visits',
      'Completed Visits',
      'Response Rate',
      'Conversion Rate',
      'Pending Hours',
      'Quality Score',
      'Recommendation',
    ];
    const rows = (model.rows || []).map((row) => ([
      row.propertyId,
      row.propertyTitle,
      String(numberFrom(row.views, 0)),
      String(numberFrom(row.saves, 0)),
      String(numberFrom(row.inquiries, 0)),
      String(numberFrom(row.requestedVisits, 0)),
      String(numberFrom(row.confirmedVisits, 0)),
      String(numberFrom(row.completedVisits, 0)),
      String(numberFrom(row.responseRate, 0)),
      String(numberFrom(row.conversionRate, 0)),
      String(numberFrom(row.pendingHours, 0)),
      String(numberFrom(row.qualityScore, 0)),
      row.recommendation,
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
    link.download = `seller-analytics-pro-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus('Analytics CSV exported.');
  };

  const refresh = async () => {
    const sessionId = getSessionId();
    if (!sessionId) {
      model = { rows: [], trend: [], maxTrend: 1, recommendations: [], summary: {} };
      render();
      setStatus('Seller login required for analytics.', false);
      return;
    }

    const settings = getSettings();
    trendDaysEl.value = String(settings.trendDays);
    setStatus('Refreshing analytics model...');

    const listings = collectListings(sessionId);
    const engagementStore = collectEngagementStore();
    const saveMap = collectSaveMap();
    const token = getToken();
    const [liveChats, visits] = await Promise.all([
      collectLiveChats(token),
      collectVisits(token),
    ]);
    const localChats = collectLocalChats();
    const chats = uniqueBy(
      [...liveChats, ...localChats],
      (item) => text(item.id) || `${item.propertyId}:${item.senderId}:${item.receiverId}:${item.at}`
    );

    model = buildModel({
      listings,
      engagementStore,
      saveMap,
      chats,
      visits,
      sessionId,
      trendDays: settings.trendDays,
    });
    render();
    setStatus(`Analytics ready. ${numberFrom(model.summary.properties, 0)} property row(s) processed.`);
  };

  refreshBtn?.addEventListener('click', () => {
    refresh().catch((error) => setStatus(text(error?.message, 'Refresh failed.'), false));
  });

  recsBtn?.addEventListener('click', () => {
    emitSuggestionNotifications();
  });

  csvBtn?.addEventListener('click', exportCsv);

  trendDaysEl?.addEventListener('change', () => {
    const trendDays = Math.max(7, Math.min(14, numberFrom(trendDaysEl.value, 7)));
    setSettings({ trendDays });
    refresh().catch((error) => setStatus(text(error?.message, 'Trend update failed.'), false));
  });

  refresh().catch((error) => {
    setStatus(text(error?.message, 'Unable to load analytics panel.'), false);
  });
  window.setInterval(() => {
    refresh().catch(() => null);
  }, 90000);
})();
