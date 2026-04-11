(() => {
  if (document.getElementById('adminAuctionControlCenter')) return;

  const live = window.PropertySetuLive || {};
  const path = String(window.location.pathname || '').toLowerCase();
  const isAdminPage = path.includes('admin-dashboard') || Boolean(document.getElementById('adminOverview'));
  if (!isAdminPage) return;

  const CARD_ID = 'adminAuctionControlCenter';
  const STYLE_ID = 'admin-auction-control-center-style';
  const LISTINGS_KEY = 'propertySetu:listings';
  const AUCTION_STATE_KEY = 'propertySetu:auctionState';
  const AUCTION_BIDS_KEY = 'propertySetu:auctionBids';
  const AUCTION_WATCHLIST_KEY = 'propertySetu:auctionWatchlist';
  const PREF_KEY = 'propertySetu:auctionAdminPrefs';
  const AUDIT_KEY = 'propertySetu:auctionAdminAudit';

  const text = (value, fallback = '') => {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  };

  const numberFrom = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const toEpoch = (value) => {
    const ts = new Date(value || '').getTime();
    return Number.isFinite(ts) ? ts : 0;
  };

  const nowIso = () => new Date().toISOString();

  const inr = (value) => `Rs ${Math.round(numberFrom(value, 0)).toLocaleString('en-IN')}`;

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

  const getAdminToken = () => {
    if (typeof live.getToken === 'function') {
      return text(live.getToken('admin') || live.getToken());
    }
    if (typeof live.getAnyToken === 'function') {
      return text(live.getAnyToken());
    }
    return '';
  };
  const isCorePropertyId = (value) => /^[a-f0-9]{24}$/i.test(text(value));

  const getAdminName = () => {
    if (typeof live.getSession === 'function') {
      const session = live.getSession('admin');
      if (session?.name) return text(session.name);
    }
    if (typeof live.getAnySession === 'function') {
      const session = live.getAnySession();
      if (session?.name) return text(session.name);
    }
    const local = readJson('propertysetu-admin-session', null);
    return text(local?.name, 'Admin');
  };

  const pushNotification = (title, message, audience = ['admin'], type = 'info') => {
    if (!title || !message) return;
    if (window.PropertySetuNotify && typeof window.PropertySetuNotify.emit === 'function') {
      window.PropertySetuNotify.emit({ title, message, audience, type });
      return;
    }
    const items = readJson('propertySetu:notifications', []);
    const rows = Array.isArray(items) ? items : [];
    rows.unshift({
      id: `auction-admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      message,
      audience,
      type,
      createdAt: nowIso(),
      readBy: {},
    });
    writeJson('propertySetu:notifications', rows.slice(0, 600));
  };

  const defaultPrefs = {
    query: '',
    status: 'all',
    minBids: 0,
    riskOnly: false,
    autoSec: 20,
  };

  const getPrefs = () => {
    const value = readJson(PREF_KEY, {});
    return {
      query: text(value?.query),
      status: text(value?.status, 'all').toLowerCase(),
      minBids: Math.max(0, Math.round(numberFrom(value?.minBids, 0))),
      riskOnly: Boolean(value?.riskOnly),
      autoSec: clamp(Math.round(numberFrom(value?.autoSec, 20)), 0, 180),
    };
  };

  const setPrefs = (next) => {
    writeJson(PREF_KEY, { ...defaultPrefs, ...getPrefs(), ...(next || {}) });
  };

  const getAuctionState = () => {
    const map = readJson(AUCTION_STATE_KEY, {});
    return map && typeof map === 'object' ? map : {};
  };

  const setAuctionState = (value) => {
    writeJson(AUCTION_STATE_KEY, value && typeof value === 'object' ? value : {});
  };

  const normalizeBid = (item = {}) => {
    const id = text(item.id);
    const propertyId = text(item.propertyId);
    if (!id || !propertyId) return null;
    return {
      id,
      propertyId,
      bidderId: text(item.bidderId, 'unknown'),
      bidderName: text(item.bidderName, 'Bidder'),
      bidderRole: text(item.bidderRole, 'buyer'),
      amount: Math.max(0, Math.round(numberFrom(item.amount, 0))),
      source: text(item.source, 'local'),
      createdAt: text(item.createdAt, nowIso()),
    };
  };

  const getAllBids = () => {
    const rows = readJson(AUCTION_BIDS_KEY, []);
    return (Array.isArray(rows) ? rows : [])
      .map((item) => normalizeBid(item))
      .filter(Boolean)
      .sort((a, b) => {
        const diff = numberFrom(b.amount, 0) - numberFrom(a.amount, 0);
        if (diff !== 0) return diff;
        return toEpoch(a.createdAt) - toEpoch(b.createdAt);
      });
  };

  const saveAllBids = (rows) => {
    const normalized = Array.isArray(rows) ? rows : [];
    writeJson(AUCTION_BIDS_KEY, normalized.slice(0, 5000));
  };

  const getWatchSet = () => {
    const rows = readJson(AUCTION_WATCHLIST_KEY, []);
    const set = new Set();
    (Array.isArray(rows) ? rows : []).forEach((id) => {
      const normalized = text(id);
      if (normalized) set.add(normalized);
    });
    return set;
  };

  const getListingMap = () => {
    const rows = readJson(LISTINGS_KEY, []);
    const map = new Map();
    (Array.isArray(rows) ? rows : []).forEach((item) => {
      const id = text(item?.id || item?._id);
      if (!id) return;
      map.set(id, {
        id,
        title: text(item?.title, id),
        city: text(item?.city, 'Udaipur'),
        location: text(item?.location || item?.locality, 'Udaipur'),
        ownerId: text(item?.ownerId || item?.userId || item?.owner?.id),
        price: Math.max(0, Math.round(numberFrom(item?.price, 0))),
      });
    });
    return map;
  };

  const getAudit = () => {
    const rows = readJson(AUDIT_KEY, []);
    return Array.isArray(rows) ? rows : [];
  };

  const pushAudit = (entry = {}) => {
    const rows = getAudit();
    rows.unshift({
      id: `auction-admin-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: nowIso(),
      by: getAdminName(),
      type: text(entry.type, 'info'),
      propertyId: text(entry.propertyId),
      propertyTitle: text(entry.propertyTitle),
      message: text(entry.message),
    });
    writeJson(AUDIT_KEY, rows.slice(0, 400));
  };

  const normalizeLiveBid = (item = {}, propertyId = '') => {
    const id = text(item?.id || item?._id);
    const resolvedPropertyId = text(item?.propertyId || propertyId);
    if (!id || !resolvedPropertyId) return null;
    return {
      id,
      propertyId: resolvedPropertyId,
      bidderId: text(item?.bidderId),
      bidderName: text(item?.bidderName, 'Bidder'),
      bidderRole: text(item?.bidderRole, 'buyer'),
      amount: Math.max(0, Math.round(numberFrom(item?.amount, 0))),
      source: 'live',
      createdAt: text(item?.createdAt, nowIso()),
    };
  };

  const deriveLocalAuctionStatusFromLive = (status = '') => {
    const raw = text(status).toLowerCase();
    if (raw === 'accepted' || raw === 'revealed') return 'settled';
    if (raw === 'rejected-all') return 'closed';
    return 'live';
  };

  const syncLiveAuctionBoard = async () => {
    const token = getAdminToken();
    if (!token || typeof live.request !== 'function') return false;

    try {
      const response = await live.request('/sealed-bids/admin?limit=3000', { token });
      const items = Array.isArray(response?.items) ? response.items : [];
      if (!items.length) return false;

      const existingBids = getAllBids();
      const bidMap = new Map();
      existingBids.forEach((row) => {
        if (!row?.id) return;
        bidMap.set(row.id, row);
      });

      const listingLookup = getListingMap();
      const existingAuctionState = getAuctionState();
      const nextAuctionState = { ...existingAuctionState };

      items.forEach((group) => {
        const propertyId = text(group?.propertyId);
        if (!propertyId) return;

        const liveBids = Array.isArray(group?.bids) ? group.bids : [];
        liveBids
          .map((row) => normalizeLiveBid(row, propertyId))
          .filter(Boolean)
          .forEach((row) => {
            bidMap.set(row.id, row);
          });

        const listing = listingLookup.get(propertyId) || {};
        const current = nextAuctionState[propertyId] && typeof nextAuctionState[propertyId] === 'object'
          ? { ...nextAuctionState[propertyId] }
          : {};
        const winnerBid = group?.winnerBid && typeof group.winnerBid === 'object'
          ? group.winnerBid
          : null;

        nextAuctionState[propertyId] = {
          propertyId,
          reservePrice: Math.max(
            1000,
            Math.round(numberFrom(current.reservePrice, numberFrom(listing?.price, 0) * 0.9))
          ),
          closesAt: text(
            current.closesAt,
            new Date(Date.now() + 72 * 3600000).toISOString()
          ),
          status: deriveLocalAuctionStatusFromLive(group?.status),
          updatedAt: nowIso(),
          ...(winnerBid
            ? {
                winnerBidId: text(winnerBid.id || winnerBid._id),
                winnerBidAmount: Math.max(0, Math.round(numberFrom(winnerBid.amount, 0))),
                winnerBidderId: text(winnerBid.bidderId),
                winnerBidderName: text(winnerBid.bidderName),
                winnerAcceptedAt: text(winnerBid.decisionAt || winnerBid.updatedAt || winnerBid.createdAt || nowIso()),
              }
            : {}),
        };
      });

      setAuctionState(nextAuctionState);
      saveAllBids([...bidMap.values()]);
      return true;
    } catch {
      return false;
    }
  };

  const statusLabel = (value) => {
    const raw = text(value).toLowerCase();
    if (raw === 'live') return 'Live';
    if (raw === 'closed') return 'Closed';
    if (raw === 'settled') return 'Settled';
    if (raw === 'cancelled') return 'Cancelled';
    return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Unknown';
  };

  const deriveStatus = (auction, highestBid) => {
    const raw = text(auction?.status, 'live').toLowerCase();
    if (raw === 'settled') return 'settled';
    if (raw === 'cancelled') return 'cancelled';
    if (raw === 'closed') return highestBid && auction?.winnerBidId ? 'settled' : 'closed';
    const closeEpoch = toEpoch(auction?.closesAt);
    if (closeEpoch > 0 && closeEpoch <= Date.now()) return highestBid && auction?.winnerBidId ? 'settled' : 'closed';
    return 'live';
  };

  const buildRows = () => {
    const listingMap = getListingMap();
    const auctionMap = getAuctionState();
    const bids = getAllBids();
    const watchSet = getWatchSet();

    const propertyIds = new Set();
    Object.keys(auctionMap || {}).forEach((id) => propertyIds.add(text(id)));
    bids.forEach((bid) => propertyIds.add(text(bid.propertyId)));

    const rows = [];
    propertyIds.forEach((propertyId) => {
      if (!propertyId) return;
      const listing = listingMap.get(propertyId) || {
        id: propertyId,
        title: propertyId,
        city: 'Udaipur',
        location: 'Udaipur',
        ownerId: '',
        price: 0,
      };

      const auction = auctionMap[propertyId] || {
        propertyId,
        reservePrice: Math.max(1000, Math.round(numberFrom(listing.price, 0) * 0.9)),
        closesAt: new Date(Date.now() + 72 * 3600000).toISOString(),
        status: 'live',
      };

      const bidRows = bids.filter((item) => item.propertyId === propertyId);
      const highestBid = bidRows[0] || null;
      const secondBid = bidRows[1] || null;
      const lastBidAt = highestBid ? highestBid.createdAt : '';
      const closeEpoch = toEpoch(auction?.closesAt);
      const hoursLeft = closeEpoch > 0 ? (closeEpoch - Date.now()) / 3600000 : 0;
      const top24h = bidRows.filter((item) => Date.now() - toEpoch(item.createdAt) <= 24 * 3600000).length;
      const uniqueBidders = Array.from(new Set(bidRows.map((item) => item.bidderId))).length;

      const reservePrice = Math.max(0, Math.round(numberFrom(auction?.reservePrice, listing.price || 0)));
      const reserveGap = highestBid ? reservePrice - highestBid.amount : reservePrice;

      const flags = [];
      let riskScore = 0;
      if (deriveStatus(auction, highestBid) === 'live' && hoursLeft > 0 && hoursLeft <= 3) {
        flags.push('Closing under 3h');
        riskScore += 1;
      }
      if (deriveStatus(auction, highestBid) === 'live' && bidRows.length === 0) {
        flags.push('No bids yet');
        riskScore += 1;
      }
      if (reserveGap > 0 && bidRows.length) {
        flags.push('Reserve not met');
        riskScore += 2;
      }
      if (top24h >= 6) {
        flags.push('High bid velocity');
        riskScore += 2;
      }
      if (deriveStatus(auction, highestBid) === 'live' && lastBidAt && Date.now() - toEpoch(lastBidAt) >= 48 * 3600000) {
        flags.push('Stale >48h');
        riskScore += 1;
      }
      if (highestBid && secondBid && highestBid.amount >= secondBid.amount * 1.75) {
        flags.push('Top bid outlier');
        riskScore += 1;
      }

      rows.push({
        propertyId,
        propertyTitle: listing.title,
        city: listing.city,
        location: listing.location,
        ownerId: listing.ownerId,
        reservePrice,
        closesAt: text(auction?.closesAt),
        auctionStatus: deriveStatus(auction, highestBid),
        auctionRawStatus: text(auction?.status, 'live').toLowerCase(),
        totalBids: bidRows.length,
        uniqueBidders,
        highestBid,
        secondBid,
        highestAmount: highestBid ? highestBid.amount : 0,
        reserveGap,
        top24h,
        lastBidAt,
        winnerBidId: text(auction?.winnerBidId),
        winnerAcceptedAt: text(auction?.winnerAcceptedAt),
        bidRows,
        flags,
        riskScore,
        isWatch: watchSet.has(propertyId),
      });
    });

    return rows.sort((a, b) => {
      const riskDiff = b.riskScore - a.riskScore;
      if (riskDiff !== 0) return riskDiff;
      const amountDiff = b.highestAmount - a.highestAmount;
      if (amountDiff !== 0) return amountDiff;
      return toEpoch(b.lastBidAt) - toEpoch(a.lastBidAt);
    });
  };

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${CARD_ID}{margin-top:16px}
#${CARD_ID} .aacc-card{border:1px solid #d6e1f5;border-radius:10px;background:#fff;padding:10px}
#${CARD_ID} .aacc-grid{display:grid;gap:10px}
#${CARD_ID} .aacc-grid.cols{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}
#${CARD_ID} label{display:block;font-size:12px;color:#35597d;margin-bottom:4px}
#${CARD_ID} input,#${CARD_ID} select{width:100%;border:1px solid #cad9ef;border-radius:8px;padding:8px 10px;box-sizing:border-box}
#${CARD_ID} .aacc-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
#${CARD_ID} .aacc-btn{border:1px solid #0b3d91;background:#0b3d91;color:#fff;border-radius:8px;padding:8px 12px;cursor:pointer;font-weight:700}
#${CARD_ID} .aacc-btn.alt{background:#fff;color:#0b3d91}
#${CARD_ID} .aacc-btn.warn{background:#8d1e1e;border-color:#8d1e1e}
#${CARD_ID} .aacc-status{margin:8px 0 0;color:#1d4068}
#${CARD_ID} .aacc-kpis{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-top:10px}
#${CARD_ID} .aacc-kpi{border:1px solid #d6e1f5;border-radius:8px;background:#f8fbff;padding:8px}
#${CARD_ID} .aacc-kpi small{display:block;color:#58718f}
#${CARD_ID} .aacc-kpi b{color:#11466e}
#${CARD_ID} table{width:100%;border-collapse:collapse}
#${CARD_ID} th,#${CARD_ID} td{border:1px solid #d6e1f5;padding:8px;text-align:left;vertical-align:top}
#${CARD_ID} th{background:#f4f8ff;color:#11466e}
#${CARD_ID} .aacc-chip{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;margin:2px 6px 2px 0;background:#e9f0ff;color:#1f3e7a}
#${CARD_ID} .aacc-chip.live{background:#e2f7e8;color:#1f6d3d}
#${CARD_ID} .aacc-chip.closed{background:#ffeaea;color:#8d1e1e}
#${CARD_ID} .aacc-chip.settled{background:#e8f7ef;color:#10623e}
#${CARD_ID} .aacc-chip.risk{background:#fff4cc;color:#7a4e00}
#${CARD_ID} .aacc-audit{max-height:210px;overflow:auto}
#${CARD_ID} .aacc-audit-item{border-bottom:1px solid #e1e9f8;padding:7px 0;color:#325176;font-size:13px}
@media (max-width:768px){#${CARD_ID} .aacc-row{display:grid;grid-template-columns:1fr}}
`;
    document.head.appendChild(style);
  }

  const shell = document.createElement('section');
  shell.id = CARD_ID;
  shell.className = 'container';
  shell.innerHTML = `
<div class="aacc-card">
  <h2 style="margin:0 0 8px;">Admin Auction Control Center</h2>
  <p style="margin:0;color:#1d4068;">Auction governance: live board, settlement decisions, close/reopen controls, and audit tracking.</p>
</div>

<div class="aacc-card" style="margin-top:10px;">
  <div class="aacc-grid cols">
    <div><label for="aaccQuery">Search</label><input id="aaccQuery" placeholder="Property title or id" /></div>
    <div><label for="aaccStatusFilter">Status</label><select id="aaccStatusFilter"><option value="all">All</option><option value="live">Live</option><option value="closed">Closed</option><option value="settled">Settled</option><option value="cancelled">Cancelled</option></select></div>
    <div><label for="aaccMinBids">Min Bids</label><input id="aaccMinBids" type="number" min="0" max="100" step="1" /></div>
    <div><label for="aaccRiskOnly">Risk Only</label><select id="aaccRiskOnly"><option value="0">No</option><option value="1">Yes</option></select></div>
    <div><label for="aaccAutoSec">Auto Refresh sec</label><input id="aaccAutoSec" type="number" min="0" max="180" step="5" /></div>
  </div>
  <div class="aacc-row" style="margin-top:10px;">
    <button id="aaccRefreshBtn" class="aacc-btn" type="button">Refresh Board</button>
    <button id="aaccSaveFilterBtn" class="aacc-btn alt" type="button">Save Filters</button>
    <button id="aaccCsvBtn" class="aacc-btn alt" type="button">Export CSV</button>
    <button id="aaccClearAuditBtn" class="aacc-btn warn" type="button">Clear Audit</button>
    <span id="aaccStatus" class="aacc-chip">Ready</span>
  </div>
</div>

<div class="aacc-card" style="margin-top:10px;">
  <h3 style="margin:0 0 8px;">Quick Decision</h3>
  <div class="aacc-row">
    <input id="aaccPropertyId" placeholder="Property ID" style="flex:1 1 160px;" />
    <select id="aaccAction" style="min-width:180px;"><option value="close">Close Auction</option><option value="reopen">Reopen +24h</option><option value="extend">Extend +24h</option><option value="settle">Settle Winner</option><option value="clear-settle">Clear Settlement</option><option value="set-reserve">Set Reserve</option></select>
    <input id="aaccNote" placeholder="Admin note" style="flex:1 1 220px;" />
    <button id="aaccApplyBtn" class="aacc-btn" type="button">Apply</button>
  </div>
</div>

<div id="aaccKpis" class="aacc-kpis"></div>

<div class="aacc-card" style="margin-top:10px;">
  <h3 style="margin:0 0 8px;">Auction Board</h3>
  <div id="aaccBoard" style="overflow:auto;"></div>
</div>

<div class="aacc-card" style="margin-top:10px;">
  <h3 style="margin:0 0 8px;">Bid Detail</h3>
  <div id="aaccDetail" style="overflow:auto;color:#325176;">Select a property from board.</div>
</div>

<div class="aacc-card" style="margin-top:10px;">
  <h3 style="margin:0 0 8px;">Auction Admin Audit</h3>
  <div id="aaccAudit" class="aacc-audit"></div>
</div>
`;

  const anchor = document.getElementById('adminV3ToolsPanel');
  if (anchor?.parentElement) {
    anchor.parentElement.insertBefore(shell, anchor.nextSibling);
  } else {
    document.body.appendChild(shell);
  }

  const ui = {
    query: document.getElementById('aaccQuery'),
    statusFilter: document.getElementById('aaccStatusFilter'),
    minBids: document.getElementById('aaccMinBids'),
    riskOnly: document.getElementById('aaccRiskOnly'),
    autoSec: document.getElementById('aaccAutoSec'),
    refreshBtn: document.getElementById('aaccRefreshBtn'),
    saveFilterBtn: document.getElementById('aaccSaveFilterBtn'),
    csvBtn: document.getElementById('aaccCsvBtn'),
    clearAuditBtn: document.getElementById('aaccClearAuditBtn'),
    status: document.getElementById('aaccStatus'),
    propertyId: document.getElementById('aaccPropertyId'),
    action: document.getElementById('aaccAction'),
    note: document.getElementById('aaccNote'),
    applyBtn: document.getElementById('aaccApplyBtn'),
    kpis: document.getElementById('aaccKpis'),
    board: document.getElementById('aaccBoard'),
    detail: document.getElementById('aaccDetail'),
    audit: document.getElementById('aaccAudit'),
  };

  const state = {
    rows: [],
    selectedPropertyId: '',
    autoTimer: null,
  };

  const setStatus = (message, ok = true) => {
    if (!ui.status) return;
    ui.status.textContent = text(message);
    ui.status.style.color = ok ? '#1d4068' : '#8d1e1e';
  };

  const readControls = () => ({
    query: text(ui.query?.value).toLowerCase(),
    status: text(ui.statusFilter?.value, 'all').toLowerCase(),
    minBids: Math.max(0, Math.round(numberFrom(ui.minBids?.value, 0))),
    riskOnly: text(ui.riskOnly?.value) === '1',
    autoSec: clamp(Math.round(numberFrom(ui.autoSec?.value, 20)), 0, 180),
  });

  const applyPrefsToControls = () => {
    const pref = getPrefs();
    if (ui.query) ui.query.value = pref.query;
    if (ui.statusFilter) ui.statusFilter.value = pref.status;
    if (ui.minBids) ui.minBids.value = String(pref.minBids);
    if (ui.riskOnly) ui.riskOnly.value = pref.riskOnly ? '1' : '0';
    if (ui.autoSec) ui.autoSec.value = String(pref.autoSec);
  };

  const filterRows = (rows) => {
    const pref = readControls();
    return rows.filter((row) => {
      if (pref.status !== 'all' && row.auctionStatus !== pref.status) return false;
      if (row.totalBids < pref.minBids) return false;
      if (pref.riskOnly && row.flags.length === 0) return false;
      if (!pref.query) return true;
      return (
        row.propertyTitle.toLowerCase().includes(pref.query)
        || row.propertyId.toLowerCase().includes(pref.query)
        || row.city.toLowerCase().includes(pref.query)
      );
    });
  };

  const renderKpis = (rows) => {
    if (!ui.kpis) return;
    const total = rows.length;
    const liveCount = rows.filter((row) => row.auctionStatus === 'live').length;
    const closedCount = rows.filter((row) => row.auctionStatus === 'closed').length;
    const settledCount = rows.filter((row) => row.auctionStatus === 'settled').length;
    const bidTotal = rows.reduce((sum, row) => sum + row.totalBids, 0);
    const highRisk = rows.filter((row) => row.riskScore >= 2).length;

    const cards = [
      ['Auctions', total],
      ['Live', liveCount],
      ['Closed', closedCount],
      ['Settled', settledCount],
      ['Total Bids', bidTotal],
      ['High Risk', highRisk],
    ];

    ui.kpis.innerHTML = cards.map(([label, value]) => `
<div class="aacc-kpi">
  <small>${escapeHtml(String(label))}</small>
  <b>${escapeHtml(String(value))}</b>
</div>`).join('');
  };

  const renderAudit = () => {
    if (!ui.audit) return;
    const rows = getAudit();
    if (!rows.length) {
      ui.audit.innerHTML = '<p style="margin:0;color:#607da8;">No auction admin audit entries.</p>';
      return;
    }
    ui.audit.innerHTML = rows.slice(0, 30).map((row) => `
<div class="aacc-audit-item">
  <b>${escapeHtml(statusLabel(row.type))}</b> - ${escapeHtml(text(row.propertyTitle, row.propertyId))}<br>
  ${escapeHtml(row.message)}<br>
  <span style="color:#6d86a5;">${escapeHtml(new Date(row.at).toLocaleString('en-IN'))} | ${escapeHtml(text(row.by, 'Admin'))}</span>
</div>`).join('');
  };

  const renderDetail = (propertyId) => {
    if (!ui.detail) return;
    const row = state.rows.find((item) => item.propertyId === propertyId);
    if (!row) {
      ui.detail.innerHTML = '<p style="margin:0;color:#607da8;">Select a property from board.</p>';
      return;
    }

    ui.detail.innerHTML = `
<div style="margin-bottom:8px;">
  <b>${escapeHtml(row.propertyTitle)}</b> (${escapeHtml(row.propertyId)})<br>
  Status: <b>${escapeHtml(statusLabel(row.auctionStatus))}</b> | Reserve: <b>${inr(row.reservePrice)}</b>
</div>
<div style="overflow:auto;">
  <table>
    <thead><tr><th>#</th><th>Bidder</th><th>Role</th><th>Amount</th><th>Time</th><th>Source</th></tr></thead>
    <tbody>
      ${row.bidRows.map((bid, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(bid.bidderName)}</td>
        <td>${escapeHtml(bid.bidderRole)}</td>
        <td>${inr(bid.amount)}</td>
        <td>${escapeHtml(new Date(bid.createdAt).toLocaleString('en-IN'))}</td>
        <td>${escapeHtml(bid.source)}</td>
      </tr>
      `).join('') || '<tr><td colspan="6">No bids.</td></tr>'}
    </tbody>
  </table>
</div>`;
  };

  const renderBoard = (rows) => {
    if (!ui.board) return;
    if (!rows.length) {
      ui.board.innerHTML = '<p style="margin:0;color:#607da8;">No auctions match current filters.</p>';
      return;
    }

    ui.board.innerHTML = `
<table>
  <thead>
    <tr>
      <th>Property</th>
      <th>Status</th>
      <th>Bids</th>
      <th>Top / Reserve</th>
      <th>Signals</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    ${rows.map((row) => `
    <tr>
      <td>
        <b>${escapeHtml(row.propertyTitle)}</b><br>
        ${escapeHtml(row.propertyId)}<br>
        <span style="color:#55739c;">${escapeHtml(row.location)}, ${escapeHtml(row.city)}</span>
      </td>
      <td>
        <span class="aacc-chip ${escapeHtml(row.auctionStatus)}">${escapeHtml(statusLabel(row.auctionStatus))}</span>
        ${row.isWatch ? '<span class="aacc-chip risk">Watchlist</span>' : ''}
      </td>
      <td>
        Total ${row.totalBids}<br>
        Bidders ${row.uniqueBidders}<br>
        24h ${row.top24h}
      </td>
      <td>
        ${row.highestBid ? `${inr(row.highestBid.amount)}` : '-'}<br>
        Reserve ${inr(row.reservePrice)}<br>
        ${row.reserveGap > 0 ? `Gap ${inr(row.reserveGap)}` : 'Reserve met'}
      </td>
      <td>
        ${row.flags.length ? row.flags.map((flag) => `<span class="aacc-chip risk">${escapeHtml(flag)}</span>`).join('') : '<span style="color:#1f6d3d;">Normal</span>'}
      </td>
      <td>
        <div class="aacc-row" style="gap:6px;">
          <button class="aacc-btn alt" data-action="details" data-property-id="${escapeHtml(row.propertyId)}" type="button">Details</button>
          <button class="aacc-btn alt" data-action="settle" data-property-id="${escapeHtml(row.propertyId)}" type="button">Settle</button>
          <button class="aacc-btn alt" data-action="close" data-property-id="${escapeHtml(row.propertyId)}" type="button">Close</button>
          <button class="aacc-btn alt" data-action="reopen" data-property-id="${escapeHtml(row.propertyId)}" type="button">Reopen</button>
        </div>
      </td>
    </tr>
    `).join('')}
  </tbody>
</table>`;
  };

  const exportCsv = (rows) => {
    const header = ['propertyId', 'propertyTitle', 'status', 'totalBids', 'uniqueBidders', 'highestBid', 'reservePrice', 'reserveGap', 'top24h', 'riskScore', 'flags'];
    const lines = rows.map((row) => [
      row.propertyId,
      row.propertyTitle,
      row.auctionStatus,
      row.totalBids,
      row.uniqueBidders,
      row.highestAmount,
      row.reservePrice,
      row.reserveGap,
      row.top24h,
      row.riskScore,
      row.flags.join(' | '),
    ].map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','));

    const csv = `${header.join(',')}\n${lines.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `admin-auction-board-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const applyLocalAction = (propertyId, action, note = '') => {
    const id = text(propertyId);
    if (!id) return { ok: false, message: 'Property ID required.' };

    const rows = buildRows();
    const row = rows.find((item) => item.propertyId === id);
    if (!row) return { ok: false, message: 'Property not found in auction board.' };

    const map = getAuctionState();
    const current = map[id] || {
      propertyId: id,
      reservePrice: row.reservePrice,
      closesAt: new Date(Date.now() + 72 * 3600000).toISOString(),
      status: 'live',
    };

    let message = '';
    const lowerAction = text(action).toLowerCase();

    if (lowerAction === 'close') {
      current.status = 'closed';
      current.closesAt = nowIso();
      current.updatedAt = nowIso();
      message = 'Auction closed by admin.';
    } else if (lowerAction === 'reopen') {
      current.status = 'live';
      current.closesAt = new Date(Date.now() + 24 * 3600000).toISOString();
      current.updatedAt = nowIso();
      message = 'Auction reopened for 24h.';
    } else if (lowerAction === 'extend') {
      const base = Math.max(Date.now(), toEpoch(current.closesAt));
      current.status = 'live';
      current.closesAt = new Date(base + 24 * 3600000).toISOString();
      current.updatedAt = nowIso();
      message = 'Auction extended by 24h.';
    } else if (lowerAction === 'settle') {
      const top = row.highestBid;
      if (!top) return { ok: false, message: 'No bids available to settle.' };
      current.status = 'settled';
      current.winnerBidId = top.id;
      current.winnerBidAmount = top.amount;
      current.winnerBidderId = top.bidderId;
      current.winnerBidderName = top.bidderName;
      current.winnerAcceptedAt = nowIso();
      current.updatedAt = nowIso();
      message = `Winner settled at ${inr(top.amount)} (${top.bidderName}).`;
    } else if (lowerAction === 'clear-settle') {
      delete current.winnerBidId;
      delete current.winnerBidAmount;
      delete current.winnerBidderId;
      delete current.winnerBidderName;
      delete current.winnerAcceptedAt;
      current.status = toEpoch(current.closesAt) > Date.now() ? 'live' : 'closed';
      current.updatedAt = nowIso();
      message = 'Settlement cleared.';
    } else if (lowerAction === 'set-reserve') {
      const proposed = window.prompt('Enter new reserve price (INR):', String(current.reservePrice || row.reservePrice || 0));
      if (proposed === null) return { ok: false, message: 'Reserve update cancelled.' };
      const reserve = Math.max(1000, Math.round(numberFrom(proposed, 0)));
      current.reservePrice = reserve;
      current.updatedAt = nowIso();
      message = `Reserve updated to ${inr(reserve)}.`;
    } else {
      return { ok: false, message: 'Unknown action.' };
    }

    map[id] = current;
    setAuctionState(map);

    const auditMessage = `${message}${note ? ` Note: ${note}` : ''}`;
    pushAudit({
      type: lowerAction,
      propertyId: id,
      propertyTitle: row.propertyTitle,
      message: auditMessage,
    });

    pushNotification('Auction Admin Action', `${row.propertyTitle}: ${message}`, ['admin', 'seller', 'customer'], 'info');
    return { ok: true, message };
  };

  const applyLiveAction = async (propertyId, action, note = '') => {
    const id = text(propertyId);
    const lowerAction = text(action).toLowerCase();
    const token = getAdminToken();
    if (!id) return { ok: false, message: 'Property ID required.' };
    if (!token || typeof live.request !== 'function') return { ok: false, message: 'Admin live token required.' };
    if (!isCorePropertyId(id)) return { ok: false, message: 'Live action requires real property id.' };

    if (lowerAction !== 'settle') {
      return { ok: false, message: 'Selected action is not supported on live sealed-bid API.' };
    }

    const decisionReason = text(
      note,
      'Admin settlement from auction control center after sealed bid review.'
    );

    const response = await live.request('/sealed-bids/decision', {
      method: 'POST',
      token,
      data: {
        propertyId: id,
        action: 'accept',
        decisionReason,
        decisionConfirm: true,
      },
    });

    const apiAction = text(response?.action).toLowerCase();
    const requiresSecondAdmin = Boolean(response?.requiresSecondAdmin);
    const message = requiresSecondAdmin || apiAction.endsWith('-requested')
      ? 'Settlement request recorded. Second admin confirmation required.'
      : text(response?.message, 'Live settlement applied.');

    pushAudit({
      type: requiresSecondAdmin ? 'settle-requested-live' : 'settle-live',
      propertyId: id,
      propertyTitle: text(response?.propertyTitle, id),
      message: `${message}${decisionReason ? ` Note: ${decisionReason}` : ''}`,
    });
    pushNotification(
      'Auction Admin Action',
      `${text(response?.propertyTitle, id)}: ${message}`,
      ['admin', 'seller', 'customer'],
      requiresSecondAdmin ? 'warn' : 'success'
    );

    return { ok: true, message };
  };

  const refresh = async () => {
    await syncLiveAuctionBoard();
    state.rows = buildRows();
    const filtered = filterRows(state.rows);
    renderKpis(filtered);
    renderBoard(filtered);
    if (state.selectedPropertyId) renderDetail(state.selectedPropertyId);
    renderAudit();
    setStatus(`Board refreshed (${filtered.length} auctions).`);
  };

  const setAutoRefresh = (seconds) => {
    if (state.autoTimer) {
      clearInterval(state.autoTimer);
      state.autoTimer = null;
    }
    const sec = Math.max(0, Math.round(numberFrom(seconds, 0)));
    if (sec > 0) {
      state.autoTimer = setInterval(() => {
        refresh().catch(() => {});
      }, sec * 1000);
    }
  };

  ui.refreshBtn?.addEventListener('click', () => {
    refresh().catch((error) => setStatus(text(error?.message, 'Refresh failed.'), false));
  });

  ui.saveFilterBtn?.addEventListener('click', () => {
    const pref = readControls();
    setPrefs(pref);
    setAutoRefresh(pref.autoSec);
    refresh().catch((error) => setStatus(text(error?.message, 'Refresh failed.'), false));
    setStatus('Filters saved.');
  });

  ui.csvBtn?.addEventListener('click', () => {
    const filtered = filterRows(state.rows);
    exportCsv(filtered);
    setStatus(`CSV exported (${filtered.length} rows).`);
  });

  ui.clearAuditBtn?.addEventListener('click', () => {
    if (!window.confirm('Clear auction admin audit trail?')) return;
    writeJson(AUDIT_KEY, []);
    renderAudit();
    setStatus('Auction audit cleared.');
  });

  ui.applyBtn?.addEventListener('click', async () => {
    const propertyId = text(ui.propertyId?.value);
    const action = text(ui.action?.value).toLowerCase();
    const note = text(ui.note?.value);
    if (action === 'settle') {
      try {
        const liveResult = await applyLiveAction(propertyId, action, note);
        if (!liveResult.ok) {
          const fallback = applyLocalAction(propertyId, action, note);
          if (!fallback.ok) {
            setStatus(liveResult.message, false);
            return;
          }
          setStatus(fallback.message);
        } else {
          setStatus(liveResult.message);
        }
      } catch (error) {
        setStatus(text(error?.message, 'Live settle failed.'), false);
        return;
      }
    } else {
      const result = applyLocalAction(propertyId, action, note);
      if (!result.ok) {
        setStatus(result.message, false);
        return;
      }
      setStatus(result.message);
    }
    state.selectedPropertyId = propertyId;
    refresh().catch((error) => setStatus(text(error?.message, 'Refresh failed.'), false));
  });

  ui.board?.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = text(target.getAttribute('data-action')).toLowerCase();
    const propertyId = text(target.getAttribute('data-property-id'));
    if (!action || !propertyId) return;

    if (ui.propertyId) ui.propertyId.value = propertyId;
    state.selectedPropertyId = propertyId;

    if (action === 'details') {
      renderDetail(propertyId);
      return;
    }

    if (action === 'settle') {
      try {
        const liveResult = await applyLiveAction(propertyId, action, text(ui.note?.value));
        if (!liveResult.ok) {
          const fallback = applyLocalAction(propertyId, action, text(ui.note?.value));
          if (!fallback.ok) {
            setStatus(liveResult.message, false);
            return;
          }
          setStatus(fallback.message);
        } else {
          setStatus(liveResult.message);
        }
      } catch (error) {
        setStatus(text(error?.message, 'Live settle failed.'), false);
        return;
      }
    } else {
      const result = applyLocalAction(propertyId, action, text(ui.note?.value));
      if (!result.ok) {
        setStatus(result.message, false);
        return;
      }
      setStatus(result.message);
    }
    refresh().catch((error) => setStatus(text(error?.message, 'Refresh failed.'), false));
  });

  [ui.query, ui.statusFilter, ui.minBids, ui.riskOnly].forEach((element) => {
    element?.addEventListener('input', () => {
      refresh().catch((error) => setStatus(text(error?.message, 'Refresh failed.'), false));
    });
    element?.addEventListener('change', () => {
      refresh().catch((error) => setStatus(text(error?.message, 'Refresh failed.'), false));
    });
  });

  ui.autoSec?.addEventListener('change', () => {
    const sec = clamp(Math.round(numberFrom(ui.autoSec?.value, 20)), 0, 180);
    setAutoRefresh(sec);
    setStatus(sec > 0 ? `Auto refresh enabled (${sec}s).` : 'Auto refresh disabled.');
  });

  applyPrefsToControls();
  const pref = getPrefs();
  setAutoRefresh(pref.autoSec);
  refresh().catch((error) => setStatus(text(error?.message, 'Refresh failed.'), false));

  window.addEventListener('beforeunload', () => {
    if (state.autoTimer) clearInterval(state.autoTimer);
  });
})();
