(function () {
  const API_BASE = `${window.location.origin}/api`;
  const PRO_API_BASE = `${window.location.origin}/api/v2`;
  const CORE_API_BASE = `${window.location.origin}/api/v3`;
  const LISTINGS_KEY = 'propertySetu:listings';
  const SESSION_KEYS = {
    customer: 'propertysetu-customer-session',
    admin: 'propertysetu-admin-session',
    seller: 'propertysetu-seller-session',
  };

  const PLAN_CATALOG = {
    'basic-plan': { name: 'Basic Subscription', amount: 1499, cycleDays: 30, type: 'subscription' },
    'pro-plan': { name: 'Pro Subscription', amount: 3999, cycleDays: 30, type: 'subscription' },
    'premium-plan': { name: 'Premium Subscription', amount: 7999, cycleDays: 30, type: 'subscription' },
    'featured-7': { name: 'Featured Listing - 7 Days', amount: 299, cycleDays: 7, type: 'featured' },
    'featured-30': { name: 'Featured Listing - 30 Days', amount: 999, cycleDays: 30, type: 'featured' },
    'verified-badge-charge': { name: 'Verified Badge Charge', amount: 799, cycleDays: 30, type: 'verification' },
    'care-basic': { name: 'Property Care Basic Visit', amount: 2500, cycleDays: 30, type: 'care' },
    'care-plus': { name: 'Property Care Cleaning + Visit', amount: 5500, cycleDays: 30, type: 'care' },
    'care-full': { name: 'Property Care Full Maintenance', amount: 10000, cycleDays: 30, type: 'care' },
    'agent-pro': { name: 'Trusted Agent Membership', amount: 1999, cycleDays: 30, type: 'agent' },
  };
  const DEMO_FALLBACK_KEY = 'propertySetu:enableDemoFallback';
  const readStorageFlag = (key) => {
    try {
      const raw = String(localStorage.getItem(key) || '').trim().toLowerCase();
      return ['1', 'true', 'yes', 'on'].includes(raw);
    } catch {
      return false;
    }
  };
  const allowDemoFallback = (
    String(window.__PROPERTYSETU_ENABLE_DEMO_FALLBACK__ || '').trim().toLowerCase() === 'true'
    || readStorageFlag(DEMO_FALLBACK_KEY)
  );
  const strictRealMode = !allowDemoFallback;
  const REMOTE_STATE_PREFIX = 'propertysetu:';
  const REMOTE_STATE_MAX_BATCH = 24;
  const REMOTE_STATE_EXCLUDED_KEYS = new Set([
    LISTINGS_KEY.toLowerCase(),
    DEMO_FALLBACK_KEY.toLowerCase(),
    'propertysetu:notifications:ping',
    'propertysetu:notified',
  ]);
  const REMOTE_STATE_BOOTSTRAP_KEYS = [
    'propertySetu:auctionState',
    'propertySetu:auctionBids',
    'propertySetu:auctionPrefs',
    'propertySetu:auctionWatchlist',
    'propertySetu:auctionAudit',
    'propertySetu:auctionAdminPrefs',
    'propertySetu:auctionAdminAudit',
    'propertySetu:auctionSettlementSla',
    'propertySetu:auctionPayoutReconciliation',
    'propertySetu:auctionTimeline',
  ];
  const remoteStateHydratedKeys = new Set();
  const remoteStateHydrationInFlight = new Set();
  const remoteStateWriteQueue = new Map();
  let remoteStateFlushTimer = null;
  let remoteStateBootstrapped = false;

  const readLocalJson = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };

  const writeLocalJson = (key, value) => {
    try {
      const safeValue = typeof value === 'undefined' ? null : value;
      localStorage.setItem(key, JSON.stringify(safeValue));
    } catch {
      // no-op
    }
  };

  const readSessionTokenRaw = (storageKey) => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return '';
      const parsed = JSON.parse(raw);
      return String(parsed?.token || '').trim();
    } catch {
      return '';
    }
  };

  const getAnyTokenFromStorage = () => (
    readSessionTokenRaw(SESSION_KEYS.customer)
    || readSessionTokenRaw(SESSION_KEYS.admin)
    || readSessionTokenRaw(SESSION_KEYS.seller)
    || ''
  );

  const readJson = (key, fallback) => {
    const normalizedKey = String(key || '');
    const value = readLocalJson(normalizedKey, fallback);
    maybeHydrateRemoteStateForKey(normalizedKey);
    return value;
  };

  const writeJson = (key, value) => {
    const normalizedKey = String(key || '');
    writeLocalJson(normalizedKey, value);
    queueRemoteStateWrite(normalizedKey, value);
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
    if (!allowDemoFallback) return false;
    const msg = String(error?.message || '').toLowerCase();
    return (
      msg.includes('failed to fetch')
      || msg.includes('network')
      || msg.includes('abort')
      || msg.includes('404')
      || msg.includes('405')
      || msg.includes('500')
      || msg.includes('502')
      || msg.includes('503')
      || msg.includes('504')
    );
  };

  const requestJson = async (baseUrl, path, options = {}) => {
    const {
      method = 'GET',
      data = null,
      token = getAnyToken(),
      timeoutMs = 12000,
    } = options;

    const normalizedPath = String(path || '').startsWith('/') ? String(path) : `/${String(path || '')}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${baseUrl}${normalizedPath}`, {
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

  const shouldRemoteSyncKey = (key) => {
    const normalized = String(key || '').trim().toLowerCase();
    if (!normalized || !normalized.startsWith(REMOTE_STATE_PREFIX)) return false;
    if (REMOTE_STATE_EXCLUDED_KEYS.has(normalized)) return false;
    return true;
  };

  const resolveRemoteStateScope = (key) => {
    const normalized = String(key || '').trim().toLowerCase();
    if (normalized.startsWith('propertysetu:auction')) return 'global';
    return 'user';
  };

  const markRemoteStateHydrated = (key) => {
    const normalized = String(key || '').trim();
    if (!normalized) return;
    remoteStateHydratedKeys.add(normalized);
  };

  async function hydrateRemoteStateForKey(key) {
    const normalizedKey = String(key || '').trim();
    if (!shouldRemoteSyncKey(normalizedKey)) return;
    const token = getAnyTokenFromStorage();
    if (!token) return;
    if (remoteStateHydratedKeys.has(normalizedKey)) return;
    if (remoteStateHydrationInFlight.has(normalizedKey)) return;

    remoteStateHydrationInFlight.add(normalizedKey);
    try {
      const scope = resolveRemoteStateScope(normalizedKey);
      const response = await requestJson(
        CORE_API_BASE,
        `/system/client-state?key=${encodeURIComponent(normalizedKey)}&scope=${encodeURIComponent(scope)}`,
        {
          method: 'GET',
          token,
          timeoutMs: 9000,
        }
      );
      if (response?.success && response?.exists) {
        writeLocalJson(normalizedKey, response.value);
      }
      markRemoteStateHydrated(normalizedKey);
    } catch {
      // Keep local behavior if remote state API is temporarily unavailable.
    } finally {
      remoteStateHydrationInFlight.delete(normalizedKey);
    }
  }

  async function hydrateRemoteStateBatch() {
    if (remoteStateBootstrapped) return;
    const token = getAnyTokenFromStorage();
    if (!token) return;
    const requests = REMOTE_STATE_BOOTSTRAP_KEYS
      .filter((key) => shouldRemoteSyncKey(key))
      .map((key) => ({
        key,
        scope: resolveRemoteStateScope(key),
      }))
      .slice(0, REMOTE_STATE_MAX_BATCH);
    if (!requests.length) {
      remoteStateBootstrapped = true;
      return;
    }

    remoteStateBootstrapped = true;
    try {
      const response = await requestJson(CORE_API_BASE, '/system/client-state/batch-read', {
        method: 'POST',
        token,
        timeoutMs: 12000,
        data: { requests },
      });
      const items = Array.isArray(response?.items) ? response.items : [];
      items.forEach((item) => {
        const key = String(item?.key || '').trim();
        if (!key) return;
        if (item?.exists) {
          writeLocalJson(key, item.value);
        }
        markRemoteStateHydrated(key);
      });
    } catch {
      // non-blocking
    }
  }

  function maybeHydrateRemoteStateForKey(key) {
    if (!shouldRemoteSyncKey(key)) return;
    hydrateRemoteStateBatch().catch(() => {});
    hydrateRemoteStateForKey(key).catch(() => {});
  }

  async function flushRemoteStateWrites() {
    if (!remoteStateWriteQueue.size) return;
    const token = getAnyTokenFromStorage();
    if (!token) return;

    const batch = [...remoteStateWriteQueue.values()].slice(0, REMOTE_STATE_MAX_BATCH);
    batch.forEach((item) => remoteStateWriteQueue.delete(item.key));
    if (!batch.length) return;

    try {
      await requestJson(CORE_API_BASE, '/system/client-state/batch-write', {
        method: 'PATCH',
        token,
        timeoutMs: 12000,
        data: {
          items: batch.map((item) => ({
            key: item.key,
            scope: item.scope,
            value: item.value,
          })),
        },
      });
      batch.forEach((item) => markRemoteStateHydrated(item.key));
    } catch {
      batch.forEach((item) => {
        if (!remoteStateWriteQueue.has(item.key)) {
          remoteStateWriteQueue.set(item.key, item);
        }
      });
    } finally {
      if (remoteStateWriteQueue.size) {
        scheduleRemoteStateFlush();
      }
    }
  }

  function scheduleRemoteStateFlush() {
    if (remoteStateFlushTimer) return;
    remoteStateFlushTimer = window.setTimeout(() => {
      remoteStateFlushTimer = null;
      flushRemoteStateWrites().catch(() => {});
    }, 600);
  }

  function queueRemoteStateWrite(key, value) {
    const normalizedKey = String(key || '').trim();
    if (!shouldRemoteSyncKey(normalizedKey)) return;
    const token = getAnyTokenFromStorage();
    if (!token) return;

    remoteStateWriteQueue.set(normalizedKey, {
      key: normalizedKey,
      scope: resolveRemoteStateScope(normalizedKey),
      value: typeof value === 'undefined' ? null : value,
    });
    scheduleRemoteStateFlush();
  }

  const toCoreRole = (role) => {
    const raw = text(role).toLowerCase();
    if (raw === 'admin') return 'admin';
    if (raw === 'seller') return 'seller';
    return 'buyer';
  };

  const toSessionRole = (coreRole) => {
    const raw = text(coreRole).toLowerCase();
    if (raw === 'admin') return 'admin';
    if (raw === 'seller') return 'seller';
    return 'customer';
  };

  const coreTypeFromLegacy = (value) => {
    const raw = text(value).toLowerCase();
    if (raw.includes('rent')) return 'rent';
    if (raw.includes('sell') || raw.includes('resale')) return 'sell';
    if (raw.includes('lease')) return 'lease';
    if (raw.includes('girvi') || raw.includes('mortgage')) return 'mortgage';
    if (raw.includes('auction') || raw.includes('bid')) return 'auction';
    if (
      raw.includes('property care')
      || raw.includes('home maintenance')
      || raw.includes('home watch')
      || raw.includes('service')
    ) return 'service';
    return 'buy';
  };

  const coreCategoryFromLegacy = (value) => {
    const raw = text(value).toLowerCase();
    if (raw.includes('apartment') || raw.includes('flat') || raw.includes('condo')) return 'apartment';
    if (raw.includes('villa')) return 'villa';
    if (raw.includes('farm house') || raw.includes('farmhouse')) return 'farm-house';
    if (raw.includes('plot') || raw.includes('vadi')) return 'plot';
    if (raw.includes('warehouse') || raw.includes('godown')) return 'warehouse';
    if (raw.includes('pg') || raw.includes('hostel')) return 'pg-hostel';
    if (raw.includes('agriculture') || raw.includes('agricultural') || raw.includes('farm land')) return 'agriculture-land';
    if (raw.includes('property care')) return 'property-care';
    if (raw.includes('home maintenance')) return 'home-maintenance';
    if (raw.includes('home watch')) return 'home-watch';
    if (raw.includes('industrial') || raw.includes('factory')) return 'industrial';
    if (raw.includes('co-living') || raw.includes('co living') || raw.includes('coliving')) return 'co-living';
    if (raw.includes('office')) return 'office';
    if (raw.includes('shop') || raw.includes('retail')) return 'shop';
    if (raw.includes('commercial')) return 'commercial';
    return 'house';
  };

  const legacyCategoryFromCore = (value) => {
    const raw = text(value).toLowerCase();
    if (raw === 'apartment') return 'Apartment';
    if (raw === 'villa') return 'Villa';
    if (raw === 'plot') return 'Plot';
    if (raw === 'farm-house') return 'Farm House';
    if (raw === 'commercial') return 'Commercial';
    if (raw === 'office') return 'Office';
    if (raw === 'shop') return 'Shop';
    if (raw === 'pg-hostel') return 'PG / Hostel';
    if (raw === 'warehouse') return 'Warehouse';
    if (raw === 'agriculture-land') return 'Agriculture Land';
    if (raw === 'property-care') return 'Property Care';
    if (raw === 'home-maintenance') return 'Home Maintenance';
    if (raw === 'home-watch') return 'Home Watch';
    if (raw === 'industrial') return 'Industrial';
    if (raw === 'co-living') return 'Co-living';
    if (raw === 'other') return 'Other';
    return 'House';
  };

  const inferPlanType = (planName, fallback = 'subscription') => {
    const raw = text(planName).toLowerCase();
    if (raw.includes('featured')) return 'featured';
    if (raw.includes('care')) return 'care';
    if (raw.includes('verified')) return 'verification';
    if (raw.includes('agent')) return 'agent';
    return fallback;
  };

  const parseSizeToNumber = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const raw = String(value || '').replace(/,/g, '');
    const match = raw.match(/(\d+(\.\d+)?)/);
    return match ? Number(match[1]) : 0;
  };

  const inferLegacyImage = (entry = {}) => {
    if (Array.isArray(entry.images) && entry.images[0]) return entry.images[0];
    if (text(entry.image)) return entry.image;
    return 'https://cdn.pixabay.com/photo/2018/03/19/23/07/udaipur-3241594_1280.jpg';
  };

  const toObject = (value) => (
    value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  );

  const mapCorePropertyToLegacy = (entry) => {
    if (!entry || typeof entry !== 'object') return null;
    const createdAt = text(entry.createdAt, new Date().toISOString());
    const price = numberFrom(entry.price, 0);
    const size = numberFrom(entry.size, parseSizeToNumber(entry.areaSqft));
    const verified = Boolean(entry.verified);
    const status = text(entry.status, verified ? 'Approved' : 'Pending Approval');
    const aiReview = toObject(entry.aiReview);
    const fraudRisk = numberFrom(aiReview.fraudRiskScore, verified ? 15 : 38);
    const verification = toObject(entry.verification);
    const verifiedByPropertySetu = Boolean(
      entry.verifiedByPropertySetu
      || verification.badgeEligible
      || verification.adminApproved
      || verified
    );

    return {
      id: text(entry.id || entry._id, `api-${Date.now()}`),
      title: text(entry.title, 'Untitled Listing'),
      description: text(entry.description),
      city: text(entry.city, 'Udaipur'),
      locality: text(entry.location, 'Udaipur'),
      location: text(entry.location, 'Udaipur'),
      category: text(entry.category ? legacyCategoryFromCore(entry.category) : 'House'),
      purpose: normalizePurpose(entry.type),
      type: normalizePurpose(entry.type),
      saleRentMode: normalizePurpose(entry.type),
      price,
      size,
      areaSqft: size,
      builtUpArea: size,
      plotSize: size,
      beds: numberFrom(entry.bedrooms, 0),
      bedrooms: numberFrom(entry.bedrooms, 0),
      bathrooms: numberFrom(entry.bathrooms, 0),
      status,
      verified,
      verifiedByPropertySetu,
      featured: Boolean(entry.featured),
      featuredUntil: text(entry.featuredUntil),
      premium: Boolean(entry.featured),
      trustScore: Math.max(35, numberFrom(entry.trustScore, 100 - fraudRisk)),
      listedAt: createdAt,
      createdAt,
      updatedAt: text(entry.updatedAt, createdAt),
      image: inferLegacyImage(entry),
      images: Array.isArray(entry.images) ? entry.images : [],
      video: text(entry.video),
      ownerId: text(entry.ownerId),
      ownerName: text(entry.ownerName),
      reviewCount: numberFrom(entry.reviewCount, 0),
      averageRating: numberFrom(entry.averageRating, 0),
      media: toObject(entry.media),
      privateDocs: toObject(entry.privateDocs),
      detailStructure: toObject(entry.detailStructure),
      verification: toObject(entry.verification),
      verifiedBadge: toObject(entry.verifiedBadge),
      virtualTour: toObject(entry.virtualTour),
      visitBooking: toObject(entry.visitBooking),
      videoVisit: toObject(entry.videoVisit),
      mapView: toObject(entry.mapView),
      coordinates: toObject(entry.coordinates),
      aiReview,
    };
  };

  const mapLegacyPropertyToCore = (payload = {}) => {
    const media = toObject(payload.media);
    const uploadedPhotos = Array.isArray(media.uploads)
      ? media.uploads
        .filter((item) => text(item?.category).toLowerCase() === 'photo')
        .map((item) => text(item?.url))
        .filter(Boolean)
      : [];
    const images = Array.isArray(payload.images)
      ? payload.images.filter(Boolean)
      : text(payload.image)
        ? [text(payload.image)]
        : uploadedPhotos;
    const size = parseSizeToNumber(
      payload.size
      || payload.builtUpArea
      || payload.plotSize
      || payload.carpetArea
      || payload.areaSqft
    );

    return {
      title: text(payload.title),
      description: text(payload.description),
      city: text(payload.city, 'Udaipur'),
      location: text(payload.location || payload.locality || payload.city, 'Udaipur'),
      type: coreTypeFromLegacy(payload.type || payload.saleRentMode),
      category: coreCategoryFromLegacy(payload.category || payload.propertyTypeCore),
      price: numberFrom(payload.price, 0),
      size: Math.max(1, size || 1),
      images,
      video: text(payload.video || media.videoUrl || media.videoName),
      media,
      privateDocs: toObject(payload.privateDocs),
      detailStructure: toObject(payload.detailStructure),
      verification: toObject(payload.verification),
      virtualTour: toObject(payload.virtualTour),
      visitBooking: toObject(payload.visitBooking),
      videoVisit: toObject(payload.videoVisit),
      aiReview: toObject(payload.aiReview),
      verified: Boolean(payload.verified),
      featured: Boolean(payload.featured),
      featuredUntil: text(payload.featuredUntil),
    };
  };

  const mapLegacyPatchToCore = (payload = {}) => {
    const updates = {};

    if (typeof payload.title !== 'undefined') updates.title = text(payload.title);
    if (typeof payload.description !== 'undefined') updates.description = text(payload.description);
    if (typeof payload.city !== 'undefined') updates.city = text(payload.city);
    if (typeof payload.location !== 'undefined' || typeof payload.locality !== 'undefined') {
      updates.location = text(payload.location || payload.locality);
    }
    if (typeof payload.type !== 'undefined' || typeof payload.saleRentMode !== 'undefined') {
      updates.type = coreTypeFromLegacy(payload.type || payload.saleRentMode);
    }
    if (typeof payload.category !== 'undefined' || typeof payload.propertyTypeCore !== 'undefined') {
      updates.category = coreCategoryFromLegacy(payload.category || payload.propertyTypeCore);
    }
    if (typeof payload.price !== 'undefined') updates.price = numberFrom(payload.price, 0);
    if (
      typeof payload.size !== 'undefined'
      || typeof payload.builtUpArea !== 'undefined'
      || typeof payload.plotSize !== 'undefined'
      || typeof payload.carpetArea !== 'undefined'
      || typeof payload.areaSqft !== 'undefined'
    ) {
      updates.size = Math.max(1, parseSizeToNumber(
        payload.size
        || payload.builtUpArea
        || payload.plotSize
        || payload.carpetArea
        || payload.areaSqft
      ) || 1);
    }
    if (typeof payload.images !== 'undefined') {
      updates.images = Array.isArray(payload.images) ? payload.images.filter(Boolean) : [];
    }
    if (typeof payload.video !== 'undefined') updates.video = text(payload.video);
    if (typeof payload.media !== 'undefined') {
      updates.media = toObject(payload.media);
      if (typeof payload.video === 'undefined') {
        const mediaVideo = text(payload.media?.videoUrl || payload.media?.videoName);
        if (mediaVideo) updates.video = mediaVideo;
      }
    }
    if (typeof payload.privateDocs !== 'undefined') updates.privateDocs = toObject(payload.privateDocs);
    if (typeof payload.detailStructure !== 'undefined') {
      updates.detailStructure = toObject(payload.detailStructure);
    }
    if (typeof payload.verification !== 'undefined') updates.verification = toObject(payload.verification);
    if (typeof payload.virtualTour !== 'undefined') updates.virtualTour = toObject(payload.virtualTour);
    if (typeof payload.visitBooking !== 'undefined') updates.visitBooking = toObject(payload.visitBooking);
    if (typeof payload.videoVisit !== 'undefined') updates.videoVisit = toObject(payload.videoVisit);
    if (typeof payload.aiReview !== 'undefined') updates.aiReview = toObject(payload.aiReview);
    if (typeof payload.verified !== 'undefined') updates.verified = Boolean(payload.verified);
    if (typeof payload.featured !== 'undefined') updates.featured = Boolean(payload.featured);
    if (typeof payload.featuredUntil !== 'undefined') updates.featuredUntil = text(payload.featuredUntil);

    return updates;
  };

  const mapCoreReviewToLegacy = (entry) => {
    const rating = numberFrom(entry?.rating, 0);
    return {
      id: text(entry?.id || entry?._id, `review-${Date.now()}`),
      propertyId: text(entry?.propertyId),
      userId: text(entry?.userId),
      userName: text(entry?.userName, 'Buyer'),
      rating,
      propertyAccuracy: rating,
      ownerBehavior: rating,
      agentService: rating,
      comment: text(entry?.comment),
      createdAt: text(entry?.createdAt, new Date().toISOString()),
    };
  };

  const mapCoreVisitToLegacy = (entry = {}) => {
    const id = text(entry.id || entry._id);
    const propertyId = text(entry.propertyId);
    const property = toObject(entry.property);
    const legacyStatus = (() => {
      const raw = text(entry.status, 'requested').toLowerCase();
      if (raw === 'confirmed') return 'Confirmed';
      if (raw === 'completed') return 'Completed';
      if (raw === 'cancelled') return 'Cancelled';
      if (raw === 'rejected') return 'Rejected';
      return 'Scheduled';
    })();

    return {
      id: id || `visit-${Date.now()}`,
      _id: id || `visit-${Date.now()}`,
      propertyId,
      propertyTitle: text(property.title || entry.propertyTitle, propertyId),
      customerId: text(entry.customerId),
      customerName: text(entry.customerName || entry.customerId, 'Customer'),
      ownerId: text(entry.ownerId || property.ownerId),
      preferredAt: text(entry.preferredAt),
      note: text(entry.note),
      status: legacyStatus,
      coreStatus: text(entry.status, 'requested'),
      createdAt: text(entry.createdAt, new Date().toISOString()),
      updatedAt: text(entry.updatedAt, text(entry.createdAt, new Date().toISOString())),
      property: property && Object.keys(property).length ? {
        id: text(property.id || property._id, propertyId),
        title: text(property.title, propertyId),
        city: text(property.city, 'Udaipur'),
        location: text(property.location, 'Udaipur'),
        ownerId: text(property.ownerId),
      } : undefined,
    };
  };

  const mapCoreUserToLegacy = (entry = {}) => ({
    id: text(entry.id || entry._id),
    name: text(entry.name),
    email: text(entry.email),
    mobile: text(entry.phone || entry.mobile),
    role: toSessionRole(entry.role),
    verified: Boolean(entry.verified),
    subscriptionPlan: text(entry.subscriptionPlan, 'free'),
  });

  const tryCoreFlow = async (path, options = {}) => {
    const method = text(options.method, 'GET').toUpperCase();
    const [rawPath, rawQuery = ''] = String(path || '').split('?');
    const query = new URLSearchParams(rawQuery || '');

    try {
      if (rawPath.startsWith('/auth/')) {
        if (rawPath === '/auth/request-otp' && method === 'POST') {
          const payload = options.data || {};
          const response = await requestJson(CORE_API_BASE, '/auth/request-otp', {
            method: 'POST',
            token: options.token,
            timeoutMs: options.timeoutMs,
            data: {
              emailOrPhone: text(payload.emailOrPhone || payload.email || payload.mobile || payload.phone),
            },
          });
          return {
            ok: true,
            success: true,
            message: text(response?.message, 'OTP sent successfully.'),
            otpHint: text(response?.otpHint, ''),
            expiresInSec: numberFrom(response?.expiresInSec, 300),
          };
        }

        if (rawPath === '/auth/register' && method === 'POST') {
          const payload = options.data || {};
          const body = {
            name: text(payload.name),
            email: text(payload.email).toLowerCase(),
            phone: text(payload.phone || payload.mobile),
            password: text(payload.password),
            role: toCoreRole(payload.role),
            adminSecret: text(payload.adminSecret),
          };
          const response = await requestJson(CORE_API_BASE, '/auth/register', {
            method: 'POST',
            data: body,
            token: options.token,
            timeoutMs: options.timeoutMs,
          });
          return {
            ok: true,
            success: true,
            user: mapCoreUserToLegacy(response.user),
            token: response.token,
          };
        }

        if (rawPath === '/auth/login' && method === 'POST') {
          const payload = options.data || {};
          const identity = text(payload.emailOrPhone || payload.email || payload.mobile || payload.phone);
          const password = text(payload.password);
          const otp = text(payload.otp);
          if (!identity) return null;
          let response;
          if (password) {
            response = await requestJson(CORE_API_BASE, '/auth/login', {
              method: 'POST',
              data: {
                emailOrPhone: identity,
                password,
              },
              token: options.token,
              timeoutMs: options.timeoutMs,
            });
          } else {
            if (!otp) return null;
            response = await requestJson(CORE_API_BASE, '/auth/login-otp', {
              method: 'POST',
              data: {
                emailOrPhone: identity,
                otp,
              },
              token: options.token,
              timeoutMs: options.timeoutMs,
            });
          }
          return {
            ok: true,
            success: true,
            user: mapCoreUserToLegacy(response.user),
            token: response.token,
          };
        }

        if (rawPath === '/auth/me' && method === 'GET') {
          const response = await requestJson(CORE_API_BASE, '/auth/me', {
            method: 'GET',
            token: options.token,
            timeoutMs: options.timeoutMs,
          });
          return {
            ok: true,
            success: true,
            user: mapCoreUserToLegacy(response.user),
          };
        }

        if (rawPath === '/auth/logout') {
          return { ok: true, success: true, message: 'Logged out successfully.' };
        }

        return null;
      }

      if (rawPath === '/payments/order' && method === 'POST') {
        return requestJson(PRO_API_BASE, '/payments/order', {
          method: 'POST',
          token: options.token,
          timeoutMs: options.timeoutMs,
          data: options.data || {},
        });
      }

      if (rawPath === '/payments/verify' && method === 'POST') {
        return requestJson(PRO_API_BASE, '/payments/verify', {
          method: 'POST',
          token: options.token,
          timeoutMs: options.timeoutMs,
          data: options.data || {},
        });
      }

      if (rawPath === '/subscriptions/activate' && method === 'POST') {
        const payload = options.data || {};
        const planFromCatalog = PLAN_CATALOG[text(payload.planId)];
        const planName = text(payload.planName || planFromCatalog?.name || payload.planId || 'Basic Plan');
        const amount = numberFrom(payload.amount, numberFrom(planFromCatalog?.amount, 0));
        const durationDays = Math.max(1, numberFrom(payload.durationDays, numberFrom(planFromCatalog?.cycleDays, 30)));
        const planType = text(payload.planType || planFromCatalog?.type || inferPlanType(planName, 'subscription'));

        const response = await requestJson(CORE_API_BASE, '/subscriptions', {
          method: 'POST',
          token: options.token,
          timeoutMs: options.timeoutMs,
          data: {
            planName,
            planType,
            amount,
            durationDays,
            propertyId: text(payload.propertyId),
            paymentProvider: text(payload.paymentProvider),
            paymentOrderId: text(payload.paymentOrderId),
            paymentId: text(payload.paymentId),
            paymentStatus: text(payload.paymentStatus),
          },
        });

        return {
          ok: true,
          success: true,
          subscription: {
            ...(response?.subscription || {}),
            status: 'active',
            planId: text(payload.planId),
            planType,
          },
          property: mapCorePropertyToLegacy(response?.property),
          user: mapCoreUserToLegacy(response?.user || {}),
        };
      }

      if (rawPath === '/subscriptions/me' && method === 'GET') {
        const response = await requestJson(CORE_API_BASE, '/subscriptions/me', {
          method: 'GET',
          token: options.token,
          timeoutMs: options.timeoutMs,
        });

        return {
          ok: true,
          success: true,
          total: numberFrom(response?.total, 0),
          activePlan: text(response?.activePlan, 'free'),
          items: Array.isArray(response?.items) ? response.items : [],
        };
      }

      if (rawPath === '/subscriptions/plans') {
        return null;
      }

      if (
        rawPath.startsWith('/admin')
        || rawPath.startsWith('/documentation')
        || rawPath.startsWith('/loan')
        || rawPath.startsWith('/ecosystem')
        || rawPath.startsWith('/valuation')
        || rawPath.startsWith('/rent-agreement')
        || rawPath.startsWith('/franchise')
      ) {
        const forwardPath = `${rawPath}${rawQuery ? `?${rawQuery}` : ''}`;
        return requestJson(CORE_API_BASE, forwardPath, {
          method,
          token: options.token,
          timeoutMs: options.timeoutMs,
          ...(method === 'GET' || method === 'HEAD' ? {} : { data: options.data || {} }),
        });
      }

      if (rawPath === '/properties/taxonomy' && method === 'GET') {
        const response = await requestJson(CORE_API_BASE, '/properties/taxonomy', {
          method: 'GET',
          token: options.token,
          timeoutMs: options.timeoutMs,
        });
        return {
          ok: true,
          success: true,
          types: Array.isArray(response?.types) ? response.types : [],
          categories: Array.isArray(response?.categories) ? response.categories : [],
          defaults: toObject(response?.defaults),
        };
      }

      if (rawPath === '/properties' && method === 'GET') {
        const session = getAnySession();
        const mine = query.get('mine') === '1';
        if (mine) {
          query.delete('mine');
          if (text(session?.id)) query.set('ownerId', text(session.id));
        }

        const status = text(query.get('status'));
        if (status.toLowerCase() === 'pending approval') {
          query.delete('status');
          query.set('verified', 'false');
        } else if (status.toLowerCase() === 'approved') {
          query.delete('status');
          query.set('verified', 'true');
        }

        const queryString = query.toString();
        const response = await requestJson(
          CORE_API_BASE,
          `/properties${queryString ? `?${queryString}` : ''}`,
          {
            method: 'GET',
            token: options.token,
            timeoutMs: options.timeoutMs,
          }
        );

        const items = (response?.items || []).map(mapCorePropertyToLegacy).filter(Boolean);
        return {
          ok: true,
          success: true,
          total: numberFrom(response?.total, items.length),
          count: numberFrom(response?.count, items.length),
          page: numberFrom(response?.page, 1),
          limit: numberFrom(response?.limit, items.length || 20),
          items,
        };
      }

      if (rawPath === '/properties' && method === 'POST') {
        const corePayload = mapLegacyPropertyToCore(options.data || {});
        const response = await requestJson(CORE_API_BASE, '/properties', {
          method: 'POST',
          token: options.token,
          timeoutMs: options.timeoutMs,
          data: corePayload,
        });
        const property = mapCorePropertyToLegacy(response?.item);
        return {
          ok: true,
          success: true,
          property,
          item: property,
        };
      }

      if (rawPath === '/properties/compare' && (method === 'GET' || method === 'POST')) {
        const queryPropertyIds = text(query.get('propertyIds'));
        const bodyPropertyIds = Array.isArray(options.data?.propertyIds)
          ? options.data.propertyIds.map((item) => text(item)).filter(Boolean).join(',')
          : text(options.data?.propertyIds);
        const propertyIds = text(queryPropertyIds || bodyPropertyIds);
        const response = await requestJson(
          CORE_API_BASE,
          method === 'GET'
            ? `/properties/compare${propertyIds ? `?propertyIds=${encodeURIComponent(propertyIds)}` : ''}`
            : '/properties/compare',
          {
            method,
            token: options.token,
            timeoutMs: options.timeoutMs,
            ...(method === 'POST' ? { data: { propertyIds } } : {}),
          }
        );
        return {
          ok: true,
          success: true,
          total: numberFrom(response?.total, 0),
          items: Array.isArray(response?.items) ? response.items.map(mapCorePropertyToLegacy).filter(Boolean) : [],
          compareTable: Array.isArray(response?.compareTable) ? response.compareTable : [],
          highlights: toObject(response?.highlights),
        };
      }

      const propertyApproveMatch = rawPath.match(/^\/properties\/([^/]+)\/approve$/);
      if (propertyApproveMatch && method === 'POST') {
        const propertyId = propertyApproveMatch[1];
        const response = await requestJson(CORE_API_BASE, `/properties/${propertyId}/verify`, {
          method: 'POST',
          token: options.token,
          timeoutMs: options.timeoutMs,
          data: { verified: true },
        });
        const property = mapCorePropertyToLegacy(response?.item);
        return { ok: true, success: true, property, item: property };
      }

      const propertyFeatureMatch = rawPath.match(/^\/properties\/([^/]+)\/feature$/);
      if (propertyFeatureMatch && method === 'POST') {
        const propertyId = propertyFeatureMatch[1];
        const response = await requestJson(CORE_API_BASE, `/properties/${propertyId}/feature`, {
          method: 'POST',
          token: options.token,
          timeoutMs: options.timeoutMs,
          data: { featured: true },
        });
        const property = mapCorePropertyToLegacy(response?.item);
        return { ok: true, success: true, property, item: property };
      }

      const propertyVisitMatch = rawPath.match(/^\/properties\/([^/]+)\/visit$/);
      if (propertyVisitMatch && method === 'POST') {
        const propertyId = propertyVisitMatch[1];
        const payload = options.data || {};
        const preferredAt = text(payload.preferredAt || payload.visitAt);
        const visitDate = text(payload.visitDate);
        const visitTime = text(payload.visitTime);
        const response = await requestJson(CORE_API_BASE, `/properties/${propertyId}/visit`, {
          method: 'POST',
          token: options.token,
          timeoutMs: options.timeoutMs,
          data: {
            ...(preferredAt ? { preferredAt } : {}),
            ...(!preferredAt && visitDate && visitTime ? { visitDate, visitTime } : {}),
            note: text(payload.note),
          },
        });
        const visit = mapCoreVisitToLegacy(response?.item || {});
        return {
          ok: true,
          success: true,
          visit,
          item: visit,
          ownerNotification: toObject(response?.ownerNotification),
        };
      }

      const propertyByIdMatch = rawPath.match(/^\/properties\/([^/]+)$/);
      if (propertyByIdMatch && method === 'GET') {
        const propertyId = propertyByIdMatch[1];
        const response = await requestJson(CORE_API_BASE, `/properties/${propertyId}`, {
          method: 'GET',
          token: options.token,
          timeoutMs: options.timeoutMs,
        });
        const item = mapCorePropertyToLegacy(response?.item);
        return { ok: true, success: true, property: item, item };
      }

      if (propertyByIdMatch && method === 'PATCH') {
        const propertyId = propertyByIdMatch[1];
        const updates = mapLegacyPatchToCore(options.data || {});
        if (!Object.keys(updates).length) {
          return { ok: true, success: true, message: 'No property fields to update.' };
        }
        const response = await requestJson(CORE_API_BASE, `/properties/${propertyId}`, {
          method: 'PATCH',
          token: options.token,
          timeoutMs: options.timeoutMs,
          data: updates,
        });
        const property = mapCorePropertyToLegacy(response?.item);
        return { ok: true, success: true, property, item: property };
      }

      if (propertyByIdMatch && method === 'DELETE') {
        const propertyId = propertyByIdMatch[1];
        return requestJson(CORE_API_BASE, `/properties/${propertyId}`, {
          method: 'DELETE',
          token: options.token,
          timeoutMs: options.timeoutMs,
        });
      }

      if (rawPath.startsWith('/properties/')) {
        return null;
      }

      if (rawPath === '/visits/mine' && method === 'GET') {
        const limit = text(query.get('limit'));
        const response = await requestJson(
          CORE_API_BASE,
          `/visits/mine${limit ? `?limit=${encodeURIComponent(limit)}` : ''}`,
          {
            method: 'GET',
            token: options.token,
            timeoutMs: options.timeoutMs,
          }
        );
        const items = (response?.items || []).map(mapCoreVisitToLegacy);
        return {
          ok: true,
          success: true,
          total: numberFrom(response?.total, items.length),
          items,
        };
      }

      if (rawPath === '/visits/owner' && method === 'GET') {
        const limit = text(query.get('limit'));
        const response = await requestJson(
          CORE_API_BASE,
          `/visits/owner${limit ? `?limit=${encodeURIComponent(limit)}` : ''}`,
          {
            method: 'GET',
            token: options.token,
            timeoutMs: options.timeoutMs,
          }
        );
        const items = (response?.items || []).map(mapCoreVisitToLegacy);
        return {
          ok: true,
          success: true,
          total: numberFrom(response?.total, items.length),
          items,
        };
      }

      if (rawPath === '/visits' && method === 'GET') {
        const limit = text(query.get('limit'));
        const response = await requestJson(
          CORE_API_BASE,
          `/visits${limit ? `?limit=${encodeURIComponent(limit)}` : ''}`,
          {
            method: 'GET',
            token: options.token,
            timeoutMs: options.timeoutMs,
          }
        );
        const items = (response?.items || []).map(mapCoreVisitToLegacy);
        return {
          ok: true,
          success: true,
          total: numberFrom(response?.total, items.length),
          items,
        };
      }

      const visitStatusMatch = rawPath.match(/^\/visits\/([^/]+)\/status$/);
      if (visitStatusMatch && method === 'POST') {
        const visitId = visitStatusMatch[1];
        const payload = options.data || {};
        const response = await requestJson(CORE_API_BASE, `/visits/${visitId}/status`, {
          method: 'POST',
          token: options.token,
          timeoutMs: options.timeoutMs,
          data: { status: text(payload.status).toLowerCase() },
        });
        const item = mapCoreVisitToLegacy(response?.item || {});
        return {
          ok: true,
          success: true,
          item,
          visit: item,
          customerNotification: toObject(response?.customerNotification),
        };
      }

      if (rawPath === '/chat/mine' && method === 'GET') {
        return requestJson(CORE_API_BASE, '/chat/mine', {
          method: 'GET',
          token: options.token,
          timeoutMs: options.timeoutMs,
        });
      }

      if (rawPath === '/chat/send' && method === 'POST') {
        const payload = options.data || {};
        return requestJson(CORE_API_BASE, '/chat/send', {
          method: 'POST',
          token: options.token,
          timeoutMs: options.timeoutMs,
          data: {
            propertyId: text(payload.propertyId),
            receiverId: text(payload.receiverId),
            message: text(payload.message),
            whatsappHandoff: Boolean(payload.whatsappHandoff),
          },
        });
      }

      const chatWhatsappMatch = rawPath.match(/^\/chat\/([^/]+)\/whatsapp-link$/);
      if (chatWhatsappMatch && method === 'GET') {
        const propertyId = chatWhatsappMatch[1];
        const receiverId = text(query.get('receiverId'));
        const message = text(query.get('message'));
        const querySuffix = new URLSearchParams({
          ...(receiverId ? { receiverId } : {}),
          ...(message ? { message } : {}),
        }).toString();
        return requestJson(
          CORE_API_BASE,
          `/chat/${propertyId}/whatsapp-link${querySuffix ? `?${querySuffix}` : ''}`,
          {
            method: 'GET',
            token: options.token,
            timeoutMs: options.timeoutMs,
          }
        );
      }

      const chatByPropertyMatch = rawPath.match(/^\/chat\/([^/]+)$/);
      if (chatByPropertyMatch && method === 'GET') {
        const propertyId = chatByPropertyMatch[1];
        const limit = text(query.get('limit'));
        return requestJson(
          CORE_API_BASE,
          `/chat/${propertyId}${limit ? `?limit=${encodeURIComponent(limit)}` : ''}`,
          {
            method: 'GET',
            token: options.token,
            timeoutMs: options.timeoutMs,
          }
        );
      }

      if (rawPath === '/sealed-bids' && method === 'POST') {
        const payload = options.data || {};
        return requestJson(CORE_API_BASE, '/sealed-bids', {
          method: 'POST',
          token: options.token,
          timeoutMs: options.timeoutMs,
          data: {
            propertyId: text(payload.propertyId),
            amount: Math.max(0, numberFrom(payload.amount, 0)),
          },
        });
      }

      if (rawPath === '/sealed-bids/mine' && method === 'GET') {
        const limit = text(query.get('limit'));
        return requestJson(
          CORE_API_BASE,
          `/sealed-bids/mine${limit ? `?limit=${encodeURIComponent(limit)}` : ''}`,
          {
            method: 'GET',
            token: options.token,
            timeoutMs: options.timeoutMs,
          }
        );
      }

      if (rawPath === '/sealed-bids/summary' && method === 'GET') {
        const params = new URLSearchParams();
        const propertyId = text(query.get('propertyId'));
        const limit = text(query.get('limit'));
        if (propertyId) params.set('propertyId', propertyId);
        if (limit) params.set('limit', limit);
        return requestJson(
          CORE_API_BASE,
          `/sealed-bids/summary${params.toString() ? `?${params.toString()}` : ''}`,
          {
            method: 'GET',
            token: options.token,
            timeoutMs: options.timeoutMs,
          }
        );
      }

      if (rawPath === '/sealed-bids/admin' && method === 'GET') {
        const params = new URLSearchParams();
        const propertyId = text(query.get('propertyId'));
        const limit = text(query.get('limit'));
        if (propertyId) params.set('propertyId', propertyId);
        if (limit) params.set('limit', limit);
        return requestJson(
          CORE_API_BASE,
          `/sealed-bids/admin${params.toString() ? `?${params.toString()}` : ''}`,
          {
            method: 'GET',
            token: options.token,
            timeoutMs: options.timeoutMs,
          }
        );
      }

      if (rawPath === '/sealed-bids/decision' && method === 'POST') {
        const payload = options.data || {};
        return requestJson(CORE_API_BASE, '/sealed-bids/decision', {
          method: 'POST',
          token: options.token,
          timeoutMs: options.timeoutMs,
          data: {
            propertyId: text(payload.propertyId),
            action: text(payload.action).toLowerCase(),
          },
        });
      }

      const sealedBidWinnerMatch = rawPath.match(/^\/sealed-bids\/winner\/([^/]+)$/);
      if (sealedBidWinnerMatch && method === 'GET') {
        const propertyId = sealedBidWinnerMatch[1];
        return requestJson(CORE_API_BASE, `/sealed-bids/winner/${propertyId}`, {
          method: 'GET',
          token: options.token,
          timeoutMs: options.timeoutMs,
        });
      }

      const reviewByPropertyMatch = rawPath.match(/^\/reviews\/([^/]+)$/);
      if (reviewByPropertyMatch && method === 'GET') {
        const propertyId = reviewByPropertyMatch[1];
        const response = await requestJson(CORE_API_BASE, `/reviews/${propertyId}`, {
          method: 'GET',
          token: options.token,
          timeoutMs: options.timeoutMs,
        });
        const items = (response?.items || []).map(mapCoreReviewToLegacy);
        const average = numberFrom(response?.summary?.average, numberFrom(response?.average, 0));
        const matrix = {
          propertyAccuracy: average,
          ownerBehavior: average,
          agentService: average,
        };
        return {
          ok: true,
          success: true,
          total: numberFrom(response?.total, items.length),
          average,
          matrix,
          items,
        };
      }

      if (rawPath === '/reviews' && method === 'POST') {
        const payload = options.data || {};
        const response = await requestJson(CORE_API_BASE, '/reviews', {
          method: 'POST',
          token: options.token,
          timeoutMs: options.timeoutMs,
          data: {
            propertyId: text(payload.propertyId),
            rating: numberFrom(payload.rating, 0),
            comment: text(payload.comment, 'No comment'),
          },
        });
        return {
          ok: true,
          success: true,
          review: mapCoreReviewToLegacy(response?.item),
          item: mapCoreReviewToLegacy(response?.item),
        };
      }

      return null;
    } catch (error) {
      if (shouldFallbackToLocal(error)) return null;
      throw error;
    }
  };

  const request = async (path, options = {}) => {
    const coreResponse = await tryCoreFlow(path, options);
    if (coreResponse !== null) return coreResponse;
    return requestJson(API_BASE, path, options);
  };

  const normalizeApiListing = (entry) => {
    const mapped = mapCorePropertyToLegacy(entry);
    if (!mapped) return null;
    if (!mapped.city.toLowerCase().includes('udaipur')) return null;
    return mapped;
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

  const properties = {
    taxonomy: async () => request('/properties/taxonomy'),
  };

  const visits = {
    mine: async (query = {}) => {
      const params = new URLSearchParams();
      Object.entries(query || {}).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        params.set(key, String(value));
      });
      return request(`/visits/mine${params.toString() ? `?${params.toString()}` : ''}`);
    },
    owner: async (query = {}) => {
      const params = new URLSearchParams();
      Object.entries(query || {}).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        params.set(key, String(value));
      });
      return request(`/visits/owner${params.toString() ? `?${params.toString()}` : ''}`);
    },
    all: async (query = {}) => {
      const params = new URLSearchParams();
      Object.entries(query || {}).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        params.set(key, String(value));
      });
      return request(`/visits${params.toString() ? `?${params.toString()}` : ''}`);
    },
    updateStatus: async (visitId, status) => request(`/visits/${encodeURIComponent(text(visitId))}/status`, {
      method: 'POST',
      data: { status: text(status).toLowerCase() },
    }),
  };

  const ai = {
    pricingSuggestion: async (payload = {}) => request('/ai/pricing-suggestion', { method: 'POST', data: payload }),
    descriptionGenerate: async (payload = {}) => request('/ai/description-generate', { method: 'POST', data: payload }),
    fraudScan: async (payload = {}) => request('/ai/fraud-scan', { method: 'POST', data: payload }),
    marketTrend: async (locality = 'Udaipur') => request(`/ai/market-trend?locality=${encodeURIComponent(locality)}`),
    emiCalculator: async (payload = {}) => {
      const params = new URLSearchParams();
      Object.entries(payload || {}).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        params.set(key, String(value));
      });
      return request(`/ai/emi-calculator${params.toString() ? `?${params.toString()}` : ''}`);
    },
    recommendations: async (query = {}) => {
      const params = new URLSearchParams();
      Object.entries(query || {}).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        params.set(key, String(value));
      });
      return request(`/ai/recommendations?${params.toString()}`);
    },
  };

  const sealedBids = {
    placeBid: async (payload = {}) => request('/sealed-bids', { method: 'POST', data: payload }),
    mine: async (query = {}) => {
      const params = new URLSearchParams();
      Object.entries(query || {}).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        params.set(key, String(value));
      });
      return request(`/sealed-bids/mine${params.toString() ? `?${params.toString()}` : ''}`);
    },
    summary: async (query = {}) => {
      const params = new URLSearchParams();
      Object.entries(query || {}).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        params.set(key, String(value));
      });
      return request(`/sealed-bids/summary${params.toString() ? `?${params.toString()}` : ''}`);
    },
    admin: async (query = {}) => {
      const params = new URLSearchParams();
      Object.entries(query || {}).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') return;
        params.set(key, String(value));
      });
      return request(`/sealed-bids/admin${params.toString() ? `?${params.toString()}` : ''}`);
    },
    decision: async (payload = {}) => request('/sealed-bids/decision', { method: 'POST', data: payload }),
    winner: async (propertyId) => request(`/sealed-bids/winner/${encodeURIComponent(text(propertyId))}`),
  };

  const documentation = {
    services: async () => request('/documentation/services'),
    createRequest: async (payload = {}) => request('/documentation/requests', { method: 'POST', data: payload }),
    myRequests: async () => request('/documentation/requests'),
  };

  const loan = {
    banks: async () => request('/loan/banks'),
    createAssistance: async (payload = {}) => request('/loan/assistance', { method: 'POST', data: payload }),
    myAssistance: async () => request('/loan/assistance'),
  };

  const ecosystem = {
    services: async () => request('/ecosystem/services'),
    createBooking: async (payload = {}) => request('/ecosystem/bookings', { method: 'POST', data: payload }),
    myBookings: async () => request('/ecosystem/bookings'),
  };

  const valuation = {
    estimate: async (payload = {}) => request('/valuation/estimate', { method: 'POST', data: payload }),
    requests: async () => request('/valuation/requests'),
  };

  const rentAgreement = {
    generate: async (payload = {}) => request('/rent-agreement/generate', { method: 'POST', data: payload }),
    drafts: async () => request('/rent-agreement/drafts'),
  };

  const franchise = {
    regions: async () => request('/franchise/regions'),
    createRequest: async (payload = {}) => request('/franchise/requests', { method: 'POST', data: payload }),
    myRequests: async () => request('/franchise/requests'),
  };

  window.PropertySetuLive = {
    API_BASE,
    PRO_API_BASE,
    CORE_API_BASE,
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
    allowDemoFallback,
    strictRealMode,
    normalizeApiListing,
    mergeById,
    syncLocalListingsFromApi,
    properties,
    visits,
    ai,
    sealedBids,
    documentation,
    loan,
    ecosystem,
    valuation,
    rentAgreement,
    franchise,
    payments: {
      createOrder: async (payload = {}) => request('/payments/order', { method: 'POST', data: payload }),
      verify: async (payload = {}) => request('/payments/verify', { method: 'POST', data: payload }),
    },
  };
})();
