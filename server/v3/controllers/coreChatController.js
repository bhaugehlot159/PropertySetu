import mongoose from "mongoose";
import { proRuntime } from "../../config/proRuntime.js";
import { proMemoryStore } from "../../runtime/proMemoryStore.js";
import CoreMessage from "../models/CoreMessage.js";
import CoreProperty from "../models/CoreProperty.js";
import CoreUser from "../models/CoreUser.js";
import { normalizeCoreProperty, toId } from "../utils/coreMappers.js";
import { createCoreNotification } from "./coreNotificationController.js";

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

function asIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function bool(value) {
  if (typeof value === "boolean") return value;
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return false;
}

function maskPhone(phone = "") {
  const raw = String(phone || "").replace(/\D/g, "");
  if (raw.length <= 4) return raw;
  return `${"*".repeat(Math.max(0, raw.length - 4))}${raw.slice(-4)}`;
}

function buildWhatsAppLink(phone = "", message = "") {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  const payload = encodeURIComponent(String(message || "").trim());
  return `https://wa.me/${digits}${payload ? `?text=${payload}` : ""}`;
}

function normalizeMessage(doc) {
  const row = doc && typeof doc.toObject === "function" ? doc.toObject() : doc;
  if (!row) return null;
  return {
    _id: toId(row._id || row.id),
    id: toId(row._id || row.id),
    propertyId: toId(row.propertyId),
    senderId: toId(row.senderId),
    receiverId: toId(row.receiverId),
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

async function findPropertyById(propertyId) {
  if (!propertyId) return null;
  if (proRuntime.dbConnected) {
    if (!mongoose.Types.ObjectId.isValid(propertyId)) return null;
    return CoreProperty.findById(propertyId).lean();
  }
  return (
    proMemoryStore.coreProperties.find((item) => toId(item._id || item.id) === propertyId) ||
    null
  );
}

async function findUserById(userId) {
  if (!userId) return null;
  if (proRuntime.dbConnected) {
    if (!mongoose.Types.ObjectId.isValid(userId)) return null;
    return CoreUser.findById(userId).lean();
  }
  return proMemoryStore.coreUsers.find((item) => toId(item._id || item.id) === userId) || null;
}

async function canAccessPropertyChat({ propertyId, userId, role }) {
  if (!propertyId || !userId) return false;
  if (String(role || "").toLowerCase() === "admin") return true;

  const property = await findPropertyById(propertyId);
  if (!property) return false;
  const propertyOwnerId = toId(property.ownerId);
  if (propertyOwnerId && propertyOwnerId === userId) return true;

  if (proRuntime.dbConnected) {
    if (!mongoose.Types.ObjectId.isValid(propertyId)) return false;
    const count = await CoreMessage.countDocuments({
      propertyId,
      $or: [{ senderId: userId }, { receiverId: userId }]
    });
    return count > 0;
  }

  return proMemoryStore.coreMessages.some(
    (item) =>
      toId(item.propertyId) === propertyId &&
      (toId(item.senderId) === userId || toId(item.receiverId) === userId)
  );
}

async function findLatestCounterParty(propertyId, ownerId) {
  if (!propertyId || !ownerId) return "";

  if (proRuntime.dbConnected) {
    if (!mongoose.Types.ObjectId.isValid(propertyId)) return "";
    const row = await CoreMessage.find({
      propertyId,
      $or: [{ senderId: ownerId }, { receiverId: ownerId }]
    })
      .sort({ createdAt: -1 })
      .lean()
      .limit(1);
    if (!row?.length) return "";
    const latest = row[0];
    const senderId = toId(latest.senderId);
    const receiverId = toId(latest.receiverId);
    return senderId === ownerId ? receiverId : senderId;
  }

  const latest = [...proMemoryStore.coreMessages]
    .filter(
      (item) =>
        toId(item.propertyId) === propertyId &&
        (toId(item.senderId) === ownerId || toId(item.receiverId) === ownerId)
    )
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];

  if (!latest) return "";
  const senderId = toId(latest.senderId);
  const receiverId = toId(latest.receiverId);
  return senderId === ownerId ? receiverId : senderId;
}

function resolveSenderRole(role = "") {
  const raw = String(role || "").toLowerCase();
  if (raw === "admin" || raw === "seller" || raw === "buyer") return raw;
  return "buyer";
}

function buildWhatsAppPayload({
  enabled = false,
  phone = "",
  propertyTitle = "",
  propertyId = "",
  senderName = ""
} = {}) {
  if (!enabled) {
    return {
      enabled: false
    };
  }

  const prefilledMessage = `Hi, I am interested in "${propertyTitle}" on PropertySetu (Property ID: ${propertyId}).`;
  const url = buildWhatsAppLink(phone, prefilledMessage);

  return {
    enabled: Boolean(url),
    url: url || "",
    phoneMasked: maskPhone(phone),
    receiverName: senderName || "",
    prefilledMessage
  };
}

export async function sendCoreMessage(req, res, next) {
  try {
    const propertyId = text(req.body?.propertyId);
    const message = text(req.body?.message);
    const senderId = text(req.coreUser?.id);
    const senderRole = resolveSenderRole(req.coreUser?.role);
    const requestedReceiverId = text(req.body?.receiverId);
    const whatsappHandoff = bool(req.body?.whatsappHandoff);

    if (!propertyId || !message) {
      return res.status(400).json({
        success: false,
        message: "propertyId and message are required."
      });
    }

    const property = await findPropertyById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found."
      });
    }
    const propertyInfo = normalizeCoreProperty(property);
    const propertyOwnerId = toId(propertyInfo?.ownerId);

    if (!propertyOwnerId) {
      return res.status(400).json({
        success: false,
        message: "Property owner not found for chat."
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

    let receiverId = "";
    if (senderRole === "buyer") {
      receiverId = propertyOwnerId;
    } else if (senderRole === "seller" || senderRole === "admin") {
      if (senderId === propertyOwnerId) {
        receiverId =
          requestedReceiverId || (await findLatestCounterParty(propertyId, propertyOwnerId));
      } else if (senderRole === "admin") {
        receiverId = requestedReceiverId || propertyOwnerId;
      } else {
        return res.status(403).json({
          success: false,
          message: "Only property owner can send seller-side messages."
        });
      }
    }

    if (!receiverId) {
      return res.status(400).json({
        success: false,
        message: "receiverId is required for this chat flow."
      });
    }
    if (receiverId === senderId) {
      return res.status(400).json({
        success: false,
        message: "senderId and receiverId cannot be the same."
      });
    }

    const receiver = await findUserById(receiverId);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: "Chat receiver not found."
      });
    }

    let created;

    if (proRuntime.dbConnected) {
      created = await CoreMessage.create({
        propertyId,
        senderId,
        receiverId,
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
        receiverId,
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

    await createCoreNotification({
      userId: receiverId,
      title: "New Chat Message",
      message: `You received a new message on ${text(propertyInfo?.title, "a property")}.`,
      category: "chat",
      metadata: {
        propertyId,
        senderId,
        receiverId,
        chatMessageId: toId(created?._id || created?.id)
      }
    });

    return res.status(201).json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      item: normalizeMessage(created),
      whatsapp: buildWhatsAppPayload({
        enabled: whatsappHandoff,
        phone: text(receiver?.phone),
        propertyTitle: text(propertyInfo?.title),
        propertyId: toId(propertyInfo?.id),
        senderName: text(receiver?.name)
      })
    });
  } catch (error) {
    return next(error);
  }
}

