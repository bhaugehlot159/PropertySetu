import mongoose from "mongoose";
import { proRuntime } from "../../config/proRuntime.js";
import { proMemoryStore } from "../../runtime/proMemoryStore.js";
import CoreProperty from "../models/CoreProperty.js";
import CoreUpload from "../models/CoreUpload.js";

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

function normalizeUpload(doc) {
  const row = doc && typeof doc.toObject === "function" ? doc.toObject() : doc;
  if (!row) return null;
  return {
    _id: toId(row._id || row.id),
    id: toId(row._id || row.id),
    userId: toId(row.userId),
    propertyId: toId(row.propertyId),
    category: text(row.category, "misc"),
    name: text(row.name, "upload.bin"),
    type: text(row.type, "application/octet-stream"),
    sizeBytes: numberValue(row.sizeBytes, 0),
    url: text(row.url),
    isPrivate: Boolean(row.isPrivate),
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

    return {
      userId,
      propertyId,
      category,
      name: fileName,
      type: text(file?.type, "application/octet-stream"),
      sizeBytes: Math.max(numberValue(file?.sizeBytes, base64.length), 0),
      url: text(
        file?.url,
        isPrivate
          ? `https://secure-cdn.propertysetu.local/private/${Date.now()}-${encodedName}`
          : `https://cdn.propertysetu.local/uploads/${Date.now()}-${encodedName}`
      ),
      isPrivate: Boolean(isPrivate),
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
      items: created.map((item) => normalizeUpload(item))
    });
  } catch (error) {
    return next(error);
  }
}

export async function listMyCoreUploads(req, res, next) {
  try {
    const userId = text(req.coreUser?.id);
    const limit = Math.min(300, Math.max(1, Number(req.query.limit || 80)));
    let items = [];

    if (proRuntime.dbConnected) {
      const rows = await CoreUpload.find({ userId }).sort({ createdAt: -1 }).limit(limit).lean();
      items = rows.map((row) => normalizeUpload(row));
    } else {
      items = proMemoryStore.coreUploads
        .filter((item) => text(item.userId) === userId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit)
        .map((row) => normalizeUpload(row));
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
