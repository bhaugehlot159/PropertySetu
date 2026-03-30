import mongoose from "mongoose";
import { proRuntime } from "../../config/proRuntime.js";
import { proMemoryStore } from "../../runtime/proMemoryStore.js";
import CoreProperty from "../models/CoreProperty.js";
import CoreUpload from "../models/CoreUpload.js";
import {
  buildMaskedPrivateDocUrl,
  buildPrivateDocAccessEnvelope,
  fingerprintPrivateDocAccessToken,
  hashPrivateDocSourceUrl,
  verifyPrivateDocAccessToken
} from "../utils/corePrivateDocSecurity.js";

function text(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toId(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value._id) return toId(value._id);
  return String(value);
}

function sameId(left, right) {
  return text(left) && text(right) && text(left) === text(right);
}

function asIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

const PRIVATE_DOC_CATEGORY_HINTS = [
  "doc",
  "document",
  "agreement",
  "registry",
  "id-proof",
  "address-proof",
  "ownership",
  "tax",
  "legal"
];
const MAX_FILES_PER_REQUEST = 25;
const MAX_FILE_BYTES = Math.max(2 * 1024 * 1024, Number(process.env.CORE_UPLOAD_MAX_FILE_BYTES || 20 * 1024 * 1024));
const MAX_TOTAL_BYTES = Math.max(MAX_FILE_BYTES, Number(process.env.CORE_UPLOAD_MAX_TOTAL_BYTES || 80 * 1024 * 1024));
const BLOCKED_FILE_EXTENSIONS = new Set(["exe", "bat", "cmd", "com", "scr", "msi", "dll", "js", "ps1", "sh"]);
const ALLOWED_PRIVATE_DOC_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/octet-stream"
]);
const PRIVATE_DOC_ACCESS_EVENT_MAX_ITEMS = Math.max(
  200,
  Number(process.env.CORE_PRIVATE_DOC_ACCESS_EVENT_MAX_ITEMS || 5000)
);
const PRIVATE_DOC_TOKEN_REPLAY_GUARD_ENABLED =
  String(process.env.CORE_PRIVATE_DOC_TOKEN_REPLAY_GUARD_ENABLED || "true").trim().toLowerCase() !== "false";
const PRIVATE_DOC_TOKEN_REPLAY_CACHE_MAX = Math.max(
  100,
  Number(process.env.CORE_PRIVATE_DOC_TOKEN_REPLAY_CACHE_MAX || 12000)
);
const PRIVATE_DOC_CONTEXT_BINDING_REQUIRED =
  String(process.env.CORE_PRIVATE_DOC_CONTEXT_BINDING_REQUIRED || "true").trim().toLowerCase() !== "false";
const PRIVATE_DOC_CONTEXT_BINDING_ADMIN_BYPASS =
  String(process.env.CORE_PRIVATE_DOC_CONTEXT_BINDING_ADMIN_BYPASS || "false").trim().toLowerCase() === "true";
const privateDocConsumedTokenMap = new Map();

function normalizeCategory(value) {
  return text(value, "misc").toLowerCase();
}

function categoryImpliesPrivate(category) {
  const raw = normalizeCategory(category);
  return PRIVATE_DOC_CATEGORY_HINTS.some((hint) => raw.includes(hint));
}

function normalizePropertyId(propertyIdRaw) {
  const value = text(propertyIdRaw);
  if (!value) return null;
  if (proRuntime.dbConnected) {
    return mongoose.Types.ObjectId.isValid(value) ? value : null;
  }
  return value;
}

function extractExtension(filename = "") {
  const safeName = text(filename);
  const dotIndex = safeName.lastIndexOf(".");
  if (dotIndex < 0) return "";
  return safeName.slice(dotIndex + 1).toLowerCase();
}

function categoryLooksImage(category = "") {
  const raw = normalizeCategory(category);
  return raw.includes("photo") || raw.includes("image") || raw.includes("gallery");
}

function categoryLooksVideo(category = "") {
  const raw = normalizeCategory(category);
  return raw.includes("video");
}

