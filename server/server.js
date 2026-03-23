import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5000);
const JWT_SECRET = process.env.JWT_SECRET || "propertysetu-dev-secret";
const OTP = "123456";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.join(__dirname, "..");
const frontendRoot = path.join(webRoot, "frontend");
const hasFrontendRoot = fs.existsSync(frontendRoot);
const activeWebRoot = hasFrontendRoot ? frontendRoot : webRoot;
const dbDir = path.join(webRoot, "database");
const dbFile = path.join(dbDir, "live-data.json");
const uploadsRoot = path.join(webRoot, "uploads");
const liveRouteMap = [
  { path: "/", file: "index.html", feature: "homepage", live: true },
  { path: "/udaipur", file: "index.html", feature: "city-live", live: true },
  { path: "/buy-sell", file: "pages/buy-sell.html", feature: "buy-sell", live: true },
  { path: "/rent", file: "pages/rent.html", feature: "rent", live: true },
  { path: "/property-care", file: "pages/property-care-plans.html", feature: "property-care", live: true },
  { path: "/city-structure", file: "pages/city-expansion.html", feature: "city-expansion", live: true },
  { path: "/trusted-agents", file: "pages/trusted-agents.html", feature: "trusted-agents", live: true },
  { path: "/legal-help", file: "pages/legal-help.html", feature: "legal-help", live: true },
  { path: "/insurance-security", file: "pages/insurance-security.html", feature: "insurance-security", live: true },
  { path: "/premium-services", file: "pages/premium-services.html", feature: "premium-services", live: true },
  { path: "/live-platform-app", file: "pages/live-platform-app.html", feature: "full-stack-live-app", live: true },
  { path: "/add-property", file: "add-property.html", feature: "listing-upload", live: true },
  { path: "/property-details", file: "property-details.html", feature: "property-details", live: true },
  { path: "/customer-dashboard", file: "user-dashboard.html", feature: "customer-dashboard", live: true },
  { path: "/admin-dashboard", file: "admin-dashboard.html", feature: "admin-dashboard", live: true },
  { path: "/seller-dashboard", file: "seller-dashboard.html", feature: "seller-dashboard", live: true },
  { path: "/jaipur", file: "pages/city-expansion.html", feature: "future-city-route", live: false },
  { path: "/jodhpur", file: "pages/city-expansion.html", feature: "future-city-route", live: false },
  { path: "/ahmedabad", file: "pages/city-expansion.html", feature: "future-city-route", live: false },
  { path: "/delhi", file: "pages/city-expansion.html", feature: "future-city-route", live: false },
];

const plans = [
  { id: "free-basic", name: "Free Basic Listing", amount: 0, cycleDays: 30, type: "listing" },
  { id: "featured-7", name: "Featured Listing - 7 Days", amount: 299, cycleDays: 7, type: "featured" },
  { id: "featured-30", name: "Featured Listing - 30 Days", amount: 999, cycleDays: 30, type: "featured" },
  {
    id: "verified-badge-charge",
    name: "Verified Badge Charge",
    amount: 799,
    cycleDays: 30,
    type: "verification",
    highlights: ["Owner Aadhaar/PAN check", "Address verification", "Verified by PropertySetu badge"],
  },
  {
    id: "care-basic",
    name: "Property Care Basic Visit",
    amount: 2500,
    cycleDays: 30,
    type: "care",
    highlights: ["Monthly house check", "Lock check", "Water leakage check"],
  },
  {
    id: "care-plus",
    name: "Property Care Cleaning + Visit",
    amount: 5500,
    cycleDays: 30,
    type: "care",
    highlights: ["Everything in Basic", "Garden maintenance", "Bill payment handling"],
  },
  {
    id: "care-full",
    name: "Property Care Full Maintenance",
    amount: 10000,
    cycleDays: 30,
    type: "care",
    highlights: ["Priority maintenance", "Tenant coordination", "Full monthly owner support"],
  },
  { id: "agent-pro", name: "Trusted Agent Membership", amount: 1999, cycleDays: 30, type: "agent" },
];

const legalTemplates = [
  { id: "sale-agreement", name: "Sale Agreement Draft", fee: 999 },
  { id: "rent-agreement", name: "Rent Agreement Template", fee: 499 },
  { id: "stamp-duty-guide", name: "Stamp Duty Guidance", fee: 299 },
  { id: "lawyer-connect", name: "Local Lawyer Connect", fee: 1499 },
];

const fallbackLocalities = ["Hiran Magri", "Pratap Nagar", "Bhuwana", "Sukher", "Fatehpura", "Ambamata", "Savina", "Bedla"];

const seededProperties = [
  { id: "prop-seed-1", title: "Premium Lake-view Villa", city: "Udaipur", type: "Buy", category: "Villa", location: "Ambamata", price: 32000000, status: "Approved", verified: true, featured: true, featuredUntil: new Date(Date.now() + 14 * 86400000).toISOString(), ownerId: "seed-owner-1", ownerName: "PropertySetu Verified Owner", trustScore: 96, reviewCount: 0, averageRating: 0, createdAt: "2026-03-14T09:00:00.000Z", updatedAt: "2026-03-14T09:00:00.000Z" },
  { id: "prop-seed-2", title: "2BHK Family Flat in Pratap Nagar", city: "Udaipur", type: "Rent", category: "Flat", location: "Pratap Nagar", price: 19500, status: "Approved", verified: true, featured: false, featuredUntil: null, ownerId: "seed-owner-2", ownerName: "PropertySetu Owner", trustScore: 88, reviewCount: 0, averageRating: 0, createdAt: "2026-03-13T11:20:00.000Z", updatedAt: "2026-03-13T11:20:00.000Z" },
];

const defaults = () => ({
  users: [],
  properties: seededProperties,
  reviews: [],
  messages: [],
  agentReviews: [],
  subscriptions: [],
  careRequests: [],
  legalRequests: [],
  visits: [],
  bids: [],
  reports: [],
  tokenPayments: [],
  insuranceTieups: [],
  tenantDamageRequests: [],
  ownerVerificationRequests: [],
  uploads: [],
  callMaskRequests: [],
  notifications: [],
  adminConfig: {
    categories: ["House", "Flat", "Villa", "Plot", "Agriculture Land", "Commercial", "Warehouse", "Farm House", "PG / Hostel"],
    cities: ["Udaipur", "Jaipur", "Jodhpur", "Ahmedabad", "Delhi", "Mumbai"],
  },
  trustedAgents: [
    { id: "agent-1", name: "Udaipur Prime Realty", area: "Hiran Magri", verified: true, rating: 4.6, reviewCount: 12, transparentCommission: "1.5%" },
    { id: "agent-2", name: "Mewar Property Desk", area: "Pratap Nagar", verified: true, rating: 4.4, reviewCount: 9, transparentCommission: "2%" },
  ],
  counters: { user: 1, property: 100, review: 1, message: 1, subscription: 1, care: 1, legal: 1, visit: 1, bid: 1, notification: 1, report: 1, token: 1, insurance: 1, tenantDamage: 1, ownerVerification: 1, otp: 1, upload: 1, agentReview: 1, callMask: 1 },
});

let db = defaults();
let writeQ = Promise.resolve();

