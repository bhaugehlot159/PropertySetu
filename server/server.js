import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import {
  applyProSecurityControlProfile,
  createProSafeStaticOptions,
  listProSecurityControlProfiles,
  proAiThreatAutoDetector,
  createProCorsOptions,
  getProSecurityControlState,
  isValidProSecurityThreatFingerprint,
  normalizeProSecurityThreatFingerprint,
  quarantineProSecurityThreatProfile,
  resetProSecurityControlState,
  releaseProSecurityThreatProfile,
  getProSecurityThreatIntelligence,
  getProSecurityAuditEvents,
  proAuthFailureIntelligence,
  proFakeListingAiGuard,
  proApiPayloadGuard,
  proApiRateLimiter,
  proAttachRequestContext,
  proAuthRateLimiter,
  proBlockSensitivePublicFiles,
  proRequestFirewall,
  updateProSecurityControlState,
  proTokenFirewall,
  proSecurityHeaders
} from "./middleware/proSecurityMiddleware.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5000);
const NODE_ENV = String(process.env.NODE_ENV || "development").trim().toLowerCase();
const configuredJwtSecret = String(process.env.JWT_SECRET || "").trim();
if (!configuredJwtSecret && NODE_ENV === "production") {
  throw new Error("JWT_SECRET is required in production mode.");
}
const JWT_SECRET = configuredJwtSecret || "propertysetu-dev-secret";
const JWT_ISSUER = String(process.env.JWT_ISSUER || "propertysetu-api").trim();
const JWT_AUDIENCE = String(process.env.JWT_AUDIENCE || "propertysetu-clients").trim();
const JWT_ISSUERS = [
  JWT_ISSUER,
  String(process.env.CORE_JWT_ISSUER || "propertysetu-core-api").trim(),
].filter(Boolean);
const JWT_AUDIENCES = [
  JWT_AUDIENCE,
  String(process.env.CORE_JWT_AUDIENCE || "propertysetu-core-clients").trim(),
].filter(Boolean);
const JWT_EXPIRES_IN = String(process.env.JWT_EXPIRES_IN || "24h").trim();
const OTP = "123456";
const EXPOSE_OTP_HINT =
  String(process.env.EXPOSE_OTP_HINT || "").trim().toLowerCase() === "true" ||
  NODE_ENV !== "production";
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
  { path: "/ecosystem-services", file: "pages/ecosystem-services.html", feature: "ecosystem-services", live: true },
  { path: "/startup-revenue-engine", file: "pages/startup-revenue-engine.html", feature: "startup-revenue-engine", live: true },
  { path: "/live-platform-app", file: "pages/live-platform-app.html", feature: "full-stack-live-app", live: true },
  { path: "/part-2-live-stack", file: "pages/live-platform-app.html", feature: "part-2-full-stack-proof", live: true },
  { path: "/add-property", file: "add-property.html", feature: "listing-upload", live: true },
  { path: "/property-details", file: "property-details.html", feature: "property-details", live: true },
  { path: "/customer-dashboard", file: "user-dashboard.html", feature: "customer-dashboard", live: true },
  { path: "/admin-dashboard", file: "admin-dashboard.html", feature: "admin-dashboard", live: true },
  { path: "/admin-simple", file: "admin-simple.html", feature: "admin-simple", live: true },
  { path: "/seller-dashboard", file: "seller-dashboard.html", feature: "seller-dashboard", live: true },
  { path: "/jaipur", file: "pages/city-expansion.html", feature: "future-city-route", live: false },
  { path: "/jodhpur", file: "pages/city-expansion.html", feature: "future-city-route", live: false },
  { path: "/ahmedabad", file: "pages/city-expansion.html", feature: "future-city-route", live: false },
  { path: "/delhi", file: "pages/city-expansion.html", feature: "future-city-route", live: false },
];

const plans = [
  { id: "free-basic", name: "Free Basic Listing", amount: 0, cycleDays: 30, type: "listing" },
  {
    id: "basic-plan",
    name: "Basic Subscription",
    amount: 1499,
    cycleDays: 30,
    type: "subscription",
    highlights: ["Up to 5 active listings", "Basic support", "Standard ranking"],
  },
  {
    id: "pro-plan",
    name: "Pro Subscription",
    amount: 3999,
    cycleDays: 30,
    type: "subscription",
    highlights: ["Up to 20 active listings", "Priority support", "Seller analytics access"],
  },
  {
    id: "premium-plan",
    name: "Premium Subscription",
    amount: 7999,
    cycleDays: 30,
    type: "subscription",
    highlights: ["Unlimited active listings", "Top priority support", "Higher lead boost and concierge support"],
  },
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

const featuredPlanDefaults = {
  "featured-7": { label: "Featured Listing - 7 Days", amount: 299, cycleDays: 7 },
  "featured-30": { label: "Featured Listing - 30 Days", amount: 999, cycleDays: 30 },
};

const normalizeFeaturedPricingConfig = (incoming = {}) => {
  const output = {};
  Object.entries(featuredPlanDefaults).forEach(([planId, defaultsForPlan]) => {
    const raw = incoming && typeof incoming === "object" ? incoming[planId] : null;
    const amount = Number(raw?.amount);
    const cycleDays = Number(raw?.cycleDays);
    const label = String(raw?.label || defaultsForPlan.label || "").trim();
    output[planId] = {
      label,
      amount: Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : defaultsForPlan.amount,
      cycleDays: Number.isFinite(cycleDays) ? Math.max(1, Math.round(cycleDays)) : defaultsForPlan.cycleDays,
    };
  });
  return output;
};

const applyFeaturedPricingToPlans = (config = {}) => {
  const normalized = normalizeFeaturedPricingConfig(config);
  plans.forEach((plan) => {
    if (plan.type !== "featured") return;
    const matched = normalized[plan.id];
    if (!matched) return;
    plan.amount = matched.amount;
    plan.cycleDays = matched.cycleDays;
    const label = String(matched.label || "").trim();
    if (label) plan.name = label;
  });
};

const featuredPricingSnapshotFromPlans = () =>
  plans
    .filter((plan) => plan.type === "featured")
    .reduce((acc, plan) => {
      acc[plan.id] = {
        label: String(plan.name || "").trim(),
        amount: Number.isFinite(Number(plan.amount)) ? Number(plan.amount) : 0,
        cycleDays: Math.max(1, Number.isFinite(Number(plan.cycleDays)) ? Number(plan.cycleDays) : 7),
      };
      return acc;
    }, {});

const legalTemplates = [
  { id: "sale-agreement", name: "Sale Agreement Draft", fee: 999 },
  { id: "rent-agreement", name: "Rent Agreement Template", fee: 499 },
  { id: "registry-support", name: "Registry Support (Appointment + Checklist)", fee: 2499 },
  { id: "legal-help-desk", name: "Legal Help Desk Consultation", fee: 1499 },
  { id: "stamp-duty-guide", name: "Stamp Duty Guidance", fee: 299 },
  { id: "lawyer-connect", name: "Local Lawyer Connect", fee: 1499 },
];

const documentationServices = [
  { id: "agreement-service", name: "Agreement Drafting Service", category: "agreement", fee: 1299, slaHours: 24 },
  { id: "registry-service", name: "Registry Support Service", category: "registry", fee: 2499, slaHours: 48 },
  { id: "legal-help-service", name: "Legal Help Service", category: "legal", fee: 1499, slaHours: 24 },
];

const loanPartnerBanks = [
  { id: "hdfc", name: "HDFC Bank", homeLoanRateStart: "8.40%", maxLtvPercent: 80, commissionPercent: 0.45 },
  { id: "sbi", name: "State Bank of India", homeLoanRateStart: "8.35%", maxLtvPercent: 80, commissionPercent: 0.4 },
  { id: "icici", name: "ICICI Bank", homeLoanRateStart: "8.50%", maxLtvPercent: 80, commissionPercent: 0.5 },
  { id: "axis", name: "Axis Bank", homeLoanRateStart: "8.55%", maxLtvPercent: 75, commissionPercent: 0.45 },
];

const ecosystemServiceCatalog = [
  { id: "movers-packers", name: "Movers & Packers Booking", category: "relocation", baseFee: 799 },
  { id: "interior-designer", name: "Interior Designer Booking", category: "interior", baseFee: 1499 },
  { id: "property-valuation", name: "Property Valuation Tool", category: "valuation", baseFee: 0 },
  { id: "rent-agreement-generator", name: "Rent Agreement Generator", category: "legal-tool", baseFee: 299 },
  { id: "franchise", name: "Franchise Interest Program", category: "growth", baseFee: 0 },
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
  documentationRequests: [],
  visits: [],
  bids: [],
  reports: [],
  tokenPayments: [],
  insuranceTieups: [],
  tenantDamageRequests: [],
  loanAssistanceLeads: [],
  servicePartnerBookings: [],
  valuationRequests: [],
  rentAgreementDrafts: [],
  franchiseRequests: [],
  ownerVerificationRequests: [],
  uploads: [],
  callMaskRequests: [],
  notifications: [],
  adminConfig: {
    categories: ["House", "Flat", "Villa", "Plot", "Agriculture Land", "Commercial", "Warehouse", "Farm House", "PG / Hostel"],
    cities: ["Udaipur", "Jaipur", "Jodhpur", "Ahmedabad", "Delhi", "Mumbai"],
    featuredPricing: normalizeFeaturedPricingConfig(),
  },
  trustedAgents: [
    { id: "agent-1", name: "Udaipur Prime Realty", area: "Hiran Magri", verified: true, rating: 4.6, reviewCount: 12, transparentCommission: "1.5%" },
    { id: "agent-2", name: "Mewar Property Desk", area: "Pratap Nagar", verified: true, rating: 4.4, reviewCount: 9, transparentCommission: "2%" },
  ],
  counters: {
    user: 1,
    property: 100,
    review: 1,
    message: 1,
    subscription: 1,
    care: 1,
    legal: 1,
    documentation: 1,
    visit: 1,
    bid: 1,
    notification: 1,
    report: 1,
    token: 1,
    insurance: 1,
    tenantDamage: 1,
    loan: 1,
    partnerBooking: 1,
    valuation: 1,
    rentAgreement: 1,
    franchise: 1,
    ownerVerification: 1,
    otp: 1,
    upload: 1,
    agentReview: 1,
    callMask: 1,
  },
});

let db = defaults();
let writeQ = Promise.resolve();

