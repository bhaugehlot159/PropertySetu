(() => {
  if (document.getElementById('customerSmartAlertsProCard')) return;

  const live = window.PropertySetuLive || {};
  const isUserPage = Boolean(
    document.getElementById('wishlist')
    && document.getElementById('propertySelect')
    && document.getElementById('chatBox')
  );
  if (!isUserPage) return;

  const CARD_ID = 'customerSmartAlertsProCard';
  const STYLE_ID = 'customer-smart-alerts-pro-style';
  const LISTINGS_KEY = 'propertySetu:listings';
  const MARKET_STATE_KEY = 'propertysetu-marketplace-state';
  const RULES_KEY = 'propertySetu:customerAlertRules';
  const PREFS_KEY = 'propertySetu:customerAlertPrefs';
  const STATE_KEY = 'propertySetu:customerAlertState';
  const FEED_KEY = 'propertySetu:customerAlertFeed';

  const DEFAULT_CATEGORIES = [
    'House',
    'Flat',
    'Villa',
    'Plot',
    'Farm House',
    'Vadi',
    'Agriculture Land',
    'Commercial',
    'Shop',
    'Office',
    'Warehouse',
    'PG/Hostel',
    'Property Care',
  ];
  const DEFAULT_PURPOSES = ['Buy', 'Rent', 'Sell', 'Lease', 'Resale', 'Mortgage (Girvi)'];

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
  const norm = (value) => text(value).toLowerCase();

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

  const pushAppNotification = (title, message, type = 'info') => {
    if (!title || !message) return;
    if (window.PropertySetuNotify && typeof window.PropertySetuNotify.emit === 'function') {
      window.PropertySetuNotify.emit({ title, message, audience: ['customer'], type });
      return;
    }
    const rows = readJson('propertySetu:notifications', []);
    const next = Array.isArray(rows) ? rows : [];
    next.unshift({
      id: `csap-n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      message,
      audience: ['customer'],
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

  const normalizeListing = (item = {}) => {
    const id = text(item.id || item._id);
    if (!id) return null;
    return {
      id,
      title: text(item.title, id),
      locality: text(item.location || item.locality, ''),
      city: text(item.city, 'Udaipur'),
      category: text(item.category || item.propertyTypeCore, ''),
      purpose: text(item.purpose || item.type || item.saleRentMode, ''),
      price: Math.max(0, numberFrom(item.price, 0)),
      verified: Boolean(item.verified || item.verifiedByPropertySetu || norm(item.status) === 'approved'),
      featured: Boolean(item.featured),
      listedAt: text(item.createdAt || item.listedAt || item.updatedAt),
    };
  };

  const loadListings = async () => {
    if (typeof live.syncLocalListingsFromApi === 'function') {
      try {
        await live.syncLocalListingsFromApi();
      } catch {
        // keep local cache
      }
    }
    const rows = readJson(LISTINGS_KEY, []);
    return (Array.isArray(rows) ? rows : [])
      .map((item) => normalizeListing(item))
      .filter(Boolean);
  };

  const toDateLabel = (value) => {
    const date = new Date(value || '');
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const getPrefs = () => {
    const current = readJson(PREFS_KEY, {});
    return {
      scanMinutes: clamp(numberFrom(current?.scanMinutes, 4), 1, 60),
      maxFeedItems: clamp(numberFrom(current?.maxFeedItems, 180), 40, 600),
      desktopNotify: current?.desktopNotify === true,
    };
  };
  const setPrefs = (next) => {
    const current = getPrefs();
    writeJson(PREFS_KEY, { ...current, ...(next || {}) });
  };

  const normalizeRule = (item = {}) => {
    const id = text(item.id);
    if (!id) return null;
    return {
      id,
      name: text(item.name, 'Alert Rule'),
      locality: text(item.locality, ''),
      category: text(item.category, 'All'),
      purpose: text(item.purpose, 'All'),
      minPrice: Math.max(0, numberFrom(item.minPrice, 0)),
      maxPrice: Math.max(0, numberFrom(item.maxPrice, 0)),
      verifiedOnly: Boolean(item.verifiedOnly),
      enabled: item.enabled !== false,
      createdAt: text(item.createdAt, new Date().toISOString()),
    };
  };

  const getRules = () => {
    const rows = readJson(RULES_KEY, []);
    const out = [];
    const seen = new Set();
    (Array.isArray(rows) ? rows : []).forEach((item) => {
      const normalized = normalizeRule(item);
      if (!normalized || seen.has(normalized.id)) return;
      seen.add(normalized.id);
      out.push(normalized);
    });
    return out;
  };
  const setRules = (rows) => {
    const list = Array.isArray(rows) ? rows : [];
    writeJson(RULES_KEY, list.map((item) => normalizeRule(item)).filter(Boolean));
  };

  const getState = () => {
    const current = readJson(STATE_KEY, {});
    return current && typeof current === 'object'
      ? {
        ruleStatus: current.ruleStatus && typeof current.ruleStatus === 'object' ? current.ruleStatus : {},
        watchPriceMap: current.watchPriceMap && typeof current.watchPriceMap === 'object' ? current.watchPriceMap : {},
      }
      : { ruleStatus: {}, watchPriceMap: {} };
  };
  const setState = (next) => {
    const state = next && typeof next === 'object' ? next : {};
    writeJson(STATE_KEY, {
      ruleStatus: state.ruleStatus && typeof state.ruleStatus === 'object' ? state.ruleStatus : {},
      watchPriceMap: state.watchPriceMap && typeof state.watchPriceMap === 'object' ? state.watchPriceMap : {},
    });
  };

  const getFeed = () => {
    const rows = readJson(FEED_KEY, []);
    return Array.isArray(rows) ? rows : [];
  };
  const pushFeed = (events = []) => {
    const prefs = getPrefs();
    const current = getFeed();
    const next = [...events, ...current];
    writeJson(FEED_KEY, next.slice(0, prefs.maxFeedItems));
  };

  const ruleMatchesListing = (rule, listing) => {
    if (!rule || !listing) return false;
    const locality = norm(rule.locality);
    const category = norm(rule.category);
    const purpose = norm(rule.purpose);
    const listingLocality = `${norm(listing.locality)} ${norm(listing.city)}`;
    const listingCategory = norm(listing.category);
    const listingPurpose = norm(listing.purpose);

    if (locality && !listingLocality.includes(locality)) return false;
    if (category && category !== 'all' && category !== listingCategory) return false;
    if (purpose && purpose !== 'all' && purpose !== listingPurpose) return false;
    if (rule.verifiedOnly && !listing.verified) return false;
    if (numberFrom(rule.minPrice, 0) > 0 && listing.price < numberFrom(rule.minPrice, 0)) return false;
    if (numberFrom(rule.maxPrice, 0) > 0 && listing.price > numberFrom(rule.maxPrice, 0)) return false;
    return true;
  };

  const makeEvent = (payload = {}) => ({
    id: `csap-e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    type: text(payload.type, 'rule-match'),
    ruleId: text(payload.ruleId),
    ruleName: text(payload.ruleName),
    propertyId: text(payload.propertyId),
    title: text(payload.title),
    locality: text(payload.locality),
    message: text(payload.message),
    oldPrice: Math.max(0, numberFrom(payload.oldPrice, 0)),
    newPrice: Math.max(0, numberFrom(payload.newPrice, 0)),
  });

  const runScan = async ({ notify = false } = {}) => {
    const listings = await loadListings();
    const listingMap = new Map(listings.map((item) => [item.id, item]));
    const rules = getRules();
    const activeRules = rules.filter((rule) => rule.enabled);
    const marketState = readJson(MARKET_STATE_KEY, { wishlist: [], compare: [] });
    const watchIds = [...new Set([
      ...(Array.isArray(marketState?.wishlist) ? marketState.wishlist : []),
      ...(Array.isArray(marketState?.compare) ? marketState.compare : []),
    ].map((id) => text(id)).filter(Boolean))];

    const state = getState();
    const nextState = {
      ruleStatus: { ...(state.ruleStatus || {}) },
      watchPriceMap: {},
    };

    const events = [];
    let totalRuleMatches = 0;

    activeRules.forEach((rule) => {
      const matches = listings.filter((listing) => ruleMatchesListing(rule, listing));
      totalRuleMatches += matches.length;
      const previous = nextState.ruleStatus[rule.id] && typeof nextState.ruleStatus[rule.id] === 'object'
        ? nextState.ruleStatus[rule.id]
        : { matchIds: [], priceMap: {} };
      const previousIds = new Set((Array.isArray(previous.matchIds) ? previous.matchIds : []).map((id) => text(id)));
      const previousPriceMap = previous.priceMap && typeof previous.priceMap === 'object' ? previous.priceMap : {};

      matches.forEach((listing) => {
        if (!previousIds.has(listing.id)) {
          events.push(makeEvent({
            type: 'new-match',
            ruleId: rule.id,
            ruleName: rule.name,
            propertyId: listing.id,
            title: listing.title,
            locality: listing.locality || listing.city,
            newPrice: listing.price,
            message: `${rule.name}: new matching listing found.`,
          }));
        }
        const oldPrice = numberFrom(previousPriceMap[listing.id], 0);
        if (oldPrice > 0 && listing.price > 0 && listing.price < oldPrice) {
          events.push(makeEvent({
            type: 'price-drop',
            ruleId: rule.id,
            ruleName: rule.name,
            propertyId: listing.id,
            title: listing.title,
            locality: listing.locality || listing.city,
            oldPrice,
            newPrice: listing.price,
            message: `${rule.name}: price dropped by ${inr(oldPrice - listing.price)}.`,
          }));
        }
      });

      const nextPriceMap = {};
      matches.forEach((listing) => {
        nextPriceMap[listing.id] = listing.price;
      });
      nextState.ruleStatus[rule.id] = {
        matchIds: matches.map((listing) => listing.id),
        priceMap: nextPriceMap,
        lastCount: matches.length,
        lastScanAt: new Date().toISOString(),
      };
    });

    const oldWatchMap = state.watchPriceMap && typeof state.watchPriceMap === 'object' ? state.watchPriceMap : {};
    watchIds.forEach((id) => {
      const listing = listingMap.get(id);
      if (!listing) return;
      const oldPrice = numberFrom(oldWatchMap[id], 0);
      if (oldPrice > 0 && listing.price > 0 && listing.price < oldPrice) {
        events.push(makeEvent({
          type: 'watch-price-drop',
          ruleId: '',
          ruleName: 'Watchlist',
          propertyId: listing.id,
          title: listing.title,
          locality: listing.locality || listing.city,
          oldPrice,
          newPrice: listing.price,
          message: `Watchlist price drop: ${listing.title}`,
        }));
      }
      nextState.watchPriceMap[id] = listing.price;
    });

    setState(nextState);
    if (events.length) pushFeed(events);

    if (notify && events.length) {
      const newCount = events.filter((item) => item.type === 'new-match').length;
      const dropCount = events.filter((item) => item.type !== 'new-match').length;
      const msg = `${events.length} update(s): ${newCount} new matches, ${dropCount} price drops.`;
      pushAppNotification('Smart Alerts Updated', msg, dropCount > 0 ? 'warn' : 'info');
      maybeDesktopNotify('PropertySetu Smart Alerts', msg);
    }

    return {
      listingsCount: listings.length,
      activeRules: activeRules.length,
      totalRuleMatches,
      watchCount: watchIds.length,
      newEvents: events.length,
    };
  };

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${CARD_ID} .csap-status{margin:0 0 10px;color:#1f6d3d;font-size:14px;}
#${CARD_ID} .csap-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px;}
#${CARD_ID} .csap-btn{border:1px solid #0b3d91;border-radius:8px;background:#0b3d91;color:#fff;padding:7px 11px;font-weight:700;cursor:pointer;}
#${CARD_ID} .csap-btn.alt{background:#fff;color:#0b3d91;}
#${CARD_ID} .csap-btn.warn{background:#8f4f00;border-color:#8f4f00;}
#${CARD_ID} .csap-kpi{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));margin-bottom:10px;}
#${CARD_ID} .csap-kpi-item{border:1px solid #d7e6f8;border-radius:8px;background:#f7fbff;padding:8px;}
#${CARD_ID} .csap-kpi-item small{display:block;color:#58718f;}
#${CARD_ID} .csap-kpi-item b{color:#11466e;font-size:16px;}
#${CARD_ID} .csap-grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));margin-bottom:10px;}
#${CARD_ID} .csap-card{border:1px solid #dbe6f5;border-radius:10px;padding:10px;background:#fff;}
#${CARD_ID} .csap-card h3{margin:0 0 8px;color:#124a72;}
#${CARD_ID} .csap-form{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));}
#${CARD_ID} .csap-form input,#${CARD_ID} .csap-form select{border:1px solid #ccd9ee;border-radius:8px;padding:7px 9px;}
#${CARD_ID} .csap-toggle{display:flex;align-items:center;gap:6px;font-size:12px;color:#3d5674;}
#${CARD_ID} .csap-wrap{overflow:auto;}
#${CARD_ID} table{width:100%;border-collapse:collapse;min-width:920px;}
#${CARD_ID} th,#${CARD_ID} td{border:1px solid #d5e2f4;padding:7px;text-align:left;font-size:13px;vertical-align:top;}
#${CARD_ID} th{background:#f3f8ff;}
#${CARD_ID} .csap-chip{display:inline-block;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:700;}
#${CARD_ID} .csap-chip.on{background:#e7f8ef;color:#19643a;}
#${CARD_ID} .csap-chip.off{background:#f2f4f7;color:#5f6f86;}
#${CARD_ID} .csap-chip.new{background:#eef3ff;color:#1d4f87;}
#${CARD_ID} .csap-chip.drop{background:#ffe5e5;color:#992222;}
#${CARD_ID} .csap-actions{display:flex;flex-wrap:wrap;gap:6px;}
#${CARD_ID} .csap-actions button{border:1px solid #cbdcf2;background:#fff;color:#12395f;border-radius:999px;padding:4px 9px;font-size:12px;cursor:pointer;}
    `;
    document.head.appendChild(style);
  }

  const card = document.createElement('div');
  card.className = 'container';
  card.id = CARD_ID;
  card.innerHTML = `
    <h2>Smart Alerts Pro</h2>
    <p id="csapStatus" class="csap-status">Loading smart alerts...</p>
    <div class="csap-toolbar">
      <button id="csapRefreshBtn" class="csap-btn" type="button">Refresh Scan</button>
      <button id="csapAutoBtn" class="csap-btn warn" type="button">Run Auto Actions</button>
      <button id="csapWishlistBtn" class="csap-btn alt" type="button">Add Rule From Wishlist</button>
      <button id="csapCsvBtn" class="csap-btn alt" type="button">Export Feed CSV</button>
    </div>
    <div class="csap-grid">
      <section class="csap-card">
        <h3>Rule Settings</h3>
        <div class="csap-form" style="margin-bottom:8px;">
          <label>Scan (min)<input id="csapScanInput" type="number" min="1" max="60" step="1"></label>
          <label>Feed Limit<input id="csapFeedLimitInput" type="number" min="40" max="600" step="10"></label>
          <label class="csap-toggle"><input id="csapDesktopToggle" type="checkbox"> Desktop notify</label>
        </div>
        <form id="csapRuleForm" class="csap-form">
          <input id="csapRuleName" type="text" placeholder="Rule name (e.g. Budget flats)" required>
          <input id="csapRuleLocality" type="text" placeholder="Locality / city keyword">
          <select id="csapRuleCategory"><option value="All">All Categories</option></select>
          <select id="csapRulePurpose"><option value="All">All Purpose</option></select>
          <input id="csapRuleMinPrice" type="number" min="0" step="10000" placeholder="Min price">
          <input id="csapRuleMaxPrice" type="number" min="0" step="10000" placeholder="Max price">
          <label class="csap-toggle"><input id="csapRuleVerifiedOnly" type="checkbox"> Verified only</label>
          <button class="csap-btn" type="submit">Create Rule</button>
        </form>
      </section>
      <section class="csap-card">
        <h3>Summary</h3>
        <div id="csapKpi" class="csap-kpi"></div>
      </section>
    </div>
    <section class="csap-card">
      <h3>Alert Rules</h3>
      <div id="csapRulesTable" class="csap-wrap"></div>
    </section>
    <section class="csap-card" style="margin-top:10px;">
      <h3>Recent Alert Feed</h3>
      <div id="csapFeedTable" class="csap-wrap"></div>
    </section>
  `;

  const engagementCard = document.getElementById('customerEngagementSuiteCard');
  const decisionCard = document.getElementById('customerDecisionRoomCard');
  const anchor = engagementCard || decisionCard || document.querySelector('.container');
  if (anchor) anchor.insertAdjacentElement('afterend', card);
  else document.body.appendChild(card);

  const statusEl = document.getElementById('csapStatus');
  const refreshBtn = document.getElementById('csapRefreshBtn');
  const autoBtn = document.getElementById('csapAutoBtn');
  const wishlistBtn = document.getElementById('csapWishlistBtn');
  const csvBtn = document.getElementById('csapCsvBtn');
  const scanInput = document.getElementById('csapScanInput');
  const feedLimitInput = document.getElementById('csapFeedLimitInput');
  const desktopToggle = document.getElementById('csapDesktopToggle');
  const ruleForm = document.getElementById('csapRuleForm');
  const ruleNameInput = document.getElementById('csapRuleName');
  const ruleLocalityInput = document.getElementById('csapRuleLocality');
  const ruleCategorySelect = document.getElementById('csapRuleCategory');
  const rulePurposeSelect = document.getElementById('csapRulePurpose');
  const ruleMinPriceInput = document.getElementById('csapRuleMinPrice');
  const ruleMaxPriceInput = document.getElementById('csapRuleMaxPrice');
  const ruleVerifiedOnlyInput = document.getElementById('csapRuleVerifiedOnly');
  const kpiEl = document.getElementById('csapKpi');
  const rulesTableEl = document.getElementById('csapRulesTable');
  const feedTableEl = document.getElementById('csapFeedTable');

  let autoTimer = null;
  let lastScanResult = {
    listingsCount: 0,
    activeRules: 0,
    totalRuleMatches: 0,
    watchCount: 0,
    newEvents: 0,
  };

  const setStatus = (message, ok = true) => {
    statusEl.textContent = message;
    statusEl.style.color = ok ? '#1f6d3d' : '#8d1e1e';
  };

  const writePrefsToUi = () => {
    const prefs = getPrefs();
    scanInput.value = String(numberFrom(prefs.scanMinutes, 4));
    feedLimitInput.value = String(numberFrom(prefs.maxFeedItems, 180));
    desktopToggle.checked = prefs.desktopNotify;
  };
  const readPrefsFromUi = () => ({
    scanMinutes: clamp(numberFrom(scanInput.value, 4), 1, 60),
    maxFeedItems: clamp(numberFrom(feedLimitInput.value, 180), 40, 600),
    desktopNotify: desktopToggle.checked,
  });

  const fillSelectOptions = async () => {
    const listings = await loadListings();
    const categories = new Set(DEFAULT_CATEGORIES);
    const purposes = new Set(DEFAULT_PURPOSES);
    listings.forEach((item) => {
      if (text(item.category)) categories.add(item.category);
      if (text(item.purpose)) purposes.add(item.purpose);
    });
    ruleCategorySelect.innerHTML = ['<option value="All">All Categories</option>', ...[...categories].sort((a, b) => a.localeCompare(b)).map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)].join('');
    rulePurposeSelect.innerHTML = ['<option value="All">All Purpose</option>', ...[...purposes].sort((a, b) => a.localeCompare(b)).map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)].join('');
  };

  const renderKpi = () => {
    const rules = getRules();
    const feed = getFeed();
    const today = new Date().toISOString().slice(0, 10);
    const todayItems = feed.filter((item) => text(item.at).slice(0, 10) === today);
    const newToday = todayItems.filter((item) => text(item.type) === 'new-match').length;
    const dropsToday = todayItems.filter((item) => text(item.type) !== 'new-match').length;

    kpiEl.innerHTML = `
      <div class="csap-kpi-item"><small>Rules</small><b>${rules.length}</b></div>
      <div class="csap-kpi-item"><small>Active Rules</small><b>${rules.filter((item) => item.enabled).length}</b></div>
      <div class="csap-kpi-item"><small>Total Matches</small><b>${numberFrom(lastScanResult.totalRuleMatches, 0)}</b></div>
      <div class="csap-kpi-item"><small>Watchlist IDs</small><b>${numberFrom(lastScanResult.watchCount, 0)}</b></div>
      <div class="csap-kpi-item"><small>New Today</small><b>${newToday}</b></div>
      <div class="csap-kpi-item"><small>Price Drops Today</small><b>${dropsToday}</b></div>
      <div class="csap-kpi-item"><small>Feed Size</small><b>${feed.length}</b></div>
    `;
  };

  const ruleMatchCount = (ruleId) => {
    const state = getState();
    const row = state.ruleStatus?.[ruleId];
    return numberFrom(row?.lastCount, 0);
  };

  const renderRulesTable = () => {
    const rows = getRules();
    if (!rows.length) {
      rulesTableEl.innerHTML = '<p style="margin:0;color:#607da8;">No alert rules yet. Create your first smart rule.</p>';
      return;
    }
    rulesTableEl.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Rule</th>
            <th>Filters</th>
            <th>Status</th>
            <th>Matches</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>
              <td>
                <b>${escapeHtml(row.name)}</b><br>
                <small style="color:#5b6e86;">Created: ${escapeHtml(toDateLabel(row.createdAt))}</small>
              </td>
              <td>
                Locality: ${escapeHtml(row.locality || 'Any')}<br>
                Category: ${escapeHtml(row.category || 'All')}<br>
                Purpose: ${escapeHtml(row.purpose || 'All')}<br>
                Price: ${row.minPrice ? inr(row.minPrice) : 'Any'} - ${row.maxPrice ? inr(row.maxPrice) : 'Any'}<br>
                Verified: ${row.verifiedOnly ? 'Yes' : 'No'}
              </td>
              <td><span class="csap-chip ${row.enabled ? 'on' : 'off'}">${row.enabled ? 'Enabled' : 'Disabled'}</span></td>
              <td>${ruleMatchCount(row.id)}</td>
              <td>
                <div class="csap-actions">
                  <button type="button" data-action="toggle" data-id="${escapeHtml(row.id)}">${row.enabled ? 'Disable' : 'Enable'}</button>
                  <button type="button" data-action="run" data-id="${escapeHtml(row.id)}">Scan</button>
                  <button type="button" data-action="delete" data-id="${escapeHtml(row.id)}">Delete</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const typeLabel = (value) => {
    const key = text(value).toLowerCase();
    if (key === 'new-match') return 'New Match';
    if (key === 'price-drop') return 'Rule Price Drop';
    if (key === 'watch-price-drop') return 'Watchlist Drop';
    return key || '-';
  };
  const typeClass = (value) => {
    const key = text(value).toLowerCase();
    if (key === 'new-match') return 'new';
    return 'drop';
  };

  const renderFeedTable = () => {
    const rows = getFeed();
    if (!rows.length) {
      feedTableEl.innerHTML = '<p style="margin:0;color:#607da8;">No alert activity yet.</p>';
      return;
    }
    feedTableEl.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Type</th>
            <th>Rule</th>
            <th>Listing</th>
            <th>Price Info</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${rows.slice(0, 120).map((row) => `
            <tr>
              <td>${escapeHtml(toDateLabel(row.at))}</td>
              <td><span class="csap-chip ${typeClass(row.type)}">${escapeHtml(typeLabel(row.type))}</span></td>
              <td>${escapeHtml(text(row.ruleName, '-'))}</td>
              <td>
                <b>${escapeHtml(text(row.title, row.propertyId))}</b><br>
                <small style="color:#5b6e86;">${escapeHtml(text(row.locality, '-'))}</small>
              </td>
              <td>
                ${row.oldPrice > 0 ? `${escapeHtml(inr(row.oldPrice))} -> ` : ''}
                ${row.newPrice > 0 ? escapeHtml(inr(row.newPrice)) : '-'}
              </td>
              <td>
                <button type="button" data-action="open-feed" data-id="${escapeHtml(text(row.propertyId))}">Open</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const renderAll = () => {
    renderKpi();
    renderRulesTable();
    renderFeedTable();
  };

  const refreshAndRender = async ({ notify = false } = {}) => {
    lastScanResult = await runScan({ notify });
    renderAll();
    setStatus(`Alerts ready. ${numberFrom(lastScanResult.newEvents, 0)} new update(s), ${numberFrom(lastScanResult.totalRuleMatches, 0)} total matches.`);
  };

  const setupAutoTimer = () => {
    if (autoTimer) window.clearInterval(autoTimer);
    const prefs = getPrefs();
    autoTimer = window.setInterval(() => {
      refreshAndRender({ notify: true }).catch(() => null);
    }, Math.max(1, numberFrom(prefs.scanMinutes, 4)) * 60000);
  };

  const createRuleFromForm = () => {
    const name = text(ruleNameInput.value);
    if (!name) return false;
    const rule = {
      id: `csap-rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      locality: text(ruleLocalityInput.value),
      category: text(ruleCategorySelect.value, 'All'),
      purpose: text(rulePurposeSelect.value, 'All'),
      minPrice: Math.max(0, numberFrom(ruleMinPriceInput.value, 0)),
      maxPrice: Math.max(0, numberFrom(ruleMaxPriceInput.value, 0)),
      verifiedOnly: ruleVerifiedOnlyInput.checked,
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    const rules = getRules();
    rules.unshift(rule);
    setRules(rules);
    ruleForm.reset();
    ruleCategorySelect.value = 'All';
    rulePurposeSelect.value = 'All';
    return true;
  };

  const addRuleFromWishlist = async () => {
    const listings = await loadListings();
    const listingMap = new Map(listings.map((item) => [item.id, item]));
    const marketState = readJson(MARKET_STATE_KEY, { wishlist: [], compare: [] });
    const ids = [
      ...(Array.isArray(marketState?.wishlist) ? marketState.wishlist : []),
      ...(Array.isArray(marketState?.compare) ? marketState.compare : []),
    ].map((id) => text(id)).filter(Boolean);
    const seed = ids.map((id) => listingMap.get(id)).find(Boolean);
    if (!seed) return false;

    const autoRule = {
      id: `csap-rule-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: `Watch ${seed.title}`.slice(0, 60),
      locality: text(seed.locality || seed.city),
      category: text(seed.category, 'All'),
      purpose: text(seed.purpose, 'All'),
      minPrice: 0,
      maxPrice: seed.price > 0 ? Math.round(seed.price * 1.2) : 0,
      verifiedOnly: false,
      enabled: true,
      createdAt: new Date().toISOString(),
    };
    const rules = getRules();
    rules.unshift(autoRule);
    setRules(rules);
    return true;
  };

  const toggleRule = (id) => {
    const cleanId = text(id);
    const rows = getRules();
    const next = rows.map((row) => (row.id !== cleanId ? row : { ...row, enabled: !row.enabled }));
    setRules(next);
  };
  const deleteRule = (id) => {
    const cleanId = text(id);
    const rows = getRules().filter((row) => row.id !== cleanId);
    setRules(rows);
    const state = getState();
    if (state.ruleStatus && state.ruleStatus[cleanId]) {
      delete state.ruleStatus[cleanId];
      setState(state);
    }
  };

  const runSingleRuleScan = async () => {
    lastScanResult = await runScan({ notify: true });
    renderAll();
  };

  const exportFeedCsv = () => {
    const rows = getFeed();
    const headers = ['Time', 'Type', 'Rule', 'Property ID', 'Title', 'Locality', 'Old Price', 'New Price', 'Message'];
    const lines = rows.map((row) => ([
      toDateLabel(row.at),
      typeLabel(row.type),
      text(row.ruleName),
      text(row.propertyId),
      text(row.title),
      text(row.locality),
      String(numberFrom(row.oldPrice, 0)),
      String(numberFrom(row.newPrice, 0)),
      text(row.message),
    ]));
    const quote = (value) => {
      const raw = String(value || '');
      if (!/[",\n]/.test(raw)) return raw;
      return `"${raw.replace(/"/g, '""')}"`;
    };
    const csv = [headers, ...lines].map((line) => line.map(quote).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `customer-smart-alert-feed-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus('Alert feed CSV exported.');
  };

  refreshBtn?.addEventListener('click', () => {
    setPrefs(readPrefsFromUi());
    setupAutoTimer();
    refreshAndRender({ notify: false }).catch((error) => setStatus(text(error?.message, 'Refresh failed.'), false));
  });
  autoBtn?.addEventListener('click', () => {
    setPrefs(readPrefsFromUi());
    refreshAndRender({ notify: true }).catch((error) => setStatus(text(error?.message, 'Auto run failed.'), false));
  });
  wishlistBtn?.addEventListener('click', () => {
    addRuleFromWishlist()
      .then((ok) => {
        if (!ok) {
          setStatus('Wishlist/compare listing not found for auto rule.', false);
          return;
        }
        setStatus('Rule created from wishlist/compare.');
        refreshAndRender({ notify: false }).catch(() => null);
      })
      .catch((error) => setStatus(text(error?.message, 'Unable to create wishlist rule.'), false));
  });
  csvBtn?.addEventListener('click', exportFeedCsv);

  [scanInput, feedLimitInput, desktopToggle].forEach((input) => {
    input?.addEventListener('change', () => {
      setPrefs(readPrefsFromUi());
      setupAutoTimer();
    });
  });

  ruleForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const ok = createRuleFromForm();
    if (!ok) {
      setStatus('Rule name is required.', false);
      return;
    }
    setStatus('Rule created successfully.');
    refreshAndRender({ notify: false }).catch(() => null);
  });

  rulesTableEl?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = text(target.getAttribute('data-action')).toLowerCase();
    const id = text(target.getAttribute('data-id'));
    if (!action || !id) return;
    if (action === 'toggle') {
      toggleRule(id);
      refreshAndRender({ notify: false }).catch(() => null);
      return;
    }
    if (action === 'delete') {
      deleteRule(id);
      refreshAndRender({ notify: false }).catch(() => null);
      return;
    }
    if (action === 'run') {
      runSingleRuleScan().catch((error) => setStatus(text(error?.message, 'Rule scan failed.'), false));
    }
  });

  feedTableEl?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = text(target.getAttribute('data-action')).toLowerCase();
    const id = text(target.getAttribute('data-id'));
    if (action === 'open-feed' && id) {
      window.open(`property-details.html?id=${encodeURIComponent(id)}`, '_blank', 'noopener,noreferrer');
    }
  });

  writePrefsToUi();
  fillSelectOptions()
    .then(() => refreshAndRender({ notify: false }))
    .then(() => setupAutoTimer())
    .catch((error) => setStatus(text(error?.message, 'Unable to load smart alerts.'), false));
})();
