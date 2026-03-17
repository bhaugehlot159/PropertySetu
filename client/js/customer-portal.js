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
    persist();
  });

  elements.bookVisit?.addEventListener('click', () => {
    state.visits += 1;
    const marketState = readJson(marketStateKey, { wishlist: [], compare: [], visits: [] });
    marketState.visits = marketState.visits || [];
    marketState.visits.unshift({ propertyId: 'udaipur-quick', at: new Date().toISOString() });
    saveJson(marketStateKey, marketState);
    addLog('Visit request submitted from customer portal.');
    persist();
  });

  elements.verifiedSearch?.addEventListener('click', () => {
    state.verifiedSearches += 1;
    addLog('Verified-only locality search executed.');
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
    if (elements.bidProperty) elements.bidProperty.value = '';
    if (elements.bidAmount) elements.bidAmount.value = '';
    persist();
  });

  elements.clearPortal?.addEventListener('click', () => {
    state = { ...defaultState };
    addLog('Portal counters reset by user.');
    persist();
  });

  syncWithMarketplace();
  syncLiveBidsCount().finally(render);
})();
