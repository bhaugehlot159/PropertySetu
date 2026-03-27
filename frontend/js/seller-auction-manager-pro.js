(() => {
  if (document.getElementById('sellerAuctionManagerProCard')) return;
  const live = window.PropertySetuLive || {};
  const isSellerPage = Boolean(document.getElementById('addPropertyForm') && document.getElementById('propertyList'));
  if (!isSellerPage) return;

  const CARD_ID = 'sellerAuctionManagerProCard';
  const STYLE_ID = 'seller-auction-manager-pro-style';
  const LISTINGS_KEY = 'propertySetu:listings';
  const AUC_KEY = 'propertySetu:auctionState';
  const BID_KEY = 'propertySetu:auctionBids';
  const PREF_KEY = 'propertySetu:auctionSellerPrefs';
  const AUDIT_KEY = 'propertySetu:auctionSellerAudit';
  const CHAT_PREFIX = 'propertySetu:userChat:';

  const text = (v, f = '') => { const s = String(v || '').trim(); return s || f; };
  const num = (v, f = 0) => { const n = Number(v); return Number.isFinite(n) ? n : f; };
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const epoch = (v) => { const t = new Date(v || '').getTime(); return Number.isFinite(t) ? t : 0; };
  const nowIso = () => new Date().toISOString();
  const inr = (v) => `Rs ${Math.round(num(v, 0)).toLocaleString('en-IN')}`;
  const esc = (v) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;');

  const read = live.readJson || ((k, f) => { try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : f; } catch { return f; } });
  const write = live.writeJson || ((k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* no-op */ } });

  const getSession = () => {
    if (typeof live.getAnySession === 'function') return live.getAnySession() || {};
    return read('propertysetu-seller-session', {}) || {};
  };
  const sellerId = () => text(getSession()?.id || getSession()?._id || getSession()?.userId);
  const sellerName = () => text(getSession()?.name || getSession()?.fullName, 'Seller');

  const prefs = () => {
    const p = read(PREF_KEY, {});
    return {
      query: text(p?.query),
      status: text(p?.status, 'all').toLowerCase(),
      minIncPct: clamp(num(p?.minIncPct, 1), 0.25, 15),
      autoSec: clamp(Math.round(num(p?.autoSec, 20)), 0, 180),
      defaultHours: clamp(Math.round(num(p?.defaultHours, 72)), 12, 720),
      showClosed: p?.showClosed !== false,
    };
  };
  const savePrefs = (p) => write(PREF_KEY, { ...prefs(), ...(p || {}) });

  const auctionState = () => {
    const map = read(AUC_KEY, {});
    return map && typeof map === 'object' ? map : {};
  };
  const saveAuctionState = (m) => write(AUC_KEY, m && typeof m === 'object' ? m : {});

  const allBids = () => {
    const rows = read(BID_KEY, []);
    return (Array.isArray(rows) ? rows : [])
      .map((r) => ({
        id: text(r?.id), propertyId: text(r?.propertyId), bidderId: text(r?.bidderId), bidderName: text(r?.bidderName, 'Bidder'), bidderRole: text(r?.bidderRole, 'buyer'),
        amount: Math.max(0, Math.round(num(r?.amount, 0))), createdAt: text(r?.createdAt, nowIso()), source: text(r?.source, 'local')
      }))
      .filter((r) => r.id && r.propertyId)
      .sort((a, b) => (b.amount - a.amount) || (epoch(a.createdAt) - epoch(b.createdAt)));
  };

  const getAudit = () => { const rows = read(AUDIT_KEY, []); return Array.isArray(rows) ? rows : []; };
  const pushAudit = (entry) => {
    const rows = getAudit();
    rows.unshift({ id: `samp-a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: nowIso(), by: sellerName(), propertyId: text(entry?.propertyId), propertyTitle: text(entry?.propertyTitle), type: text(entry?.type, 'info'), message: text(entry?.message) });
    write(AUDIT_KEY, rows.slice(0, 400));
  };

  const normalizeListing = (r) => {
    const id = text(r?.id || r?._id);
    if (!id) return null;
    return {
      id,
      title: text(r?.title, id),
      city: text(r?.city, 'Udaipur'),
      location: text(r?.location || r?.locality, 'Udaipur'),
      ownerId: text(r?.ownerId || r?.userId || r?.owner?.id),
      price: Math.max(0, Math.round(num(r?.price, 0))),
    };
  };

  const loadListings = async () => {
    if (typeof live.syncLocalListingsFromApi === 'function') {
      try { await live.syncLocalListingsFromApi(); } catch { /* keep local */ }
    }
    const id = sellerId();
    const list = (Array.isArray(read(LISTINGS_KEY, [])) ? read(LISTINGS_KEY, []) : []).map(normalizeListing).filter(Boolean);
    if (!id) return list;
    const mine = list.filter((x) => x.ownerId === id);
    return mine.length ? mine : list;
  };

  const statusOf = (auc, bids) => {
    if (!auc) return bids.length ? 'live' : 'draft';
    const raw = text(auc?.status, 'live').toLowerCase();
    if (raw === 'settled') return 'settled';
    if (raw === 'closed') return auc?.winnerBidId ? 'settled' : 'closed';
    if (raw === 'cancelled') return 'cancelled';
    if (epoch(auc?.closesAt) > 0 && epoch(auc?.closesAt) <= Date.now()) return auc?.winnerBidId ? 'settled' : 'closed';
    return 'live';
  };

  const minNext = (reserve, top, incPct) => {
    const r = Math.max(0, Math.round(num(reserve, 0)));
    if (!top) return r;
    const step = Math.max(top.amount >= 1000000 ? 5000 : 1000, Math.round(top.amount * (clamp(num(incPct, 1), 0.25, 15) / 100)));
    return Math.max(r, top.amount + step);
  };

  const toLocal = (iso) => {
    const d = new Date(iso || Date.now());
    if (Number.isNaN(d.getTime())) return '';
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };
  const fromLocal = (raw) => {
    const d = new Date(text(raw));
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  };

  const pushNoti = (title, message, audience = ['seller', 'admin'], type = 'info') => {
    if (!title || !message) return;
    if (window.PropertySetuNotify && typeof window.PropertySetuNotify.emit === 'function') {
      window.PropertySetuNotify.emit({ title, message, audience, type });
      return;
    }
    const rows = read('propertySetu:notifications', []);
    const list = Array.isArray(rows) ? rows : [];
    list.unshift({ id: `samp-n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title, message, audience, type, createdAt: nowIso(), readBy: {} });
    write('propertySetu:notifications', list.slice(0, 700));
  };

  const ensureAuction = (id, listing, patch = {}) => {
    const map = auctionState();
    const p = prefs();
    const current = map[id] || {
      propertyId: id,
      reservePrice: Math.max(1000, Math.round((num(listing?.price, 0) * 0.9) || 1000)),
      closesAt: new Date(Date.now() + p.defaultHours * 3600000).toISOString(),
      status: 'live',
      sellerId: sellerId(),
      startedAt: nowIso(),
    };
    map[id] = { ...current, ...patch, propertyId: id, updatedAt: nowIso() };
    saveAuctionState(map);
    return map[id];
  };

  const buildRows = (listings) => {
    const map = auctionState();
    const bids = allBids();
    return listings.map((l) => {
      const auc = map[l.id] || null;
      const bidRows = bids.filter((b) => b.propertyId === l.id);
      const top = bidRows[0] || null;
      const second = bidRows[1] || null;
      const reserve = Math.max(1000, Math.round(num(auc?.reservePrice, (l.price * 0.9) || 1000)));
      const status = statusOf(auc, bidRows);
      const closesAt = text(auc?.closesAt);
      const close = epoch(closesAt);
      const leftH = close > 0 ? (close - Date.now()) / 3600000 : null;
      const reserveGap = top ? reserve - top.amount : reserve;
      const top24h = bidRows.filter((b) => Date.now() - epoch(b.createdAt) <= 86400000).length;
      const unique = Array.from(new Set(bidRows.map((b) => b.bidderId))).length;
      const flags = [];
      let risk = 0;
      if (status === 'live' && !bidRows.length) { flags.push('No bids yet'); risk += 1; }
      if (status === 'live' && reserveGap > 0 && bidRows.length) { flags.push('Reserve not met'); risk += 2; }
      if (status === 'live' && leftH !== null && leftH > 0 && leftH <= 3) { flags.push('Closing <3h'); risk += 1; }
      if (top && second && top.amount >= second.amount * 1.75) { flags.push('Top outlier'); risk += 1; }
      return {
        propertyId: l.id, propertyTitle: l.title, city: l.city, location: l.location, listedPrice: l.price,
        status, reservePrice: reserve, closesAt, countdown: status === 'live' ? (leftH !== null ? `${Math.max(0, Math.floor(leftH))}h` : '-') : '-',
        totalBids: bidRows.length, uniqueBidders: unique, top24h, highestBid: top, highestAmount: top ? top.amount : 0, reserveGap, bidRows, risk, flags,
      };
    }).sort((a, b) => ({ live: 0, draft: 1, closed: 2, settled: 3 }[a.status] - ({ live: 0, draft: 1, closed: 2, settled: 3 }[b.status])) || (b.risk - a.risk) || (b.highestAmount - a.highestAmount));
  };

  if (!document.getElementById(STYLE_ID)) {
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = `#${CARD_ID}{margin-top:16px}#${CARD_ID} .box{border:1px solid #d6e1f5;border-radius:10px;background:#fff;padding:10px}#${CARD_ID} .grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}#${CARD_ID} label{display:block;font-size:12px;color:#35597d;margin-bottom:4px}#${CARD_ID} input,#${CARD_ID} select{width:100%;border:1px solid #cad9ef;border-radius:8px;padding:8px 10px;box-sizing:border-box}#${CARD_ID} .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}#${CARD_ID} .btn{border:1px solid #0b3d91;background:#0b3d91;color:#fff;border-radius:8px;padding:8px 12px;cursor:pointer;font-weight:700}#${CARD_ID} .btn.alt{background:#fff;color:#0b3d91}#${CARD_ID} .btn.warn{background:#8d1e1e;border-color:#8d1e1e}#${CARD_ID} .kpis{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-top:10px}#${CARD_ID} .kpi{border:1px solid #d6e1f5;background:#f8fbff;border-radius:8px;padding:8px}#${CARD_ID} .kpi small{display:block;color:#58718f}#${CARD_ID} table{width:100%;border-collapse:collapse}#${CARD_ID} th,#${CARD_ID} td{border:1px solid #d6e1f5;padding:8px;text-align:left;vertical-align:top}#${CARD_ID} th{background:#f4f8ff;color:#11466e}#${CARD_ID} .chip{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;margin:2px 6px 2px 0;background:#e9f0ff;color:#1f3e7a}#${CARD_ID} .chip.live{background:#e2f7e8;color:#1f6d3d}#${CARD_ID} .chip.closed{background:#ffeaea;color:#8d1e1e}#${CARD_ID} .chip.settled{background:#e8f7ef;color:#10623e}#${CARD_ID} .chip.risk{background:#fff4cc;color:#7a4e00}`;
    document.head.appendChild(st);
  }

  const card = document.createElement('section');
  card.id = CARD_ID;
  card.className = 'container';
  card.innerHTML = `
<div class="box"><h2 style="margin:0 0 8px;">Seller Auction Manager Pro</h2><p style="margin:0;color:#1d4068;">Manage your property auctions with reserve control, winner settlement and bidder follow-up.</p></div>
<div class="box" style="margin-top:10px;"><div class="grid"><div><label for="sampProperty">Property</label><select id="sampProperty"></select></div><div><label for="sampReserve">Reserve Price</label><input id="sampReserve" type="number" min="1000" step="1000"/></div><div><label for="sampClose">Close Time</label><input id="sampClose" type="datetime-local"/></div><div><label for="sampNote">Top Bidder Note</label><input id="sampNote" placeholder="Optional message"/></div></div><div class="row" style="margin-top:10px;"><button id="sampRefresh" class="btn" type="button">Refresh</button><button id="sampSave" class="btn alt" type="button">Save Auction</button><button id="sampSettle" class="btn alt" type="button">Settle Winner</button><button id="sampPing" class="btn alt" type="button">Notify Top Bidder</button><button id="sampExtend" class="btn alt" type="button">Extend +24h</button><button id="sampCloseNow" class="btn warn" type="button">Close</button><button id="sampReopen" class="btn alt" type="button">Reopen +24h</button><button id="sampCsv" class="btn alt" type="button">Export CSV</button><span id="sampStatus" class="chip">Ready</span></div></div>
<div class="box" style="margin-top:10px;"><div class="grid"><div><label for="sampQuery">Search</label><input id="sampQuery"/></div><div><label for="sampStatusFilter">Status</label><select id="sampStatusFilter"><option value="all">All</option><option value="draft">Draft</option><option value="live">Live</option><option value="closed">Closed</option><option value="settled">Settled</option></select></div><div><label for="sampMinInc">Min Increment %</label><input id="sampMinInc" type="number" min="0.25" max="15" step="0.25"/></div><div><label for="sampAuto">Auto Refresh sec</label><input id="sampAuto" type="number" min="0" max="180" step="5"/></div><div><label for="sampHours">Default Auction Hours</label><input id="sampHours" type="number" min="12" max="720" step="12"/></div><div><label for="sampShowClosed">Show Closed/Settled</label><select id="sampShowClosed"><option value="1">Yes</option><option value="0">No</option></select></div></div><div class="row" style="margin-top:10px;"><button id="sampSavePrefs" class="btn alt" type="button">Save Settings</button></div></div>
<div id="sampKpis" class="kpis"></div>
<div class="box" style="margin-top:10px;"><h3 style="margin:0 0 8px;">Auction Board</h3><div id="sampBoard" style="overflow:auto;"></div></div>
<div class="box" style="margin-top:10px;"><h3 style="margin:0 0 8px;">Bid Detail</h3><div id="sampDetail" style="overflow:auto;color:#325176;">Select a listing from board.</div></div>
<div class="box" style="margin-top:10px;"><h3 style="margin:0 0 8px;">Auction Audit</h3><div id="sampAudit" style="max-height:210px;overflow:auto;"></div></div>`;

  const anchor = document.getElementById('sellerDealRoomProCard') || document.getElementById('sellerPricingRepositionCard') || document.querySelector('.container');
  if (anchor?.parentElement) anchor.insertAdjacentElement('afterend', card); else document.body.appendChild(card);

  const ui = {
    property: document.getElementById('sampProperty'), reserve: document.getElementById('sampReserve'), close: document.getElementById('sampClose'), note: document.getElementById('sampNote'),
    refresh: document.getElementById('sampRefresh'), save: document.getElementById('sampSave'), settle: document.getElementById('sampSettle'), ping: document.getElementById('sampPing'), extend: document.getElementById('sampExtend'), closeNow: document.getElementById('sampCloseNow'), reopen: document.getElementById('sampReopen'), csv: document.getElementById('sampCsv'), status: document.getElementById('sampStatus'),
    query: document.getElementById('sampQuery'), statusFilter: document.getElementById('sampStatusFilter'), minInc: document.getElementById('sampMinInc'), auto: document.getElementById('sampAuto'), hours: document.getElementById('sampHours'), showClosed: document.getElementById('sampShowClosed'), savePrefs: document.getElementById('sampSavePrefs'),
    kpis: document.getElementById('sampKpis'), board: document.getElementById('sampBoard'), detail: document.getElementById('sampDetail'), audit: document.getElementById('sampAudit')
  };

  const state = { listings: [], rows: [], selected: '', timer: null };
  const setStatus = (m, ok = true) => { ui.status.textContent = text(m); ui.status.style.color = ok ? '#1d4068' : '#8d1e1e'; };

  const renderAudit = () => {
    const rows = getAudit();
    ui.audit.innerHTML = rows.length ? rows.slice(0, 30).map((r) => `<div style="border-bottom:1px solid #e1e9f8;padding:7px 0;"><b>${esc(r.type)}</b> - ${esc(text(r.propertyTitle, r.propertyId))}<br>${esc(r.message)}<br><span style="color:#6d86a5;">${esc(new Date(r.at).toLocaleString('en-IN'))} | ${esc(r.by)}</span></div>`).join('') : '<p style="margin:0;color:#607da8;">No auction logs yet.</p>';
  };

  const renderOptions = () => {
    const selected = text(state.selected || ui.property.value || state.listings[0]?.id);
    ui.property.innerHTML = state.listings.length ? state.listings.map((l) => `<option value="${esc(l.id)}">${esc(l.title)} (${esc(l.city)})</option>`).join('') : '<option value="">No listings</option>';
    if (selected) ui.property.value = selected;
    state.selected = text(ui.property.value);
  };

  const selectedRow = () => state.rows.find((r) => r.propertyId === text(ui.property.value || state.selected));
  const syncForm = (row) => {
    if (!row) return;
    state.selected = row.propertyId;
    ui.property.value = row.propertyId;
    ui.reserve.value = String(Math.max(1000, row.reservePrice));
    ui.close.value = toLocal(row.closesAt || new Date(Date.now() + prefs().defaultHours * 3600000).toISOString());
  };

  const filters = () => ({ query: text(ui.query.value, prefs().query).toLowerCase(), status: text(ui.statusFilter.value, prefs().status).toLowerCase(), showClosed: text(ui.showClosed.value, prefs().showClosed ? '1' : '0') === '1' });
  const applyFilters = (rows) => rows.filter((r) => {
    const f = filters();
    if (!f.showClosed && (r.status === 'closed' || r.status === 'settled' || r.status === 'cancelled')) return false;
    if (f.status !== 'all' && r.status !== f.status) return false;
    if (!f.query) return true;
    return r.propertyTitle.toLowerCase().includes(f.query) || r.propertyId.toLowerCase().includes(f.query) || r.city.toLowerCase().includes(f.query);
  });

  const renderKpis = (rows) => {
    const cards = [
      ['Listings', rows.length], ['Live', rows.filter((r) => r.status === 'live').length], ['Draft', rows.filter((r) => r.status === 'draft').length],
      ['Closed', rows.filter((r) => r.status === 'closed').length], ['Settled', rows.filter((r) => r.status === 'settled').length],
      ['Total Bids', rows.reduce((s, r) => s + r.totalBids, 0)], ['Reserve Met', rows.filter((r) => r.highestBid && r.reserveGap <= 0).length], ['At Risk', rows.filter((r) => r.risk >= 2).length]
    ];
    ui.kpis.innerHTML = cards.map(([l, v]) => `<div class="kpi"><small>${esc(String(l))}</small><b>${esc(String(v))}</b></div>`).join('');
  };

  const renderBoard = (rows) => {
    ui.board.innerHTML = rows.length ? `<table><thead><tr><th>Property</th><th>Status</th><th>Bids</th><th>Top/Reserve</th><th>Countdown</th><th>Signals</th><th>Actions</th></tr></thead><tbody>${rows.map((r) => `<tr><td><b>${esc(r.propertyTitle)}</b><br>${esc(r.propertyId)}<br><span style="color:#55739c;">${esc(r.location)}, ${esc(r.city)}</span></td><td><span class="chip ${esc(r.status)}">${esc(r.status)}</span></td><td>Total ${r.totalBids}<br>Bidders ${r.uniqueBidders}<br>24h ${r.top24h}</td><td>${r.highestBid ? inr(r.highestBid.amount) : '-'}<br>Reserve ${inr(r.reservePrice)}<br>${r.reserveGap > 0 ? `Gap ${inr(r.reserveGap)}` : 'Reserve met'}</td><td>${esc(r.countdown)}</td><td>${r.flags.length ? r.flags.map((f) => `<span class="chip risk">${esc(f)}</span>`).join('') : '<span style="color:#1f6d3d;">Normal</span>'}</td><td><div class="row" style="gap:6px;"><button class="btn alt" data-action="details" data-id="${esc(r.propertyId)}" type="button">Details</button><button class="btn alt" data-action="save" data-id="${esc(r.propertyId)}" type="button">Save</button><button class="btn alt" data-action="settle" data-id="${esc(r.propertyId)}" type="button">Settle</button><button class="btn alt" data-action="ping" data-id="${esc(r.propertyId)}" type="button">Notify</button><button class="btn alt" data-action="close" data-id="${esc(r.propertyId)}" type="button">Close</button><button class="btn alt" data-action="reopen" data-id="${esc(r.propertyId)}" type="button">Reopen</button></div></td></tr>`).join('')}</tbody></table>` : '<p style="margin:0;color:#607da8;">No auctions match filter.</p>';
  };

  const renderDetail = (id) => {
    const r = state.rows.find((x) => x.propertyId === id);
    if (!r) { ui.detail.innerHTML = '<p style="margin:0;color:#607da8;">Select a listing from board.</p>'; return; }
    ui.detail.innerHTML = `<div style="margin-bottom:8px;"><b>${esc(r.propertyTitle)}</b> (${esc(r.propertyId)})<br>Status: <b>${esc(r.status)}</b> | Reserve: <b>${inr(r.reservePrice)}</b> | Min Next: <b>${inr(minNext(r.reservePrice, r.highestBid, prefs().minIncPct))}</b></div><div style="overflow:auto;"><table><thead><tr><th>#</th><th>Bidder</th><th>Role</th><th>Amount</th><th>Time</th><th>Source</th></tr></thead><tbody>${r.bidRows.map((b, i) => `<tr><td>${i + 1}</td><td>${esc(b.bidderName)}</td><td>${esc(b.bidderRole)}</td><td>${inr(b.amount)}</td><td>${esc(new Date(b.createdAt).toLocaleString('en-IN'))}</td><td>${esc(b.source)}</td></tr>`).join('') || '<tr><td colspan="6">No bids yet.</td></tr>'}</tbody></table></div>`;
  };

  const saveAuction = (row) => {
    const reserve = Math.max(1000, Math.round(num(ui.reserve.value, row.reservePrice || row.listedPrice || 1000)));
    const closeIso = fromLocal(ui.close.value) || new Date(Date.now() + prefs().defaultHours * 3600000).toISOString();
    const auc = ensureAuction(row.propertyId, { price: row.listedPrice }, { reservePrice: reserve, closesAt: closeIso, status: epoch(closeIso) > Date.now() ? 'live' : 'closed', sellerId: sellerId() });
    const msg = `Auction saved. Reserve ${inr(auc.reservePrice)}, close ${new Date(auc.closesAt).toLocaleString('en-IN')}.`;
    pushAudit({ propertyId: row.propertyId, propertyTitle: row.propertyTitle, type: 'save', message: msg });
    pushNoti('Seller Auction Updated', `${row.propertyTitle}: ${msg}`);
    return { ok: true, message: msg };
  };

  const pingTopBidder = async (row, note) => {
    const top = row.highestBid;
    if (!top) return { ok: false, message: 'No top bidder available.' };
    const msg = text(note, `Hi from seller of ${row.propertyTitle}. Your bid is leading. Please confirm next steps.`);
    const key = `${CHAT_PREFIX}${row.propertyId}`;
    const items = read(key, []);
    const list = Array.isArray(items) ? items : [];
    list.push({ id: `samp-msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, sender: 'Seller', senderId: sellerId() || 'seller', receiverId: text(top.bidderId, 'bidder'), message: msg, createdAt: nowIso() });
    write(key, list.slice(-600));
    pushAudit({ propertyId: row.propertyId, propertyTitle: row.propertyTitle, type: 'ping', message: `Top bidder notified: ${top.bidderName}.` });
    pushNoti('Top Bidder Notified', `${row.propertyTitle}: Top bidder ping sent.`, ['seller', 'admin', 'customer']);
    return { ok: true, message: 'Top bidder notified.' };
  };

  const doAction = async (action, id) => {
    const row = state.rows.find((r) => r.propertyId === text(id || state.selected || ui.property.value));
    if (!row) return { ok: false, message: 'Select a valid listing first.' };

    if (action === 'save') return saveAuction(row);
    if (action === 'ping') return pingTopBidder(row, text(ui.note.value));

    let current = ensureAuction(row.propertyId, { price: row.listedPrice }, { reservePrice: row.reservePrice, closesAt: row.closesAt || new Date(Date.now() + prefs().defaultHours * 3600000).toISOString() });
    if (action === 'close') {
      current = ensureAuction(row.propertyId, { price: row.listedPrice }, { ...current, status: 'closed', closesAt: nowIso() });
      const msg = 'Auction closed.';
      pushAudit({ propertyId: row.propertyId, propertyTitle: row.propertyTitle, type: 'close', message: msg });
      pushNoti('Auction Closed', `${row.propertyTitle}: ${msg}`);
      return { ok: true, message: msg };
    }
    if (action === 'reopen') {
      current = ensureAuction(row.propertyId, { price: row.listedPrice }, { ...current, status: 'live', closesAt: new Date(Date.now() + 24 * 3600000).toISOString() });
      const msg = 'Auction reopened for 24h.';
      pushAudit({ propertyId: row.propertyId, propertyTitle: row.propertyTitle, type: 'reopen', message: msg });
      pushNoti('Auction Reopened', `${row.propertyTitle}: ${msg}`);
      return { ok: true, message: msg };
    }
    if (action === 'extend') {
      const base = Math.max(Date.now(), epoch(current.closesAt));
      current = ensureAuction(row.propertyId, { price: row.listedPrice }, { ...current, status: 'live', closesAt: new Date(base + 24 * 3600000).toISOString() });
      const msg = 'Auction extended by 24h.';
      pushAudit({ propertyId: row.propertyId, propertyTitle: row.propertyTitle, type: 'extend', message: msg });
      pushNoti('Auction Extended', `${row.propertyTitle}: ${msg}`);
      return { ok: true, message: msg };
    }
    if (action === 'settle') {
      const top = row.highestBid;
      if (!top) return { ok: false, message: 'No bids available to settle.' };
      current = ensureAuction(row.propertyId, { price: row.listedPrice }, { ...current, status: 'settled', winnerBidId: top.id, winnerBidAmount: top.amount, winnerBidderId: top.bidderId, winnerBidderName: top.bidderName, winnerAcceptedAt: nowIso() });
      const msg = `Winner settled at ${inr(top.amount)} (${top.bidderName}).`;
      pushAudit({ propertyId: row.propertyId, propertyTitle: row.propertyTitle, type: 'settle', message: msg });
      pushNoti('Auction Winner Settled', `${row.propertyTitle}: ${msg}`, ['seller', 'admin', 'customer'], 'success');
      return { ok: true, message: msg };
    }
    return { ok: false, message: 'Unknown action.' };
  };

  const exportCsv = (rows) => {
    const header = ['propertyId', 'propertyTitle', 'status', 'totalBids', 'highestBid', 'reservePrice', 'reserveGap', 'countdown', 'risk', 'flags'];
    const lines = rows.map((r) => [r.propertyId, r.propertyTitle, r.status, r.totalBids, r.highestAmount, r.reservePrice, r.reserveGap, r.countdown, r.risk, r.flags.join(' | ')].map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = `${header.join(',')}\n${lines.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `seller-auction-board-${Date.now()}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(a.href);
  };

  const saveControlPrefs = () => {
    savePrefs({ query: text(ui.query.value), status: text(ui.statusFilter.value, 'all').toLowerCase(), minIncPct: num(ui.minInc.value, 1), autoSec: num(ui.auto.value, 20), defaultHours: num(ui.hours.value, 72), showClosed: text(ui.showClosed.value, '1') === '1' });
  };

  const applyPrefs = () => {
    const p = prefs();
    ui.query.value = p.query; ui.statusFilter.value = p.status; ui.minInc.value = String(p.minIncPct); ui.auto.value = String(p.autoSec); ui.hours.value = String(p.defaultHours); ui.showClosed.value = p.showClosed ? '1' : '0';
    if (state.timer) clearInterval(state.timer);
    if (p.autoSec > 0) state.timer = setInterval(() => refresh(true).catch(() => null), p.autoSec * 1000);
  };

  const refresh = async (silent = false) => {
    state.listings = await loadListings();
    state.rows = buildRows(state.listings);
    renderOptions();
    state.selected = text(ui.property.value || state.selected);
    const selected = selectedRow();
    if (selected) { syncForm(selected); renderDetail(selected.propertyId); }
    const filtered = applyFilters(state.rows);
    renderKpis(filtered); renderBoard(filtered); renderAudit();
    if (!silent) setStatus(`Auction board refreshed (${filtered.length} listings).`);
  };

  ui.refresh.addEventListener('click', () => refresh().catch((e) => setStatus(text(e?.message, 'Refresh failed.'), false)));
  ui.save.addEventListener('click', async () => { const r = await doAction('save'); if (!r.ok) return setStatus(r.message, false); setStatus(r.message); await refresh(true); });
  ui.settle.addEventListener('click', async () => { const r = await doAction('settle'); if (!r.ok) return setStatus(r.message, false); setStatus(r.message); await refresh(true); });
  ui.ping.addEventListener('click', async () => { const r = await doAction('ping'); if (!r.ok) return setStatus(r.message, false); setStatus(r.message); await refresh(true); });
  ui.extend.addEventListener('click', async () => { const r = await doAction('extend'); if (!r.ok) return setStatus(r.message, false); setStatus(r.message); await refresh(true); });
  ui.closeNow.addEventListener('click', async () => { if (!window.confirm('Close selected auction now?')) return; const r = await doAction('close'); if (!r.ok) return setStatus(r.message, false); setStatus(r.message); await refresh(true); });
  ui.reopen.addEventListener('click', async () => { const r = await doAction('reopen'); if (!r.ok) return setStatus(r.message, false); setStatus(r.message); await refresh(true); });
  ui.csv.addEventListener('click', () => { const rows = applyFilters(state.rows); exportCsv(rows); setStatus(`CSV exported (${rows.length} rows).`); });
  ui.savePrefs.addEventListener('click', () => { saveControlPrefs(); applyPrefs(); refresh(true).catch(() => null); setStatus('Settings saved.'); });

  ui.property.addEventListener('change', () => { state.selected = text(ui.property.value); const r = selectedRow(); if (r) { syncForm(r); renderDetail(r.propertyId); } });
  [ui.query, ui.statusFilter, ui.showClosed].forEach((el) => { el.addEventListener('input', () => { const rows = applyFilters(state.rows); renderKpis(rows); renderBoard(rows); }); el.addEventListener('change', () => { const rows = applyFilters(state.rows); renderKpis(rows); renderBoard(rows); }); });

  ui.board.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = text(target.getAttribute('data-action')).toLowerCase();
    const id = text(target.getAttribute('data-id'));
    if (!action || !id) return;
    state.selected = id; ui.property.value = id;
    const row = selectedRow(); if (row) { syncForm(row); renderDetail(id); }
    if (action === 'details') return;
    const r = await doAction(action, id); if (!r.ok) return setStatus(r.message, false);
    setStatus(r.message); await refresh(true); renderDetail(id);
  });

  applyPrefs();
  refresh().catch((e) => setStatus(text(e?.message, 'Unable to load seller auction manager.'), false));
  window.addEventListener('beforeunload', () => { if (state.timer) clearInterval(state.timer); });
})();