const txt = (v) => String(v || "").trim();
const email = (v) => txt(v).toLowerCase();
const phone = (v) => String(v || "").replace(/\D/g, "");
const num = (v, f = 0) => (Number.isFinite(Number(v)) ? Number(v) : f);
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const isConfiguredCredential = (value) => {
  const raw = txt(value).toLowerCase();
  if (!raw) return false;
  return (
    !raw.includes("replace_with")
    && !raw.includes("placeholder")
    && !raw.startsWith("your_")
  );
};
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
  lastLoginAt: u.lastLoginAt || null,
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
      documentationRequests: safeArr(raw.documentationRequests),
      visits: safeArr(raw.visits),
      bids: safeArr(raw.bids),
      reports: safeArr(raw.reports),
      tokenPayments: safeArr(raw.tokenPayments),
      insuranceTieups: safeArr(raw.insuranceTieups),
      tenantDamageRequests: safeArr(raw.tenantDamageRequests),
      loanAssistanceLeads: safeArr(raw.loanAssistanceLeads),
      servicePartnerBookings: safeArr(raw.servicePartnerBookings),
      valuationRequests: safeArr(raw.valuationRequests),
      rentAgreementDrafts: safeArr(raw.rentAgreementDrafts),
      franchiseRequests: safeArr(raw.franchiseRequests),
      ownerVerificationRequests: safeArr(raw.ownerVerificationRequests),
      uploads: safeArr(raw.uploads),
      callMaskRequests: safeArr(raw.callMaskRequests),
      notifications: safeArr(raw.notifications),
      adminConfig: {
        ...fresh.adminConfig,
        ...(raw.adminConfig || {}),
        categories: safeArr(raw?.adminConfig?.categories).length ? safeArr(raw.adminConfig.categories) : fresh.adminConfig.categories,
        cities: safeArr(raw?.adminConfig?.cities).length ? safeArr(raw.adminConfig.cities) : fresh.adminConfig.cities,
        featuredPricing: normalizeFeaturedPricingConfig(raw?.adminConfig?.featuredPricing || fresh.adminConfig.featuredPricing),
      },
      trustedAgents: safeArr(raw.trustedAgents).length ? safeArr(raw.trustedAgents) : fresh.trustedAgents,
      counters: { ...fresh.counters, ...(raw.counters || {}) },
    };
    db.users = safeArr(db.users).map((user) => ({
      ...user,
      tokenVersion: Math.max(1, num(user?.tokenVersion, 1)),
      lastLoginAt: user?.lastLoginAt || null,
    }));
    db.bids = safeArr(db.bids).map((entry) => normalizeBidRecord(entry));
    applyFeaturedPricingToPlans(db?.adminConfig?.featuredPricing || {});
  } catch {
    db = defaults();
    applyFeaturedPricingToPlans(db?.adminConfig?.featuredPricing || {});
    await save();
  }
};

const sign = (u) => jwt.sign(
  {
    id: u.id,
    role: u.role,
    name: u.name,
    email: u.email || "",
    mobile: u.mobile || "",
    tokenVersion: Math.max(1, num(u?.tokenVersion, 1)),
  },
  JWT_SECRET,
  {
    expiresIn: JWT_EXPIRES_IN,
    algorithm: "HS256",
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    jwtid: crypto.randomUUID(),
  }
);
const tokenOf = (req) => {
  const h = String(req.headers.authorization || "");
  return h.startsWith("Bearer ") ? h.slice(7).trim() : "";
};
const authOpt = (req, _res, next) => {
  req.user = null;
  const t = tokenOf(req);
  if (!t) return next();
  try {
    const parsed = jwt.verify(t, JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: JWT_ISSUERS,
      audience: JWT_AUDIENCES,
    });
    const u = userById(parsed.id);
    const userTokenVersion = Math.max(1, num(u?.tokenVersion, 1));
    const tokenVersion = Math.max(1, num(parsed?.tokenVersion, 1));
    if (!u || tokenVersion !== userTokenVersion) return next();
    if (blocked(u)) return next();
    req.user = {
      ...parsed,
      role: u.role,
      name: u.name,
      email: u.email || "",
      mobile: u.mobile || "",
      tokenVersion: userTokenVersion,
    };
  } catch {
    req.user = null;
  }
  next();
};
const auth = (req, res, next) => {
  const t = tokenOf(req);
  if (!t) return res.status(401).json({ ok: false, message: "Missing auth token." });
  try {
    const parsed = jwt.verify(t, JWT_SECRET, {
      algorithms: ["HS256"],
      issuer: JWT_ISSUERS,
      audience: JWT_AUDIENCES,
    });
    const u = userById(parsed.id);
    if (!u) return res.status(401).json({ ok: false, message: "Session expired. Please login again." });
    const userTokenVersion = Math.max(1, num(u?.tokenVersion, 1));
    const tokenVersion = Math.max(1, num(parsed?.tokenVersion, 1));
    if (tokenVersion !== userTokenVersion) {
      return res.status(401).json({ ok: false, message: "Session revoked. Please login again." });
    }
    if (blocked(u)) return res.status(403).json({ ok: false, message: "Your account is blocked by admin." });
    req.user = {
      ...parsed,
      role: u.role,
      name: u.name,
      email: u.email || "",
      mobile: u.mobile || "",
      tokenVersion: userTokenVersion,
    };
    next();
  } catch {
    res.status(401).json({ ok: false, message: "Invalid or expired token." });
  }
};
const admin = (req, res, next) => (req.user?.role === "admin" ? next() : res.status(403).json({ ok: false, message: "Admin access required." }));
const userById = (id) => db.users.find((u) => u.id === id) || null;
const pushNoti = (userId, title, message, type = "general") => db.notifications.unshift({ id: nextId("notification"), userId, title, message, type, isRead: false, createdAt: now() });
const authFailureBuckets = new Map();
const authOtpCooldownBuckets = new Map();
const authLockThreshold = Math.max(3, Math.round(num(process.env.AUTH_LOCK_THRESHOLD, 6)));
const authLockWindowMs = Math.max(60_000, Math.round(num(process.env.AUTH_LOCK_WINDOW_MS, 15 * 60 * 1000)));
const authLockDurationMs = Math.max(60_000, Math.round(num(process.env.AUTH_LOCK_DURATION_MS, 30 * 60 * 1000)));
const authOtpCooldownMs = Math.max(10_000, Math.round(num(process.env.AUTH_OTP_COOLDOWN_MS, 45_000)));
const enforceStrongPasswords = txt(process.env.AUTH_STRONG_PASSWORD_POLICY || "true").toLowerCase() !== "false";
const authIdentityKey = ({ role: roleValue = "customer", email: emailValue = "", mobile: mobileValue = "" } = {}) => {
  const roleKey = role(roleValue);
  const emailKey = email(emailValue);
  const mobileKey = phone(mobileValue);
  const identity = mobileKey || emailKey || "unknown";
  return `${roleKey}:${identity}`;
};
const getAuthLockState = (key) => {
  const nowTs = Date.now();
  const record = authFailureBuckets.get(key);
  if (!record) return { locked: false, retryAfterSec: 0 };
  const lockUntil = Number(record.lockUntil || 0);
  if (lockUntil > nowTs) {
    return {
      locked: true,
      retryAfterSec: Math.max(1, Math.ceil((lockUntil - nowTs) / 1000)),
    };
  }
  if (Number(record.lastFailureAt || 0) + authLockWindowMs < nowTs) {
    authFailureBuckets.delete(key);
  }
  return { locked: false, retryAfterSec: 0 };
};
const recordAuthFailure = (key) => {
  const nowTs = Date.now();
  const current = authFailureBuckets.get(key) || {
    failCount: 0,
    firstFailureAt: nowTs,
    lastFailureAt: 0,
    lockUntil: 0,
  };
  if (nowTs - Number(current.firstFailureAt || nowTs) > authLockWindowMs) {
    current.failCount = 0;
    current.firstFailureAt = nowTs;
  }
  current.failCount = Number(current.failCount || 0) + 1;
  current.lastFailureAt = nowTs;
  if (current.failCount >= authLockThreshold) {
    current.lockUntil = nowTs + authLockDurationMs;
  }
  authFailureBuckets.set(key, current);
  return getAuthLockState(key);
};
const clearAuthFailure = (key) => {
  authFailureBuckets.delete(key);
};
const getOtpCooldownState = (key) => {
  const nowTs = Date.now();
  const nextAllowedAt = Number(authOtpCooldownBuckets.get(key) || 0);
  if (nextAllowedAt > nowTs) {
    return {
      blocked: true,
      retryAfterSec: Math.max(1, Math.ceil((nextAllowedAt - nowTs) / 1000)),
    };
  }
  return { blocked: false, retryAfterSec: 0 };
};
const touchOtpCooldown = (key) => {
  authOtpCooldownBuckets.set(key, Date.now() + authOtpCooldownMs);
};
const isStrongPassword = (value) => {
  const raw = String(value || "");
  if (raw.length < 8 || raw.length > 128) return false;
  const hasLower = /[a-z]/.test(raw);
  const hasUpper = /[A-Z]/.test(raw);
  const hasDigit = /\d/.test(raw);
  const hasSymbol = /[^A-Za-z0-9]/.test(raw);
  return hasLower && hasUpper && hasDigit && hasSymbol;
};
const sealedBidAllowedRoles = new Set(["customer", "seller"]);
const sealedBidMaxAmount = Math.max(1000, num(process.env.SEALED_BID_MAX_AMOUNT, 5000000000));
const sealedBidDecisionReasonMin = Math.max(8, Math.round(num(process.env.SEALED_BID_DECISION_REASON_MIN, 12)));
const sealedBidRepeatWindowMs = Math.max(5000, Math.round(num(process.env.SEALED_BID_REPEAT_WINDOW_MS, 30000)));
const sealedBidIntegritySecret = txt(process.env.SEALED_BID_INTEGRITY_SECRET || JWT_SECRET || "propertysetu-sealed-bid-integrity");
const sealedBidRateBuckets = new Map();
const requestIp = (req) => {
  const forwarded = req?.headers?.["x-forwarded-for"];
  if (Array.isArray(forwarded) && forwarded.length) {
    return txt(forwarded[0]).split(",")[0].trim();
  }
  if (txt(forwarded)) {
    return txt(forwarded).split(",")[0].trim();
  }
  return txt(req?.ip || req?.socket?.remoteAddress || "0.0.0.0");
};
const sha256 = (value) => crypto.createHash("sha256").update(String(value || "")).digest("hex");
const normalizeDecisionReason = (value) => txt(value).replace(/\s+/g, " ").slice(0, 300);
const createDecisionIntegrityHash = ({ bidId, action, by, at, reason, prevIntegrityHash = "" } = {}) =>
  sha256([
    txt(bidId),
    txt(action).toLowerCase(),
    txt(by),
    txt(at),
    normalizeDecisionReason(reason),
    txt(prevIntegrityHash),
    sealedBidIntegritySecret,
  ].join("|"));
const createBidIntegrityHash = ({ propertyId, bidderId, amount, createdAt, bidNonceHash } = {}) =>
  sha256([
    txt(propertyId),
    txt(bidderId),
    Math.round(num(amount, 0)),
    txt(createdAt),
    txt(bidNonceHash),
    sealedBidIntegritySecret,
  ].join("|"));
