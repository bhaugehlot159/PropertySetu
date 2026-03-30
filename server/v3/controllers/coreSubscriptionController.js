import mongoose from "mongoose";
import crypto from "crypto";
import CoreSubscription from "../models/CoreSubscription.js";
import CoreProperty from "../models/CoreProperty.js";
import CoreUser from "../models/CoreUser.js";
import CorePropertyCareRequest from "../models/CorePropertyCareRequest.js";
import { proRuntime } from "../../config/proRuntime.js";
import { proMemoryStore } from "../../runtime/proMemoryStore.js";
import {
  getProRazorpayClient,
  getRazorpayPublicKey
} from "../../config/proRazorpay.js";
import {
  normalizeCoreProperty,
  normalizeCoreSubscription,
  normalizeCoreUser,
  toId
} from "../utils/coreMappers.js";

function text(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isConfiguredCredential(value) {
  const raw = text(value).toLowerCase();
  if (!raw) return false;
  return (
    !raw.includes("replace_with") &&
    !raw.includes("placeholder") &&
    !raw.startsWith("your_")
  );
}

const PAYMENT_SUCCESS_STATUSES = new Set(["captured", "paid", "success", "verified"]);
const VERIFIED_PAYMENT_TTL_MS = Math.max(
  60_000,
  numberValue(process.env.CORE_PAYMENT_PROOF_TTL_MS, 20 * 60 * 1000)
);
const STRICT_PAYMENT_PROOF =
  text(
    process.env.CORE_STRICT_PAYMENT_PROOF,
    text(process.env.NODE_ENV).toLowerCase() === "production" ? "true" : "false"
  ).toLowerCase() === "true";
const PAYMENT_DEVELOPMENT_FALLBACK =
  text(process.env.NODE_ENV, "development").toLowerCase() !== "production" &&
  text(process.env.CORE_ENABLE_PAYMENT_DEV_FALLBACK, "false").toLowerCase() === "true";
const verifiedPaymentProofStore = new Map();

const CORE_SUBSCRIPTION_PLANS = [
  {
    id: "basic",
    name: "Basic Plan",
    planType: "subscription",
    amount: 1499,
    cycleDays: 30
  },
  {
    id: "pro",
    name: "Pro Plan",
    planType: "subscription",
    amount: 3999,
    cycleDays: 30
  },
  {
    id: "premium",
    name: "Premium Plan",
    planType: "subscription",
    amount: 7999,
    cycleDays: 30
  },
  {
    id: "featured-7",
    name: "Featured Listing - 7 Days",
    planType: "featured",
    amount: 299,
    cycleDays: 7,
    requiresProperty: true
  },
  {
    id: "featured-30",
    name: "Featured Listing - 30 Days",
    planType: "featured",
    amount: 999,
    cycleDays: 30,
    requiresProperty: true
  },
  {
    id: "care-monthly-basic",
    name: "Property Care Monthly Basic",
    planType: "care",
    amount: 2500,
    cycleDays: 30
  },
  {
    id: "care-monthly-plus",
    name: "Property Care Monthly Plus",
    planType: "care",
    amount: 5500,
    cycleDays: 30
  },
  {
    id: "care-monthly-full",
    name: "Property Care Monthly Full",
    planType: "care",
    amount: 10000,
    cycleDays: 30
  },
  {
    id: "verified-badge",
    name: "Verified by PropertySetu Badge",
    planType: "verification",
    amount: 799,
    cycleDays: 30
  }
];

function normalizePlanId(planId) {
  return text(planId).toLowerCase();
}

function findPlanById(planId) {
  const id = normalizePlanId(planId);
  if (!id) return null;
  return CORE_SUBSCRIPTION_PLANS.find((item) => item.id === id) || null;
}

function inferPlanTypeFromPlanName(planName = "") {
  const raw = text(planName).toLowerCase();
  if (raw.includes("featured")) return "featured";
  if (raw.includes("care")) return "care";
  if (raw.includes("verified")) return "verification";
  if (raw.includes("agent")) return "agent";
  return "subscription";
}

function normalizePlanType(planType, planName = "") {
  const raw = text(planType).toLowerCase();
  if (["featured", "care", "verification", "agent", "subscription"].includes(raw)) {
    return raw;
  }
  return inferPlanTypeFromPlanName(planName);
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function buildDevelopmentFallbackOrderPayload({
  amountInRupees,
  userId,
  selectedPlan,
  planName,
  propertyId
}) {
  return {
    id: `order_dev_fallback_${Date.now()}`,
    amount: Math.round(amountInRupees * 100),
    currency: "INR",
    status: "created",
    receipt: `core_sub_dev_fallback_${Date.now()}`,
    notes: {
      userId,
      planId: selectedPlan?.id || "",
      planName: selectedPlan?.name || planName || "",
      propertyId: propertyId || "",
      provider: "development-fallback"
    }
  };
}

function buildPaymentProof(userId, orderId, paymentId, keySecret) {
  return crypto
    .createHash("sha256")
    .update(`${text(userId)}|${text(orderId)}|${text(paymentId)}|${text(keySecret)}`)
    .digest("hex");
}

function cleanupExpiredPaymentProofs() {
  const now = Date.now();
  for (const [proof, details] of verifiedPaymentProofStore.entries()) {
    if (!details || Number(details.expiresAt || 0) <= now) {
      verifiedPaymentProofStore.delete(proof);
    }
  }
}

function registerVerifiedPaymentProof({ userId, orderId, paymentId, keySecret }) {
  cleanupExpiredPaymentProofs();

  const proof = buildPaymentProof(userId, orderId, paymentId, keySecret);
  verifiedPaymentProofStore.set(proof, {
    userId: text(userId),
    orderId: text(orderId),
    paymentId: text(paymentId),
    expiresAt: Date.now() + VERIFIED_PAYMENT_TTL_MS
  });
  return proof;
}

function consumeVerifiedPaymentProof({ userId, orderId, paymentId, paymentProof }) {
  cleanupExpiredPaymentProofs();

  const proof = text(paymentProof);
  if (!proof) return false;

  const row = verifiedPaymentProofStore.get(proof);
  if (!row) return false;

  const matches =
    text(row.userId) === text(userId) &&
    text(row.orderId) === text(orderId) &&
    text(row.paymentId) === text(paymentId);

  if (!matches) return false;
  if (Number(row.expiresAt || 0) <= Date.now()) {
    verifiedPaymentProofStore.delete(proof);
    return false;
  }

  verifiedPaymentProofStore.delete(proof);
  return true;
}

function normalizePaymentStatus(status) {
  return text(status).toLowerCase();
}

function isPaymentStatusSuccessful(status) {
  return PAYMENT_SUCCESS_STATUSES.has(normalizePaymentStatus(status));
}

function normalizePropertyCareRequest(doc) {
  const row = doc && typeof doc.toObject === "function" ? doc.toObject() : doc;
  if (!row) return null;
  const preferredDate = normalizeDate(row.preferredDate);
  return {
    _id: toId(row._id || row.id),
    id: toId(row._id || row.id),
    userId: toId(row.userId),
    propertyId: toId(row.propertyId),
    planName: text(row.planName, "care-monthly-basic"),
    amount: numberValue(row.amount, 0),
    issueType: text(row.issueType, "monthly-package"),
    notes: text(row.notes),
    preferredDate: preferredDate ? preferredDate.toISOString() : null,
    status: text(row.status, "open"),
    createdAt: normalizeDate(row.createdAt)?.toISOString() || null,
    updatedAt: normalizeDate(row.updatedAt)?.toISOString() || null
  };
}

async function createPropertyCareRequestFromSubscription({
  userId,
  propertyId = null,
  planName,
  amount = 0,
  preferredDate = null
}) {
  const payload = {
    userId,
    propertyId: propertyId || null,
    planName,
    amount: Math.max(0, numberValue(amount, 0)),
    issueType: "monthly-package",
    notes: `Auto-created from ${planName} subscription activation.`,
    preferredDate,
    status: "open"
  };

  if (proRuntime.dbConnected) {
    const created = await CorePropertyCareRequest.create(payload);
    return normalizePropertyCareRequest(created);
  }

  const created = {
    _id: `care-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...payload,
    preferredDate: payload.preferredDate ? payload.preferredDate.toISOString() : null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  proMemoryStore.corePropertyCareRequests.unshift(created);
  proMemoryStore.corePropertyCareRequests = proMemoryStore.corePropertyCareRequests.slice(0, 1500);
  return normalizePropertyCareRequest(created);
}

async function getCorePropertyById(propertyId) {
  if (!propertyId) return null;
  if (proRuntime.dbConnected) {
    if (!mongoose.Types.ObjectId.isValid(propertyId)) return null;
    return CoreProperty.findById(propertyId);
  }
  return proMemoryStore.coreProperties.find((item) => item._id === propertyId) || null;
}

async function applyFeaturedToProperty(property, endDate) {
  if (!property) return null;
  const propertyId = toId(property._id || property.id);
  const nextFeaturedUntil = endDate instanceof Date ? endDate.toISOString() : endDate;
  const currentVerification = property?.verification || {};
  const nextVerification = {
    ...currentVerification,
    featuredPlanActive: true,
    featuredUntil: nextFeaturedUntil
  };

  if (proRuntime.dbConnected) {
    return CoreProperty.findByIdAndUpdate(
      propertyId,
      {
        $set: {
          featured: true,
          featuredUntil: endDate,
          verification: nextVerification
        }
      },
      { new: true }
    );
  }

  const index = proMemoryStore.coreProperties.findIndex((item) => item._id === propertyId);
  if (index < 0) return null;
  proMemoryStore.coreProperties[index] = {
    ...proMemoryStore.coreProperties[index],
    featured: true,
    featuredUntil: nextFeaturedUntil,
    verification: nextVerification,
    updatedAt: new Date().toISOString()
  };
  return proMemoryStore.coreProperties[index];
}

async function getCoreUserById(userId) {
  if (!userId) return null;
  if (proRuntime.dbConnected) {
    if (!mongoose.Types.ObjectId.isValid(userId)) return null;
    return CoreUser.findById(userId);
  }
  return proMemoryStore.coreUsers.find((item) => item._id === userId) || null;
}

async function updateUserPlan(userId, planName) {
  if (!userId) return null;
  if (proRuntime.dbConnected) {
    return CoreUser.findByIdAndUpdate(
      userId,
      { $set: { subscriptionPlan: planName } },
      { new: true }
    );
  }
  const index = proMemoryStore.coreUsers.findIndex((item) => item._id === userId);
  if (index < 0) return null;
  proMemoryStore.coreUsers[index] = {
    ...proMemoryStore.coreUsers[index],
    subscriptionPlan: planName,
    updatedAt: new Date().toISOString()
  };
  return proMemoryStore.coreUsers[index];
}

export function listCoreSubscriptionPlans(_req, res) {
  return res.json({
    success: true,
    total: CORE_SUBSCRIPTION_PLANS.length,
    items: CORE_SUBSCRIPTION_PLANS
  });
}

export async function createCoreSubscriptionPaymentOrder(req, res, next) {
  try {
    const planId = normalizePlanId(req.body?.planId);
    const selectedPlan = findPlanById(planId);
    if (planId && !selectedPlan) {
      return res.status(400).json({
        success: false,
        message: "Invalid planId."
      });
    }

    const amountInRupees = numberValue(
      req.body?.amountInRupees,
      selectedPlan?.amount || 0
    );
    if (!amountInRupees || amountInRupees <= 0) {
      return res.status(400).json({
        success: false,
        message: "amountInRupees must be greater than zero."
      });
    }

    const userId = toId(req.coreUser?.id);
    const planName = text(req.body?.planName);
    const propertyId = text(req.body?.propertyId);
    const client = getProRazorpayClient();
    if (!client) {
      if (!PAYMENT_DEVELOPMENT_FALLBACK) {
        return res.status(503).json({
          success: false,
          message: "Razorpay keys missing in environment."
        });
      }

      const fallbackOrder = buildDevelopmentFallbackOrderPayload({
        amountInRupees,
        userId,
        selectedPlan,
        planName,
        propertyId
      });

      return res.status(201).json({
        success: true,
        keyId: getRazorpayPublicKey() || "rzp_test_dev_fallback_key",
        order: fallbackOrder,
        selectedPlan: selectedPlan || null,
        paymentVerification: {
          strictMode: STRICT_PAYMENT_PROOF,
          mode: "development-fallback"
        }
      });
    }

    let order;
    try {
      order = await client.orders.create({
        amount: Math.round(amountInRupees * 100),
        currency: "INR",
        receipt: `core_sub_${Date.now()}`,
        notes: {
          userId,
          planId: selectedPlan?.id || "",
          planName: selectedPlan?.name || planName,
          propertyId
        }
      });
    } catch (error) {
      if (!PAYMENT_DEVELOPMENT_FALLBACK) {
        throw error;
      }
      order = buildDevelopmentFallbackOrderPayload({
        amountInRupees,
        userId,
        selectedPlan,
        planName,
        propertyId
      });
    }

      return res.status(201).json({
      success: true,
      keyId: getRazorpayPublicKey() || "rzp_test_dev_fallback_key",
      order,
      selectedPlan: selectedPlan || null,
      paymentVerification: {
        strictMode: STRICT_PAYMENT_PROOF,
        mode: "razorpay"
      }
    });
  } catch (error) {
    return next(error);
  }
}

export function verifyCoreSubscriptionPayment(req, res, next) {
  try {
    const keySecret = isConfiguredCredential(process.env.RAZORPAY_KEY_SECRET)
      ? process.env.RAZORPAY_KEY_SECRET
      : "";

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id) {
      return res.status(400).json({
        success: false,
        message: "Payment verification payload incomplete."
      });
    }

    if (!keySecret) {
      if (!PAYMENT_DEVELOPMENT_FALLBACK) {
        return res.status(503).json({
          success: false,
          message: "Razorpay secret missing in environment."
        });
      }

      const userId = toId(req.coreUser?.id);
      const paymentProof = registerVerifiedPaymentProof({
        userId,
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        keySecret: "development-fallback-secret"
      });

      return res.json({
        success: true,
        message: "Payment verified in development compatibility mode.",
        paymentProof,
        paymentVerification: {
          strictMode: STRICT_PAYMENT_PROOF,
          proofExpiresInSec: Math.floor(VERIFIED_PAYMENT_TTL_MS / 1000),
          mode: "development-fallback"
        }
      });
    }

    if (!razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Payment verification payload incomplete."
      });
    }

    const signatureBody = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac("sha256", keySecret)
      .update(signatureBody)
      .digest("hex");

    const isValid = expected === razorpay_signature;
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment signature."
      });
    }

    const userId = toId(req.coreUser?.id);
    const paymentProof = registerVerifiedPaymentProof({
      userId,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      keySecret
    });

    return res.json({
      success: true,
      message: "Payment verified.",
      paymentProof,
      paymentVerification: {
        strictMode: STRICT_PAYMENT_PROOF,
        proofExpiresInSec: Math.floor(VERIFIED_PAYMENT_TTL_MS / 1000),
        mode: "razorpay"
      }
    });
  } catch (error) {
    return next(error);
  }
}

export async function createCoreSubscription(req, res, next) {
  try {
    const userId = toId(req.coreUser?.id);
    const planId = normalizePlanId(req.body?.planId);
    const selectedPlan = findPlanById(planId);
    if (planId && !selectedPlan) {
      return res.status(400).json({
        success: false,
        message: "Invalid planId."
      });
    }

    const planName = text(req.body?.planName || selectedPlan?.name);
    const planType = normalizePlanType(
      req.body?.planType || selectedPlan?.planType,
      planName
    );
    const amount = numberValue(
      typeof req.body?.amount !== "undefined" ? req.body.amount : selectedPlan?.amount,
      0
    );
    const propertyIdInput = text(req.body?.propertyId);
    const paymentProvider = text(req.body?.paymentProvider);
    const paymentOrderId = text(req.body?.paymentOrderId);
    const paymentId = text(req.body?.paymentId);
    const paymentStatus = text(req.body?.paymentStatus);
    const paymentProof = text(req.body?.paymentProof);
    const startDate = normalizeDate(req.body?.startDate) || new Date();
    const endDateInput = normalizeDate(req.body?.endDate);
    const durationDays = Math.max(
      1,
      numberValue(req.body?.durationDays, selectedPlan?.cycleDays || 30)
    );
    const endDate =
      endDateInput || new Date(startDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

    if (!planName) {
      return res.status(400).json({
        success: false,
        message: "planName is required."
      });
    }

    if (amount < 0) {
      return res.status(400).json({
        success: false,
        message: "amount must be zero or positive."
      });
    }

    if (endDate <= startDate) {
      return res.status(400).json({
        success: false,
        message: "endDate must be after startDate."
      });
    }

    if (paymentStatus && !isPaymentStatusSuccessful(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: "paymentStatus must represent a successful payment."
      });
    }

    const user = await getCoreUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    const currentRole = text(req.coreUser?.role).toLowerCase();
    const isAdmin = currentRole === "admin";
    let targetProperty = null;
    if (propertyIdInput) {
      targetProperty = await getCorePropertyById(propertyIdInput);
      if (!targetProperty) {
        return res.status(404).json({
          success: false,
          message: "Target property not found."
        });
      }
    }

    if (planType === "featured" || selectedPlan?.requiresProperty) {
      if (!propertyIdInput) {
        return res.status(400).json({
          success: false,
          message: "propertyId is required for featured listing subscription."
        });
      }
      const propertyOwnerId = toId(targetProperty?.ownerId);
      if (!isAdmin && propertyOwnerId !== userId) {
        return res.status(403).json({
          success: false,
          message: "You can activate featured listing only on your own property."
        });
      }
    }

    if (amount > 0 && !isAdmin && STRICT_PAYMENT_PROOF) {
      if (!paymentOrderId || !paymentId || !paymentProof) {
        return res.status(400).json({
          success: false,
          message:
            "For paid plans, paymentOrderId + paymentId + paymentProof are required in strict mode."
        });
      }

      const proofValid = consumeVerifiedPaymentProof({
        userId,
        orderId: paymentOrderId,
        paymentId,
        paymentProof
      });

      if (!proofValid) {
        return res.status(400).json({
          success: false,
          message: "paymentProof is invalid or expired. Verify payment again."
        });
      }
    }

    let created;
    const propertyIdForCreate = targetProperty ? toId(targetProperty._id || targetProperty.id) : null;
    if (proRuntime.dbConnected) {
      created = await CoreSubscription.create({
        userId,
        planName,
        planType,
        amount,
        propertyId: propertyIdForCreate || null,
        paymentProvider,
        paymentOrderId,
        paymentId,
        paymentStatus,
        startDate,
        endDate
      });
    } else {
      created = {
        _id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        userId,
        planName,
        planType,
        amount,
        propertyId: propertyIdForCreate || null,
        paymentProvider,
        paymentOrderId,
        paymentId,
        paymentStatus,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      proMemoryStore.coreSubscriptions.push(created);
    }

    let updatedProperty = null;
    if (planType === "featured" && targetProperty) {
      updatedProperty = await applyFeaturedToProperty(targetProperty, endDate);
    }

    let propertyCareRequest = null;
    if (planType === "care") {
      propertyCareRequest = await createPropertyCareRequestFromSubscription({
        userId,
        propertyId: propertyIdForCreate,
        planName,
        amount,
        preferredDate: startDate
      });
    }

    const updatedUser = await updateUserPlan(userId, planName);

    return res.status(201).json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      subscription: normalizeCoreSubscription(created),
      user: normalizeCoreUser(updatedUser),
      property: updatedProperty ? normalizeCoreProperty(updatedProperty) : undefined,
      propertyCareRequest: propertyCareRequest || undefined,
      paymentVerification: {
        strictMode: STRICT_PAYMENT_PROOF,
        requiredForPaidPlans: STRICT_PAYMENT_PROOF && amount > 0 && !isAdmin
      }
    });
  } catch (error) {
    return next(error);
  }
}

export async function listMyCoreSubscriptions(req, res, next) {
  try {
    const userId = toId(req.coreUser?.id);
    let rows;

    if (proRuntime.dbConnected) {
      rows = await CoreSubscription.find({ userId }).sort({ endDate: -1 }).lean();
    } else {
      rows = proMemoryStore.coreSubscriptions
        .filter((item) => toId(item.userId) === userId)
        .sort((a, b) => new Date(b.endDate) - new Date(a.endDate));
    }

    const items = rows.map((item) => normalizeCoreSubscription(item));
    const active = items.find(
      (item) => item.endDate && new Date(item.endDate).getTime() >= Date.now()
    );

    return res.json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      total: items.length,
      activePlan: active?.planName || "free",
      items
    });
  } catch (error) {
    return next(error);
  }
}

export async function listAllCoreSubscriptions(req, res, next) {
  try {
    const limit = Math.min(500, Math.max(1, numberValue(req.query.limit, 100)));
    let rows;

    if (proRuntime.dbConnected) {
      rows = await CoreSubscription.find({}).sort({ createdAt: -1 }).limit(limit).lean();
    } else {
      rows = [...proMemoryStore.coreSubscriptions]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit);
    }

    return res.json({
      success: true,
      total: rows.length,
      items: rows.map((item) => normalizeCoreSubscription(item))
    });
  } catch (error) {
    return next(error);
  }
}