const txt = (v) => String(v || "").trim();
const email = (v) => txt(v).toLowerCase();
const phone = (v) => String(v || "").replace(/\D/g, "");
const num = (v, f = 0) => (Number.isFinite(Number(v)) ? Number(v) : f);
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const role = (v) => {
  const r = txt(v).toLowerCase();
  if (r === "admin" || r === "seller" || r === "agent") return r;
  return "customer";
};
const now = () => new Date().toISOString();
const safeArr = (v) => (Array.isArray(v) ? v : []);
const isUdaipur = (city) => txt(city || "Udaipur").toLowerCase().includes("udaipur");
const maskRef = (value) => {
  const raw = txt(value);
  if (!raw) return "";
  if (raw.length <= 4) return "*".repeat(raw.length);
  return `${raw.slice(0, 2)}${"*".repeat(Math.max(2, raw.length - 4))}${raw.slice(-2)}`;
};
const toCitySlug = (name) => txt(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const expansionPriorityCities = ["Udaipur", "Jaipur", "Jodhpur", "Ahmedabad", "Delhi"];
const ownerVerificationMeta = (u) => ({
  ownerVerified: !!u?.ownerVerified,
  ownerVerificationStatus: txt(u?.ownerVerificationStatus || "Not Submitted"),
  ownerVerificationUpdatedAt: u?.ownerVerificationUpdatedAt || null,
});
const userSafe = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email || "",
  mobile: u.mobile || "",
  role: u.role,
  verified: !!u.verified,
  subscriptionPlan: u.subscriptionPlan || "free-basic",
  ...ownerVerificationMeta(u),
});
const blocked = (u) => !!u?.blocked;
const directPhonePattern = /\+?\d[\d\s\-()]{8,}\d/;
const directEmailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const hasDirectContact = (message) => directPhonePattern.test(message) || directEmailPattern.test(message);
const getCityStructure = () => {
  const configured = safeArr(db?.adminConfig?.cities).map((city) => txt(city)).filter(Boolean);
  const unique = [...new Set([...expansionPriorityCities, ...configured])];
  const mapped = unique.map((cityName) => ({
    city: cityName,
    slug: toCitySlug(cityName),
    route: `PropertySetu.in/${toCitySlug(cityName)}`,
    status: cityName.toLowerCase() === "udaipur" ? "live" : "future-ready",
  }));
  const live = mapped.find((item) => item.city.toLowerCase() === "udaipur") || mapped[0] || {
    city: "Udaipur",
    slug: "udaipur",
    route: "PropertySetu.in/udaipur",
    status: "live",
  };
  const future = mapped.filter((item) => item.city.toLowerCase() !== live.city.toLowerCase());
  return {
    baseDomain: "PropertySetu.in",
    live,
    future,
    routePattern: "PropertySetu.in/{city-slug}",
    mandatoryStructure: expansionPriorityCities.map((cityName) => `PropertySetu.in/${toCitySlug(cityName)}`),
  };
};
const medianFromSorted = (items = []) => {
  if (!items.length) return 0;
  const middle = Math.floor(items.length / 2);
  if (items.length % 2 === 0) {
    return Math.round((num(items[middle - 1], 0) + num(items[middle], 0)) / 2);
  }
  return num(items[middle], 0);
};
const getLocalityInsightsPayload = (localityInput = "Udaipur") => {
  const locality = txt(localityInput || "Udaipur") || "Udaipur";
  const localityNeedle = locality.toLowerCase();
  const matched = db.properties.filter((p) => txt(p.location).toLowerCase().includes(localityNeedle));
  const prices = matched.map((p) => num(p.price, 0)).filter((x) => x > 0).sort((a, b) => a - b);
  const avgPrice = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 0;
  const medianPrice = medianFromSorted(prices);
  const trendBase = avgPrice || 4000;
  const trend = [5, 4, 3, 2, 1, 0].map((offset) => {
    const monthDate = new Date();
    monthDate.setMonth(monthDate.getMonth() - offset);
    return {
      monthOffset: offset,
      monthLabel: monthDate.toLocaleString("en-IN", { month: "short" }),
      monthKey: `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`,
      avgRate: Math.max(1500, Math.round(trendBase * (1 + (offset - 2) * 0.015))),
    };
  });
  return {
    stats: {
      locality,
      totalListings: matched.length,
      approvedListings: matched.filter((p) => p.status === "Approved").length,
      verifiedListings: matched.filter((p) => p.verified).length,
      avgPrice,
      medianPrice,
    },
    nearby: {
      schools: [`${locality} Public School`, `${locality} Central School`],
      hospitals: [`${locality} Hospital`, "Maharana Bhupal Hospital"],
      markets: [`${locality} Market`, "City Main Bazaar"],
    },
    trend,
  };
};
const getRecommendationItems = ({ locality = "", category = "all", excludeId = "", targetPrice = 0, limit = 5 } = {}) => {
  const localityNeedle = txt(locality).toLowerCase();
  const categoryNeedle = txt(category).toLowerCase();
  const exclude = txt(excludeId);
  const desiredPrice = num(targetPrice, 0);
  const safeLimit = Math.max(1, Math.min(20, num(limit, 5)));

  let items = db.properties.filter((p) => p.status === "Approved");
  if (localityNeedle) items = items.filter((p) => txt(p.location).toLowerCase().includes(localityNeedle));
  if (categoryNeedle && categoryNeedle !== "all") items = items.filter((p) => txt(p.category).toLowerCase() === categoryNeedle);
  if (exclude) items = items.filter((p) => p.id !== exclude);

  const scored = items.map((item) => {
    const localityBoost = localityNeedle && txt(item.location).toLowerCase().includes(localityNeedle) ? 16 : 0;
    const categoryBoost = categoryNeedle && categoryNeedle !== "all" && txt(item.category).toLowerCase() === categoryNeedle ? 18 : 0;
    const priceScore = desiredPrice > 0 && num(item.price, 0) > 0
      ? clamp(20 - Math.round((Math.abs(num(item.price, 0) - desiredPrice) / desiredPrice) * 40), 0, 20)
      : 10;
    const verifiedBoost = item.verified ? 8 : 0;
    const score = clamp(Math.round(num(item.trustScore, 0) + localityBoost + categoryBoost + priceScore + verifiedBoost), 35, 100);
    return {
      ...item,
      recommendationScore: score,
      recommendationReason: [
        localityBoost ? "locality match" : null,
        categoryBoost ? "category match" : null,
        verifiedBoost ? "verified trust" : null,
        priceScore >= 12 ? "price similarity" : null,
      ].filter(Boolean).join(", ") || "high trust relevance",
    };
  });
  scored.sort((a, b) => num(b.recommendationScore, 0) - num(a.recommendationScore, 0) || num(b.trustScore, 0) - num(a.trustScore, 0));
  return { total: scored.length, items: scored.slice(0, safeLimit) };
};
const getAiPricingSuggestionPayload = ({ locality = "Udaipur", expectedPrice = 0 } = {}) => {
  const insights = getLocalityInsightsPayload(locality);
  const avgPrice = num(insights?.stats?.avgPrice, 0);
  const medianPrice = num(insights?.stats?.medianPrice, 0);
  const reference = avgPrice > 0 ? avgPrice : medianPrice;
  const target = num(expectedPrice, 0);
  const blended = target > 0 && reference > 0
    ? Math.round((reference * 0.75) + (target * 0.25))
    : (reference || target || 0);
  const recommendedPrice = Math.max(0, blended);
  const bandMin = Math.max(0, Math.round(recommendedPrice * 0.88));
  const bandMax = Math.max(bandMin, Math.round(recommendedPrice * 1.14));
  const confidence = clamp(
    55
      + (num(insights?.stats?.totalListings, 0) >= 4 ? 18 : 0)
      + (num(insights?.stats?.verifiedListings, 0) >= 2 ? 10 : 0)
      + (reference > 0 ? 8 : 0),
    40,
    95,
  );
  return {
    locality: txt(locality || "Udaipur"),
    avgPrice,
    medianPrice,
    recommendedPrice,
    suggestedBand: { min: bandMin, max: bandMax },
    confidence,
    message: `Is area me average price ₹${avgPrice.toLocaleString("en-IN")} hai. Suggested range ₹${bandMin.toLocaleString("en-IN")} - ₹${bandMax.toLocaleString("en-IN")}.`,
    source: "live-ai-pricing-model",
    stats: insights.stats,
  };
};
const buildAiDescription = (payload = {}) => {
  const title = txt(payload.title || "Property");
  const locality = txt(payload.location || payload.locality || "Udaipur");
  const category = txt(payload.category || "Property");
  const listingType = txt(payload.type || payload.purpose || "Buy");
  const price = num(payload.price, 0);
  const bedrooms = txt(payload.bedrooms);
  const bathrooms = txt(payload.bathrooms);
  const area = txt(payload.builtUpArea || payload.plotSize || payload.carpetArea);
  const furnished = txt(payload.furnished);
  const landmark = txt(payload.landmark);
  const parking = txt(payload.parking);
  const facing = txt(payload.facing);

  const parts = [
    `${title} located in ${locality}, Udaipur.`,
    `${category} available for ${listingType}${price > 0 ? ` at ₹${price.toLocaleString("en-IN")}` : ""}.`,
    area ? `Area: ${area}.` : "",
    bedrooms ? `Bedrooms: ${bedrooms}.` : "",
    bathrooms ? `Bathrooms: ${bathrooms}.` : "",
    furnished ? `Furnishing: ${furnished}.` : "",
    facing ? `Facing: ${facing}.` : "",
    parking ? `Parking: ${parking}.` : "",
    landmark ? `Nearby landmark: ${landmark}.` : "",
    "Verified documentation workflow and secure owner verification enabled through PropertySetu.",
  ].filter(Boolean);
  return parts.join(" ");
};
const evaluateFraudSignals = (payload = {}) => {
  const rawText = `${txt(payload.title)} ${txt(payload.description)}`.toLowerCase();
  const riskyWords = ["urgent sale", "cash only", "advance first", "no visit", "token now", "without papers"];
  const riskyMatches = riskyWords.filter((word) => rawText.includes(word));
  const photoCount = num(payload?.media?.photosCount ?? payload?.photoCount, 0);
  const duplicatePhotoCount = num(payload?.media?.duplicatePhotoMatches ?? payload?.duplicatePhotoCount, 0);
  const blurryPhotoCount = num(payload?.media?.blurryPhotosDetected ?? payload?.blurryPhotoCount, 0);
  const expectedAveragePrice = num(payload.expectedAveragePrice, 0);
  const askedPrice = num(payload.price, 0);
  const suspiciousPricingAlert = expectedAveragePrice > 0 && askedPrice > 0 && askedPrice < Math.round(expectedAveragePrice * 0.38);
  const lowMediaProof = photoCount > 0 && photoCount < 5;
  const fakeListingSignal = duplicatePhotoCount > 0 || suspiciousPricingAlert || blurryPhotoCount >= 3 || riskyMatches.length >= 2;
  const fraudRiskScore = clamp(
    (riskyMatches.length * 20)
      + (suspiciousPricingAlert ? 24 : 0)
      + (lowMediaProof ? 16 : 0)
      + (duplicatePhotoCount > 0 ? 28 : 0)
      + (blurryPhotoCount >= 3 ? 12 : 0),
    0,
    100,
  );
  return {
    fraudRiskScore,
    duplicatePhotoDetected: duplicatePhotoCount > 0,
    duplicatePhotoCount,
    suspiciousPricingAlert,
    fakeListingSignal,
    reasons: [
      ...riskyMatches.map((word) => `Contains risky phrase: "${word}"`),
      ...(suspiciousPricingAlert ? ["Price looks abnormally low for this locality"] : []),
      ...(lowMediaProof ? ["Minimum 5 photos recommended for trust"] : []),
      ...(duplicatePhotoCount > 0 ? [`Duplicate photo match detected (${duplicatePhotoCount})`] : []),
      ...(blurryPhotoCount >= 3 ? ["Multiple blurry photos detected"] : []),
    ],
    recommendation: fakeListingSignal || fraudRiskScore > 60 ? "Manual admin verification required" : "Looks normal",
  };
};
const allowedUploadExt = new Set(["jpg", "jpeg", "png", "webp", "pdf", "mp4", "mov", "webm"]);
const safeExtFrom = (name, mime = "") => {
  const byName = txt(name).split(".").pop().toLowerCase();
  if (allowedUploadExt.has(byName)) return byName;
  const map = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
  };
  return map[txt(mime).toLowerCase()] || "bin";
};
const normalizedUploadUrl = (relativePath) => `/${txt(relativePath).replace(/\\/g, "/").replace(/^\/+/, "")}`;
const resolveWebFile = (...segments) => {
  const targetInFrontend = path.join(frontendRoot, ...segments);
  if (fs.existsSync(targetInFrontend)) return targetInFrontend;
  return path.join(webRoot, ...segments);
};

