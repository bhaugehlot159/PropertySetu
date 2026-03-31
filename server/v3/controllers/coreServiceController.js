import mongoose from "mongoose";
import { proRuntime } from "../../config/proRuntime.js";
import { proMemoryStore } from "../../runtime/proMemoryStore.js";
import CoreDocumentationRequest from "../models/CoreDocumentationRequest.js";
import CoreFranchiseRequest from "../models/CoreFranchiseRequest.js";
import CoreLoanAssistanceLead from "../models/CoreLoanAssistanceLead.js";
import CoreRentAgreementDraft from "../models/CoreRentAgreementDraft.js";
import CoreServicePartnerBooking from "../models/CoreServicePartnerBooking.js";
import CoreUser from "../models/CoreUser.js";
import CoreValuationRequest from "../models/CoreValuationRequest.js";
import { createCoreNotification } from "./coreNotificationController.js";
import { toId } from "../utils/coreMappers.js";

const DOCUMENTATION_SERVICES = [
  {
    id: "agreement-service",
    name: "Agreement Drafting Service",
    category: "agreement",
    fee: 1299,
    slaHours: 24
  },
  {
    id: "registry-service",
    name: "Registry Support Service",
    category: "registry",
    fee: 2499,
    slaHours: 48
  },
  {
    id: "legal-help-service",
    name: "Legal Help Service",
    category: "legal",
    fee: 1499,
    slaHours: 24
  }
];

const LOAN_PARTNER_BANKS = [
  {
    id: "hdfc",
    name: "HDFC Bank",
    homeLoanRateStart: "8.40%",
    maxLtvPercent: 80,
    commissionPercent: 0.45
  },
  {
    id: "sbi",
    name: "State Bank of India",
    homeLoanRateStart: "8.35%",
    maxLtvPercent: 80,
    commissionPercent: 0.4
  },
  {
    id: "icici",
    name: "ICICI Bank",
    homeLoanRateStart: "8.50%",
    maxLtvPercent: 80,
    commissionPercent: 0.5
  },
  {
    id: "axis",
    name: "Axis Bank",
    homeLoanRateStart: "8.55%",
    maxLtvPercent: 75,
    commissionPercent: 0.45
  }
];

const ECOSYSTEM_SERVICE_CATALOG = [
  {
    id: "movers-packers",
    name: "Movers & Packers Booking",
    category: "relocation",
    baseFee: 799
  },
  {
    id: "interior-designer",
    name: "Interior Designer Booking",
    category: "interior",
    baseFee: 1499
  },
  {
    id: "property-valuation",
    name: "Property Valuation Tool",
    category: "valuation",
    baseFee: 0
  },
  {
    id: "rent-agreement-generator",
    name: "Rent Agreement Generator",
    category: "legal-tool",
    baseFee: 299
  },
  {
    id: "franchise",
    name: "Franchise Interest Program",
    category: "growth",
    baseFee: 0
  }
];