const buildBidSecurityMeta = ({ req, propertyId, bidderId, amount, createdAt } = {}) => {
  const nonce = crypto.randomBytes(16).toString("hex");
  const bidNonceHash = sha256(nonce);
  return {
    bidIpHash: sha256(requestIp(req)),
    bidUserAgentHash: sha256(txt(req?.headers?.["user-agent"]).slice(0, 512)),
    bidNonceHash,
    bidIntegrityHash: createBidIntegrityHash({ propertyId, bidderId, amount, createdAt, bidNonceHash }),
  };
};
const evaluateBidRecordIntegrity = (bid = {}) => {
  const security = bid && typeof bid.security === "object" ? bid.security : {};
  const bidNonceHash = txt(security.bidNonceHash);
  const bidIntegrityHash = txt(security.bidIntegrityHash);
  if (!bidNonceHash || !bidIntegrityHash) return "legacy-unhashed";
  const expected = createBidIntegrityHash({
    propertyId: bid.propertyId,
    bidderId: bid.bidderId,
    amount: bid.amount,
    createdAt: bid.createdAt,
    bidNonceHash,
  });
  return expected === bidIntegrityHash ? "verified" : "tamper-alert";
};
const evaluateDecisionHistoryIntegrity = (bid = {}) => {
  const history = safeArr(bid.decisionHistory);
  if (!history.length) return "no-decisions";
  let previousHash = "";
  for (const item of history) {
    const action = txt(item?.action).toLowerCase();
    const by = txt(item?.by || item?.byName);
    const at = txt(item?.at);
    const reason = normalizeDecisionReason(item?.reason);
    const storedPrev = txt(item?.prevIntegrityHash);
    const storedHash = txt(item?.integrityHash);
    if (!storedPrev && !storedHash) return "legacy-unhashed";
    if (storedPrev !== previousHash) return "tamper-alert";
    const expected = createDecisionIntegrityHash({
      bidId: txt(bid.id),
      action,
      by,
      at,
      reason,
      prevIntegrityHash: previousHash,
    });
    if (storedHash !== expected) return "tamper-alert";
    previousHash = storedHash;
  }
  return "verified";
};
const enforceRateLimit = ({ scope = "sealed-bid", key = "", limit = 10, windowMs = 60000 } = {}) => {
  const nowTs = Date.now();
  const scopedKey = `${txt(scope)}:${txt(key, "anonymous")}`;
  const current = sealedBidRateBuckets.get(scopedKey) || { hits: [] };
  const minTs = nowTs - Math.max(1000, windowMs);
  const hits = safeArr(current.hits).filter((stamp) => Number(stamp) >= minTs);
  if (hits.length >= Math.max(1, limit)) {
    const oldest = Math.min(...hits);
    const retryAfterSec = Math.max(1, Math.ceil((windowMs - (nowTs - oldest)) / 1000));
    return { allowed: false, retryAfterSec };
  }
  hits.push(nowTs);
  sealedBidRateBuckets.set(scopedKey, { hits });
  return { allowed: true, retryAfterSec: 0 };
};
const toEpoch = (iso) => {
  const stamp = Date.parse(txt(iso));
  return Number.isFinite(stamp) ? stamp : 0;
};
const normalizeBidStatus = (value) => {
  const raw = txt(value).toLowerCase();
  if (raw === "accepted") return "Accepted";
  if (raw === "rejected") return "Rejected";
  if (raw === "revealed") return "Revealed";
  return "Submitted";
};
const normalizeBidRecord = (entry = {}) => {
  const status = normalizeBidStatus(entry.status);
  const revealed = !!entry.winnerRevealed || status === "Revealed";
  const normalized = {
    ...entry,
    id: txt(entry.id),
    propertyId: txt(entry.propertyId),
    propertyTitle: txt(entry.propertyTitle),
    amount: Math.round(num(entry.amount, 0)),
    bidderId: txt(entry.bidderId),
    bidderName: txt(entry.bidderName),
    bidderRole: txt(entry.bidderRole).toLowerCase() || "customer",
    status,
    sealed: entry.sealed !== false,
    adminVisible: entry.adminVisible !== false,
    isWinningBid: !!entry.isWinningBid,
    winnerRevealed: revealed,
    createdAt: txt(entry.createdAt, now()),
    updatedAt: txt(entry.updatedAt, entry.createdAt || now()),
    decisionHistory: safeArr(entry.decisionHistory).map((item) => ({
      action: txt(item?.action).toLowerCase(),
      by: txt(item?.by || item?.byName),
      byName: txt(item?.byName),
      byRole: txt(item?.byRole || "admin"),
      at: txt(item?.at),
      reason: normalizeDecisionReason(item?.reason),
      prevIntegrityHash: txt(item?.prevIntegrityHash),
      integrityHash: txt(item?.integrityHash),
    })),
    security: entry?.security && typeof entry.security === "object" && !Array.isArray(entry.security)
      ? {
          bidIpHash: txt(entry.security.bidIpHash),
          bidUserAgentHash: txt(entry.security.bidUserAgentHash),
          bidNonceHash: txt(entry.security.bidNonceHash),
          bidIntegrityHash: txt(entry.security.bidIntegrityHash),
        }
      : {
          bidIpHash: "",
          bidUserAgentHash: "",
          bidNonceHash: "",
          bidIntegrityHash: "",
        },
  };
  const bidRecordIntegrity = evaluateBidRecordIntegrity(normalized);
  const decisionHistoryIntegrity = evaluateDecisionHistoryIntegrity(normalized);
  return {
    ...normalized,
    bidRecordIntegrity,
    decisionHistoryIntegrity,
    integrityStatus: bidRecordIntegrity === "tamper-alert" || decisionHistoryIntegrity === "tamper-alert"
      ? "tamper-alert"
      : bidRecordIntegrity === "legacy-unhashed" || decisionHistoryIntegrity === "legacy-unhashed"
        ? "legacy-unhashed"
        : "verified",
  };
};
const sortBidsHighToLow = (a, b) => num(b.amount, 0) - num(a.amount, 0) || toEpoch(a.createdAt) - toEpoch(b.createdAt);
const bidsByPropertyId = (propertyId) => db.bids.filter((b) => txt(b.propertyId) === txt(propertyId)).map(normalizeBidRecord);
const resolveHighestBid = (items = []) => {
  const sorted = [...safeArr(items)].sort(sortBidsHighToLow);
  return sorted[0] || null;
};
const summarizeSealedBidStatus = (items = []) => {
  const list = safeArr(items);
  if (!list.length) return "No Bids";
  if (list.some((b) => b.winnerRevealed)) return "Winning Bid Revealed";
  if (list.some((b) => b.status === "Accepted")) return "Winner Accepted";
  if (list.every((b) => b.status === "Rejected")) return "Rejected";
  return "Bidding Active";
};
const sanitizeBidForBidder = (bid) => ({
  id: bid.id,
  propertyId: bid.propertyId,
  propertyTitle: bid.propertyTitle,
  status: bid.status,
  createdAt: bid.createdAt,
  updatedAt: bid.updatedAt,
  isWinningBid: !!bid.isWinningBid,
  winnerRevealed: !!bid.winnerRevealed,
  sealed: true,
  amountVisible: false,
  ...(bid.winnerRevealed && bid.isWinningBid ? { revealedAmount: bid.amount } : {}),
});
const sanitizeBidForAdmin = (bid) => ({
  id: bid.id,
  propertyId: bid.propertyId,
  propertyTitle: bid.propertyTitle,
  amount: bid.amount,
  bidderId: bid.bidderId,
  bidderName: bid.bidderName,
  bidderRole: bid.bidderRole,
  status: bid.status,
  sealed: true,
  isWinningBid: !!bid.isWinningBid,
  winnerRevealed: !!bid.winnerRevealed,
  createdAt: bid.createdAt,
  updatedAt: bid.updatedAt,
  decisionByAdminId: txt(bid.decisionByAdminId),
  decisionByAdminName: txt(bid.decisionByAdminName),
  decisionAt: txt(bid.decisionAt),
  decisionHistory: safeArr(bid.decisionHistory),
  bidRecordIntegrity: txt(bid.bidRecordIntegrity || "legacy-unhashed"),
  decisionHistoryIntegrity: txt(bid.decisionHistoryIntegrity || "legacy-unhashed"),
  integrityStatus: txt(bid.integrityStatus || "legacy-unhashed"),
});
const publicWinnerSnapshot = (winner) => ({
  bidId: winner.id,
  propertyId: winner.propertyId,
  propertyTitle: winner.propertyTitle,
  winnerBidAmount: winner.amount,
  winnerBidder: maskRef(winner.bidderName || winner.bidderId || "Bidder"),
  revealedAt: winner.updatedAt || winner.createdAt,
});

app.disable("x-powered-by");
app.set("trust proxy", Number(process.env.TRUST_PROXY || 1));
app.use(proAttachRequestContext);
app.use(proSecurityHeaders);
app.use(cors(createProCorsOptions()));
app.use("/api", proRequestFirewall);
app.use("/api", proTokenFirewall);
app.use(express.json({ limit: String(process.env.API_JSON_LIMIT || "2mb") }));
app.use(express.urlencoded({ extended: true, limit: String(process.env.API_FORM_LIMIT || "2mb") }));
app.use("/api", proApiRateLimiter);
app.use("/api", proApiPayloadGuard);
app.use("/api", proAiThreatAutoDetector);
app.use("/api", proFakeListingAiGuard);
app.use("/api", proAuthFailureIntelligence);
app.use("/api/auth", proAuthRateLimiter);
app.use(proBlockSensitivePublicFiles);
app.use(express.static(activeWebRoot, createProSafeStaticOptions()));
if (activeWebRoot !== webRoot) {
  app.use(express.static(webRoot, createProSafeStaticOptions()));
}