const nextId = (k) => {
  db.counters[k] = num(db.counters[k], 0) + 1;
  return `${k}-${db.counters[k]}`;
};

const agentWithMetrics = (agent) => {
  const baseCount = Math.max(0, num(agent.reviewCount, 0));
  const baseRating = Math.max(0, num(agent.rating, 0));
  const liveItems = db.agentReviews.filter((item) => item.agentId === agent.id);
  const liveCount = liveItems.length;
  const liveSum = liveItems.reduce((sum, item) => sum + num(item.rating, 0), 0);
  const totalCount = baseCount + liveCount;
  const weightedRating = totalCount ? ((baseRating * baseCount) + liveSum) / totalCount : 0;
  return {
    ...agent,
    rating: Number(weightedRating.toFixed(2)),
    reviewCount: totalCount,
    commissionTransparency: agent.transparentCommission ? `Disclosed upfront (${agent.transparentCommission})` : "Disclosed upfront",
    contactPolicy: "No direct phone shown. Use in-app chat and call masking.",
  };
};

const save = async () => {
  writeQ = writeQ.then(() => fsp.writeFile(dbFile, JSON.stringify(db, null, 2), "utf8"));
  return writeQ;
};

const load = async () => {
  if (!fs.existsSync(dbDir)) await fsp.mkdir(dbDir, { recursive: true });
  if (!fs.existsSync(dbFile)) await fsp.writeFile(dbFile, JSON.stringify(defaults(), null, 2), "utf8");
  if (!fs.existsSync(uploadsRoot)) await fsp.mkdir(uploadsRoot, { recursive: true });
  try {
    const raw = JSON.parse(await fsp.readFile(dbFile, "utf8"));
    const fresh = defaults();
    db = {
      ...fresh,
      ...raw,
      users: safeArr(raw.users),
      properties: safeArr(raw.properties),
      reviews: safeArr(raw.reviews),
      messages: safeArr(raw.messages),
      agentReviews: safeArr(raw.agentReviews),
      subscriptions: safeArr(raw.subscriptions),
      careRequests: safeArr(raw.careRequests),
      legalRequests: safeArr(raw.legalRequests),
      visits: safeArr(raw.visits),
      bids: safeArr(raw.bids),
      reports: safeArr(raw.reports),
      tokenPayments: safeArr(raw.tokenPayments),
      insuranceTieups: safeArr(raw.insuranceTieups),
      tenantDamageRequests: safeArr(raw.tenantDamageRequests),
      ownerVerificationRequests: safeArr(raw.ownerVerificationRequests),
      uploads: safeArr(raw.uploads),
      callMaskRequests: safeArr(raw.callMaskRequests),
      notifications: safeArr(raw.notifications),
      adminConfig: {
        ...fresh.adminConfig,
        ...(raw.adminConfig || {}),
        categories: safeArr(raw?.adminConfig?.categories).length ? safeArr(raw.adminConfig.categories) : fresh.adminConfig.categories,
        cities: safeArr(raw?.adminConfig?.cities).length ? safeArr(raw.adminConfig.cities) : fresh.adminConfig.cities,
      },
      trustedAgents: safeArr(raw.trustedAgents).length ? safeArr(raw.trustedAgents) : fresh.trustedAgents,
      counters: { ...fresh.counters, ...(raw.counters || {}) },
    };
  } catch {
    db = defaults();
    await save();
  }
};

const sign = (u) => jwt.sign({ id: u.id, role: u.role, name: u.name, email: u.email || "", mobile: u.mobile || "" }, JWT_SECRET, { expiresIn: "24h" });
const tokenOf = (req) => {
  const h = String(req.headers.authorization || "");
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
};
const authOpt = (req, _res, next) => {
  req.user = null;
  const t = tokenOf(req);
  if (!t) return next();
  try {
    const parsed = jwt.verify(t, JWT_SECRET);
    const u = userById(parsed.id);
    if (blocked(u)) return next();
    req.user = parsed;
  } catch {
    req.user = null;
  }
  next();
};
const auth = (req, res, next) => {
  const t = tokenOf(req);
  if (!t) return res.status(401).json({ ok: false, message: "Missing auth token." });
  try {
    const parsed = jwt.verify(t, JWT_SECRET);
    const u = userById(parsed.id);
    if (blocked(u)) return res.status(403).json({ ok: false, message: "Your account is blocked by admin." });
    req.user = parsed;
    next();
  } catch {
    res.status(401).json({ ok: false, message: "Invalid or expired token." });
  }
};
const admin = (req, res, next) => (req.user?.role === "admin" ? next() : res.status(403).json({ ok: false, message: "Admin access required." }));
const userById = (id) => db.users.find((u) => u.id === id) || null;
const pushNoti = (userId, title, message, type = "general") => db.notifications.unshift({ id: nextId("notification"), userId, title, message, type, isRead: false, createdAt: now() });

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(activeWebRoot));
if (activeWebRoot !== webRoot) {
  app.use(express.static(webRoot));
}

app.get("/api", (_req, res) => res.json({ ok: true, service: "PropertySetu API", version: "2.3.0", features: ["auth", "otp-login", "owner-verification", "properties", "admin", "visits", "reviews", "chat", "subscriptions", "care", "legal", "bids", "insights", "ai-recommendations", "ai-pricing", "ai-description", "ai-fraud-scan", "ai-market-trend", "reports", "admin-config", "city-structure", "frontend-rooting", "file-upload", "token-payments", "insurance", "tenant-damage", "trusted-agents", "agent-ratings", "call-masking"] }));
app.get("/api/health", (_req, res) => res.json({ ok: true, uptimeSeconds: Math.floor(process.uptime()), counts: { users: db.users.length, properties: db.properties.length, reviews: db.reviews.length, messages: db.messages.length, subscriptions: db.subscriptions.length, bids: db.bids.length } }));
app.get("/api/system/live-roots", (_req, res) => res.json({
  ok: true,
  frontendRoot: activeWebRoot === frontendRoot ? "/frontend" : "/",
  backendRoot: "/server",
  frontendMode: hasFrontendRoot ? "frontend-folder-live" : "legacy-root-fallback",
  routePattern: "PropertySetu.in/{city-slug}",
  routes: liveRouteMap,
}));
app.get("/api/system/capabilities", (_req, res) => res.json({
  ok: true,
  capabilities: {
    multipageWebApp: true,
    backendSystem: true,
    database: true,
    fileUploadHandling: true,
    verificationLogic: true,
    subscriptionLogic: true,
    aiIntegration: true,
    secureChat: true,
  },
  modules: {
    auth: "/api/auth/*",
    listings: "/api/properties",
    mediaUpload: "/api/uploads/property-media",
    ownerVerification: "/api/owner-verification/*",
    reviews: "/api/reviews/*",
    subscriptions: "/api/subscriptions/*",
    ai: [
      "/api/ai/pricing-suggestion",
      "/api/ai/description-generate",
      "/api/ai/fraud-scan",
      "/api/ai/market-trend",
      "/api/ai/recommendations",
      "/api/insights/locality",
      "/api/recommendations",
    ],
    chat: "/api/chat/*",
  },
}));

app.post("/api/auth/register", async (req, res) => {
  const r = role(req.body?.role);
  const n = txt(req.body?.name);
  const e = email(req.body?.email);
  const m = phone(req.body?.mobile);
  const p = String(req.body?.password || "");
  const o = String(req.body?.otp || "");
  if (!n) return res.status(400).json({ ok: false, message: "Full name required." });
  if (!e && !m) return res.status(400).json({ ok: false, message: "Email or mobile required." });
  if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return res.status(400).json({ ok: false, message: "Valid email required." });
  if (m && !/^\d{10}$/.test(m)) return res.status(400).json({ ok: false, message: "Mobile must be 10 digits." });
  if (p.length < 6) return res.status(400).json({ ok: false, message: "Password minimum 6 characters required." });
  if (o !== OTP) return res.status(400).json({ ok: false, message: `Invalid OTP. Use ${OTP}.` });
  const exists = db.users.find((u) => u.role === r && ((e && u.email === e) || (m && u.mobile === m)));
  if (exists) return res.status(409).json({ ok: false, message: "Account already exists. Please login." });
  const u = {
    id: nextId("user"),
    role: r,
    name: n,
    email: e || "",
    mobile: m || "",
    passwordHash: await bcrypt.hash(p, 10),
    verified: true,
    ownerVerified: false,
    ownerVerificationStatus: "Not Submitted",
    ownerVerificationUpdatedAt: null,
    subscriptionPlan: "free-basic",
    createdAt: now(),
    updatedAt: now(),
    lastLoginAt: null,
  };
  db.users.push(u);
  pushNoti(u.id, "Welcome to PropertySetu", "Your account is ready.", "auth");
  await save();
  res.status(201).json({ ok: true, token: sign(u), user: userSafe(u) });
});

app.post("/api/auth/request-otp", async (req, res) => {
  const r = role(req.body?.role);
  const e = email(req.body?.email);
  const m = phone(req.body?.mobile);
  if (!e && !m) return res.status(400).json({ ok: false, message: "Email or mobile required." });
  const cred = m || e;
  const u = /^\d{10}$/.test(cred) ? db.users.find((x) => x.role === r && x.mobile === cred) : db.users.find((x) => x.role === r && x.email === cred);
  if (!u) return res.status(404).json({ ok: false, message: "User not found for OTP login." });
  const record = {
    id: nextId("otp"),
    kind: "auth-otp-request",
    userId: u.id,
    role: r,
    channel: m ? "mobile" : "email",
    destination: m ? `${m.slice(0, 2)}******${m.slice(-2)}` : `${e.slice(0, 2)}***`,
    status: "sent",
    createdAt: now(),
  };
  db.ownerVerificationRequests.unshift(record);
  await save();
  res.json({
    ok: true,
    message: `OTP sent successfully (demo OTP: ${OTP}).`,
    otpHint: OTP,
    challengeId: record.id,
  });
});

