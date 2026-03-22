(() => {
  const live = window.PropertySetuLive || {};
  const marketplaceRoot = document.getElementById('marketGrid');
  if (!marketplaceRoot) return;

  const LISTINGS_KEY = 'propertySetu:listings';
  const LEGACY_PROPERTIES_KEY = 'properties';
  const MARKET_STATE_KEY = 'propertysetu-marketplace-state';
  const SAVED_SEARCH_KEY = 'propertySetu:savedSearches';
  const RECENTLY_VIEWED_KEY = 'propertySetu:recentlyViewed';
  const FILTER_STATE_KEY = 'propertySetu:marketFilters';

  const statActiveListings = document.getElementById('statActiveListings');
  const statVerifiedListings = document.getElementById('statVerifiedListings');
  const statMedianPrice = document.getElementById('statMedianPrice');
  const statTopLocality = document.getElementById('statTopLocality');

  const localityChips = document.getElementById('localityChips');
  const resultsMeta = document.getElementById('resultsMeta');
  const activeFilterTags = document.getElementById('activeFilterTags');
  const marketNoResults = document.getElementById('marketNoResults');

  const compareCount = document.getElementById('compareCount');
  const compareList = document.getElementById('compareList');
  const clearCompareBtn = document.getElementById('clearCompareBtn');
  const savedSearchList = document.getElementById('savedSearchList');
  const recentList = document.getElementById('recentList');
  const saveSearchBtn = document.getElementById('saveSearchBtn');
  const resetFiltersBtn = document.getElementById('resetFiltersBtn');
  const emiLoanAmount = document.getElementById('emiLoanAmount');
  const emiRate = document.getElementById('emiRate');
  const emiTenureMonths = document.getElementById('emiTenureMonths');
  const emiCalcBtn = document.getElementById('emiCalcBtn');
  const emiResult = document.getElementById('emiResult');

  const quickLocality = document.getElementById('quickLocality');
  const quickPurpose = document.getElementById('quickPurpose');
  const quickBudget = document.getElementById('quickBudget');
  const quickSearchButton = document.getElementById('quickSearchButton');
  const quickSearchHint = document.getElementById('quickSearchHint');

  const marketQuery = document.getElementById('marketQuery');
  const marketLocality = document.getElementById('marketLocality');
  const marketCategory = document.getElementById('marketCategory');
  const marketPurpose = document.getElementById('marketPurpose');
  const marketMinPrice = document.getElementById('marketMinPrice');
  const marketMaxPrice = document.getElementById('marketMaxPrice');
  const marketSort = document.getElementById('marketSort');
  const marketVerifiedOnly = document.getElementById('marketVerifiedOnly');

  const readJson = live.readJson || ((key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  });

  const writeJson = live.writeJson || ((key, value) => localStorage.setItem(key, JSON.stringify(value)));
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
    writeJson('propertySetu:notifications', list);
    try {
      localStorage.setItem('propertySetu:notifications:ping', String(Date.now()));
    } catch {
      // no-op
    }
  };
  const numberFrom = live.numberFrom || ((value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  });

  const formatPrice = (price) => `₹${Number(price || 0).toLocaleString('en-IN')}`;
  const PURPOSE_CATEGORY_MAP = {
    House: 'House',
    Flat: 'Flat',
    Villa: 'Villa',
    Plot: 'Plot',
    'Farm House': 'Farm House',
    Vadi: 'Vadi',
    'Agriculture Land': 'Agriculture Land',
    Commercial: 'Commercial',
    Shop: 'Shop',
    Office: 'Office',
    Warehouse: 'Warehouse',
    'PG/Hostel': 'PG/Hostel',
    'Property Care': 'Property Care',
    'Home Maintenance': 'Property Care',
    'Home Watch': 'Property Care',
  };

  const seededListings = [
    {
      id: 'seed-1',
      title: 'Premium Lake-view Villa',
      locality: 'Ambamata',
      category: 'Villa',
      purpose: 'Buy',
      price: 32000000,
      areaSqft: 4200,
      beds: 5,
      city: 'Udaipur',
      verified: true,
      premium: true,
      trustScore: 96,
      listedAt: '2026-03-14T09:00:00.000Z',
      image: 'https://cdn.pixabay.com/photo/2018/08/17/11/01/india-3612588_1280.jpg',
    },
    {
      id: 'seed-2',
      title: '2BHK Family Flat in Pratap Nagar',
      locality: 'Pratap Nagar',
      category: 'Flat',
      purpose: 'Rent',
      price: 19500,
      areaSqft: 1180,
      beds: 2,
      city: 'Udaipur',
      verified: true,
      premium: false,
      trustScore: 88,
      listedAt: '2026-03-13T11:20:00.000Z',
      image: 'https://cdn.pixabay.com/photo/2018/03/19/23/07/udaipur-3241594_1280.jpg',
    },
    {
      id: 'seed-3',
      title: 'Commercial Showroom on 100 Feet Road',
      locality: '100 Feet Road Udaipur',
      category: 'Commercial',
      purpose: 'Lease',
      price: 86000,
      areaSqft: 1850,
      beds: 0,
      city: 'Udaipur',
      verified: true,
      premium: true,
      trustScore: 92,
      listedAt: '2026-03-12T13:40:00.000Z',
      image: 'https://cdn.pixabay.com/photo/2020/12/11/22/05/udaipur-5824034_1280.jpg',
    },
    {
      id: 'seed-4',
      title: 'Residential Plot Near Bedla Road',
      locality: 'Bedla Road',
      category: 'Plot',
      purpose: 'Sell',
      price: 4800000,
      areaSqft: 2100,
      beds: 0,
      city: 'Udaipur',
      verified: false,
      premium: false,
      trustScore: 74,
      listedAt: '2026-03-11T07:05:00.000Z',
      image: 'https://cdn.pixabay.com/photo/2018/03/15/21/46/city-palace-3229617_640.jpg',
    },
  ];

  const normalizePurpose = live.normalizePurpose || ((value) => String(value || '').trim() || 'Buy');
  const hasSubmitted = (value) => ['submitted', 'verified', 'approved'].includes(String(value || '').trim().toLowerCase());
  const isTrustModelEligible = (entry) => {
    const verification = entry?.verification || {};
    const docs = entry?.privateDocs || {};
    if (verification.badgeEligible) return true;
    const ownerStatusOk = hasSubmitted(verification.ownerAadhaarPanStatus);
    const addressStatusOk = hasSubmitted(verification.addressVerificationStatus);
    const docsReady = Boolean(Array.isArray(docs.propertyDocuments) && docs.propertyDocuments.length) && Boolean(docs.ownerIdProof) && Boolean(docs.addressProof);
    return ownerStatusOk && addressStatusOk && docsReady;
  };

  const normalizeLocalEntry = (entry) => {
    if (!entry || typeof entry !== 'object') return null;
    const city = String(entry.city || 'Udaipur').trim() || 'Udaipur';
    if (!city.toLowerCase().includes('udaipur')) return null;
    const riskScore = numberFrom(entry?.aiReview?.fraudRiskScore, 45);
    const photosCount = numberFrom(entry?.media?.photosCount, 0);
    const trustModelEligible = Boolean(entry.verifiedByPropertySetu || isTrustModelEligible(entry));
    return {
      id: entry.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: entry.title || 'Untitled Listing',
      locality: entry.location || entry.locality || 'Udaipur',
      category: entry.category || 'House',
      purpose: entry.purpose || normalizePurpose(entry.type),
      price: numberFrom(entry.price, 0),
      areaSqft: numberFrom(entry.builtUpArea || entry.plotSize || entry.carpetArea || entry.areaSqft, 0),
      beds: numberFrom(entry.bedrooms || entry.beds, 0),
      city: 'Udaipur',
      verifiedByPropertySetu: trustModelEligible,
      verified: Boolean(entry.verified || entry.status === 'Approved' || trustModelEligible),
      premium: Boolean(entry.featured || photosCount >= 8),
      trustScore: Math.max(35, numberFrom(entry?.verification?.verificationScore, 0) || numberFrom(entry.trustScore, 100 - riskScore)),
      listedAt: entry.listedAt || entry.createdAt || new Date().toISOString(),
      image: entry.image || 'https://cdn.pixabay.com/photo/2018/03/19/23/07/udaipur-3241594_1280.jpg',
      status: entry.status || 'Pending Approval',
    };
  };

  const normalizeLegacyEntry = (entry, index) => {
    if (!entry || typeof entry !== 'object') return null;
    const locality = String(entry.location || '').trim();
    if (!locality) return null;
    return {
      id: entry.id || `legacy-${index}`,
      title: entry.title || 'Legacy Listing',
      locality,
      category: entry.category || 'House',
      purpose: normalizePurpose(entry.type),
      price: numberFrom(entry.price, 0),
      areaSqft: numberFrom(entry.areaSqft, 0),
      beds: numberFrom(entry.beds, 0),
      city: 'Udaipur',
      verifiedByPropertySetu: Boolean(entry.verifiedByPropertySetu || isTrustModelEligible(entry)),
      verified: Boolean(entry.verified || entry.featured || entry.verifiedByPropertySetu || isTrustModelEligible(entry)),
      premium: Boolean(entry.featured),
      trustScore: entry.featured ? 85 : 68,
      listedAt: entry.createdAt || '2026-03-01T09:00:00.000Z',
      image: entry.image || 'https://cdn.pixabay.com/photo/2020/12/11/22/05/udaipur-5824034_1280.jpg',
      status: entry.status || 'Approved',
    };
  };

  const buildListings = () => {
    const localListings = readJson(LISTINGS_KEY, []).map(normalizeLocalEntry).filter(Boolean);
    const legacyListings = readJson(LEGACY_PROPERTIES_KEY, []).map(normalizeLegacyEntry).filter(Boolean);
    return [...localListings, ...legacyListings, ...seededListings]
      .reduce((acc, item) => {
        if (acc.some((known) => known.id === item.id || (
          known.title === item.title
          && known.locality === item.locality
          && known.price === item.price
        ))) {
          return acc;
        }
        acc.push(item);
        return acc;
      }, [])
      .filter((item) => String(item.city || '').toLowerCase().includes('udaipur'));
  };

  let listings = buildListings();
  const state = readJson(MARKET_STATE_KEY, { wishlist: [], compare: [], visits: [], bids: [] });
  const savedSearches = readJson(SAVED_SEARCH_KEY, []);
  const recentlyViewed = readJson(RECENTLY_VIEWED_KEY, []);
  const rememberedFilters = readJson(FILTER_STATE_KEY, null);

  const getFilters = () => ({
    query: String(marketQuery?.value || '').trim(),
    locality: String(marketLocality?.value || '').trim(),
    category: marketCategory?.value || 'all',
    purpose: marketPurpose?.value || 'all',
    minPrice: numberFrom(marketMinPrice?.value, 0),
    maxPrice: numberFrom(marketMaxPrice?.value, Number.MAX_SAFE_INTEGER),
    sort: marketSort?.value || 'relevance',
    verifiedOnly: String(marketVerifiedOnly?.value || '0') === '1',
  });

  const setFilters = (filters) => {
    if (!filters) return;
    if (marketQuery) marketQuery.value = filters.query || '';
    if (marketLocality) marketLocality.value = filters.locality || '';
    if (marketCategory) marketCategory.value = filters.category || 'all';
    if (marketPurpose) marketPurpose.value = filters.purpose || 'all';
    if (marketMinPrice) marketMinPrice.value = filters.minPrice ? String(filters.minPrice) : '';
    if (marketMaxPrice) {
      const max = Number(filters.maxPrice);
      marketMaxPrice.value = Number.isFinite(max) && max !== Number.MAX_SAFE_INTEGER ? String(max) : '';
    }
    if (marketSort) marketSort.value = filters.sort || 'relevance';
    if (marketVerifiedOnly) marketVerifiedOnly.value = filters.verifiedOnly ? '1' : '0';
  };

  const getLocalityMap = () => {
    const map = new Map();
    listings.forEach((item) => map.set(item.locality, (map.get(item.locality) || 0) + 1));
    return map;
  };

  const renderStats = () => {
    const prices = listings.map((item) => item.price).filter((price) => price > 0).sort((a, b) => a - b);
    const midpoint = Math.floor(prices.length / 2);
    const median = prices.length ? prices[midpoint] : 0;
    const verifiedCount = listings.filter((item) => item.verified).length;
    const localityMap = getLocalityMap();
    const topEntry = [...localityMap.entries()].sort((a, b) => b[1] - a[1])[0];

    if (statActiveListings) statActiveListings.textContent = `${listings.length}`;
    if (statVerifiedListings) statVerifiedListings.textContent = `${verifiedCount}`;
    if (statMedianPrice) statMedianPrice.textContent = formatPrice(median);
    if (statTopLocality) statTopLocality.textContent = topEntry ? topEntry[0] : 'N/A';
  };

  const renderLocalityChips = () => {
    if (!localityChips) return;
    const localityMap = getLocalityMap();
    const topLocalities = [...localityMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([name]) => name);
    const fallback = ['Hiran Magri Sector 4', 'Pratap Nagar', 'Bhuwana', 'Sukher', 'Fatehpura', 'Bedla Road'];
    const display = topLocalities.length ? topLocalities : fallback;
    localityChips.innerHTML = display
      .map((locality) => `<button type="button" class="chip-btn" data-locality="${locality}">${locality}</button>`)
      .join('');
  };

  const pushRecent = (listingId) => {
    const listing = listings.find((item) => item.id === listingId);
    if (!listing) return;
    const payload = {
      id: listing.id,
      title: listing.title,
      locality: listing.locality,
      price: listing.price,
      at: new Date().toISOString(),
    };
    const filtered = recentlyViewed.filter((item) => item.id !== listingId);
    filtered.unshift(payload);
    while (filtered.length > 8) filtered.pop();
    writeJson(RECENTLY_VIEWED_KEY, filtered);
    renderRecentlyViewed(filtered);
  };

  const toggleCompare = (listingId) => {
    const existingIndex = state.compare.indexOf(listingId);
    if (existingIndex >= 0) {
      state.compare.splice(existingIndex, 1);
    } else if (state.compare.length >= 3) {
      window.alert('Compare board me max 3 listings hi add kar sakte hain.');
      return;
    } else {
      state.compare.push(listingId);
    }
    writeJson(MARKET_STATE_KEY, state);
    renderCompare();
    renderListings(applyFilters(getFilters()));
  };

  const toggleWishlist = (listingId) => {
    const index = state.wishlist.indexOf(listingId);
    if (index >= 0) state.wishlist.splice(index, 1);
    else state.wishlist.push(listingId);
    writeJson(MARKET_STATE_KEY, state);
    const listing = listings.find((item) => item.id === listingId);
    pushNotification(
      `${listing?.title || 'Listing'} ${index >= 0 ? 'removed from' : 'added to'} wishlist.`,
      ['customer'],
      index >= 0 ? 'Wishlist Updated' : 'Wishlist Added',
      'info',
    );
    renderListings(applyFilters(getFilters()));
  };

  const renderCompare = () => {
    if (compareCount) compareCount.textContent = `${state.compare.length}`;
    if (!compareList) return;
    const rows = state.compare
      .map((id) => listings.find((item) => item.id === id))
      .filter(Boolean)
      .map((item) => `<li><strong>${item.title}</strong><br>${item.locality} • ${formatPrice(item.price)}</li>`);
    compareList.innerHTML = rows.length ? rows.join('') : '<li>No compare selection yet.</li>';
  };

  const renderSavedSearches = () => {
    if (!savedSearchList) return;
    savedSearchList.innerHTML = savedSearches.length
      ? savedSearches
        .map((search, index) => `
          <li>
            <strong>${search.label}</strong><br>
            ${search.filters.locality || 'All localities'} • ${search.filters.category || 'all'} • ${search.filters.purpose || 'all'}
            <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">
              <button class="action-btn" data-action="applySaved" data-index="${index}" type="button">Apply</button>
              <button class="action-btn" data-action="deleteSaved" data-index="${index}" type="button">Delete</button>
            </div>
          </li>`).join('')
      : '<li>No saved searches yet.</li>';
  };

  const renderRecentlyViewed = (items = readJson(RECENTLY_VIEWED_KEY, [])) => {
    if (!recentList) return;
    recentList.innerHTML = items.length
      ? items.map((item) => `<li><strong>${item.title}</strong><br>${item.locality} • ${formatPrice(item.price)}</li>`).join('')
      : '<li>No recently viewed listings.</li>';
  };

  const applyFilters = (filters) => {
    let filtered = [...listings];
    const q = filters.query.toLowerCase();
    const loc = filters.locality.toLowerCase();

    if (q) filtered = filtered.filter((item) => `${item.title} ${item.locality} ${item.category}`.toLowerCase().includes(q));
    if (loc) filtered = filtered.filter((item) => item.locality.toLowerCase().includes(loc));
    if (filters.category !== 'all') {
      filtered = filtered.filter((item) => String(item.category).toLowerCase() === String(filters.category).toLowerCase());
    }
    if (filters.purpose !== 'all') {
      const mappedCategory = PURPOSE_CATEGORY_MAP[filters.purpose];
      if (mappedCategory) {
        filtered = filtered.filter((item) => String(item.category).toLowerCase() === String(mappedCategory).toLowerCase());
      } else {
        filtered = filtered.filter((item) => String(item.purpose).toLowerCase() === String(filters.purpose).toLowerCase());
      }
    }
    if (filters.verifiedOnly) filtered = filtered.filter((item) => !!item.verified);
    filtered = filtered.filter((item) => item.price >= filters.minPrice && item.price <= filters.maxPrice);

    switch (filters.sort) {
      case 'latest':
        filtered.sort((a, b) => new Date(b.listedAt) - new Date(a.listedAt));
        break;
      case 'priceLow':
        filtered.sort((a, b) => a.price - b.price);
        break;
      case 'priceHigh':
        filtered.sort((a, b) => b.price - a.price);
        break;
      case 'trust':
        filtered.sort((a, b) => b.trustScore - a.trustScore);
        break;
      default:
        filtered.sort((a, b) => (b.trustScore + (b.premium ? 8 : 0)) - (a.trustScore + (a.premium ? 8 : 0)));
    }
    return filtered;
  };

  const renderActiveTags = (filters) => {
    if (!activeFilterTags) return;
    const tags = [];
    if (filters.query) tags.push(`Search: ${filters.query}`);
    if (filters.locality) tags.push(`Locality: ${filters.locality}`);
    if (filters.category !== 'all') tags.push(`Category: ${filters.category}`);
    if (filters.purpose !== 'all') tags.push(`Purpose: ${filters.purpose}`);
    if (filters.minPrice) tags.push(`Min: ${formatPrice(filters.minPrice)}`);
    if (Number.isFinite(filters.maxPrice) && filters.maxPrice !== Number.MAX_SAFE_INTEGER) tags.push(`Max: ${formatPrice(filters.maxPrice)}`);
    if (filters.verifiedOnly) tags.push('Verified Only');
    if (filters.sort !== 'relevance') tags.push(`Sort: ${filters.sort}`);
    activeFilterTags.innerHTML = tags.map((tag) => `<span class="tag-chip">${tag}</span>`).join('');
  };

  const renderListings = (filtered) => {
    marketplaceRoot.innerHTML = filtered.map((item) => {
      const inWishlist = state.wishlist.includes(item.id);
      const inCompare = state.compare.includes(item.id);
      return `
        <article class="listing-card">
          <div class="listing-media">
            <img loading="lazy" src="${item.image}" alt="${item.title}" />
            <div class="listing-badge-row">
              ${item.verifiedByPropertySetu ? '<span class="listing-badge trust-model">Verified by PropertySetu</span>' : ''}
              ${item.verified ? '<span class="listing-badge verified">Verified</span>' : ''}
              ${item.premium ? '<span class="listing-badge premium">Elite</span>' : ''}
            </div>
          </div>
          <div class="listing-body">
            <h3 class="listing-title">${item.title}</h3>
            <p class="listing-locality">${item.locality}, Udaipur</p>
            <div class="listing-meta">
              <div class="listing-price">${formatPrice(item.price)}</div>
              <span class="listing-purpose">${item.purpose}</span>
            </div>
            <ul class="listing-facts">
              <li>${item.category}</li>
              <li>${item.areaSqft ? `${item.areaSqft} sq.ft.` : 'Area N/A'}</li>
              <li>${item.beds ? `${item.beds} BHK` : 'Flexible'}</li>
              <li>Trust ${Math.round(item.trustScore)}%</li>
            </ul>
            <div class="listing-actions">
              <button class="action-btn" data-action="wishlist" data-id="${item.id}" type="button">${inWishlist ? 'Wishlisted' : 'Wishlist'}</button>
              <button class="action-btn" data-action="compare" data-id="${item.id}" type="button">${inCompare ? 'Compared' : 'Compare'}</button>
              <button class="action-btn primary" data-action="visit" data-id="${item.id}" type="button">Book Visit</button>
              <button class="action-btn" data-action="details" data-id="${item.id}" type="button">View Details</button>
              <button class="action-btn" data-action="map" data-id="${item.id}" type="button">Map</button>
              <button class="action-btn" data-action="report" data-id="${item.id}" type="button">Report</button>
            </div>
          </div>
        </article>
      `;
    }).join('');

    if (resultsMeta) resultsMeta.textContent = `${filtered.length} listing${filtered.length === 1 ? '' : 's'} matched in Udaipur`;
    if (marketNoResults) marketNoResults.hidden = filtered.length !== 0;
  };

  const runPipeline = () => {
    const filters = getFilters();
    const filtered = applyFilters(filters);
    renderListings(filtered);
    renderActiveTags(filters);
    writeJson(FILTER_STATE_KEY, filters);
  };

  const saveCurrentSearch = () => {
    const filters = getFilters();
    const label = `${filters.locality || 'Udaipur'} • ${filters.category || 'all'} • ${filters.purpose || 'all'}`;
    savedSearches.unshift({ label, filters, createdAt: new Date().toISOString() });
    while (savedSearches.length > 8) savedSearches.pop();
    writeJson(SAVED_SEARCH_KEY, savedSearches);
    pushNotification(
      `Saved search created: ${label}.`,
      ['customer'],
      'Search Saved',
      'info',
    );
    renderSavedSearches();
  };

  const bookLiveVisit = async (listingId) => {
    const token = live.getAnyToken ? live.getAnyToken() : '';
    if (!token || !live.request) return false;
    try {
      await live.request(`/properties/${encodeURIComponent(listingId)}/visit`, {
        method: 'POST',
        token,
        data: {
          preferredAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          note: 'Visit requested from marketplace',
        },
      });
      return true;
    } catch (error) {
      if (!live.shouldFallbackToLocal || !live.shouldFallbackToLocal(error)) {
        window.alert(error.message || 'Visit request failed.');
      }
      return false;
    }
  };

  const syncFromApi = async () => {
    if (!live.syncLocalListingsFromApi) return;
    try {
      await live.syncLocalListingsFromApi();
      listings = buildListings();
      renderStats();
      renderLocalityChips();
      runPipeline();
    } catch {
      // fallback continues from local data
    }
  };

  renderStats();
  renderLocalityChips();
  renderCompare();
  renderSavedSearches();
  renderRecentlyViewed(recentlyViewed);
  if (rememberedFilters) setFilters(rememberedFilters);
  runPipeline();

  const applyLocalityChip = (locality) => {
    if (marketLocality) marketLocality.value = locality;
    if (quickSearchHint) quickSearchHint.textContent = `Filtered by locality: ${locality}`;
    runPipeline();
    localityChips?.querySelectorAll('.chip-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-locality') === locality);
    });
  };

  localityChips?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (!target.classList.contains('chip-btn')) return;
    const locality = target.getAttribute('data-locality');
    if (!locality) return;
    applyLocalityChip(locality);
  });

  quickSearchButton?.addEventListener('click', () => {
    const quickValue = quickPurpose?.value || 'all';
    if (marketLocality) marketLocality.value = String(quickLocality?.value || '').trim();
    const mappedCategory = PURPOSE_CATEGORY_MAP[quickValue];
    if (mappedCategory) {
      if (marketPurpose) marketPurpose.value = 'all';
      if (marketCategory) marketCategory.value = mappedCategory;
    } else {
      if (marketPurpose) marketPurpose.value = quickValue;
      if (marketCategory) marketCategory.value = 'all';
    }
    if (marketMaxPrice) marketMaxPrice.value = String(numberFrom(quickBudget?.value, 0) || '');
    if (quickSearchHint) quickSearchHint.textContent = 'Smart quick-search applied in Udaipur marketplace.';
    runPipeline();
    document.getElementById('marketplace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  [marketQuery, marketLocality, marketCategory, marketPurpose, marketMinPrice, marketMaxPrice, marketSort, marketVerifiedOnly].forEach((field) => {
    field?.addEventListener('input', runPipeline);
    field?.addEventListener('change', runPipeline);
  });

  saveSearchBtn?.addEventListener('click', saveCurrentSearch);

  resetFiltersBtn?.addEventListener('click', () => {
    setFilters({
      query: '',
      locality: '',
      category: 'all',
      purpose: 'all',
      minPrice: 0,
      maxPrice: Number.MAX_SAFE_INTEGER,
      sort: 'relevance',
      verifiedOnly: false,
    });
    if (quickLocality) quickLocality.value = '';
    if (quickBudget) quickBudget.value = '';
    if (quickPurpose) quickPurpose.value = 'all';
    runPipeline();
  });

  clearCompareBtn?.addEventListener('click', () => {
    state.compare = [];
    writeJson(MARKET_STATE_KEY, state);
    renderCompare();
    runPipeline();
  });

  emiCalcBtn?.addEventListener('click', () => {
    const principal = numberFrom(emiLoanAmount?.value, 0);
    const annualRate = numberFrom(emiRate?.value, 0);
    const months = numberFrom(emiTenureMonths?.value, 0);
    if (!principal || !annualRate || !months) {
      if (emiResult) emiResult.textContent = 'Valid loan amount, rate and tenure enter karein.';
      return;
    }
    const r = annualRate / 12 / 100;
    const factor = Math.pow(1 + r, months);
    const emi = Math.round((principal * r * factor) / (factor - 1));
    if (emiResult) emiResult.textContent = `Estimated EMI: ${formatPrice(emi)} / month`;
  });

  marketplaceRoot.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.getAttribute('data-action');
    const listingId = target.getAttribute('data-id');
    if (!action || !listingId) return;

    if (action === 'wishlist') {
      toggleWishlist(listingId);
      return;
    }

    if (action === 'compare') {
      toggleCompare(listingId);
      return;
    }

    if (action === 'details') {
      pushRecent(listingId);
      window.location.href = `property-details.html?id=${encodeURIComponent(listingId)}`;
      return;
    }

    if (action === 'map') {
      const item = listings.find((entry) => entry.id === listingId);
      const query = encodeURIComponent(`${item?.locality || 'Udaipur'}, Udaipur`);
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
      return;
    }

    if (action === 'report') {
      const reason = window.prompt('Report reason likhein (fake listing / wrong price / spam):', '');
      if (!reason) return;
      const token = live.getAnyToken ? live.getAnyToken() : '';
      const listing = listings.find((entry) => entry.id === listingId);
      if (token && live.request) {
        live.request('/reports', { method: 'POST', token, data: { propertyId: listingId, reason } })
          .then(() => {
            window.alert('Report submitted successfully.');
            pushNotification(
              `Report submitted for ${listing?.title || listingId}.`,
              ['admin', 'customer'],
              'Report Submitted',
              'warn',
            );
          })
          .catch((error) => window.alert(`Report failed: ${error.message}`));
      } else {
        const reports = readJson('propertySetu:localReports', []);
        reports.unshift({ propertyId: listingId, reason, createdAt: new Date().toISOString() });
        writeJson('propertySetu:localReports', reports);
        window.alert('Report local queue me save ho gaya. Login ke baad live submit hoga.');
        pushNotification(
          `Report queued locally for ${listing?.title || listingId}.`,
          ['admin', 'customer'],
          'Report Queued',
          'warn',
        );
      }
      return;
    }

    if (action === 'visit') {
      pushRecent(listingId);
      state.visits.unshift({ listingId, at: new Date().toISOString() });
      state.visits = state.visits.slice(0, 30);
      writeJson(MARKET_STATE_KEY, state);
      const liveDone = await bookLiveVisit(listingId);
      const listing = listings.find((entry) => entry.id === listingId);
      if (liveDone) {
        window.alert('Visit request live submit ho gayi.');
        pushNotification(
          `Visit request submitted for ${listing?.title || listingId}.`,
          ['customer', 'admin'],
          'Visit Requested',
          'success',
        );
      } else {
        window.alert('Visit request local queue me save ho gayi. Login se live submit hoga.');
        pushNotification(
          `Visit request queued for ${listing?.title || listingId}.`,
          ['customer', 'admin'],
          'Visit Queued',
          'info',
        );
      }
      return;
    }
  });

  savedSearchList?.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.getAttribute('data-action');
    const index = Number(target.getAttribute('data-index'));
    if (!action || Number.isNaN(index) || !savedSearches[index]) return;

    if (action === 'applySaved') {
      setFilters(savedSearches[index].filters);
      runPipeline();
      return;
    }

    if (action === 'deleteSaved') {
      savedSearches.splice(index, 1);
      writeJson(SAVED_SEARCH_KEY, savedSearches);
      renderSavedSearches();
    }
  });

  syncFromApi();
})();
