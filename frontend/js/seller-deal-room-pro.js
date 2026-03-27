(() => {
  if (document.getElementById('sellerDealRoomProCard')) return;

  const live = window.PropertySetuLive || {};
  const isSellerPage = Boolean(document.getElementById('addPropertyForm') && document.getElementById('propertyList'));
  if (!isSellerPage) return;

  const CARD_ID = 'sellerDealRoomProCard';
  const STYLE_ID = 'seller-deal-room-pro-style';
  const LISTINGS_KEY = 'propertySetu:listings';
  const SELLER_ENGAGEMENT_KEY = 'propertySetu:sellerEngagement';
  const USER_VISIT_KEY = 'propertySetu:userVisits';
  const VISIT_CACHE_KEY = 'propertySetu:sellerVisitQueueCache';
  const CHAT_PREFIX = 'propertySetu:userChat:';
  const STATE_KEY = 'propertySetu:sellerDealRoomState';
  const LOG_KEY = 'propertySetu:sellerDealRoomLog';
  const SETTINGS_KEY = 'propertySetu:sellerDealRoomSettings';
  const DAY_MS = 86400000;
  const HOUR_MS = 3600000;

  const STAGES = ['new', 'qualified', 'negotiation', 'documentation', 'closing', 'won', 'lost'];

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

  const getSessionId = () => {
    if (typeof live.getAnySession === 'function') return text(live.getAnySession()?.id);
    return '';
  };
  const getToken = () => {
    if (typeof live.getAnyToken === 'function') return text(live.getAnyToken());
    if (typeof live.getToken === 'function') return text(live.getToken('seller') || live.getToken('admin') || live.getToken('customer'));
    return '';
  };

  const toDateLabel = (value) => {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  };
  const ts = (value) => {
    const date = new Date(value || '');
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  };

  const getSettings = () => {
    const current = readJson(SETTINGS_KEY, {});
    return {
      followupDueHours: clamp(numberFrom(current?.followupDueHours, 24), 4, 120),
      queueTopCount: clamp(numberFrom(current?.queueTopCount, 3), 1, 10),
      minDealScore: clamp(numberFrom(current?.minDealScore, 55), 20, 95),
      defaultFloorDropPct: clamp(numberFrom(current?.defaultFloorDropPct, 8), 2, 25),
    };
  };
  const setSettings = (next) => {
    const current = getSettings();
    writeJson(SETTINGS_KEY, { ...current, ...(next || {}) });
  };

  const getState = () => {
    const rows = readJson(STATE_KEY, {});
    return rows && typeof rows === 'object' ? rows : {};
  };
  const setState = (next) => {
    writeJson(STATE_KEY, next && typeof next === 'object' ? next : {});
  };

  const getLog = () => {
    const rows = readJson(LOG_KEY, []);
    return Array.isArray(rows) ? rows : [];
  };
  const pushLog = (entry = {}) => {
    const rows = getLog();
    rows.unshift({
      id: `sdrp-log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: new Date().toISOString(),
      type: text(entry.type, 'info'),
      propertyId: text(entry.propertyId),
      title: text(entry.title),
      stage: text(entry.stage),
      message: text(entry.message),
      amount: Math.max(0, numberFrom(entry.amount, 0)),
      score: clamp(numberFrom(entry.score, 0), 0, 100),
    });
    writeJson(LOG_KEY, rows.slice(0, 500));
  };

  const pushNotification = (title, message, type = 'info') => {
    if (!title || !message) return;
    if (window.PropertySetuNotify && typeof window.PropertySetuNotify.emit === 'function') {
      window.PropertySetuNotify.emit({ title, message, audience: ['seller', 'admin'], type });
      return;
    }
    const rows = readJson('propertySetu:notifications', []);
    const next = Array.isArray(rows) ? rows : [];
    next.unshift({
      id: `sdrp-n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

  const normalizeListing = (item = {}) => {
    const id = text(item.id || item._id);
    if (!id) return null;
    return {
      id,
      title: text(item.title, id),
      city: text(item.city, 'Udaipur'),
      locality: text(item.location || item.locality, 'Udaipur'),
      category: text(item.category || item.propertyTypeCore || item.type, 'Unknown'),
      price: Math.max(0, numberFrom(item.price, 0)),
      ownerId: text(item.ownerId),
      featured: Boolean(item.featured),
      createdAt: text(item.createdAt || item.listedAt || item.updatedAt),
      updatedAt: text(item.updatedAt || item.createdAt || item.listedAt),
      raw: item,
    };
  };

  const getListings = async () => {
    if (typeof live.syncLocalListingsFromApi === 'function') {
      try {
        await live.syncLocalListingsFromApi();
      } catch {
        // keep local cache
      }
    }
    const sessionId = getSessionId();
    const rows = readJson(LISTINGS_KEY, []);
    return (Array.isArray(rows) ? rows : [])
      .map((item) => normalizeListing(item))
      .filter(Boolean)
      .filter((item) => !sessionId || item.ownerId === sessionId);
  };

  const collectChatCountMap = () => {
    const map = {};
    try {
      const size = numberFrom(localStorage.length, 0);
      for (let index = 0; index < size; index += 1) {
        const key = text(localStorage.key(index));
        if (!key.startsWith(CHAT_PREFIX)) continue;
        const propertyId = key.slice(CHAT_PREFIX.length);
        const rows = readJson(key, []);
        map[propertyId] = numberFrom(map[propertyId], 0) + (Array.isArray(rows) ? rows.length : 0);
      }
    } catch {
      // no-op
    }
    return map;
  };

  const collectVisitCountMap = () => {
    const map = {};
    const consume = (rows = []) => {
      (Array.isArray(rows) ? rows : []).forEach((item) => {
        const id = text(item?.propertyId || item?.listingId || item?.property?.id);
        if (!id) return;
        map[id] = numberFrom(map[id], 0) + 1;
      });
    };
    consume(readJson(USER_VISIT_KEY, []));
    consume(readJson(VISIT_CACHE_KEY, []));
    return map;
  };

  const inferStage = ({ leads, visits, inquiries, ageDays }) => {
    if (leads >= 16 || inquiries >= 10 || visits >= 6) return 'closing';
    if (leads >= 11 || inquiries >= 7 || visits >= 4) return 'documentation';
    if (leads >= 8 || inquiries >= 5 || visits >= 3) return 'negotiation';
    if (leads >= 4 || inquiries >= 2 || visits >= 1) return 'qualified';
    if (ageDays >= 40 && leads === 0) return 'lost';
    return 'new';
  };

  const buildModel = ({ listings, settings }) => {
    const engagementStore = readJson(SELLER_ENGAGEMENT_KEY, {});
    const chatMap = collectChatCountMap();
    const visitMap = collectVisitCountMap();
    const state = getState();

    const rows = listings.map((listing) => {
      const rowState = state[listing.id] && typeof state[listing.id] === 'object' ? state[listing.id] : {};
      const engagement = engagementStore?.[listing.id] && typeof engagementStore[listing.id] === 'object'
        ? engagementStore[listing.id]
        : {};
      const views = numberFrom(engagement.views, 0) + numberFrom(listing.raw?.analytics?.views, 0) + numberFrom(listing.raw?.viewCount, 0);
      const saves = numberFrom(engagement.saves, 0) + numberFrom(listing.raw?.analytics?.saves, 0);
      const inquiries = numberFrom(engagement.inquiries, 0);
      const chats = numberFrom(chatMap[listing.id], 0);
      const visits = numberFrom(visitMap[listing.id], 0);
      const leads = inquiries + chats + visits;
      const ageDays = Math.max(0, Math.floor((Date.now() - (ts(listing.createdAt) || Date.now())) / DAY_MS));

      const inferredStage = inferStage({ leads, visits, inquiries, ageDays });
      const currentStage = STAGES.includes(text(rowState.stage)) ? text(rowState.stage) : inferredStage;
      const lastFollowupAt = text(rowState.lastFollowupAt);
      const floorPrice = Math.max(0, numberFrom(rowState.floorPrice, Math.round(listing.price * (1 - (settings.defaultFloorDropPct / 100)))));
      const targetPrice = Math.max(0, numberFrom(rowState.targetPrice, listing.price));
      const askPrice = listing.price;

      const score = clamp(
        Math.round((views / 22) + (saves * 3.1) + (inquiries * 6.2) + (visits * 5.6) + (chats * 2.2) - (ageDays / 6)),
        0,
        100,
      );
      const hoursSinceFollowup = lastFollowupAt ? Math.floor((Date.now() - ts(lastFollowupAt)) / HOUR_MS) : 999;
      const followupDue = currentStage !== 'won' && currentStage !== 'lost' && hoursSinceFollowup >= settings.followupDueHours;

      let recommendedCounter = askPrice;
      if (currentStage === 'negotiation' || currentStage === 'documentation' || currentStage === 'closing') {
        const anchor = Math.max(floorPrice, Math.round((askPrice + targetPrice) / 2));
        const scoreAdj = Math.round(((score - 50) / 100) * askPrice * 0.04);
        recommendedCounter = Math.max(floorPrice, anchor + scoreAdj);
      }

      let nextAction = 'Monitor pipeline and keep listing fresh.';
      if (currentStage === 'new') nextAction = 'Start lead qualification script and request budget range.';
      if (currentStage === 'qualified') nextAction = 'Push for site visit slot + document checklist.';
      if (currentStage === 'negotiation') nextAction = 'Send counter-offer and lock token timeline.';
      if (currentStage === 'documentation') nextAction = 'Collect legal docs and booking token confirmation.';
      if (currentStage === 'closing') nextAction = 'Finalize payment schedule and closure checklist.';
      if (currentStage === 'lost') nextAction = 'Re-open with revised offer or reposition pricing.';
      if (currentStage === 'won') nextAction = 'Archive deal and request testimonial.';

      return {
        id: listing.id,
        title: listing.title,
        locality: listing.locality,
        category: listing.category,
        askPrice,
        floorPrice,
        targetPrice,
        recommendedCounter,
        views,
        saves,
        inquiries,
        chats,
        visits,
        leads,
        ageDays,
        stage: currentStage,
        score,
        followupDue,
        hoursSinceFollowup,
        nextAction,
        lastFollowupAt,
      };
    }).sort((a, b) => {
      if (a.followupDue !== b.followupDue) return a.followupDue ? -1 : 1;
      if (b.score !== a.score) return b.score - a.score;
      return b.leads - a.leads;
    });

    const summary = {
      listings: rows.length,
      activeDeals: rows.filter((row) => row.stage !== 'won' && row.stage !== 'lost').length,
      dueFollowups: rows.filter((row) => row.followupDue).length,
      won: rows.filter((row) => row.stage === 'won').length,
      lost: rows.filter((row) => row.stage === 'lost').length,
      avgScore: rows.length ? Math.round(rows.reduce((sum, row) => sum + row.score, 0) / rows.length) : 0,
      pipelineValue: rows
        .filter((row) => row.stage !== 'lost')
        .reduce((sum, row) => sum + row.targetPrice, 0),
      topDeal: rows[0] ? `${rows[0].title} (${rows[0].stage})` : '-',
    };

    return { rows, summary };
  };

  const persistRowState = (propertyId, patch = {}) => {
    const id = text(propertyId);
    if (!id) return;
    const state = getState();
    state[id] = {
      ...(state[id] && typeof state[id] === 'object' ? state[id] : {}),
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    setState(state);
  };

  const updateListingPrice = (propertyId, newPrice) => {
    const id = text(propertyId);
    const price = Math.max(0, Math.round(numberFrom(newPrice, 0)));
    if (!id || price <= 0) return false;
    const rows = readJson(LISTINGS_KEY, []);
    let updated = false;
    const next = (Array.isArray(rows) ? rows : []).map((item) => {
      if (text(item?.id) !== id) return item;
      updated = true;
      return {
        ...item,
        price,
        updatedAt: new Date().toISOString(),
      };
    });
    if (updated) writeJson(LISTINGS_KEY, next);
    return updated;
  };

  const syncListingPriceLive = async (propertyId, newPrice) => {
    const token = getToken();
    if (!token || typeof live.request !== 'function') return;
    try {
      await live.request(`/properties/${encodeURIComponent(propertyId)}`, {
        method: 'PATCH',
        token,
        data: { price: Math.round(numberFrom(newPrice, 0)) },
      });
    } catch (error) {
      if (!live.shouldFallbackToLocal || !live.shouldFallbackToLocal(error)) throw error;
    }
  };

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${CARD_ID} .sdrp-status{margin:0 0 10px;color:#1f6d3d;font-size:14px;}
#${CARD_ID} .sdrp-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px;}
#${CARD_ID} .sdrp-btn{border:1px solid #0b3d91;border-radius:8px;background:#0b3d91;color:#fff;padding:7px 11px;font-weight:700;cursor:pointer;}
#${CARD_ID} .sdrp-btn.alt{background:#fff;color:#0b3d91;}
#${CARD_ID} .sdrp-btn.warn{background:#8f4f00;border-color:#8f4f00;}
#${CARD_ID} .sdrp-settings{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-bottom:10px;}
#${CARD_ID} .sdrp-settings label{display:grid;gap:4px;font-size:12px;color:#3d5674;}
#${CARD_ID} .sdrp-settings input{border:1px solid #ccd9ee;border-radius:8px;padding:7px 9px;}
#${CARD_ID} .sdrp-kpi{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));margin-bottom:10px;}
#${CARD_ID} .sdrp-kpi-item{border:1px solid #d7e6f8;border-radius:8px;background:#f7fbff;padding:8px;}
#${CARD_ID} .sdrp-kpi-item small{display:block;color:#58718f;}
#${CARD_ID} .sdrp-kpi-item b{color:#11466e;font-size:16px;}
#${CARD_ID} .sdrp-wrap{overflow:auto;}
#${CARD_ID} table{width:100%;border-collapse:collapse;min-width:1180px;}
#${CARD_ID} th,#${CARD_ID} td{border:1px solid #d5e2f4;padding:7px;text-align:left;font-size:13px;vertical-align:top;}
#${CARD_ID} th{background:#f3f8ff;}
#${CARD_ID} .sdrp-chip{display:inline-block;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:700;}
#${CARD_ID} .sdrp-chip.new{background:#eef3ff;color:#1d4f87;}
#${CARD_ID} .sdrp-chip.qualified{background:#ecf6ff;color:#245a91;}
#${CARD_ID} .sdrp-chip.negotiation{background:#fff0d9;color:#9f5d00;}
#${CARD_ID} .sdrp-chip.documentation{background:#ffe9d7;color:#8f4f00;}
#${CARD_ID} .sdrp-chip.closing{background:#ffe5e5;color:#992222;}
#${CARD_ID} .sdrp-chip.won{background:#e7f8ef;color:#19643a;}
#${CARD_ID} .sdrp-chip.lost{background:#f2f4f7;color:#5f6f86;}
#${CARD_ID} .sdrp-chip.score-high{background:#ffe5e5;color:#992222;}
#${CARD_ID} .sdrp-chip.score-mid{background:#fff0d9;color:#9f5d00;}
#${CARD_ID} .sdrp-chip.score-low{background:#e7f8ef;color:#19643a;}
#${CARD_ID} .sdrp-actions{display:flex;flex-wrap:wrap;gap:6px;}
#${CARD_ID} .sdrp-actions button{border:1px solid #cbdcf2;background:#fff;color:#12395f;border-radius:999px;padding:4px 9px;font-size:12px;cursor:pointer;}
#${CARD_ID} .sdrp-log{max-height:170px;overflow:auto;border:1px solid #dce6f5;border-radius:8px;padding:8px;background:#fff;}
    `;
    document.head.appendChild(style);
  }

  const card = document.createElement('div');
  card.className = 'container';
  card.id = CARD_ID;
  card.innerHTML = `
    <h2>Deal Room Pro</h2>
    <p id="sdrpStatus" class="sdrp-status">Loading seller deal room...</p>
    <div class="sdrp-toolbar">
      <button id="sdrpRefreshBtn" class="sdrp-btn" type="button">Refresh</button>
      <button id="sdrpFollowupBtn" class="sdrp-btn warn" type="button">Run Follow-up Nudge</button>
      <button id="sdrpPromoteBtn" class="sdrp-btn alt" type="button">Promote Top Deals</button>
      <button id="sdrpCsvBtn" class="sdrp-btn alt" type="button">Export CSV</button>
    </div>
    <div class="sdrp-settings">
      <label>Follow-up Due (h)<input id="sdrpDueHoursInput" type="number" min="4" max="120" step="1"></label>
      <label>Queue Top Count<input id="sdrpTopCountInput" type="number" min="1" max="10" step="1"></label>
      <label>Min Deal Score<input id="sdrpMinScoreInput" type="number" min="20" max="95" step="1"></label>
      <label>Default Floor Drop %<input id="sdrpFloorDropInput" type="number" min="2" max="25" step="1"></label>
    </div>
    <div id="sdrpKpi" class="sdrp-kpi"></div>
    <div id="sdrpTable" class="sdrp-wrap"></div>
    <section style="margin-top:10px;">
      <h3 style="margin:0 0 8px;color:#11466e;">Deal Room Activity Log</h3>
      <div id="sdrpLog" class="sdrp-log"></div>
    </section>
  `;

  const pricingCard = document.getElementById('sellerPricingRepositionProCard');
  const boostCard = document.getElementById('sellerBoostOrchestratorCard');
  const anchor = pricingCard || boostCard || document.querySelector('.container');
  if (anchor) anchor.insertAdjacentElement('afterend', card);
  else document.body.appendChild(card);

  const statusEl = document.getElementById('sdrpStatus');
  const refreshBtn = document.getElementById('sdrpRefreshBtn');
  const followupBtn = document.getElementById('sdrpFollowupBtn');
  const promoteBtn = document.getElementById('sdrpPromoteBtn');
  const csvBtn = document.getElementById('sdrpCsvBtn');
  const dueHoursInput = document.getElementById('sdrpDueHoursInput');
  const topCountInput = document.getElementById('sdrpTopCountInput');
  const minScoreInput = document.getElementById('sdrpMinScoreInput');
  const floorDropInput = document.getElementById('sdrpFloorDropInput');
  const kpiEl = document.getElementById('sdrpKpi');
  const tableEl = document.getElementById('sdrpTable');
  const logEl = document.getElementById('sdrpLog');

  let model = { rows: [], summary: {} };
  let refreshTimer = null;

  const setStatus = (message, ok = true) => {
    statusEl.textContent = message;
    statusEl.style.color = ok ? '#1f6d3d' : '#8d1e1e';
  };

  const writeSettingsToUi = () => {
    const settings = getSettings();
    dueHoursInput.value = String(numberFrom(settings.followupDueHours, 24));
    topCountInput.value = String(numberFrom(settings.queueTopCount, 3));
    minScoreInput.value = String(numberFrom(settings.minDealScore, 55));
    floorDropInput.value = String(numberFrom(settings.defaultFloorDropPct, 8));
  };
  const readSettingsFromUi = () => ({
    followupDueHours: clamp(numberFrom(dueHoursInput.value, 24), 4, 120),
    queueTopCount: clamp(numberFrom(topCountInput.value, 3), 1, 10),
    minDealScore: clamp(numberFrom(minScoreInput.value, 55), 20, 95),
    defaultFloorDropPct: clamp(numberFrom(floorDropInput.value, 8), 2, 25),
  });

  const scoreClass = (score) => {
    const value = numberFrom(score, 0);
    if (value >= 75) return 'score-high';
    if (value >= 55) return 'score-mid';
    return 'score-low';
  };

  const renderKpi = () => {
    const s = model.summary || {};
    kpiEl.innerHTML = `
      <div class="sdrp-kpi-item"><small>Listings</small><b>${numberFrom(s.listings, 0)}</b></div>
      <div class="sdrp-kpi-item"><small>Active Deals</small><b>${numberFrom(s.activeDeals, 0)}</b></div>
      <div class="sdrp-kpi-item"><small>Due Follow-ups</small><b>${numberFrom(s.dueFollowups, 0)}</b></div>
      <div class="sdrp-kpi-item"><small>Won</small><b>${numberFrom(s.won, 0)}</b></div>
      <div class="sdrp-kpi-item"><small>Lost</small><b>${numberFrom(s.lost, 0)}</b></div>
      <div class="sdrp-kpi-item"><small>Avg Deal Score</small><b>${numberFrom(s.avgScore, 0)}</b></div>
      <div class="sdrp-kpi-item"><small>Pipeline Value</small><b>${inr(s.pipelineValue)}</b></div>
      <div class="sdrp-kpi-item"><small>Top Deal</small><b>${escapeHtml(text(s.topDeal, '-'))}</b></div>
    `;
  };

  const renderTable = () => {
    if (!model.rows.length) {
      tableEl.innerHTML = '<p style="margin:0;color:#607da8;">No listings available in deal room.</p>';
      return;
    }
    tableEl.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Listing</th>
            <th>Pipeline</th>
            <th>Pricing Guard</th>
            <th>Stage</th>
            <th>Deal Score</th>
            <th>Action Plan</th>
            <th>Controls</th>
          </tr>
        </thead>
        <tbody>
          ${model.rows.map((row) => `
            <tr>
              <td>
                <b>${escapeHtml(row.title)}</b><br>
                <small style="color:#5b6e86;">${escapeHtml(row.locality)} | ${escapeHtml(row.category)}</small><br>
                <small style="color:#5b6e86;">Ask ${escapeHtml(inr(row.askPrice))}</small>
              </td>
              <td>
                Leads ${row.leads}<br>
                Inquiries ${row.inquiries} | Chats ${row.chats} | Visits ${row.visits}<br>
                DOM ${row.ageDays}d
              </td>
              <td>
                Floor ${escapeHtml(inr(row.floorPrice))}<br>
                Target ${escapeHtml(inr(row.targetPrice))}<br>
                Counter ${escapeHtml(inr(row.recommendedCounter))}
              </td>
              <td>
                <span class="sdrp-chip ${escapeHtml(row.stage)}">${escapeHtml(row.stage.toUpperCase())}</span><br>
                ${row.followupDue ? '<span class="sdrp-chip closing">FOLLOW-UP DUE</span>' : `<small style="color:#5b6e86;">Last follow-up: ${escapeHtml(toDateLabel(row.lastFollowupAt))}</small>`}
              </td>
              <td>
                <span class="sdrp-chip ${scoreClass(row.score)}">${row.score}</span><br>
                <small style="color:#5b6e86;">${row.followupDue ? `${row.hoursSinceFollowup}h due` : `${row.hoursSinceFollowup}h since follow-up`}</small>
              </td>
              <td>${escapeHtml(row.nextAction)}</td>
              <td>
                <div class="sdrp-actions">
                  <button type="button" data-action="stage" data-id="${escapeHtml(row.id)}">Move Stage</button>
                  <button type="button" data-action="floor" data-id="${escapeHtml(row.id)}">Set Floor</button>
                  <button type="button" data-action="target" data-id="${escapeHtml(row.id)}">Set Target</button>
                  <button type="button" data-action="counter" data-id="${escapeHtml(row.id)}">Apply Counter</button>
                  <button type="button" data-action="followup" data-id="${escapeHtml(row.id)}">Follow-up</button>
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
      logEl.innerHTML = '<p style="margin:0;color:#607da8;">No deal-room actions yet.</p>';
      return;
    }
    logEl.innerHTML = rows.slice(0, 35).map((row) => `
      <p style="margin:0 0 8px;">
        <b>${escapeHtml(text(row.type, 'info').toUpperCase())}</b>
        <small style="color:#607da8;">${escapeHtml(toDateLabel(row.at))}</small><br>
        <span style="color:#385a7a;">${escapeHtml(text(row.title, row.propertyId))} | ${escapeHtml(text(row.stage, '-'))}</span><br>
        <span style="color:#567395;">${escapeHtml(text(row.message, '-'))}</span>
      </p>
    `).join('');
  };

  const exportCsv = () => {
    const headers = ['Property ID', 'Title', 'Stage', 'Deal Score', 'Leads', 'Inquiries', 'Chats', 'Visits', 'Ask Price', 'Floor Price', 'Target Price', 'Counter Price', 'Follow-up Due', 'Next Action'];
    const rows = model.rows.map((row) => ([
      row.id,
      row.title,
      row.stage,
      String(numberFrom(row.score, 0)),
      String(numberFrom(row.leads, 0)),
      String(numberFrom(row.inquiries, 0)),
      String(numberFrom(row.chats, 0)),
      String(numberFrom(row.visits, 0)),
      String(numberFrom(row.askPrice, 0)),
      String(numberFrom(row.floorPrice, 0)),
      String(numberFrom(row.targetPrice, 0)),
      String(numberFrom(row.recommendedCounter, 0)),
      row.followupDue ? 'yes' : 'no',
      row.nextAction,
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
    link.download = `seller-deal-room-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus('Deal room CSV exported.');
  };

  const refresh = async () => {
    const settings = getSettings();
    const listings = await getListings();
    model = buildModel({ listings, settings });
    renderKpi();
    renderTable();
    renderLog();
    setStatus(`Deal room ready. ${numberFrom(model.summary?.dueFollowups, 0)} follow-up(s) due.`);
  };

  const runFollowups = () => {
    const dueRows = model.rows.filter((row) => row.followupDue);
    if (!dueRows.length) {
      setStatus('No follow-up due deals right now.');
      return;
    }
    dueRows.forEach((row) => {
      persistRowState(row.id, { lastFollowupAt: new Date().toISOString() });
      pushLog({
        type: 'followup-nudge',
        propertyId: row.id,
        title: row.title,
        stage: row.stage,
        score: row.score,
        message: `Auto nudge: ${row.nextAction}`,
      });
    });
    pushNotification(
      'Deal Room Follow-up',
      `${dueRows.length} due deal(s) nudged with next action guidance.`,
      'warn',
    );
    setStatus(`${dueRows.length} deal(s) follow-up nudged.`);
    refresh().catch(() => null);
  };

  const promoteTopDeals = () => {
    const settings = getSettings();
    const topRows = model.rows
      .filter((row) => row.stage !== 'won' && row.stage !== 'lost')
      .filter((row) => row.score >= settings.minDealScore)
      .slice(0, settings.queueTopCount);
    if (!topRows.length) {
      setStatus('No top deals found for promotion.', false);
      return;
    }
    topRows.forEach((row) => {
      const nextStage = row.stage === 'new' ? 'qualified' : row.stage === 'qualified' ? 'negotiation' : row.stage;
      if (nextStage !== row.stage) {
        persistRowState(row.id, { stage: nextStage });
        pushLog({
          type: 'promoted',
          propertyId: row.id,
          title: row.title,
          stage: nextStage,
          score: row.score,
          message: `Deal promoted from ${row.stage} to ${nextStage}.`,
        });
      }
    });
    pushNotification('Top Deals Promoted', `${topRows.length} high-score deals promoted in pipeline.`, 'success');
    setStatus(`${topRows.length} top deal(s) promoted.`);
    refresh().catch(() => null);
  };

  refreshBtn?.addEventListener('click', () => {
    setSettings(readSettingsFromUi());
    refresh().catch((error) => setStatus(text(error?.message, 'Refresh failed.'), false));
  });
  followupBtn?.addEventListener('click', runFollowups);
  promoteBtn?.addEventListener('click', promoteTopDeals);
  csvBtn?.addEventListener('click', exportCsv);

  [dueHoursInput, topCountInput, minScoreInput, floorDropInput].forEach((input) => {
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
    const row = model.rows.find((item) => item.id === id);
    if (!row) return;

    if (action === 'stage') {
      const value = window.prompt(`Set stage for ${row.title} (${STAGES.join(', ')})`, row.stage);
      if (value === null) return;
      const nextStage = text(value).toLowerCase();
      if (!STAGES.includes(nextStage)) {
        setStatus('Invalid stage value.', false);
        return;
      }
      persistRowState(row.id, { stage: nextStage });
      pushLog({ type: 'stage-change', propertyId: row.id, title: row.title, stage: nextStage, score: row.score, message: `Stage changed to ${nextStage}.` });
      setStatus(`${row.title} moved to ${nextStage}.`);
      refresh().catch(() => null);
      return;
    }

    if (action === 'floor') {
      const value = window.prompt(`Set floor price for ${row.title}`, String(numberFrom(row.floorPrice, 0)));
      if (value === null) return;
      const floorPrice = Math.max(0, Math.round(numberFrom(value, 0)));
      if (floorPrice <= 0) {
        setStatus('Invalid floor price.', false);
        return;
      }
      persistRowState(row.id, { floorPrice });
      pushLog({ type: 'floor-price', propertyId: row.id, title: row.title, stage: row.stage, score: row.score, message: `Floor updated to ${inr(floorPrice)}.` });
      setStatus(`Floor price updated for ${row.title}.`);
      refresh().catch(() => null);
      return;
    }

    if (action === 'target') {
      const value = window.prompt(`Set target price for ${row.title}`, String(numberFrom(row.targetPrice, 0)));
      if (value === null) return;
      const targetPrice = Math.max(0, Math.round(numberFrom(value, 0)));
      if (targetPrice <= 0) {
        setStatus('Invalid target price.', false);
        return;
      }
      persistRowState(row.id, { targetPrice });
      pushLog({ type: 'target-price', propertyId: row.id, title: row.title, stage: row.stage, score: row.score, message: `Target updated to ${inr(targetPrice)}.` });
      setStatus(`Target price updated for ${row.title}.`);
      refresh().catch(() => null);
      return;
    }

    if (action === 'counter') {
      const counter = Math.max(0, Math.round(numberFrom(row.recommendedCounter, row.askPrice)));
      const ok = updateListingPrice(row.id, counter);
      if (!ok) {
        setStatus('Unable to apply counter on local listing.', false);
        return;
      }
      syncListingPriceLive(row.id, counter).catch(() => null);
      persistRowState(row.id, { lastFollowupAt: new Date().toISOString() });
      pushLog({ type: 'counter-applied', propertyId: row.id, title: row.title, stage: row.stage, amount: counter, score: row.score, message: `Counter applied at ${inr(counter)}.` });
      pushNotification('Counter Offer Applied', `${row.title} counter price updated to ${inr(counter)}.`, 'success');
      setStatus(`Counter price applied for ${row.title}.`);
      refresh().catch(() => null);
      return;
    }

    if (action === 'followup') {
      persistRowState(row.id, { lastFollowupAt: new Date().toISOString() });
      pushLog({ type: 'manual-followup', propertyId: row.id, title: row.title, stage: row.stage, score: row.score, message: `Manual follow-up sent. ${row.nextAction}` });
      setStatus(`Follow-up marked for ${row.title}.`);
      refresh().catch(() => null);
      return;
    }

    if (action === 'open') {
      window.open(`property-details.html?id=${encodeURIComponent(row.id)}`, '_blank', 'noopener,noreferrer');
    }
  });

  writeSettingsToUi();
  refresh().catch((error) => setStatus(text(error?.message, 'Unable to load deal room.'), false));

  if (refreshTimer) window.clearInterval(refreshTimer);
  refreshTimer = window.setInterval(() => {
    refresh().catch(() => null);
  }, 90000);
})();