app.post("/api/auth/login", async (req, res) => {
  const r = role(req.body?.role);
  const e = email(req.body?.email);
  const m = phone(req.body?.mobile);
  const p = String(req.body?.password || "");
  const o = String(req.body?.otp || "");
  if (!e && !m) return res.status(400).json({ ok: false, message: "Email or mobile required." });
  if (o !== OTP) return res.status(400).json({ ok: false, message: `Invalid OTP. Use ${OTP}.` });
  const cred = m || e;
  const u = /^\d{10}$/.test(cred) ? db.users.find((x) => x.role === r && x.mobile === cred) : db.users.find((x) => x.role === r && x.email === cred);
  if (!u) return res.status(404).json({ ok: false, message: "User not found. Please signup first." });
  if (p) {
    if (!(await bcrypt.compare(p, u.passwordHash))) return res.status(401).json({ ok: false, message: "Invalid credentials." });
  }
  u.lastLoginAt = now();
  u.updatedAt = now();
  await save();
  res.json({ ok: true, token: sign(u), user: userSafe(u) });
});

app.post("/api/auth/logout", auth, (_req, res) => res.json({ ok: true, message: "Logged out successfully." }));
app.get("/api/auth/me", auth, (req, res) => {
  const u = userById(req.user.id);
  if (!u) return res.status(404).json({ ok: false, message: "User not found." });
  res.json({ ok: true, user: userSafe(u) });
});

app.post("/api/owner-verification/request", auth, async (req, res) => {
  const user = userById(req.user.id);
  if (!user) return res.status(404).json({ ok: false, message: "User not found for session." });
  const propertyId = txt(req.body?.propertyId);
  const property = propertyId ? db.properties.find((item) => item.id === propertyId) : null;
  if (propertyId && !property) return res.status(404).json({ ok: false, message: "Property not found for owner verification." });
  if (property && req.user.role !== "admin" && property.ownerId !== req.user.id) {
    return res.status(403).json({ ok: false, message: "You can submit verification only for your own property." });
  }

  const ownerAadhaarPanStatus = txt(req.body?.ownerAadhaarPanStatus || "Submitted");
  const addressVerificationStatus = txt(req.body?.addressVerificationStatus || "Submitted");
  const ownerAadhaarPanRef = txt(req.body?.ownerAadhaarPanRef || req.body?.ownerKycRef);
  const addressVerificationRef = txt(req.body?.addressVerificationRef || req.body?.propertyAddressRef);
  const privateDocsUploaded = !!req.body?.privateDocsUploaded;
  const record = {
    id: nextId("ownerVerification"),
    kind: "owner-verification",
    userId: user.id,
    userName: user.name,
    role: user.role,
    propertyId: property?.id || null,
    propertyTitle: property?.title || null,
    ownerAadhaarPanStatus,
    addressVerificationStatus,
    ownerAadhaarPanRefMasked: maskRef(ownerAadhaarPanRef),
    addressVerificationRefMasked: maskRef(addressVerificationRef),
    privateDocsUploaded,
    status: "Pending Review",
    note: txt(req.body?.note || req.body?.verificationOfficerNote),
    createdAt: now(),
    updatedAt: now(),
  };

  db.ownerVerificationRequests.unshift(record);
  user.ownerVerified = false;
  user.ownerVerificationStatus = "Pending Review";
  user.ownerVerificationUpdatedAt = now();
  user.updatedAt = now();

  if (property) {
    property.verification = {
      ...(property.verification || {}),
      ownerAadhaarPanStatus,
      addressVerificationStatus,
      badgeEligible: false,
    };
    property.updatedAt = now();
  }

  pushNoti(user.id, "Owner Verification Submitted", "Your Aadhaar/PAN + address verification request is under review.", "verification");
  db.users
    .filter((item) => item.role === "admin")
    .forEach((adminUser) => pushNoti(adminUser.id, "Owner Verification Review Needed", `${user.name} submitted owner verification request.`, "verification"));
  await save();
  res.status(201).json({ ok: true, request: record, user: userSafe(user) });
});

app.get("/api/owner-verification/me", auth, (req, res) => {
  const user = userById(req.user.id);
  if (!user) return res.status(404).json({ ok: false, message: "User not found." });
  const items = db.ownerVerificationRequests
    .filter((item) => item.kind === "owner-verification" && item.userId === req.user.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ ok: true, total: items.length, user: userSafe(user), items });
});

app.get("/api/search/suggestions", (req, res) => {
  const q = txt(req.query.q).toLowerCase();
  const dynamic = db.properties.map((p) => txt(p.location)).filter(Boolean);
  const merged = [...new Set([...dynamic, ...fallbackLocalities])];
  const items = q ? merged.filter((x) => x.toLowerCase().includes(q)).slice(0, 80) : merged.slice(0, 80);
  res.json({ ok: true, items });
});

app.post("/api/uploads/property-media", auth, async (req, res) => {
  const payloadFiles = safeArr(req.body?.files);
  if (!payloadFiles.length) return res.status(400).json({ ok: false, message: "files payload required." });
  if (payloadFiles.length > 25) return res.status(400).json({ ok: false, message: "Maximum 25 files allowed in one request." });

  const savedItems = [];
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");
  const targetDir = path.join(uploadsRoot, String(year), month);
  if (!fs.existsSync(targetDir)) await fsp.mkdir(targetDir, { recursive: true });

  for (const fileInput of payloadFiles) {
    const originalName = txt(fileInput?.name || "upload.bin");
    const mimeType = txt(fileInput?.type || "application/octet-stream");
    const category = txt(fileInput?.category || "general");
    const rawBase64 = String(fileInput?.dataBase64 || fileInput?.base64 || "")
      .replace(/^data:[^;]+;base64,/, "")
      .trim();
    if (!rawBase64) continue;
    let buffer;
    try {
      buffer = Buffer.from(rawBase64, "base64");
    } catch {
      return res.status(400).json({ ok: false, message: `Invalid base64 file payload for ${originalName}.` });
    }
    if (!buffer.length) continue;
    if (buffer.length > 10 * 1024 * 1024) {
      return res.status(400).json({ ok: false, message: `File too large: ${originalName}. Max 10MB.` });
    }

    const ext = safeExtFrom(originalName, mimeType);
    const uploadId = nextId("upload");
    const diskName = `${uploadId}-${Date.now()}.${ext}`;
    const fullPath = path.join(targetDir, diskName);
    await fsp.writeFile(fullPath, buffer);

    const relPath = path.relative(webRoot, fullPath);
    const record = {
      id: uploadId,
      userId: req.user.id,
      userName: req.user.name,
      propertyId: txt(fileInput?.propertyId || req.body?.propertyId) || null,
      name: originalName,
      mimeType,
      category,
      sizeBytes: buffer.length,
      storagePath: relPath.replace(/\\/g, "/"),
      url: normalizedUploadUrl(relPath),
      createdAt: now(),
    };
    db.uploads.unshift(record);
    savedItems.push(record);
  }

  if (!savedItems.length) return res.status(400).json({ ok: false, message: "No valid file payload found." });
  await save();
  res.status(201).json({ ok: true, total: savedItems.length, items: savedItems });
});

app.get("/api/uploads/mine", auth, (req, res) => {
  const propertyId = txt(req.query.propertyId);
  let items = req.user.role === "admin"
    ? [...db.uploads]
    : db.uploads.filter((item) => item.userId === req.user.id);
  if (propertyId) items = items.filter((item) => txt(item.propertyId) === propertyId);
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ ok: true, total: items.length, items });
});

app.get("/api/properties", authOpt, (req, res) => {
  let items = [...db.properties];
  const mine = String(req.query.mine || "") === "1";
  const city = txt(req.query.city || "Udaipur");
  const status = txt(req.query.status);
  const q = txt(req.query.q).toLowerCase();
  const locality = txt(req.query.locality).toLowerCase();
  const category = txt(req.query.category).toLowerCase();
  const purpose = txt(req.query.purpose || req.query.type).toLowerCase();
  const verifiedOnly = String(req.query.verifiedOnly || "") === "1";
  const minPrice = num(req.query.minPrice, 0);
  const maxPrice = Number.isFinite(Number(req.query.maxPrice)) ? Number(req.query.maxPrice) : Number.MAX_SAFE_INTEGER;

  if (city) items = items.filter((p) => txt(p.city).toLowerCase().includes(city.toLowerCase()));
  if (mine) {
    if (!req.user?.id) return res.status(401).json({ ok: false, message: "Login required for mine filter." });
    items = items.filter((p) => p.ownerId === req.user.id);
  } else if (status && req.user?.role === "admin") items = items.filter((p) => txt(p.status).toLowerCase() === status.toLowerCase());
  else items = items.filter((p) => p.status === "Approved");
  if (q) items = items.filter((p) => `${p.title} ${p.location} ${p.category}`.toLowerCase().includes(q));
  if (locality) items = items.filter((p) => txt(p.location).toLowerCase().includes(locality));
  if (category && category !== "all") items = items.filter((p) => txt(p.category).toLowerCase() === category);
  if (purpose && purpose !== "all") items = items.filter((p) => txt(p.type).toLowerCase() === purpose);
  if (verifiedOnly) items = items.filter((p) => !!p.verified);
  items = items.filter((p) => num(p.price, 0) >= minPrice && num(p.price, 0) <= maxPrice);
  const sort = txt(req.query.sort || "latest").toLowerCase();
  if (sort === "pricelow") items.sort((a, b) => num(a.price, 0) - num(b.price, 0));
  else if (sort === "pricehigh") items.sort((a, b) => num(b.price, 0) - num(a.price, 0));
  else if (sort === "trust") items.sort((a, b) => num(b.trustScore, 0) - num(a.trustScore, 0));
  else items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ ok: true, total: items.length, items });
});

