(() => {
  const live = window.PropertySetuLive || {};
  const portalStateKey = 'propertySetu:customerPortal';
  const marketStateKey = 'propertysetu-marketplace-state';
  const listingsKey = 'propertySetu:listings';

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
    saveWishlist: document.getElementById('saveWishlist'),
    bookVisit: document.getElementById('bookVisit'),
    verifiedSearch: document.getElementById('verifiedSearch'),
    actionProperty: document.getElementById('actionProperty'),
    clearPortal: document.getElementById('clearPortal'),
    placeBid: document.getElementById('placeBid'),
    bidProperty: document.getElementById('bidProperty'),
    bidAmount: document.getElementById('bidAmount'),
  };

  const text = (value, fallback = '') => {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  };

  const numberFrom = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char]));

  let state = { ...defaultState, ...readJson(portalStateKey, {}) };
  let listings = [];

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
        ? state.logs.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
        : '<li>No activity yet.</li>';
    }
  };

  const persist = () => {
    saveJson(portalStateKey, state);
    render();
  };

  const getToken = () => (
    live.getAnyToken
      ? String(live.getAnyToken() || '').trim()
      : ''
  );

  const requireLive = (message) => {
    const token = getToken();
    if (!token || !live.request) {
      window.alert(message);
      return '';
    }
    return token;
  };

  const normalizeListing = (item = {}, index = 0) => ({
    id: text(item.id || item._id || item.propertyId, `listing-${index + 1}`),
    title: text(item.title, 'Property Listing'),
    location: text(item.location || item.locality || 'Udaipur'),
    city: text(item.city, 'Udaipur'),
  });

  const toMarketState = () => {
    const current = readJson(marketStateKey, { wishlist: [], compare: [], visits: [] });
    return {
      wishlist: Array.isArray(current.wishlist) ? current.wishlist : [],
      compare: Array.isArray(current.compare) ? current.compare : [],
      visits: Array.isArray(current.visits) ? current.visits : [],
    };
  };

  const saveMarketState = (marketState) => {
    saveJson(marketStateKey, marketState);
  };

  const getSelectedPropertyId = () => text(elements.actionProperty?.value);
  const getListingById = (propertyId) => listings.find((item) => item.id === propertyId);

  const renderPropertyOptions = () => {
    if (!elements.actionProperty) return;
    const currentValue = text(elements.actionProperty.value);
    elements.actionProperty.innerHTML = '<option value="">Select Property</option>';

    listings.forEach((item) => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = `${item.title} (${item.location})`;
      elements.actionProperty.appendChild(option);
    });

    if (currentValue && listings.some((item) => item.id === currentValue)) {
      elements.actionProperty.value = currentValue;
    }
  };

  const loadListings = async () => {
    if (typeof live.syncLocalListingsFromApi === 'function') {
      try {
        await live.syncLocalListingsFromApi();
      } catch {
        // local cache still usable
      }
    }

    let liveItems = [];
    if (typeof live.request === 'function') {
      try {
        const response = await live.request('/properties?city=Udaipur');
        liveItems = (Array.isArray(response?.items) ? response.items : []).map(normalizeListing);
      } catch {
        liveItems = [];
      }
    }

    const localItems = readJson(listingsKey, [])
      .map(normalizeListing)
      .filter((item) => item.city.toLowerCase().includes('udaipur'));
    listings = liveItems.length ? liveItems : localItems;
    renderPropertyOptions();
  };

  const syncWithMarketplace = () => {
    const marketState = toMarketState();
    state.wishlist = Number(marketState.wishlist?.length || 0);
    state.compare = Number(marketState.compare?.length || 0);
    state.visits = Math.max(state.visits, Number(marketState.visits?.length || 0));
  };

  const syncLiveVisitsCount = async (token) => {
    if (!token || !live.request) return;
    try {
      const response = await live.request('/visits/mine', { token });
      const count = numberFrom(
        response?.total,
        Array.isArray(response?.items) ? response.items.length : state.visits,
      );
      state.visits = Math.max(0, count);
    } catch {
      // keep existing counters
    }
  };

  const syncLiveBidsCount = async (token) => {
    if (!token || !live.request) return;
    try {
      const response = await live.request('/sealed-bids/mine', { token });
      const count = numberFrom(
        response?.total,
        Array.isArray(response?.items) ? response.items.length : state.bids,
      );
      state.bids = Math.max(0, count);
    } catch {
      // keep existing counters
    }
  };

  const refreshLiveCounts = async () => {
    syncWithMarketplace();
    const token = getToken();
    if (token && live.request) {
      await Promise.all([
        syncLiveVisitsCount(token),
        syncLiveBidsCount(token),
      ]);
    }
    render();
  };

  elements.saveWishlist?.addEventListener('click', () => {
    const token = requireLive('Wishlist save ke liye login + live backend required hai.');
    if (!token) return;
    const propertyId = getSelectedPropertyId();
    if (!propertyId) {
      window.alert('Wishlist ke liye pehle property select karein.');
      return;
    }
    const marketState = toMarketState();
    const wishlistSet = new Set((marketState.wishlist || []).map((item) => text(item)).filter(Boolean));
    if (wishlistSet.has(propertyId)) {
      window.alert('Ye property wishlist me already saved hai.');
      return;
    }
    wishlistSet.add(propertyId);
    marketState.wishlist = Array.from(wishlistSet);
    saveMarketState(marketState);
    const listing = getListingById(propertyId);
    addLog(`Property saved to wishlist: ${listing?.title || propertyId}.`);
    pushNotification('Customer portal: property added to wishlist.', ['customer'], 'Wishlist Added', 'info');
    state.wishlist = marketState.wishlist.length;
    persist();
  });

  elements.bookVisit?.addEventListener('click', async () => {
    const token = requireLive('Quick visit ke liye login + live backend required hai.');
    if (!token) return;
    const propertyId = getSelectedPropertyId();
    if (!propertyId) {
      window.alert('Visit ke liye pehle property select karein.');
      return;
    }
    const listing = getListingById(propertyId);
    try {
      await live.request(`/properties/${encodeURIComponent(propertyId)}/visit`, {
        method: 'POST',
        token,
        data: {
          preferredAt: new Date().toISOString(),
          note: 'Quick visit requested from customer portal',
        },
      });
      const marketState = toMarketState();
      marketState.visits.unshift({ propertyId, at: new Date().toISOString() });
      saveMarketState(marketState);
      addLog(`Visit request submitted for ${listing?.title || propertyId}.`);
      pushNotification('Customer portal: quick visit request submitted.', ['customer', 'admin'], 'Visit Requested', 'success');
      await refreshLiveCounts();
      persist();
    } catch (error) {
      window.alert(error?.message || 'Visit request failed.');
    }
  });

  elements.verifiedSearch?.addEventListener('click', async () => {
    const token = requireLive('Verified search ke liye login + live backend required hai.');
    if (!token) return;
    if (!live.request) return;
    try {
      const response = await live.request('/properties?city=Udaipur&verified=1', {
        token,
      });
      const total = numberFrom(
        response?.total,
        Array.isArray(response?.items) ? response.items.length : 0,
      );
      state.verifiedSearches += 1;
      addLog(`Verified-only search executed. ${total} verified properties found.`);
      pushNotification('Customer ran verified-only search in portal.', ['customer'], 'Verified Search', 'info');
      persist();
    } catch (error) {
      window.alert(error?.message || 'Verified search failed.');
    }
  });

  elements.placeBid?.addEventListener('click', async () => {
    const token = requireLive('Sealed bid ke liye login + live backend required hai.');
    if (!token) return;
    const propertyId = text(elements.bidProperty?.value) || getSelectedPropertyId();
    const amount = numberFrom(elements.bidAmount?.value, 0);
    if (!propertyId || !amount || amount <= 0) {
      window.alert('Valid Property ID and bid amount required.');
      return;
    }
    try {
      await live.request('/sealed-bids', {
        method: 'POST',
        token,
        data: { propertyId, amount },
      });
      addLog(`Sealed bid submitted for ${propertyId} at ₹${amount.toLocaleString('en-IN')}.`);
      pushNotification(
        `Sealed bid submitted for ${propertyId} at ₹${amount.toLocaleString('en-IN')}.`,
        ['customer', 'admin'],
        'Sealed Bid Placed',
        'success',
      );
      if (elements.bidProperty) elements.bidProperty.value = '';
      if (elements.bidAmount) elements.bidAmount.value = '';
      await refreshLiveCounts();
      persist();
    } catch (error) {
      window.alert(error?.message || 'Live sealed bid submit failed. Please login and retry.');
    }
  });

  elements.clearPortal?.addEventListener('click', () => {
    state.logs = [];
    state.verifiedSearches = 0;
    addLog('Portal activity log reset by user.');
    pushNotification('Customer portal activity log reset.', ['customer'], 'Portal Reset', 'info');
    persist();
  });

  loadListings()
    .catch(() => {})
    .finally(() => {
      refreshLiveCounts().finally(() => persist());
    });
})();
