import { Router } from "express";
import jwt from "jsonwebtoken";
import {
  createProPropertyRecord,
  deleteProPropertyRecord,
  findProPropertyRecordById,
  listProPropertyRecords,
  updateProPropertyRecord
} from "../controllers/proPropertyController.js";
import {
  createProRateLimiter,
  getProSecurityAuditEvents,
  getProSecurityControlState,
  getProSecurityThreatIntelligence,
  isValidProSecurityThreatFingerprint,
  normalizeProSecurityThreatFingerprint,
  quarantineProSecurityThreatProfile,
  releaseProSecurityThreatProfile,
  resetProSecurityControlState,
  updateProSecurityControlState
} from "../middleware/proSecurityMiddleware.js";
import { proMemoryStore } from "../runtime/proMemoryStore.js";

const router = Router();
const bridgeAllowedBidderRoles = new Set(["buyer", "seller", "customer"]);
const bridgeDecisionReasonMin = Math.max(8, Math.round(Number(process.env.SEALED_BID_DECISION_REASON_MIN || 12)));
const bridgeTrustedRoles = new Set(["buyer", "seller", "customer", "admin"]);
const bridgeWriteLimiter = createProRateLimiter({
  scope: "legacy-bridge-write",
  limit: Math.max(20, Math.round(Number(process.env.BRIDGE_WRITE_RATE_LIMIT || 120))),
  windowMs: 10 * 60 * 1000,
  keyBuilder: (req) => `${text(req.bridgeActor?.id, "anon")}:${text(req.path)}`,
  message: "Too many write operations on bridge API. Please retry later."
});
const bridgeAdminActionLimiter = createProRateLimiter({
  scope: "legacy-bridge-admin",
  limit: Math.max(10, Math.round(Number(process.env.BRIDGE_ADMIN_RATE_LIMIT || 60))),
  windowMs: 10 * 60 * 1000,
  keyBuilder: (req) => `${text(req.bridgeActor?.id, "admin")}:${text(req.path)}`,
  message: "Too many admin actions in short duration. Please retry later."
});

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1200&q=80";

const LEGACY_SUBSCRIPTION_PLANS = [
  {
    id: "featured-30",
    name: "Featured Listing 30 Days",
    amount: 1999,
    cycleDays: 30,
    type: "featured",
    highlights: ["Boost visibility", "Priority listing rank", "Seller profile highlight"]
  },
  {
    id: "verified-badge-365",
    name: "Verified Badge 1 Year",
    amount: 1499,
    cycleDays: 365,
    type: "verification",
    highlights: ["Verified badge", "Trust score boost", "Priority support"]
  }
];