app.post("/api/properties", auth, async (req, res) => {
  const owner = userById(req.user.id);
  if (!owner) return res.status(401).json({ ok: false, message: "User not found for session." });
  const payload = req.body || {};
  const property = {
    id: nextId("property"),
    title: txt(payload.title) || "Untitled Property",
    city: isUdaipur(payload.city) ? "Udaipur" : txt(payload.city || "Udaipur"),
    type: txt(payload.type) || "Buy",
    category: txt(payload.category) || "House",
    propertyTypeCore: txt(payload.propertyTypeCore || payload.category),
    saleRentMode: txt(payload.saleRentMode || (txt(payload.type).toLowerCase() === "rent" ? "Rent" : "Sale")),
    location: txt(payload.location) || "Udaipur",
    price: num(payload.price, 0),
    negotiable: txt(payload.negotiable || "No"),
    description: txt(payload.description),
    plotSize: txt(payload.plotSize),
    builtUpArea: txt(payload.builtUpArea),
    carpetArea: txt(payload.carpetArea),
    floors: txt(payload.floors),
    facing: txt(payload.facing),
    furnished: txt(payload.furnished),
    bedrooms: num(payload.bedrooms, 0),
    bathrooms: num(payload.bathrooms, 0),
    parking: txt(payload.parking),
    garden: txt(payload.garden),
    borewell: txt(payload.borewell),
    roadWidth: num(payload.roadWidth, 0),
    loanAvailable: txt(payload.loanAvailable),
    readyToMove: txt(payload.readyToMove),
    landmark: txt(payload.landmark),
    media: payload.media || {},
    privateDocs: payload.privateDocs || {},
    verification: payload.verification || {},
    virtualTour: payload.virtualTour || {},
    visitBooking: payload.visitBooking || {},
    aiReview: payload.aiReview || {},
    aiDescription: txt(payload.aiDescription),
    smartPricing: payload.smartPricing || {},
    detailStructure: payload.detailStructure || {},
    status: owner.role === "admin" ? "Approved" : "Pending Approval",
    verified: owner.role === "admin",
    featured: false,
    featuredUntil: null,
    listingExpiresAt: new Date(Date.now() + 45 * 86400000).toISOString(),
    ownerId: owner.id,
    ownerName: owner.name,
    ownerRole: owner.role,
    trustScore: Math.max(40, 100 - num(payload?.aiReview?.fraudRiskScore, 45)),
    reviewCount: 0,
    averageRating: 0,
    createdAt: now(),
    updatedAt: now(),
  };
  const media = property.media || {};
  const photosCount = num(media.photosCount, 0);
  const hasVideoUpload = !!media.videoUploaded;
  const videoDurationSec = num(media.videoDurationSec, 0);
  const localityKey = txt(property.location).toLowerCase();
  const localityPeers = db.properties
    .filter((item) => txt(item.location).toLowerCase().includes(localityKey))
    .map((item) => num(item.price, 0))
    .filter((value) => value > 0)
    .sort((a, b) => a - b);
  const peerMedianPrice = localityPeers.length ? localityPeers[Math.floor(localityPeers.length / 2)] : 0;
  const duplicatePhotoDetected = !!payload?.aiReview?.duplicatePhotoDetected || num(media.duplicatePhotoMatches, 0) > 0;
  const suspiciousPricingAlert = peerMedianPrice > 0
    ? property.price < Math.round(peerMedianPrice * 0.45) || property.price > Math.round(peerMedianPrice * 2.2)
    : property.price > 0 && property.price < 300000;
  const blurryHeavy = num(media.blurryPhotosDetected, 0) >= 3;
  const fakeListingSignal = duplicatePhotoDetected || suspiciousPricingAlert || blurryHeavy;
  const payloadFraudRisk = num(payload?.aiReview?.fraudRiskScore, 45);
  const fraudRiskScore = clamp(
    Math.round(payloadFraudRisk + (duplicatePhotoDetected ? 28 : 0) + (suspiciousPricingAlert ? 22 : 0) + (blurryHeavy ? 12 : 0)),
    0,
    100,
  );
  property.aiReview = {
    ...(payload.aiReview || {}),
    duplicatePhotoDetected,
    suspiciousPricingAlert,
    fakeListingSignal,
    localAreaMedianPrice: peerMedianPrice,
    fraudRiskScore,
    recommendation: fakeListingSignal ? "Manual admin verification required" : "Looks normal",
  };
  property.trustScore = Math.max(30, 100 - fraudRiskScore);
  if (!isUdaipur(property.city)) return res.status(400).json({ ok: false, message: "Only Udaipur listings are allowed." });
  if (!property.title || !property.location || property.price <= 0) return res.status(400).json({ ok: false, message: "Title, location and valid price required." });
  if (photosCount < 5) return res.status(400).json({ ok: false, message: "Minimum 5 photos required for listing." });
  if (!hasVideoUpload) return res.status(400).json({ ok: false, message: "One short property video is required (30-60 sec)." });
  if (videoDurationSec < 30 || videoDurationSec > 60) return res.status(400).json({ ok: false, message: "Video duration must be between 30 and 60 seconds." });
  db.properties.unshift(property);
  db.users.filter((u) => u.role === "admin").forEach((a) => pushNoti(a.id, "New Listing Approval Required", `${property.title} submitted by ${owner.name}.`, "approval"));
  await save();
  res.status(201).json({ ok: true, property });
});

app.patch("/api/properties/:id", auth, async (req, res) => {
  const p = db.properties.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ ok: false, message: "Property not found." });
  const isOwner = p.ownerId === req.user.id;
  const isAdminUser = req.user.role === "admin";
  if (!isOwner && !isAdminUser) return res.status(403).json({ ok: false, message: "Not authorized." });
  Object.assign(p, req.body || {});
  p.updatedAt = now();
  if (!isAdminUser) { p.status = "Pending Approval"; p.verified = false; }
  await save();
  res.json({ ok: true, property: p });
});

app.delete("/api/properties/:id", auth, async (req, res) => {
  const i = db.properties.findIndex((x) => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ ok: false, message: "Property not found." });
  const p = db.properties[i];
  if (p.ownerId !== req.user.id && req.user.role !== "admin") return res.status(403).json({ ok: false, message: "Not authorized." });
  db.properties.splice(i, 1);
  await save();
  res.json({ ok: true, message: "Property deleted." });
});

app.post("/api/properties/:id/approve", auth, admin, async (req, res) => {
  const p = db.properties.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ ok: false, message: "Property not found." });
  const st = txt(req.body?.status || "Approved");
  p.status = st.toLowerCase() === "rejected" ? "Rejected" : "Approved";
  p.verified = p.status === "Approved";
  p.updatedAt = now();
  if (p.ownerId) pushNoti(p.ownerId, `Listing ${p.status}`, `${p.title} marked as ${p.status}.`, "approval");
  await save();
  res.json({ ok: true, property: p });
});

app.post("/api/properties/:id/feature", auth, admin, async (req, res) => {
  const p = db.properties.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ ok: false, message: "Property not found." });
  const days = Math.max(1, num(req.body?.days, 7));
  p.featured = true;
  p.featuredUntil = new Date(Date.now() + days * 86400000).toISOString();
  p.updatedAt = now();
  await save();
  res.json({ ok: true, property: p });
});

app.post("/api/properties/:id/visit", auth, async (req, res) => {
  const p = db.properties.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ ok: false, message: "Property not found." });
  const v = { id: nextId("visit"), propertyId: p.id, propertyTitle: p.title, customerId: req.user.id, customerName: req.user.name, preferredAt: req.body?.preferredAt || now(), note: txt(req.body?.note), status: "Scheduled", createdAt: now() };
  db.visits.unshift(v);
  if (p.ownerId) pushNoti(p.ownerId, "New Visit Request", `${req.user.name} requested visit for ${p.title}.`, "visit");
  await save();
  res.status(201).json({ ok: true, visit: v });
});

app.get("/api/visits", auth, (req, res) => {
  const items = db.visits.filter((v) => req.user.role === "admin" || v.customerId === req.user.id || db.properties.some((p) => p.id === v.propertyId && p.ownerId === req.user.id));
  res.json({ ok: true, total: items.length, items });
});

app.get("/api/admin/properties", auth, admin, (req, res) => {
  const st = txt(req.query.status).toLowerCase();
  const items = st ? db.properties.filter((p) => txt(p.status).toLowerCase() === st) : [...db.properties];
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ ok: true, total: items.length, items });
});

app.get("/api/admin/overview", auth, admin, (_req, res) => res.json({
  ok: true,
  overview: {
    users: db.users.length,
    blockedUsers: db.users.filter((u) => !!u.blocked).length,
    pending: db.properties.filter((p) => p.status === "Pending Approval").length,
    approved: db.properties.filter((p) => p.status === "Approved").length,
    featured: db.properties.filter((p) => p.featured).length,
    ownerVerificationPending: db.ownerVerificationRequests.filter((item) => item.kind === "owner-verification" && txt(item.status).toLowerCase() === "pending review").length,
    careRequests: db.careRequests.length,
    legalRequests: db.legalRequests.length,
    reports: db.reports.length,
    activeSubs: db.subscriptions.filter((s) => s.status === "active").length,
    totalBids: db.bids.length,
  },
}));

app.get("/api/cities/structure", (_req, res) => {
  const structure = getCityStructure();
  res.json({ ok: true, ...structure });
});

