(() => {
  const live = window.PropertySetuLive || {};
  const bidKey = 'propertySetu:sealedBids';

  const verificationQueue = document.getElementById('verificationQueue');
  const reportQueue = document.getElementById('reportQueue');
  const bidQueue = document.getElementById('bidQueue');
  if (!verificationQueue || !reportQueue || !bidQueue) return;

  const readJson = live.readJson || ((key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  });
  const saveJson = live.writeJson || ((key, value) => localStorage.setItem(key, JSON.stringify(value)));

  const getAdminToken = () => (live.getToken ? live.getToken('admin') : '');

  let verification = [];
  let reports = [];
  let bidRows = [];

  const ensureSeedBids = () => {
    const bids = readJson(bidKey, []);
    if (bids.length) return;
    saveJson(bidKey, [{
      propertyId: 'demo-1',
      amount: 4500000,
      bidder: 'buyer-22',
      publicVisible: false,
      modifiedByAdmin: null,
      createdAt: new Date().toISOString(),
    }]);
  };

  const fallbackData = () => {
    const localListings = readJson('propertySetu:listings', [])
      .filter((item) => String(item?.city || 'Udaipur').toLowerCase().includes('udaipur'));
    verification = localListings
      .filter((item) => String(item.status || 'Pending Approval').toLowerCase() !== 'approved')
      .slice(0, 12)
      .map((item) => ({
        id: item.id,
        label: `${item.title || 'Property'} - ${item.location || 'Udaipur'}`,
        risk: item?.aiReview?.fraudRiskScore > 60 ? 'High' : 'Low',
      }));
    reports = [
      { id: 'R-28', label: 'Suspicious pricing complaint queue' },
      { id: 'R-31', label: 'Possible duplicate media queue' },
      { id: 'R-36', label: 'Ownership proof re-check queue' },
    ];
    bidRows = readJson(bidKey, []).map((item, idx) => ({ ...item, idx }));
  };

  const loadLiveData = async () => {
    const token = getAdminToken();
    if (!token || !live.request) {
      fallbackData();
      return;
    }
    try {
      const [pending, summary] = await Promise.all([
        live.request('/admin/properties?status=Pending%20Approval', { token }),
        live.request('/sealed-bids/summary', { token }),
      ]);

      verification = (pending?.items || []).slice(0, 20).map((item) => ({
        id: item.id,
        label: `${item.title || 'Property'} - ${item.location || 'Udaipur'}`,
        risk: item?.aiReview?.fraudRiskScore > 60 ? 'High' : 'Low',
      }));
      reports = [
        { id: 'R-LIVE-1', label: `Pending approvals: ${pending?.total || 0}` },
        { id: 'R-LIVE-2', label: `Bid-active properties: ${(summary?.items || []).length}` },
        { id: 'R-LIVE-3', label: 'Use Admin Dashboard for full moderation actions' },
      ];
      bidRows = (summary?.items || []).map((item, idx) => ({
        propertyId: item.propertyId,
        propertyTitle: item.propertyTitle,
        totalBids: item.totalBids,
        amount: 0,
        bidder: 'Hidden',
        publicVisible: false,
        idx,
      }));
    } catch {
      fallbackData();
    }
  };

  const renderQueue = () => {
    verificationQueue.innerHTML = verification.length
      ? verification
        .map((item) => `<li><span>${item.id} • ${item.label} (${item.risk})</span><button type="button" data-verify-id="${item.id}">Approve</button></li>`)
        .join('')
      : '<li><span>No pending verification queue.</span></li>';

    reportQueue.innerHTML = reports.length
      ? reports.map((item) => `<li><span>${item.id} • ${item.label}</span><button type="button">Resolve</button></li>`).join('')
      : '<li><span>No report queue.</span></li>';
  };

  const renderBids = () => {
    bidQueue.innerHTML = bidRows.length
      ? bidRows
        .map((item, idx) => `
          <li>
            <span>${item.propertyId} • ${item.propertyTitle || ''} • ${item.totalBids || 1} bid(s)</span>
            <span style="display:flex;gap:6px;align-items:center;">
              <input data-bid-input="${idx}" type="number" min="0" placeholder="Modify" />
              <button type="button" data-bid-action="modify" data-bid-index="${idx}">Modify</button>
              <button type="button" data-bid-action="reveal" data-bid-index="${idx}">${item.publicVisible ? 'Revealed' : 'Reveal'}</button>
            </span>
          </li>`).join('')
      : '<li><span>No bids yet from customers.</span></li>';
  };

  const approveLive = async (propertyId) => {
    const token = getAdminToken();
    if (!token || !live.request) return false;
    try {
      await live.request(`/properties/${encodeURIComponent(propertyId)}/approve`, {
        method: 'POST',
        token,
        data: { status: 'Approved' },
      });
      return true;
    } catch {
      return false;
    }
  };

  verificationQueue.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const propertyId = target.getAttribute('data-verify-id');
    if (!propertyId) return;
    const ok = await approveLive(propertyId);
    if (!ok) {
      const localListings = readJson('propertySetu:listings', []);
      const updated = localListings.map((item) => (item.id === propertyId ? { ...item, status: 'Approved' } : item));
      saveJson('propertySetu:listings', updated);
    }
    await loadLiveData();
    renderQueue();
    renderBids();
  });

  bidQueue.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const action = target.getAttribute('data-bid-action');
    const idx = Number(target.getAttribute('data-bid-index'));
    if (!action || Number.isNaN(idx) || !bidRows[idx]) return;

    if (action === 'modify') {
      const input = bidQueue.querySelector(`[data-bid-input="${idx}"]`);
      const nextValue = Number(input?.value || 0);
      if (!nextValue || nextValue <= 0) return;
      const localBids = readJson(bidKey, []);
      if (localBids[idx]) {
        localBids[idx].modifiedByAdmin = nextValue;
        localBids[idx].amount = nextValue;
        saveJson(bidKey, localBids);
      }
      bidRows[idx].amount = nextValue;
      bidRows[idx].modifiedByAdmin = nextValue;
      renderBids();
      return;
    }

    if (action === 'reveal') {
      const token = getAdminToken();
      if (token && live.request) {
        try {
          const response = await live.request('/sealed-bids/reveal', { token });
          const winner = (response?.winners || []).find((item) => item.propertyId === bidRows[idx].propertyId);
          if (winner) {
            window.alert(`Winner: ${winner.winnerBid.bidderName} - ₹${Number(winner.winnerBid.amount || 0).toLocaleString('en-IN')}`);
            bidRows[idx].publicVisible = true;
            renderBids();
            return;
          }
        } catch {
          // fallback below
        }
      }

      bidRows[idx].publicVisible = true;
      const amount = Number(bidRows[idx].amount || 0).toLocaleString('en-IN');
      window.alert(`Bid reveal (local fallback): ₹${amount}`);
      renderBids();
    }
  });

  ensureSeedBids();
  loadLiveData().then(() => {
    renderQueue();
    renderBids();
  });
})();