app.get("/api", (_req, res) => res.json({
  ok: true,
  service: "PropertySetu API",
  version: "2.4.0",
  features: [
    "auth",
    "otp-login",
    "owner-verification",
    "properties",
    "admin",
    "visits",
    "reviews",
    "chat",
    "subscriptions",
    "care",
    "legal",
    "documentation-services",
    "loan-assistance",
    "ecosystem-bookings",
    "valuation-tool",
    "rent-agreement-generator",
    "franchise-system",
    "bids",
    "insights",
    "ai-recommendations",
    "ai-pricing",
    "ai-description",
    "ai-fraud-scan",
    "ai-market-trend",
    "reports",
    "admin-config",
    "city-structure",
    "frontend-rooting",
    "file-upload",
    "token-payments",
    "insurance",
    "tenant-damage",
    "trusted-agents",
    "agent-ratings",
    "call-masking",
  ],
}));
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
    ecosystemServices: true,
  },
  modules: {
    auth: "/api/auth/*",
    listings: "/api/properties",
    mediaUpload: "/api/uploads/property-media",
    ownerVerification: "/api/owner-verification/*",
    reviews: "/api/reviews/*",
    subscriptions: "/api/subscriptions/*",
    documentation: "/api/documentation/*",
    loanAssistance: "/api/loan/*",
    ecosystem: "/api/ecosystem/*",
    valuation: "/api/valuation/estimate",
    rentAgreementGenerator: "/api/rent-agreement/generate",
    franchise: "/api/franchise/*",
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
    stackOptions: "/api/system/stack-options",
    securityAudit: "/api/system/security-audit",
    securityIntelligence: "/api/system/security-intelligence",
    securityIntelligenceManage: [
      "/api/system/security-intelligence/release",
      "/api/system/security-intelligence/quarantine"
    ],
    securityControl: "/api/system/security-control",
    securityControlManage: [
      "/api/system/security-control",
      "/api/system/security-control/reset",
      "/api/system/security-control/profile"
    ],
    securityControlProfiles: "/api/system/security-control/profiles",
    securityAuditV3: "/api/v3/system/security-audit",
    securityIntelligenceV3: "/api/v3/system/security-intelligence",
    securityIntelligenceManageV3: [
      "/api/v3/system/security-intelligence/release",
      "/api/v3/system/security-intelligence/quarantine"
    ],
    securityControlV3: "/api/v3/system/security-control",
    securityControlManageV3: [
      "/api/v3/system/security-control",
      "/api/v3/system/security-control/reset",
      "/api/v3/system/security-control/profile"
    ],
    securityControlProfilesV3: "/api/v3/system/security-control/profiles",
  },
}));
app.get("/api/system/stack-options", (_req, res) => {
  const folderStructure = {
    root: "PropertySetu/",
    tree: [
      "PropertySetu/",
      "|",
      "|-- client/              # Frontend (React)",
      "|   |-- pages/",
      "|   |-- components/",
      "|   |-- services/",
      "|   `-- utils/",
      "|",
      "|-- server/              # Backend",
      "|   |-- controllers/",
      "|   |-- models/",
      "|   |-- routes/",
      "|   |-- middleware/",
      "|   `-- config/",
      "|",
      "|-- database/",
      "|",
      "`-- package.json",
    ],
  };

  const requiredPaths = {
    client: "client/",
    clientPages: "client/pages/",
    clientComponents: "client/components/",
    clientServices: "client/services/",
    clientUtils: "client/utils/",
    server: "server/",
    serverControllers: "server/controllers/",
    serverModels: "server/models/",
    serverRoutes: "server/routes/",
    serverMiddleware: "server/middleware/",
    serverConfig: "server/config/",
    database: "database/",
    rootPackageJson: "package.json",
  };

  const folderPresence = Object.fromEntries(
    Object.entries(requiredPaths).map(([key, rel]) => [key, fs.existsSync(path.join(webRoot, rel))]),
  );

  res.json({
    ok: true,
    option1: {
      label: "Best & Modern",
      frontend: "React / Next.js",
      backend: "Node.js + Express",
      database: "MongoDB",
      fileStorage: "Cloudinary / AWS S3",
      hosting: "Vercel + Render",
      payment: "Razorpay",
    },
    option2: {
      label: "Easier for Beginner",
      frontend: "HTML + CSS + JS",
      backend: "Node.js",
      database: "MongoDB",
      adminPanel: "Simple admin panel",
    },
    recommendation: "If future app build is planned, Option 1 is best.",
    folderStructure,
    folderPresence,
    source: "legacy-live-api",
  });
});
app.get("/api/system/security-audit", auth, admin, (req, res) => {
  const limit = Math.min(500, Math.max(1, num(req.query.limit, 100)));
  const items = getProSecurityAuditEvents(limit);
  res.json({
    ok: true,
    total: items.length,
    requestedBy: {
      id: req.user.id,
      role: req.user.role,
    },
    items,
  });
});
app.get("/api/system/security-intelligence", auth, admin, (req, res) => {
  const limit = Math.min(500, Math.max(1, num(req.query.limit, 100)));
  const intelligence = getProSecurityThreatIntelligence(limit);
  res.json({
    ok: true,
    requestedBy: {
      id: req.user.id,
      role: req.user.role,
    },
    ...intelligence,
  });
});
app.get("/api/system/security-control", auth, admin, (req, res) => {
  res.json({
    ok: true,
    requestedBy: {
      id: req.user.id,
      role: req.user.role,
    },
    state: getProSecurityControlState(),
  });
});
app.patch("/api/system/security-control", auth, admin, (req, res) => {
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? req.body
    : {};
  const patch =
    body.patch && typeof body.patch === "object" && !Array.isArray(body.patch)
      ? body.patch
      : body;
  const result = updateProSecurityControlState(patch, {
    actorId: req.user.id,
    actorRole: req.user.role
  });

  return res.json({
    ok: true,
    action: "updated",
    requestedBy: {
      id: req.user.id,
      role: req.user.role
    },
    warnings: Array.isArray(result.warnings) ? result.warnings : [],
    state: result.state
  });
});
app.get("/api/system/security-control/profiles", auth, admin, (req, res) => {
  return res.json({
    ok: true,
    requestedBy: {
      id: req.user.id,
      role: req.user.role
    },
    profiles: listProSecurityControlProfiles()
  });
});
app.post("/api/system/security-control/profile", auth, admin, (req, res) => {
  const profileId = txt(req.body?.profileId || req.body?.profile || req.body?.mode).toLowerCase();
  const result = applyProSecurityControlProfile(profileId, {
    actorId: req.user.id,
    actorRole: req.user.role
  });
  const statusCode = result.applied ? 200 : 400;
  return res.status(statusCode).json({
    ok: result.applied,
    action: result.applied ? "profile-applied" : "profile-rejected",
    requestedBy: {
      id: req.user.id,
      role: req.user.role
    },
    profileId: result.profileId,
    warnings: Array.isArray(result.warnings) ? result.warnings : [],
    state: result.state
  });
});
app.post("/api/system/security-control/reset", auth, admin, (req, res) => {
  const result = resetProSecurityControlState({
    actorId: req.user.id,
    actorRole: req.user.role
  });
  return res.json({
    ok: true,
    action: "reset",
    requestedBy: {
      id: req.user.id,
      role: req.user.role
    },
    warnings: Array.isArray(result.warnings) ? result.warnings : [],
    state: result.state
  });
});
app.post("/api/system/security-intelligence/release", auth, admin, (req, res) => {
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

  const result = releaseProSecurityThreatProfile(fingerprint);
  if (!result) {
    return res.status(404).json({
      ok: false,
      message: "Threat profile not found for fingerprint."
    });
  }

  return res.json({
    ok: true,
    action: "released",
    by: {
      id: req.user.id,
      role: req.user.role
    },
    profile: result
  });
});
app.post("/api/system/security-intelligence/quarantine", auth, admin, (req, res) => {
  const fingerprint = normalizeProSecurityThreatFingerprint(req.body?.fingerprint);
  const durationMs = Math.max(60_000, Math.min(num(req.body?.durationMs, 30 * 60 * 1000), 24 * 60 * 60 * 1000));
  const reason = txt(req.body?.reason || "manual-admin-quarantine").slice(0, 200);

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

  const result = quarantineProSecurityThreatProfile(fingerprint, {
    durationMs,
    reason: reason || "manual-admin-quarantine"
  });

  if (!result) {
    return res.status(400).json({
      ok: false,
      message: "Unable to quarantine threat profile."
    });
  }

  return res.json({
    ok: true,
    action: "quarantined",
    by: {
      id: req.user.id,
      role: req.user.role
    },
    profile: result
  });
});
app.get("/api/system/core-systems", (_req, res) => {
  const nodeEnv = txt(process.env.NODE_ENV || "development").toLowerCase();
  const developmentFallbackActive = nodeEnv !== "production";
  const storageProvider = txt(process.env.STORAGE_PROVIDER || "cloudinary").toLowerCase();
  const cloudinaryConfigured =
    isConfiguredCredential(process.env.CLOUDINARY_CLOUD_NAME)
    && isConfiguredCredential(process.env.CLOUDINARY_API_KEY)
    && isConfiguredCredential(process.env.CLOUDINARY_API_SECRET);
  const s3Configured =
    isConfiguredCredential(process.env.AWS_REGION)
    && isConfiguredCredential(process.env.AWS_S3_BUCKET);
  const storageExternalConfigured = storageProvider === "s3" ? s3Configured : cloudinaryConfigured;
  const storageReady = storageExternalConfigured || developmentFallbackActive;
  const paymentExternalConfigured =
    isConfiguredCredential(process.env.RAZORPAY_KEY_ID)
    && isConfiguredCredential(process.env.RAZORPAY_KEY_SECRET);
  const paymentReady = paymentExternalConfigured || developmentFallbackActive;
  const authReady =
    isConfiguredCredential(process.env.JWT_SECRET)
    && isConfiguredCredential(process.env.ADMIN_REGISTRATION_KEY);

  const mongodbStructure = {
    users: [
      "name",
      "email",
      "phone",
      "password (hashed)",
      "role (buyer/seller/admin)",
      "verified",
      "subscriptionPlan",
      "createdAt",
    ],
    properties: [
      "title",
      "description",
      "city",
      "location",
      "type (buy/rent)",
      "category (house/plot/commercial)",
      "price",
      "size",
      "images[]",
      "video",
      "ownerId",
      "verified",
      "featured",
      "createdAt",
    ],
    reviews: [
      "propertyId",
      "userId",
      "rating",
      "comment",
    ],
    subscriptions: [
      "userId",
      "planName",
      "amount",
      "startDate",
      "endDate",
    ],
  };

  const coreSystems = [
    {
      id: "authentication-system",
      title: "Authentication System",
      capabilities: ["OTP login", "JWT token", "Role based access", "Token-version logout revocation", "Account lockout + OTP cooldown"],
      status: authReady ? "ready" : "setup-required",
      endpoints: ["/api/auth/request-otp", "/api/auth/login", "/api/auth/logout", "/api/auth/me", "/api/v3/auth/request-otp", "/api/v3/auth/login-otp", "/api/v3/auth/logout"],
    },
    {
      id: "property-upload-system",
      title: "Property Upload System",
      capabilities: ["Minimum 5 photos validation", "1 video upload", "Document upload (private)", "Auto description generator"],
      status: storageReady ? "ready" : "setup-required",
      endpoints: ["/api/properties", "/api/uploads/property-media", "/api/v3/properties/professional", "/api/v3/properties/auto-description"],
    },
    {
      id: "verified-badge-system",
      title: "Verified Badge System",
      capabilities: ["Admin approve karega", "Verified by PropertySetu badge show hoga"],
      status: authReady ? "ready" : "setup-required",
      endpoints: ["/api/admin/owner-verification/:id/decision", "/api/properties/:id/approve", "/api/v3/properties/:propertyId/verify"],
    },
    {
      id: "subscription-payment-system",
      title: "Subscription and Payment",
      capabilities: ["Razorpay integration", "Featured listing system", "Property care monthly package"],
      status: paymentReady ? "ready" : "setup-required",
      endpoints: ["/api/subscriptions/activate", "/api/v2/payments/order", "/api/v3/subscriptions", "/api/v3/subscriptions/payment/order"],
    },
    {
      id: "ai-phase-2-system",
      title: "AI Features (Phase 2)",
      capabilities: ["Smart pricing suggestion", "Similar property recommendation", "Fake listing detection"],
      status: "ready",
      endpoints: ["/api/ai/pricing-suggestion", "/api/ai/recommendations", "/api/ai/fraud-scan", "/api/v3/ai/smart-pricing", "/api/v3/ai/similar-properties", "/api/v3/ai/fake-listing-detection"],
    },
  ];

  const readyCount = coreSystems.filter((item) => item.status === "ready").length;
  const productionExternalReady = storageExternalConfigured && paymentExternalConfigured;

  res.json({
    ok: true,
    message: "MongoDB structure and core systems blueprint for professional live build.",
    mongodbStructure,
    coreSystems,
    summary: {
      ready: readyCount,
      total: coreSystems.length,
      stage:
        readyCount === coreSystems.length
          ? productionExternalReady
            ? "core-systems-ready"
            : "core-systems-ready-development"
          : "core-systems-setup-required",
      productionExternalReady,
    },
    runtime: {
      nodeEnv,
      readinessMode: developmentFallbackActive ? "development-with-fallback" : "production-strict",
      developmentFallbackActive,
      storageProvider,
    },
    dependencies: {
      backendServer: true,
      database: true,
      authentication: true,
      fileStorage: true,
      paymentGateway: true,
      hostingSetup: true,
    },
  });
});

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
  if (enforceStrongPasswords && !isStrongPassword(p)) {
    return res.status(400).json({
      ok: false,
      message: "Password must be 8-128 chars with uppercase, lowercase, number, and symbol.",
    });
  }
  if (!enforceStrongPasswords && p.length < 6) {
    return res.status(400).json({ ok: false, message: "Password minimum 6 characters required." });
  }
  if (o !== OTP) {
    return res.status(400).json({
      ok: false,
      message: EXPOSE_OTP_HINT ? `Invalid OTP. Use ${OTP}.` : "Invalid OTP.",
    });
  }
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
    tokenVersion: 1,
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
  const authKey = authIdentityKey({ role: r, email: e, mobile: m });
  const lockState = getAuthLockState(authKey);
  if (lockState.locked) {
    return res.status(429).json({
      ok: false,
      message: "Too many failed login attempts. Please try again later.",
      retryAfterSec: lockState.retryAfterSec,
    });
  }
  const cooldownState = getOtpCooldownState(authKey);
  if (cooldownState.blocked) {
    return res.status(429).json({
      ok: false,
      message: "OTP recently requested. Please wait before trying again.",
      retryAfterSec: cooldownState.retryAfterSec,
    });
  }

  const cred = m || e;
  const u = /^\d{10}$/.test(cred) ? db.users.find((x) => x.role === r && x.mobile === cred) : db.users.find((x) => x.role === r && x.email === cred);
  if (!u) {
    touchOtpCooldown(authKey);
    return res.status(200).json({
      ok: true,
      message: "If account exists, OTP sent successfully.",
    });
  }
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
  touchOtpCooldown(authKey);
  const otpResponse = {
    ok: true,
    message: EXPOSE_OTP_HINT ? `OTP sent successfully (demo OTP: ${OTP}).` : "OTP sent successfully.",
    challengeId: record.id,
  };
  if (EXPOSE_OTP_HINT) otpResponse.otpHint = OTP;
  res.json(otpResponse);
});

