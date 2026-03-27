(function () {
  const live = window.PropertySetuLive || {};
  const path = String(window.location.pathname || '').toLowerCase();
  const isAdminPage = path.includes('admin-dashboard') || Boolean(document.getElementById('pendingProperties'));
  const isSellerPage = path.includes('seller-dashboard') || Boolean(document.getElementById('addPropertyForm'));
  const isUserPage = path.includes('user-dashboard') || Boolean(document.getElementById('propertySelect'));
  const isPropertyPage = path.includes('property-details') || Boolean(document.getElementById('recommendedList'));

  if (!isAdminPage && !isSellerPage && !isUserPage && !isPropertyPage) return;
  if (document.getElementById('sealedBidV3Root')) return;

  const CORE_API_BASE = String(live.CORE_API_BASE || `${window.location.origin}/api/v3`);
  const STYLE_ID = 'sealed-bid-v3-tools-style';
  const LISTINGS_KEY = 'propertySetu:listings';

  if (!document.getElementById(STYLE_ID)) {
    const styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    styleEl.textContent = `
.sealed-bid-v3-shell input,
.sealed-bid-v3-shell select,
.sealed-bid-v3-shell textarea {
  box-sizing: border-box;
  border: 1px solid #cfdcf2;
  border-radius: 6px;
}
.sealed-bid-v3-shell button {
  cursor: pointer;
  border: none;
  border-radius: 6px;
  padding: 8px 12px;
}
.sealed-bid-v3-shell .actions-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.sealed-bid-v3-shell table {
  width: 100%;
  border-collapse: collapse;
}
.sealed-bid-v3-shell th,
.sealed-bid-v3-shell td {
  border: 1px solid #d6e1f5;
  padding: 8px;
  text-align: left;
}
@media (max-width: 768px) {
  .sealed-bid-v3-shell .top-row,
  .sealed-bid-v3-shell .actions-row {
    display: grid !important;
    grid-template-columns: 1fr;
  }
}
`;
    document.head.appendChild(styleEl);
  }

  const text = (value, fallback = '') => {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  };

  const toNumber = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const inr = (value) => `₹${toNumber(value, 0).toLocaleString('en-IN')}`;

  const escapeHtml = (value) => text(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const statusLabel = (value) => {
    const raw = text(value).toLowerCase();
    if (raw === 'submitted') return 'Submitted';
    if (raw === 'accepted') return 'Accepted';
    if (raw === 'rejected') return 'Rejected';
    if (raw === 'revealed') return 'Revealed';
    return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : 'Unknown';
  };

  const readJson = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const getAnySession = () => (typeof live.getAnySession === 'function' ? live.getAnySession() : null) || null;
  const getToken = () => (typeof live.getAnyToken === 'function' ? live.getAnyToken() : '') || '';
  const role = (() => {
    const raw = text(getAnySession()?.role).toLowerCase();
    if (raw === 'admin') return 'admin';
    if (raw === 'seller') return 'seller';
    if (raw === 'buyer' || raw === 'customer') return 'buyer';
    return '';
  })();
  const isAdminViewer = role === 'admin';

  async function requestCore(pathname, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const token = text(options.token || getToken());
    const data = options.data || null;
    const normalizedPath = String(pathname || '').startsWith('/') ? String(pathname) : `/${String(pathname || '')}`;

    if (typeof live.request === 'function') {
      return live.request(normalizedPath, {
        method,
        token,
        ...(data ? { data } : {}),
      });
    }

    const response = await fetch(`${CORE_API_BASE}${normalizedPath}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message || `Request failed (${response.status})`);
    }
    return payload;
  }

  function getMountTarget() {
    if (isAdminPage) {
      const adminPanel = document.getElementById('adminV3ToolsPanel');
      if (adminPanel?.parentElement) {
        const wrapper = document.createElement('div');
        adminPanel.parentElement.insertBefore(wrapper, adminPanel.nextSibling);
        return wrapper;
      }
    }

    if (isPropertyPage) {
      return document.querySelector('section.section') || document.body;
    }

    const sellerPanel = document.getElementById('sellerV3ToolsContainer');
    const userPanel = document.getElementById('userV3ToolsContainer');
    if (sellerPanel?.parentElement) {
      const wrapper = document.createElement('div');
      sellerPanel.parentElement.insertBefore(wrapper, sellerPanel.nextSibling);
      return wrapper;
    }
    if (userPanel?.parentElement) {
      const wrapper = document.createElement('div');
      userPanel.parentElement.insertBefore(wrapper, userPanel.nextSibling);
      return wrapper;
    }
    return document.body;
  }

  const mount = getMountTarget();

  const params = new URLSearchParams(window.location.search || '');
  const fromQuery = text(params.get('id') || params.get('propertyId'));
  const fromHash = text(String(window.location.hash || '').replace('#', ''));
  const initialPropertyId = fromQuery || fromHash;

  const shell = document.createElement('section');
  shell.id = 'sealedBidV3Root';
  shell.className = 'container sealed-bid-v3-shell';
  shell.style.marginTop = '18px';
  shell.innerHTML = `
<h2 style="margin:0 0 10px;">Sealed Bid V3 Tools</h2>
<div style="margin-bottom:12px;border:1px solid #d6e1f5;border-radius:10px;padding:12px;background:#fff;">
  <div class="top-row" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
    <label for="sbv3PropertyId" style="font-weight:700;">Property ID</label>
    <input id="sbv3PropertyId" placeholder="Enter property id" style="flex:1 1 200px;min-width:180px;padding:8px;" />
    <select id="sbv3PropertySelect" style="flex:1 1 240px;min-width:180px;padding:8px;"></select>
    <button id="sbv3SummaryBtn" style="background:#0b3d91;color:#fff;">Refresh Summary</button>
    <button id="sbv3WinnerBtn" style="background:#1f7a45;color:#fff;">Check Winner</button>
    <button id="sbv3MineBtn" style="background:#0b5c8a;color:#fff;">My Bids</button>
  </div>
  <p id="sbv3TopStatus" style="margin:8px 0 0;color:#1d4068;">Hidden bidding enabled. Amount is admin-only until reveal.</p>
</div>

<div style="margin-bottom:12px;border:1px solid #d6e1f5;border-radius:10px;padding:12px;background:#fff;">
  <h3 style="margin:0 0 8px;">Place Hidden Bid (Buyer/Seller)</h3>
  <div class="actions-row">
    <input id="sbv3Amount" type="number" min="1" step="1000" value="5000000" placeholder="Bid amount" style="flex:1 1 180px;padding:8px;" />
    <button id="sbv3PlaceBidBtn" style="background:#7a3a00;color:#fff;">Submit Sealed Bid</button>
  </div>
  <p id="sbv3PlaceStatus" style="margin:8px 0 0;color:#1d4068;"></p>
</div>

<div style="margin-bottom:12px;border:1px solid #d6e1f5;border-radius:10px;padding:12px;background:#fff;">
  <h3 style="margin:0 0 8px;">Summary (Amount hidden)</h3>
  <div id="sbv3SummaryWrap" style="overflow:auto;"></div>
</div>

<div style="margin-bottom:12px;border:1px solid #d6e1f5;border-radius:10px;padding:12px;background:#fff;">
  <h3 style="margin:0 0 8px;">My Bids</h3>
  <div id="sbv3MineWrap"></div>
</div>

<div style="margin-bottom:12px;border:1px solid #d6e1f5;border-radius:10px;padding:12px;background:#fff;">
  <h3 style="margin:0 0 8px;">Winner Status</h3>
  <div id="sbv3WinnerWrap"></div>
</div>

<div id="sbv3AdminSection" style="border:1px solid #d6e1f5;border-radius:10px;padding:12px;background:#fff;">
  <h3 style="margin:0 0 8px;">Admin Decision Controls</h3>
  <div class="actions-row">
    <select id="sbv3DecisionAction" style="min-width:180px;padding:8px;">
      <option value="accept">Accept Highest Bid</option>
      <option value="reject">Reject All Bids</option>
      <option value="reveal">Reveal Winner</option>
    </select>
    <button id="sbv3DecisionBtn" style="background:#4b2c82;color:#fff;">Apply Decision</button>
    <button id="sbv3AdminBoardBtn" style="background:#2c4f8a;color:#fff;">Refresh Admin Board</button>
  </div>
  <p id="sbv3AdminStatus" style="margin:8px 0 0;color:#1d4068;"></p>
  <div id="sbv3AdminBoardWrap" style="margin-top:8px;"></div>
</div>
`;

  mount.appendChild(shell);

  const ui = {
    propertyIdInput: document.getElementById('sbv3PropertyId'),
    propertySelect: document.getElementById('sbv3PropertySelect'),
    topStatus: document.getElementById('sbv3TopStatus'),
    amountInput: document.getElementById('sbv3Amount'),
    placeBidBtn: document.getElementById('sbv3PlaceBidBtn'),
    placeStatus: document.getElementById('sbv3PlaceStatus'),
    summaryBtn: document.getElementById('sbv3SummaryBtn'),
    summaryWrap: document.getElementById('sbv3SummaryWrap'),
    mineBtn: document.getElementById('sbv3MineBtn'),
    mineWrap: document.getElementById('sbv3MineWrap'),
    winnerBtn: document.getElementById('sbv3WinnerBtn'),
    winnerWrap: document.getElementById('sbv3WinnerWrap'),
    adminSection: document.getElementById('sbv3AdminSection'),
    adminBoardBtn: document.getElementById('sbv3AdminBoardBtn'),
    decisionAction: document.getElementById('sbv3DecisionAction'),
    decisionBtn: document.getElementById('sbv3DecisionBtn'),
    adminStatus: document.getElementById('sbv3AdminStatus'),
    adminBoardWrap: document.getElementById('sbv3AdminBoardWrap'),
  };

  if (!isAdminViewer) {
    ui.adminSection.style.opacity = '0.85';
    if (ui.adminStatus) {
      ui.adminStatus.textContent = 'Admin login required for full bid board and decision actions.';
      ui.adminStatus.style.color = '#8d1e1e';
    }
    if (ui.summaryBtn) ui.summaryBtn.disabled = true;
    if (ui.summaryWrap) {
      ui.summaryWrap.innerHTML = '<p style="margin:0;color:#607da8;">Hidden bid summary is admin-only. Buyer/seller can track only their own bids.</p>';
    }
    if (ui.decisionBtn) ui.decisionBtn.disabled = true;
    if (ui.adminBoardBtn) ui.adminBoardBtn.disabled = true;
  }

  function setStatus(el, message, isError = false) {
    if (!el) return;
    el.textContent = message;
    el.style.color = isError ? '#8d1e1e' : '#1d4068';
  }

  function getActivePropertyId() {
    return text(ui.propertyIdInput?.value || ui.propertySelect?.value || '');
  }

  function renderPropertyOptions(items = [], selectedId = '') {
    if (!ui.propertySelect) return;
    ui.propertySelect.innerHTML = '<option value="">Select property</option>' + items
      .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(`${item.title} (${item.location || item.city})`)}</option>`)
      .join('');
    if (selectedId && items.some((item) => item.id === selectedId)) {
      ui.propertySelect.value = selectedId;
    }
  }

  async function loadPropertyOptions() {
    try {
      const response = await requestCore('/properties?city=Udaipur&limit=150', { method: 'GET' });
      const items = Array.isArray(response?.items) ? response.items : [];
      return items
        .map((item) => ({
          id: text(item.id || item._id),
          title: text(item.title, 'Property'),
          location: text(item.location || item.locality, 'Udaipur'),
          city: text(item.city, 'Udaipur'),
        }))
        .filter((item) => item.id);
    } catch {
      const local = readJson(LISTINGS_KEY, []);
      if (!Array.isArray(local)) return [];
      return local
        .map((item) => ({
          id: text(item?.id),
          title: text(item?.title, 'Property'),
          location: text(item?.location || item?.locality, 'Udaipur'),
          city: text(item?.city, 'Udaipur'),
        }))
        .filter((item) => item.id);
    }
  }

  async function refreshSummary() {
    if (!isAdminViewer) {
      if (ui.summaryWrap) {
        ui.summaryWrap.innerHTML = '<p style="margin:0;color:#607da8;">Summary is available only for admin.</p>';
      }
      setStatus(ui.topStatus, 'Summary is admin-only in sealed hidden bidding policy.');
      return;
    }

    const token = getToken();
    if (!token) {
      setStatus(ui.topStatus, 'Summary dekhne ke liye login required.', true);
      if (ui.summaryWrap) ui.summaryWrap.innerHTML = '<p style="margin:0;color:#8d1e1e;">Login required.</p>';
      return;
    }
    const propertyId = getActivePropertyId();
    const query = new URLSearchParams();
    if (propertyId) query.set('propertyId', propertyId);
    query.set('limit', '500');
    try {
      const response = await requestCore(`/sealed-bids/summary?${query.toString()}`, { method: 'GET', token });
      const items = Array.isArray(response?.items) ? response.items : [];
      if (!items.length) {
        ui.summaryWrap.innerHTML = '<p style="margin:0;color:#607da8;">No sealed bids found.</p>';
        return;
      }
      ui.summaryWrap.innerHTML = `
<table>
  <thead>
    <tr>
      <th>Property</th>
      <th>Total Bids</th>
      <th>Status</th>
      <th>Winner Revealed</th>
      <th>Updated</th>
    </tr>
  </thead>
  <tbody>
    ${items.map((item) => `
      <tr>
        <td>${escapeHtml(text(item.propertyTitle, item.propertyId))}</td>
        <td>${toNumber(item.totalBids, 0)}</td>
        <td>${escapeHtml(statusLabel(item.status))}</td>
        <td>${item.winningBidRevealed ? 'Yes' : 'No'}</td>
        <td>${escapeHtml(item.updatedAt ? new Date(item.updatedAt).toLocaleString('en-IN') : '-')}</td>
      </tr>
    `).join('')}
  </tbody>
</table>`;
      setStatus(ui.topStatus, 'Summary refreshed.');
    } catch (error) {
      if (ui.summaryWrap) ui.summaryWrap.innerHTML = '';
      setStatus(ui.topStatus, `Summary load failed: ${error.message || 'Unknown error'}`, true);
    }
  }

  async function refreshMine() {
    const token = getToken();
    if (!token) {
      ui.mineWrap.innerHTML = '<p style="margin:0;color:#8d1e1e;">Login required for my bids.</p>';
      return;
    }
    const propertyId = getActivePropertyId();
    try {
      const response = await requestCore('/sealed-bids/mine?limit=300', { method: 'GET', token });
      let items = Array.isArray(response?.items) ? response.items : [];
      if (propertyId) {
        items = items.filter((item) => text(item.propertyId) === propertyId);
      }
      if (!items.length) {
        ui.mineWrap.innerHTML = '<p style="margin:0;color:#607da8;">No bids submitted yet.</p>';
        return;
      }
      ui.mineWrap.innerHTML = `<ul style="margin:0;padding-left:18px;">${items.map((item) => `
<li>
  <b>${escapeHtml(text(item.propertyTitle, item.propertyId))}</b>:
  ${inr(item.amount)} |
  ${escapeHtml(statusLabel(item.status))} |
  ${item.winnerRevealed ? 'Winner Revealed' : 'Hidden'}
</li>`).join('')}</ul>`;
    } catch (error) {
      ui.mineWrap.innerHTML = `<p style="margin:0;color:#8d1e1e;">My bids load failed: ${escapeHtml(error.message || 'Unknown error')}</p>`;
    }
  }

  async function placeBid() {
    const token = getToken();
    if (!token) {
      setStatus(ui.placeStatus, 'Bid submit karne ke liye login required.', true);
      return;
    }
    const propertyId = getActivePropertyId();
    const amount = Math.round(toNumber(ui.amountInput?.value, 0));
    if (!propertyId || amount <= 0) {
      setStatus(ui.placeStatus, 'Valid property ID and amount required.', true);
      return;
    }

    try {
      await requestCore('/sealed-bids', {
        method: 'POST',
        token,
        data: { propertyId, amount },
      });
      setStatus(ui.placeStatus, 'Sealed bid submitted successfully.');
      await refreshMine();
      if (isAdminViewer) {
        await refreshSummary();
      }
    } catch (error) {
      setStatus(ui.placeStatus, `Bid submit failed: ${error.message || 'Unknown error'}`, true);
    }
  }

  async function checkWinner() {
    const token = getToken();
    if (!token) {
      ui.winnerWrap.innerHTML = '<p style="margin:0;color:#8d1e1e;">Login required.</p>';
      return;
    }
    const propertyId = getActivePropertyId();
    if (!propertyId) {
      ui.winnerWrap.innerHTML = '<p style="margin:0;color:#8d1e1e;">Property ID required.</p>';
      return;
    }

    try {
      const response = await requestCore(`/sealed-bids/winner/${encodeURIComponent(propertyId)}`, {
        method: 'GET',
        token,
      });
      const winner = response?.winner || {};
      const totalBidsRow = Number.isFinite(Number(response?.totalBids))
        ? `Total Bids: <b>${toNumber(response?.totalBids, 0)}</b><br>`
        : '';
      const winnerAmount = toNumber(winner.amount ?? winner.winnerBidAmount, 0);
      const winnerBidLabel = winnerAmount > 0 ? inr(winnerAmount) : 'Hidden';
      const winnerName = text(winner.bidderName || winner.winnerBidder || winner.bidderRole, 'Hidden');
      ui.winnerWrap.innerHTML = `
<p style="margin:0;">
  <b>${escapeHtml(text(response?.propertyTitle, propertyId))}</b><br>
  Status: <b>${escapeHtml(statusLabel(response?.status))}</b><br>
  ${totalBidsRow}
  Winner Bid: <b>${winnerBidLabel}</b><br>
  Bidder: <b>${escapeHtml(winnerName)}</b>
</p>`;
    } catch (error) {
      ui.winnerWrap.innerHTML = `<p style="margin:0;color:#8d1e1e;">Winner unavailable: ${escapeHtml(error.message || 'Unknown error')}</p>`;
    }
  }

  async function refreshAdminBoard() {
    const token = getToken();
    if (!token) {
      setStatus(ui.adminStatus, 'Admin board dekhne ke liye login required.', true);
      ui.adminBoardWrap.innerHTML = '';
      return;
    }
    const propertyId = getActivePropertyId();
    const query = new URLSearchParams();
    if (propertyId) query.set('propertyId', propertyId);
    query.set('limit', '500');

    try {
      const response = await requestCore(`/sealed-bids/admin?${query.toString()}`, {
        method: 'GET',
        token,
      });
      const items = Array.isArray(response?.items) ? response.items : [];
      if (!items.length) {
        ui.adminBoardWrap.innerHTML = '<p style="margin:0;color:#607da8;">No admin bid data found.</p>';
        setStatus(ui.adminStatus, 'Admin board refreshed.');
        return;
      }

      ui.adminBoardWrap.innerHTML = items.map((item) => {
        const bids = Array.isArray(item.bids) ? item.bids : [];
        return `
<div style="margin:0 0 10px;border:1px solid #d6e1f5;border-radius:8px;padding:8px;background:#f8fbff;">
  <div><b>${escapeHtml(text(item.propertyTitle, item.propertyId))}</b></div>
  <div style="margin-top:4px;color:#1d4068;">Total Bids: ${toNumber(item.totalBids, 0)} | Status: ${escapeHtml(statusLabel(item.status))}</div>
  <div style="margin-top:6px;overflow:auto;">
    <table>
      <thead><tr><th>Bidder</th><th>Role</th><th>Amount</th><th>Status</th><th>Created</th></tr></thead>
      <tbody>
        ${bids.map((bid) => `
          <tr>
            <td>${escapeHtml(text(bid.bidderName, bid.bidderId))}</td>
            <td>${escapeHtml(text(bid.bidderRole, '-'))}</td>
            <td>${inr(bid.amount)}</td>
            <td>${escapeHtml(statusLabel(bid.status))}${bid.winnerRevealed ? ' (revealed)' : ''}</td>
            <td>${escapeHtml(bid.createdAt ? new Date(bid.createdAt).toLocaleString('en-IN') : '-')}</td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>
</div>`;
      }).join('');
      setStatus(ui.adminStatus, 'Admin board refreshed.');
    } catch (error) {
      ui.adminBoardWrap.innerHTML = '';
      setStatus(ui.adminStatus, `Admin board failed: ${error.message || 'Unknown error'}`, true);
    }
  }

  async function applyDecision() {
    const token = getToken();
    if (!token) {
      setStatus(ui.adminStatus, 'Decision apply karne ke liye login required.', true);
      return;
    }
    const propertyId = getActivePropertyId();
    const action = text(ui.decisionAction?.value).toLowerCase();
    if (!propertyId || !action) {
      setStatus(ui.adminStatus, 'Property ID and action required.', true);
      return;
    }

    try {
      await requestCore('/sealed-bids/decision', {
        method: 'POST',
        token,
        data: { propertyId, action },
      });
      setStatus(ui.adminStatus, `Decision applied: ${action}.`);
      await refreshAdminBoard();
      await refreshSummary();
      await checkWinner();
    } catch (error) {
      setStatus(ui.adminStatus, `Decision failed: ${error.message || 'Unknown error'}`, true);
    }
  }

  ui.propertySelect?.addEventListener('change', () => {
    const id = text(ui.propertySelect.value);
    if (ui.propertyIdInput) ui.propertyIdInput.value = id;
  });

  const existingPropertySelect = document.getElementById('propertySelect');
  existingPropertySelect?.addEventListener('change', () => {
    const id = text(existingPropertySelect.value);
    if (id && ui.propertyIdInput) ui.propertyIdInput.value = id;
  });

  ui.summaryBtn?.addEventListener('click', refreshSummary);
  ui.mineBtn?.addEventListener('click', refreshMine);
  ui.placeBidBtn?.addEventListener('click', placeBid);
  ui.winnerBtn?.addEventListener('click', checkWinner);
  ui.adminBoardBtn?.addEventListener('click', refreshAdminBoard);
  ui.decisionBtn?.addEventListener('click', applyDecision);

  (async () => {
    const options = await loadPropertyOptions();
    const fallbackId = text(options[0]?.id);
    const selectedId = initialPropertyId || fallbackId;
    renderPropertyOptions(options, selectedId);
    if (ui.propertyIdInput) ui.propertyIdInput.value = selectedId;

    if (!getToken()) {
      setStatus(ui.topStatus, 'Login required for sealed bid APIs.', true);
      return;
    }

    if (isAdminViewer) {
      await refreshSummary();
    }
    await refreshMine();
    if (selectedId) {
      await checkWinner();
    }
    if (isAdminViewer) {
      await refreshAdminBoard();
    }
  })();
})();
