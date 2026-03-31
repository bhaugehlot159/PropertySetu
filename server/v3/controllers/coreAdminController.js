import mongoose from "mongoose";
import CoreAdminActionAudit from "../models/CoreAdminActionAudit.js";
import CoreDocumentationRequest from "../models/CoreDocumentationRequest.js";
import CoreFranchiseRequest from "../models/CoreFranchiseRequest.js";
import CoreLoanAssistanceLead from "../models/CoreLoanAssistanceLead.js";
import CoreOwnerVerification from "../models/CoreOwnerVerification.js";
import CoreProperty from "../models/CoreProperty.js";
import CoreRentAgreementDraft from "../models/CoreRentAgreementDraft.js";
import CoreServicePartnerBooking from "../models/CoreServicePartnerBooking.js";
import CoreSubscription from "../models/CoreSubscription.js";
import CoreUser from "../models/CoreUser.js";
import CoreValuationRequest from "../models/CoreValuationRequest.js";
import { proRuntime } from "../../config/proRuntime.js";
import { proMemoryStore } from "../../runtime/proMemoryStore.js";
import { notifyCoreServiceStatusUpdate } from "./coreServiceController.js";
import { normalizeCoreProperty, normalizeCoreUser, toId } from "../utils/coreMappers.js";

const FEATURED_PLAN_DEFAULTS = {
  "featured-7": { label: "Featured Listing - 7 Days", amount: 299, cycleDays: 7 },
  "featured-30": { label: "Featured Listing - 30 Days", amount: 999, cycleDays: 30 }
};

const DEFAULT_ADMIN_CONFIG = {
  categories: [
    "House",
    "Apartment / Flat",
    "Villa",
    "Plot / Vadi",
    "Farm House",
    "Commercial",
    "Office",
    "Shop / Retail",
    "PG / Hostel",
    "Warehouse / Godown",
    "Agriculture Land",
    "Property Care",
    "Home Maintenance",
    "Home Watch",
    "Industrial",
    "Co-living",
    "Other"
  ],
  cities: ["Udaipur"],
  featuredPricing: FEATURED_PLAN_DEFAULTS
};

const CORE_ADMIN_ACTION_REASON_MIN = Math.max(
  8,
  Number(process.env.CORE_ADMIN_ACTION_REASON_MIN || 12)
);
const CORE_ADMIN_ACTION_AUDIT_MAX_ITEMS = Math.max(
  200,
  Number(process.env.CORE_ADMIN_ACTION_AUDIT_MAX_ITEMS || 4000)
);
const CORE_ADMIN_RISKY_DOC_STATUS = new Set([
  "rejected",
  "cancelled",
  "blocked",
  "suspended"
]);
const CORE_ADMIN_RISKY_LOAN_STATUS = new Set([
  "rejected",
  "cancelled",
  "sanctioned",
  "approved",
  "disbursed"
]);
const CORE_ADMIN_RISKY_ECOSYSTEM_STATUS = new Set([
  "rejected",
  "cancelled",
  "blocked"
]);
const CORE_ADMIN_RISKY_FRANCHISE_STATUS = new Set([
  "rejected",
  "cancelled",
  "declined",
  "approved"
]);