function isAllowedMimeForUpload(row = {}) {
  const type = text(row.type, "application/octet-stream").toLowerCase();
  const category = normalizeCategory(row.category);
  const privateDoc = categoryImpliesPrivate(category) || Boolean(row.isPrivate);

  if (privateDoc) {
    return ALLOWED_PRIVATE_DOC_TYPES.has(type) || type.startsWith("image/");
  }

  if (categoryLooksImage(category)) {
    return type.startsWith("image/");
  }
  if (categoryLooksVideo(category)) {
    return type.startsWith("video/");
  }

  return (
    type.startsWith("image/") ||
    type.startsWith("video/") ||
    type === "application/octet-stream"
  );
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

function recordPrivateDocAccessEvent(event = {}) {
  const rows = Array.isArray(proMemoryStore.corePrivateDocAccessEvents)
    ? proMemoryStore.corePrivateDocAccessEvents
    : [];
  rows.unshift({
    id: `doc-access-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    ...event
  });
  if (rows.length > PRIVATE_DOC_ACCESS_EVENT_MAX_ITEMS) {
    rows.length = PRIVATE_DOC_ACCESS_EVENT_MAX_ITEMS;
  }
  proMemoryStore.corePrivateDocAccessEvents = rows;
}

function pruneConsumedPrivateDocTokens(nowSec = Math.floor(Date.now() / 1000)) {
  const safeNowSec = Math.max(0, Math.round(numberValue(nowSec, 0)));
  for (const [key, row] of privateDocConsumedTokenMap.entries()) {
    const expiresAtSec = Math.max(0, Math.round(numberValue(row?.expiresAtSec, 0)));
    if (!expiresAtSec || expiresAtSec <= safeNowSec) {
      privateDocConsumedTokenMap.delete(key);
    }
  }
  while (privateDocConsumedTokenMap.size > PRIVATE_DOC_TOKEN_REPLAY_CACHE_MAX) {
    const oldestKey = privateDocConsumedTokenMap.keys().next().value;
    if (!oldestKey) break;
    privateDocConsumedTokenMap.delete(oldestKey);
  }
}

function consumePrivateDocAccessToken({
  tokenId = "",
  tokenFingerprint = "",
  expiresAtSec = 0,
  nowSec = Math.floor(Date.now() / 1000)
} = {}) {
  const safeTokenId = text(tokenId);
  const safeTokenFingerprint = text(tokenFingerprint);
  const safeExpiresAtSec = Math.max(0, Math.round(numberValue(expiresAtSec, 0)));
  const safeNowSec = Math.max(0, Math.round(numberValue(nowSec, 0)));
  if (!safeTokenId || !safeTokenFingerprint || !safeExpiresAtSec) {
    return {
      ok: false,
      reason: "token-replay-params-invalid",
      replay: true
    };
  }

  pruneConsumedPrivateDocTokens(safeNowSec);
  const key = `${safeTokenId}:${safeTokenFingerprint}`;
  const existing = privateDocConsumedTokenMap.get(key);
  const existingExpiresAtSec = Math.max(0, Math.round(numberValue(existing?.expiresAtSec, 0)));
  if (existing && existingExpiresAtSec > safeNowSec) {
    return {
      ok: false,
      reason: "token-replay-detected",
      replay: true
    };
  }

  privateDocConsumedTokenMap.set(key, {
    tokenId: safeTokenId,
    tokenFingerprint: safeTokenFingerprint,
    consumedAtSec: safeNowSec,
    expiresAtSec: safeExpiresAtSec
  });
  pruneConsumedPrivateDocTokens(safeNowSec);
  return {
    ok: true,
    reason: "token-consumed",
    replay: false
  };
}

async function findPropertyOwnerId(propertyId) {
  const normalizedPropertyId = normalizePropertyId(propertyId);
  if (!normalizedPropertyId) return "";

  if (proRuntime.dbConnected) {
    if (!mongoose.Types.ObjectId.isValid(normalizedPropertyId)) return "";
    const row = await CoreProperty.findById(normalizedPropertyId)
      .select({ ownerId: 1 })
      .lean();
    return toId(row?.ownerId);
  }

  const row =
    proMemoryStore.coreProperties.find(
      (item) => toId(item._id || item.id) === normalizedPropertyId
    ) || null;
  return toId(row?.ownerId);
}

async function canActorAccessPrivateUpload({
  actorId = "",
  actorRole = "",
  uploadRow = null
} = {}) {
  const safeActorId = text(actorId);
  const safeActorRole = text(actorRole, "buyer").toLowerCase();
  if (!uploadRow || !safeActorId) return false;
  if (safeActorRole === "admin") return true;

  const uploadOwnerId = toId(uploadRow?.userId);
  if (sameId(safeActorId, uploadOwnerId)) return true;

  const propertyId = toId(uploadRow?.propertyId);
  if (!propertyId) return false;
  const propertyOwnerId = await findPropertyOwnerId(propertyId);
  return sameId(safeActorId, propertyOwnerId);
}

function normalizeUpload(doc, viewer = null) {
  const row = doc && typeof doc.toObject === "function" ? doc.toObject() : doc;
  if (!row) return null;
  const uploadId = toId(row._id || row.id);
  const userId = toId(row.userId);
  const propertyId = toId(row.propertyId);
  const isPrivate = Boolean(row.isPrivate);
  const sourceUrl = text(row.url);
  const privateDocHash = text(
    row.privateDocHash,
    isPrivate ? hashPrivateDocSourceUrl(sourceUrl) : ""
  );
  const privateDocProtected = Boolean(row.privateDocProtected || isPrivate);
  const accessEnvelope =
    isPrivate && sourceUrl
      ? buildPrivateDocAccessEnvelope({
          sourceUrl,
          ownerId: userId,
          propertyId,
          uploadId,
          docId: uploadId,
          category: text(row.category),
          name: text(row.name, "upload.bin"),
          viewerId: text(viewer?.id),
          viewerRole: text(viewer?.role, "buyer").toLowerCase(),
          requestIp: text(viewer?.clientIp),
          requestUserAgent: text(viewer?.userAgent)
        })
      : null;
  const maskedUrl = isPrivate
    ? (accessEnvelope?.maskedUrl || buildMaskedPrivateDocUrl(sourceUrl))
    : sourceUrl;

  return {
    _id: uploadId,
    id: uploadId,
    userId,
    propertyId,
    category: text(row.category, "misc"),
    name: text(row.name, "upload.bin"),
    type: text(row.type, "application/octet-stream"),
    sizeBytes: numberValue(row.sizeBytes, 0),
    url: maskedUrl,
    isPrivate,
    privateDocProtected,
    privateDocHash,
    privateDocAccessCount: Math.max(0, numberValue(row.privateDocAccessCount, 0)),
    privateDocLastAccessAt: asIso(row.privateDocLastAccessAt),
    secureAccess:
      isPrivate && accessEnvelope
        ? {
            token: text(accessEnvelope.token),
            expiresAt: text(accessEnvelope.expiresAt),
            expiresInSec: Math.max(0, numberValue(accessEnvelope.expiresInSec, 0)),
            accessPath: text(accessEnvelope.accessPath),
            maskedUrl: text(accessEnvelope.maskedUrl),
            hash: text(accessEnvelope.hash)
          }
        : null,
    storageProvider: text(row.storageProvider, "memory"),
    createdAt: asIso(row.createdAt),
    updatedAt: asIso(row.updatedAt)
  };
}

function buildUploadRows(req, files = []) {
  const userId = text(req.coreUser?.id);
  const propertyId = normalizePropertyId(req.body?.propertyId);

  return files.map((file, index) => {
    const fileName = text(file?.name, `upload-${index + 1}.bin`);
    const encodedName = encodeURIComponent(fileName);
    const base64 = text(file?.dataBase64);
    const category = normalizeCategory(file?.category);
    const inferredPrivate = categoryImpliesPrivate(category);
    const isPrivate =
      typeof file?.isPrivate === "boolean" ? file.isPrivate : inferredPrivate;
    const resolvedUrl = text(
      file?.url,
      isPrivate
        ? `https://secure-cdn.propertysetu.local/private/${Date.now()}-${encodedName}`
        : `https://cdn.propertysetu.local/uploads/${Date.now()}-${encodedName}`
    );

    return {
      userId,
      propertyId,
      category,
      name: fileName,
      type: text(file?.type, "application/octet-stream"),
      sizeBytes: Math.max(numberValue(file?.sizeBytes, base64.length), 0),
      url: resolvedUrl,
      isPrivate: Boolean(isPrivate),
      privateDocProtected: Boolean(isPrivate),
      privateDocHash: isPrivate ? hashPrivateDocSourceUrl(resolvedUrl) : "",
      privateDocAccessCount: 0,
      privateDocLastAccessAt: null,
      storageProvider: text(proRuntime.storageProvider || "memory", "memory")
    };
  });
}