app.get("/api/admin/config", auth, admin, (_req, res) => res.json({ ok: true, config: db.adminConfig }));
app.get("/api/admin/config/categories", auth, admin, (_req, res) => res.json({ ok: true, items: db.adminConfig.categories }));
app.post("/api/admin/config/categories", auth, admin, async (req, res) => {
  const name = txt(req.body?.name);
  if (!name) return res.status(400).json({ ok: false, message: "Category name required." });
  if (!db.adminConfig.categories.some((x) => x.toLowerCase() === name.toLowerCase())) db.adminConfig.categories.push(name);
  await save();
  res.json({ ok: true, items: db.adminConfig.categories });
});

app.get("/api/admin/config/cities", auth, admin, (_req, res) => res.json({ ok: true, items: db.adminConfig.cities }));
app.post("/api/admin/config/cities", auth, admin, async (req, res) => {
  const city = txt(req.body?.city);
  if (!city) return res.status(400).json({ ok: false, message: "City name required." });
  if (!db.adminConfig.cities.some((x) => x.toLowerCase() === city.toLowerCase())) db.adminConfig.cities.push(city);
  await save();
  res.json({ ok: true, items: db.adminConfig.cities });
});

app.get("/api/admin/owner-verification", auth, admin, (req, res) => {
  const statusFilter = txt(req.query.status).toLowerCase();
  let items = db.ownerVerificationRequests.filter((item) => item.kind === "owner-verification");
  if (statusFilter) items = items.filter((item) => txt(item.status).toLowerCase() === statusFilter);
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ ok: true, total: items.length, items });
});
app.post("/api/admin/owner-verification/:id/decision", auth, admin, async (req, res) => {
  const requestItem = db.ownerVerificationRequests.find((item) => item.id === req.params.id && item.kind === "owner-verification");
  if (!requestItem) return res.status(404).json({ ok: false, message: "Owner verification request not found." });
  const action = txt(req.body?.status || req.body?.action).toLowerCase();
  const mappedStatus = ({
    verify: "Verified",
    verified: "Verified",
    approve: "Verified",
    approved: "Verified",
    reject: "Rejected",
    rejected: "Rejected",
    "needs-info": "Needs Info",
    needsinfo: "Needs Info",
    pending: "Pending Review",
  })[action];
  if (!mappedStatus) {
    return res.status(400).json({ ok: false, message: "Valid decision required: verified/rejected/needs-info/pending." });
  }

  requestItem.status = mappedStatus;
  requestItem.reviewedBy = req.user.id;
  requestItem.reviewedByName = req.user.name;
  requestItem.reviewNote = txt(req.body?.note);
  requestItem.updatedAt = now();

  const user = userById(requestItem.userId);
  if (user) {
    user.ownerVerified = mappedStatus === "Verified";
    user.ownerVerificationStatus = mappedStatus;
    user.ownerVerificationUpdatedAt = now();
    user.updatedAt = now();
    pushNoti(user.id, "Owner Verification Update", `Your owner verification status is now: ${mappedStatus}.`, "verification");
  }

  if (requestItem.propertyId) {
    const property = db.properties.find((item) => item.id === requestItem.propertyId);
    if (property) {
      property.verification = {
        ...(property.verification || {}),
        ownerAadhaarPanStatus: mappedStatus === "Verified" ? "Verified" : (property.verification?.ownerAadhaarPanStatus || "Submitted"),
        addressVerificationStatus: mappedStatus === "Verified" ? "Verified" : (property.verification?.addressVerificationStatus || "Submitted"),
        badgeEligible: mappedStatus === "Verified" ? !!requestItem.privateDocsUploaded : false,
      };
      if (mappedStatus === "Verified") {
        property.verifiedByPropertySetu = !!requestItem.privateDocsUploaded;
        property.verified = true;
      }
      property.updatedAt = now();
    }
  }

  await save();
  res.json({ ok: true, request: requestItem, user: user ? userSafe(user) : null });
});

app.get("/api/admin/users", auth, admin, (_req, res) => {
  const items = db.users.map((u) => ({ ...userSafe(u), blocked: !!u.blocked, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt || null }));
  res.json({ ok: true, total: items.length, items });
});
app.post("/api/admin/users/:id/block", auth, admin, async (req, res) => {
  const u = userById(req.params.id);
  if (!u) return res.status(404).json({ ok: false, message: "User not found." });
  u.blocked = true;
  u.updatedAt = now();
  await save();
  res.json({ ok: true, message: "User blocked." });
});
app.post("/api/admin/users/:id/unblock", auth, admin, async (req, res) => {
  const u = userById(req.params.id);
  if (!u) return res.status(404).json({ ok: false, message: "User not found." });
  u.blocked = false;
  u.updatedAt = now();
  await save();
  res.json({ ok: true, message: "User unblocked." });
});

app.get("/api/admin/commission-analytics", auth, admin, (_req, res) => {
  const paid = db.subscriptions.filter((s) => num(s.amount, 0) > 0);
  const revenue = paid.reduce((sum, item) => sum + num(item.amount, 0), 0);
  const featuredListingRevenue = paid.filter((s) => s.type === "featured").reduce((sum, item) => sum + num(item.amount, 0), 0);
  const verifiedBadgeRevenue = paid.filter((s) => s.type === "verification" || s.planId === "verified-badge-charge").reduce((sum, item) => sum + num(item.amount, 0), 0);
  const agentMembershipRevenue = paid.filter((s) => s.type === "agent").reduce((sum, item) => sum + num(item.amount, 0), 0);
  const propertyCareRevenue = paid.filter((s) => s.type === "care").reduce((sum, item) => sum + num(item.amount, 0), 0);
  const subscriptionModelRevenue = paid.filter((s) => !["featured", "verification", "agent", "care"].includes(s.type)).reduce((sum, item) => sum + num(item.amount, 0), 0);
  const documentationServiceFeeRevenue = db.legalRequests.reduce((sum, item) => sum + num(item.amount, 0), 0);
  const estimatedCommission = Math.round(db.properties.filter((p) => p.status === "Approved").length * 2500);
  const totalMonetized = featuredListingRevenue + verifiedBadgeRevenue + subscriptionModelRevenue + agentMembershipRevenue + propertyCareRevenue + documentationServiceFeeRevenue + estimatedCommission;
  res.json({
    ok: true,
    analytics: {
      paidSubscriptions: paid.length,
      subscriptionRevenue: revenue,
      legalServiceRevenue: documentationServiceFeeRevenue,
      featuredListingRevenue,
      verifiedBadgeRevenue,
      subscriptionModelRevenue,
      agentMembershipRevenue,
      propertyCareRevenue,
      documentationServiceFeeRevenue,
      estimatedCommission,
      totalMonetized,
    },
  });
});

app.post("/api/reviews", auth, async (req, res) => {
  const propertyId = txt(req.body?.propertyId);
  const p = db.properties.find((x) => x.id === propertyId);
  if (!p) return res.status(404).json({ ok: false, message: "Property not found." });
  if (db.reviews.some((r) => r.propertyId === propertyId && r.userId === req.user.id)) return res.status(409).json({ ok: false, message: "You already reviewed this property." });
  const rating = Math.min(5, Math.max(1, num(req.body?.rating, 0)));
  if (!rating) return res.status(400).json({ ok: false, message: "Rating between 1-5 required." });
  const r = { id: nextId("review"), propertyId, userId: req.user.id, userName: req.user.name, rating, propertyAccuracy: Math.min(5, Math.max(1, num(req.body?.propertyAccuracy, rating))), ownerBehavior: Math.min(5, Math.max(1, num(req.body?.ownerBehavior, rating))), agentService: Math.min(5, Math.max(1, num(req.body?.agentService, rating))), comment: txt(req.body?.comment), createdAt: now() };
  db.reviews.unshift(r);
  const all = db.reviews.filter((x) => x.propertyId === propertyId);
  p.reviewCount = all.length;
  p.averageRating = Number((all.reduce((s, x) => s + x.rating, 0) / all.length).toFixed(2));
  await save();
  res.status(201).json({ ok: true, review: r });
});

app.get("/api/reviews/:propertyId", (req, res) => {
  const items = db.reviews.filter((r) => r.propertyId === req.params.propertyId);
  const average = items.length ? Number((items.reduce((s, x) => s + x.rating, 0) / items.length).toFixed(2)) : 0;
  const propertyAccuracyAvg = items.length ? Number((items.reduce((s, x) => s + num(x.propertyAccuracy, 0), 0) / items.length).toFixed(2)) : 0;
  const ownerBehaviorAvg = items.length ? Number((items.reduce((s, x) => s + num(x.ownerBehavior, 0), 0) / items.length).toFixed(2)) : 0;
  const agentServiceAvg = items.length ? Number((items.reduce((s, x) => s + num(x.agentService, 0), 0) / items.length).toFixed(2)) : 0;
  res.json({
    ok: true,
    total: items.length,
    average,
    matrix: {
      propertyAccuracy: propertyAccuracyAvg,
      ownerBehavior: ownerBehaviorAvg,
      agentService: agentServiceAvg,
    },
    items,
  });
});

app.post("/api/chat/send", auth, async (req, res) => {
  const propertyId = txt(req.body?.propertyId);
  const message = txt(req.body?.message);
  if (!propertyId || !message) return res.status(400).json({ ok: false, message: "propertyId and message required." });
  if (message.length > 500) return res.status(400).json({ ok: false, message: "Message too long. Max 500 chars." });
  if (hasDirectContact(message)) {
    return res.status(400).json({ ok: false, message: "Direct phone/email sharing blocked. Use in-app chat or call masking." });
  }
  const spamWords = ["earn money fast", "click here", "crypto double", "free gift", "urgent transfer", "loan approved instant", "guaranteed return"];
  if (spamWords.some((w) => message.toLowerCase().includes(w))) return res.status(400).json({ ok: false, message: "Message blocked by anti-spam filter." });
  const oneMinuteAgo = Date.now() - 60 * 1000;
  const recentCount = db.messages.filter((m) => m.senderId === req.user.id && new Date(m.createdAt).getTime() >= oneMinuteAgo).length;
  if (recentCount >= 5) return res.status(429).json({ ok: false, message: "Too many messages. Please wait a minute." });
  const p = db.properties.find((x) => x.id === propertyId);
  if (!p) return res.status(404).json({ ok: false, message: "Property not found." });
  const receiverId = txt(req.body?.receiverId || p.ownerId);
  const receiver = userById(receiverId);
  if (!receiver) return res.status(404).json({ ok: false, message: "Receiver not found." });
  const m = { id: nextId("message"), propertyId, senderId: req.user.id, senderName: req.user.name, receiverId: receiver.id, receiverName: receiver.name, message, createdAt: now() };
  db.messages.push(m);
  pushNoti(receiver.id, "New Message", `New chat on ${p.title}.`, "chat");
  await save();
  res.status(201).json({ ok: true, record: m });
});

