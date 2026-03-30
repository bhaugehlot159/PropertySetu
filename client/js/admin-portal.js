(() => {
  const live = window.PropertySetuLive || {};

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
  const pushNotification = (message, audience = ['all'], title = 'PropertySetu Update', type = 'info') => {
    if (!message) return;
    const notifyApi = window.PropertySetuNotify;
    if (notifyApi && typeof notifyApi.emit === 'function') {
      notifyApi.emit({ title, message, audience, type });
      return;
    }
    const existing = readJson('propertySetu:notifications', []);
    const list = Array.isArray(existing) ? existing : [];
    list.unshift({
      id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title,
      message,
      audience: Array.isArray(audience) ? audience : ['all'],
      type,
      createdAt: new Date().toISOString(),
      readBy: {},
    });
    while (list.length > 400) list.pop();
    saveJson('propertySetu:notifications', list);
    try {
      localStorage.setItem('propertySetu:notifications:ping', String(Date.now()));
    } catch {
      // no-op
    }
  };

  const getAdminToken = () => (live.getToken ? live.getToken('admin') : '');

  let verification = [];
  let reports = [];
  let bidRows = [];

  const loadLiveData = async () => {
    const token = getAdminToken();
    if (!token || !live.request) {
      verification = [];
      reports = [{ id: 'LIVE-REQ', label: 'Admin login + live backend required.' }];
      bidRows = [];
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
    } catch (error) {
      verification = [];
      reports = [{ id: 'LIVE-ERR', label: `Live admin fetch failed: ${String(error?.message || 'Unknown error')}` }];
      bidRows = [];
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
              <button type="button" data-bid-action="accept" data-bid-index="${idx}">Accept Highest</button>
              <button type="button" data-bid-action="reject" data-bid-index="${idx}">Reject All</button>
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
      window.alert('Live verification approval failed.');
      return;
    }
    await loadLiveData();
    renderQueue();
    renderBids();
    pushNotification(
      `Admin approved verification for property ${propertyId}.`,
      ['admin', 'seller'],
      'Verification Approved',
      'success',
    );
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
      const token = getAdminToken();
      if (!token || !live.request) {
        window.alert('Bid modify ke liye admin login + live backend required hai.');
        return;
      }
      try {
        await live.request('/sealed-bids/decision', {
          method: 'POST',
          token,
          data: { propertyId: bidRows[idx].propertyId, action: 'modify', modifiedAmount: nextValue },
        });
        await loadLiveData();
        renderBids();
        pushNotification(
          `Admin modified bid for ${bidRows[idx].propertyId} to ₹${Number(nextValue).toLocaleString('en-IN')}.`,
          ['admin', 'customer'],
          'Bid Modified',
          'warn',
        );
      } catch (error) {
        window.alert(error.message || 'Live bid modify failed.');
      }
      return;
    }

    if (action === 'reveal') {
      const token = getAdminToken();
      if (!token || !live.request) {
        window.alert('Bid reveal ke liye admin login + live backend required hai.');
        return;
      }
      try {
        await live.request('/sealed-bids/decision', {
          method: 'POST',
          token,
          data: { propertyId: bidRows[idx].propertyId, action: 'reveal' },
        });
        const winnerResponse = await live.request(`/sealed-bids/winner/${encodeURIComponent(bidRows[idx].propertyId)}`, { token });
        const winner = winnerResponse?.winner || null;
        await loadLiveData();
        renderBids();
        if (winner) {
          window.alert(`Winner: ${winner.bidderName || 'Bidder'} - ₹${Number(winner.amount || 0).toLocaleString('en-IN')}`);
        } else {
          window.alert('Winning bid reveal completed.');
        }
        pushNotification(
          `Winning bid revealed for ${bidRows[idx].propertyId}.`,
          ['admin', 'customer', 'seller'],
          'Bid Revealed',
          'success',
        );
      } catch (error) {
        window.alert(error.message || 'Live reveal action failed.');
      }
      return;
    }

    if (action === 'accept' || action === 'reject') {
      const token = getAdminToken();
      if (!token || !live.request) {
        window.alert(`Live ${action} action ke liye admin login required hai.`);
        return;
      }
      try {
        await live.request('/sealed-bids/decision', {
          method: 'POST',
          token,
          data: { propertyId: bidRows[idx].propertyId, action },
        });
        window.alert(action === 'accept' ? 'Highest bid accepted.' : 'All bids rejected.');
        await loadLiveData();
        renderBids();
        pushNotification(
          action === 'accept'
            ? `Admin accepted highest bid for ${bidRows[idx].propertyId}.`
            : `Admin rejected all bids for ${bidRows[idx].propertyId}.`,
          ['admin', 'customer', 'seller'],
          action === 'accept' ? 'Bid Accepted' : 'Bids Rejected',
          action === 'accept' ? 'success' : 'warn',
        );
      } catch (error) {
        window.alert(error.message || `Live ${action} action failed.`);
      }
    }
  });

  loadLiveData().then(() => {
    renderQueue();
    renderBids();
  });
})();