export async function listCoreMessagesByProperty(req, res, next) {
  try {
    const propertyId = text(req.params.propertyId);
    const userId = text(req.coreUser?.id);
    const role = resolveSenderRole(req.coreUser?.role);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));

    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: "propertyId is required."
      });
    }

    const accessAllowed = await canAccessPropertyChat({ propertyId, userId, role });
    if (!accessAllowed) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to access this chat."
      });
    }

    const property = await findPropertyById(propertyId);
    const ownerId = toId(property?.ownerId);
    const userScopeFilter =
      role === "admin" || userId === ownerId
        ? null
        : {
            $or: [{ senderId: userId }, { receiverId: userId }]
          };

    let items = [];
    if (proRuntime.dbConnected) {
      if (!mongoose.Types.ObjectId.isValid(propertyId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid propertyId."
        });
      }
      const rows = await CoreMessage.find(
        userScopeFilter ? { propertyId, ...userScopeFilter } : { propertyId }
      )
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      items = rows.reverse().map((row) => normalizeMessage(row));
    } else {
      items = proMemoryStore.coreMessages
        .filter((item) => {
          if (text(item.propertyId) !== propertyId) return false;
          if (!userScopeFilter) return true;
          return toId(item.senderId) === userId || toId(item.receiverId) === userId;
        })
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
      const rows = await CoreMessage.find({
        $or: [{ senderId: userId }, { receiverId: userId }]
      })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      items = rows.map((row) => normalizeMessage(row));
    } else {
      items = proMemoryStore.coreMessages
        .filter(
          (item) => text(item.senderId) === userId || text(item.receiverId) === userId
        )
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

export async function getCoreChatWhatsappLink(req, res, next) {
  try {
    const propertyId = text(req.params.propertyId);
    const userId = text(req.coreUser?.id);
    const role = resolveSenderRole(req.coreUser?.role);

    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: "propertyId is required."
      });
    }

    const property = await findPropertyById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found."
      });
    }
    const propertyInfo = normalizeCoreProperty(property);
    const ownerId = toId(propertyInfo?.ownerId);

    if (role !== "admin" && userId !== ownerId) {
      const hasAccess = await canAccessPropertyChat({ propertyId, userId, role });
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: "You are not allowed to access WhatsApp handoff."
        });
      }
    }

    const targetUserId = userId === ownerId ? text(req.query.receiverId) : ownerId;
    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: "receiverId is required for owner-side WhatsApp handoff."
      });
    }

    const targetUser = await findUserById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "Receiver not found."
      });
    }

    const prefilledMessage =
      text(req.query.message) ||
      `Hi, I am interested in "${text(propertyInfo?.title)}" on PropertySetu (Property ID: ${toId(
        propertyInfo?.id
      )}).`;
    const url = buildWhatsAppLink(text(targetUser.phone), prefilledMessage);

    if (!url) {
      return res.status(400).json({
        success: false,
        message: "Receiver phone is not available for WhatsApp handoff."
      });
    }

    return res.json({
      success: true,
      whatsapp: {
        url,
        phoneMasked: maskPhone(text(targetUser.phone)),
        prefilledMessage,
        receiverId: toId(targetUser._id || targetUser.id),
        receiverName: text(targetUser.name)
      }
    });
  } catch (error) {
    return next(error);
  }
}
