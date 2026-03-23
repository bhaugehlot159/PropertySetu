(function () {
  const API_BASE = `${window.location.origin}/api`;
  const LISTINGS_KEY = 'propertySetu:listings';
  const SESSION_KEYS = {
    customer: 'propertysetu-customer-session',
    admin: 'propertysetu-admin-session',
    seller: 'propertysetu-seller-session',
  };

  const readJson = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const writeJson = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // no-op
    }
  };

  const text = (value, fallback = '') => {
    const normalized = String(value || '').trim();
    return normalized || fallback;
  };

  const numberFrom = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const normalizePurpose = (value) => {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'Buy';
    if (raw.startsWith('rent')) return 'Rent';
    if (raw.startsWith('sell')) return 'Sell';
    if (raw.startsWith('lease')) return 'Lease';
    if (raw.startsWith('resale')) return 'Resale';
    if (raw.includes('girvi') || raw.includes('mortgage')) return 'Mortgage (Girvi)';
    if (raw.includes('property care')) return 'Property Care';
    if (raw.includes('home maintenance')) return 'Home Maintenance';
    if (raw.includes('home watch')) return 'Home Watch';
    if (raw.startsWith('buy')) return 'Buy';
    return raw.charAt(0).toUpperCase() + raw.slice(1);
  };

  const getSession = (role) => readJson(SESSION_KEYS[role], null);
  const getToken = (role) => String(getSession(role)?.token || '').trim();
  const getRoleFromSession = (role) => String(getSession(role)?.role || role || '').trim();

  const getAnySession = () => (
    getSession('customer')
    || getSession('admin')
    || getSession('seller')
    || null
  );

  const getAnyToken = () => (
    getToken('customer')
    || getToken('admin')
    || getToken('seller')
    || ''
  );

  const buildHeaders = (token) => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  });

  const shouldFallbackToLocal = (error) => {
    const msg = String(error?.message || '').toLowerCase();
    return (
      msg.includes('failed to fetch')
      || msg.includes('network')
      || msg.includes('abort')
      || msg.includes('404')
      || msg.includes('500')
      || msg.includes('502')
      || msg.includes('503')
      || msg.includes('504')
    );
  };

  const request = async (path, options = {}) => {
    const {
      method = 'GET',
      data = null,
      token = getAnyToken(),
      timeoutMs = 12000,
    } = options;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        method,
        headers: buildHeaders(token),
        ...(data ? { body: JSON.stringify(data) } : {}),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(payload?.message || `Request failed (${response.status})`);
        error.status = response.status;
        throw error;
      }
      return payload;
    } finally {
      clearTimeout(timer);
    }
  };

  const normalizeApiListing = (entry) => {
    if (!entry || typeof entry !== 'object') return null;
    const city = text(entry.city, 'Udaipur');
    if (!city.toLowerCase().includes('udaipur')) return null;

    const createdAt = text(entry.createdAt, new Date().toISOString());
    const riskScore = numberFrom(entry?.aiReview?.fraudRiskScore, 40);
    const photosCount = numberFrom(entry?.media?.photosCount, 0);
    return {
      id: text(entry.id, `api-${Date.now()}`),
      title: text(entry.title, 'Untitled Listing'),
      city: 'Udaipur',
      locality: text(entry.location, 'Udaipur'),
      location: text(entry.location, 'Udaipur'),
      category: text(entry.category, 'House'),
      purpose: normalizePurpose(entry.type),
      type: normalizePurpose(entry.type),
      price: numberFrom(entry.price, 0),
      areaSqft: numberFrom(entry.builtUpArea || entry.plotSize || entry.carpetArea, 0),
      beds: numberFrom(entry.bedrooms, 0),
      bedrooms: numberFrom(entry.bedrooms, 0),
      bathrooms: numberFrom(entry.bathrooms, 0),
      status: text(entry.status, 'Pending Approval'),
      verified: Boolean(entry.verified || text(entry.status).toLowerCase() === 'approved'),
      featured: Boolean(entry.featured),
      premium: Boolean(entry.featured || photosCount >= 8),
      trustScore: Math.max(35, numberFrom(entry.trustScore, 100 - riskScore)),
      listedAt: createdAt,
      createdAt,
      updatedAt: text(entry.updatedAt, createdAt),
      image: text(entry.image, 'https://cdn.pixabay.com/photo/2018/03/19/23/07/udaipur-3241594_1280.jpg'),
      ownerId: text(entry.ownerId),
      ownerName: text(entry.ownerName),
      reviewCount: numberFrom(entry.reviewCount, 0),
      averageRating: numberFrom(entry.averageRating, 0),
      media: entry.media || {},
      aiReview: entry.aiReview || {},
    };
  };

  const mergeById = (incoming, existing) => {
    const map = new Map();
    (incoming || []).forEach((item) => {
      if (item?.id) map.set(item.id, item);
    });
    (existing || []).forEach((item) => {
      if (!item?.id || map.has(item.id)) return;
      map.set(item.id, item);
    });
    return [...map.values()];
  };

  const syncLocalListingsFromApi = async (options = {}) => {
    const { includePending = false, mine = false } = options;
    const query = new URLSearchParams({ city: 'Udaipur' });
    if (includePending) query.set('status', 'Pending Approval');
    if (mine) query.set('mine', '1');
    const response = await request(`/properties?${query.toString()}`);
    const fromApi = (response?.items || []).map(normalizeApiListing).filter(Boolean);
    const existing = readJson(LISTINGS_KEY, []);
    const merged = mergeById(fromApi, existing);
    writeJson(LISTINGS_KEY, merged);
    return merged;
  };
  const ai = {
    pricingSuggestion: async (payload = {}) => request('/ai/pricing-suggestion', { method: 'POST', data: payload }),
    descriptionGenerate: async (payload = {}) => request('/ai/description-generate', { method: 'POST', data: payload }),
    fraudScan: async (payload = {}) => request('/ai/fraud-scan', { method: 'POST', data: payload }),
    marketTrend: async (locality = 'Udaipur') => request(`/ai/market-trend?locality=${encodeURIComponent(locality)}`),
    recommendations: async (query = {}) => {
      const params = new URLSearchParams();
      Object.entries(query || {}).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        params.set(key, String(value));
      });
      return request(`/ai/recommendations?${params.toString()}`);
    },
  };

  window.PropertySetuLive = {
    API_BASE,
    LISTINGS_KEY,
    SESSION_KEYS,
    readJson,
    writeJson,
    text,
    numberFrom,
    normalizePurpose,
    getSession,
    getToken,
    getRoleFromSession,
    getAnySession,
    getAnyToken,
    request,
    shouldFallbackToLocal,
    normalizeApiListing,
    mergeById,
    syncLocalListingsFromApi,
    ai,
  };
})();