function nowIso() {
  return new Date().toISOString();
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function text(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function isBridgeProduction() {
  return text(process.env.NODE_ENV, "development").toLowerCase() === "production";
}

function bridgeJwtIssuers() {
  return [
    text(process.env.JWT_ISSUER || "propertysetu-api"),
    text(process.env.CORE_JWT_ISSUER || "propertysetu-core-api")
  ].filter(Boolean);
}

function bridgeJwtAudiences() {
  return [
    text(process.env.JWT_AUDIENCE || "propertysetu-clients"),
    text(process.env.CORE_JWT_AUDIENCE || "propertysetu-core-clients")
  ].filter(Boolean);
}

function bridgeJwtSecrets() {
  const configured = [process.env.CORE_JWT_SECRET, process.env.JWT_SECRET]
    .map((item) => text(item))
    .filter(Boolean);
  if (configured.length) return configured;
  if (isBridgeProduction()) return [];
  return ["propertysetu-core-secret", "propertysetu-dev-secret"];
}

function mapProStatusToLegacy(status) {
  const raw = String(status || "").toLowerCase();
  if (raw === "published") return "Approved";
  if (raw === "sold") return "Sold";
  if (raw === "rented") return "Rented";
  if (raw === "draft") return "Pending Approval";
  return "Pending Approval";
}

function mapLegacyStatusToPro(status) {
  const raw = String(status || "").toLowerCase();
  if (raw === "approved") return "published";
  if (raw === "pending approval") return "draft";
  if (raw === "sold") return "sold";
  if (raw === "rented") return "rented";
  return "published";
}

function toLegacyProperty(row = {}) {
  const id = row.id || row._id;
  const imageUrls = Array.isArray(row.imageUrls) ? row.imageUrls : [];

  return {
    id: text(id),
    title: text(row.title, "Untitled Property"),
    city: text(row.city, "Udaipur"),
    location: text(row.location || row.locality || row.city, "Udaipur"),
    locality: text(row.location || row.locality || row.city, "Udaipur"),
    category: text(row.category || row.propertyType, "Apartment"),
    propertyType: text(row.propertyType || row.category, "Apartment"),
    type: text(row.type, "Sell"),
    saleRentMode: text(row.type, "Sell"),
    price: toNumber(row.price, 0),
    builtUpArea: toNumber(row.areaSqft || row.builtUpArea, 0),
    plotSize: toNumber(row.areaSqft || row.plotSize, 0),
    areaSqft: toNumber(row.areaSqft || row.builtUpArea || row.plotSize, 0),
    bedrooms: toNumber(row.bedrooms, 0),
    bathrooms: toNumber(row.bathrooms, 0),
    status: mapProStatusToLegacy(row.status),
    verified: Boolean(row.verified),
    verifiedByPropertySetu: Boolean(row.verified),
    featured: Boolean(row.featured),
    trustScore: toNumber(row.trustScore, 0),
    ownerId: text(row.ownerId),
    ownerName: text(row.ownerName),
    description: text(row.description),
    image: text(imageUrls[0] || row.image, DEFAULT_IMAGE),
    media: {
      ...(row.media && typeof row.media === "object" ? row.media : {}),
      photosCount: toNumber(row?.media?.photosCount, imageUrls.length),
      imageUrls
    },
    aiReview:
      row.aiReview && typeof row.aiReview === "object"
        ? row.aiReview
        : {
            fraudRiskScore: 42,
            duplicatePhotoDetected: false,
            suspiciousPricingAlert: false,
            fakeListingSignal: false,
            reasons: []
          },
    createdAt: row.createdAt || nowIso(),
    updatedAt: row.updatedAt || row.createdAt || nowIso()
  };
}

async function fetchLegacyProperties(filters = {}, page = 1, limit = 50) {
  const result = await listProPropertyRecords({
    filters,
    page,
    limit
  });

  return {
    ...result,
    items: result.rows.map(toLegacyProperty)
  };
}

function extractActor(req) {
  const authHeader = String(req.headers.authorization || "").trim();
  if (!authHeader.startsWith("Bearer ")) {
    return {
      id: "guest-user",
      name: "Guest User",
      role: "guest",
      trusted: false
    };
  }

  const token = authHeader.slice(7).trim();
  for (const secret of bridgeJwtSecrets()) {
    try {
      const parsed = jwt.verify(token, secret, {
        algorithms: ["HS256"],
        issuer: bridgeJwtIssuers(),
        audience: bridgeJwtAudiences()
      });
      const role = text(parsed.role || "buyer").toLowerCase();
      return {
        id: text(parsed.userId || parsed.id || `user-${Date.now()}`),
        name: text(parsed.name || parsed.email || "PropertySetu User"),
        role,
        trusted: bridgeTrustedRoles.has(role)
      };
    } catch {
      // try next secret
    }
  }

  return {
    id: "guest-user",
    name: "Guest User",
    role: "guest",
    trusted: false
  };
}

function attachBridgeActor(req, _res, next) {
  req.bridgeActor = extractActor(req);
  next();
}

function requireBridgeTrustedActor(req, res, next) {
  const actor = req.bridgeActor || extractActor(req);
  if (!actor.trusted) {
    return res.status(401).json({
      ok: false,
      message: "Authentication required."
    });
  }
  req.bridgeActor = actor;
  return next();
}

function requireBridgeRole(...roles) {
  const allowed = new Set(roles.map((item) => text(item).toLowerCase()).filter(Boolean));
  return (req, res, next) => {
    const actor = req.bridgeActor || extractActor(req);
    const role = text(actor.role).toLowerCase();
    if (!actor.trusted || !allowed.has(role)) {
      return res.status(403).json({
        ok: false,
        message: "You do not have permission for this action."
      });
    }
    req.bridgeActor = actor;
    return next();
  };
}

async function requireBridgePropertyOwnerOrAdmin(req, res, next) {
  const actor = req.bridgeActor || extractActor(req);
  if (!actor.trusted) {
    return res.status(401).json({
      ok: false,
      message: "Authentication required."
    });
  }
  if (text(actor.role).toLowerCase() === "admin") {
    req.bridgeActor = actor;
    return next();
  }

  const propertyId = text(req.params.propertyId);
  const row = propertyId ? await findProPropertyRecordById(propertyId) : null;
  if (!row) {
    return res.status(404).json({
      ok: false,
      message: "Property not found."
    });
  }

  if (text(row.ownerId) !== text(actor.id)) {
    return res.status(403).json({
      ok: false,
      message: "Only owner or admin can update this property."
    });
  }

  req.bridgeActor = actor;
  return next();
}

async function computePricingStats(locality = "Udaipur") {
  const response = await fetchLegacyProperties({}, 1, 500);
  const key = text(locality, "Udaipur").toLowerCase();
  const filtered = response.items.filter((item) =>
    `${item.location} ${item.locality}`.toLowerCase().includes(key)
  );
  const scope = filtered.length ? filtered : response.items;
  const prices = scope
    .map((item) => toNumber(item.price, 0))
    .filter((price) => price > 0)
    .sort((a, b) => a - b);

  const avgPrice = prices.length
    ? Math.round(prices.reduce((sum, value) => sum + value, 0) / prices.length)
    : 6000000;
  const medianPrice = prices.length ? prices[Math.floor(prices.length / 2)] : avgPrice;
  const recommendedPrice = Math.round((avgPrice + medianPrice) / 2);

  return {
    locality: text(locality, "Udaipur"),
    totalListings: scope.length,
    avgPrice,
    medianPrice,
    recommendedPrice
  };
}

function buildMarketTrend(basePrice = 6000000) {
  return [5, 4, 3, 2, 1, 0].map((offset) => {
    const date = new Date();
    date.setMonth(date.getMonth() - offset);
    return {
      monthOffset: offset,
      monthLabel: date.toLocaleString("en-IN", { month: "short" }),
      monthKey: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      avgRate: Math.max(1500000, Math.round(basePrice * (1 + (offset - 2) * 0.018)))
    };
  });
}

router.use(attachBridgeActor);

router.get("/health", async (_req, res, next) => {
  try {
    const propertyStats = await listProPropertyRecords({ page: 1, limit: 1 });
    const counts = {
      users: 0,
      properties: propertyStats.total,
      reviews: 0,
      messages: 0,
      subscriptions: proMemoryStore.subscriptions.length,
      bids: proMemoryStore.sealedBids.length
    };

    res.json({
      ok: true,
      uptimeSeconds: Math.floor(process.uptime()),
      counts
    });
  } catch (error) {
    next(error);
  }
});

router.get("/system/live-roots", (_req, res) => {
  res.json({
    ok: true,
    frontendMode: "professional-bridge",
    frontendRoot: "client/dist",
    routes: [
      { path: "/", file: "client/dist/index.html", live: true },
      { path: "/properties", file: "client/dist/index.html", live: true },
      { path: "/add-property", file: "client/dist/index.html", live: true },
      { path: "/api/*", file: "server/professional-server.js", live: true }
    ],
    generatedAt: nowIso()
  });
});

router.get("/system/capabilities", (_req, res) => {
  res.json({
    ok: true,
    recommendedStack: {
      frontend: "React / Next.js",
      backend: "Node.js + Express",
      database: "MongoDB",
      fileStorage: "Cloudinary / AWS S3",
      hosting: "Vercel + Render",
      payment: "Razorpay"
    },
    capabilities: {
      auth: true,
      listings: true,
      mediaUpload: true,
      ownerVerification: true,
      subscriptions: true,
      payments: true,
      chat: true,
      aiPricing: true,
      aiDescription: true,
      aiFraudScan: true,
      marketplaceRecommendations: true,
      sealedBids: true,
      reports: true,
      citySeoStructure: true,
      propertyCare: true
    },
    modules: {
      auth: "/api/v3/auth/*",
      listings: "/api/v3/properties/*",
      mediaUpload: "/api/v3/uploads/*",
      ownerVerification: "/api/v3/owner-verification/*",
      subscriptions: "/api/v3/subscriptions/*",
      payments: "/api/v2/payments/*",
      chat: "/api/v3/chat/*",
      ai: "/api/v3/ai/*",
      citySeoStructure: "/api/v3/seo/city-structure",
      propertyCare: "/api/v3/property-care/*",
      system: "/api/v3/system/*",
      securityAudit: "/api/system/security-audit",
      securityIntelligence: "/api/system/security-intelligence",
      securityIntelligenceManage: [
        "/api/system/security-intelligence/release",
        "/api/system/security-intelligence/quarantine"
      ],
      securityControl: "/api/system/security-control",
      securityControlManage: [
        "/api/system/security-control",
        "/api/system/security-control/reset"
      ],
      securityAuditV3: "/api/v3/system/security-audit",
      securityIntelligenceV3: "/api/v3/system/security-intelligence",
      securityIntelligenceManageV3: [
        "/api/v3/system/security-intelligence/release",
        "/api/v3/system/security-intelligence/quarantine"
      ],
      securityControlV3: "/api/v3/system/security-control",
      securityControlManageV3: [
        "/api/v3/system/security-control",
        "/api/v3/system/security-control/reset"
      ]
    }
  });
});

router.get(
  "/system/security-audit",
  requireBridgeTrustedActor,
  requireBridgeRole("admin"),
  bridgeAdminActionLimiter,
  (req, res) => {
    const limit = Math.min(500, Math.max(1, toNumber(req.query.limit, 100)));
    const actor = req.bridgeActor;
    const items = getProSecurityAuditEvents(limit);
    res.json({
      ok: true,
      requestedBy: {
        id: actor.id,
        role: actor.role
      },
      total: items.length,
      items
    });
  }
);

router.get(
  "/system/security-intelligence",
  requireBridgeTrustedActor,
  requireBridgeRole("admin"),
  bridgeAdminActionLimiter,
  (req, res) => {
    const limit = Math.min(500, Math.max(1, toNumber(req.query.limit, 100)));
    const actor = req.bridgeActor;
    const intelligence = getProSecurityThreatIntelligence(limit);
    res.json({
      ok: true,
      requestedBy: {
        id: actor.id,
        role: actor.role
      },
      ...intelligence
    });
  }
);

router.get(
  "/system/security-control",
  requireBridgeTrustedActor,
  requireBridgeRole("admin"),
  bridgeAdminActionLimiter,
  (req, res) => {
    const actor = req.bridgeActor;
    return res.json({
      ok: true,
      requestedBy: {
        id: actor.id,
        role: actor.role
      },
      state: getProSecurityControlState()
    });
  }
);

router.patch(
  "/system/security-control",
  requireBridgeTrustedActor,
  requireBridgeRole("admin"),
  bridgeAdminActionLimiter,
  (req, res) => {
    const actor = req.bridgeActor;
    const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? req.body
      : {};
    const patch = body.patch && typeof body.patch === "object" && !Array.isArray(body.patch)
      ? body.patch
      : body;
    const result = updateProSecurityControlState(patch, {
      actorId: actor.id,
      actorRole: actor.role
    });

    return res.json({
      ok: true,
      action: "updated",
      requestedBy: {
        id: actor.id,
        role: actor.role
      },
      warnings: Array.isArray(result.warnings) ? result.warnings : [],
      state: result.state
    });
  }
);

router.post(
  "/system/security-control/reset",
  requireBridgeTrustedActor,
  requireBridgeRole("admin"),
  bridgeAdminActionLimiter,
  (req, res) => {
    const actor = req.bridgeActor;
    const result = resetProSecurityControlState({
      actorId: actor.id,
      actorRole: actor.role
    });
    return res.json({
      ok: true,
      action: "reset",
      requestedBy: {
        id: actor.id,
        role: actor.role
      },
      warnings: Array.isArray(result.warnings) ? result.warnings : [],
      state: result.state
    });
  }
);

router.post(
  "/system/security-intelligence/release",
  requireBridgeTrustedActor,
  requireBridgeRole("admin"),
  bridgeAdminActionLimiter,
  (req, res) => {
    const actor = req.bridgeActor;
    const fingerprint = normalizeProSecurityThreatFingerprint(req.body?.fingerprint);
    if (!fingerprint) {
      return res.status(400).json({
        ok: false,
        message: "fingerprint is required."
      });
    }
    if (!isValidProSecurityThreatFingerprint(fingerprint)) {
      return res.status(400).json({
        ok: false,
        message: "Invalid fingerprint format."
      });
    }

    const profile = releaseProSecurityThreatProfile(fingerprint);
    if (!profile) {
      return res.status(404).json({
        ok: false,
        message: "Threat profile not found for fingerprint."
      });
    }

    return res.json({
      ok: true,
      action: "released",
      requestedBy: {
        id: actor.id,
        role: actor.role
      },
      profile
    });
  }
);

router.post(
  "/system/security-intelligence/quarantine",
  requireBridgeTrustedActor,
  requireBridgeRole("admin"),
  bridgeAdminActionLimiter,
  (req, res) => {
    const actor = req.bridgeActor;
    const fingerprint = normalizeProSecurityThreatFingerprint(req.body?.fingerprint);
    const durationMs = Math.max(60_000, Math.min(toNumber(req.body?.durationMs, 30 * 60 * 1000), 24 * 60 * 60 * 1000));
    const reason = text(req.body?.reason || "manual-admin-quarantine").slice(0, 200);

    if (!fingerprint) {
      return res.status(400).json({
        ok: false,
        message: "fingerprint is required."
      });
    }
    if (!isValidProSecurityThreatFingerprint(fingerprint)) {
      return res.status(400).json({
        ok: false,
        message: "Invalid fingerprint format."
      });
    }

    const profile = quarantineProSecurityThreatProfile(fingerprint, {
      durationMs,
      reason: reason || "manual-admin-quarantine"
    });

    if (!profile) {
      return res.status(400).json({
        ok: false,
        message: "Unable to quarantine threat profile."
      });
    }

    return res.json({
      ok: true,
      action: "quarantined",
      requestedBy: {
        id: actor.id,
        role: actor.role
      },
      profile
    });
  }
);

router.get("/properties", async (req, res, next) => {
  try {
    const page = Math.max(1, toNumber(req.query.page, 1));
    const limit = Math.min(100, Math.max(1, toNumber(req.query.limit, 20)));
    const filters = {};

    if (req.query.city) filters.city = req.query.city;
    if (req.query.propertyType) filters.propertyType = req.query.propertyType;
    if (req.query.status) filters.status = mapLegacyStatusToPro(req.query.status);

    const data = await fetchLegacyProperties(filters, page, limit);
    res.json({
      ok: true,
      page: data.page,
      limit: data.limit,
      total: data.total,
      count: data.items.length,
      items: data.items
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/properties",
  requireBridgeTrustedActor,
  requireBridgeRole("seller", "admin"),
  bridgeWriteLimiter,
  async (req, res, next) => {
  try {
    const actor = req.bridgeActor;
    const actorRole = text(actor?.role).toLowerCase();
    const resolvedOwnerId =
      actorRole === "admin" ? text(req.body?.ownerId || actor?.id) : text(actor?.id);
    const resolvedOwnerName =
      actorRole === "admin" ? text(req.body?.ownerName || actor?.name) : text(actor?.name);
    const payload = {
      ...req.body,
      status: mapLegacyStatusToPro(req.body?.status),
      location: req.body?.location || req.body?.locality || req.body?.city,
      ownerId: resolvedOwnerId,
      ownerName: resolvedOwnerName
    };
    const created = await createProPropertyRecord(payload);
    res.status(201).json({
      ok: true,
      property: toLegacyProperty(created.data)
    });
  } catch (error) {
    next(error);
  }
});

router.patch(
  "/properties/:propertyId",
  requireBridgeTrustedActor,
  requireBridgeRole("seller", "admin"),
  requireBridgePropertyOwnerOrAdmin,
  bridgeWriteLimiter,
  async (req, res, next) => {
  try {
    const updates = {
      ...req.body
    };

    if (typeof updates.status !== "undefined") {
      updates.status = mapLegacyStatusToPro(updates.status);
    }
    if (typeof updates.builtUpArea !== "undefined" && typeof updates.areaSqft === "undefined") {
      updates.areaSqft = updates.builtUpArea;
    }
    if (typeof updates.plotSize !== "undefined" && typeof updates.areaSqft === "undefined") {
      updates.areaSqft = updates.plotSize;
    }

    const updated = await updateProPropertyRecord(req.params.propertyId, updates);
    if (!updated) {
      return res.status(404).json({
        ok: false,
        message: "Property not found."
      });
    }

    return res.json({
      ok: true,
      property: toLegacyProperty(updated)
    });
  } catch (error) {
    return next(error);
  }
});

router.delete(
  "/properties/:propertyId",
  requireBridgeTrustedActor,
  requireBridgeRole("seller", "admin"),
  requireBridgePropertyOwnerOrAdmin,
  bridgeWriteLimiter,
  async (req, res, next) => {
  try {
    const deleted = await deleteProPropertyRecord(req.params.propertyId);
    if (!deleted) {
      return res.status(404).json({
        ok: false,
        message: "Property not found."
      });
    }

    return res.json({
      ok: true,
      message: "Property deleted."
    });
  } catch (error) {
    return next(error);
  }
});

router.post(
  "/properties/:propertyId/approve",
  requireBridgeTrustedActor,
  requireBridgeRole("admin"),
  bridgeAdminActionLimiter,
  async (req, res, next) => {
  try {
    const updated = await updateProPropertyRecord(req.params.propertyId, {
      status: "published",
      verified: true,
      updatedAt: nowIso()
    });
    if (!updated) {
      return res.status(404).json({
        ok: false,
        message: "Property not found."
      });
    }

    return res.json({
      ok: true,
      property: toLegacyProperty(updated)
    });
  } catch (error) {
    return next(error);
  }
});

router.post(
  "/properties/:propertyId/feature",
  requireBridgeTrustedActor,
  requireBridgeRole("admin"),
  bridgeAdminActionLimiter,
  async (req, res, next) => {
  try {
    const updated = await updateProPropertyRecord(req.params.propertyId, {
      featured: true,
      updatedAt: nowIso()
    });
    if (!updated) {
      return res.status(404).json({
        ok: false,
        message: "Property not found."
      });
    }

    return res.json({
      ok: true,
      property: toLegacyProperty(updated)
    });
  } catch (error) {
    return next(error);
  }
});

router.post(
  "/properties/:propertyId/visit",
  requireBridgeTrustedActor,
  requireBridgeRole("buyer", "seller", "customer", "admin"),
  bridgeWriteLimiter,
  async (req, res, next) => {
  try {
    const actor = req.bridgeActor;
    const propertyId = text(req.params.propertyId);
    const property = await findProPropertyRecordById(propertyId);
    if (!property) {
      return res.status(404).json({
        ok: false,
        message: "Property not found."
      });
    }

    const visit = {
      id: `visit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      propertyId,
      userId: actor.id,
      userName: actor.name,
      preferredAt: req.body?.preferredAt || null,
      mode: req.body?.mode || "in-person",
      note: req.body?.note || "",
      createdAt: nowIso()
    };

    proMemoryStore.visits.unshift(visit);
    proMemoryStore.visits = proMemoryStore.visits.slice(0, 400);

    return res.status(201).json({
      ok: true,
      visit
    });
  } catch (error) {
    return next(error);
  }
});

router.get(
  "/admin/properties",
  requireBridgeTrustedActor,
  requireBridgeRole("admin"),
  async (req, res, next) => {
  try {
    const status = text(req.query.status, "Pending Approval");
    const data = await fetchLegacyProperties(
      {
        status: mapLegacyStatusToPro(status)
      },
      1,
      100
    );
    res.json({
      ok: true,
      total: data.total,
      items: data.items
    });
  } catch (error) {
    next(error);
  }
});

router.get(
  "/admin/overview",
  requireBridgeTrustedActor,
  requireBridgeRole("admin"),
  async (_req, res, next) => {
  try {
    const data = await fetchLegacyProperties({}, 1, 500);
    const approved = data.items.filter((item) => item.status === "Approved").length;
    const pending = data.items.filter((item) => item.status === "Pending Approval").length;

    res.json({
      ok: true,
      overview: {
        totalProperties: data.total,
        approvedProperties: approved,
        pendingProperties: pending,
        totalBids: proMemoryStore.sealedBids.length,
        subscriptions: proMemoryStore.subscriptions.length,
        reports: proMemoryStore.reports.length
      }
    });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/uploads/property-media",
  requireBridgeTrustedActor,
  requireBridgeRole("seller", "admin"),
  bridgeWriteLimiter,
  (req, res) => {
  const files = Array.isArray(req.body?.files) ? req.body.files : [];
  const actor = req.bridgeActor;
  const propertyId = req.body?.propertyId || "";

  const uploaded = files.map((file) => ({
    id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId: text(actor?.id),
    userName: text(actor?.name),
    propertyId: propertyId || file.propertyId || "",
    name: text(file.name, "upload.bin"),
    category: text(file.category, "misc"),
    type: text(file.type, "application/octet-stream"),
    sizeBytes: text(file.dataBase64).length,
    url: `https://cdn.propertysetu.local/uploads/${Date.now()}-${encodeURIComponent(
      text(file.name, "upload.bin")
    )}`,
    createdAt: nowIso()
  }));

  proMemoryStore.uploads.unshift(...uploaded);
  proMemoryStore.uploads = proMemoryStore.uploads.slice(0, 800);

  res.status(201).json({
    ok: true,
    items: uploaded
  });
});

router.get("/uploads/mine", requireBridgeTrustedActor, (req, res) => {
  const actor = req.bridgeActor;
  const actorRole = text(actor?.role).toLowerCase();
  const items =
    actorRole === "admin"
      ? proMemoryStore.uploads.slice(0, 80)
      : proMemoryStore.uploads
          .filter((item) => text(item.userId) === text(actor?.id))
          .slice(0, 80);
  res.json({
    ok: true,
    items
  });
});

router.post(
  "/owner-verification/request",
  requireBridgeTrustedActor,
  requireBridgeRole("seller", "admin"),
  bridgeWriteLimiter,
  (req, res) => {
  const actor = req.bridgeActor;
  const request = {
    id: `ov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    propertyId: text(req.body?.propertyId),
    ownerAadhaarPanStatus: text(req.body?.ownerAadhaarPanStatus, "Submitted"),
    addressVerificationStatus: text(req.body?.addressVerificationStatus, "Submitted"),
    ownerAadhaarPanRef: text(req.body?.ownerAadhaarPanRef),
    addressVerificationRef: text(req.body?.addressVerificationRef),
    privateDocsUploaded: Boolean(req.body?.privateDocsUploaded),
    note: text(req.body?.note),
    status: "Pending Review",
    userId: actor.id,
    userName: actor.name,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  proMemoryStore.ownerVerificationRequests.unshift(request);
  proMemoryStore.ownerVerificationRequests =
    proMemoryStore.ownerVerificationRequests.slice(0, 300);

  res.status(201).json({
    ok: true,
    request
  });
});

router.get("/owner-verification/me", requireBridgeTrustedActor, (req, res) => {
  const actor = req.bridgeActor;
  const actorRole = text(actor?.role).toLowerCase();
  const items = proMemoryStore.ownerVerificationRequests
    .filter((item) =>
      actorRole === "admin" ? true : text(item.userId) === text(actor.id)
    )
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  res.json({
    ok: true,
    items
  });
});

router.post("/ai/pricing-suggestion", async (req, res, next) => {
  try {
    const locality = text(req.body?.locality, "Udaipur");
    const stats = await computePricingStats(locality);

    res.json({
      ok: true,
      locality: stats.locality,
      avgPrice: stats.avgPrice,
      medianPrice: stats.medianPrice,
      recommendedPrice: stats.recommendedPrice,
      confidence: 0.84,
      source: "professional-bridge-ai",
      stats
    });
  } catch (error) {
    next(error);
  }
});

router.post("/ai/description-generate", (req, res) => {
  const title = text(req.body?.title, "Property Listing");
  const location = text(req.body?.location || req.body?.locality, "Udaipur");
  const category = text(req.body?.category, "Property");
  const type = text(req.body?.type, "Sell");
  const price = toNumber(req.body?.price, 0);

  const description = [
    `${title} in ${location}, Udaipur.`,
    `${category} available for ${type} at INR ${price.toLocaleString("en-IN")}.`,
    "Verified document workflow and professional media support available.",
    "Book visit or request live video tour from PropertySetu dashboard."
  ].join(" ");

  res.json({
    ok: true,
    description
  });
});

router.post("/ai/fraud-scan", (req, res) => {
  const price = toNumber(req.body?.price, 0);
  const expectedAveragePrice = toNumber(req.body?.expectedAveragePrice, 0);
  const duplicatePhotoCount = toNumber(req.body?.media?.duplicatePhotoMatches, 0);
  const blurryPhotoCount = toNumber(req.body?.media?.blurryPhotosDetected, 0);
  const suspiciousPricingAlert =
    expectedAveragePrice > 0 && price > 0 && price < expectedAveragePrice * 0.35;
  const duplicatePhotoDetected = duplicatePhotoCount > 0;
  const fakeListingSignal =
    suspiciousPricingAlert || duplicatePhotoDetected || blurryPhotoCount >= 3;
  const fraudRiskScore = Math.min(
    100,
    (suspiciousPricingAlert ? 32 : 8) +
      (duplicatePhotoDetected ? 34 : 0) +
      (blurryPhotoCount >= 3 ? 22 : 4)
  );

  res.json({
    ok: true,
    scan: {
      fraudRiskScore,
      duplicatePhotoDetected,
      duplicatePhotoCount,
      suspiciousPricingAlert,
      fakeListingSignal,
      reasons: [
        ...(suspiciousPricingAlert ? ["Price appears significantly below local trend."] : []),
        ...(duplicatePhotoDetected ? ["Duplicate media patterns detected."] : []),
        ...(blurryPhotoCount >= 3 ? ["Multiple blurry photos detected."] : [])
      ],
      recommendation:
        fakeListingSignal || fraudRiskScore > 60
          ? "Manual admin verification required"
          : "Looks normal"
    }
  });
});

router.get("/insights/locality", async (req, res, next) => {
  try {
    const locality = text(req.query.name, "Udaipur");
    const stats = await computePricingStats(locality);
    res.json({
      ok: true,
      stats,
      trend: buildMarketTrend(stats.avgPrice)
    });
  } catch (error) {
    next(error);
  }
});

async function recommendationHandler(req, res, next) {
  try {
    const locality = text(req.query.locality, "");
    const category = text(req.query.category, "all").toLowerCase();
    const excludeId = text(req.query.excludeId, "");
    const limit = Math.min(20, Math.max(1, toNumber(req.query.limit, 5)));

    const data = await fetchLegacyProperties({}, 1, 500);
    const items = data.items
      .filter((item) => (excludeId ? item.id !== excludeId : true))
      .filter((item) =>
        locality
          ? `${item.location} ${item.locality}`.toLowerCase().includes(locality.toLowerCase())
          : true
      )
      .filter((item) =>
        category && category !== "all"
          ? String(item.category || "").toLowerCase() === category
          : true
      )
      .slice(0, limit)
      .map((item) => ({
        ...item,
        recommendationScore: Math.max(40, Math.min(100, toNumber(item.trustScore, 70))),
        recommendationReason: "locality and trust score similarity"
      }));

    res.json({
      ok: true,
      items
    });
  } catch (error) {
    next(error);
  }
}

router.get("/recommendations", recommendationHandler);
router.get("/ai/recommendations", recommendationHandler);

router.get("/subscriptions/plans", (_req, res) => {
  res.json({
    ok: true,
    items: LEGACY_SUBSCRIPTION_PLANS
  });
});

router.post("/subscriptions/activate", requireBridgeTrustedActor, bridgeWriteLimiter, (req, res) => {
  const actor = req.bridgeActor;
  const planId = text(req.body?.planId);
  const plan =
    LEGACY_SUBSCRIPTION_PLANS.find((item) => item.id === planId) ||
    LEGACY_SUBSCRIPTION_PLANS[0];
  const subscription = {
    id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId: actor.id,
    userName: actor.name,
    planId: plan.id,
    name: plan.name,
    amount: plan.amount,
    cycleDays: plan.cycleDays,
    type: plan.type,
    propertyId: text(req.body?.propertyId) || null,
    status: "active",
    activatedAt: nowIso()
  };
  proMemoryStore.subscriptions.unshift(subscription);
  proMemoryStore.subscriptions = proMemoryStore.subscriptions.slice(0, 300);

  res.status(201).json({
    ok: true,
    subscription
  });
});

router.post("/property-care/requests", requireBridgeTrustedActor, bridgeWriteLimiter, (req, res) => {
  const actor = req.bridgeActor;
  const request = {
    id: `pc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId: actor.id,
    userName: actor.name,
    issueType: text(req.body?.issueType, "General"),
    notes: text(req.body?.notes, ""),
    preferredDate: req.body?.preferredDate || null,
    status: "open",
    createdAt: nowIso()
  };
  proMemoryStore.propertyCareRequests.unshift(request);
  proMemoryStore.propertyCareRequests = proMemoryStore.propertyCareRequests.slice(0, 300);

  res.status(201).json({
    ok: true,
    request
  });
});

router.post("/reports", requireBridgeTrustedActor, bridgeWriteLimiter, (req, res) => {
  const actor = req.bridgeActor;
  const report = {
    id: `rp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId: actor.id,
    userName: actor.name,
    propertyId: text(req.body?.propertyId),
    reason: text(req.body?.reason, "No reason provided"),
    status: "open",
    createdAt: nowIso()
  };
  proMemoryStore.reports.unshift(report);
  proMemoryStore.reports = proMemoryStore.reports.slice(0, 500);

  res.status(201).json({
    ok: true,
    report
  });
});

router.post(
  "/sealed-bids",
  requireBridgeTrustedActor,
  requireBridgeRole("buyer", "seller", "customer"),
  bridgeWriteLimiter,
  (req, res) => {
  const actor = req.bridgeActor;
  if (!actor.trusted || !bridgeAllowedBidderRoles.has(text(actor.role).toLowerCase())) {
    return res.status(403).json({
      ok: false,
      message: "Only authenticated buyer/seller accounts can place sealed bids."
    });
  }

  const propertyId = text(req.body?.propertyId);
  const amount = toNumber(req.body?.amount, 0);

  if (!propertyId || amount <= 0) {
    return res.status(400).json({
      ok: false,
      message: "propertyId and valid amount are required."
    });
  }

  const bid = {
    id: `bid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    propertyId,
    propertyTitle: text(req.body?.propertyTitle, `Property ${propertyId}`),
    amount,
    bidderId: actor.id,
    bidderName: actor.name,
    status: "Submitted",
    publicVisible: false,
    createdAt: nowIso()
  };

  proMemoryStore.sealedBids.unshift(bid);
  proMemoryStore.sealedBids = proMemoryStore.sealedBids.slice(0, 1000);

  return res.status(201).json({
    ok: true,
    bid
  });
});

router.get("/sealed-bids/mine", requireBridgeTrustedActor, (req, res) => {
  const actor = req.bridgeActor;
  const mine = proMemoryStore.sealedBids.filter((item) => item.bidderId === actor.id);
  res.json({
    ok: true,
    total: mine.length,
    items: mine
  });
});

router.get(
  "/sealed-bids/summary",
  requireBridgeTrustedActor,
  requireBridgeRole("admin"),
  bridgeAdminActionLimiter,
  (req, res) => {

  const grouped = new Map();
  proMemoryStore.sealedBids.forEach((bid) => {
    const key = bid.propertyId;
    const current = grouped.get(key) || {
      propertyId: key,
      propertyTitle: bid.propertyTitle,
      totalBids: 0,
      highestBid: 0
    };
    current.totalBids += 1;
    current.highestBid = Math.max(current.highestBid, toNumber(bid.amount, 0));
    grouped.set(key, current);
  });

  res.json({
    ok: true,
    total: grouped.size,
    items: [...grouped.values()]
  });
});

router.get(
  "/sealed-bids/reveal",
  requireBridgeTrustedActor,
  requireBridgeRole("admin"),
  bridgeAdminActionLimiter,
  (_req, res) => {

  const grouped = new Map();
  proMemoryStore.sealedBids.forEach((bid) => {
    const key = bid.propertyId;
    const current = grouped.get(key) || [];
    current.push(bid);
    grouped.set(key, current);
  });

  const winners = [...grouped.entries()].map(([propertyId, bids]) => {
    const sorted = [...bids].sort((a, b) => toNumber(b.amount, 0) - toNumber(a.amount, 0));
    return {
      propertyId,
      winnerBid: sorted[0],
      totalBids: sorted.length
    };
  });

  res.json({
    ok: true,
    winners
  });
});

router.post(
  "/sealed-bids/decision",
  requireBridgeTrustedActor,
  requireBridgeRole("admin"),
  bridgeAdminActionLimiter,
  (req, res) => {
  const actor = req.bridgeActor;

  const propertyId = text(req.body?.propertyId);
  const action = text(req.body?.action, "reveal").toLowerCase();
  const decisionReason = text(req.body?.decisionReason || req.body?.note).replace(/\s+/g, " ").slice(0, 300);
  if (decisionReason.length < bridgeDecisionReasonMin) {
    return res.status(400).json({
      ok: false,
      message: `decisionReason must be at least ${bridgeDecisionReasonMin} characters.`
    });
  }

  const targets = proMemoryStore.sealedBids.filter((bid) => bid.propertyId === propertyId);
  if (!targets.length) {
    return res.status(404).json({
      ok: false,
      message: "No bids found for this property."
    });
  }

  if (action === "accept") {
    const highest = [...targets].sort((a, b) => toNumber(b.amount, 0) - toNumber(a.amount, 0))[0];
    proMemoryStore.sealedBids = proMemoryStore.sealedBids.map((bid) =>
      bid.propertyId === propertyId
        ? {
            ...bid,
            status: bid.id === highest.id ? "Accepted" : "Rejected",
            decisionReason,
            decisionAt: nowIso()
          }
        : bid
    );
  } else if (action === "reject") {
    proMemoryStore.sealedBids = proMemoryStore.sealedBids.map((bid) =>
      bid.propertyId === propertyId
        ? {
            ...bid,
            status: "Rejected",
            decisionReason,
            decisionAt: nowIso()
          }
        : bid
    );
  } else {
    proMemoryStore.sealedBids = proMemoryStore.sealedBids.map((bid) =>
      bid.propertyId === propertyId
        ? {
            ...bid,
            publicVisible: true,
            decisionReason,
            decisionAt: nowIso()
          }
        : bid
    );
  }

  return res.json({
    ok: true,
    message: "Bid decision applied.",
    decisionBy: {
      id: actor.id,
      name: actor.name,
      role: actor.role
    }
  });
});

router.get("/bootstrap", (_req, res) => {
  res.json({
    ok: true,
    plans: LEGACY_SUBSCRIPTION_PLANS,
    localities: ["Udaipur", "Pratap Nagar", "Bhuwana", "Hiran Magri"],
    categories: ["Apartment", "Villa", "Plot", "Commercial"],
    cities: ["Udaipur", "Jaipur", "Ahmedabad", "Delhi"]
  });
});

router.get("/properties/:propertyId", async (req, res, next) => {
  try {
    const property = await findProPropertyRecordById(req.params.propertyId);
    if (!property) {
      return res.status(404).json({
        ok: false,
        message: "Property not found."
      });
    }

    return res.json({
      ok: true,
      property: toLegacyProperty(property)
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
