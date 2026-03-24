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
    'featured-7': { name: 'Featured Listing - 7 Days', amount: 299, cycleDays: 7, type: 'featured' },
    'featured-30': { name: 'Featured Listing - 30 Days', amount: 999, cycleDays: 30, type: 'featured' },
    'verified-badge-charge': { name: 'Verified Badge Charge', amount: 799, cycleDays: 30, type: 'verification' },
    'care-basic': { name: 'Property Care Basic Visit', amount: 2500, cycleDays: 30, type: 'care' },
    'care-plus': { name: 'Property Care Cleaning + Visit', amount: 5500, cycleDays: 30, type: 'care' },
    'care-full': { name: 'Property Care Full Maintenance', amount: 10000, cycleDays: 30, type: 'care' },
    'agent-pro': { name: 'Trusted Agent Membership', amount: 1999, cycleDays: 30, type: 'agent' },
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
    return 'buy';
  };

  const coreCategoryFromLegacy = (value) => {
    const raw = text(value).toLowerCase();
    if (raw.includes('plot')) return 'plot';
    if (raw.includes('commercial') || raw.includes('office') || raw.includes('shop')) return 'commercial';
    return 'house';
  };

  const legacyCategoryFromCore = (value) => {
    const raw = text(value).toLowerCase();
    if (raw === 'plot') return 'Plot';
    if (raw === 'commercial') return 'Commercial';
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
      virtualTour: toObject(entry.virtualTour),
      visitBooking: toObject(entry.visitBooking),
      videoVisit: toObject(entry.videoVisit),
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
          try {
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
          } catch (error) {
            if (Number(error?.status) === 404) {
              return { ok: true, otpHint: '123456', message: 'Demo OTP sent successfully.' };
            }
            throw error;
          }
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
          // If admin secret is not provided, let legacy/local fallback keep old UX intact.
          if (body.role === 'admin' && !body.adminSecret) return null;

          let response;
          try {
            response = await requestJson(CORE_API_BASE, '/auth/register', {
              method: 'POST',
              data: body,
              token: options.token,
              timeoutMs: options.timeoutMs,
            });
          } catch (error) {
            if (Number(error?.status) === 403) return null;
            throw error;
          }
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
          try {
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
          } catch (error) {
            if (Number(error?.status) === 401) return null;
            throw error;
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
    normalizeApiListing,
    mergeById,
    syncLocalListingsFromApi,
    ai,
    payments: {
      createOrder: async (payload = {}) => request('/payments/order', { method: 'POST', data: payload }),
      verify: async (payload = {}) => request('/payments/verify', { method: 'POST', data: payload }),
    },
  };
})();