app.post("/api/auth/login", async (req, res) => {
  const r = role(req.body?.role);
  const e = email(req.body?.email);
  const m = phone(req.body?.mobile);
  const p = String(req.body?.password || "");
  const o = String(req.body?.otp || "");
  if (!e && !m) return res.status(400).json({ ok: false, message: "Email or mobile required." });
  const authKey = authIdentityKey({ role: r, email: e, mobile: m });
  const lockState = getAuthLockState(authKey);
  if (lockState.locked) {
    return res.status(429).json({
      ok: false,
      message: "Too many failed login attempts. Please try again later.",
      retryAfterSec: lockState.retryAfterSec,
    });
  }

  if (o !== OTP) {
    const nextLockState = recordAuthFailure(authKey);
    if (nextLockState.locked) {
      return res.status(429).json({
        ok: false,
        message: "Too many failed login attempts. Please try again later.",
        retryAfterSec: nextLockState.retryAfterSec,
      });
    }
    return res.status(401).json({ ok: false, message: "Invalid credentials." });
  }
  const cred = m || e;
  const u = /^\d{10}$/.test(cred) ? db.users.find((x) => x.role === r && x.mobile === cred) : db.users.find((x) => x.role === r && x.email === cred);
  if (!u) {
    const nextLockState = recordAuthFailure(authKey);
    if (nextLockState.locked) {
      return res.status(429).json({
        ok: false,
        message: "Too many failed login attempts. Please try again later.",
        retryAfterSec: nextLockState.retryAfterSec,
      });
    }
    return res.status(401).json({ ok: false, message: "Invalid credentials." });
  }
  if (p) {
    if (!(await bcrypt.compare(p, u.passwordHash))) {
      const nextLockState = recordAuthFailure(authKey);
      if (nextLockState.locked) {
        return res.status(429).json({
          ok: false,
          message: "Too many failed login attempts. Please try again later.",
          retryAfterSec: nextLockState.retryAfterSec,
        });
      }
      return res.status(401).json({ ok: false, message: "Invalid credentials." });
    }
  }
  clearAuthFailure(authKey);
  u.lastLoginAt = now();
  u.updatedAt = now();
  await save();
  res.json({ ok: true, token: sign(u), user: userSafe(u) });
});

