(() => {
  const marketplaceRoot = document.getElementById('marketGrid');
  if (!marketplaceRoot) return;

  const LISTINGS_KEY = 'propertySetu:listings';
  const LEGACY_PROPERTIES_KEY = 'properties';
  const MARKET_STATE_KEY = 'propertysetu-marketplace-state';
  const SAVED_SEARCH_KEY = 'propertySetu:savedSearches';
  const RECENTLY_VIEWED_KEY = 'propertySetu:recentlyViewed';
  const FILTER_STATE_KEY = 'propertySetu:marketFilters';

  const heroLocationSuggestions = document.getElementById('heroLocationSuggestions');
  const marketLocalitySuggestions = document.getElementById('marketLocalitySuggestions');

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

  const parseJson = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const writeJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  const formatPrice = (price) => `₹${Number(price || 0).toLocaleString('en-IN')}`;

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
      image: 'https://images.unsplash.com/photo-1613977257593-487ecd136cc3?auto=format&fit=crop&w=1200&q=80',
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
      image: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80',
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
      image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80',
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
      image: 'https://images.unsplash.com/photo-1505692952047-1a78307da8f2?auto=format&fit=crop&w=1200&q=80',
    },
    {
      id: 'seed-5',
      title: 'Farm House Retreat at Badi Lake Road',
      locality: 'Badi Lake Road',
      category: 'Farm House',
      purpose: 'Buy',
      price: 14500000,
      areaSqft: 5600,
      beds: 4,
      city: 'Udaipur',
      verified: true,
      premium: true,
      trustScore: 90,
      listedAt: '2026-03-10T15:30:00.000Z',
      image: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?auto=format&fit=crop&w=1200&q=80',
    },
    {
      id: 'seed-6',
      title: 'Warehouse Space in Kaladwas RIICO',
      locality: 'RIICO Kaladwas',
      category: 'Warehouse',
      purpose: 'Rent',
      price: 110000,
      areaSqft: 7200,
      beds: 0,
      city: 'Udaipur',
      verified: false,
      premium: false,
      trustScore: 72,
      listedAt: '2026-03-09T10:50:00.000Z',
      image: 'https://images.unsplash.com/photo-1565610502821-03f8c73f869e?auto=format&fit=crop&w=1200&q=80',
    },
  ];

  const normalizePurpose = (value) => {
    const base = String(value || '').trim().toLowerCase();
    if (!base) return 'Buy';
    if (base.startsWith('rent')) return 'Rent';
    if (base.startsWith('sell')) return 'Sell';
    if (base.startsWith('lease')) return 'Lease';
    if (base.startsWith('buy')) return 'Buy';
    return base.charAt(0).toUpperCase() + base.slice(1);
  };

  const numberFrom = (value, fallback = 0) => {
    if (value === null || value === undefined || String(value).trim() === '') return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const normalizeLocalEntry = (entry) => {
    if (!entry || typeof entry !== 'object') return null;
    const city = String(entry.city || 'Udaipur').trim() || 'Udaipur';
    if (!city.toLowerCase().includes('udaipur')) return null;

    const riskScore = numberFrom(entry?.aiReview?.fraudRiskScore, 45);
    const photosCount = numberFrom(entry?.media?.photosCount, 0);
    const verified = entry.status === 'Approved' || riskScore <= 35;
    const premium = photosCount >= 8;

    return {
      id: entry.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: entry.title || 'Untitled Listing',
      locality: entry.location || 'Udaipur',
      category: entry.category || 'House',
      purpose: normalizePurpose(entry.type),
      price: numberFrom(entry.price, 0),
      areaSqft: numberFrom(entry.builtUpArea || entry.plotSize || entry.carpetArea, 0),
      beds: numberFrom(entry.bedrooms, 0),
      city: 'Udaipur',
      verified,
      premium,
      trustScore: Math.max(35, 100 - riskScore + (entry.status === 'Approved' ? 10 : 0)),
      listedAt: entry.createdAt || new Date().toISOString(),
      image: entry.image || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
    };
  };

  const normalizeLegacyEntry = (entry, index) => {
    if (!entry || typeof entry !== 'object') return null;
    const locality = String(entry.location || '').trim();
    if (!locality) return null;

    return {
      id: `legacy-${index}`,
      title: entry.title || 'Legacy Listing',
      locality,
      category: entry.category || 'House',
      purpose: normalizePurpose(entry.type),
      price: numberFrom(entry.price, 0),
      areaSqft: numberFrom(entry.areaSqft, 0),
      beds: numberFrom(entry.beds, 0),
      city: 'Udaipur',
      verified: Boolean(entry.verified || entry.featured),
      premium: Boolean(entry.featured),
      trustScore: entry.featured ? 85 : 68,
      listedAt: entry.createdAt || '2026-03-01T09:00:00.000Z',
      image: entry.image || 'https://images.unsplash.com/photo-1513584684374-8bab748fbf90?auto=format&fit=crop&w=1200&q=80',
    };
  };

  const localListings = parseJson(LISTINGS_KEY, []).map(normalizeLocalEntry).filter(Boolean);
  const legacyListings = parseJson(LEGACY_PROPERTIES_KEY, []).map(normalizeLegacyEntry).filter(Boolean);

  const deduped = [...localListings, ...legacyListings, ...seededListings].reduce((acc, item) => {
    if (acc.some((known) => known.id === item.id || (known.title === item.title && known.locality === item.locality && known.price === item.price))) {
      return acc;
    }
    acc.push(item);
    return acc;
  }, []);

  let listings = deduped.filter((item) => item.city.toLowerCase().includes('udaipur'));

  const state = parseJson(MARKET_STATE_KEY, { wishlist: [], compare: [], visits: [], bids: [] });
  const savedSearches = parseJson(SAVED_SEARCH_KEY, []);
  const recentlyViewed = parseJson(RECENTLY_VIEWED_KEY, []);
  const rememberedFilters = parseJson(FILTER_STATE_KEY, null);

  const getFilters = () => ({
    query: String(marketQuery?.value || '').trim(),
    locality: String(marketLocality?.value || '').trim(),
    category: marketCategory?.value || 'all',
    purpose: marketPurpose?.value || 'all',
    minPrice: numberFrom(marketMinPrice?.value, 0),
    maxPrice: numberFrom(marketMaxPrice?.value, Infinity),
    sort: marketSort?.value || 'relevance',
  });

  const setFilters = (filters) => {
    if (!filters) return;
    if (marketQuery) marketQuery.value = filters.query || '';
    if (marketLocality) marketLocality.value = filters.locality || '';
    if (marketCategory) marketCategory.value = filters.category || 'all';
    if (marketPurpose) marketPurpose.value = filters.purpose || 'all';
    if (marketMinPrice) marketMinPrice.value = filters.minPrice ? String(filters.minPrice) : '';
    if (marketMaxPrice) marketMaxPrice.value = Number.isFinite(filters.maxPrice) ? String(filters.maxPrice) : '';
    if (marketSort) marketSort.value = filters.sort || 'relevance';
  };

  const activeLocalityMap = new Map();
  listings.forEach((item) => {
    activeLocalityMap.set(item.locality, (activeLocalityMap.get(item.locality) || 0) + 1);
  });

  const topLocalities = [...activeLocalityMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name]) => name);

  const fallbackLocalities = ['Hiran Magri Sector 4', 'Pratap Nagar', 'Bhuwana', 'Sukher', 'Fatehpura', 'Bedla Road'];
  const displayLocalities = topLocalities.length ? topLocalities : fallbackLocalities;

  const allLocations = (window.PROPERTYSETU_LOCATIONS || []).slice(0, 220);
  const datalistMarkup = allLocations.map((loc) => `<option value="${loc}"></option>`).join('');
  if (heroLocationSuggestions) heroLocationSuggestions.innerHTML = datalistMarkup;
  if (marketLocalitySuggestions) marketLocalitySuggestions.innerHTML = datalistMarkup;

  const renderStats = () => {
    const prices = listings.map((item) => item.price).filter((price) => price > 0).sort((a, b) => a - b);
    const midpoint = Math.floor(prices.length / 2);
    const median = prices.length ? prices[midpoint] : 0;
    const verifiedCount = listings.filter((item) => item.verified).length;

    const topEntry = [...activeLocalityMap.entries()].sort((a, b) => b[1] - a[1])[0];
    if (statActiveListings) statActiveListings.textContent = `${listings.length}`;
    if (statVerifiedListings) statVerifiedListings.textContent = `${verifiedCount}`;
    if (statMedianPrice) statMedianPrice.textContent = formatPrice(median);
    if (statTopLocality) statTopLocality.textContent = topEntry ? topEntry[0] : 'N/A';
  };

  const renderLocalityChips = () => {
    if (!localityChips) return;
    localityChips.innerHTML = displayLocalities
      .map((locality) => `<button type="button" class="chip-btn" data-locality="${locality}">${locality}</button>`)
      .join('');
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
    renderListings(applyFilters(getFilters()));
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
          </li>`)
        .join('')
      : '<li>No saved searches yet.</li>';
  };

  const renderRecentlyViewed = (items = parseJson(RECENTLY_VIEWED_KEY, [])) => {
    if (!recentList) return;
    recentList.innerHTML = items.length
      ? items.map((item) => `<li><strong>${item.title}</strong><br>${item.locality} • ${formatPrice(item.price)}</li>`).join('')
      : '<li>No recently viewed listings.</li>';
  };

  const applyFilters = (filters) => {
    let filtered = [...listings];
    const q = filters.query.toLowerCase();
    const loc = filters.locality.toLowerCase();

    if (q) {
      filtered = filtered.filter((item) =>
        `${item.title} ${item.locality} ${item.category}`.toLowerCase().includes(q));
    }
    if (loc) {
      filtered = filtered.filter((item) => item.locality.toLowerCase().includes(loc));
    }
    if (filters.category !== 'all') {
      filtered = filtered.filter((item) => String(item.category).toLowerCase() === String(filters.category).toLowerCase());
    }
    if (filters.purpose !== 'all') {
      filtered = filtered.filter((item) => String(item.purpose).toLowerCase() === String(filters.purpose).toLowerCase());
    }
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
    if (Number.isFinite(filters.maxPrice)) tags.push(`Max: ${formatPrice(filters.maxPrice)}`);
    if (filters.sort !== 'relevance') tags.push(`Sort: ${filters.sort}`);

    activeFilterTags.innerHTML = tags.map((tag) => `<span class="tag-chip">${tag}</span>`).join('');
  };

  const renderListings = (filtered) => {
    marketplaceRoot.innerHTML = filtered
      .map((item) => {
        const inWishlist = state.wishlist.includes(item.id);
        const inCompare = state.compare.includes(item.id);
        return `
          <article class="listing-card">
            <div class="listing-media">
              <img loading="lazy" src="${item.image}" alt="${item.title}" />
              <div class="listing-badge-row">
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
              </div>
            </div>
          </article>`;
      })
      .join('');

    if (resultsMeta) {
      resultsMeta.textContent = `${filtered.length} listing${filtered.length === 1 ? '' : 's'} matched in Udaipur`;
    }
    if (marketNoResults) {
      marketNoResults.hidden = filtered.length !== 0;
    }
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
    savedSearches.unshift({
      label,
      filters,
      createdAt: new Date().toISOString(),
    });
    while (savedSearches.length > 8) savedSearches.pop();
    writeJson(SAVED_SEARCH_KEY, savedSearches);
    renderSavedSearches();
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
    if (marketLocality) marketLocality.value = String(quickLocality?.value || '').trim();
    if (marketPurpose) marketPurpose.value = quickPurpose?.value || 'all';
    if (marketMaxPrice) marketMaxPrice.value = String(numberFrom(quickBudget?.value, 0) || '');
    if (quickSearchHint) quickSearchHint.textContent = 'Smart quick-search applied in Udaipur marketplace.';
    runPipeline();
    document.getElementById('marketplace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  [marketQuery, marketLocality, marketCategory, marketPurpose, marketMinPrice, marketMaxPrice, marketSort].forEach((field) => {
    field?.addEventListener('input', runPipeline);
    field?.addEventListener('change', runPipeline);
  });

  saveSearchBtn?.addEventListener('click', saveCurrentSearch);

  resetFiltersBtn?.addEventListener('click', () => {
    setFilters({ query: '', locality: '', category: 'all', purpose: 'all', minPrice: 0, maxPrice: Infinity, sort: 'relevance' });
    quickLocality && (quickLocality.value = '');
    quickBudget && (quickBudget.value = '');
    quickPurpose && (quickPurpose.value = 'all');
    runPipeline();
  });

  clearCompareBtn?.addEventListener('click', () => {
    state.compare = [];
    writeJson(MARKET_STATE_KEY, state);
    renderCompare();
    runPipeline();
  });

  marketplaceRoot.addEventListener('click', (event) => {
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

    if (action === 'visit' || action === 'details') {
      pushRecent(listingId);
      state.visits.unshift({ listingId, at: new Date().toISOString() });
      state.visits = state.visits.slice(0, 25);
      writeJson(MARKET_STATE_KEY, state);
      if (action === 'details') {
        window.location.href = `property-details.html#${listingId}`;
      } else {
        window.alert('Visit request added. Team aapko callback karegi.');
      }
      return;
    }
  });

  [savedSearchList].forEach((list) => {
    list?.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const action = target.getAttribute('data-action');
      const index = Number(target.getAttribute('data-index'));
      if (!action || Number.isNaN(index)) return;
      if (!savedSearches[index]) return;

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
  });
})();
