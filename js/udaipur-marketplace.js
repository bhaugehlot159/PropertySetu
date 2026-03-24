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
  const VIDEO_VISIT_KEY = 'propertySetu:videoVisits';
  const SELLER_ENGAGEMENT_KEY = 'propertySetu:sellerEngagement';

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
  const compareTableWrap = document.getElementById('compareTableWrap');
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
  const marketRadiusKm = document.getElementById('marketRadiusKm');
  const marketBhk = document.getElementById('marketBhk');
  const marketFurnishing = document.getElementById('marketFurnishing');
  const marketConstruction = document.getElementById('marketConstruction');
  const marketLoanAvailable = document.getElementById('marketLoanAvailable');
  const aiPricingSummary = document.getElementById('aiPricingSummary');
  const aiTrendCanvas = document.getElementById('aiTrendCanvas');
  const aiTrendMeta = document.getElementById('aiTrendMeta');
  const aiRecommendationList = document.getElementById('aiRecommendationList');
  const aiRefreshBtn = document.getElementById('aiRefreshBtn');

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
  const DEFAULT_WHATSAPP_NUMBER = '919876543210';
  const UDAIPUR_CENTER = { lat: 24.5854, lng: 73.7125 };
  const LOCALITY_COORDINATES = {
    ambamata: { lat: 24.5795, lng: 73.6843 },
    'pratap nagar': { lat: 24.6192, lng: 73.7484 },
    '100 feet road udaipur': { lat: 24.6021, lng: 73.7341 },
    'bedla road': { lat: 24.6351, lng: 73.6884 },
    bhuwana: { lat: 24.6187, lng: 73.6895 },
    sukher: { lat: 24.6569, lng: 73.7185 },
    fatehpura: { lat: 24.6012, lng: 73.7045 },
    'hiran magri sector 4': { lat: 24.5639, lng: 73.7299 },
    'hiran magri': { lat: 24.5665, lng: 73.7281 },
    'shobhagpura circle': { lat: 24.605, lng: 73.7219 },
  };
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
  const normalizeText = (value) => String(value || '').trim().toLowerCase();
  const normalizeFurnishing = (value) => {
    const raw = normalizeText(value);
    if (raw.includes('semi')) return 'Semi Furnished';
    if (raw.includes('unfurnished') || raw.includes('without')) return 'Unfurnished';
    if (raw.includes('furnished') || raw === 'full') return 'Furnished';
    return '';
  };
  const normalizeConstructionStatus = (value) => {
    const raw = normalizeText(value);
    if (!raw) return '';
    if (raw.includes('ready')) return 'Ready to Move';
    if (raw.includes('under') || raw.includes('construction') || raw.includes('ongoing')) return 'Under Construction';
    return '';
  };
  const normalizeLoanAvailability = (value) => {
    if (typeof value === 'boolean') return value;
    const raw = normalizeText(value);
    if (!raw) return false;
    return ['yes', 'true', 'available', 'loan available', '1'].includes(raw);
  };
  const getCoordsFromLocality = (locality) => {
    const key = normalizeText(locality);
    if (!key) return null;
    if (LOCALITY_COORDINATES[key]) return LOCALITY_COORDINATES[key];
    const entry = Object.entries(LOCALITY_COORDINATES).find(([name]) => key.includes(name) || name.includes(key));
    return entry ? entry[1] : null;
  };
  const haversineKm = (a, b) => {
    if (!a || !b) return Number.POSITIVE_INFINITY;
    const toRad = (value) => (value * Math.PI) / 180;
    const dLat = toRad(numberFrom(b.lat, 0) - numberFrom(a.lat, 0));
    const dLng = toRad(numberFrom(b.lng, 0) - numberFrom(a.lng, 0));
    const lat1 = toRad(numberFrom(a.lat, 0));
    const lat2 = toRad(numberFrom(b.lat, 0));
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const h = (sinLat * sinLat) + (Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng);
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    return 6371 * c;
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
      furnishing: 'Furnished',
      constructionStatus: 'Ready to Move',
      loanAvailable: true,
      lat: 24.5795,
      lng: 73.6843,
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
      furnishing: 'Semi Furnished',
      constructionStatus: 'Ready to Move',
      loanAvailable: true,
      lat: 24.6192,
      lng: 73.7484,
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
      furnishing: 'Unfurnished',
      constructionStatus: 'Ready to Move',
      loanAvailable: true,
      lat: 24.6021,
      lng: 73.7341,
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
      furnishing: '',
      constructionStatus: 'Under Construction',
      loanAvailable: false,
      lat: 24.6351,
      lng: 73.6884,
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
    const duplicatePhotoDetected = Boolean(entry?.aiReview?.duplicatePhotoDetected || numberFrom(entry?.media?.duplicatePhotoMatches, 0) > 0);
    const suspiciousPricingAlert = Boolean(entry?.aiReview?.suspiciousPricingAlert);
    const fakeListingSignal = Boolean(entry?.aiReview?.fakeListingSignal || duplicatePhotoDetected || suspiciousPricingAlert);
    const locality = entry.location || entry.locality || 'Udaipur';
    const coords = {
      lat: Number.isFinite(numberFrom(entry.latitude, Number.NaN)) ? numberFrom(entry.latitude, Number.NaN) : null,
      lng: Number.isFinite(numberFrom(entry.longitude, Number.NaN)) ? numberFrom(entry.longitude, Number.NaN) : null,
    };
    const fallbackCoords = getCoordsFromLocality(locality);
    const lat = Number.isFinite(coords.lat) ? coords.lat : (fallbackCoords?.lat ?? UDAIPUR_CENTER.lat);
    const lng = Number.isFinite(coords.lng) ? coords.lng : (fallbackCoords?.lng ?? UDAIPUR_CENTER.lng);
    return {
      id: entry.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: entry.title || 'Untitled Listing',
      locality,
      category: entry.category || 'House',
      purpose: entry.purpose || normalizePurpose(entry.type),
      price: numberFrom(entry.price, 0),
      areaSqft: numberFrom(entry.builtUpArea || entry.plotSize || entry.carpetArea || entry.areaSqft, 0),
      beds: numberFrom(entry.bedrooms || entry.beds, 0),
      furnishing: normalizeFurnishing(entry.furnished || entry.furnishing),
      constructionStatus: normalizeConstructionStatus(entry.readyToMove || entry.constructionStatus || entry.statusTag || entry.possessionStatus),
      loanAvailable: normalizeLoanAvailability(entry.loanAvailable || entry.homeLoanAvailable),
      city: 'Udaipur',
      lat,
      lng,
      ownerPhone: String(entry.ownerPhone || entry.contactPhone || '').replace(/\D+/g, ''),
      verifiedByPropertySetu: trustModelEligible,
      verified: Boolean(entry.verified || entry.status === 'Approved' || trustModelEligible),
      premium: Boolean(entry.featured || photosCount >= 8),
      trustScore: Math.max(35, numberFrom(entry?.verification?.verificationScore, 0) || numberFrom(entry.trustScore, 100 - riskScore)),
      duplicatePhotoDetected,
      suspiciousPricingAlert,
      fakeListingSignal,
      videoTourReady: Boolean(entry?.videoVisit?.enabled || (entry?.media?.videoUploaded && numberFrom(entry?.media?.videoDurationSec, 0) >= 30)),
      videoDurationSec: numberFrom(entry?.media?.videoDurationSec, 0),
      virtualTourOption: entry?.videoVisit?.virtualTourOption || null,
      virtualTourSlot: entry?.videoVisit?.virtualTourSlot || entry?.virtualTour?.slot || null,
      liveVideoVisitSlot: entry?.videoVisit?.liveVideoVisitSlot || entry?.visitBooking?.preferredSlot || null,
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
      furnishing: normalizeFurnishing(entry.furnished || entry.furnishing),
      constructionStatus: normalizeConstructionStatus(entry.readyToMove || entry.constructionStatus || entry.possessionStatus),
      loanAvailable: normalizeLoanAvailability(entry.loanAvailable || entry.homeLoanAvailable),
      city: 'Udaipur',
      lat: getCoordsFromLocality(locality)?.lat ?? UDAIPUR_CENTER.lat,
      lng: getCoordsFromLocality(locality)?.lng ?? UDAIPUR_CENTER.lng,
      ownerPhone: String(entry.ownerPhone || entry.contactPhone || '').replace(/\D+/g, ''),
      verifiedByPropertySetu: Boolean(entry.verifiedByPropertySetu || isTrustModelEligible(entry)),
      verified: Boolean(entry.verified || entry.featured || entry.verifiedByPropertySetu || isTrustModelEligible(entry)),
      premium: Boolean(entry.featured),
      trustScore: entry.featured ? 85 : 68,
      duplicatePhotoDetected: Boolean(entry?.aiReview?.duplicatePhotoDetected),
      suspiciousPricingAlert: Boolean(entry?.aiReview?.suspiciousPricingAlert),
      fakeListingSignal: Boolean(entry?.aiReview?.fakeListingSignal || entry?.aiReview?.duplicatePhotoDetected || entry?.aiReview?.suspiciousPricingAlert),
      videoTourReady: Boolean(entry?.videoVisit?.enabled || (entry?.media?.videoUploaded && numberFrom(entry?.media?.videoDurationSec, 0) >= 30)),
      videoDurationSec: numberFrom(entry?.media?.videoDurationSec, 0),
      virtualTourOption: entry?.videoVisit?.virtualTourOption || null,
      virtualTourSlot: entry?.videoVisit?.virtualTourSlot || entry?.virtualTour?.slot || null,
      liveVideoVisitSlot: entry?.videoVisit?.liveVideoVisitSlot || entry?.visitBooking?.preferredSlot || null,
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
  let aiRefreshTimer = null;
  let aiLastKey = '';

  const readSellerEngagement = () => {
    const store = readJson(SELLER_ENGAGEMENT_KEY, {});
    return store && typeof store === 'object' ? store : {};
  };

  const writeSellerEngagement = (store) => {
    writeJson(SELLER_ENGAGEMENT_KEY, store);
  };

  const trackSellerEngagement = (listingId, eventType, source = 'marketplace') => {
    const id = String(listingId || '').trim();
    if (!id) return;
    const store = readSellerEngagement();
    const row = store[id] && typeof store[id] === 'object'
      ? { ...store[id] }
      : { views: 0, saves: 0, inquiries: 0, history: [] };

    if (eventType === 'view') row.views = numberFrom(row.views, 0) + 1;
    if (eventType === 'inquiry') row.inquiries = numberFrom(row.inquiries, 0) + 1;
    if (eventType === 'save') row.saves = numberFrom(row.saves, 0) + 1;
    if (eventType === 'unsave') row.saves = Math.max(0, numberFrom(row.saves, 0) - 1);

    const history = Array.isArray(row.history) ? row.history : [];
    history.unshift({
      at: new Date().toISOString(),
      eventType,
      source,
    });
    row.history = history.slice(0, 80);
    row.updatedAt = new Date().toISOString();

    store[id] = row;
    writeSellerEngagement(store);
  };

  const getFilters = () => ({
    query: String(marketQuery?.value || '').trim(),
    locality: String(marketLocality?.value || '').trim(),
    category: marketCategory?.value || 'all',
    purpose: marketPurpose?.value || 'all',
    minPrice: numberFrom(marketMinPrice?.value, 0),
    maxPrice: numberFrom(marketMaxPrice?.value, Number.MAX_SAFE_INTEGER),
    sort: marketSort?.value || 'relevance',
    verifiedOnly: String(marketVerifiedOnly?.value || '0') === '1',
    radiusKm: numberFrom(marketRadiusKm?.value, 0),
    bhk: marketBhk?.value || 'all',
    furnishing: marketFurnishing?.value || 'all',
    constructionStatus: marketConstruction?.value || 'all',
    loanAvailable: marketLoanAvailable?.value || 'all',
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
    if (marketRadiusKm) marketRadiusKm.value = numberFrom(filters.radiusKm, 0) ? String(numberFrom(filters.radiusKm, 0)) : '0';
    if (marketBhk) marketBhk.value = filters.bhk || 'all';
    if (marketFurnishing) marketFurnishing.value = filters.furnishing || 'all';
    if (marketConstruction) marketConstruction.value = filters.constructionStatus || 'all';
    if (marketLoanAvailable) marketLoanAvailable.value = filters.loanAvailable || 'all';
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
    trackSellerEngagement(listingId, index >= 0 ? 'unsave' : 'save', 'wishlist');
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
    const compareItems = state.compare
      .map((id) => listings.find((item) => item.id === id))
      .filter(Boolean);
    if (compareList) {
      const rows = compareItems.map((item) => `<li><strong>${item.title}</strong><br>${item.locality} • ${formatPrice(item.price)}</li>`);
      compareList.innerHTML = rows.length ? rows.join('') : '<li>No compare selection yet.</li>';
    }
    if (!compareTableWrap) return;
    if (!compareItems.length) {
      compareTableWrap.innerHTML = '2-3 properties add karte hi detailed comparison table yahan show hoga.';
      return;
    }
    const headers = compareItems.map((item) => `<th style="padding:8px;border:1px solid #d9e6f4;background:#f5faff;">${item.title}</th>`).join('');
    const tableRow = (label, formatter) => `<tr>
      <th style="padding:8px;border:1px solid #d9e6f4;background:#f7fbff;text-align:left;white-space:nowrap;">${label}</th>
      ${compareItems.map((item) => `<td style="padding:8px;border:1px solid #d9e6f4;">${formatter(item)}</td>`).join('')}
    </tr>`;
    compareTableWrap.innerHTML = `
      <div style="overflow:auto;margin:10px 0 12px;">
        <table style="width:100%;min-width:720px;border-collapse:collapse;font-size:0.92rem;">
          <thead>
            <tr>
              <th style="padding:8px;border:1px solid #d9e6f4;background:#ecf5ff;text-align:left;">Feature</th>
              ${headers}
            </tr>
          </thead>
          <tbody>
            ${tableRow('Price', (item) => formatPrice(item.price))}
            ${tableRow('Locality', (item) => item.locality || 'Udaipur')}
            ${tableRow('Category', (item) => item.category || 'N/A')}
            ${tableRow('Purpose', (item) => item.purpose || 'N/A')}
            ${tableRow('Area', (item) => (item.areaSqft ? `${item.areaSqft} sq.ft.` : 'N/A'))}
            ${tableRow('BHK', (item) => (item.beds ? `${item.beds} BHK` : 'Flexible'))}
            ${tableRow('Furnishing', (item) => item.furnishing || 'N/A')}
            ${tableRow('Construction', (item) => item.constructionStatus || 'N/A')}
            ${tableRow('Loan', (item) => (item.loanAvailable ? 'Available' : 'Not Marked'))}
            ${tableRow('Verification', (item) => (item.verifiedByPropertySetu ? 'Verified by PropertySetu' : (item.verified ? 'Verified' : 'Pending')))}
            ${tableRow('Trust Score', (item) => `${Math.round(numberFrom(item.trustScore, 0))}%`)}
          </tbody>
        </table>
      </div>
    `;
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

    if (q) filtered = filtered.filter((item) => `${item.title} ${item.locality} ${item.category} ${item.purpose}`.toLowerCase().includes(q));
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
    if (filters.bhk !== 'all') {
      const bhkValue = numberFrom(filters.bhk, 0);
      filtered = filtered.filter((item) => (bhkValue >= 4 ? numberFrom(item.beds, 0) >= 4 : numberFrom(item.beds, 0) === bhkValue));
    }
    if (filters.furnishing !== 'all') {
      filtered = filtered.filter((item) => normalizeFurnishing(item.furnishing) === normalizeFurnishing(filters.furnishing));
    }
    if (filters.constructionStatus !== 'all') {
      filtered = filtered.filter((item) => normalizeConstructionStatus(item.constructionStatus) === normalizeConstructionStatus(filters.constructionStatus));
    }
    if (filters.loanAvailable === 'yes') filtered = filtered.filter((item) => !!item.loanAvailable);
    if (filters.loanAvailable === 'no') filtered = filtered.filter((item) => !item.loanAvailable);
    if (numberFrom(filters.radiusKm, 0) > 0) {
      const center = getCoordsFromLocality(filters.locality) || UDAIPUR_CENTER;
      filtered = filtered.filter((item) => {
        const itemCoords = {
          lat: numberFrom(item.lat, Number.NaN),
          lng: numberFrom(item.lng, Number.NaN),
        };
        const resolvedCoords = (Number.isFinite(itemCoords.lat) && Number.isFinite(itemCoords.lng))
          ? itemCoords
          : (getCoordsFromLocality(item.locality) || UDAIPUR_CENTER);
        return haversineKm(center, resolvedCoords) <= numberFrom(filters.radiusKm, 0);
      });
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
    if (Number.isFinite(filters.maxPrice) && filters.maxPrice !== Number.MAX_SAFE_INTEGER) tags.push(`Max: ${formatPrice(filters.maxPrice)}`);
    if (filters.verifiedOnly) tags.push('Verified Only');
    if (numberFrom(filters.radiusKm, 0) > 0) tags.push(`Radius: ${numberFrom(filters.radiusKm, 0)} km`);
    if (filters.bhk !== 'all') tags.push(`BHK: ${filters.bhk === '4' ? '4+' : filters.bhk}`);
    if (filters.furnishing !== 'all') tags.push(`Furnishing: ${filters.furnishing}`);
    if (filters.constructionStatus !== 'all') tags.push(`Construction: ${filters.constructionStatus}`);
    if (filters.loanAvailable !== 'all') tags.push(`Loan: ${filters.loanAvailable === 'yes' ? 'Available' : 'No'}`);
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
              ${item.fakeListingSignal ? '<span class="listing-badge" style="background:#ffe9e9;color:#8f1d1d;">AI Risk Alert</span>' : ''}
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
              <li>${item.furnishing || 'Furnishing N/A'}</li>
              <li>${item.constructionStatus || 'Construction N/A'}</li>
              <li>${item.loanAvailable ? 'Loan Available' : 'Loan Info N/A'}</li>
              <li>Trust ${Math.round(item.trustScore)}%</li>
              <li>${item.videoTourReady ? `Video ${Math.round(item.videoDurationSec || 30)} sec` : 'Video Tour Pending'}</li>
              <li>${item.fakeListingSignal ? 'Fraud Signal: Review Needed' : 'AI Fraud: Clear'}</li>
            </ul>
            <div class="listing-actions">
              <button class="action-btn" data-action="wishlist" data-id="${item.id}" type="button">${inWishlist ? 'Wishlisted' : 'Wishlist'}</button>
              <button class="action-btn" data-action="compare" data-id="${item.id}" type="button">${inCompare ? 'Compared' : 'Compare'}</button>
              <button class="action-btn primary" data-action="visit" data-id="${item.id}" type="button">Book Visit</button>
              <button class="action-btn primary" data-action="virtualTour" data-id="${item.id}" type="button">Virtual Tour</button>
              <button class="action-btn" data-action="videoVisit" data-id="${item.id}" type="button">Live Video Visit</button>
              <button class="action-btn" data-action="chat" data-id="${item.id}" type="button">Chat Owner</button>
              <button class="action-btn" data-action="whatsapp" data-id="${item.id}" type="button">WhatsApp</button>
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

  const buildTrendLabels = (offset = 0) => {
    const monthDate = new Date();
    monthDate.setMonth(monthDate.getMonth() - offset);
    return {
      monthOffset: offset,
      monthLabel: monthDate.toLocaleString('en-IN', { month: 'short' }),
      monthKey: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`,
    };
  };

  const drawAiTrendGraph = (trendItems = []) => {
    if (!aiTrendCanvas) return;
    const context = aiTrendCanvas.getContext('2d');
    if (!context) return;
    const width = aiTrendCanvas.width;
    const height = aiTrendCanvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);

    const sorted = [...trendItems]
      .map((item) => ({
        ...buildTrendLabels(numberFrom(item?.monthOffset, 0)),
        avgRate: numberFrom(item?.avgRate, 0),
        monthLabel: item?.monthLabel || buildTrendLabels(numberFrom(item?.monthOffset, 0)).monthLabel,
      }))
      .sort((a, b) => numberFrom(b.monthOffset, 0) - numberFrom(a.monthOffset, 0));

    if (!sorted.length) {
      context.fillStyle = '#6b86a3';
      context.font = '14px sans-serif';
      context.fillText('No trend data available', 16, 30);
      return;
    }

    const values = sorted.map((item) => numberFrom(item.avgRate, 0));
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const range = Math.max(1, maxValue - minValue);
    const padLeft = 42;
    const padRight = 18;
    const padTop = 16;
    const padBottom = 28;
    const drawWidth = width - padLeft - padRight;
    const drawHeight = height - padTop - padBottom;

    context.strokeStyle = '#d9e7f6';
    context.lineWidth = 1;
    for (let i = 0; i <= 4; i += 1) {
      const y = padTop + (drawHeight * i) / 4;
      context.beginPath();
      context.moveTo(padLeft, y);
      context.lineTo(width - padRight, y);
      context.stroke();
    }

    const points = sorted.map((item, index) => {
      const x = padLeft + (drawWidth * index) / Math.max(1, sorted.length - 1);
      const normalized = (numberFrom(item.avgRate, 0) - minValue) / range;
      const y = padTop + drawHeight - (normalized * drawHeight);
      return { ...item, x, y };
    });

    context.strokeStyle = '#0e5aa7';
    context.lineWidth = 2.5;
    context.beginPath();
    points.forEach((point, index) => {
      if (index === 0) context.moveTo(point.x, point.y);
      else context.lineTo(point.x, point.y);
    });
    context.stroke();

    context.fillStyle = '#0e5aa7';
    points.forEach((point) => {
      context.beginPath();
      context.arc(point.x, point.y, 3.2, 0, Math.PI * 2);
      context.fill();
    });

    context.fillStyle = '#2a4d71';
    context.font = '11px sans-serif';
    points.forEach((point) => {
      context.fillText(point.monthLabel, point.x - 12, height - 8);
    });

    context.fillStyle = '#2a4d71';
    context.font = '10px sans-serif';
    context.fillText(`₹${Math.round(maxValue).toLocaleString('en-IN')}`, 6, padTop + 4);
    context.fillText(`₹${Math.round(minValue).toLocaleString('en-IN')}`, 6, padTop + drawHeight);
  };

  const getFallbackInsights = (locality) => {
    const key = String(locality || '').toLowerCase();
    const matched = listings.filter((item) => String(item.locality || '').toLowerCase().includes(key));
    const source = matched.length ? matched : listings;
    const prices = source.map((item) => numberFrom(item.price, 0)).filter((value) => value > 0).sort((a, b) => a - b);
    const avgPrice = prices.length ? Math.round(prices.reduce((sum, value) => sum + value, 0) / prices.length) : 0;
    const medianPrice = prices.length ? prices[Math.floor(prices.length / 2)] : 0;
    const trendBase = avgPrice || 4000000;
    const trend = [5, 4, 3, 2, 1, 0].map((offset) => {
      const labels = buildTrendLabels(offset);
      return {
        monthOffset: offset,
        monthLabel: labels.monthLabel,
        monthKey: labels.monthKey,
        avgRate: Math.max(1500000, Math.round(trendBase * (1 + (offset - 2) * 0.02))),
      };
    });
    return {
      stats: {
        locality: locality || 'Udaipur',
        totalListings: matched.length || source.length,
        avgPrice: avgPrice || trendBase,
        medianPrice: medianPrice || avgPrice || trendBase,
      },
      trend,
    };
  };

  const fetchAiInsights = async (locality) => {
    if (!live.request) return getFallbackInsights(locality);
    try {
      const response = await live.request(`/insights/locality?name=${encodeURIComponent(locality || 'Udaipur')}`);
      if (response?.ok) {
        return {
          stats: response.stats || {},
          trend: Array.isArray(response.trend) ? response.trend : [],
        };
      }
    } catch {
      // fallback below
    }
    return getFallbackInsights(locality);
  };

  const getFallbackRecommendations = ({ locality, category, referenceListing }) => {
    const localKey = String(locality || '').toLowerCase();
    const categoryKey = String(category || '').toLowerCase();
    const basePrice = numberFrom(referenceListing?.price, 0);
    return listings
      .filter((item) => item.id !== referenceListing?.id)
      .map((item) => {
        let score = numberFrom(item.trustScore, 45);
        if (localKey && String(item.locality || '').toLowerCase().includes(localKey)) score += 16;
        if (categoryKey && categoryKey !== 'all' && String(item.category || '').toLowerCase() === categoryKey) score += 18;
        if (basePrice > 0 && numberFrom(item.price, 0) > 0) {
          const ratio = Math.abs(numberFrom(item.price, 0) - basePrice) / basePrice;
          score += Math.max(0, 20 - Math.round(ratio * 40));
        }
        if (item.verified) score += 8;
        const recommendationScore = Math.max(35, Math.min(100, Math.round(score)));
        return {
          ...item,
          recommendationScore,
          recommendationReason: recommendationScore >= 80 ? 'high trust + price similarity' : 'similar locality/category',
        };
      })
      .sort((a, b) => numberFrom(b.recommendationScore, 0) - numberFrom(a.recommendationScore, 0))
      .slice(0, 5);
  };

  const fetchAiRecommendations = async ({ locality, category, referenceListing }) => {
    if (!live.request) return getFallbackRecommendations({ locality, category, referenceListing });
    try {
      const response = await live.request(`/recommendations?locality=${encodeURIComponent(locality || '')}&category=${encodeURIComponent(category || 'all')}&price=${encodeURIComponent(numberFrom(referenceListing?.price, 0))}&excludeId=${encodeURIComponent(referenceListing?.id || '')}&limit=5`);
      const items = Array.isArray(response?.items) ? response.items : [];
      if (items.length) return items;
    } catch {
      // fallback below
    }
    return getFallbackRecommendations({ locality, category, referenceListing });
  };

  const renderAiRecommendations = (items = []) => {
    if (!aiRecommendationList) return;
    if (!items.length) {
      aiRecommendationList.innerHTML = '<li>No similar recommendations right now.</li>';
      return;
    }
    aiRecommendationList.innerHTML = items.slice(0, 5).map((item) => `
      <li>
        <strong>${item.title || 'Recommended Listing'}</strong><br>
        ${item.locality || 'Udaipur'} • ${formatPrice(item.price)} • ${item.category || 'Property'}<br>
        <span class="tiny-note">AI Score: ${Math.round(numberFrom(item.recommendationScore, item.trustScore || 0))}% • ${item.recommendationReason || 'high relevance match'}</span>
      </li>
    `).join('');
  };

  const updateAiPanels = async (filters, filteredListings, force = false) => {
    const locality = String(filters.locality || filteredListings?.[0]?.locality || 'Udaipur').trim() || 'Udaipur';
    const category = filters.category !== 'all' ? filters.category : (filteredListings?.[0]?.category || 'all');
    const referenceListing = filteredListings?.[0] || null;
    const key = `${locality}|${category}|${referenceListing?.id || ''}|${filteredListings?.length || 0}`;
    if (!force && key === aiLastKey) return;
    aiLastKey = key;

    if (aiPricingSummary) aiPricingSummary.textContent = 'AI pricing pulse loading...';
    if (aiTrendMeta) aiTrendMeta.textContent = 'Loading 6-month trend...';

    const [insights, recommendations] = await Promise.all([
      fetchAiInsights(locality),
      fetchAiRecommendations({ locality, category, referenceListing }),
    ]);

    const avgPrice = numberFrom(insights?.stats?.avgPrice, 0);
    const medianPrice = numberFrom(insights?.stats?.medianPrice, 0);
    const listingCount = numberFrom(insights?.stats?.totalListings, 0);
    if (aiPricingSummary) {
      aiPricingSummary.textContent = `Is area me average price ₹${avgPrice.toLocaleString('en-IN')} hai. Median ₹${medianPrice.toLocaleString('en-IN')} (matched listings: ${listingCount}).`;
    }
    const trend = Array.isArray(insights?.trend) ? insights.trend : [];
    drawAiTrendGraph(trend);
    if (aiTrendMeta) aiTrendMeta.textContent = `AI market trend for ${locality} - last 6 months.`;
    renderAiRecommendations(recommendations);
  };

  const scheduleAiPanels = (filters, filteredListings, force = false) => {
    clearTimeout(aiRefreshTimer);
    aiRefreshTimer = setTimeout(() => {
      updateAiPanels(filters, filteredListings, force).catch(() => {
        if (aiPricingSummary) aiPricingSummary.textContent = 'AI module fallback mode me hai (local model running).';
      });
    }, force ? 0 : 220);
  };

  const runPipeline = () => {
    const filters = getFilters();
    const filtered = applyFilters(filters);
    renderListings(filtered);
    renderActiveTags(filters);
    writeJson(FILTER_STATE_KEY, filters);
    scheduleAiPanels(filters, filtered);
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

  const toLocalInputValue = (date) => {
    const safe = new Date(date);
    safe.setMinutes(safe.getMinutes() - safe.getTimezoneOffset());
    return safe.toISOString().slice(0, 16);
  };

  const getPreferredVisitIso = (title) => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const defaultLocal = toLocalInputValue(tomorrow);
    const raw = window.prompt(
      `Preferred visit date-time enter karein (${title || 'listing'})\nFormat: YYYY-MM-DDTHH:mm`,
      defaultLocal,
    );
    if (raw === null) return null;
    const parsed = new Date(raw);
    if (!Number.isFinite(parsed.getTime())) {
      window.alert('Invalid date-time format. Example: 2026-03-25T16:30');
      return null;
    }
    return parsed.toISOString();
  };

  const bookLiveVisit = async (listingId, preferredAt) => {
    const token = live.getAnyToken ? live.getAnyToken() : '';
    if (!token || !live.request) return false;
    try {
      await live.request(`/properties/${encodeURIComponent(listingId)}/visit`, {
        method: 'POST',
        token,
        data: {
          preferredAt,
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

  const bookLiveVideoVisit = async (listingId, preferredAt) => {
    const token = live.getAnyToken ? live.getAnyToken() : '';
    if (!token || !live.request) return false;
    try {
      await live.request(`/properties/${encodeURIComponent(listingId)}/visit`, {
        method: 'POST',
        token,
        data: {
          preferredAt,
          mode: 'video',
          note: 'Live video visit requested from marketplace',
        },
      });
      return true;
    } catch (error) {
      if (!live.shouldFallbackToLocal || !live.shouldFallbackToLocal(error)) {
        window.alert(error.message || 'Video visit request failed.');
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

  [
    marketQuery,
    marketLocality,
    marketCategory,
    marketPurpose,
    marketMinPrice,
    marketMaxPrice,
    marketSort,
    marketVerifiedOnly,
    marketRadiusKm,
    marketBhk,
    marketFurnishing,
    marketConstruction,
    marketLoanAvailable,
  ].forEach((field) => {
    field?.addEventListener('input', runPipeline);
    field?.addEventListener('change', runPipeline);
  });

  saveSearchBtn?.addEventListener('click', saveCurrentSearch);
  aiRefreshBtn?.addEventListener('click', () => {
    const filters = getFilters();
    const filtered = applyFilters(filters);
    scheduleAiPanels(filters, filtered, true);
  });

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
      radiusKm: 0,
      bhk: 'all',
      furnishing: 'all',
      constructionStatus: 'all',
      loanAvailable: 'all',
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
      trackSellerEngagement(listingId, 'view', 'details');
      window.location.href = `property-details.html?id=${encodeURIComponent(listingId)}`;
      return;
    }

    if (action === 'chat') {
      pushRecent(listingId);
      trackSellerEngagement(listingId, 'inquiry', 'chat');
      window.location.href = `user-dashboard.html?propertyId=${encodeURIComponent(listingId)}`;
      return;
    }

    if (action === 'whatsapp') {
      const item = listings.find((entry) => entry.id === listingId);
      const phone = String(item?.ownerPhone || DEFAULT_WHATSAPP_NUMBER).replace(/\D+/g, '');
      const text = encodeURIComponent(`Hi PropertySetu, mujhe ${item?.title || 'is listing'} (${item?.locality || 'Udaipur'}) ke baare me details chahiye.`);
      trackSellerEngagement(listingId, 'inquiry', 'whatsapp');
      window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
      return;
    }

    if (action === 'map') {
      const item = listings.find((entry) => entry.id === listingId);
      const coords = (Number.isFinite(numberFrom(item?.lat, Number.NaN)) && Number.isFinite(numberFrom(item?.lng, Number.NaN)))
        ? `${numberFrom(item?.lat, 0)},${numberFrom(item?.lng, 0)}`
        : `${item?.locality || 'Udaipur'}, Udaipur`;
      const query = encodeURIComponent(coords);
      trackSellerEngagement(listingId, 'view', 'map');
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

    if (action === 'virtualTour') {
      const item = listings.find((entry) => entry.id === listingId);
      if (!item) return;
      if (!item.videoTourReady) {
        window.alert('Virtual tour abhi available nahi hai. Seller 30 sec video pending hai.');
        return;
      }
      trackSellerEngagement(listingId, 'inquiry', 'virtual-tour');
      const slot = item.virtualTourSlot ? new Date(item.virtualTourSlot).toLocaleString() : 'Slot will be shared after request';
      window.alert(`Virtual Tour Option: ${item.virtualTourOption || 'Recorded Video Tour'}\nPreferred Slot: ${slot}`);
      pushNotification(
        `Virtual tour requested for ${item.title}.`,
        ['customer', 'seller'],
        'Virtual Tour Request',
        'info',
      );
      return;
    }

    if (action === 'videoVisit') {
      const item = listings.find((entry) => entry.id === listingId);
      if (!item) return;
      if (!item.videoTourReady) {
        window.alert('Live video visit available nahi hai. Seller 30 sec video required hai.');
        return;
      }
      trackSellerEngagement(listingId, 'inquiry', 'video-visit');
      const preferredAt = item.liveVideoVisitSlot || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const liveDone = await bookLiveVideoVisit(listingId, preferredAt);
      const videoVisits = readJson(VIDEO_VISIT_KEY, []);
      videoVisits.unshift({
        listingId,
        title: item.title,
        locality: item.locality,
        preferredAt,
        createdAt: new Date().toISOString(),
        source: liveDone ? 'live' : 'local',
      });
      writeJson(VIDEO_VISIT_KEY, videoVisits.slice(0, 80));
      pushNotification(
        `Live video visit booked for ${item.title}.`,
        ['customer', 'seller', 'admin'],
        'Video Visit Booked',
        'success',
      );
      window.alert('Live video visit request submitted.');
      return;
    }

    if (action === 'visit') {
      pushRecent(listingId);
      const listing = listings.find((entry) => entry.id === listingId);
      const preferredAt = getPreferredVisitIso(listing?.title);
      if (!preferredAt) return;
      trackSellerEngagement(listingId, 'inquiry', 'visit');
      state.visits.unshift({ listingId, preferredAt, at: new Date().toISOString() });
      state.visits = state.visits.slice(0, 30);
      writeJson(MARKET_STATE_KEY, state);
      const liveDone = await bookLiveVisit(listingId, preferredAt);
      if (liveDone) {
        window.alert('Visit request live submit ho gayi.');
        pushNotification(
          `Visit request submitted for ${listing?.title || listingId}. Preferred time: ${new Date(preferredAt).toLocaleString()}.`,
          ['customer', 'seller', 'admin'],
          'Visit Requested',
          'success',
        );
      } else {
        window.alert('Visit request local queue me save ho gayi. Login se live submit hoga.');
        pushNotification(
          `Visit request queued for ${listing?.title || listingId}. Preferred time: ${new Date(preferredAt).toLocaleString()}.`,
          ['customer', 'seller', 'admin'],
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