app.post("/api/auth/logout", auth, async (req, res) => {
  const u = userById(req.user.id);
  if (!u) return res.status(404).json({ ok: false, message: "User not found." });
  u.tokenVersion = Math.max(1, num(u.tokenVersion, 1)) + 1;
  u.updatedAt = now();
  await save();
  return res.json({
    ok: true,
    message: "Logged out successfully. Previous sessions revoked.",
    tokenVersion: u.tokenVersion,
  });
});
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
    documentationRequests: db.documentationRequests.length,
    loanAssistanceLeads: db.loanAssistanceLeads.length,
    servicePartnerBookings: db.servicePartnerBookings.length,
    valuationRequests: db.valuationRequests.length,
    rentAgreementDrafts: db.rentAgreementDrafts.length,
    franchiseRequests: db.franchiseRequests.length,
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
app.delete("/api/admin/config/categories", auth, admin, async (req, res) => {
  const name = txt(req.body?.name || req.query?.name);
  if (!name) return res.status(400).json({ ok: false, message: "Category name required." });
  const before = db.adminConfig.categories.length;
  db.adminConfig.categories = db.adminConfig.categories.filter((item) => txt(item).toLowerCase() !== name.toLowerCase());
  if (before === db.adminConfig.categories.length) {
    return res.status(404).json({ ok: false, message: "Category not found." });
  }
  await save();
  res.json({ ok: true, items: db.adminConfig.categories });
});
app.delete("/api/admin/config/categories/:name", auth, admin, async (req, res) => {
  const name = txt(req.params.name);
  if (!name) return res.status(400).json({ ok: false, message: "Category name required." });
  const before = db.adminConfig.categories.length;
  db.adminConfig.categories = db.adminConfig.categories.filter((item) => txt(item).toLowerCase() !== name.toLowerCase());
  if (before === db.adminConfig.categories.length) {
    return res.status(404).json({ ok: false, message: "Category not found." });
  }
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
app.delete("/api/admin/config/cities", auth, admin, async (req, res) => {
  const city = txt(req.body?.city || req.query?.city);
  if (!city) return res.status(400).json({ ok: false, message: "City name required." });
  if (city.toLowerCase() === "udaipur") {
    return res.status(400).json({ ok: false, message: "Udaipur live city cannot be removed." });
  }
  const before = db.adminConfig.cities.length;
  db.adminConfig.cities = db.adminConfig.cities.filter((item) => txt(item).toLowerCase() !== city.toLowerCase());
  if (before === db.adminConfig.cities.length) {
    return res.status(404).json({ ok: false, message: "City not found." });
  }
  await save();
  res.json({ ok: true, items: db.adminConfig.cities });
});
app.delete("/api/admin/config/cities/:city", auth, admin, async (req, res) => {
  const city = txt(req.params.city);
  if (!city) return res.status(400).json({ ok: false, message: "City name required." });
  if (city.toLowerCase() === "udaipur") {
    return res.status(400).json({ ok: false, message: "Udaipur live city cannot be removed." });
  }
  const before = db.adminConfig.cities.length;
  db.adminConfig.cities = db.adminConfig.cities.filter((item) => txt(item).toLowerCase() !== city.toLowerCase());
  if (before === db.adminConfig.cities.length) {
    return res.status(404).json({ ok: false, message: "City not found." });
  }
  await save();
  res.json({ ok: true, items: db.adminConfig.cities });
});

app.get("/api/admin/config/featured-pricing", auth, admin, (_req, res) => {
  applyFeaturedPricingToPlans(db?.adminConfig?.featuredPricing || {});
  res.json({
    ok: true,
    items: featuredPricingSnapshotFromPlans(),
    plans: plans.filter((item) => item.type === "featured"),
  });
});

app.post("/api/admin/config/featured-pricing", auth, admin, async (req, res) => {
  const planId = txt(req.body?.planId).toLowerCase();
  if (!featuredPlanDefaults[planId]) {
    return res.status(400).json({ ok: false, message: "Valid featured plan required (featured-7 or featured-30)." });
  }

  const rawAmount = Number(req.body?.amount);
  const rawCycleDays = Number(req.body?.cycleDays);
  if (!Number.isFinite(rawAmount) || rawAmount < 0) {
    return res.status(400).json({ ok: false, message: "Valid amount is required." });
  }
  if (!Number.isFinite(rawCycleDays) || rawCycleDays < 1) {
    return res.status(400).json({ ok: false, message: "Valid cycleDays is required." });
  }

  const current = normalizeFeaturedPricingConfig(db?.adminConfig?.featuredPricing || {});
  const label = txt(req.body?.label || current?.[planId]?.label || featuredPlanDefaults[planId]?.label);
  current[planId] = {
    label: label || featuredPlanDefaults[planId].label,
    amount: Math.max(0, Math.round(rawAmount)),
    cycleDays: Math.max(1, Math.round(rawCycleDays)),
  };

  db.adminConfig.featuredPricing = normalizeFeaturedPricingConfig(current);
  applyFeaturedPricingToPlans(db.adminConfig.featuredPricing);
  await save();
  res.json({
    ok: true,
    items: featuredPricingSnapshotFromPlans(),
    plans: plans.filter((item) => item.type === "featured"),
  });
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
  const legalServiceRevenue = db.legalRequests.reduce((sum, item) => sum + num(item.amount, 0), 0);
  const documentationServiceFeeRevenue = db.documentationRequests.reduce((sum, item) => sum + num(item.amount, 0), 0);
  const ecosystemServiceRevenue = db.servicePartnerBookings.reduce((sum, item) => sum + num(item.serviceFee, 0), 0);
  const loanAssistanceCommissionRevenue = db.loanAssistanceLeads.reduce((sum, item) => sum + num(item.finalCommissionAmount || item.estimatedCommission, 0), 0);
  const franchisePipelineValue = db.franchiseRequests.reduce((sum, item) => sum + num(item.initialFeePotential, 0), 0);
  const estimatedCommission = Math.round(db.properties.filter((p) => p.status === "Approved").length * 2500);
  const totalMonetized = featuredListingRevenue
    + verifiedBadgeRevenue
    + subscriptionModelRevenue
    + agentMembershipRevenue
    + propertyCareRevenue
    + legalServiceRevenue
    + documentationServiceFeeRevenue
    + ecosystemServiceRevenue
    + loanAssistanceCommissionRevenue
    + estimatedCommission;
  res.json({
    ok: true,
    analytics: {
      paidSubscriptions: paid.length,
      subscriptionRevenue: revenue,
      legalServiceRevenue,
      featuredListingRevenue,
      verifiedBadgeRevenue,
      subscriptionModelRevenue,
      agentMembershipRevenue,
      propertyCareRevenue,
      documentationServiceFeeRevenue,
      ecosystemServiceRevenue,
      loanAssistanceCommissionRevenue,
      franchisePipelineValue,
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

app.get("/api/subscriptions/plans", (_req, res) => {
  applyFeaturedPricingToPlans(db?.adminConfig?.featuredPricing || {});
  res.json({ ok: true, items: plans });
});
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

app.get("/api/documentation/services", (_req, res) => {
  res.json({ ok: true, items: documentationServices });
});
app.post("/api/documentation/requests", auth, async (req, res) => {
  const serviceId = txt(req.body?.serviceId || req.body?.templateId);
  const service = documentationServices.find((item) => item.id === serviceId);
  if (!service) return res.status(404).json({ ok: false, message: "Documentation service not found." });
  const details = txt(req.body?.details);
  if (!details) return res.status(400).json({ ok: false, message: "Request details required." });

  const record = {
    id: nextId("documentation"),
    serviceId: service.id,
    serviceName: service.name,
    category: service.category,
    amount: service.fee,
    propertyId: txt(req.body?.propertyId) || null,
    city: txt(req.body?.city || "Udaipur"),
    details,
    status: "Requested",
    userId: req.user.id,
    userName: req.user.name,
    createdAt: now(),
  };
  db.documentationRequests.unshift(record);
  db.users.filter((u) => u.role === "admin").forEach((a) => pushNoti(a.id, "New Documentation Request", `${req.user.name} requested ${service.name}.`, "documentation"));
  await save();
  res.status(201).json({ ok: true, request: record });
});
app.get("/api/documentation/requests", auth, (req, res) => {
  const items = req.user.role === "admin"
    ? [...db.documentationRequests]
    : db.documentationRequests.filter((item) => item.userId === req.user.id);
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ ok: true, total: items.length, items });
});
app.post("/api/admin/documentation/requests/:id/status", auth, admin, async (req, res) => {
  const request = db.documentationRequests.find((item) => item.id === req.params.id);
  if (!request) return res.status(404).json({ ok: false, message: "Documentation request not found." });
  const status = txt(req.body?.status || "");
  if (!status) return res.status(400).json({ ok: false, message: "Status is required." });
  request.status = status;
  request.adminNote = txt(req.body?.adminNote);
  request.updatedAt = now();
  await save();
  if (request.userId) pushNoti(request.userId, "Documentation Request Updated", `Your request ${request.id} is now "${status}".`, "documentation");
  res.json({ ok: true, request });
});

app.get("/api/loan/banks", (_req, res) => {
  res.json({ ok: true, items: loanPartnerBanks });
});
app.post("/api/loan/assistance", auth, async (req, res) => {
  const bankId = txt(req.body?.bankId);
  const bank = loanPartnerBanks.find((item) => item.id === bankId);
  if (!bank) return res.status(404).json({ ok: false, message: "Loan partner bank not found." });

  const requestedAmount = num(req.body?.requestedAmount || req.body?.loanAmount, 0);
  const propertyValue = num(req.body?.propertyValue || req.body?.propertyCost, 0);
  if (requestedAmount <= 0) return res.status(400).json({ ok: false, message: "Requested loan amount required." });
  if (propertyValue > 0 && requestedAmount > Math.round(propertyValue * 0.9)) {
    return res.status(400).json({ ok: false, message: "Loan amount should be less than property value." });
  }

  const estimatedCommission = Math.round(requestedAmount * (num(bank.commissionPercent, 0) / 100));
  const record = {
    id: nextId("loan"),
    userId: req.user.id,
    userName: req.user.name,
    bankId: bank.id,
    bankName: bank.name,
    propertyId: txt(req.body?.propertyId) || null,
    city: txt(req.body?.city || "Udaipur"),
    locality: txt(req.body?.locality || ""),
    loanType: txt(req.body?.loanType || "home-loan"),
    requestedAmount,
    propertyValue,
    monthlyIncome: num(req.body?.monthlyIncome, 0),
    cibilScore: num(req.body?.cibilScore, 0),
    referralSource: txt(req.body?.referralSource || "platform"),
    commissionPercent: num(bank.commissionPercent, 0),
    estimatedCommission,
    finalCommissionAmount: null,
    status: "lead-created",
    notes: txt(req.body?.notes),
    createdAt: now(),
    updatedAt: now(),
  };
  db.loanAssistanceLeads.unshift(record);
  db.users.filter((u) => u.role === "admin").forEach((a) => pushNoti(a.id, "New Loan Assistance Lead", `${req.user.name} requested loan support from ${bank.name}.`, "loan"));
  await save();
  res.status(201).json({ ok: true, lead: record });
});
app.get("/api/loan/assistance", auth, (req, res) => {
  const items = req.user.role === "admin"
    ? [...db.loanAssistanceLeads]
    : db.loanAssistanceLeads.filter((item) => item.userId === req.user.id);
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ ok: true, total: items.length, items });
});
app.post("/api/admin/loan/assistance/:id/status", auth, admin, async (req, res) => {
  const lead = db.loanAssistanceLeads.find((item) => item.id === req.params.id);
  if (!lead) return res.status(404).json({ ok: false, message: "Loan lead not found." });
  const nextStatus = txt(req.body?.status || "in-progress");
  lead.status = nextStatus;
  if (num(req.body?.finalCommissionAmount, -1) >= 0) {
    lead.finalCommissionAmount = Math.round(Math.max(0, num(req.body?.finalCommissionAmount, 0)));
  }
  lead.updatedAt = now();
  await save();
  res.json({ ok: true, lead });
});

app.get("/api/ecosystem/services", (_req, res) => {
  res.json({ ok: true, items: ecosystemServiceCatalog });
});
app.post("/api/ecosystem/bookings", auth, async (req, res) => {
  const serviceId = txt(req.body?.serviceId || req.body?.type);
  const service = ecosystemServiceCatalog.find((item) => item.id === serviceId);
  if (!service) return res.status(404).json({ ok: false, message: "Ecosystem service not found." });
  if (!["movers-packers", "interior-designer"].includes(service.id)) {
    return res.status(400).json({ ok: false, message: "Use dedicated endpoint for this service type." });
  }

  const preferredDate = txt(req.body?.preferredDate);
  if (!preferredDate) return res.status(400).json({ ok: false, message: "Preferred date required." });

  const record = {
    id: nextId("partnerBooking"),
    serviceId: service.id,
    serviceName: service.name,
    serviceFee: num(req.body?.serviceFee, service.baseFee),
    userId: req.user.id,
    userName: req.user.name,
    propertyId: txt(req.body?.propertyId) || null,
    city: txt(req.body?.city || "Udaipur"),
    locality: txt(req.body?.locality || ""),
    preferredDate,
    budget: num(req.body?.budget, 0),
    contactName: txt(req.body?.contactName || req.user.name),
    contactPhone: phone(req.body?.contactPhone),
    notes: txt(req.body?.notes),
    status: "Requested",
    createdAt: now(),
    updatedAt: now(),
  };
  db.servicePartnerBookings.unshift(record);
  db.users.filter((u) => u.role === "admin").forEach((a) => pushNoti(a.id, "New Partner Service Booking", `${req.user.name} booked ${service.name}.`, "ecosystem"));
  await save();
  res.status(201).json({ ok: true, booking: record });
});
app.get("/api/ecosystem/bookings", auth, (req, res) => {
  const items = req.user.role === "admin"
    ? [...db.servicePartnerBookings]
    : db.servicePartnerBookings.filter((item) => item.userId === req.user.id);
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ ok: true, total: items.length, items });
});
app.post("/api/admin/ecosystem/bookings/:id/status", auth, admin, async (req, res) => {
  const booking = db.servicePartnerBookings.find((item) => item.id === req.params.id);
  if (!booking) return res.status(404).json({ ok: false, message: "Booking not found." });
  const status = txt(req.body?.status || "");
  if (!status) return res.status(400).json({ ok: false, message: "Status is required." });
  booking.status = status;
  booking.adminNote = txt(req.body?.adminNote);
  booking.updatedAt = now();
  await save();
  if (booking.userId) pushNoti(booking.userId, "Service Booking Updated", `Your ${booking.serviceName} booking is now "${status}".`, "ecosystem");
  res.json({ ok: true, booking });
});

app.post("/api/valuation/estimate", authOpt, async (req, res) => {
  const locality = txt(req.body?.locality || req.body?.location || "Udaipur");
  const propertyType = txt(req.body?.propertyType || req.body?.category || "House");
  const areaSqft = Math.max(100, num(req.body?.areaSqft || req.body?.size, 0));
  const bedrooms = Math.max(0, num(req.body?.bedrooms, 0));
  const ageYears = Math.max(0, num(req.body?.ageYears, 0));
  const furnished = txt(req.body?.furnished || "semi").toLowerCase();
  const expectedPrice = num(req.body?.expectedPrice, 0);
  const base = getAiPricingSuggestionPayload({ locality, expectedPrice });
  const basePerSqft = Math.max(1200, Math.round(num(base.recommendedPrice, 0) / Math.max(areaSqft, 1)));
  const furnishingBoost = furnished.includes("furnished") ? 1.08 : furnished.includes("semi") ? 1.03 : 0.97;
  const ageMultiplier = clamp(1 - (ageYears * 0.008), 0.7, 1.02);
  const bhkMultiplier = bedrooms > 0 ? clamp(1 + (bedrooms * 0.02), 1, 1.16) : 1;
  const estimatedPrice = Math.round(basePerSqft * areaSqft * furnishingBoost * ageMultiplier * bhkMultiplier);
  const min = Math.max(0, Math.round(estimatedPrice * 0.9));
  const max = Math.max(min, Math.round(estimatedPrice * 1.12));

  const record = {
    id: nextId("valuation"),
    userId: req.user?.id || null,
    userName: req.user?.name || "guest",
    locality,
    propertyType,
    areaSqft,
    bedrooms,
    ageYears,
    furnished,
    expectedPrice,
    estimatedPrice,
    suggestedBand: { min, max },
    confidence: base.confidence,
    source: "propertysetu-valuation-tool-v1",
    createdAt: now(),
  };
  db.valuationRequests.unshift(record);
  db.valuationRequests = db.valuationRequests.slice(0, 1200);
  await save();

  res.json({
    ok: true,
    valuation: record,
    insight: `Estimated value for ${propertyType} in ${locality} is ₹${estimatedPrice.toLocaleString("en-IN")}.`,
  });
});
app.get("/api/valuation/requests", auth, admin, (_req, res) => {
  const items = [...db.valuationRequests].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ ok: true, total: items.length, items });
});