function text(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeStatus(value) {
  return text(value).toLowerCase();
}

function normalizeStatusKey(value) {
  return normalizeStatus(value).replace(/[\s_]+/g, "-");
}

function ensureArrayStore(key) {
  if (!Array.isArray(proMemoryStore[key])) {
    proMemoryStore[key] = [];
  }
  return proMemoryStore[key];
}

function normalizeFeaturedPricing(raw = {}) {
  const out = {};
  Object.entries(FEATURED_PLAN_DEFAULTS).forEach(([planId, defaults]) => {
    const item = raw && typeof raw === "object" && !Array.isArray(raw) ? raw[planId] || {} : {};
    out[planId] = {
      label: text(item.label, defaults.label),
      amount: Math.max(0, Math.round(numberValue(item.amount, defaults.amount))),
      cycleDays: Math.max(1, Math.round(numberValue(item.cycleDays, defaults.cycleDays)))
    };
  });
  return out;
}

function uniqueStrings(items = []) {
  const seen = new Set();
  const out = [];
  (items || []).forEach((item) => {
    const value = text(item);
    const key = value.toLowerCase();
    if (!value || seen.has(key)) return;
    seen.add(key);
    out.push(value);
  });
  return out;
}

function getAdminConfigMemory() {
  const existing =
    proMemoryStore.coreAdminConfig &&
    typeof proMemoryStore.coreAdminConfig === "object" &&
    !Array.isArray(proMemoryStore.coreAdminConfig)
      ? proMemoryStore.coreAdminConfig
      : {};
  const next = {
    categories: uniqueStrings(existing.categories || DEFAULT_ADMIN_CONFIG.categories),
    cities: uniqueStrings(existing.cities || DEFAULT_ADMIN_CONFIG.cities),
    featuredPricing: normalizeFeaturedPricing(existing.featuredPricing || DEFAULT_ADMIN_CONFIG.featuredPricing)
  };
  if (!next.cities.some((city) => city.toLowerCase() === "udaipur")) {
    next.cities.unshift("Udaipur");
  }
  proMemoryStore.coreAdminConfig = next;
  return next;
}

function inferPropertyStatus(property = {}) {
  const normalized = normalizeCoreProperty(property) || {};
  return text(property?.status || normalized.status, normalized.verified ? "Approved" : "Pending Approval");
}

function normalizeAdminProperty(property = {}) {
  const normalized = normalizeCoreProperty(property) || {};
  return {
    ...normalized,
    status: inferPropertyStatus(property),
    locality: text(normalized.location)
  };
}

function inferPlanType(subscription = {}) {
  const direct = normalizeStatus(subscription.planType);
  if (["featured", "care", "verification", "agent", "subscription"].includes(direct)) return direct;
  const planName = normalizeStatus(subscription.planName);
  if (planName.includes("featured")) return "featured";
  if (planName.includes("care")) return "care";
  if (planName.includes("verified")) return "verification";
  if (planName.includes("agent")) return "agent";
  return "subscription";
}

function sumAmount(items = []) {
  return (items || []).reduce((sum, item) => sum + numberValue(item.amount, 0), 0);
}

function listReportsRaw() {
  const primary = ensureArrayStore("coreReports");
  const legacy = ensureArrayStore("reports");
  const map = new Map();
  [...primary, ...legacy].forEach((item) => {
    const id = text(item.id || item._id);
    if (!id) return;
    map.set(id, item);
  });
  return [...map.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function toCoreAdminAuditId(row = {}) {
  return text(row.id || row.auditId || row._id);
}

function normalizeCoreAdminAuditRow(row = {}) {
  return {
    id: toCoreAdminAuditId(row),
    action: text(row.action),
    targetId: text(row.targetId),
    status: text(row.status, "success"),
    severity: text(row.severity, "high"),
    reason: text(row.reason).replace(/\s+/g, " ").slice(0, 300),
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? row.metadata
        : {},
    adminId: toId(row.adminId),
    adminRole: text(row.adminRole, "admin"),
    clientIp: text(row.clientIp),
    userAgent: text(row.userAgent).slice(0, 180),
    createdAt: asIso(row.createdAt || row.occurredAt),
    occurredAt: asIso(row.occurredAt || row.createdAt)
  };
}

async function listCoreAdminActionAuditRaw(limit = CORE_ADMIN_ACTION_AUDIT_MAX_ITEMS) {
  const safeLimit = Math.min(CORE_ADMIN_ACTION_AUDIT_MAX_ITEMS, Math.max(1, numberValue(limit, 200)));
  const memoryRows = [...ensureArrayStore("coreAdminActionAudit")]
    .map((item) => normalizeCoreAdminAuditRow(item))
    .filter((item) => Boolean(item.id));

  if (!proRuntime.dbConnected) {
    return memoryRows
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, safeLimit);
  }

  try {
    const dbRowsRaw = await CoreAdminActionAudit.find({})
      .sort({ occurredAt: -1, createdAt: -1 })
      .limit(safeLimit)
      .lean();
    const merged = new Map();
    [...dbRowsRaw.map((item) => normalizeCoreAdminAuditRow(item)), ...memoryRows].forEach((item) => {
      const id = toCoreAdminAuditId(item);
      if (!id || merged.has(id)) return;
      merged.set(id, item);
    });
    return [...merged.values()]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, safeLimit);
  } catch {
    return memoryRows
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, safeLimit);
  }
}

async function listCoreUsersRaw(limit = 200) {
  if (proRuntime.dbConnected) {
    return CoreUser.find({}).sort({ createdAt: -1 }).limit(limit).lean();
  }
  return [...ensureArrayStore("coreUsers")].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
}

async function listCorePropertiesRaw(limit = 1000) {
  if (proRuntime.dbConnected) {
    return CoreProperty.find({}).sort({ createdAt: -1 }).limit(limit).lean();
  }
  return [...ensureArrayStore("coreProperties")].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
}

async function listCoreSubscriptionsRaw(limit = 2000) {
  if (proRuntime.dbConnected) {
    return CoreSubscription.find({}).sort({ createdAt: -1 }).limit(limit).lean();
  }
  return [...ensureArrayStore("coreSubscriptions")].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
}

async function listCoreOwnerVerificationRaw(limit = 2000) {
  if (proRuntime.dbConnected) {
    return CoreOwnerVerification.find({}).sort({ createdAt: -1 }).limit(limit).lean();
  }
  return [...ensureArrayStore("coreOwnerVerificationRequests")].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
}

function listStoreRows(key) {
  return [...ensureArrayStore(key)].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function setStoreStatus(key, id, status, extra = {}) {
  const rows = ensureArrayStore(key);
  const index = rows.findIndex((item) => toId(item.id || item._id) === toId(id));
  if (index < 0) return null;
  rows[index] = { ...rows[index], status, ...extra, updatedAt: new Date().toISOString() };
  return rows[index];
}

function toPlain(doc) {
  if (!doc) return null;
  return typeof doc.toObject === "function" ? doc.toObject() : doc;
}

function normalizeServiceRow(doc) {
  const row = toPlain(doc);
  if (!row) return null;
  const id = toId(row._id || row.id);
  return {
    ...row,
    _id: id,
    id,
    userId: toId(row.userId),
    propertyId: toId(row.propertyId),
    createdAt: asIso(row.createdAt),
    updatedAt: asIso(row.updatedAt)
  };
}

function mergeDbMemoryRows(dbRows = [], storeKey = "", limit = 3000) {
  const merged = new Map();
  const memoryRows = ensureArrayStore(storeKey);
  [...(dbRows || []), ...memoryRows].forEach((row) => {
    const normalized = normalizeServiceRow(row);
    const id = toId(normalized?._id || normalized?.id);
    if (!normalized || !id || merged.has(id)) return;
    merged.set(id, normalized);
  });
  return [...merged.values()]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, limit);
}

