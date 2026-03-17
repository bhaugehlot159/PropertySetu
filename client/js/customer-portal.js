(() => {
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

  const parseJson = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const saveJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));

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

  let state = { ...defaultState, ...parseJson(portalStateKey, {}) };

  const syncWithMarketplace = () => {
    const marketState = parseJson(marketStateKey, { wishlist: [], compare: [], visits: [] });
    state.wishlist = Number(marketState.wishlist?.length || 0);
    state.compare = Number(marketState.compare?.length || 0);
    state.visits = Math.max(state.visits, Number(marketState.visits?.length || 0));
  };

  const addLog = (message) => {
    state.logs.unshift(`${new Date().toLocaleString('en-IN')} - ${message}`);
    state.logs = state.logs.slice(0, 24);
  };

  const render = () => {
    elements.wishCount && (elements.wishCount.textContent = String(state.wishlist));
    elements.visitCount && (elements.visitCount.textContent = String(state.visits));
    elements.compareCount && (elements.compareCount.textContent = String(state.compare));
    elements.bidCount && (elements.bidCount.textContent = String(state.bids));
    elements.verifiedCount && (elements.verifiedCount.textContent = String(state.verifiedSearches));

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

  elements.saveDemo?.addEventListener('click', () => {
    state.wishlist += 1;
    addLog('Demo property saved to wishlist.');
    persist();
  });

  elements.bookVisit?.addEventListener('click', () => {
    state.visits += 1;
    const marketState = parseJson(marketStateKey, { wishlist: [], compare: [], visits: [] });
    marketState.visits = marketState.visits || [];
    marketState.visits.unshift({ propertyId: 'demo-udaipur', at: new Date().toISOString() });
    saveJson(marketStateKey, marketState);
    addLog('Visit request submitted for Udaipur demo property.');
    persist();
  });

  elements.verifiedSearch?.addEventListener('click', () => {
    state.verifiedSearches += 1;
    addLog('Verified-only locality search executed.');
    persist();
  });

  elements.placeBid?.addEventListener('click', () => {
    const propertyId = String(elements.bidProperty?.value || '').trim();
    const amount = Number(elements.bidAmount?.value || 0);
    if (!propertyId || !amount || amount <= 0) {
      window.alert('Valid Property ID and bid amount required.');
      return;
    }

    const bids = parseJson(sealedBidKey, []);
    bids.push({
      propertyId,
      amount,
      bidder: 'customer-demo',
      publicVisible: false,
      modifiedByAdmin: null,
      createdAt: new Date().toISOString(),
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
  render();
})();
