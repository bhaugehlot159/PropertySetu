(() => {
  const live = window.PropertySetuLive || {};
  const portalStateKey = 'propertySetu:customerPortal';
  const sealedBidKey = 'propertySetu:sealedBids';
  const marketStateKey = 'propertysetu-marketplace-state';

  const defaultState = {
    wishlist: 0,
    visits: 0,
    compare: 0,
    bids: 0,
    verifiedSearches: 0,
    logs: [],
  };

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

  const elements = {
    wishCount: document.getElementById('wishCount'),
    visitCount: document.getElementById('visitCount'),
    compareCount: document.getElementById('compareCount'),
    bidCount: document.getElementById('bidCount'),
    verifiedCount: document.getElementById('verifiedCount'),
    activityLog: document.getElementById('activityLog'),
    saveDemo: document.getElementById('saveDemo'),
    bookVisit: document.getElementById('bookVisit'),
    verifiedSearch: document.getElementById('verifiedSearch'),
    clearPortal: document.getElementById('clearPortal'),
    placeBid: document.getElementById('placeBid'),
    bidProperty: document.getElementById('bidProperty'),
    bidAmount: document.getElementById('bidAmount'),
  };

  let state = { ...defaultState, ...readJson(portalStateKey, {}) };

  const addLog = (message) => {
    state.logs.unshift(`${new Date().toLocaleString('en-IN')} - ${message}`);
    state.logs = state.logs.slice(0, 24);
  };

  const render = () => {
    if (elements.wishCount) elements.wishCount.textContent = String(state.wishlist);
    if (elements.visitCount) elements.visitCount.textContent = String(state.visits);
    if (elements.compareCount) elements.compareCount.textContent = String(state.compare);
    if (elements.bidCount) elements.bidCount.textContent = String(state.bids);
    if (elements.verifiedCount) elements.verifiedCount.textContent = String(state.verifiedSearches);

    if (elements.activityLog) {
      elements.activityLog.innerHTML = state.logs.length
        ? state.logs.map((item) => `<li>${item}</li>`).join('')
        : '<li>No activity yet.</li>';
    }
  };

  const persist = () => {
    saveJson(portalStateKey, state);
    render();
  };

  const syncWithMarketplace = () => {
    const marketState = readJson(marketStateKey, { wishlist: [], compare: [], visits: [] });
    state.wishlist = Number(marketState.wishlist?.length || 0);
    state.compare = Number(marketState.compare?.length || 0);
    state.visits = Math.max(state.visits, Number(marketState.visits?.length || 0));
  };

  const syncLiveBidsCount = async () => {
    const token = live.getAnyToken ? live.getAnyToken() : '';
    if (!token || !live.request) return;
    try {
      const response = await live.request('/sealed-bids/mine', { token });
      const count = Number(response?.total || 0);
      if (count >= state.bids) state.bids = count;
    } catch {
      // local remains
    }
  };

  const placeBidLive = async (propertyId, amount) => {
    const token = live.getAnyToken ? live.getAnyToken() : '';
    if (!token || !live.request) return false;
    try {
      await live.request('/sealed-bids', {
        method: 'POST',
        token,
        data: { propertyId, amount },
      });
      return true;
    } catch {
      return false;
    }
  };

  elements.saveDemo?.addEventListener('click', () => {
    state.wishlist += 1;
    addLog('Property saved to wishlist.');
    pushNotification('Customer portal: property added to wishlist.', ['customer'], 'Wishlist Added', 'info');
    persist();
  });

  elements.bookVisit?.addEventListener('click', () => {
    state.visits += 1;
    const marketState = readJson(marketStateKey, { wishlist: [], compare: [], visits: [] });
    marketState.visits = marketState.visits || [];
    marketState.visits.unshift({ propertyId: 'udaipur-quick', at: new Date().toISOString() });
    saveJson(marketStateKey, marketState);
    addLog('Visit request submitted from customer portal.');
    pushNotification('Customer portal: quick visit request submitted.', ['customer', 'admin'], 'Visit Requested', 'success');
    persist();
  });

  elements.verifiedSearch?.addEventListener('click', () => {
    state.verifiedSearches += 1;
    addLog('Verified-only locality search executed.');
    pushNotification('Customer ran verified-only search in portal.', ['customer'], 'Verified Search', 'info');
    persist();
  });

  elements.placeBid?.addEventListener('click', async () => {
    const propertyId = String(elements.bidProperty?.value || '').trim();
    const amount = Number(elements.bidAmount?.value || 0);
    if (!propertyId || !amount || amount <= 0) {
      window.alert('Valid Property ID and bid amount required.');
      return;
    }

    const livePlaced = await placeBidLive(propertyId, amount);

    const bids = readJson(sealedBidKey, []);
    bids.push({
      propertyId,
      amount,
      bidder: (live.getAnySession ? live.getAnySession()?.name : '') || 'customer-demo',
      publicVisible: false,
      modifiedByAdmin: null,
      createdAt: new Date().toISOString(),
      source: livePlaced ? 'live' : 'local',
    });
    saveJson(sealedBidKey, bids);

    state.bids += 1;
    addLog(`Sealed bid submitted for ${propertyId} at ₹${amount.toLocaleString('en-IN')}.`);
    pushNotification(
      `Sealed bid submitted for ${propertyId} at ₹${amount.toLocaleString('en-IN')}.`,
      ['customer', 'admin'],
      'Sealed Bid Placed',
      'success',
    );
    if (elements.bidProperty) elements.bidProperty.value = '';
    if (elements.bidAmount) elements.bidAmount.value = '';
    persist();
  });

  elements.clearPortal?.addEventListener('click', () => {
    state = { ...defaultState };
    addLog('Portal counters reset by user.');
    pushNotification('Customer portal counters reset.', ['customer'], 'Portal Reset', 'info');
    persist();
  });

  syncWithMarketplace();
  syncLiveBidsCount().finally(render);
})();