export async function uploadCorePropertyMedia(req, res, next) {
  try {
    const files = Array.isArray(req.body?.files) ? req.body.files : [];
    const propertyId = normalizePropertyId(req.body?.propertyId);
    const actorRole = text(req.coreUser?.role, "buyer").toLowerCase();
    const actorUserId = text(req.coreUser?.id);
    const actorIsAdmin = actorRole === "admin";
    const accessViewer = {
      ...req.coreUser,
      clientIp: getClientIp(req),
      userAgent: text(req.headers?.["user-agent"])
    };

    if (!files.length) {
      return res.status(400).json({
        success: false,
        message: "files[] is required."
      });
    }
    if (files.length > MAX_FILES_PER_REQUEST) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${MAX_FILES_PER_REQUEST} files allowed per request.`
      });
    }

    if (propertyId) {
      const ownerId = await findPropertyOwnerId(propertyId);
      if (!ownerId) {
        return res.status(404).json({
          success: false,
          message: "Property not found for upload target."
        });
      }
      if (!actorIsAdmin && ownerId !== actorUserId) {
        return res.status(403).json({
          success: false,
          message: "You can upload media only for your own property."
        });
      }
    }

    const rows = buildUploadRows(req, files);
    const nonPrivateDoc = rows.find(
      (item) => categoryImpliesPrivate(item.category) && !item.isPrivate
    );
    if (nonPrivateDoc) {
      return res.status(400).json({
        success: false,
        message: "Document uploads must be marked as private."
      });
    }

    const blockedByExtension = rows.find((item) =>
      BLOCKED_FILE_EXTENSIONS.has(extractExtension(item.name))
    );
    if (blockedByExtension) {
      return res.status(400).json({
        success: false,
        message: "Executable/script file extensions are not allowed for upload."
      });
    }

    const invalidSizeRow = rows.find(
      (item) => numberValue(item.sizeBytes, 0) <= 0 || numberValue(item.sizeBytes, 0) > MAX_FILE_BYTES
    );
    if (invalidSizeRow) {
      return res.status(400).json({
        success: false,
        message: `Each file size must be between 1 byte and ${Math.floor(MAX_FILE_BYTES / (1024 * 1024))}MB.`
      });
    }

    const totalBytes = rows.reduce((sum, item) => sum + numberValue(item.sizeBytes, 0), 0);
    if (totalBytes > MAX_TOTAL_BYTES) {
      return res.status(400).json({
        success: false,
        message: `Total upload size exceeds ${Math.floor(MAX_TOTAL_BYTES / (1024 * 1024))}MB limit.`
      });
    }

    const invalidMimeRow = rows.find((item) => !isAllowedMimeForUpload(item));
    if (invalidMimeRow) {
      return res.status(400).json({
        success: false,
        message: "Unsupported file type for this upload category."
      });
    }

    let created = [];
    if (proRuntime.dbConnected) {
      created = await CoreUpload.insertMany(rows);
    } else {
      created = rows.map((item) => ({
        _id: `upl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ...item,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
      proMemoryStore.coreUploads.unshift(...created);
      proMemoryStore.coreUploads = proMemoryStore.coreUploads.slice(0, 3000);
    }

    return res.status(201).json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      total: created.length,
      items: created.map((item) => normalizeUpload(item, accessViewer))
    });
  } catch (error) {
    return next(error);
  }
}