app.post("/api/rent-agreement/generate", auth, async (req, res) => {
  const ownerName = txt(req.body?.ownerName);
  const tenantName = txt(req.body?.tenantName);
  const propertyAddress = txt(req.body?.propertyAddress);
  const rentAmount = num(req.body?.rentAmount, 0);
  const depositAmount = num(req.body?.depositAmount, 0);
  const durationMonths = Math.max(1, num(req.body?.durationMonths, 11));
  const startDate = txt(req.body?.startDate || new Date().toISOString().slice(0, 10));
  if (!ownerName || !tenantName || !propertyAddress || rentAmount <= 0) {
    return res.status(400).json({ ok: false, message: "ownerName, tenantName, propertyAddress and rentAmount are required." });
  }

  const draftText = [
    "RENT AGREEMENT (Draft)",
    `Owner: ${ownerName}`,
    `Tenant: ${tenantName}`,
    `Property Address: ${propertyAddress}`,
    `Monthly Rent: INR ${Math.round(rentAmount).toLocaleString("en-IN")}`,
    `Security Deposit: INR ${Math.round(depositAmount).toLocaleString("en-IN")}`,
    `Tenure: ${durationMonths} months`,
    `Start Date: ${startDate}`,
    "Payment due date: 5th of every month.",
    "Electricity and water charges to be paid by tenant as per actual.",
    "Notice period: 30 days by either party.",
    "This is a generated draft and should be reviewed by a legal expert before execution."
  ].join("\n");

  const record = {
    id: nextId("rentAgreement"),
    userId: req.user.id,
    userName: req.user.name,
    ownerName,
    tenantName,
    propertyAddress,
    rentAmount: Math.round(rentAmount),
    depositAmount: Math.round(depositAmount),
    durationMonths,
    startDate,
    draftText,
    createdAt: now(),
  };
  db.rentAgreementDrafts.unshift(record);
  db.rentAgreementDrafts = db.rentAgreementDrafts.slice(0, 500);
  await save();
  res.status(201).json({ ok: true, draft: record });
});
app.get("/api/rent-agreement/drafts", auth, (req, res) => {
  const items = req.user.role === "admin"
    ? [...db.rentAgreementDrafts]
    : db.rentAgreementDrafts.filter((item) => item.userId === req.user.id);
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ ok: true, total: items.length, items });
});

