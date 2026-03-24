import mongoose from "mongoose";
import CoreSubscription from "../models/CoreSubscription.js";
import CoreUser from "../models/CoreUser.js";
import { proRuntime } from "../../config/proRuntime.js";
import { proMemoryStore } from "../../runtime/proMemoryStore.js";
import {
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

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
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
    const amount = numberValue(req.body?.amount, 0);
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

    let created;
    if (proRuntime.dbConnected) {
      created = await CoreSubscription.create({
        userId,
        planName,
        amount,
        startDate,
        endDate
      });
    } else {
      created = {
        _id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        userId,
        planName,
        amount,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      proMemoryStore.coreSubscriptions.push(created);
    }

    const updatedUser = await updateUserPlan(userId, planName);

    return res.status(201).json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      subscription: normalizeCoreSubscription(created),
      user: normalizeCoreUser(updatedUser)
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
