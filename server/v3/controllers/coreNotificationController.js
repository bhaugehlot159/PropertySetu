import mongoose from "mongoose";
import CoreNotification from "../models/CoreNotification.js";
import { proRuntime } from "../../config/proRuntime.js";
import { proMemoryStore } from "../../runtime/proMemoryStore.js";
import { toId } from "../utils/coreMappers.js";

function text(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function asIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeNotification(doc) {
  const row = doc && typeof doc.toObject === "function" ? doc.toObject() : doc;
  if (!row) return null;
  return {
    _id: toId(row._id || row.id),
    id: toId(row._id || row.id),
    userId: toId(row.userId),
    title: text(row.title),
    message: text(row.message),
    category: text(row.category, "general"),
    isRead: Boolean(row.isRead),
    metadata:
      row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
        ? row.metadata
        : {},
    createdAt: asIso(row.createdAt),
    updatedAt: asIso(row.updatedAt)
  };
}

export async function createCoreNotification({
  userId,
  title,
  message,
  category = "general",
  metadata = {}
} = {}) {
  const normalizedUserId = toId(userId);
  if (!normalizedUserId || !text(title) || !text(message)) return null;

  if (proRuntime.dbConnected) {
    if (!mongoose.Types.ObjectId.isValid(normalizedUserId)) return null;
    const created = await CoreNotification.create({
      userId: normalizedUserId,
      title: text(title),
      message: text(message),
      category: text(category, "general"),
      metadata:
        metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {}
    });
    return normalizeNotification(created);
  }

  const created = {
    _id: `noti-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId: normalizedUserId,
    title: text(title),
    message: text(message),
    category: text(category, "general"),
    isRead: false,
    metadata:
      metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  proMemoryStore.coreNotifications.unshift(created);
  proMemoryStore.coreNotifications = proMemoryStore.coreNotifications.slice(0, 5000);
  return normalizeNotification(created);
}

export async function listMyCoreNotifications(req, res, next) {
  try {
    const userId = toId(req.coreUser?.id);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));

    let rows = [];
    if (proRuntime.dbConnected) {
      if (mongoose.Types.ObjectId.isValid(userId)) {
        rows = await CoreNotification.find({ userId })
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean();
      }
    } else {
      rows = proMemoryStore.coreNotifications
        .filter((item) => toId(item.userId) === userId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit);
    }

    const items = rows.map((row) => normalizeNotification(row));
    const unread = items.filter((item) => !item.isRead).length;

    return res.json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      total: items.length,
      unread,
      items
    });
  } catch (error) {
    return next(error);
  }
}

export async function markCoreNotificationRead(req, res, next) {
  try {
    const userId = toId(req.coreUser?.id);
    const notificationId = text(req.params.notificationId);
    if (!notificationId) {
      return res.status(400).json({
        success: false,
        message: "notificationId is required."
      });
    }

    let updated = null;
    if (proRuntime.dbConnected) {
      if (!mongoose.Types.ObjectId.isValid(notificationId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid notificationId."
        });
      }
      updated = await CoreNotification.findOneAndUpdate(
        { _id: notificationId, userId },
        { $set: { isRead: true } },
        { new: true }
      );
    } else {
      const index = proMemoryStore.coreNotifications.findIndex(
        (item) =>
          toId(item._id || item.id) === notificationId && toId(item.userId) === userId
      );
      if (index >= 0) {
        proMemoryStore.coreNotifications[index] = {
          ...proMemoryStore.coreNotifications[index],
          isRead: true,
          updatedAt: new Date().toISOString()
        };
        updated = proMemoryStore.coreNotifications[index];
      }
    }

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Notification not found."
      });
    }

    return res.json({
      success: true,
      item: normalizeNotification(updated)
    });
  } catch (error) {
    return next(error);
  }
}

export async function markAllCoreNotificationsRead(req, res, next) {
  try {
    const userId = toId(req.coreUser?.id);
    let updatedCount = 0;

    if (proRuntime.dbConnected) {
      const result = await CoreNotification.updateMany(
        { userId, isRead: false },
        { $set: { isRead: true } }
      );
      updatedCount = Number(result.modifiedCount || 0);
    } else {
      proMemoryStore.coreNotifications = proMemoryStore.coreNotifications.map((item) => {
        if (toId(item.userId) !== userId || item.isRead) return item;
        updatedCount += 1;
        return {
          ...item,
          isRead: true,
          updatedAt: new Date().toISOString()
        };
      });
    }

    return res.json({
      success: true,
      updatedCount
    });
  } catch (error) {
    return next(error);
  }
}
