(() => {
  if (document.getElementById('sellerPricingRepositionProCard')) return;

  const live = window.PropertySetuLive || {};
  const isSellerPage = Boolean(document.getElementById('addPropertyForm') && document.getElementById('propertyList'));
  if (!isSellerPage) return;

  const CARD_ID = 'sellerPricingRepositionProCard';
  const STYLE_ID = 'seller-pricing-reposition-pro-style';
  const LISTINGS_KEY = 'propertySetu:listings';
  const SELLER_ENGAGEMENT_KEY = 'propertySetu:sellerEngagement';
  const CHAT_PREFIX = 'propertySetu:userChat:';
  const SETTINGS_KEY = 'propertySetu:sellerPricingRepositionSettings';
  const QUEUE_KEY = 'propertySetu:sellerPricingRepositionQueue';
  const LOG_KEY = 'propertySetu:sellerPricingRepositionLog';
  const DAY_MS = 86400000;

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
  const norm = (value) => text(value).toLowerCase();
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

  const pushNotification = (title, message, type = 'info') => {
    if (!title || !message) return;
    if (window.PropertySetuNotify && typeof window.PropertySetuNotify.emit === 'function') {
      window.PropertySetuNotify.emit({ title, message, audience: ['seller', 'admin'], type });
      return;
    }
    const rows = readJson('propertySetu:notifications', []);
    const next = Array.isArray(rows) ? rows : [];
    next.unshift({
      id: `sprp-n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
      maxDropPct: clamp(numberFrom(current?.maxDropPct, 18), 5, 35),
      maxRaisePct: clamp(numberFrom(current?.maxRaisePct, 12), 2, 25),
      minConfidence: clamp(numberFrom(current?.minConfidence, 58), 35, 95),
      autoTopCount: clamp(numberFrom(current?.autoTopCount, 3), 1, 8),
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
      const id = text(item?.propertyId || item?.id);
      if (!id || seen.has(id)) return;
      seen.add(id);
      out.push({
        propertyId: id,
        title: text(item?.title, id),
        action: text(item?.action, 'hold'),
        currentPrice: Math.max(0, numberFrom(item?.currentPrice, 0)),
        recommendedPrice: Math.max(0, numberFrom(item?.recommendedPrice, 0)),
        confidence: clamp(numberFrom(item?.confidence, 0), 0, 100),
        priority: clamp(numberFrom(item?.priority, 0), 0, 100),
        queuedAt: text(item?.queuedAt, new Date().toISOString()),
      });
    });
    return out;
  };
  const setQueue = (rows) => writeJson(QUEUE_KEY, Array.isArray(rows) ? rows : []);

  const getLog = () => {
    const rows = readJson(LOG_KEY, []);
    return Array.isArray(rows) ? rows : [];
  };
  const pushLog = (entry = {}) => {
    const rows = getLog();
    rows.unshift({
      id: `sprp-log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: new Date().toISOString(),
      type: text(entry.type, 'info'),
      propertyId: text(entry.propertyId),
      title: text(entry.title),
      action: text(entry.action),
      oldPrice: Math.max(0, numberFrom(entry.oldPrice, 0)),
      newPrice: Math.max(0, numberFrom(entry.newPrice, 0)),
      confidence: clamp(numberFrom(entry.confidence, 0), 0, 100),
      message: text(entry.message),
    });
    writeJson(LOG_KEY, rows.slice(0, 400));
  };

  const toDateLabel = (value) => {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const median = (values = []) => {
    const list = values.filter((value) => value > 0).sort((a, b) => a - b);
    if (!list.length) return 0;
    const mid = Math.floor(list.length / 2);
    return list.length % 2 ? list[mid] : Math.round((list[mid - 1] + list[mid]) / 2);
  };

  const listingAgeDays = (item = {}) => {
    const baseTs = Date.parse(text(item.createdAt || item.listedAt || item.updatedAt));
    if (!Number.isFinite(baseTs)) return 0;
    return Math.max(0, Math.floor((Date.now() - baseTs) / DAY_MS));
  };

  const getChatCountMap = () => {
    const map = {};
    try {
      const length = numberFrom(localStorage.length, 0);
      for (let index = 0; index < length; index += 1) {
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
      featuredUntil: text(item.featuredUntil || item.listingExpiresAt),
      createdAt: text(item.createdAt || item.listedAt || item.updatedAt),
      raw: item,
    };
  };

  const getListingsLocal = () => {
    const rows = readJson(LISTINGS_KEY, []);
    return (Array.isArray(rows) ? rows : [])
      .map((item) => normalizeListing(item))
      .filter(Boolean);
  };

  const loadListings = async () => {
    if (typeof live.syncLocalListingsFromApi === 'function') {
      try {
        await live.syncLocalListingsFromApi();
      } catch {
        // keep local listings
      }
    }
    return getListingsLocal();
  };

  const buildModel = ({ allListings, myListings, settings, queue }) => {
    const engagementStore = readJson(SELLER_ENGAGEMENT_KEY, {});
    const chatMap = getChatCountMap();
    const queueMap = new Map(queue.map((item) => [item.propertyId, item]));

    const bucket = {};
    allListings.forEach((row) => {
      const key = `${norm(row.category)}|${norm(row.locality)}`;
      if (!bucket[key]) bucket[key] = [];
      if (row.price > 0) bucket[key].push(row.price);
    });
    const bucketMedians = {};
    Object.entries(bucket).forEach(([key, prices]) => {
      bucketMedians[key] = median(prices);
    });

    const rows = myListings.map((row) => {
      const key = `${norm(row.category)}|${norm(row.locality)}`;
      const areaMedian = Math.max(0, numberFrom(bucketMedians[key], 0));
      const engagement = engagementStore?.[row.id] && typeof engagementStore[row.id] === 'object' ? engagementStore[row.id] : {};
      const views = numberFrom(engagement.views, 0) + numberFrom(row.raw?.analytics?.views, 0) + numberFrom(row.raw?.viewCount, 0);
      const saves = numberFrom(engagement.saves, 0) + numberFrom(row.raw?.analytics?.saves, 0);
      const inquiries = numberFrom(engagement.inquiries, 0);
      const chats = numberFrom(chatMap[row.id], 0);
      const daysOnMarket = listingAgeDays(row);
      const featuredDaysLeft = Math.ceil((Date.parse(row.featuredUntil) - Date.now()) / DAY_MS);
      const featuredActive = Number.isFinite(featuredDaysLeft) && featuredDaysLeft > 0;

      const engagementScore = clamp(Math.round((views / 28) + (saves * 3.5) + (inquiries * 6.5) + (chats * 1.8)), 0, 100);
      const priceGapPct = areaMedian > 0 ? Number((((row.price - areaMedian) / areaMedian) * 100).toFixed(1)) : 0;

      let action = 'hold';
      let reason = 'Pricing aligned with current market signals.';
      let recommendedPrice = row.price;
      let confidence = 52;

      if (row.price > 0 && areaMedian > 0 && priceGapPct >= 8 && (daysOnMarket >= 12 || engagementScore < 55)) {
        const dropPct = clamp(Math.round((priceGapPct * 0.55) + ((daysOnMarket - 10) / 12) + ((55 - engagementScore) / 9)), 3, settings.maxDropPct);
        recommendedPrice = Math.max(1000, Math.round(row.price * (1 - (dropPct / 100))));
        action = 'reduce';
        reason = `Over market by ${priceGapPct}%. Reduce by ~${dropPct}% to improve conversion.`;
        confidence = clamp(Math.round(62 + (priceGapPct * 0.7) + ((daysOnMarket >= 20 ? 9 : 0)) + ((engagementScore < 40 ? 8 : 0))), 48, 96);
      } else if (row.price > 0 && areaMedian > 0 && priceGapPct <= -8 && engagementScore >= 60) {
        const raisePct = clamp(Math.round((Math.abs(priceGapPct) * 0.45) + ((engagementScore - 60) / 9)), 2, settings.maxRaisePct);
        recommendedPrice = Math.round(row.price * (1 + (raisePct / 100)));
        action = 'increase';
        reason = `Under market by ${Math.abs(priceGapPct)}% with strong demand. Raise by ~${raisePct}%.`;
        confidence = clamp(Math.round(58 + (Math.abs(priceGapPct) * 0.55) + ((engagementScore - 60) * 0.45)), 45, 94);
      } else if (!featuredActive && daysOnMarket >= 18 && engagementScore < 42) {
        action = 'reduce';
        const dropPct = clamp(Math.round((daysOnMarket / 10) + ((45 - engagementScore) / 8)), 3, settings.maxDropPct);
        recommendedPrice = Math.max(1000, Math.round(row.price * (1 - (dropPct / 100))));
        reason = `Low demand + non-featured listing. Mild price correction (~${dropPct}%) recommended.`;
        confidence = clamp(Math.round(54 + (daysOnMarket / 3)), 46, 88);
      }

      const expectedImpactPct = action === 'reduce'
        ? clamp(Math.round((confidence * 0.45) + (daysOnMarket / 2)), 10, 95)
        : action === 'increase'
          ? clamp(Math.round((confidence * 0.28) + (engagementScore / 3)), 6, 55)
          : clamp(Math.round((engagementScore * 0.35)), 4, 38);

      const priority = action === 'hold'
        ? clamp(Math.round(32 + (daysOnMarket / 3)), 0, 65)
        : clamp(Math.round((confidence * 0.72) + (Math.abs(priceGapPct) * 0.85) + (daysOnMarket / 2)), 40, 100);

      return {
        id: row.id,
        title: row.title,
        city: row.city,
        locality: row.locality,
        category: row.category,
        currentPrice: row.price,
        areaMedian,
        priceGapPct,
        views,
        saves,
        inquiries,
        chats,
        engagementScore,
        daysOnMarket,
        featuredActive,
        featuredDaysLeft: featuredActive ? featuredDaysLeft : 0,
        action,
        reason,
        recommendedPrice,
        confidence,
        expectedImpactPct,
        priority,
        queued: queueMap.get(row.id) || null,
      };
    }).sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return b.daysOnMarket - a.daysOnMarket;
    });

    const summary = {
      listings: rows.length,
      reduce: rows.filter((row) => row.action === 'reduce').length,
      increase: rows.filter((row) => row.action === 'increase').length,
      hold: rows.filter((row) => row.action === 'hold').length,
      avgConfidence: rows.length ? Math.round(rows.reduce((sum, row) => sum + row.confidence, 0) / rows.length) : 0,
      avgEngagement: rows.length ? Math.round(rows.reduce((sum, row) => sum + row.engagementScore, 0) / rows.length) : 0,
      queued: queue.length,
      topPick: rows[0] ? `${rows[0].title} (${rows[0].action.toUpperCase()})` : '-',
    };

    return { rows, summary };
  };

  const applyLocalPrice = (propertyId, newPrice, meta = {}) => {
    const id = text(propertyId);
    if (!id || numberFrom(newPrice, 0) <= 0) return false;
    const rows = readJson(LISTINGS_KEY, []);
    let updated = false;
    const next = (Array.isArray(rows) ? rows : []).map((item) => {
      if (text(item?.id) !== id) return item;
      updated = true;
      return {
        ...item,
        price: Math.round(numberFrom(newPrice, 0)),
        updatedAt: new Date().toISOString(),
        pricingMeta: {
          ...(item?.pricingMeta && typeof item.pricingMeta === 'object' ? item.pricingMeta : {}),
          ...meta,
          updatedBy: 'seller-pricing-reposition-pro',
          updatedAt: new Date().toISOString(),
        },
      };
    });
    if (updated) writeJson(LISTINGS_KEY, next);
    return updated;
  };

  const applyLivePrice = async (propertyId, newPrice) => {
    const id = text(propertyId);
    const price = Math.round(numberFrom(newPrice, 0));
    if (!id || price <= 0) return;
    const token = getToken();
    if (!token || typeof live.request !== 'function') return;
    try {
      await live.request(`/properties/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        token,
        data: { price },
      });
    } catch (error) {
      if (!live.shouldFallbackToLocal || !live.shouldFallbackToLocal(error)) throw error;
    }
  };

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${CARD_ID} .sprp-status{margin:0 0 10px;color:#1f6d3d;font-size:14px;}
#${CARD_ID} .sprp-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px;}
#${CARD_ID} .sprp-btn{border:1px solid #0b3d91;border-radius:8px;background:#0b3d91;color:#fff;padding:7px 11px;font-weight:700;cursor:pointer;}
#${CARD_ID} .sprp-btn.alt{background:#fff;color:#0b3d91;}
#${CARD_ID} .sprp-btn.warn{background:#8f4f00;border-color:#8f4f00;}
#${CARD_ID} .sprp-settings{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));margin-bottom:10px;}
#${CARD_ID} .sprp-settings label{display:grid;gap:4px;font-size:12px;color:#3d5674;}
#${CARD_ID} .sprp-settings input{border:1px solid #ccd9ee;border-radius:8px;padding:7px 9px;}
#${CARD_ID} .sprp-kpi{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));margin-bottom:10px;}
#${CARD_ID} .sprp-kpi-item{border:1px solid #d7e6f8;border-radius:8px;background:#f7fbff;padding:8px;}
#${CARD_ID} .sprp-kpi-item small{display:block;color:#58718f;}
#${CARD_ID} .sprp-kpi-item b{color:#11466e;font-size:16px;}
#${CARD_ID} .sprp-wrap{overflow:auto;}
#${CARD_ID} table{width:100%;border-collapse:collapse;min-width:1120px;}
#${CARD_ID} th,#${CARD_ID} td{border:1px solid #d5e2f4;padding:7px;text-align:left;font-size:13px;vertical-align:top;}
#${CARD_ID} th{background:#f3f8ff;}
#${CARD_ID} .sprp-chip{display:inline-block;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:700;}
#${CARD_ID} .sprp-chip.reduce{background:#ffe5e5;color:#992222;}
#${CARD_ID} .sprp-chip.increase{background:#fff0d9;color:#9f5d00;}
#${CARD_ID} .sprp-chip.hold{background:#e7f8ef;color:#19643a;}
#${CARD_ID} .sprp-chip.high{background:#ffe5e5;color:#992222;}
#${CARD_ID} .sprp-chip.mid{background:#fff0d9;color:#9f5d00;}
#${CARD_ID} .sprp-chip.low{background:#e7f8ef;color:#19643a;}
#${CARD_ID} .sprp-actions{display:flex;flex-wrap:wrap;gap:6px;}
#${CARD_ID} .sprp-actions button{border:1px solid #cbdcf2;background:#fff;color:#12395f;border-radius:999px;padding:4px 9px;font-size:12px;cursor:pointer;}
#${CARD_ID} .sprp-log{max-height:170px;overflow:auto;border:1px solid #dce6f5;border-radius:8px;padding:8px;background:#fff;}
    `;
    document.head.appendChild(style);
  }

  const card = document.createElement('div');
  card.className = 'container';
  card.id = CARD_ID;
  card.innerHTML = `
    <h2>Pricing Reposition Pro</h2>
    <p id="sprpStatus" class="sprp-status">Loading pricing engine...</p>
    <div class="sprp-toolbar">
      <button id="sprpRefreshBtn" class="sprp-btn" type="button">Refresh</button>
      <button id="sprpQueueBtn" class="sprp-btn alt" type="button">Queue Top Suggestions</button>
      <button id="sprpAutoApplyBtn" class="sprp-btn warn" type="button">Apply Top Suggestions</button>
      <button id="sprpCsvBtn" class="sprp-btn alt" type="button">Export CSV</button>
    </div>
    <div class="sprp-settings">
      <label>Max Drop %<input id="sprpDropInput" type="number" min="5" max="35" step="1"></label>
      <label>Max Raise %<input id="sprpRaiseInput" type="number" min="2" max="25" step="1"></label>
      <label>Min Confidence %<input id="sprpConfidenceInput" type="number" min="35" max="95" step="1"></label>
      <label>Auto Top Count<input id="sprpAutoTopInput" type="number" min="1" max="8" step="1"></label>
    </div>
    <div id="sprpKpi" class="sprp-kpi"></div>
    <div id="sprpTable" class="sprp-wrap"></div>
    <section style="margin-top:10px;">
      <h3 style="margin:0 0 8px;color:#11466e;">Pricing Activity Log</h3>
      <div id="sprpLog" class="sprp-log"></div>
    </section>
  `;

  const boostCard = document.getElementById('sellerBoostOrchestratorCard');
  const renewalCard = document.getElementById('sellerRenewalControlCard');
  const anchor = boostCard || renewalCard || document.querySelector('.container');
  if (anchor) anchor.insertAdjacentElement('afterend', card);
  else document.body.appendChild(card);

  const statusEl = document.getElementById('sprpStatus');
  const refreshBtn = document.getElementById('sprpRefreshBtn');
  const queueBtn = document.getElementById('sprpQueueBtn');
  const autoApplyBtn = document.getElementById('sprpAutoApplyBtn');
  const csvBtn = document.getElementById('sprpCsvBtn');
  const dropInput = document.getElementById('sprpDropInput');
  const raiseInput = document.getElementById('sprpRaiseInput');
  const confidenceInput = document.getElementById('sprpConfidenceInput');
  const autoTopInput = document.getElementById('sprpAutoTopInput');
  const kpiEl = document.getElementById('sprpKpi');
  const tableEl = document.getElementById('sprpTable');
  const logEl = document.getElementById('sprpLog');

  let model = { rows: [], summary: {} };
  let refreshTimer = null;

  const setStatus = (message, ok = true) => {
    statusEl.textContent = message;
    statusEl.style.color = ok ? '#1f6d3d' : '#8d1e1e';
  };

  const writeSettingsToUi = () => {
    const settings = getSettings();
    dropInput.value = String(numberFrom(settings.maxDropPct, 18));
    raiseInput.value = String(numberFrom(settings.maxRaisePct, 12));
    confidenceInput.value = String(numberFrom(settings.minConfidence, 58));
    autoTopInput.value = String(numberFrom(settings.autoTopCount, 3));
  };
  const readSettingsFromUi = () => ({
    maxDropPct: clamp(numberFrom(dropInput.value, 18), 5, 35),
    maxRaisePct: clamp(numberFrom(raiseInput.value, 12), 2, 25),
    minConfidence: clamp(numberFrom(confidenceInput.value, 58), 35, 95),
    autoTopCount: clamp(numberFrom(autoTopInput.value, 3), 1, 8),
  });

  const confidenceClass = (value) => {
    const score = numberFrom(value, 0);
    if (score >= 75) return 'high';
    if (score >= 58) return 'mid';
    return 'low';
  };

  const renderKpi = () => {
    const s = model.summary || {};
    kpiEl.innerHTML = `
      <div class="sprp-kpi-item"><small>Listings</small><b>${numberFrom(s.listings, 0)}</b></div>
      <div class="sprp-kpi-item"><small>Reduce</small><b>${numberFrom(s.reduce, 0)}</b></div>
      <div class="sprp-kpi-item"><small>Increase</small><b>${numberFrom(s.increase, 0)}</b></div>
      <div class="sprp-kpi-item"><small>Hold</small><b>${numberFrom(s.hold, 0)}</b></div>
      <div class="sprp-kpi-item"><small>Avg Confidence</small><b>${numberFrom(s.avgConfidence, 0)}%</b></div>
      <div class="sprp-kpi-item"><small>Avg Engagement</small><b>${numberFrom(s.avgEngagement, 0)}</b></div>
      <div class="sprp-kpi-item"><small>Queued</small><b>${numberFrom(s.queued, 0)}</b></div>
      <div class="sprp-kpi-item"><small>Top Pick</small><b>${escapeHtml(text(s.topPick, '-'))}</b></div>
    `;
  };

  const renderTable = () => {
    if (!model.rows.length) {
      tableEl.innerHTML = '<p style="margin:0;color:#607da8;">No seller listings available for pricing analysis.</p>';
      return;
    }
    tableEl.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Listing</th>
            <th>Market Signals</th>
            <th>Price Position</th>
            <th>Recommendation</th>
            <th>Confidence</th>
            <th>Queue</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${model.rows.map((row) => `
            <tr>
              <td>
                <b>${escapeHtml(row.title)}</b><br>
                <small style="color:#5b6e86;">${escapeHtml(row.locality)} | ${escapeHtml(row.category)}</small><br>
                <small style="color:#5b6e86;">Current: ${escapeHtml(inr(row.currentPrice))}</small>
              </td>
              <td>
                Views ${row.views} | Saves ${row.saves}<br>
                Inquiries ${row.inquiries} | Chats ${row.chats}<br>
                DOM ${row.daysOnMarket}d | Engagement ${row.engagementScore}
              </td>
              <td>
                Median: ${escapeHtml(inr(row.areaMedian))}<br>
                Gap: ${row.priceGapPct >= 0 ? '+' : ''}${row.priceGapPct}%<br>
                Featured: ${row.featuredActive ? `Yes (${row.featuredDaysLeft}d)` : 'No'}
              </td>
              <td>
                <span class="sprp-chip ${row.action}">${row.action.toUpperCase()}</span><br>
                Suggested: ${escapeHtml(inr(row.recommendedPrice))}<br>
                Impact: +${row.expectedImpactPct}% lead trend<br>
                <small style="color:#5b6e86;">${escapeHtml(row.reason)}</small>
              </td>
              <td>
                <span class="sprp-chip ${confidenceClass(row.confidence)}">${row.confidence}%</span><br>
                Priority ${row.priority}
              </td>
              <td>
                ${row.queued
    ? `<span class="sprp-chip mid">Queued</span><br><small>${escapeHtml(toDateLabel(row.queued.queuedAt))}</small>`
    : '<span style="color:#607da8;">Not queued</span>'}
              </td>
              <td>
                <div class="sprp-actions">
                  <button type="button" data-action="queue" data-id="${escapeHtml(row.id)}">Queue</button>
                  <button type="button" data-action="apply" data-id="${escapeHtml(row.id)}">Apply</button>
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
      logEl.innerHTML = '<p style="margin:0;color:#607da8;">No pricing actions yet.</p>';
      return;
    }
    logEl.innerHTML = rows.slice(0, 30).map((row) => `
      <p style="margin:0 0 8px;">
        <b>${escapeHtml(text(row.type, 'info').toUpperCase())}</b>
        <small style="color:#607da8;">${escapeHtml(toDateLabel(row.at))}</small><br>
        <span style="color:#385a7a;">${escapeHtml(text(row.title, row.propertyId))} | ${escapeHtml(text(row.action, '-'))}</span><br>
        <span style="color:#567395;">${escapeHtml(inr(row.oldPrice))} -> ${escapeHtml(inr(row.newPrice))} | ${escapeHtml(text(row.message, '-'))}</span>
      </p>
    `).join('');
  };

  const queueRow = (row) => {
    if (!row || row.action === 'hold') return false;
    const queue = getQueue().filter((item) => item.propertyId !== row.id);
    queue.unshift({
      propertyId: row.id,
      title: row.title,
      action: row.action,
      currentPrice: row.currentPrice,
      recommendedPrice: row.recommendedPrice,
      confidence: row.confidence,
      priority: row.priority,
      queuedAt: new Date().toISOString(),
    });
    setQueue(queue.slice(0, 250));
    pushLog({
      type: 'queued',
      propertyId: row.id,
      title: row.title,
      action: row.action,
      oldPrice: row.currentPrice,
      newPrice: row.recommendedPrice,
      confidence: row.confidence,
      message: 'Suggestion added to queue.',
    });
    return true;
  };

  const dequeueRow = (id) => {
    const cleanId = text(id);
    if (!cleanId) return false;
    const before = getQueue();
    const after = before.filter((item) => item.propertyId !== cleanId);
    setQueue(after);
    return before.length !== after.length;
  };

  const applySuggestion = async (row, source = 'manual') => {
    if (!row || row.action === 'hold') return { ok: false, message: 'No actionable suggestion.' };
    const oldPrice = numberFrom(row.currentPrice, 0);
    const newPrice = Math.max(1, Math.round(numberFrom(row.recommendedPrice, oldPrice)));
    if (newPrice <= 0 || oldPrice <= 0 || newPrice === oldPrice) return { ok: false, message: 'Price change not required.' };

    const localOk = applyLocalPrice(row.id, newPrice, {
      source,
      action: row.action,
      confidence: row.confidence,
      reason: row.reason,
      previousPrice: oldPrice,
    });
    if (!localOk) return { ok: false, message: 'Listing not found for update.' };

    try {
      await applyLivePrice(row.id, newPrice);
    } catch (error) {
      return { ok: false, message: text(error?.message, 'Live update failed after local update.') };
    }

    pushLog({
      type: 'applied',
      propertyId: row.id,
      title: row.title,
      action: row.action,
      oldPrice,
      newPrice,
      confidence: row.confidence,
      message: `${source} suggestion applied.`,
    });
    pushNotification(
      'Pricing Updated',
      `${row.title}: ${inr(oldPrice)} -> ${inr(newPrice)} (${row.action.toUpperCase()}).`,
      'success',
    );
    return { ok: true };
  };

  const queueTop = () => {
    const settings = getSettings();
    const candidates = model.rows
      .filter((row) => row.action !== 'hold')
      .filter((row) => row.confidence >= settings.minConfidence)
      .filter((row) => !row.queued)
      .slice(0, settings.autoTopCount);
    if (!candidates.length) {
      setStatus('No eligible suggestions for queue.', false);
      return;
    }
    candidates.forEach((row) => queueRow(row));
    setStatus(`${candidates.length} pricing suggestion(s) queued.`);
    refresh().catch(() => null);
  };

  const applyTop = async () => {
    const settings = getSettings();
    const candidates = model.rows
      .filter((row) => row.action !== 'hold')
      .filter((row) => row.confidence >= settings.minConfidence)
      .slice(0, settings.autoTopCount);
    if (!candidates.length) {
      setStatus('No high-confidence suggestions to apply.', false);
      return;
    }
    let applied = 0;
    let failed = 0;
    for (const row of candidates) {
      // eslint-disable-next-line no-await-in-loop
      const result = await applySuggestion(row, 'auto-top');
      if (result.ok) {
        applied += 1;
        dequeueRow(row.id);
      } else {
        failed += 1;
        pushLog({
          type: 'failed',
          propertyId: row.id,
          title: row.title,
          action: row.action,
          oldPrice: row.currentPrice,
          newPrice: row.recommendedPrice,
          confidence: row.confidence,
          message: text(result.message, 'Apply failed.'),
        });
      }
    }
    setStatus(`Auto apply complete. Applied: ${applied}, Failed: ${failed}.`, failed === 0);
    await refresh();
  };

  const exportCsv = () => {
    const headers = ['Property ID', 'Title', 'Current Price', 'Suggested Price', 'Action', 'Confidence', 'Priority', 'Days On Market', 'Engagement', 'Price Gap %', 'Reason'];
    const rows = model.rows.map((row) => ([
      row.id,
      row.title,
      String(numberFrom(row.currentPrice, 0)),
      String(numberFrom(row.recommendedPrice, 0)),
      row.action,
      String(numberFrom(row.confidence, 0)),
      String(numberFrom(row.priority, 0)),
      String(numberFrom(row.daysOnMarket, 0)),
      String(numberFrom(row.engagementScore, 0)),
      String(numberFrom(row.priceGapPct, 0)),
      row.reason,
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
    link.download = `seller-pricing-reposition-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus('Pricing CSV exported.');
  };

  const refresh = async () => {
    const settings = getSettings();
    const allListings = await loadListings();
    const sessionId = getSessionId();
    const myListings = allListings.filter((row) => !sessionId || row.ownerId === sessionId);
    const queue = getQueue();
    model = buildModel({ allListings, myListings, settings, queue });
    renderKpi();
    renderTable();
    renderLog();
    setStatus(`Pricing engine ready. ${numberFrom(model.summary?.reduce, 0)} reduce and ${numberFrom(model.summary?.increase, 0)} increase suggestion(s).`);
  };

  refreshBtn?.addEventListener('click', () => {
    setSettings(readSettingsFromUi());
    refresh().catch((error) => setStatus(text(error?.message, 'Refresh failed.'), false));
  });
  queueBtn?.addEventListener('click', queueTop);
  autoApplyBtn?.addEventListener('click', () => {
    setSettings(readSettingsFromUi());
    applyTop().catch((error) => setStatus(text(error?.message, 'Auto apply failed.'), false));
  });
  csvBtn?.addEventListener('click', exportCsv);

  [dropInput, raiseInput, confidenceInput, autoTopInput].forEach((input) => {
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
    if (action === 'queue') {
      const ok = queueRow(row);
      setStatus(ok ? `${row.title} queued for pricing action.` : 'Nothing to queue for this listing.', ok);
      refresh().catch(() => null);
      return;
    }
    if (action === 'dequeue') {
      const removed = dequeueRow(id);
      setStatus(removed ? `${row.title} removed from queue.` : 'Listing not found in queue.', removed);
      refresh().catch(() => null);
      return;
    }
    if (action === 'apply') {
      applySuggestion(row, 'manual')
        .then((result) => {
          if (!result.ok) {
            setStatus(text(result.message, 'Apply failed.'), false);
            return;
          }
          dequeueRow(row.id);
          setStatus(`${row.title} pricing updated successfully.`);
          refresh().catch(() => null);
        })
        .catch((error) => setStatus(text(error?.message, 'Apply failed.'), false));
      return;
    }
    if (action === 'open') {
      window.open(`property-details.html?id=${encodeURIComponent(row.id)}`, '_blank', 'noopener,noreferrer');
    }
  });

  writeSettingsToUi();
  refresh().catch((error) => setStatus(text(error?.message, 'Unable to load pricing engine.'), false));

  if (refreshTimer) window.clearInterval(refreshTimer);
  refreshTimer = window.setInterval(() => {
    refresh().catch(() => null);
  }, 90000);
})();
