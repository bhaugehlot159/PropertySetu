(() => {
  if (document.getElementById('customerAuctionArenaProCard')) return;
  const live = window.PropertySetuLive || {};
  const propertySelect = document.getElementById('propertySelect');
  if (!propertySelect) return;

  const CARD_ID = 'customerAuctionArenaProCard';
  const STYLE_ID = 'customer-auction-arena-pro-style';
  const LISTINGS_KEY = 'propertySetu:listings';
  const AUC_KEY = 'propertySetu:auctionState';
  const BID_KEY = 'propertySetu:auctionBids';
  const PREF_KEY = 'propertySetu:auctionPrefs';
  const WATCH_KEY = 'propertySetu:auctionWatchlist';
  const AUDIT_KEY = 'propertySetu:auctionAudit';

  const text = (v, f = '') => { const s = String(v || '').trim(); return s || f; };
  const num = (v, f = 0) => { const n = Number(v); return Number.isFinite(n) ? n : f; };
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const inr = (v) => `Rs ${Math.round(num(v, 0)).toLocaleString('en-IN')}`;
  const esc = (v) => String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;');
  const epoch = (v) => { const t = new Date(v || '').getTime(); return Number.isFinite(t) ? t : 0; };
  const nowIso = () => new Date().toISOString();

  const read = live.readJson || ((k, f) => { try { const raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : f; } catch { return f; } });
  const write = live.writeJson || ((k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* no-op */ } });

  const prefs = () => {
    const p = read(PREF_KEY, {});
    return {
      minIncPct: clamp(num(p?.minIncPct, 1), 0.25, 10),
      quickPct: clamp(num(p?.quickPct, 2), 0.5, 15),
      autoSec: clamp(Math.round(num(p?.autoSec, 20)), 0, 120),
      hours: clamp(Math.round(num(p?.hours, 72)), 12, 720),
    };
  };
  const savePrefs = (p) => write(PREF_KEY, { ...prefs(), ...(p || {}) });

  const listingMap = () => {
    const map = new Map();
    const rows = read(LISTINGS_KEY, []);
    (Array.isArray(rows) ? rows : []).forEach((r) => {
      const id = text(r?.id || r?._id);
      if (!id) return;
      map.set(id, {
        id,
        title: text(r?.title, id),
        price: Math.max(0, Math.round(num(r?.price, 0))),
        city: text(r?.city, 'Udaipur'),
        location: text(r?.location || r?.locality, 'Udaipur'),
      });
    });
    return map;
  };

  const auctionState = () => {
    const s = read(AUC_KEY, {});
    return s && typeof s === 'object' ? s : {};
  };
  const saveAuctionState = (s) => write(AUC_KEY, s && typeof s === 'object' ? s : {});

  const allBids = () => {
    const rows = read(BID_KEY, []);
    return (Array.isArray(rows) ? rows : [])
      .map((r) => ({
        id: text(r?.id),
        propertyId: text(r?.propertyId),
        bidderName: text(r?.bidderName, 'Bidder'),
        bidderRole: text(r?.bidderRole, 'buyer'),
        amount: Math.max(0, Math.round(num(r?.amount, 0))),
        createdAt: text(r?.createdAt, nowIso()),
      }))
      .filter((r) => r.id && r.propertyId)
      .sort((a, b) => (b.amount - a.amount) || (epoch(a.createdAt) - epoch(b.createdAt)));
  };
  const saveAllBids = (rows) => write(BID_KEY, (Array.isArray(rows) ? rows : []).slice(0, 4000));

  const watch = () => {
    const rows = read(WATCH_KEY, []);
    return Array.isArray(rows) ? rows.map((id) => text(id)).filter(Boolean) : [];
  };
  const saveWatch = (rows) => write(WATCH_KEY, Array.from(new Set((Array.isArray(rows) ? rows : []).map((id) => text(id)).filter(Boolean))).slice(0, 300));

  const audit = () => {
    const rows = read(AUDIT_KEY, []);
    return Array.isArray(rows) ? rows : [];
  };
  const pushAudit = (entry) => {
    const rows = audit();
    rows.unshift({
      id: `auc-a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: nowIso(),
      propertyId: text(entry?.propertyId),
      type: text(entry?.type, 'info'),
      message: text(entry?.message),
    });
    write(AUDIT_KEY, rows.slice(0, 250));
  };

  const session = () => {
    if (typeof live.getAnySession === 'function') return live.getAnySession() || {};
    return read('propertysetu-user-session', {}) || {};
  };
  const actor = () => {
    const s = session();
    return { name: text(s?.name, 'Guest Bidder'), role: text(s?.role, 'buyer').toLowerCase() };
  };

  const statusOf = (auc) => {
    if (text(auc?.status).toLowerCase() === 'closed') return 'closed';
    const close = epoch(auc?.closesAt);
    return close && close <= Date.now() ? 'closed' : 'live';
  };
  const countdown = (iso) => {
    const diff = epoch(iso) - Date.now();
    if (diff <= 0) return 'Closed';
    const mins = Math.floor(diff / 60000);
    const d = Math.floor(mins / 1440); const h = Math.floor((mins % 1440) / 60); const m = mins % 60;
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
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

  const ensureAuction = (id, listing) => {
    const map = auctionState();
    if (map[id]) return map[id];
    const p = prefs();
    map[id] = {
      propertyId: id,
      reservePrice: Math.max(1000, Math.round(num(listing?.price, 0) * 0.9)),
      closesAt: new Date(Date.now() + p.hours * 3600000).toISOString(),
      status: 'live',
      updatedAt: nowIso(),
    };
    saveAuctionState(map);
    return map[id];
  };

  const bidsFor = (id) => allBids().filter((b) => b.propertyId === id);
  const highest = (id) => bidsFor(id)[0] || null;
  const minNext = (auc, top, p) => {
    const reserve = Math.max(0, Math.round(num(auc?.reservePrice, 0)));
    if (!top) return reserve;
    const step = Math.max(top.amount >= 1000000 ? 5000 : 1000, Math.round(top.amount * (clamp(num(p?.minIncPct, 1), 0.25, 10) / 100)));
    return Math.max(reserve, top.amount + step);
  };

  if (!document.getElementById(STYLE_ID)) {
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = `
#${CARD_ID}{margin-top:16px}
#${CARD_ID} .box{border:1px solid #d6e1f5;border-radius:10px;background:#fff;padding:10px}
#${CARD_ID} .grid{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}
#${CARD_ID} label{display:block;font-size:12px;color:#35597d;margin-bottom:4px}
#${CARD_ID} input{width:100%;border:1px solid #cad9ef;border-radius:8px;padding:8px 10px;box-sizing:border-box}
#${CARD_ID} .row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
#${CARD_ID} .btn{border:1px solid #0b3d91;background:#0b3d91;color:#fff;border-radius:8px;padding:8px 12px;cursor:pointer;font-weight:700}
#${CARD_ID} .btn.alt{background:#fff;color:#0b3d91}
#${CARD_ID} .btn.warn{border-color:#8d1e1e;background:#8d1e1e}
#${CARD_ID} .kpis{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-top:10px}
#${CARD_ID} .kpi{border:1px solid #d6e1f5;background:#f8fbff;border-radius:8px;padding:8px}
#${CARD_ID} .kpi small{color:#58718f;display:block} #${CARD_ID} .kpi b{color:#11466e}
#${CARD_ID} table{width:100%;border-collapse:collapse} #${CARD_ID} th,#${CARD_ID} td{border:1px solid #d6e1f5;padding:8px;text-align:left}
#${CARD_ID} th{background:#f4f8ff;color:#11466e}
#${CARD_ID} .chip{display:inline-block;padding:2px 8px;border-radius:999px;font-size:12px;background:#e9f0ff;color:#1f3e7a;margin-right:6px}
`;
    document.head.appendChild(st);
  }

  const root = document.createElement('div');
  root.id = CARD_ID;
  root.className = 'container';
  root.innerHTML = `
<div class="box"><h2 style="margin:0 0 8px;">Customer Auction Arena Pro</h2><p style="margin:0;color:#1d4068;">Open auction board with reserve, quick bids, watchlist and audit trail.</p></div>
<div class="box" style="margin-top:10px;">
  <div class="grid">
    <div><label for="caaProperty">Property</label><input id="caaProperty"/></div>
    <div><label for="caaReserve">Reserve Price</label><input id="caaReserve" type="number" min="1000" step="1000"/></div>
    <div><label for="caaClose">Close Time</label><input id="caaClose" type="datetime-local"/></div>
    <div><label for="caaBid">Bid Amount</label><input id="caaBid" type="number" min="1000" step="1000"/></div>
  </div>
  <div class="row" style="margin-top:10px;">
    <button id="caaRefresh" class="btn" type="button">Refresh</button>
    <button id="caaSaveAuc" class="btn alt" type="button">Save Auction</button>
    <button id="caaCloseNow" class="btn warn" type="button">Close Auction</button>
    <button id="caaBidBtn" class="btn" type="button">Place Bid</button>
    <button id="caaQuick" class="btn alt" type="button">Quick +%</button>
    <button id="caaWatch" class="btn alt" type="button">Watch</button>
    <span id="caaStatus" class="chip">Ready</span>
  </div>
</div>
<div class="box" style="margin-top:10px;">
  <div class="grid">
    <div><label for="caaMinInc">Min Increment %</label><input id="caaMinInc" type="number" min="0.25" max="10" step="0.25"/></div>
    <div><label for="caaQuickPct">Quick Bid %</label><input id="caaQuickPct" type="number" min="0.5" max="15" step="0.5"/></div>
    <div><label for="caaAuto">Auto Refresh sec</label><input id="caaAuto" type="number" min="0" max="120" step="5"/></div>
    <div><label for="caaHours">Default Duration hours</label><input id="caaHours" type="number" min="12" max="720" step="12"/></div>
  </div>
  <div class="row" style="margin-top:10px;"><button id="caaSavePrefs" class="btn alt" type="button">Save Settings</button><button id="caaCsv" class="btn alt" type="button">Export CSV</button></div>
</div>
<div id="caaKpis" class="kpis"></div>
<div class="box" style="margin-top:10px;"><h3 style="margin:0 0 8px;">Top Bids</h3><div id="caaTable" style="overflow:auto;"></div></div>
<div class="box" style="margin-top:10px;"><h3 style="margin:0 0 8px;">Watchlist</h3><div id="caaWatchWrap"></div></div>
<div class="box" style="margin-top:10px;"><h3 style="margin:0 0 8px;">Audit</h3><div id="caaAudit" style="max-height:190px;overflow:auto;"></div></div>
`;

  const anchor = document.getElementById('customerDecisionRoomCard') || document.querySelector('.container');
  if (anchor?.parentElement) anchor.insertAdjacentElement('afterend', root); else document.body.appendChild(root);

  const ui = {
    property: document.getElementById('caaProperty'), reserve: document.getElementById('caaReserve'), close: document.getElementById('caaClose'), bid: document.getElementById('caaBid'),
    refresh: document.getElementById('caaRefresh'), saveAuc: document.getElementById('caaSaveAuc'), closeNow: document.getElementById('caaCloseNow'), bidBtn: document.getElementById('caaBidBtn'), quick: document.getElementById('caaQuick'), watch: document.getElementById('caaWatch'), status: document.getElementById('caaStatus'),
    minInc: document.getElementById('caaMinInc'), quickPct: document.getElementById('caaQuickPct'), auto: document.getElementById('caaAuto'), hours: document.getElementById('caaHours'), savePrefsBtn: document.getElementById('caaSavePrefs'), csv: document.getElementById('caaCsv'),
    kpis: document.getElementById('caaKpis'), table: document.getElementById('caaTable'), watchWrap: document.getElementById('caaWatchWrap'), auditWrap: document.getElementById('caaAudit'),
  };

  const state = { selected: '', timer: null };
  const setStatus = (m, ok = true) => { ui.status.textContent = text(m); ui.status.style.color = ok ? '#1d4068' : '#8d1e1e'; };

  const renderAudit = () => {
    const rows = audit();
    ui.auditWrap.innerHTML = rows.length ? rows.slice(0, 20).map((r) => `<div style="border-bottom:1px solid #e1e9f8;padding:6px 0;"><b>${esc(r.type)}</b> - ${esc(r.propertyId)}<br>${esc(r.message)}<br><span style="color:#6d86a5;">${esc(new Date(r.at).toLocaleString('en-IN'))}</span></div>`).join('') : '<p style="margin:0;color:#607da8;">No audit entries.</p>';
  };

  const renderWatch = (map) => {
    const rows = watch();
    ui.watchWrap.innerHTML = rows.length ? rows.map((id) => `<span class="chip">${esc(text(map.get(id)?.title, id))}</span>`).join(' ') : '<p style="margin:0;color:#607da8;">Watchlist empty.</p>';
  };

  const render = () => {
    state.selected = text(ui.property.value || propertySelect.value || state.selected);
    if (!state.selected) { setStatus('Select a property first.', false); return; }
    ui.property.value = state.selected;
    if (propertySelect.value !== state.selected) {
      const found = Array.from(propertySelect.options).some((o) => text(o.value) === state.selected);
      if (found) propertySelect.value = state.selected;
    }
    const p = prefs();
    const map = listingMap();
    const listing = map.get(state.selected) || { id: state.selected, title: state.selected, price: 0 };
    const auc = ensureAuction(state.selected, listing);
    const top = highest(state.selected);
    const minBid = minNext(auc, top, p);
    const rows = bidsFor(state.selected);
    const uniq = Array.from(new Set(rows.map((b) => b.bidderName))).length;

    ui.reserve.value = String(Math.max(1000, Math.round(num(auc.reservePrice, listing.price || 1000))));
    ui.close.value = toLocal(auc.closesAt);
    if (!text(ui.bid.value) || num(ui.bid.value, 0) < minBid) ui.bid.value = String(minBid);

    ui.kpis.innerHTML = `
<div class="kpi"><small>Property</small><b>${esc(text(listing.title, state.selected))}</b></div>
<div class="kpi"><small>Status</small><b>${esc(statusOf(auc).toUpperCase())}</b></div>
<div class="kpi"><small>Reserve</small><b>${inr(auc.reservePrice)}</b></div>
<div class="kpi"><small>Highest</small><b>${top ? inr(top.amount) : '-'}</b></div>
<div class="kpi"><small>Min Next</small><b>${inr(minBid)}</b></div>
<div class="kpi"><small>Total Bids</small><b>${rows.length}</b></div>
<div class="kpi"><small>Unique Bidders</small><b>${uniq}</b></div>
<div class="kpi"><small>Countdown</small><b>${esc(countdown(auc.closesAt))}</b></div>`;

    ui.table.innerHTML = rows.length ? `<table><thead><tr><th>#</th><th>Bidder</th><th>Role</th><th>Amount</th><th>Time</th></tr></thead><tbody>${rows.slice(0, 20).map((b, i) => `<tr><td>${i + 1}</td><td>${esc(b.bidderName)}</td><td>${esc(b.bidderRole)}</td><td>${inr(b.amount)}</td><td>${esc(new Date(b.createdAt).toLocaleString('en-IN'))}</td></tr>`).join('')}</tbody></table>` : '<p style="margin:0;color:#607da8;">No bids yet.</p>';

    const isWatch = watch().includes(state.selected);
    ui.watch.textContent = isWatch ? 'Unwatch' : 'Watch';
    renderWatch(map);
    renderAudit();
    setStatus(`Auction refreshed for ${text(listing.title, state.selected)}.`);
  };

  const placeBid = () => {
    const id = text(ui.property.value || state.selected);
    if (!id) { setStatus('Property ID required.', false); return; }
    const map = listingMap();
    const listing = map.get(id) || { id, title: id, price: 0 };
    const auc = ensureAuction(id, listing);
    if (statusOf(auc) !== 'live') { setStatus('Auction closed.', false); return; }
    const p = prefs();
    const top = highest(id);
    const minBid = minNext(auc, top, p);
    const amount = Math.max(0, Math.round(num(ui.bid.value, 0)));
    if (amount < minBid) { setStatus(`Bid must be at least ${inr(minBid)}.`, false); return; }
    const a = actor();
    const rows = allBids();
    rows.push({ id: `auc-b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, propertyId: id, bidderName: a.name, bidderRole: a.role || 'buyer', amount, createdAt: nowIso() });
    saveAllBids(rows);
    pushAudit({ propertyId: id, type: 'bid-place', message: `${a.name} placed ${inr(amount)}.` });
    setStatus(`Bid placed at ${inr(amount)}.`);
    render();
  };

  const saveAuction = () => {
    const id = text(ui.property.value || state.selected);
    if (!id) { setStatus('Property ID required.', false); return; }
    const closeIso = fromLocal(ui.close.value);
    if (!closeIso) { setStatus('Valid close time required.', false); return; }
    const map = auctionState();
    map[id] = {
      ...(map[id] || {}),
      propertyId: id,
      reservePrice: Math.max(1000, Math.round(num(ui.reserve.value, 1000))),
      closesAt: closeIso,
      status: epoch(closeIso) <= Date.now() ? 'closed' : 'live',
      updatedAt: nowIso(),
    };
    saveAuctionState(map);
    pushAudit({ propertyId: id, type: 'auction-save', message: `Reserve ${inr(map[id].reservePrice)}, close ${new Date(closeIso).toLocaleString('en-IN')}.` });
    setStatus('Auction saved.');
    render();
  };

  const closeNow = () => {
    const id = text(ui.property.value || state.selected);
    if (!id) { setStatus('Property ID required.', false); return; }
    const map = auctionState();
    map[id] = { ...(map[id] || { propertyId: id }), closesAt: nowIso(), status: 'closed', updatedAt: nowIso() };
    saveAuctionState(map);
    const top = highest(id);
    pushAudit({ propertyId: id, type: 'auction-close', message: top ? `Winner ${top.bidderName} at ${inr(top.amount)}.` : 'Closed with no bids.' });
    setStatus('Auction closed.');
    render();
  };

  const quickBid = () => {
    const id = text(ui.property.value || state.selected);
    if (!id) { setStatus('Property ID required.', false); return; }
    const p = prefs();
    const map = listingMap();
    const auc = ensureAuction(id, map.get(id) || { id, price: 0 });
    const top = highest(id);
    const minBid = minNext(auc, top, p);
    const quickAmount = top ? Math.max(minBid, Math.round(top.amount * (1 + p.quickPct / 100))) : minBid;
    ui.bid.value = String(quickAmount);
    setStatus(`Quick bid set to ${inr(quickAmount)}.`);
  };

  const toggleWatch = () => {
    const id = text(ui.property.value || state.selected);
    if (!id) { setStatus('Property ID required.', false); return; }
    const rows = watch();
    const next = rows.includes(id) ? rows.filter((x) => x !== id) : [id, ...rows];
    saveWatch(next);
    pushAudit({ propertyId: id, type: rows.includes(id) ? 'unwatch' : 'watch', message: rows.includes(id) ? 'Removed from watchlist.' : 'Added to watchlist.' });
    render();
  };

  const exportCsv = () => {
    const id = text(ui.property.value || state.selected);
    if (!id) { setStatus('Property ID required.', false); return; }
    const rows = bidsFor(id);
    if (!rows.length) { setStatus('No bids to export.', false); return; }
    const header = ['rank', 'propertyId', 'bidderName', 'bidderRole', 'amount', 'createdAt'];
    const lines = rows.map((r, i) => [i + 1, r.propertyId, r.bidderName, r.bidderRole, r.amount, r.createdAt].map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = `${header.join(',')}\n${lines.join('\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `auction-${id}-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    setStatus(`CSV exported (${rows.length} bids).`);
  };

  const applyPrefs = () => {
    const p = prefs();
    ui.minInc.value = String(p.minIncPct); ui.quickPct.value = String(p.quickPct); ui.auto.value = String(p.autoSec); ui.hours.value = String(p.hours);
    if (state.timer) clearInterval(state.timer);
    if (p.autoSec > 0) state.timer = setInterval(render, p.autoSec * 1000);
  };

  ui.refresh.addEventListener('click', render);
  ui.saveAuc.addEventListener('click', saveAuction);
  ui.closeNow.addEventListener('click', closeNow);
  ui.bidBtn.addEventListener('click', placeBid);
  ui.quick.addEventListener('click', quickBid);
  ui.watch.addEventListener('click', toggleWatch);
  ui.savePrefsBtn.addEventListener('click', () => {
    savePrefs({ minIncPct: num(ui.minInc.value, 1), quickPct: num(ui.quickPct.value, 2), autoSec: num(ui.auto.value, 20), hours: num(ui.hours.value, 72) });
    applyPrefs();
    setStatus('Settings saved.');
    render();
  });
  ui.csv.addEventListener('click', exportCsv);

  ui.property.addEventListener('change', () => { state.selected = text(ui.property.value); render(); });
  propertySelect.addEventListener('change', () => { state.selected = text(propertySelect.value); ui.property.value = state.selected; render(); });

  state.selected = text(propertySelect.value);
  ui.property.value = state.selected;
  applyPrefs();
  render();
  window.addEventListener('beforeunload', () => { if (state.timer) clearInterval(state.timer); });
})();