app.get("/api/franchise/regions", (_req, res) => {
  const configuredCities = safeArr(db?.adminConfig?.cities).map((city) => txt(city)).filter(Boolean);
  const regions = [...new Set(["Udaipur", ...configuredCities])].map((cityName) => ({
    city: cityName,
    slug: toCitySlug(cityName),
    status: cityName.toLowerCase() === "udaipur" ? "live-operational" : "expansion-ready",
  }));
  res.json({ ok: true, items: regions });
});
app.post("/api/franchise/requests", auth, async (req, res) => {
  const city = txt(req.body?.city || req.body?.region);
  const investmentBudget = num(req.body?.investmentBudget, 0);
  if (!city) return res.status(400).json({ ok: false, message: "City is required for franchise request." });
  if (investmentBudget <= 0) return res.status(400).json({ ok: false, message: "Investment budget required." });

  const record = {
    id: nextId("franchise"),
    userId: req.user.id,
    userName: req.user.name,
    city,
    experienceYears: num(req.body?.experienceYears, 0),
    teamSize: num(req.body?.teamSize, 0),
    officeAddress: txt(req.body?.officeAddress),
    investmentBudget,
    initialFeePotential: Math.max(0, Math.round(investmentBudget * 0.08)),
    notes: txt(req.body?.notes),
    status: "screening",
    createdAt: now(),
    updatedAt: now(),
  };
  db.franchiseRequests.unshift(record);
  db.users.filter((u) => u.role === "admin").forEach((a) => pushNoti(a.id, "New Franchise Request", `${req.user.name} requested franchise for ${city}.`, "franchise"));
  await save();
  res.status(201).json({ ok: true, request: record });
});
app.get("/api/franchise/requests", auth, (req, res) => {
  const items = req.user.role === "admin"
    ? [...db.franchiseRequests]
    : db.franchiseRequests.filter((item) => item.userId === req.user.id);
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ ok: true, total: items.length, items });
});
app.post("/api/admin/franchise/requests/:id/status", auth, admin, async (req, res) => {
  const request = db.franchiseRequests.find((item) => item.id === req.params.id);
  if (!request) return res.status(404).json({ ok: false, message: "Franchise request not found." });
  const status = txt(req.body?.status || "");
  if (!status) return res.status(400).json({ ok: false, message: "Status is required." });
  request.status = status;
  request.adminNote = txt(req.body?.adminNote);
  request.updatedAt = now();
  await save();
  if (request.userId) pushNoti(request.userId, "Franchise Request Updated", `Your franchise request for ${request.city} is now "${status}".`, "franchise");
  res.json({ ok: true, request });
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
  const requesterRole = txt(req.user?.role).toLowerCase();
  if (!sealedBidAllowedRoles.has(requesterRole)) {
    return res.status(403).json({ ok: false, message: "Only buyer/seller accounts can place sealed bids." });
  }
  const submitRate = enforceRateLimit({
    scope: "sealed-bid-submit",
    key: `${txt(req.user?.id)}:${requestIp(req)}`,
    limit: 8,
    windowMs: 10 * 60 * 1000,
  });
  if (!submitRate.allowed) {
    res.setHeader("Retry-After", String(submitRate.retryAfterSec));
    return res.status(429).json({ ok: false, message: "Too many bid submissions. Please wait and retry.", retryAfterSec: submitRate.retryAfterSec });
  }

  const propertyId = txt(req.body?.propertyId);
  if (!propertyId) return res.status(400).json({ ok: false, message: "propertyId is required." });
  const p = db.properties.find((x) => x.id === propertyId);
  if (!p) return res.status(404).json({ ok: false, message: "Property not found." });
  if (txt(p.status).toLowerCase() && txt(p.status).toLowerCase() !== "approved") {
    return res.status(403).json({ ok: false, message: "Bidding is allowed only on approved properties." });
  }
  if (txt(p.ownerId) && txt(p.ownerId) === txt(req.user.id)) {
    return res.status(403).json({ ok: false, message: "Property owner cannot bid on own listing." });
  }
  const amount = Math.round(num(req.body?.amount, 0));
  if (amount <= 0) return res.status(400).json({ ok: false, message: "Valid positive bid amount required." });
  if (amount > sealedBidMaxAmount) {
    return res.status(400).json({ ok: false, message: `Bid amount too high. Maximum allowed is ${sealedBidMaxAmount.toLocaleString("en-IN")}.` });
  }

  const recentBid = [...db.bids]
    .map((entry) => normalizeBidRecord(entry))
    .filter((entry) => entry.propertyId === propertyId && entry.bidderId === req.user.id)
    .sort((a, b) => toEpoch(b.createdAt) - toEpoch(a.createdAt))[0] || null;
  if (recentBid && Date.now() - toEpoch(recentBid.createdAt) < sealedBidRepeatWindowMs) {
    return res.status(429).json({ ok: false, message: "Repeated bid attempt detected. Please wait before retrying." });
  }

  const hasExistingActiveBid = db.bids.some((row) => {
    const bid = normalizeBidRecord(row);
    return bid.propertyId === propertyId && bid.bidderId === req.user.id && bid.status !== "Rejected";
  });
  if (hasExistingActiveBid) {
    return res.status(409).json({ ok: false, message: "You already have an active sealed bid for this property." });
  }

  const createdAt = now();
  const security = buildBidSecurityMeta({
    req,
    propertyId,
    bidderId: req.user.id,
    amount,
    createdAt,
  });
  const b = {
    id: nextId("bid"),
    propertyId,
    propertyTitle: txt(p.title || "Property"),
    amount,
    bidderId: req.user.id,
    bidderName: req.user.name,
    bidderRole: requesterRole,
    status: "Submitted",
    sealed: true,
    adminVisible: true,
    isWinningBid: false,
    winnerRevealed: false,
    createdAt,
    updatedAt: createdAt,
    decisionHistory: [],
    security,
  };
  db.bids.push(b);
  if (p.ownerId && p.ownerId !== req.user.id) {
    pushNoti(p.ownerId, "New Sealed Bid Submitted", `A hidden bid has been submitted for ${b.propertyTitle}.`, "bid");
  }
  db.users
    .filter((u) => u.role === "admin")
    .forEach((a) => pushNoti(a.id, "New Sealed Bid", `${req.user.name} placed a sealed bid on ${b.propertyTitle}.`, "bid"));
  await save();
  res.status(201).json({ ok: true, bidId: b.id, propertyId, status: b.status, sealed: true });
});
app.get("/api/sealed-bids/mine", auth, (req, res) => {
  const items = db.bids
    .map((b) => normalizeBidRecord(b))
    .filter((b) => b.bidderId === req.user.id)
    .sort((a, b) => toEpoch(b.createdAt) - toEpoch(a.createdAt))
    .map((b) => sanitizeBidForBidder(b));
  res.json({ ok: true, total: items.length, items });
});
app.get("/api/sealed-bids/summary", auth, admin, (_req, res) => {
  const grouped = new Map();
  db.bids.map((b) => normalizeBidRecord(b)).forEach((bid) => {
    const bucket = grouped.get(bid.propertyId) || [];
    bucket.push(bid);
    grouped.set(bid.propertyId, bucket);
  });
  const items = [...grouped.entries()].map(([propertyId, bids]) => {
    const sorted = [...bids].sort(sortBidsHighToLow);
    const top = sorted[0] || null;
    const property = db.properties.find((p) => p.id === propertyId);
    return {
      propertyId,
      propertyTitle: txt(property?.title || top?.propertyTitle || "Property"),
      totalBids: bids.length,
      status: summarizeSealedBidStatus(bids),
      winningBidRevealed: !!top?.winnerRevealed,
      updatedAt: top?.updatedAt || top?.createdAt || now(),
    };
  }).sort((a, b) => toEpoch(b.updatedAt) - toEpoch(a.updatedAt));
  res.json({ ok: true, totalProperties: items.length, items });
});
app.get("/api/sealed-bids/reveal", auth, admin, (_req, res) => {
  const grouped = new Map();
  db.bids.map((b) => normalizeBidRecord(b)).forEach((bid) => {
    const bucket = grouped.get(bid.propertyId) || [];
    bucket.push(bid);
    grouped.set(bid.propertyId, bucket);
  });
  const winners = [...grouped.entries()].map(([propertyId, bids]) => {
    const sorted = [...bids].sort(sortBidsHighToLow);
    const winnerBid = sorted[0] || null;
    return {
      propertyId,
      propertyTitle: txt(db.properties.find((p) => p.id === propertyId)?.title || winnerBid?.propertyTitle || "Property"),
      totalBids: sorted.length,
      status: summarizeSealedBidStatus(sorted),
      winningBidRevealed: !!winnerBid?.winnerRevealed,
      winnerBid: winnerBid ? sanitizeBidForAdmin(winnerBid) : null,
      bids: sorted.map((bid) => sanitizeBidForAdmin(bid)),
    };
  }).sort((a, b) => toEpoch(b.winnerBid?.updatedAt || b.winnerBid?.createdAt) - toEpoch(a.winnerBid?.updatedAt || a.winnerBid?.createdAt));
  res.json({ ok: true, totalProperties: winners.length, winners });
});
app.get("/api/sealed-bids/admin", auth, admin, (_req, res) => {
  const grouped = new Map();
  db.bids.map((b) => normalizeBidRecord(b)).forEach((bid) => {
    const bucket = grouped.get(bid.propertyId) || [];
    bucket.push(bid);
    grouped.set(bid.propertyId, bucket);
  });
  const items = [...grouped.entries()].map(([propertyId, bids]) => {
    const sorted = [...bids].sort(sortBidsHighToLow);
    const winnerBid = sorted[0] || null;
    return {
      propertyId,
      propertyTitle: txt(db.properties.find((p) => p.id === propertyId)?.title || winnerBid?.propertyTitle || "Property"),
      totalBids: sorted.length,
      status: summarizeSealedBidStatus(sorted),
      winningBidRevealed: !!winnerBid?.winnerRevealed,
      winnerBid: winnerBid ? sanitizeBidForAdmin(winnerBid) : null,
      bids: sorted.map((bid) => sanitizeBidForAdmin(bid)),
    };
  }).sort((a, b) => toEpoch(b.winnerBid?.updatedAt || b.winnerBid?.createdAt) - toEpoch(a.winnerBid?.updatedAt || a.winnerBid?.createdAt));
  res.json({ ok: true, totalProperties: items.length, items });
});
app.get("/api/sealed-bids/winner/:propertyId", authOpt, (req, res) => {
  const propertyId = txt(req.params.propertyId || req.query?.propertyId);
  if (!propertyId) return res.status(400).json({ ok: false, message: "propertyId is required." });
  const bids = bidsByPropertyId(propertyId);
  if (!bids.length) return res.status(404).json({ ok: false, message: "No bids found for property." });
  const winner = resolveHighestBid(bids);
  if (!winner) return res.status(404).json({ ok: false, message: "No winning bid available." });
  const isAdminUser = req.user?.role === "admin";
  if (!isAdminUser && !winner.winnerRevealed) {
    return res.status(403).json({ ok: false, message: "Winning bid not revealed by admin yet." });
  }
  const property = db.properties.find((p) => p.id === propertyId);
  res.json({
    ok: true,
    propertyId,
    propertyTitle: txt(property?.title || winner.propertyTitle || "Property"),
    status: summarizeSealedBidStatus(bids),
    ...(isAdminUser ? { totalBids: bids.length } : {}),
    winner: isAdminUser ? sanitizeBidForAdmin(winner) : publicWinnerSnapshot(winner),
  });
});
app.post("/api/sealed-bids/decision", auth, admin, async (req, res) => {
  const propertyId = txt(req.body?.propertyId);
  const action = txt(req.body?.action).toLowerCase();
  const decisionReason = normalizeDecisionReason(req.body?.decisionReason || req.body?.note);
  if (!propertyId || !["accept", "reject", "reveal"].includes(action)) {
    return res.status(400).json({ ok: false, message: "propertyId and valid action required." });
  }
  if (decisionReason.length < sealedBidDecisionReasonMin) {
    return res.status(400).json({ ok: false, message: `decisionReason must be at least ${sealedBidDecisionReasonMin} characters.` });
  }
  const decisionRate = enforceRateLimit({
    scope: "sealed-bid-decision",
    key: `${txt(req.user?.id)}:${requestIp(req)}`,
    limit: 40,
    windowMs: 10 * 60 * 1000,
  });
  if (!decisionRate.allowed) {
    res.setHeader("Retry-After", String(decisionRate.retryAfterSec));
    return res.status(429).json({ ok: false, message: "Too many admin decisions. Please wait and retry.", retryAfterSec: decisionRate.retryAfterSec });
  }

  const items = db.bids.filter((b) => txt(b.propertyId) === propertyId);
  if (!items.length) return res.status(404).json({ ok: false, message: "No bids found for property." });
  const normalizedItems = items.map((entry) => normalizeBidRecord(entry));
  const winner = resolveHighestBid(normalizedItems);
  if (!winner) return res.status(404).json({ ok: false, message: "No winning bid available." });
  const winnerId = winner.id;
  const decisionAt = now();
  const appendDecisionTrail = (entry, normalizedAction) => {
    const currentHistory = safeArr(entry.decisionHistory);
    const prevIntegrityHash = txt(currentHistory[currentHistory.length - 1]?.integrityHash);
    const nextEntry = {
      action: normalizedAction,
      by: req.user.id,
      byName: req.user.name,
      byRole: "admin",
      at: decisionAt,
      reason: decisionReason,
      prevIntegrityHash,
      integrityHash: createDecisionIntegrityHash({
        bidId: txt(entry.id),
        action: normalizedAction,
        by: req.user.id,
        at: decisionAt,
        reason: decisionReason,
        prevIntegrityHash,
      }),
    };
    entry.decisionHistory = [...currentHistory, nextEntry];
  };

  if (action === "accept") {
    items.forEach((entry) => {
      const isWinner = entry.id === winnerId;
      entry.status = isWinner ? "Accepted" : "Rejected";
      entry.isWinningBid = isWinner;
      entry.winnerRevealed = false;
      entry.updatedAt = decisionAt;
      entry.decisionByAdminId = req.user.id;
      entry.decisionByAdminName = req.user.name;
      entry.decisionAt = decisionAt;
      appendDecisionTrail(entry, "accept");
    });
  } else if (action === "reject") {
    items.forEach((entry) => {
      entry.status = "Rejected";
      entry.isWinningBid = false;
      entry.winnerRevealed = false;
      entry.updatedAt = decisionAt;
      entry.decisionByAdminId = req.user.id;
      entry.decisionByAdminName = req.user.name;
      entry.decisionAt = decisionAt;
      appendDecisionTrail(entry, "reject");
    });
  } else {
    items.forEach((entry) => {
      const isWinner = entry.id === winnerId;
      entry.isWinningBid = isWinner;
      if (isWinner) {
        entry.winnerRevealed = true;
        entry.status = normalizeBidStatus(entry.status) === "Accepted" ? "Accepted" : "Revealed";
      } else if (normalizeBidStatus(entry.status) === "Revealed") {
        entry.status = "Submitted";
      }
      entry.updatedAt = decisionAt;
      entry.decisionByAdminId = req.user.id;
      entry.decisionByAdminName = req.user.name;
      entry.decisionAt = decisionAt;
      appendDecisionTrail(entry, "reveal");
    });
  }

  const property = db.properties.find((x) => x.id === propertyId);
  const bidders = [...new Set(items.map((entry) => txt(entry.bidderId)).filter(Boolean))];
  if (action === "accept") {
    bidders.forEach((bidderId) => {
      const isWinner = items.some((entry) => entry.id === winnerId && txt(entry.bidderId) === bidderId);
      pushNoti(
        bidderId,
        isWinner ? "Sealed Bid Accepted" : "Sealed Bid Result",
        isWinner
          ? `Your sealed bid for ${txt(property?.title || winner.propertyTitle)} has been accepted by admin.`
          : `Your sealed bid for ${txt(property?.title || winner.propertyTitle)} was not selected.`,
        "bid",
      );
    });
    if (property?.ownerId) {
      pushNoti(property.ownerId, "Winning Bid Accepted", `Admin accepted highest bid for ${txt(property.title || winner.propertyTitle)}.`, "bid");
    }
  } else if (action === "reject") {
    bidders.forEach((bidderId) => pushNoti(bidderId, "Sealed Bids Rejected", `All sealed bids for ${txt(property?.title || winner.propertyTitle)} were rejected by admin.`, "bid"));
    if (property?.ownerId) {
      pushNoti(property.ownerId, "All Bids Rejected", `Admin rejected all bids for ${txt(property.title || winner.propertyTitle)}.`, "bid");
    }
  } else {
    bidders.forEach((bidderId) => pushNoti(bidderId, "Winning Bid Revealed", `Admin revealed winning bid for ${txt(property?.title || winner.propertyTitle)}.`, "bid"));
    if (property?.ownerId) {
      pushNoti(property.ownerId, "Winning Bid Revealed", `Winning sealed bid has been revealed for ${txt(property.title || winner.propertyTitle)}.`, "bid");
    }
  }

  await save();
  const refreshed = bidsByPropertyId(propertyId).sort(sortBidsHighToLow);
  const winnerBid = resolveHighestBid(refreshed);
  res.json({
    ok: true,
    action,
    decisionReason,
    propertyId,
    status: summarizeSealedBidStatus(refreshed),
    winnerBid: winnerBid ? sanitizeBidForAdmin(winnerBid) : null,
    totalBids: refreshed.length,
    items: refreshed.map((entry) => sanitizeBidForAdmin(entry)),
  });
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

app.get("/api/bootstrap", (_req, res) => {
  applyFeaturedPricingToPlans(db?.adminConfig?.featuredPricing || {});
  res.json({
    ok: true,
    plans,
    legalTemplates,
    documentationServices,
    loanPartnerBanks,
    ecosystemServiceCatalog,
    localities: fallbackLocalities,
    categories: db.adminConfig.categories,
    cities: db.adminConfig.cities,
    featuredPricing: featuredPricingSnapshotFromPlans(),
  });
});
app.get("/api/export", auth, admin, (_req, res) => res.json({ ok: true, exportedAt: now(), data: db }));

liveRouteMap.forEach((routeItem) => {
  app.get(routeItem.path, (_req, res) => res.sendFile(resolveWebFile(routeItem.file)));
});

app.use("/api", (_req, res) => res.status(404).json({ ok: false, message: "API route not found." }));
app.get("*", (_req, res) => res.sendFile(resolveWebFile("index.html")));

await load();
if (!db.users.some((u) => u.role === "admin")) {
  const adminPasswordFromEnv = String(process.env.DEFAULT_ADMIN_PASSWORD || "").trim();
  if (NODE_ENV === "production" && !adminPasswordFromEnv) {
    throw new Error("DEFAULT_ADMIN_PASSWORD must be configured in production for initial admin seed.");
  }
  const bootstrapPassword = adminPasswordFromEnv || "Admin@123";
  db.users.push({
    id: nextId("user"),
    role: "admin",
    name: "PropertySetu Admin",
    email: "admin@propertysetu.in",
    mobile: "9999999999",
    passwordHash: await bcrypt.hash(bootstrapPassword, 10),
    verified: true,
    subscriptionPlan: "agent-pro",
    tokenVersion: 1,
    createdAt: now(),
    updatedAt: now(),
    lastLoginAt: null,
  });
  await save();
}

app.listen(PORT, () => {
  console.log(`PropertySetu server running on http://localhost:${PORT}`);
});