async function listServiceRowsRaw({
  model,
  storeKey,
  limit = 3000
} = {}) {
  if (proRuntime.dbConnected) {
    const dbRows = await model.find({}).sort({ createdAt: -1 }).limit(limit).lean();
    return mergeDbMemoryRows(dbRows, storeKey, limit);
  }
  return listStoreRows(storeKey).slice(0, limit).map((row) => normalizeServiceRow(row));
}

async function updateServiceStatus({
  model,
  storeKey,
  id,
  status,
  extra = {}
} = {}) {
  const normalizedId = toId(id);
  if (!normalizedId) return null;

  if (proRuntime.dbConnected && mongoose.Types.ObjectId.isValid(normalizedId)) {
    const updatePayload = {
      ...extra,
      status,
      updatedAt: new Date()
    };
    Object.keys(updatePayload).forEach((key) => {
      if (typeof updatePayload[key] === "undefined") {
        delete updatePayload[key];
      }
    });
    const updated = await model.findByIdAndUpdate(
      normalizedId,
      { $set: updatePayload },
      { new: true }
    );
    if (updated) return normalizeServiceRow(updated);
  }

  return normalizeServiceRow(setStoreStatus(storeKey, normalizedId, status, extra));
}

function getClientIp(req) {
  const forwarded = req?.headers?.["x-forwarded-for"];
  if (Array.isArray(forwarded) && forwarded.length) {
    return text(forwarded[0]).split(",")[0].trim();
  }
  if (text(forwarded)) {
    return text(forwarded).split(",")[0].trim();
  }
  return text(req?.ip || req?.socket?.remoteAddress || "0.0.0.0");
}

function getAdminReason(req) {
  return text(
    req?.body?.moderationReason ||
      req?.body?.reason ||
      req?.body?.adminReason ||
      req?.body?.adminNote ||
      req?.query?.moderationReason ||
      req?.query?.reason ||
      req?.query?.adminReason ||
      req?.query?.adminNote
  );
}

function requireAdminReason(req, res, actionLabel = "This action") {
  const reason = getAdminReason(req);
  if (reason.length >= CORE_ADMIN_ACTION_REASON_MIN) {
    return reason;
  }
  res.status(400).json({
    success: false,
    message: `${actionLabel} requires reason/moderationReason with minimum ${CORE_ADMIN_ACTION_REASON_MIN} characters.`
  });
  return null;
}

function joinAdminNote(adminNote = "", reason = "") {
  const safeAdminNote = text(adminNote);
  const safeReason = text(reason);
  if (!safeReason) return safeAdminNote;
  if (!safeAdminNote) return safeReason;
  if (safeAdminNote.toLowerCase().includes(safeReason.toLowerCase())) return safeAdminNote;
  return `${safeAdminNote} | reason: ${safeReason}`.slice(0, 500);
}

