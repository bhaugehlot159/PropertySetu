(() => {
  if (document.getElementById('auctionUnifiedAnalyticsTimelineCard')) return;

  const live = window.PropertySetuLive || {};
  const path = String(window.location.pathname || '').toLowerCase();
  const isAdminPage = path.includes('admin-dashboard') || Boolean(document.getElementById('adminOverview'));
  if (!isAdminPage) return;

  const CARD_ID = 'auctionUnifiedAnalyticsTimelineCard';
  const STYLE_ID = 'auction-unified-analytics-timeline-style';
  const LISTINGS_KEY = 'propertySetu:listings';
  const AUCTION_STATE_KEY = 'propertySetu:auctionState';
  const AUCTION_BIDS_KEY = 'propertySetu:auctionBids';
  const CUSTOMER_AUDIT_KEY = 'propertySetu:auctionAudit';
  const SELLER_AUDIT_KEY = 'propertySetu:auctionSellerAudit';
  const ADMIN_AUDIT_KEY = 'propertySetu:auctionAdminAudit';
  const PREF_KEY = 'propertySetu:auctionUnifiedAnalyticsPrefs';

  const text = (value, fallback = '') => {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  };
  const numberFrom = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const epoch = (value) => {
    const ts = new Date(value || '').getTime();
    return Number.isFinite(ts) ? ts : 0;
  };
  const inr = (value) => `Rs ${Math.round(numberFrom(value, 0)).toLocaleString('en-IN')}`;
  const escapeHtml = (value) => (
    String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  );
  const dayKey = (value) => {
    const date = new Date(value || Date.now());
    if (Number.isNaN(date.getTime())) return '';
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString().slice(0, 10);
  };

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

  const getPrefs = () => {
    const current = readJson(PREF_KEY, {});
    return {
      query: text(current?.query),
      status: text(current?.status, 'all').toLowerCase(),
      minBids: Math.max(0, Math.round(numberFrom(current?.minBids, 0))),
      lookbackDays: clamp(Math.round(numberFrom(current?.lookbackDays, 30)), 7, 120),
      autoSec: clamp(Math.round(numberFrom(current?.autoSec, 30)), 0, 180),
    };
  };
  const setPrefs = (next) => {
    writeJson(PREF_KEY, { ...getPrefs(), ...(next || {}) });
  };

  const normalizeListing = (item = {}) => {
    const id = text(item?.id || item?._id);
    if (!id) return null;
    return {
      id,
      title: text(item?.title, id),
      city: text(item?.city, 'Udaipur'),
      location: text(item?.location || item?.locality, 'Udaipur'),
      ownerId: text(item?.ownerId || item?.userId || item?.owner?.id),
      price: Math.max(0, Math.round(numberFrom(item?.price, 0))),
    };
  };

  const listingMap = () => {
    const map = new Map();
    const rows = readJson(LISTINGS_KEY, []);
    (Array.isArray(rows) ? rows : [])
      .map((item) => normalizeListing(item))
      .filter(Boolean)
      .forEach((item) => map.set(item.id, item));
    return map;
  };

  const normalizeBid = (item = {}) => {
    const id = text(item?.id);
    const propertyId = text(item?.propertyId);
    if (!id || !propertyId) return null;
    return {
      id,
      propertyId,
      bidderId: text(item?.bidderId, 'unknown'),
      bidderName: text(item?.bidderName, 'Bidder'),
      bidderRole: text(item?.bidderRole, 'buyer').toLowerCase(),
      amount: Math.max(0, Math.round(numberFrom(item?.amount, 0))),
      source: text(item?.source, 'local'),
      createdAt: text(item?.createdAt),
    };
  };

  const allBids = () => {
    const rows = readJson(AUCTION_BIDS_KEY, []);
    return (Array.isArray(rows) ? rows : [])
      .map((item) => normalizeBid(item))
      .filter(Boolean)
      .sort((a, b) => {
        const diff = b.amount - a.amount;
        if (diff !== 0) return diff;
        return epoch(a.createdAt) - epoch(b.createdAt);
      });
  };

  const auctionMap = () => {
    const rows = readJson(AUCTION_STATE_KEY, {});
    return rows && typeof rows === 'object' ? rows : {};
  };

  const normalizeAudit = (row = {}, source = 'unknown') => ({
    id: text(row.id, `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    at: text(row.at || row.createdAt),
    source,
    type: text(row.type, 'info'),
    propertyId: text(row.propertyId),
    propertyTitle: text(row.propertyTitle || row.title),
    message: text(row.message),
    by: text(row.by, source),
  });

  const getAudits = () => {
    const customer = (Array.isArray(readJson(CUSTOMER_AUDIT_KEY, [])) ? readJson(CUSTOMER_AUDIT_KEY, []) : [])
      .map((item) => normalizeAudit(item, 'customer'));
    const seller = (Array.isArray(readJson(SELLER_AUDIT_KEY, [])) ? readJson(SELLER_AUDIT_KEY, []) : [])
      .map((item) => normalizeAudit(item, 'seller'));
    const admin = (Array.isArray(readJson(ADMIN_AUDIT_KEY, [])) ? readJson(ADMIN_AUDIT_KEY, []) : [])
      .map((item) => normalizeAudit(item, 'admin'));
    return { customer, seller, admin };
  };

  const deriveStatus = (auction, topBid) => {
    const raw = text(auction?.status, 'live').toLowerCase();
    if (raw === 'settled') return 'settled';
    if (raw === 'cancelled') return 'cancelled';
    if (raw === 'closed') return auction?.winnerBidId || topBid ? (auction?.winnerBidId ? 'settled' : 'closed') : 'closed';
    const closeEpoch = epoch(auction?.closesAt);
    if (closeEpoch > 0 && closeEpoch <= Date.now()) return auction?.winnerBidId ? 'settled' : 'closed';
    return 'live';
  };

  const buildRows = () => {
    const listings = listingMap();
    const auctions = auctionMap();
    const bids = allBids();
    const ids = new Set();
    Object.keys(auctions).forEach((id) => ids.add(text(id)));
    bids.forEach((bid) => ids.add(text(bid.propertyId)));

    const rows = [];
    ids.forEach((propertyId) => {
      if (!propertyId) return;
      const listing = listings.get(propertyId) || {
        id: propertyId,
        title: propertyId,
        city: 'Udaipur',
        location: 'Udaipur',
        ownerId: '',
        price: 0,
      };
      const auction = auctions[propertyId] || {
        propertyId,
        reservePrice: Math.max(1000, Math.round(numberFrom(listing.price, 0) * 0.9 || 1000)),
        closesAt: '',
        status: 'live',
      };
      const bidRows = bids.filter((bid) => bid.propertyId === propertyId);
      const highestBid = bidRows[0] || null;
      const secondBid = bidRows[1] || null;
      const reservePrice = Math.max(1000, Math.round(numberFrom(auction.reservePrice, listing.price * 0.9 || 1000)));
      const reserveGap = highestBid ? reservePrice - highestBid.amount : reservePrice;
      const status = deriveStatus(auction, highestBid);
      const closeEpoch = epoch(auction.closesAt);
      const closeInHours = closeEpoch > 0 ? (closeEpoch - Date.now()) / 3600000 : null;
      const top24h = bidRows.filter((bid) => Date.now() - epoch(bid.createdAt) <= 24 * 3600000).length;
      const uniqueBidders = Array.from(new Set(bidRows.map((bid) => bid.bidderId))).length;
      const bidderRoles = bidRows.reduce((acc, bid) => {
        const role = text(bid.bidderRole, 'buyer');
        acc[role] = numberFrom(acc[role], 0) + 1;
        return acc;
      }, {});

      const flags = [];
      if (status === 'live' && closeInHours !== null && closeInHours > 0 && closeInHours <= 24 && reserveGap <= 0) flags.push('Ready to settle');
      if (status === 'closed' && !auction.winnerBidId) flags.push('Closed without settlement');
      if (status === 'live' && bidRows.length === 0) flags.push('No bids yet');
      if (status === 'live' && bidRows.length > 0 && reserveGap > 0) flags.push('Reserve not met');
      if (highestBid && secondBid && highestBid.amount >= secondBid.amount * 1.75) flags.push('Top outlier');

      rows.push({
        propertyId,
        propertyTitle: listing.title,
        city: listing.city,
        location: listing.location,
        ownerId: listing.ownerId,
        listedPrice: listing.price,
        status,
        reservePrice,
        reserveGap,
        closesAt: text(auction.closesAt),
        winnerBidId: text(auction.winnerBidId),
        winnerAcceptedAt: text(auction.winnerAcceptedAt),
        highestBid,
        highestAmount: highestBid ? highestBid.amount : 0,
        secondBid,
        totalBids: bidRows.length,
        uniqueBidders,
        top24h,
        bidderRoles,
        flags,
      });
    });

    return rows.sort((a, b) => {
      const statusRank = { live: 0, closed: 1, settled: 2, cancelled: 3, draft: 4 };
      const statusDiff = (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9);
      if (statusDiff !== 0) return statusDiff;
      return b.highestAmount - a.highestAmount;
    });
  };

  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
#${CARD_ID}{margin-top:16px}
#${CARD_ID} .auat-card{border:1px solid #d6e1f5;border-radius:10px;background:#fff;padding:10px}
#${CARD_ID} .auat-grid{display:grid;gap:10px}
#${CARD_ID} .auat-grid.cols{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}
#${CARD_ID} label{display:block;font-size:12px;color:#35597d;margin-bottom:4px}
#${CARD_ID} input,#${CARD_ID} select{width:100%;border:1px solid #cad9ef;border-radius:8px;padding:8px 10px;box-sizing:border-box}
#${CARD_ID} .auat-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
#${CARD_ID} .auat-btn{border:1px solid #0b3d91;background:#0b3d91;color:#fff;border-radius:8px;padding:8px 12px;cursor:pointer;font-weight:700}
#${CARD_ID} .auat-btn.alt{background:#fff;color:#0b3d91}
#${CARD_ID} .auat-status{margin:8px 0 0;color:#1d4068}
#${CARD_ID} .auat-kpis{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-top:10px}
#${CARD_ID} .auat-kpi{border:1px solid #d6e1f5;border-radius:8px;background:#f8fbff;padding:8px}
#${CARD_ID} .auat-kpi small{display:block;color:#58718f}
#${CARD_ID} .auat-kpi b{color:#11466e}
#${CARD_ID} table{width:100%;border-collapse:collapse}
#${CARD_ID} th,#${CARD_ID} td{border:1px solid #d6e1f5;padding:8px;text-align:left;vertical-align:top}
#${CARD_ID} th{background:#f4f8ff;color:#11466e}
#${CARD_ID} .auat-chip{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;margin:2px 6px 2px 0;background:#e9f0ff;color:#1f3e7a}
#${CARD_ID} .auat-chip.live{background:#e2f7e8;color:#1f6d3d}
#${CARD_ID} .auat-chip.closed{background:#ffeaea;color:#8d1e1e}
#${CARD_ID} .auat-chip.settled{background:#e8f7ef;color:#10623e}
#${CARD_ID} .auat-chip.warn{background:#fff4cc;color:#7a4e00}
#${CARD_ID} .auat-audit{max-height:220px;overflow:auto}
#${CARD_ID} .auat-audit-item{border-bottom:1px solid #e1e9f8;padding:7px 0;color:#325176;font-size:13px}
@media (max-width:768px){#${CARD_ID} .auat-row{display:grid;grid-template-columns:1fr}}
`;
    document.head.appendChild(style);
  }

  const card = document.createElement('section');
  card.id = CARD_ID;
  card.className = 'container';
  card.innerHTML = `
<div class="auat-card">
  <h2 style="margin:0 0 8px;">Auction Unified Analytics Timeline</h2>
  <p style="margin:0;color:#1d4068;">Buyer + Seller + Admin auction flow in one timeline: activity, settlement velocity, and risk backlog.</p>
</div>

<div class="auat-card" style="margin-top:10px;">
  <div class="auat-grid cols">
    <div><label for="auatQuery">Search</label><input id="auatQuery" placeholder="Property title or id"></div>
    <div><label for="auatStatusFilter">Status</label><select id="auatStatusFilter"><option value="all">All</option><option value="live">Live</option><option value="closed">Closed</option><option value="settled">Settled</option><option value="cancelled">Cancelled</option></select></div>
    <div><label for="auatMinBids">Min Bids</label><input id="auatMinBids" type="number" min="0" max="100" step="1"></div>
    <div><label for="auatLookback">Lookback Days</label><select id="auatLookback"><option value="7">7</option><option value="14">14</option><option value="30">30</option><option value="60">60</option><option value="90">90</option></select></div>
    <div><label for="auatAutoSec">Auto Refresh sec</label><input id="auatAutoSec" type="number" min="0" max="180" step="5"></div>
  </div>
  <div class="auat-row" style="margin-top:10px;">
    <button id="auatRefreshBtn" class="auat-btn" type="button">Refresh</button>
    <button id="auatSavePrefBtn" class="auat-btn alt" type="button">Save Filters</button>
    <button id="auatExportTimelineBtn" class="auat-btn alt" type="button">Export Timeline CSV</button>
    <span id="auatStatus" class="auat-chip">Ready</span>
  </div>
</div>

<div id="auatKpis" class="auat-kpis"></div>

<div class="auat-card" style="margin-top:10px;">
  <h3 style="margin:0 0 8px;">Auction Board Snapshot</h3>
  <div id="auatBoard" style="overflow:auto;"></div>
</div>

<div class="auat-card" style="margin-top:10px;">
  <h3 style="margin:0 0 8px;">Settlement Queue</h3>
  <div id="auatQueue"></div>
</div>

<div class="auat-card" style="margin-top:10px;">
  <h3 style="margin:0 0 8px;">Unified Timeline (Day-wise)</h3>
  <div id="auatTimeline" style="overflow:auto;"></div>
</div>

<div class="auat-card" style="margin-top:10px;">
  <h3 style="margin:0 0 8px;">Recent Unified Activity</h3>
  <div id="auatAudit" class="auat-audit"></div>
</div>
`;

  const anchor = document.getElementById('adminAuctionControlCenter') || document.getElementById('adminV3ToolsPanel');
  if (anchor?.parentElement) anchor.insertAdjacentElement('afterend', card);
  else document.body.appendChild(card);

  const ui = {
    query: document.getElementById('auatQuery'),
    statusFilter: document.getElementById('auatStatusFilter'),
    minBids: document.getElementById('auatMinBids'),
    lookback: document.getElementById('auatLookback'),
    autoSec: document.getElementById('auatAutoSec'),
    refreshBtn: document.getElementById('auatRefreshBtn'),
    savePrefBtn: document.getElementById('auatSavePrefBtn'),
    exportTimelineBtn: document.getElementById('auatExportTimelineBtn'),
    status: document.getElementById('auatStatus'),
    kpis: document.getElementById('auatKpis'),
    board: document.getElementById('auatBoard'),
    queue: document.getElementById('auatQueue'),
    timeline: document.getElementById('auatTimeline'),
    audit: document.getElementById('auatAudit'),
  };

  const state = {
    rows: [],
    filteredRows: [],
    timelineRows: [],
    unifiedAudit: [],
    timer: null,
  };

  const setStatus = (message, ok = true) => {
    ui.status.textContent = text(message);
    ui.status.style.color = ok ? '#1d4068' : '#8d1e1e';
  };

  const applyPrefsToControls = () => {
    const pref = getPrefs();
    ui.query.value = pref.query;
    ui.statusFilter.value = pref.status;
    ui.minBids.value = String(pref.minBids);
    ui.lookback.value = String(pref.lookbackDays);
    ui.autoSec.value = String(pref.autoSec);
  };

  const readControls = () => ({
    query: text(ui.query.value).toLowerCase(),
    status: text(ui.statusFilter.value, 'all').toLowerCase(),
    minBids: Math.max(0, Math.round(numberFrom(ui.minBids.value, 0))),
    lookbackDays: clamp(Math.round(numberFrom(ui.lookback.value, 30)), 7, 120),
    autoSec: clamp(Math.round(numberFrom(ui.autoSec.value, 30)), 0, 180),
  });

  const filterRows = (rows) => {
    const control = readControls();
    return rows.filter((row) => {
      if (control.status !== 'all' && row.status !== control.status) return false;
      if (row.totalBids < control.minBids) return false;
      if (!control.query) return true;
      return (
        row.propertyTitle.toLowerCase().includes(control.query)
        || row.propertyId.toLowerCase().includes(control.query)
        || row.city.toLowerCase().includes(control.query)
      );
    });
  };

  const renderKpis = (rows, bids, audits) => {
    const total = rows.length;
    const liveCount = rows.filter((row) => row.status === 'live').length;
    const closedCount = rows.filter((row) => row.status === 'closed').length;
    const settledCount = rows.filter((row) => row.status === 'settled').length;
    const totalBids = rows.reduce((sum, row) => sum + row.totalBids, 0);
    const avgBids = total > 0 ? (totalBids / total) : 0;
    const eligible = rows.filter((row) => row.totalBids > 0).length;
    const settlementRate = eligible > 0 ? (settledCount / eligible) * 100 : 0;
    const uniqueBidders = Array.from(new Set(bids.map((bid) => bid.bidderId))).length;
    const buyerBids = bids.filter((bid) => bid.bidderRole === 'buyer' || bid.bidderRole === 'customer').length;
    const sellerActions = audits.seller.length;
    const adminActions = audits.admin.length;

    const cards = [
      ['Auctions', total],
      ['Live', liveCount],
      ['Closed', closedCount],
      ['Settled', settledCount],
      ['Settlement Rate', `${settlementRate.toFixed(1)}%`],
      ['Total Bids', totalBids],
      ['Avg Bids/Auction', avgBids.toFixed(2)],
      ['Unique Bidders', uniqueBidders],
      ['Buyer Bid Events', buyerBids],
      ['Seller Actions', sellerActions],
      ['Admin Actions', adminActions],
    ];

    ui.kpis.innerHTML = cards.map(([label, value]) => `
<div class="auat-kpi">
  <small>${escapeHtml(String(label))}</small>
  <b>${escapeHtml(String(value))}</b>
</div>`).join('');
  };

  const renderBoard = (rows) => {
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
      <th>Roles</th>
      <th>Signals</th>
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
        <td><span class="auat-chip ${escapeHtml(row.status)}">${escapeHtml(row.status)}</span></td>
        <td>Total ${row.totalBids}<br>Bidders ${row.uniqueBidders}<br>24h ${row.top24h}</td>
        <td>${row.highestBid ? inr(row.highestBid.amount) : '-'}<br>Reserve ${inr(row.reservePrice)}<br>${row.reserveGap > 0 ? `Gap ${inr(row.reserveGap)}` : 'Reserve met'}</td>
        <td>${Object.entries(row.bidderRoles).map(([role, count]) => `${escapeHtml(role)}:${count}`).join(' | ') || '-'}</td>
        <td>${row.flags.length ? row.flags.map((flag) => `<span class="auat-chip warn">${escapeHtml(flag)}</span>`).join('') : '<span style="color:#1f6d3d;">Normal</span>'}</td>
      </tr>
    `).join('')}
  </tbody>
</table>`;
  };

  const renderQueue = (rows) => {
    const queue = [];
    rows.forEach((row) => {
      const closeEpoch = epoch(row.closesAt);
      const closeInHours = closeEpoch > 0 ? (closeEpoch - Date.now()) / 3600000 : null;
      if (row.status === 'live' && row.totalBids > 0 && row.reserveGap <= 0 && closeInHours !== null && closeInHours <= 24) {
        queue.push({
          priority: 'P1',
          title: row.propertyTitle,
          propertyId: row.propertyId,
          action: 'Settle winner window',
          reason: 'Reserve met and closing soon',
        });
      }
      if (row.status === 'closed' && !row.winnerBidId) {
        queue.push({
          priority: 'P1',
          title: row.propertyTitle,
          propertyId: row.propertyId,
          action: 'Settle or reopen',
          reason: 'Closed without settlement',
        });
      }
      if (row.status === 'live' && row.totalBids === 0) {
        queue.push({
          priority: 'P2',
          title: row.propertyTitle,
          propertyId: row.propertyId,
          action: 'Seller activation',
          reason: 'No bids yet',
        });
      }
    });

    if (!queue.length) {
      ui.queue.innerHTML = '<p style="margin:0;color:#1f6d3d;">No immediate settlement backlog.</p>';
      return;
    }

    ui.queue.innerHTML = queue.slice(0, 15).map((item) => `
<div style="border-bottom:1px solid #e1e9f8;padding:7px 0;">
  <span class="auat-chip warn">${escapeHtml(item.priority)}</span>
  <b>${escapeHtml(item.title)}</b> (${escapeHtml(item.propertyId)})<br>
  Action: ${escapeHtml(item.action)}<br>
  Reason: ${escapeHtml(item.reason)}
</div>`).join('');
  };

  const buildTimeline = (lookbackDays, bids, audits, rows) => {
    const days = [];
    const today = new Date();
    for (let i = lookbackDays - 1; i >= 0; i -= 1) {
      const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const key = day.toISOString().slice(0, 10);
      days.push({
        dayKey: key,
        label: day.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        bids: 0,
        customerEvents: 0,
        sellerEvents: 0,
        adminEvents: 0,
        settlements: 0,
      });
    }
    const map = new Map(days.map((item) => [item.dayKey, item]));
    const startEpoch = epoch(days[0]?.dayKey || Date.now());

    bids.forEach((bid) => {
      if (epoch(bid.createdAt) < startEpoch) return;
      const key = dayKey(bid.createdAt);
      if (!map.has(key)) return;
      map.get(key).bids += 1;
    });

    audits.customer.forEach((event) => {
      if (epoch(event.at) < startEpoch) return;
      const key = dayKey(event.at);
      if (!map.has(key)) return;
      map.get(key).customerEvents += 1;
    });
    audits.seller.forEach((event) => {
      if (epoch(event.at) < startEpoch) return;
      const key = dayKey(event.at);
      if (!map.has(key)) return;
      map.get(key).sellerEvents += 1;
    });
    audits.admin.forEach((event) => {
      if (epoch(event.at) < startEpoch) return;
      const key = dayKey(event.at);
      if (!map.has(key)) return;
      map.get(key).adminEvents += 1;
    });

    rows.forEach((row) => {
      if (row.status !== 'settled') return;
      const markerAt = row.winnerAcceptedAt || row.closesAt;
      if (epoch(markerAt) < startEpoch) return;
      const key = dayKey(markerAt);
      if (!map.has(key)) return;
      map.get(key).settlements += 1;
    });

    return days;
  };

  const renderTimeline = (rows) => {
    if (!rows.length) {
      ui.timeline.innerHTML = '<p style="margin:0;color:#607da8;">No timeline data.</p>';
      return;
    }
    ui.timeline.innerHTML = `
<table>
  <thead>
    <tr>
      <th>Day</th>
      <th>Bids</th>
      <th>Customer</th>
      <th>Seller</th>
      <th>Admin</th>
      <th>Settlements</th>
      <th>Total Actions</th>
    </tr>
  </thead>
  <tbody>
    ${rows.map((row) => {
      const totalActions = row.bids + row.customerEvents + row.sellerEvents + row.adminEvents + row.settlements;
      return `
      <tr>
        <td>${escapeHtml(row.label)}</td>
        <td>${row.bids}</td>
        <td>${row.customerEvents}</td>
        <td>${row.sellerEvents}</td>
        <td>${row.adminEvents}</td>
        <td>${row.settlements}</td>
        <td>${totalActions}</td>
      </tr>`;
    }).join('')}
  </tbody>
</table>`;
  };

  const renderUnifiedActivity = (audits) => {
    const rows = [
      ...audits.customer,
      ...audits.seller,
      ...audits.admin,
    ].sort((a, b) => epoch(b.at) - epoch(a.at));
    state.unifiedAudit = rows;

    if (!rows.length) {
      ui.audit.innerHTML = '<p style="margin:0;color:#607da8;">No recent auction activity.</p>';
      return;
    }
    ui.audit.innerHTML = rows.slice(0, 30).map((row) => `
<div class="auat-audit-item">
  <span class="auat-chip">${escapeHtml(row.source)}</span>
  <b>${escapeHtml(row.type)}</b> - ${escapeHtml(text(row.propertyTitle, row.propertyId))}<br>
  ${escapeHtml(row.message)}<br>
  <span style="color:#6d86a5;">${escapeHtml(new Date(row.at).toLocaleString('en-IN'))} | ${escapeHtml(text(row.by, row.source))}</span>
</div>`).join('');
  };

  const exportTimelineCsv = (rows) => {
    const header = ['day', 'bids', 'customerEvents', 'sellerEvents', 'adminEvents', 'settlements', 'totalActions'];
    const lines = rows.map((row) => {
      const totalActions = row.bids + row.customerEvents + row.sellerEvents + row.adminEvents + row.settlements;
      return [
        row.dayKey,
        row.bids,
        row.customerEvents,
        row.sellerEvents,
        row.adminEvents,
        row.settlements,
        totalActions,
      ].map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',');
    });
    const csv = `${header.join(',')}\n${lines.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `auction-unified-timeline-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const refresh = async ({ silent = false } = {}) => {
    if (typeof live.syncLocalListingsFromApi === 'function') {
      try {
        await live.syncLocalListingsFromApi();
      } catch {
        // keep local cache
      }
    }

    const bids = allBids();
    const audits = getAudits();
    state.rows = buildRows();
    state.filteredRows = filterRows(state.rows);
    state.timelineRows = buildTimeline(readControls().lookbackDays, bids, audits, state.filteredRows);

    renderKpis(state.filteredRows, bids, audits);
    renderBoard(state.filteredRows);
    renderQueue(state.filteredRows);
    renderTimeline(state.timelineRows);
    renderUnifiedActivity(audits);
    if (!silent) setStatus(`Unified analytics refreshed (${state.filteredRows.length} auctions).`);
  };

  const applyAutoRefresh = (sec) => {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
    const seconds = Math.max(0, Math.round(numberFrom(sec, 0)));
    if (seconds > 0) {
      state.timer = setInterval(() => {
        refresh({ silent: true }).catch(() => null);
      }, seconds * 1000);
    }
  };

  ui.refreshBtn.addEventListener('click', () => {
    refresh().catch((error) => setStatus(text(error?.message, 'Refresh failed.'), false));
  });

  ui.savePrefBtn.addEventListener('click', () => {
    const control = readControls();
    setPrefs(control);
    applyAutoRefresh(control.autoSec);
    setStatus('Unified analytics filters saved.');
    refresh({ silent: true }).catch(() => null);
  });

  ui.exportTimelineBtn.addEventListener('click', () => {
    exportTimelineCsv(state.timelineRows);
    setStatus(`Timeline CSV exported (${state.timelineRows.length} days).`);
  });

  [ui.query, ui.statusFilter, ui.minBids, ui.lookback].forEach((element) => {
    element.addEventListener('input', () => {
      state.filteredRows = filterRows(state.rows);
      state.timelineRows = buildTimeline(readControls().lookbackDays, allBids(), getAudits(), state.filteredRows);
      renderKpis(state.filteredRows, allBids(), getAudits());
      renderBoard(state.filteredRows);
      renderQueue(state.filteredRows);
      renderTimeline(state.timelineRows);
    });
    element.addEventListener('change', () => {
      state.filteredRows = filterRows(state.rows);
      state.timelineRows = buildTimeline(readControls().lookbackDays, allBids(), getAudits(), state.filteredRows);
      renderKpis(state.filteredRows, allBids(), getAudits());
      renderBoard(state.filteredRows);
      renderQueue(state.filteredRows);
      renderTimeline(state.timelineRows);
    });
  });

  ui.autoSec.addEventListener('change', () => {
    const sec = clamp(Math.round(numberFrom(ui.autoSec.value, 30)), 0, 180);
    applyAutoRefresh(sec);
    setStatus(sec > 0 ? `Auto refresh enabled (${sec}s).` : 'Auto refresh disabled.');
  });

  applyPrefsToControls();
  applyAutoRefresh(getPrefs().autoSec);
  refresh().catch((error) => setStatus(text(error?.message, 'Unable to load unified auction analytics.'), false));

  window.addEventListener('beforeunload', () => {
    if (state.timer) clearInterval(state.timer);
  });
})();