app.get("/api/chat/:propertyId", auth, (req, res) => {
  const isAdmin = req.user.role === "admin";
  const items = db.messages.filter((m) => m.propertyId === req.params.propertyId).filter((m) => isAdmin || m.senderId === req.user.id || m.receiverId === req.user.id).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  res.json({ ok: true, total: items.length, items });
});

app.get("/api/subscriptions/plans", (_req, res) => res.json({ ok: true, items: plans }));
app.post("/api/subscriptions/activate", auth, async (req, res) => {
  const planId = txt(req.body?.planId);
  const pl = plans.find((p) => p.id === planId);
  if (!pl) return res.status(404).json({ ok: false, message: "Plan not found." });
  const targetPropertyId = txt(req.body?.propertyId);
  const sub = { id: nextId("subscription"), userId: req.user.id, userName: req.user.name, planId: pl.id, planName: pl.name, amount: pl.amount, type: pl.type, targetPropertyId: targetPropertyId || null, status: "active", startDate: now(), endDate: new Date(Date.now() + pl.cycleDays * 86400000).toISOString(), createdAt: now() };
  db.subscriptions.unshift(sub);
  const u = userById(req.user.id);
  if (u && pl.type !== "care") u.subscriptionPlan = pl.id;
  if (pl.type === "featured" && targetPropertyId) {
    const p = db.properties.find((x) => x.id === targetPropertyId);
    if (p) { p.featured = true; p.featuredUntil = sub.endDate; p.updatedAt = now(); }
  }
  pushNoti(req.user.id, "Subscription Activated", `${pl.name} activated successfully.`, "subscription");
  await save();
  res.status(201).json({ ok: true, subscription: sub });
});
app.get("/api/subscriptions/me", auth, (req, res) => {
  const items = db.subscriptions.filter((s) => s.userId === req.user.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ ok: true, total: items.length, items });
});

app.post("/api/property-care/requests", auth, async (req, res) => {
  const planId = txt(req.body?.planId || req.body?.plan || "care-basic");
  const pl = plans.find((p) => p.id === planId) || { id: planId, name: planId, amount: 0 };
  const r = { id: nextId("care"), userId: req.user.id, userName: req.user.name, planId: pl.id, planName: pl.name, amount: pl.amount, propertyId: txt(req.body?.propertyId), location: txt(req.body?.location || "Udaipur"), preferredDate: req.body?.preferredDate || "", notes: txt(req.body?.notes), status: "Requested", createdAt: now() };
  db.careRequests.unshift(r);
  await save();
  res.status(201).json({ ok: true, request: r });
});
app.get("/api/property-care/requests", auth, (req, res) => {
  const items = req.user.role === "admin" ? [...db.careRequests] : db.careRequests.filter((r) => r.userId === req.user.id);
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ ok: true, total: items.length, items });
});

app.get("/api/legal/templates", (_req, res) => res.json({ ok: true, items: legalTemplates }));
app.post("/api/legal/requests", auth, async (req, res) => {
  const templateId = txt(req.body?.templateId);
  const t = legalTemplates.find((x) => x.id === templateId) || { id: templateId, name: txt(req.body?.templateName || "Custom Legal Help"), fee: num(req.body?.amount, 0) };
  const r = { id: nextId("legal"), userId: req.user.id, userName: req.user.name, templateId: t.id, templateName: t.name, amount: t.fee, details: txt(req.body?.details), status: "Requested", createdAt: now() };
  db.legalRequests.unshift(r);
  await save();
  res.status(201).json({ ok: true, request: r });
});
app.get("/api/legal/requests", auth, (req, res) => {
  const items = req.user.role === "admin" ? [...db.legalRequests] : db.legalRequests.filter((r) => r.userId === req.user.id);
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ ok: true, total: items.length, items });
});

app.get("/api/insights/locality", (req, res) => {
  const payload = getLocalityInsightsPayload(req.query.name || "Udaipur");
  res.json({ ok: true, ...payload });
});

app.get("/api/ai/market-trend", (req, res) => {
  const payload = getLocalityInsightsPayload(req.query.locality || req.query.name || "Udaipur");
  res.json({
    ok: true,
    locality: payload?.stats?.locality || "Udaipur",
    stats: payload.stats,
    trend: payload.trend,
    source: "live-ai-market-trend",
  });
});

app.post("/api/ai/pricing-suggestion", (req, res) => {
  const payload = getAiPricingSuggestionPayload({
    locality: req.body?.locality || req.body?.location || "Udaipur",
    expectedPrice: req.body?.price,
  });
  res.json({ ok: true, ...payload });
});

app.post("/api/ai/description-generate", (req, res) => {
  const description = buildAiDescription(req.body || {});
  res.json({
    ok: true,
    description,
    source: "live-ai-description-generator",
  });
});

app.post("/api/ai/fraud-scan", (req, res) => {
  const scan = evaluateFraudSignals(req.body || {});
  res.json({
    ok: true,
    scan,
    source: "live-ai-fraud-scan",
  });
});

app.get("/api/recommendations", (req, res) => {
  const payload = getRecommendationItems({
    locality: req.query.locality,
    category: req.query.category,
    excludeId: req.query.excludeId,
    targetPrice: req.query.price,
    limit: req.query.limit,
  });
  res.json({ ok: true, ...payload });
});

app.get("/api/ai/recommendations", (req, res) => {
  const payload = getRecommendationItems({
    locality: req.query.locality,
    category: req.query.category,
    excludeId: req.query.excludeId,
    targetPrice: req.query.price,
    limit: req.query.limit,
  });
  res.json({ ok: true, ...payload, source: "live-ai-recommendation-engine" });
});

app.get("/api/agents", (_req, res) => {
  const items = db.trustedAgents.map(agentWithMetrics);
  res.json({ ok: true, total: items.length, items });
});

