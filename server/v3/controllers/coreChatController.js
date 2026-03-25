import mongoose from "mongoose";
import { proRuntime } from "../../config/proRuntime.js";
import { proMemoryStore } from "../../runtime/proMemoryStore.js";
import CoreMessage from "../models/CoreMessage.js";
import CoreProperty from "../models/CoreProperty.js";

const DIRECT_PHONE_PATTERN = /\+?\d[\d\s\-()]{8,}\d/;
const DIRECT_EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const SPAM_HINTS = [
  "earn money fast",
  "click here",
  "crypto double",
  "free gift",
  "urgent transfer"
];

function text(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function toId(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value._id) return toId(value._id);
  return String(value);
}

function asIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeMessage(doc) {
  const row = doc && typeof doc.toObject === "function" ? doc.toObject() : doc;
  if (!row) return null;
  return {
    _id: toId(row._id || row.id),
    id: toId(row._id || row.id),
    propertyId: toId(row.propertyId),
    senderId: toId(row.senderId),
    senderRole: text(row.senderRole, "buyer"),
    message: text(row.message),
    containsDirectContact: Boolean(row.containsDirectContact),
    containsSpam: Boolean(row.containsSpam),
    createdAt: asIso(row.createdAt),
    updatedAt: asIso(row.updatedAt)
  };
}

function containsSpam(message = "") {
  const value = String(message || "").toLowerCase();
  return SPAM_HINTS.some((hint) => value.includes(hint));
}

async function ensurePropertyExists(propertyId) {
  if (!propertyId) return false;
  if (proRuntime.dbConnected) {
    if (!mongoose.Types.ObjectId.isValid(propertyId)) return false;
    const found = await CoreProperty.findById(propertyId).select("_id").lean();
    return Boolean(found);
  }
  return proMemoryStore.coreProperties.some((item) => toId(item._id) === propertyId);
}

export async function sendCoreMessage(req, res, next) {
  try {
    const propertyId = text(req.body?.propertyId);
    const message = text(req.body?.message);

    if (!propertyId || !message) {
      return res.status(400).json({
        success: false,
        message: "propertyId and message are required."
      });
    }

    const propertyExists = await ensurePropertyExists(propertyId);
    if (!propertyExists) {
      return res.status(404).json({
        success: false,
        message: "Property not found."
      });
    }

    if (DIRECT_PHONE_PATTERN.test(message) || DIRECT_EMAIL_PATTERN.test(message)) {
      return res.status(400).json({
        success: false,
        message: "Direct phone/email sharing is blocked. Use in-app chat only."
      });
    }

    if (containsSpam(message)) {
      return res.status(400).json({
        success: false,
        message: "Message blocked by anti-spam policy."
      });
    }

    const senderId = text(req.coreUser?.id);
    const senderRole = text(req.coreUser?.role, "buyer");
    let created;

    if (proRuntime.dbConnected) {
      created = await CoreMessage.create({
        propertyId,
        senderId,
        senderRole,
        message,
        containsDirectContact: false,
        containsSpam: false
      });
    } else {
      created = {
        _id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        propertyId,
        senderId,
        senderRole,
        message,
        containsDirectContact: false,
        containsSpam: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      proMemoryStore.coreMessages.unshift(created);
      proMemoryStore.coreMessages = proMemoryStore.coreMessages.slice(0, 1500);
    }

    return res.status(201).json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      item: normalizeMessage(created)
    });
  } catch (error) {
    return next(error);
  }
}

export async function listCoreMessagesByProperty(req, res, next) {
  try {
    const propertyId = text(req.params.propertyId);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));

    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: "propertyId is required."
      });
    }

    let items = [];
    if (proRuntime.dbConnected) {
      if (!mongoose.Types.ObjectId.isValid(propertyId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid propertyId."
        });
      }
      const rows = await CoreMessage.find({ propertyId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      items = rows.reverse().map((row) => normalizeMessage(row));
    } else {
      items = proMemoryStore.coreMessages
        .filter((item) => text(item.propertyId) === propertyId)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .slice(-limit)
        .map((row) => normalizeMessage(row));
    }

    return res.json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      total: items.length,
      items
    });
  } catch (error) {
    return next(error);
  }
}

export async function listMyCoreMessages(req, res, next) {
  try {
    const userId = text(req.coreUser?.id);
    const limit = Math.min(300, Math.max(1, Number(req.query.limit || 100)));
    let items = [];

    if (proRuntime.dbConnected) {
      const rows = await CoreMessage.find({ senderId: userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      items = rows.map((row) => normalizeMessage(row));
    } else {
      items = proMemoryStore.coreMessages
        .filter((item) => text(item.senderId) === userId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit)
        .map((row) => normalizeMessage(row));
    }

    return res.json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      total: items.length,
      items
    });
  } catch (error) {
    return next(error);
  }
}