function trackCoreAdminAction(req, payload = {}) {
  const rows = ensureArrayStore("coreAdminActionAudit");
  const auditRow = normalizeCoreAdminAuditRow({
    id: `admin-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action: text(payload.action),
    targetId: text(payload.targetId),
    status: text(payload.status),
    severity: text(payload.severity, "high"),
    reason: text(payload.reason),
    metadata:
      payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
        ? payload.metadata
        : {},
    adminId: toId(req?.coreUser?.id),
    adminRole: text(req?.coreUser?.role, "admin"),
    clientIp: getClientIp(req),
    userAgent: text(req?.headers?.["user-agent"]).slice(0, 180),
    occurredAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  });
  rows.unshift(auditRow);
  if (rows.length > CORE_ADMIN_ACTION_AUDIT_MAX_ITEMS) {
    rows.length = CORE_ADMIN_ACTION_AUDIT_MAX_ITEMS;
  }

  if (proRuntime.dbConnected) {
    const adminId = toId(req?.coreUser?.id);
    const adminObjectId = mongoose.Types.ObjectId.isValid(adminId) ? adminId : null;
    CoreAdminActionAudit.create({
      auditId: auditRow.id,
      action: auditRow.action,
      targetId: auditRow.targetId,
      status: auditRow.status,
      severity: auditRow.severity,
      reason: auditRow.reason,
      metadata: auditRow.metadata,
      adminId: adminObjectId,
      adminRole: auditRow.adminRole,
      clientIp: auditRow.clientIp,
      userAgent: auditRow.userAgent,
      occurredAt: auditRow.createdAt || new Date().toISOString()
    }).catch(() => {});
  }
}

export async function listCoreAdminProperties(req, res, next) {
  try {
    const statusFilter = normalizeStatus(req.query.status);
    let items = (await listCorePropertiesRaw(1000)).map((item) => normalizeAdminProperty(item));
    if (statusFilter) {
      items = items.filter((item) => normalizeStatus(item.status) === statusFilter);
    }
    return res.json({ success: true, total: items.length, items });
  } catch (error) {
    return next(error);
  }
}

export async function getCoreAdminOverview(_req, res, next) {
  try {
    const [users, properties, subscriptions, ownerVerifications] = await Promise.all([
      listCoreUsersRaw(5000),
      listCorePropertiesRaw(5000),
      listCoreSubscriptionsRaw(5000),
      listCoreOwnerVerificationRaw(5000)
    ]);
    const [
      documentationRequests,
      loanAssistanceLeads,
      servicePartnerBookings,
      valuationRequests,
      rentAgreementDrafts,
      franchiseRequests
    ] = await Promise.all([
      listServiceRowsRaw({
        model: CoreDocumentationRequest,
        storeKey: "documentationRequests",
        limit: 5000
      }),
      listServiceRowsRaw({
        model: CoreLoanAssistanceLead,
        storeKey: "loanAssistanceLeads",
        limit: 5000
      }),
      listServiceRowsRaw({
        model: CoreServicePartnerBooking,
        storeKey: "servicePartnerBookings",
        limit: 5000
      }),
      listServiceRowsRaw({
        model: CoreValuationRequest,
        storeKey: "valuationRequests",
        limit: 5000
      }),
      listServiceRowsRaw({
        model: CoreRentAgreementDraft,
        storeKey: "rentAgreementDrafts",
        limit: 5000
      }),
      listServiceRowsRaw({
        model: CoreFranchiseRequest,
        storeKey: "franchiseRequests",
        limit: 5000
      })
    ]);
    const normalizedProperties = properties.map((item) => normalizeAdminProperty(item));
    const nowTime = Date.now();
    const activeSubs = subscriptions.filter((item) => {
      const endDate = new Date(item.endDate || item.updatedAt || item.createdAt);
      return !Number.isNaN(endDate.getTime()) && endDate.getTime() >= nowTime;
    });

    return res.json({
      success: true,
      overview: {
        users: users.length,
        blockedUsers: users.filter((item) => Boolean(item.blocked)).length,
        pending: normalizedProperties.filter((item) => normalizeStatus(item.status) !== "approved").length,
        approved: normalizedProperties.filter((item) => normalizeStatus(item.status) === "approved").length,
        featured: normalizedProperties.filter((item) => Boolean(item.featured)).length,
        ownerVerificationPending: ownerVerifications.filter((item) => normalizeStatus(item.status) === "pending review").length,
        careRequests: ensureArrayStore("corePropertyCareRequests").length + ensureArrayStore("propertyCareRequests").length,
        legalRequests: ensureArrayStore("legalRequests").length,
        documentationRequests: documentationRequests.length,
        loanAssistanceLeads: loanAssistanceLeads.length,
        servicePartnerBookings: servicePartnerBookings.length,
        valuationRequests: valuationRequests.length,
        rentAgreementDrafts: rentAgreementDrafts.length,
        franchiseRequests: franchiseRequests.length,
        reports: listReportsRaw().length,
        activeSubs: activeSubs.length,
        totalBids: ensureArrayStore("coreSealedBids").length + ensureArrayStore("sealedBids").length
      }
    });
  } catch (error) {
    return next(error);
  }
}

export function getCoreAdminConfig(_req, res) {
  const config = getAdminConfigMemory();
  return res.json({
    success: true,
    config: {
      categories: [...config.categories],
      cities: [...config.cities],
      featuredPricing: normalizeFeaturedPricing(config.featuredPricing)
    }
  });
}

export function getCoreAdminCategories(_req, res) {
  const config = getAdminConfigMemory();
  return res.json({ success: true, items: [...config.categories] });
}

export function addCoreAdminCategory(req, res) {
  const name = text(req.body?.name);
  if (!name) return res.status(400).json({ success: false, message: "Category name required." });
  const config = getAdminConfigMemory();
  if (!config.categories.some((item) => item.toLowerCase() === name.toLowerCase())) {
    config.categories.push(name);
  }
  proMemoryStore.coreAdminConfig = config;
  return res.json({ success: true, items: [...config.categories] });
}

export function removeCoreAdminCategory(req, res) {
  const name = text(req.query?.name || req.body?.name || req.params?.name);
  if (!name) return res.status(400).json({ success: false, message: "Category name required." });
  const reason = requireAdminReason(req, res, "Removing category");
  if (!reason) return null;
  const config = getAdminConfigMemory();
  const before = config.categories.length;
  config.categories = config.categories.filter((item) => item.toLowerCase() !== name.toLowerCase());
  if (before === config.categories.length) return res.status(404).json({ success: false, message: "Category not found." });
  proMemoryStore.coreAdminConfig = config;
  trackCoreAdminAction(req, {
    action: "admin-category-remove",
    targetId: name,
    status: "success",
    reason
  });
  return res.json({ success: true, items: [...config.categories] });
}

export function getCoreAdminCities(_req, res) {
  const config = getAdminConfigMemory();
  return res.json({ success: true, items: [...config.cities] });
}

export function addCoreAdminCity(req, res) {
  const city = text(req.body?.city);
  if (!city) return res.status(400).json({ success: false, message: "City name required." });
  const config = getAdminConfigMemory();
  if (!config.cities.some((item) => item.toLowerCase() === city.toLowerCase())) {
    config.cities.push(city);
  }
  proMemoryStore.coreAdminConfig = config;
  return res.json({ success: true, items: [...config.cities] });
}

export function removeCoreAdminCity(req, res) {
  const city = text(req.query?.city || req.body?.city || req.params?.city);
  if (!city) return res.status(400).json({ success: false, message: "City name required." });
  const reason = requireAdminReason(req, res, "Removing city");
  if (!reason) return null;
  if (city.toLowerCase() === "udaipur") {
    return res.status(400).json({ success: false, message: "Udaipur live city cannot be removed." });
  }
  const config = getAdminConfigMemory();
  const before = config.cities.length;
  config.cities = config.cities.filter((item) => item.toLowerCase() !== city.toLowerCase());
  if (before === config.cities.length) return res.status(404).json({ success: false, message: "City not found." });
  proMemoryStore.coreAdminConfig = config;
  trackCoreAdminAction(req, {
    action: "admin-city-remove",
    targetId: city,
    status: "success",
    reason
  });
  return res.json({ success: true, items: [...config.cities] });
}

export function getCoreAdminFeaturedPricing(_req, res) {
  const config = getAdminConfigMemory();
  const items = normalizeFeaturedPricing(config.featuredPricing);
  return res.json({
    success: true,
    items,
    plans: Object.entries(items).map(([id, item]) => ({
      id,
      name: item.label,
      amount: item.amount,
      cycleDays: item.cycleDays,
      type: "featured"
    }))
  });
}

export function setCoreAdminFeaturedPricing(req, res) {
  const planId = text(req.body?.planId).toLowerCase();
  if (!FEATURED_PLAN_DEFAULTS[planId]) {
    return res.status(400).json({ success: false, message: "Valid featured plan required (featured-7 or featured-30)." });
  }
  const reason = requireAdminReason(req, res, "Updating featured pricing");
  if (!reason) return null;
  const amount = Number(req.body?.amount);
  const cycleDays = Number(req.body?.cycleDays);
  if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ success: false, message: "Valid amount is required." });
  if (!Number.isFinite(cycleDays) || cycleDays < 1) return res.status(400).json({ success: false, message: "Valid cycleDays is required." });
  const config = getAdminConfigMemory();
  const pricing = normalizeFeaturedPricing(config.featuredPricing);
  const previous = pricing[planId]
    ? { ...pricing[planId] }
    : { ...FEATURED_PLAN_DEFAULTS[planId] };
  pricing[planId] = {
    label: text(req.body?.label, FEATURED_PLAN_DEFAULTS[planId].label),
    amount: Math.round(amount),
    cycleDays: Math.round(cycleDays)
  };
  config.featuredPricing = pricing;
  proMemoryStore.coreAdminConfig = config;
  trackCoreAdminAction(req, {
    action: "admin-featured-pricing-update",
    targetId: planId,
    status: "success",
    reason,
    metadata: {
      previous,
      next: pricing[planId]
    }
  });
  return getCoreAdminFeaturedPricing(req, res);
}

export async function listCoreAdminUsers(req, res, next) {
  try {
    const limit = Math.min(500, Math.max(1, numberValue(req.query.limit, 200)));
    const rows = await listCoreUsersRaw(limit);
    return res.json({ success: true, total: rows.length, items: rows.map((item) => normalizeCoreUser(item)) });
  } catch (error) {
    return next(error);
  }
}

export async function updateCoreAdminUserBlock(req, res, next) {
  try {
    const userId = text(req.params.userId);
    const action = normalizeStatus(req.params.action);
    if (!userId || !["block", "unblock"].includes(action)) {
      return res.status(400).json({ success: false, message: "userId and action(block/unblock) are required." });
    }
    const reason = requireAdminReason(req, res, action === "block" ? "Blocking user" : "Unblocking user");
    if (!reason) return null;
    const blocked = action === "block";
    let updated = null;
    if (proRuntime.dbConnected) {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ success: false, message: "Invalid userId." });
      }
      updated = await CoreUser.findByIdAndUpdate(userId, { $set: { blocked } }, { new: true });
    } else {
      const rows = ensureArrayStore("coreUsers");
      const index = rows.findIndex((item) => toId(item._id || item.id) === userId);
      if (index >= 0) {
        rows[index] = { ...rows[index], blocked, updatedAt: new Date().toISOString() };
        updated = rows[index];
      }
    }
    if (!updated) return res.status(404).json({ success: false, message: "User not found." });
    trackCoreAdminAction(req, {
      action: blocked ? "admin-user-block" : "admin-user-unblock",
      targetId: userId,
      status: "success",
      reason
    });
    return res.json({ success: true, user: normalizeCoreUser(updated) });
  } catch (error) {
    return next(error);
  }
}

export function listCoreAdminReports(_req, res) {
  const items = listReportsRaw().map((item) => ({
    id: text(item.id || item._id),
    propertyId: text(item.propertyId),
    propertyTitle: text(item.propertyTitle),
    reason: text(item.reason),
    status: text(item.status, "open"),
    createdAt: asIso(item.createdAt),
    resolvedAt: asIso(item.resolvedAt)
  }));
  return res.json({ success: true, total: items.length, items });
}

export async function listCoreAdminActionAudit(req, res, next) {
  try {
    const limit = Math.min(1000, Math.max(1, numberValue(req.query.limit, 200)));
    const actionFilter = normalizeStatus(text(req.query.action));
    const targetFilter = normalizeStatus(text(req.query.targetId || req.query.target));
    const statusFilter = normalizeStatus(text(req.query.status));
    const severityFilter = normalizeStatus(text(req.query.severity));

    let items = (await listCoreAdminActionAuditRaw(limit)).map((item) =>
      normalizeCoreAdminAuditRow(item)
    );

    if (actionFilter) {
      items = items.filter((item) => normalizeStatus(item.action).includes(actionFilter));
    }
    if (targetFilter) {
      items = items.filter((item) => normalizeStatus(item.targetId).includes(targetFilter));
    }
    if (statusFilter) {
      items = items.filter((item) => normalizeStatus(item.status) === statusFilter);
    }
    if (severityFilter) {
      items = items.filter((item) => normalizeStatus(item.severity) === severityFilter);
    }

    const summary = {
      success: items.filter((item) => normalizeStatus(item.status) === "success").length,
      errors: items.filter((item) => normalizeStatus(item.status) !== "success").length,
      critical: items.filter((item) => normalizeStatus(item.severity) === "critical").length,
      high: items.filter((item) => normalizeStatus(item.severity) === "high").length,
      medium: items.filter((item) => normalizeStatus(item.severity) === "medium").length,
      low: items.filter((item) => normalizeStatus(item.severity) === "low").length
    };

    return res.json({
      success: true,
      total: items.length,
      limit,
      summary,
      items: items.slice(0, limit)
    });
  } catch (error) {
    return next(error);
  }
}

export function resolveCoreAdminReport(req, res) {
  const reportId = text(req.params.reportId);
  if (!reportId) return res.status(400).json({ success: false, message: "reportId is required." });
  const reason = requireAdminReason(req, res, "Resolving report");
  if (!reason) return null;
  const coreReports = ensureArrayStore("coreReports");
  const legacyReports = ensureArrayStore("reports");
  let updated = null;
  [coreReports, legacyReports].forEach((rows) => {
    const index = rows.findIndex((item) => text(item.id || item._id) === reportId);
    if (index >= 0) {
      rows[index] = {
        ...rows[index],
        status: "resolved",
        resolvedAt: new Date().toISOString(),
        resolvedReason: reason,
        updatedAt: new Date().toISOString()
      };
      updated = rows[index];
    }
  });
  if (!updated) return res.status(404).json({ success: false, message: "Report not found." });
  trackCoreAdminAction(req, {
    action: "admin-report-resolve",
    targetId: reportId,
    status: "success",
    reason
  });
  return res.json({ success: true, report: updated });
}

export async function getCoreAdminCommissionAnalytics(_req, res, next) {
  try {
    const subscriptions = await listCoreSubscriptionsRaw(5000);
    const properties = await listCorePropertiesRaw(5000);
    const [
      documentationRequests,
      servicePartnerBookings,
      loanAssistanceLeads,
      franchiseRequests
    ] = await Promise.all([
      listServiceRowsRaw({
        model: CoreDocumentationRequest,
        storeKey: "documentationRequests",
        limit: 5000
      }),
      listServiceRowsRaw({
        model: CoreServicePartnerBooking,
        storeKey: "servicePartnerBookings",
        limit: 5000
      }),
      listServiceRowsRaw({
        model: CoreLoanAssistanceLead,
        storeKey: "loanAssistanceLeads",
        limit: 5000
      }),
      listServiceRowsRaw({
        model: CoreFranchiseRequest,
        storeKey: "franchiseRequests",
        limit: 5000
      })
    ]);
    const paid = subscriptions.filter((item) => numberValue(item.amount, 0) > 0).map((item) => ({ ...item, normalizedPlanType: inferPlanType(item) }));
    const featuredListingRevenue = sumAmount(paid.filter((item) => item.normalizedPlanType === "featured"));
    const verifiedBadgeRevenue = sumAmount(paid.filter((item) => item.normalizedPlanType === "verification"));
    const subscriptionModelRevenue = sumAmount(paid.filter((item) => !["featured", "verification", "agent", "care"].includes(item.normalizedPlanType)));
    const agentMembershipRevenue = sumAmount(paid.filter((item) => item.normalizedPlanType === "agent"));
    const propertyCareRevenue = sumAmount(paid.filter((item) => item.normalizedPlanType === "care"));
    const legalServiceRevenue = ensureArrayStore("legalRequests").reduce((sum, item) => sum + numberValue(item.amount, 0), 0);
    const documentationServiceFeeRevenue = documentationRequests.reduce((sum, item) => sum + numberValue(item.amount, 0), 0);
    const ecosystemServiceRevenue = servicePartnerBookings.reduce((sum, item) => sum + numberValue(item.serviceFee, 0), 0);
    const loanAssistanceCommissionRevenue = loanAssistanceLeads.reduce((sum, item) => sum + numberValue(item.finalCommissionAmount || item.estimatedCommission, 0), 0);
    const franchisePipelineValue = franchiseRequests.reduce((sum, item) => sum + numberValue(item.initialFeePotential, 0), 0);
    const estimatedCommission = Math.round(properties.filter((item) => normalizeStatus(inferPropertyStatus(item)) === "approved").length * 2500);
    const subscriptionRevenue = sumAmount(paid);
    const totalMonetized = featuredListingRevenue + verifiedBadgeRevenue + subscriptionModelRevenue + agentMembershipRevenue + propertyCareRevenue + legalServiceRevenue + documentationServiceFeeRevenue + ecosystemServiceRevenue + loanAssistanceCommissionRevenue + estimatedCommission;
    return res.json({
      success: true,
      analytics: {
        paidSubscriptions: paid.length,
        subscriptionRevenue,
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
        totalMonetized
      }
    });
  } catch (error) {
    return next(error);
  }
}

export async function listCoreAdminOwnerVerification(req, res, next) {
  try {
    const statusFilter = normalizeStatus(req.query.status);
    let items = await listCoreOwnerVerificationRaw(3000);
    if (statusFilter) {
      items = items.filter((item) => normalizeStatus(item.status) === statusFilter);
    }
    const userMap = new Map();
    const propertyMap = new Map();
    if (proRuntime.dbConnected) {
      const userIds = [...new Set(items.map((item) => toId(item.userId)).filter((id) => mongoose.Types.ObjectId.isValid(id)))];
      const propertyIds = [...new Set(items.map((item) => toId(item.propertyId)).filter((id) => mongoose.Types.ObjectId.isValid(id)))];
      if (userIds.length) {
        const users = await CoreUser.find({ _id: { $in: userIds } }).lean();
        users.forEach((item) => userMap.set(toId(item._id), normalizeCoreUser(item)));
      }
      if (propertyIds.length) {
        const properties = await CoreProperty.find({ _id: { $in: propertyIds } }).lean();
        properties.forEach((item) => propertyMap.set(toId(item._id), normalizeCoreProperty(item)));
      }
    } else {
      ensureArrayStore("coreUsers").forEach((item) => userMap.set(toId(item._id || item.id), normalizeCoreUser(item)));
      ensureArrayStore("coreProperties").forEach((item) => propertyMap.set(toId(item._id || item.id), normalizeCoreProperty(item)));
    }
    const normalized = items.map((item) => {
      const id = toId(item._id || item.id);
      const user = userMap.get(toId(item.userId)) || {};
      const property = propertyMap.get(toId(item.propertyId)) || {};
      return {
        id,
        _id: id,
        userId: toId(item.userId),
        userName: text(user.name, "User"),
        role: text(user.role, "buyer"),
        propertyId: toId(item.propertyId),
        propertyTitle: text(property.title),
        ownerAadhaarPanStatus: text(item.ownerAadhaarPanStatus, "Submitted"),
        addressVerificationStatus: text(item.addressVerificationStatus, "Submitted"),
        privateDocsUploaded: Boolean(item.privateDocsUploaded),
        status: text(item.status, "Pending Review"),
        createdAt: asIso(item.createdAt),
        updatedAt: asIso(item.updatedAt)
      };
    });
    return res.json({ success: true, total: normalized.length, items: normalized });
  } catch (error) {
    return next(error);
  }
}

export async function decideCoreAdminOwnerVerification(req, res, next) {
  try {
    const requestId = text(req.params.requestId);
    const status = (() => {
      const raw = normalizeStatus(req.body?.status || req.body?.action);
      if (["verify", "verified", "approve", "approved"].includes(raw)) return "Verified";
      if (["reject", "rejected"].includes(raw)) return "Rejected";
      if (["needs-info", "needs_info", "need-info", "needsinfo"].includes(raw)) {
        return "Needs Info";
      }
      return "Pending Review";
    })();
    if (!requestId) return res.status(400).json({ success: false, message: "requestId is required." });
    const reason = requireAdminReason(req, res, "Owner verification decision");
    if (!reason) return null;
    let updated = null;
    if (proRuntime.dbConnected) {
      if (!mongoose.Types.ObjectId.isValid(requestId)) {
        return res.status(400).json({ success: false, message: "Invalid requestId." });
      }
      updated = await CoreOwnerVerification.findByIdAndUpdate(
        requestId,
        {
          $set: {
            status,
            note: joinAdminNote(req.body?.note, reason),
            reviewedBy: toId(req.coreUser?.id),
            reviewedAt: new Date()
          }
        },
        { new: true }
      );
    } else {
      const rows = ensureArrayStore("coreOwnerVerificationRequests");
      const index = rows.findIndex((item) => toId(item._id || item.id) === requestId);
      if (index >= 0) {
        rows[index] = {
          ...rows[index],
          status,
          note: joinAdminNote(rows[index]?.note, reason),
          reviewedBy: toId(req.coreUser?.id),
          reviewedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        updated = rows[index];
      }
    }
    if (!updated) return res.status(404).json({ success: false, message: "Verification request not found." });
    trackCoreAdminAction(req, {
      action: "admin-owner-verification-decision",
      targetId: requestId,
      status,
      reason
    });
    return res.json({
      success: true,
      request: {
        id: toId(updated._id || updated.id),
        status: text(updated.status),
        reviewedBy: toId(updated.reviewedBy),
        reviewedAt: asIso(updated.reviewedAt)
      }
    });
  } catch (error) {
    return next(error);
  }
}

export async function listCoreDocumentationRequests(_req, res, next) {
  try {
    const items = await listServiceRowsRaw({
      model: CoreDocumentationRequest,
      storeKey: "documentationRequests",
      limit: 3000
    });
    return res.json({ success: true, total: items.length, items });
  } catch (error) {
    return next(error);
  }
}

export async function updateCoreDocumentationRequestStatus(req, res, next) {
  try {
    const status = text(req.body?.status);
    const statusKey = normalizeStatusKey(status);
    const reason = getAdminReason(req);
    if (CORE_ADMIN_RISKY_DOC_STATUS.has(statusKey)) {
      const requiredReason = requireAdminReason(
        req,
        res,
        "Updating documentation request to risky status"
      );
      if (!requiredReason) return null;
    }
    const updated = await updateServiceStatus({
      model: CoreDocumentationRequest,
      storeKey: "documentationRequests",
      id: req.params.requestId,
      status,
      extra: {
        adminNote: joinAdminNote(req.body?.adminNote, reason),
        moderationReason: text(reason)
      }
    });
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Documentation request not found." });
    }
    if (reason) {
      trackCoreAdminAction(req, {
        action: "admin-documentation-status-update",
        targetId: text(req.params.requestId),
        status,
        reason
      });
    }
    notifyCoreServiceStatusUpdate({
      userId: toId(updated.userId),
      title: "Documentation Request Updated",
      message: `Your documentation request is now "${text(updated.status)}".`,
      category: "documentation",
      metadata: { requestId: toId(updated.id || updated._id), status: text(updated.status) }
    }).catch(() => {});
    return res.json({ success: true, request: updated });
  } catch (error) {
    return next(error);
  }
}

export async function listCoreLoanAssistance(_req, res, next) {
  try {
    const items = await listServiceRowsRaw({
      model: CoreLoanAssistanceLead,
      storeKey: "loanAssistanceLeads",
      limit: 3000
    });
    return res.json({ success: true, total: items.length, items });
  } catch (error) {
    return next(error);
  }
}

export async function updateCoreLoanAssistanceStatus(req, res, next) {
  try {
    const status = text(req.body?.status);
    const statusKey = normalizeStatusKey(status);
    const reason = getAdminReason(req);
    if (CORE_ADMIN_RISKY_LOAN_STATUS.has(statusKey)) {
      const requiredReason = requireAdminReason(
        req,
        res,
        "Updating loan assistance to risky status"
      );
      if (!requiredReason) return null;
    }
    const updated = await updateServiceStatus({
      model: CoreLoanAssistanceLead,
      storeKey: "loanAssistanceLeads",
      id: req.params.leadId,
      status,
      extra: {
        adminNote: joinAdminNote(req.body?.adminNote, reason),
        moderationReason: text(reason),
        finalCommissionAmount:
          typeof req.body?.finalCommissionAmount === "undefined"
            ? undefined
            : Math.max(0, numberValue(req.body?.finalCommissionAmount, 0))
      }
    });
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Loan assistance lead not found." });
    }
    if (reason) {
      trackCoreAdminAction(req, {
        action: "admin-loan-status-update",
        targetId: text(req.params.leadId),
        status,
        reason
      });
    }
    notifyCoreServiceStatusUpdate({
      userId: toId(updated.userId),
      title: "Loan Assistance Updated",
      message: `Your loan assistance lead is now "${text(updated.status)}".`,
      category: "loan",
      metadata: { leadId: toId(updated.id || updated._id), status: text(updated.status) }
    }).catch(() => {});
    return res.json({ success: true, lead: updated });
  } catch (error) {
    return next(error);
  }
}

export async function listCoreEcosystemBookings(_req, res, next) {
  try {
    const items = await listServiceRowsRaw({
      model: CoreServicePartnerBooking,
      storeKey: "servicePartnerBookings",
      limit: 3000
    });
    return res.json({ success: true, total: items.length, items });
  } catch (error) {
    return next(error);
  }
}

export async function updateCoreEcosystemBookingStatus(req, res, next) {
  try {
    const status = text(req.body?.status);
    const statusKey = normalizeStatusKey(status);
    const reason = getAdminReason(req);
    if (CORE_ADMIN_RISKY_ECOSYSTEM_STATUS.has(statusKey)) {
      const requiredReason = requireAdminReason(
        req,
        res,
        "Updating ecosystem booking to risky status"
      );
      if (!requiredReason) return null;
    }
    const updated = await updateServiceStatus({
      model: CoreServicePartnerBooking,
      storeKey: "servicePartnerBookings",
      id: req.params.bookingId,
      status,
      extra: {
        adminNote: joinAdminNote(req.body?.adminNote, reason),
        moderationReason: text(reason)
      }
    });
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Ecosystem booking not found." });
    }
    if (reason) {
      trackCoreAdminAction(req, {
        action: "admin-ecosystem-booking-status-update",
        targetId: text(req.params.bookingId),
        status,
        reason
      });
    }
    notifyCoreServiceStatusUpdate({
      userId: toId(updated.userId),
      title: "Service Booking Updated",
      message: `Your service booking is now "${text(updated.status)}".`,
      category: "ecosystem",
      metadata: { bookingId: toId(updated.id || updated._id), status: text(updated.status) }
    }).catch(() => {});
    return res.json({ success: true, booking: updated });
  } catch (error) {
    return next(error);
  }
}

export async function listCoreValuationRequests(_req, res, next) {
  try {
    const items = await listServiceRowsRaw({
      model: CoreValuationRequest,
      storeKey: "valuationRequests",
      limit: 3000
    });
    return res.json({ success: true, total: items.length, items });
  } catch (error) {
    return next(error);
  }
}

export async function listCoreRentAgreementDrafts(_req, res, next) {
  try {
    const items = await listServiceRowsRaw({
      model: CoreRentAgreementDraft,
      storeKey: "rentAgreementDrafts",
      limit: 3000
    });
    return res.json({ success: true, total: items.length, items });
  } catch (error) {
    return next(error);
  }
}

export async function listCoreFranchiseRequests(_req, res, next) {
  try {
    const items = await listServiceRowsRaw({
      model: CoreFranchiseRequest,
      storeKey: "franchiseRequests",
      limit: 3000
    });
    return res.json({ success: true, total: items.length, items });
  } catch (error) {
    return next(error);
  }
}

export async function updateCoreFranchiseRequestStatus(req, res, next) {
  try {
    const status = text(req.body?.status);
    const statusKey = normalizeStatusKey(status);
    const reason = getAdminReason(req);
    if (CORE_ADMIN_RISKY_FRANCHISE_STATUS.has(statusKey)) {
      const requiredReason = requireAdminReason(
        req,
        res,
        "Updating franchise request to risky status"
      );
      if (!requiredReason) return null;
    }
    const updated = await updateServiceStatus({
      model: CoreFranchiseRequest,
      storeKey: "franchiseRequests",
      id: req.params.requestId,
      status,
      extra: {
        adminNote: joinAdminNote(req.body?.adminNote, reason),
        moderationReason: text(reason)
      }
    });
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Franchise request not found." });
    }
    if (reason) {
      trackCoreAdminAction(req, {
        action: "admin-franchise-status-update",
        targetId: text(req.params.requestId),
        status,
        reason
      });
    }
    notifyCoreServiceStatusUpdate({
      userId: toId(updated.userId),
      title: "Franchise Request Updated",
      message: `Your franchise request for ${text(updated.city, "your city")} is now "${text(updated.status)}".`,
      category: "franchise",
      metadata: { requestId: toId(updated.id || updated._id), status: text(updated.status) }
    }).catch(() => {});
    return res.json({ success: true, request: updated });
  } catch (error) {
    return next(error);
  }
}