app.get("/api/agents/:id/reviews", (req, res) => {
  const agentId = txt(req.params.id);
  const items = db.agentReviews
    .filter((item) => item.agentId === agentId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const average = items.length ? Number((items.reduce((sum, item) => sum + num(item.rating, 0), 0) / items.length).toFixed(2)) : 0;
  res.json({ ok: true, total: items.length, average, items });
});

app.post("/api/agents/:id/reviews", auth, async (req, res) => {
  const agentId = txt(req.params.id);
  const agent = db.trustedAgents.find((item) => item.id === agentId);
  if (!agent) return res.status(404).json({ ok: false, message: "Agent not found." });
  if (db.agentReviews.some((item) => item.agentId === agentId && item.userId === req.user.id)) {
    return res.status(409).json({ ok: false, message: "You already reviewed this agent." });
  }
  const rating = Math.min(5, Math.max(1, num(req.body?.rating, 0)));
  if (!rating) return res.status(400).json({ ok: false, message: "Rating between 1-5 required." });
  const review = {
    id: nextId("agentReview"),
    agentId,
    userId: req.user.id,
    userName: req.user.name,
    rating,
    comment: txt(req.body?.comment),
    createdAt: now(),
  };
  db.agentReviews.unshift(review);
  db.users.filter((u) => u.role === "admin").forEach((a) => pushNoti(a.id, "Agent Review Submitted", `${req.user.name} rated ${agent.name}.`, "review"));
  await save();
  res.status(201).json({ ok: true, review, agent: agentWithMetrics(agent) });
});

app.post("/api/call-mask/request", auth, async (req, res) => {
  const propertyId = txt(req.body?.propertyId);
  const agentId = txt(req.body?.agentId);
  const reason = txt(req.body?.reason || "Call request via masked communication flow");
  if (!propertyId && !agentId) {
    return res.status(400).json({ ok: false, message: "propertyId or agentId required for call masking." });
  }

  let propertyTitle = "";
  let ownerId = "";
  if (propertyId) {
    const p = db.properties.find((item) => item.id === propertyId);
    if (!p) return res.status(404).json({ ok: false, message: "Property not found for call mask request." });
    propertyTitle = p.title;
    ownerId = p.ownerId || "";
  }
  if (agentId && !db.trustedAgents.some((item) => item.id === agentId)) {
    return res.status(404).json({ ok: false, message: "Agent not found for call mask request." });
  }

  const id = nextId("callMask");
  const serial = String(num(String(id).split("-")[1], 0)).padStart(4, "0").slice(-4);
  const record = {
    id,
    userId: req.user.id,
    userName: req.user.name,
    propertyId: propertyId || null,
    propertyTitle: propertyTitle || null,
    agentId: agentId || null,
    reason,
    maskedNumber: `+91-98XXXX${serial}`,
    accessToken: `MASK-${serial}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
    status: "active",
    expiresAt: new Date(Date.now() + 30 * 60000).toISOString(),
    createdAt: now(),
  };
  db.callMaskRequests.unshift(record);
  if (ownerId) pushNoti(ownerId, "Masked Call Request", `${req.user.name} requested masked call for ${propertyTitle}.`, "call-mask");
  db.users.filter((u) => u.role === "admin").forEach((a) => pushNoti(a.id, "Masked Call Request", `${req.user.name} created a masked call request.`, "call-mask"));
  await save();
  res.status(201).json({
    ok: true,
    request: record,
    policy: "No direct public phone display. Calls routed through masked relay token.",
  });
});

app.get("/api/call-mask/mine", auth, (req, res) => {
  const items = req.user.role === "admin"
    ? [...db.callMaskRequests]
    : db.callMaskRequests.filter((item) => item.userId === req.user.id);
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ ok: true, total: items.length, items });
});

app.post("/api/reports", auth, async (req, res) => {
  const propertyId = txt(req.body?.propertyId);
  const reason = txt(req.body?.reason);
  if (!propertyId || !reason) return res.status(400).json({ ok: false, message: "propertyId and reason required." });
  const p = db.properties.find((x) => x.id === propertyId);
  if (!p) return res.status(404).json({ ok: false, message: "Property not found." });
  const report = { id: nextId("report"), propertyId, propertyTitle: p.title, reportedBy: req.user.id, reportedByName: req.user.name, reason, status: "open", createdAt: now() };
  db.reports.unshift(report);
  db.users.filter((u) => u.role === "admin").forEach((a) => pushNoti(a.id, "New Listing Report", `Report received for ${p.title}.`, "report"));
  await save();
  res.status(201).json({ ok: true, report });
});
app.get("/api/admin/reports", auth, admin, (_req, res) => {
  res.json({ ok: true, total: db.reports.length, items: db.reports });
});
app.post("/api/admin/reports/:id/resolve", auth, admin, async (req, res) => {
  const report = db.reports.find((r) => r.id === req.params.id);
  if (!report) return res.status(404).json({ ok: false, message: "Report not found." });
  report.status = "resolved";
  report.resolvedAt = now();
  await save();
  res.json({ ok: true, report });
});

app.post("/api/token-payments/slot", auth, async (req, res) => {
  const propertyId = txt(req.body?.propertyId);
  const amount = num(req.body?.amount, 0);
  if (!propertyId || amount <= 0) return res.status(400).json({ ok: false, message: "propertyId and positive amount required." });
  const p = db.properties.find((x) => x.id === propertyId);
  if (!p) return res.status(404).json({ ok: false, message: "Property not found." });
  const record = { id: nextId("token"), propertyId, propertyTitle: p.title, userId: req.user.id, userName: req.user.name, amount, status: "SlotBooked", createdAt: now() };
  db.tokenPayments.unshift(record);
  await save();
  res.status(201).json({ ok: true, slot: record });
});
app.get("/api/token-payments/mine", auth, (req, res) => {
  const items = req.user.role === "admin" ? db.tokenPayments : db.tokenPayments.filter((x) => x.userId === req.user.id);
  res.json({ ok: true, total: items.length, items });
});

app.get("/api/insurance/tieups", (_req, res) => res.json({ ok: true, items: db.insuranceTieups }));
app.post("/api/insurance/tieups", auth, async (req, res) => {
  const company = txt(req.body?.company);
  const contact = txt(req.body?.contact);
  const notes = txt(req.body?.notes);
  const tieupType = txt(req.body?.tieupType || "insurance-security");
  const coverageType = txt(req.body?.coverageType || "");
  const coverageAmount = num(req.body?.coverageAmount, 0);
  const tenantDamageProtection = !!req.body?.tenantDamageProtection;
  if (!company) return res.status(400).json({ ok: false, message: "Company name required." });
  const record = {
    id: nextId("insurance"),
    company,
    contact,
    notes,
    tieupType,
    coverageType,
    coverageAmount,
    tenantDamageProtection,
    userId: req.user.id,
    userName: req.user.name,
    createdAt: now(),
  };
  db.insuranceTieups.unshift(record);
  db.users.filter((u) => u.role === "admin").forEach((a) => pushNoti(a.id, "New Insurance/Security Tie-up", `${company} submitted a ${tieupType} tie-up.`, "insurance"));
  await save();
  res.status(201).json({ ok: true, tieup: record });
});

app.get("/api/insurance/tenant-damage", (_req, res) => res.json({ ok: true, items: db.tenantDamageRequests }));
app.post("/api/insurance/tenant-damage", auth, async (req, res) => {
  const propertyId = txt(req.body?.propertyId);
  const locality = txt(req.body?.locality);
  const issueType = txt(req.body?.issueType || "tenant-damage-protection");
  const expectedCoverage = num(req.body?.expectedCoverage, 0);
  const notes = txt(req.body?.notes);
  if (!propertyId && !locality) return res.status(400).json({ ok: false, message: "Property ID or locality required." });
  if (expectedCoverage <= 0) return res.status(400).json({ ok: false, message: "Expected coverage amount required." });
  const record = {
    id: nextId("tenantDamage"),
    propertyId: propertyId || null,
    locality: locality || null,
    issueType,
    expectedCoverage,
    notes,
    status: "open",
    userId: req.user.id,
    userName: req.user.name,
    createdAt: now(),
  };
  db.tenantDamageRequests.unshift(record);
  db.users.filter((u) => u.role === "admin").forEach((a) => pushNoti(a.id, "New Tenant Damage Protection Request", `${req.user.name} requested tenant damage protection coverage.`, "insurance"));
  await save();
  res.status(201).json({ ok: true, request: record });
});

app.post("/api/sealed-bids", auth, async (req, res) => {
  const propertyId = txt(req.body?.propertyId);
  const p = db.properties.find((x) => x.id === propertyId);
  if (!p) return res.status(404).json({ ok: false, message: "Property not found." });
  const amount = num(req.body?.amount, 0);
  if (amount <= 0) return res.status(400).json({ ok: false, message: "Valid positive bid amount required." });
  const b = { id: nextId("bid"), propertyId, propertyTitle: p.title, amount, bidderId: req.user.id, bidderName: req.user.name, bidderRole: req.user.role, status: "Submitted", createdAt: now() };
  db.bids.push(b);
  await save();
  res.status(201).json({ ok: true, bidId: b.id });
});
app.get("/api/sealed-bids/mine", auth, (req, res) => {
  const items = db.bids.filter((b) => b.bidderId === req.user.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ ok: true, total: items.length, items });
});
app.get("/api/sealed-bids/summary", (_req, res) => {
  const map = new Map();
  db.bids.forEach((b) => map.set(b.propertyId, { propertyId: b.propertyId, propertyTitle: b.propertyTitle, totalBids: num(map.get(b.propertyId)?.totalBids, 0) + 1, status: b.status || "Submitted" }));
  res.json({ ok: true, items: [...map.values()] });
});
app.get("/api/sealed-bids/reveal", auth, admin, (req, res) => {
  const grouped = new Map();
  db.bids.forEach((b) => grouped.set(b.propertyId, [...(grouped.get(b.propertyId) || []), b]));
  const winners = [...grouped.entries()].map(([propertyId, bids]) => {
    const sorted = [...bids].sort((a, b) => b.amount - a.amount);
    return { propertyId, propertyTitle: sorted[0].propertyTitle, winnerBid: sorted[0], totalBids: sorted.length };
  });
  res.json({ ok: true, totalProperties: winners.length, winners });
});
app.post("/api/sealed-bids/decision", auth, admin, async (req, res) => {
  const propertyId = txt(req.body?.propertyId);
  const action = txt(req.body?.action).toLowerCase();
  if (!propertyId || !["accept", "reject", "reveal"].includes(action)) return res.status(400).json({ ok: false, message: "propertyId and valid action required." });
  const items = db.bids.filter((b) => b.propertyId === propertyId);
  if (!items.length) return res.status(404).json({ ok: false, message: "No bids found for property." });
  const sorted = [...items].sort((a, b) => b.amount - a.amount);
  const winner = sorted[0];

  if (action === "accept") {
    items.forEach((b) => { b.status = b.id === winner.id ? "Accepted" : "Rejected"; b.updatedAt = now(); });
  } else if (action === "reject") {
    items.forEach((b) => { b.status = "Rejected"; b.updatedAt = now(); });
  } else {
    items.forEach((b) => { if (b.id === winner.id) b.status = "Revealed"; b.updatedAt = now(); });
  }

  await save();
  res.json({ ok: true, action, propertyId, winnerBid: winner, totalBids: items.length, items });
});

app.get("/api/notifications", auth, (req, res) => {
  const items = db.notifications.filter((n) => n.userId === req.user.id).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ ok: true, total: items.length, items });
});
app.post("/api/notifications/:id/read", auth, async (req, res) => {
  const n = db.notifications.find((x) => x.id === req.params.id && x.userId === req.user.id);
  if (!n) return res.status(404).json({ ok: false, message: "Notification not found." });
  n.isRead = true;
  await save();
  res.json({ ok: true, message: "Marked as read." });
});

app.get("/api/bootstrap", (_req, res) => res.json({ ok: true, plans, legalTemplates, localities: fallbackLocalities, categories: db.adminConfig.categories, cities: db.adminConfig.cities }));
app.get("/api/export", auth, admin, (_req, res) => res.json({ ok: true, exportedAt: now(), data: db }));

liveRouteMap.forEach((routeItem) => {
  app.get(routeItem.path, (_req, res) => res.sendFile(resolveWebFile(routeItem.file)));
});

app.use("/api", (_req, res) => res.status(404).json({ ok: false, message: "API route not found." }));
app.get("*", (_req, res) => res.sendFile(resolveWebFile("index.html")));

await load();
if (!db.users.some((u) => u.role === "admin")) {
  db.users.push({ id: nextId("user"), role: "admin", name: "PropertySetu Admin", email: "admin@propertysetu.in", mobile: "9999999999", passwordHash: await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD || "Admin@123", 10), verified: true, subscriptionPlan: "agent-pro", createdAt: now(), updatedAt: now(), lastLoginAt: null });
  await save();
}

app.listen(PORT, () => {
  console.log(`PropertySetu server running on http://localhost:${PORT}`);
});
