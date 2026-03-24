import mongoose from "mongoose";
import CoreSubscription from "../models/CoreSubscription.js";
import CoreProperty from "../models/CoreProperty.js";
import CoreUser from "../models/CoreUser.js";
import { proRuntime } from "../../config/proRuntime.js";
import { proMemoryStore } from "../../runtime/proMemoryStore.js";
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

export async function createCoreSubscription(req, res, next) {
  try {
    const userId = toId(req.coreUser?.id);
    const planName = text(req.body?.planName);
    const planType = normalizePlanType(req.body?.planType, planName);
    const amount = numberValue(req.body?.amount, 0);
    const propertyIdInput = text(req.body?.propertyId);
    const paymentProvider = text(req.body?.paymentProvider);
    const paymentOrderId = text(req.body?.paymentOrderId);
    const paymentId = text(req.body?.paymentId);
    const paymentStatus = text(req.body?.paymentStatus);
    const startDate = normalizeDate(req.body?.startDate) || new Date();
    const endDateInput = normalizeDate(req.body?.endDate);
    const durationDays = Math.max(1, numberValue(req.body?.durationDays, 30));
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

    if (planType === "featured") {
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

    const updatedUser = await updateUserPlan(userId, planName);

    return res.status(201).json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      subscription: normalizeCoreSubscription(created),
      user: normalizeCoreUser(updatedUser),
      property: updatedProperty ? normalizeCoreProperty(updatedProperty) : undefined
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