function text(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nowIso() {
  return new Date().toISOString();
}

function asIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function ensureArrayStore(key) {
  if (!Array.isArray(proMemoryStore[key])) {
    proMemoryStore[key] = [];
  }
  return proMemoryStore[key];
}

function nextMemoryId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeRole(role) {
  const raw = text(role, "buyer").toLowerCase();
  if (["admin", "seller", "buyer"].includes(raw)) return raw;
  return "buyer";
}

function isAdminRole(role) {
  return normalizeRole(role) === "admin";
}

function sortByCreatedAtDesc(items = []) {
  return [...items].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function normalizeStatusLabel(status, fallback = "Requested") {
  const normalized = text(status, fallback);
  return normalized || fallback;
}

function toCitySlug(city) {
  return text(city)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toOptionalObjectId(value) {
  const normalized = toId(value);
  if (!normalized || !mongoose.Types.ObjectId.isValid(normalized)) return null;
  return normalized;
}

function toServicePlain(doc) {
  if (!doc) return null;
  return typeof doc.toObject === "function" ? doc.toObject() : doc;
}

function normalizeServiceRow(doc) {
  const row = toServicePlain(doc);
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

function mergeWithMemoryRows(dbRows = [], storeKey = "", limit = 3000) {
  const merged = new Map();
  const memoryRows = ensureArrayStore(storeKey);

  [...(dbRows || []), ...memoryRows].forEach((row) => {
    const normalized = normalizeServiceRow(row);
    const id = toId(normalized?._id || normalized?.id);
    if (!normalized || !id || merged.has(id)) return;
    merged.set(id, normalized);
  });

  return sortByCreatedAtDesc([...merged.values()]).slice(0, limit);
}

async function listServiceRows({
  model,
  storeKey,
  limit = 3000
} = {}) {
  if (proRuntime.dbConnected) {
    const dbRows = await model.find({}).sort({ createdAt: -1 }).limit(limit).lean();
    return mergeWithMemoryRows(dbRows, storeKey, limit);
  }
  return sortByCreatedAtDesc(ensureArrayStore(storeKey));
}

async function findCoreUserById(userId) {
  const normalizedId = toId(userId);
  if (!normalizedId) return null;

  if (proRuntime.dbConnected && mongoose.Types.ObjectId.isValid(normalizedId)) {
    const row = await CoreUser.findById(normalizedId).lean();
    return row || null;
  }

  return (
    ensureArrayStore("coreUsers").find(
      (item) => toId(item._id || item.id) === normalizedId
    ) || null
  );
}

async function resolveActor(req) {
  const userId = toId(req.coreUser?.id);
  const role = normalizeRole(req.coreUser?.role);
  if (!userId) {
    return {
      id: "",
      role,
      name: role === "admin" ? "PropertySetu Admin" : "User"
    };
  }

  const row = await findCoreUserById(userId);
  if (row) {
    return {
      id: toId(row._id || row.id),
      role: normalizeRole(row.role || role),
      name: text(row.name, role === "admin" ? "PropertySetu Admin" : "User")
    };
  }

  return {
    id: userId,
    role,
    name: role === "admin" ? "PropertySetu Admin" : "User"
  };
}

async function listAdminUserIds() {
  if (proRuntime.dbConnected) {
    const rows = await CoreUser.find({ role: "admin" }).select("_id").lean();
    return rows.map((row) => toId(row._id)).filter(Boolean);
  }

  return ensureArrayStore("coreUsers")
    .filter((item) => isAdminRole(item.role))
    .map((item) => toId(item._id || item.id))
    .filter(Boolean);
}

async function notifyAdmins({
  title,
  message,
  category = "general",
  metadata = {}
} = {}) {
  const ids = await listAdminUserIds();
  await Promise.all(
    ids.map((userId) =>
      createCoreNotification({
        userId,
        title,
        message,
        category,
        metadata
      })
    )
  );
}

async function notifyUser({
  userId,
  title,
  message,
  category = "general",
  metadata = {}
} = {}) {
  const normalizedUserId = toId(userId);
  if (!normalizedUserId) return;
  await createCoreNotification({
    userId: normalizedUserId,
    title,
    message,
    category,
    metadata
  });
}

function userScopedItems(items, actor) {
  if (isAdminRole(actor?.role)) return sortByCreatedAtDesc(items);
  const userId = toId(actor?.id);
  return sortByCreatedAtDesc(items.filter((item) => toId(item.userId) === userId));
}

function trimStore(items, maxRows = 2000) {
  return items.slice(0, maxRows);
}

function defaultPricePerSqftForType(propertyType) {
  const raw = text(propertyType).toLowerCase();
  if (raw.includes("villa")) return 4300;
  if (raw.includes("plot") || raw.includes("land")) return 2100;
  if (raw.includes("commercial") || raw.includes("office") || raw.includes("shop")) {
    return 3900;
  }
  if (raw.includes("farm")) return 2600;
  return 3200;
}

function normalizeRows(rows = []) {
  return rows.map((item) => normalizeServiceRow(item)).filter(Boolean);
}

export function listCoreDocumentationServices(_req, res) {
  return res.json({
    success: true,
    total: DOCUMENTATION_SERVICES.length,
    items: DOCUMENTATION_SERVICES
  });
}

export async function createCoreDocumentationRequest(req, res, next) {
  try {
    const actor = await resolveActor(req);
    if (!actor.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    const serviceId = text(req.body?.serviceId || req.body?.templateId);
    const service = DOCUMENTATION_SERVICES.find((item) => item.id === serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Documentation service not found."
      });
    }

    const details = text(req.body?.details);
    if (!details) {
      return res.status(400).json({
        success: false,
        message: "Request details required."
      });
    }

    let record = null;
    const actorObjectId = toOptionalObjectId(actor.id);
    const propertyObjectId = toOptionalObjectId(req.body?.propertyId);
    if (proRuntime.dbConnected && actorObjectId) {
      const created = await CoreDocumentationRequest.create({
        serviceId: service.id,
        serviceName: service.name,
        category: service.category,
        amount: numberValue(req.body?.amount, service.fee),
        propertyId: propertyObjectId,
        city: text(req.body?.city || "Udaipur"),
        details,
        status: "Requested",
        userId: actorObjectId,
        userName: actor.name
      });
      record = normalizeServiceRow(created);
    } else {
      const createdAt = nowIso();
      record = {
        id: nextMemoryId("documentation"),
        serviceId: service.id,
        serviceName: service.name,
        category: service.category,
        amount: numberValue(req.body?.amount, service.fee),
        propertyId: text(req.body?.propertyId) || null,
        city: text(req.body?.city || "Udaipur"),
        details,
        status: "Requested",
        userId: actor.id,
        userName: actor.name,
        createdAt,
        updatedAt: createdAt
      };
      const rows = ensureArrayStore("documentationRequests");
      rows.unshift(record);
      proMemoryStore.documentationRequests = trimStore(rows, 2500);
      record = normalizeServiceRow(record);
    }

    await notifyAdmins({
      title: "New Documentation Request",
      message: `${actor.name} requested ${service.name}.`,
      category: "documentation",
      metadata: { requestId: record.id, serviceId: service.id }
    });

    return res.status(201).json({
      success: true,
      request: record,
      item: record
    });
  } catch (error) {
    return next(error);
  }
}

export async function listCoreDocumentationRequestsForUser(req, res, next) {
  try {
    const actor = await resolveActor(req);
    const rows = await listServiceRows({
      model: CoreDocumentationRequest,
      storeKey: "documentationRequests",
      limit: 2500
    });
    const items = userScopedItems(rows, actor);
    return res.json({
      success: true,
      total: items.length,
      items: normalizeRows(items)
    });
  } catch (error) {
    return next(error);
  }
}

export function listCoreLoanPartnerBanks(_req, res) {
  return res.json({
    success: true,
    total: LOAN_PARTNER_BANKS.length,
    items: LOAN_PARTNER_BANKS
  });
}

export async function createCoreLoanAssistance(req, res, next) {
  try {
    const actor = await resolveActor(req);
    if (!actor.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    const bankId = text(req.body?.bankId);
    const bank = LOAN_PARTNER_BANKS.find((item) => item.id === bankId);
    if (!bank) {
      return res.status(404).json({
        success: false,
        message: "Loan partner bank not found."
      });
    }

    const requestedAmount = Math.max(
      0,
      numberValue(req.body?.requestedAmount || req.body?.loanAmount, 0)
    );
    const propertyValue = Math.max(
      0,
      numberValue(req.body?.propertyValue || req.body?.propertyCost, 0)
    );

    if (requestedAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Requested loan amount required."
      });
    }

    if (propertyValue > 0 && requestedAmount > Math.round(propertyValue * 0.9)) {
      return res.status(400).json({
        success: false,
        message: "Loan amount should be less than property value."
      });
    }

    const estimatedCommission = Math.round(
      requestedAmount * (numberValue(bank.commissionPercent, 0) / 100)
    );
    let record = null;
    const actorObjectId = toOptionalObjectId(actor.id);
    const propertyObjectId = toOptionalObjectId(req.body?.propertyId);
    if (proRuntime.dbConnected && actorObjectId) {
      const created = await CoreLoanAssistanceLead.create({
        userId: actorObjectId,
        userName: actor.name,
        bankId: bank.id,
        bankName: bank.name,
        propertyId: propertyObjectId,
        city: text(req.body?.city || "Udaipur"),
        locality: text(req.body?.locality),
        loanType: text(req.body?.loanType || "home-loan"),
        requestedAmount,
        propertyValue,
        monthlyIncome: Math.max(0, numberValue(req.body?.monthlyIncome, 0)),
        cibilScore: Math.max(0, numberValue(req.body?.cibilScore, 0)),
        referralSource: text(req.body?.referralSource || "platform"),
        commissionPercent: numberValue(bank.commissionPercent, 0),
        estimatedCommission,
        finalCommissionAmount: null,
        status: "lead-created",
        notes: text(req.body?.notes)
      });
      record = normalizeServiceRow(created);
    } else {
      const createdAt = nowIso();
      record = {
        id: nextMemoryId("loan"),
        userId: actor.id,
        userName: actor.name,
        bankId: bank.id,
        bankName: bank.name,
        propertyId: text(req.body?.propertyId) || null,
        city: text(req.body?.city || "Udaipur"),
        locality: text(req.body?.locality),
        loanType: text(req.body?.loanType || "home-loan"),
        requestedAmount,
        propertyValue,
        monthlyIncome: Math.max(0, numberValue(req.body?.monthlyIncome, 0)),
        cibilScore: Math.max(0, numberValue(req.body?.cibilScore, 0)),
        referralSource: text(req.body?.referralSource || "platform"),
        commissionPercent: numberValue(bank.commissionPercent, 0),
        estimatedCommission,
        finalCommissionAmount: null,
        status: "lead-created",
        notes: text(req.body?.notes),
        createdAt,
        updatedAt: createdAt
      };
      const rows = ensureArrayStore("loanAssistanceLeads");
      rows.unshift(record);
      proMemoryStore.loanAssistanceLeads = trimStore(rows, 3000);
      record = normalizeServiceRow(record);
    }

    await notifyAdmins({
      title: "New Loan Assistance Lead",
      message: `${actor.name} requested loan support from ${bank.name}.`,
      category: "loan",
      metadata: { leadId: record.id, bankId: bank.id }
    });

    return res.status(201).json({
      success: true,
      lead: record,
      item: record
    });
  } catch (error) {
    return next(error);
  }
}

export async function listCoreLoanAssistanceForUser(req, res, next) {
  try {
    const actor = await resolveActor(req);
    const rows = await listServiceRows({
      model: CoreLoanAssistanceLead,
      storeKey: "loanAssistanceLeads",
      limit: 3000
    });
    const items = userScopedItems(rows, actor);
    return res.json({
      success: true,
      total: items.length,
      items: normalizeRows(items)
    });
  } catch (error) {
    return next(error);
  }
}

export function listCoreEcosystemServices(_req, res) {
  return res.json({
    success: true,
    total: ECOSYSTEM_SERVICE_CATALOG.length,
    items: ECOSYSTEM_SERVICE_CATALOG
  });
}

export async function createCoreEcosystemBooking(req, res, next) {
  try {
    const actor = await resolveActor(req);
    if (!actor.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    const serviceId = text(req.body?.serviceId || req.body?.type);
    const service = ECOSYSTEM_SERVICE_CATALOG.find((item) => item.id === serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Ecosystem service not found."
      });
    }

    if (!["movers-packers", "interior-designer"].includes(service.id)) {
      return res.status(400).json({
        success: false,
        message: "Use dedicated endpoint for this service type."
      });
    }

    const preferredDate = text(req.body?.preferredDate);
    if (!preferredDate) {
      return res.status(400).json({
        success: false,
        message: "Preferred date required."
      });
    }

    let record = null;
    const actorObjectId = toOptionalObjectId(actor.id);
    const propertyObjectId = toOptionalObjectId(req.body?.propertyId);
    if (proRuntime.dbConnected && actorObjectId) {
      const created = await CoreServicePartnerBooking.create({
        serviceId: service.id,
        serviceName: service.name,
        serviceFee: Math.max(0, numberValue(req.body?.serviceFee, service.baseFee)),
        userId: actorObjectId,
        userName: actor.name,
        propertyId: propertyObjectId,
        city: text(req.body?.city || "Udaipur"),
        locality: text(req.body?.locality),
        preferredDate,
        budget: Math.max(0, numberValue(req.body?.budget, 0)),
        contactName: text(req.body?.contactName, actor.name),
        contactPhone: text(req.body?.contactPhone),
        notes: text(req.body?.notes),
        status: "Requested"
      });
      record = normalizeServiceRow(created);
    } else {
      const createdAt = nowIso();
      record = {
        id: nextMemoryId("partnerBooking"),
        serviceId: service.id,
        serviceName: service.name,
        serviceFee: Math.max(0, numberValue(req.body?.serviceFee, service.baseFee)),
        userId: actor.id,
        userName: actor.name,
        propertyId: text(req.body?.propertyId) || null,
        city: text(req.body?.city || "Udaipur"),
        locality: text(req.body?.locality),
        preferredDate,
        budget: Math.max(0, numberValue(req.body?.budget, 0)),
        contactName: text(req.body?.contactName, actor.name),
        contactPhone: text(req.body?.contactPhone),
        notes: text(req.body?.notes),
        status: "Requested",
        createdAt,
        updatedAt: createdAt
      };
      const rows = ensureArrayStore("servicePartnerBookings");
      rows.unshift(record);
      proMemoryStore.servicePartnerBookings = trimStore(rows, 3000);
      record = normalizeServiceRow(record);
    }

    await notifyAdmins({
      title: "New Partner Service Booking",
      message: `${actor.name} booked ${service.name}.`,
      category: "ecosystem",
      metadata: { bookingId: record.id, serviceId: service.id }
    });

    return res.status(201).json({
      success: true,
      booking: record,
      item: record
    });
  } catch (error) {
    return next(error);
  }
}

export async function listCoreEcosystemBookingsForUser(req, res, next) {
  try {
    const actor = await resolveActor(req);
    const rows = await listServiceRows({
      model: CoreServicePartnerBooking,
      storeKey: "servicePartnerBookings",
      limit: 3000
    });
    const items = userScopedItems(rows, actor);
    return res.json({
      success: true,
      total: items.length,
      items: normalizeRows(items)
    });
  } catch (error) {
    return next(error);
  }
}

export async function createCoreValuationEstimate(req, res, next) {
  try {
    const actor = await resolveActor(req);
    const locality = text(req.body?.locality || req.body?.location || "Udaipur");
    const propertyType = text(req.body?.propertyType || req.body?.category || "House");
    const areaSqft = Math.max(100, numberValue(req.body?.areaSqft || req.body?.size, 0));
    const bedrooms = Math.max(0, numberValue(req.body?.bedrooms, 0));
    const ageYears = Math.max(0, numberValue(req.body?.ageYears, 0));
    const furnished = text(req.body?.furnished || "semi").toLowerCase();
    const expectedPrice = Math.max(0, numberValue(req.body?.expectedPrice, 0));

    const basePerSqft =
      expectedPrice > 0
        ? Math.max(1200, Math.round(expectedPrice / Math.max(areaSqft, 1)))
        : defaultPricePerSqftForType(propertyType);
    const furnishingBoost = furnished.includes("furnished")
      ? 1.08
      : furnished.includes("semi")
        ? 1.03
        : 0.97;
    const ageMultiplier = Math.max(0.7, Math.min(1.02, 1 - ageYears * 0.008));
    const bhkMultiplier = bedrooms > 0 ? Math.max(1, Math.min(1.16, 1 + bedrooms * 0.02)) : 1;
    const estimatedPrice = Math.round(
      basePerSqft * areaSqft * furnishingBoost * ageMultiplier * bhkMultiplier
    );
    const min = Math.max(0, Math.round(estimatedPrice * 0.9));
    const max = Math.max(min, Math.round(estimatedPrice * 1.12));
    const confidence = expectedPrice > 0 ? 0.86 : 0.78;

    let record = null;
    const actorObjectId = toOptionalObjectId(actor.id);
    if (proRuntime.dbConnected) {
      const created = await CoreValuationRequest.create({
        userId: actorObjectId,
        userName: actor.name || "guest",
        locality,
        propertyType,
        areaSqft,
        bedrooms,
        ageYears,
        furnished,
        expectedPrice,
        estimatedPrice,
        suggestedBand: { min, max },
        confidence,
        source: "propertysetu-valuation-tool-v3"
      });
      record = normalizeServiceRow(created);
    } else {
      const createdAt = nowIso();
      record = {
        id: nextMemoryId("valuation"),
        userId: actor.id || null,
        userName: actor.name || "guest",
        locality,
        propertyType,
        areaSqft,
        bedrooms,
        ageYears,
        furnished,
        expectedPrice,
        estimatedPrice,
        suggestedBand: { min, max },
        confidence,
        source: "propertysetu-valuation-tool-v3",
        createdAt,
        updatedAt: createdAt
      };
      const rows = ensureArrayStore("valuationRequests");
      rows.unshift(record);
      proMemoryStore.valuationRequests = trimStore(rows, 3000);
      record = normalizeServiceRow(record);
    }

    return res.json({
      success: true,
      valuation: record,
      item: record,
      insight: `Estimated value for ${propertyType} in ${locality} is INR ${estimatedPrice.toLocaleString("en-IN")}.`
    });
  } catch (error) {
    return next(error);
  }
}

export async function listCoreValuationRequestsForAdmin(_req, res, next) {
  try {
    const items = await listServiceRows({
      model: CoreValuationRequest,
      storeKey: "valuationRequests",
      limit: 3000
    });
    return res.json({
      success: true,
      total: items.length,
      items: normalizeRows(items)
    });
  } catch (error) {
    return next(error);
  }
}

export async function createCoreRentAgreementDraft(req, res, next) {
  try {
    const actor = await resolveActor(req);
    if (!actor.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    const ownerName = text(req.body?.ownerName);
    const tenantName = text(req.body?.tenantName);
    const propertyAddress = text(req.body?.propertyAddress);
    const rentAmount = Math.round(Math.max(0, numberValue(req.body?.rentAmount, 0)));
    const depositAmount = Math.round(
      Math.max(0, numberValue(req.body?.depositAmount, 0))
    );
    const durationMonths = Math.max(1, Math.round(numberValue(req.body?.durationMonths, 11)));
    const startDate = text(
      req.body?.startDate || new Date().toISOString().slice(0, 10)
    );

    if (!ownerName || !tenantName || !propertyAddress || rentAmount <= 0) {
      return res.status(400).json({
        success: false,
        message:
          "ownerName, tenantName, propertyAddress and rentAmount are required."
      });
    }

    const draftText = [
      "RENT AGREEMENT (Draft)",
      `Owner: ${ownerName}`,
      `Tenant: ${tenantName}`,
      `Property Address: ${propertyAddress}`,
      `Monthly Rent: INR ${rentAmount.toLocaleString("en-IN")}`,
      `Security Deposit: INR ${depositAmount.toLocaleString("en-IN")}`,
      `Tenure: ${durationMonths} months`,
      `Start Date: ${startDate}`,
      "Payment due date: 5th of every month.",
      "Electricity and water charges to be paid by tenant as per actual.",
      "Notice period: 30 days by either party.",
      "This is a generated draft and should be reviewed by a legal expert before execution."
    ].join("\n");

    let record = null;
    const actorObjectId = toOptionalObjectId(actor.id);
    if (proRuntime.dbConnected && actorObjectId) {
      const created = await CoreRentAgreementDraft.create({
        userId: actorObjectId,
        userName: actor.name,
        ownerName,
        tenantName,
        propertyAddress,
        rentAmount,
        depositAmount,
        durationMonths,
        startDate,
        draftText
      });
      record = normalizeServiceRow(created);
    } else {
      const createdAt = nowIso();
      record = {
        id: nextMemoryId("rentAgreement"),
        userId: actor.id,
        userName: actor.name,
        ownerName,
        tenantName,
        propertyAddress,
        rentAmount,
        depositAmount,
        durationMonths,
        startDate,
        draftText,
        createdAt,
        updatedAt: createdAt
      };
      const rows = ensureArrayStore("rentAgreementDrafts");
      rows.unshift(record);
      proMemoryStore.rentAgreementDrafts = trimStore(rows, 1200);
      record = normalizeServiceRow(record);
    }

    return res.status(201).json({
      success: true,
      draft: record,
      item: record
    });
  } catch (error) {
    return next(error);
  }
}

export async function listCoreRentAgreementDraftsForUser(req, res, next) {
  try {
    const actor = await resolveActor(req);
    const rows = await listServiceRows({
      model: CoreRentAgreementDraft,
      storeKey: "rentAgreementDrafts",
      limit: 1200
    });
    const items = userScopedItems(rows, actor);
    return res.json({
      success: true,
      total: items.length,
      items: normalizeRows(items)
    });
  } catch (error) {
    return next(error);
  }
}

export function listCoreFranchiseRegions(_req, res) {
  const config =
    proMemoryStore.coreAdminConfig &&
    typeof proMemoryStore.coreAdminConfig === "object" &&
    !Array.isArray(proMemoryStore.coreAdminConfig)
      ? proMemoryStore.coreAdminConfig
      : {};
  const configuredCities = Array.isArray(config.cities)
    ? config.cities.map((city) => text(city)).filter(Boolean)
    : [];
  const cities = [...new Set(["Udaipur", ...configuredCities])];
  const items = cities.map((cityName) => ({
    city: cityName,
    slug: toCitySlug(cityName),
    status:
      cityName.toLowerCase() === "udaipur" ? "live-operational" : "expansion-ready"
  }));

  return res.json({
    success: true,
    total: items.length,
    items
  });
}

export async function createCoreFranchiseRequest(req, res, next) {
  try {
    const actor = await resolveActor(req);
    if (!actor.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    const city = text(req.body?.city || req.body?.region);
    const investmentBudget = Math.max(
      0,
      numberValue(req.body?.investmentBudget, 0)
    );
    if (!city) {
      return res.status(400).json({
        success: false,
        message: "City is required for franchise request."
      });
    }
    if (investmentBudget <= 0) {
      return res.status(400).json({
        success: false,
        message: "Investment budget required."
      });
    }

    let record = null;
    const actorObjectId = toOptionalObjectId(actor.id);
    if (proRuntime.dbConnected && actorObjectId) {
      const created = await CoreFranchiseRequest.create({
        userId: actorObjectId,
        userName: actor.name,
        city,
        experienceYears: Math.max(0, numberValue(req.body?.experienceYears, 0)),
        teamSize: Math.max(0, numberValue(req.body?.teamSize, 0)),
        officeAddress: text(req.body?.officeAddress),
        investmentBudget,
        initialFeePotential: Math.max(0, Math.round(investmentBudget * 0.08)),
        notes: text(req.body?.notes),
        status: "screening"
      });
      record = normalizeServiceRow(created);
    } else {
      const createdAt = nowIso();
      record = {
        id: nextMemoryId("franchise"),
        userId: actor.id,
        userName: actor.name,
        city,
        experienceYears: Math.max(0, numberValue(req.body?.experienceYears, 0)),
        teamSize: Math.max(0, numberValue(req.body?.teamSize, 0)),
        officeAddress: text(req.body?.officeAddress),
        investmentBudget,
        initialFeePotential: Math.max(0, Math.round(investmentBudget * 0.08)),
        notes: text(req.body?.notes),
        status: "screening",
        createdAt,
        updatedAt: createdAt
      };
      const rows = ensureArrayStore("franchiseRequests");
      rows.unshift(record);
      proMemoryStore.franchiseRequests = trimStore(rows, 2500);
      record = normalizeServiceRow(record);
    }

    await notifyAdmins({
      title: "New Franchise Request",
      message: `${actor.name} requested franchise for ${city}.`,
      category: "franchise",
      metadata: { requestId: record.id, city }
    });

    return res.status(201).json({
      success: true,
      request: record,
      item: record
    });
  } catch (error) {
    return next(error);
  }
}

export async function listCoreFranchiseRequestsForUser(req, res, next) {
  try {
    const actor = await resolveActor(req);
    const rows = await listServiceRows({
      model: CoreFranchiseRequest,
      storeKey: "franchiseRequests",
      limit: 2500
    });
    const items = userScopedItems(rows, actor);
    return res.json({
      success: true,
      total: items.length,
      items: normalizeRows(items)
    });
  } catch (error) {
    return next(error);
  }
}

export async function notifyCoreServiceStatusUpdate({
  userId,
  title,
  message,
  category,
  metadata
} = {}) {
  await notifyUser({
    userId,
    title: text(title),
    message: text(message),
    category: text(category, "general"),
    metadata:
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? metadata
        : {}
  });
}

export function normalizeCoreServiceStatusInput(status, fallback = "Requested") {
  return normalizeStatusLabel(status, fallback);
}