export async function listMyCoreUploads(req, res, next) {
  try {
    const userId = text(req.coreUser?.id);
    const limit = Math.min(300, Math.max(1, Number(req.query.limit || 80)));
    const accessViewer = {
      ...req.coreUser,
      clientIp: getClientIp(req),
      userAgent: text(req.headers?.["user-agent"])
    };
    let items = [];

    if (proRuntime.dbConnected) {
      const rows = await CoreUpload.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean();
      items = rows.map((row) => normalizeUpload(row, accessViewer));
    } else {
      items = proMemoryStore.coreUploads
        .filter((item) => text(item.userId) === userId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit)
        .map((row) => normalizeUpload(row, accessViewer));
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

async function findUploadById(uploadId = "") {
  const id = text(uploadId);
  if (!id) return null;

  if (proRuntime.dbConnected) {
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    return CoreUpload.findById(id);
  }

  return (
    proMemoryStore.coreUploads.find((item) => toId(item._id || item.id) === id) || null
  );
}

async function markPrivateDocAccess(uploadId = "", nowIso = "") {
  const id = text(uploadId);
  if (!id) return;

  if (proRuntime.dbConnected) {
    if (!mongoose.Types.ObjectId.isValid(id)) return;
    await CoreUpload.findByIdAndUpdate(id, {
      $inc: { privateDocAccessCount: 1 },
      $set: { privateDocLastAccessAt: new Date(nowIso || new Date().toISOString()) }
    });
    return;
  }

  const index = proMemoryStore.coreUploads.findIndex(
    (item) => toId(item._id || item.id) === id
  );
  if (index < 0) return;

  const previous = proMemoryStore.coreUploads[index] || {};
  proMemoryStore.coreUploads[index] = {
    ...previous,
    privateDocAccessCount: Math.max(0, numberValue(previous.privateDocAccessCount, 0)) + 1,
    privateDocLastAccessAt: nowIso || new Date().toISOString()
  };
}

export async function resolveCorePrivateDocAccess(req, res, next) {
  try {
    const token = text(req.body?.token || req.query?.token);
    const requestIp = getClientIp(req);
    const requestUserAgent = text(req.headers?.["user-agent"]);
    const currentRole = text(req.coreUser?.role, "buyer").toLowerCase();
    const contextBindingEnforced = PRIVATE_DOC_CONTEXT_BINDING_REQUIRED &&
      !(PRIVATE_DOC_CONTEXT_BINDING_ADMIN_BYPASS && currentRole === "admin");
    if (!token) {
      return res.status(400).json({
        success: false,
        message: "token is required."
      });
    }

    const verification = verifyPrivateDocAccessToken(token, {
      viewerId: text(req.coreUser?.id),
      viewerRole: currentRole,
      requestIp,
      requestUserAgent,
      enforceContextBinding: contextBindingEnforced
    });
    if (!verification.ok) {
      recordPrivateDocAccessEvent({
        userId: text(req.coreUser?.id),
        role: currentRole,
        tokenFingerprint: fingerprintPrivateDocAccessToken(token),
        replayGuardEnabled: Boolean(PRIVATE_DOC_TOKEN_REPLAY_GUARD_ENABLED),
        replayBlocked: false,
        contextBindingEnforced: Boolean(contextBindingEnforced),
        contextBindingFailure: text(verification.reason) === "token-context-mismatch",
        authorizationDenied: false,
        reason: text(verification.reason),
        ip: requestIp,
        userAgent: requestUserAgent.slice(0, 240),
        source: "token-verify"
      });
      return res.status(403).json({
        success: false,
        message: "Private document access token is invalid or expired.",
        reason: text(verification.reason)
      });
    }

    const payload = verification.payload || {};
    const uploadId = text(payload.uploadId);
    const nowIso = new Date().toISOString();
    const nowSec = Math.floor(Date.now() / 1000);
    const tokenId = text(payload.tokenId || payload.jti);
    const tokenFingerprint = fingerprintPrivateDocAccessToken(token);
    const tokenExpiresAtSec = Math.max(0, Math.round(numberValue(payload.exp, 0)));
    const actorId = text(req.coreUser?.id);
    const actorRole = currentRole;
    const actorIsAdmin = actorRole === "admin";
    let sourceUrl = text(payload.sourceUrl);
    let ownerId = text(payload.ownerId);
    let propertyId = text(payload.propertyId);
    let docName = text(payload.name);
    let docCategory = text(payload.category);

    if (uploadId) {
      const uploadRow = await findUploadById(uploadId);
      if (!uploadRow) {
        return res.status(404).json({
          success: false,
          message: "Upload record not found."
        });
      }

      const normalizedUpload = normalizeUpload(uploadRow, {
        ...req.coreUser,
        clientIp: requestIp,
        userAgent: requestUserAgent
      }) || {};
      if (!Boolean(uploadRow?.isPrivate)) {
        return res.status(400).json({
          success: false,
          message: "Requested upload is not marked as private."
        });
      }

      ownerId = text(toId(uploadRow?.userId), ownerId);
      propertyId = text(toId(uploadRow?.propertyId), propertyId);
      docName = text(uploadRow?.name, docName);
      docCategory = text(uploadRow?.category, docCategory);
      sourceUrl = text(uploadRow?.url, sourceUrl);
      const resolvedUploadId = toId(uploadRow?._id || uploadRow?.id);
      if (!sameId(uploadId, resolvedUploadId)) {
        return res.status(409).json({
          success: false,
          message: "Private document token upload binding mismatch."
        });
      }
      if (text(payload.ownerId) && !sameId(payload.ownerId, ownerId)) {
        return res.status(409).json({
          success: false,
          message: "Private document token owner binding mismatch."
        });
      }
      if (text(payload.propertyId) && !sameId(payload.propertyId, propertyId)) {
        return res.status(409).json({
          success: false,
          message: "Private document token property binding mismatch."
        });
      }
      if (text(payload.category) && text(payload.category).toLowerCase() !== text(docCategory).toLowerCase()) {
        return res.status(409).json({
          success: false,
          message: "Private document token category binding mismatch."
        });
      }
      const authorized = await canActorAccessPrivateUpload({
        actorId,
        actorRole,
        uploadRow
      });
      if (!authorized) {
        recordPrivateDocAccessEvent({
          userId: actorId,
          role: actorRole,
          ownerId,
          propertyId,
          uploadId: resolvedUploadId,
          docId: text(payload.docId),
          category: docCategory,
          hash: text(payload.hash),
          tokenId,
          tokenFingerprint,
          replayGuardEnabled: Boolean(PRIVATE_DOC_TOKEN_REPLAY_GUARD_ENABLED),
          replayBlocked: false,
          authorizationDenied: true,
          ip: getClientIp(req),
          userAgent: text(req.headers?.["user-agent"]).slice(0, 240),
          expiresAt: text(payload.expiresAt),
          source: "upload"
        });
        return res.status(403).json({
          success: false,
          message: "You are not authorized to access this private document."
        });
      }
      const uploadHash = text(
        uploadRow?.privateDocHash,
        hashPrivateDocSourceUrl(sourceUrl)
      );
      if (uploadHash && uploadHash !== text(payload.hash)) {
        return res.status(409).json({
          success: false,
          message: "Document integrity validation failed."
        });
      }
      if (PRIVATE_DOC_TOKEN_REPLAY_GUARD_ENABLED) {
        const tokenConsume = consumePrivateDocAccessToken({
          tokenId,
          tokenFingerprint,
          expiresAtSec: tokenExpiresAtSec,
          nowSec
        });
        if (!tokenConsume.ok) {
          recordPrivateDocAccessEvent({
            userId: text(req.coreUser?.id),
            role: text(req.coreUser?.role, "buyer").toLowerCase(),
            ownerId,
            propertyId,
            uploadId,
            docId: text(payload.docId),
            category: docCategory,
            hash: text(payload.hash),
            tokenId,
            tokenFingerprint,
            replayGuardEnabled: true,
            replayBlocked: true,
            reason: text(tokenConsume.reason),
            ip: getClientIp(req),
            userAgent: text(req.headers?.["user-agent"]).slice(0, 240),
            expiresAt: text(payload.expiresAt),
            source: "upload"
          });
          return res.status(409).json({
            success: false,
            message: "Private document token already used. Please request a fresh token.",
            reason: text(tokenConsume.reason)
          });
        }
      }

      await markPrivateDocAccess(uploadId, nowIso);
      recordPrivateDocAccessEvent({
        userId: text(req.coreUser?.id),
        role: text(req.coreUser?.role, "buyer").toLowerCase(),
        ownerId,
        propertyId,
        uploadId,
        docId: text(payload.docId),
        category: docCategory,
        hash: text(payload.hash),
        tokenId,
        tokenFingerprint,
        replayGuardEnabled: Boolean(PRIVATE_DOC_TOKEN_REPLAY_GUARD_ENABLED),
        replayBlocked: false,
        ip: getClientIp(req),
        userAgent: text(req.headers?.["user-agent"]).slice(0, 240),
        expiresAt: text(payload.expiresAt),
        source: "upload"
      });

      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      return res.json({
        success: true,
        source: proRuntime.dbConnected ? "mongodb" : "memory",
        doc: {
          uploadId: normalizedUpload.id || uploadId,
          docId: text(payload.docId),
          ownerId,
          propertyId,
          name: docName,
          category: docCategory,
          privateDocHash: text(payload.hash),
          accessExpiresAt: text(payload.expiresAt),
          url: sourceUrl
        }
      });
    }

    if (!sourceUrl) {
      return res.status(404).json({
        success: false,
        message: "Private document source is unavailable."
      });
    }
    if (!actorIsAdmin && (!actorId || !sameId(actorId, ownerId))) {
      recordPrivateDocAccessEvent({
        userId: actorId,
        role: actorRole,
        ownerId,
        propertyId,
        uploadId: "",
        docId: text(payload.docId),
        category: docCategory,
        hash: text(payload.hash),
        tokenId,
        tokenFingerprint,
        replayGuardEnabled: Boolean(PRIVATE_DOC_TOKEN_REPLAY_GUARD_ENABLED),
        replayBlocked: false,
        authorizationDenied: true,
        ip: getClientIp(req),
        userAgent: text(req.headers?.["user-agent"]).slice(0, 240),
        expiresAt: text(payload.expiresAt),
        source: "inline-private-doc"
      });
      return res.status(403).json({
        success: false,
        message: "You are not authorized to access this private document."
      });
    }
    if (PRIVATE_DOC_TOKEN_REPLAY_GUARD_ENABLED) {
      const tokenConsume = consumePrivateDocAccessToken({
        tokenId,
        tokenFingerprint,
        expiresAtSec: tokenExpiresAtSec,
        nowSec
      });
      if (!tokenConsume.ok) {
        recordPrivateDocAccessEvent({
          userId: text(req.coreUser?.id),
          role: text(req.coreUser?.role, "buyer").toLowerCase(),
          ownerId,
          propertyId,
          uploadId: "",
          docId: text(payload.docId),
          category: docCategory,
          hash: text(payload.hash),
          tokenId,
          tokenFingerprint,
          replayGuardEnabled: true,
          replayBlocked: true,
          reason: text(tokenConsume.reason),
          ip: getClientIp(req),
          userAgent: text(req.headers?.["user-agent"]).slice(0, 240),
          expiresAt: text(payload.expiresAt),
          source: "inline-private-doc"
        });
        return res.status(409).json({
          success: false,
          message: "Private document token already used. Please request a fresh token.",
          reason: text(tokenConsume.reason)
        });
      }
    }

    recordPrivateDocAccessEvent({
      userId: text(req.coreUser?.id),
      role: text(req.coreUser?.role, "buyer").toLowerCase(),
      ownerId,
      propertyId,
      uploadId: "",
      docId: text(payload.docId),
      category: docCategory,
      hash: text(payload.hash),
      tokenId,
      tokenFingerprint,
      replayGuardEnabled: Boolean(PRIVATE_DOC_TOKEN_REPLAY_GUARD_ENABLED),
      replayBlocked: false,
      ip: getClientIp(req),
      userAgent: text(req.headers?.["user-agent"]).slice(0, 240),
      expiresAt: text(payload.expiresAt),
      source: "inline-private-doc"
    });

    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    return res.json({
      success: true,
      source: "token-inline",
      doc: {
        uploadId: "",
        docId: text(payload.docId),
        ownerId,
        propertyId,
        name: docName,
        category: docCategory,
        privateDocHash: text(payload.hash),
        accessExpiresAt: text(payload.expiresAt),
        url: sourceUrl
      }
    });
  } catch (error) {
    return next(error);
  }
}
