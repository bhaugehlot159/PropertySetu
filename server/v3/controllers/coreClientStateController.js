import mongoose from "mongoose";
import { proRuntime } from "../../config/proRuntime.js";
import { proMemoryStore } from "../../runtime/proMemoryStore.js";
import CoreRuntimeConfig from "../models/CoreRuntimeConfig.js";
import { toId } from "../utils/coreMappers.js";

const CORE_CLIENT_STATE_KEY_PATTERN = /^propertysetu:[a-z0-9:_-]{2,120}$/i;
const CORE_CLIENT_STATE_MAX_BYTES = Math.max(
  16 * 1024,
  Number(process.env.CORE_CLIENT_STATE_MAX_BYTES || 512 * 1024)
);
const CORE_CLIENT_STATE_MAX_BATCH = Math.max(
  1,
  Math.min(100, Number(process.env.CORE_CLIENT_STATE_MAX_BATCH || 40))
);
const CORE_CLIENT_STATE_GLOBAL_WRITE_PREFIXES_NON_ADMIN = [
  "propertysetu:auction"
];

function text(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function normalizeScope(value) {
  const raw = text(value, "user").toLowerCase();
  if (raw === "global") return "global";
  return "user";
}

function normalizeRole(value) {
  const raw = text(value, "buyer").toLowerCase();
  if (raw === "admin") return "admin";
  if (raw === "seller") return "seller";
  return "buyer";
}

function ensureMemoryStore() {
  if (!Array.isArray(proMemoryStore.coreClientStateRecords)) {
    proMemoryStore.coreClientStateRecords = [];
  }
  return proMemoryStore.coreClientStateRecords;
}

function toObjectIdOrNull(value) {
  const normalized = toId(value);
  if (!normalized || !mongoose.Types.ObjectId.isValid(normalized)) return null;
  return normalized;
}

function validateStateKey(rawKey = "") {
  const key = text(rawKey);
  if (!key || !CORE_CLIENT_STATE_KEY_PATTERN.test(key)) {
    return {
      ok: false,
      message:
        "Invalid key. Use propertySetu:* format with letters, numbers, :, _, -."
    };
  }
  if (key.toLowerCase().includes("__proto__")) {
    return { ok: false, message: "Invalid key." };
  }
  return { ok: true, key };
}

function sanitizeValue(value) {
  const serialized = JSON.stringify(value);
  if (typeof serialized === "undefined") {
    throw new Error("Value must be valid JSON.");
  }
  if (Buffer.byteLength(serialized, "utf8") > CORE_CLIENT_STATE_MAX_BYTES) {
    throw new Error(
      `Value exceeds ${Math.round(CORE_CLIENT_STATE_MAX_BYTES / 1024)} KB limit.`
    );
  }
  return JSON.parse(serialized);
}

function buildStorageKey({ key, scope, userId }) {
  const normalizedScope = normalizeScope(scope);
  const normalizedKey = text(key);
  const ownerSegment =
    normalizedScope === "global" ? "global" : toId(userId) || "anonymous";
  return `client-state:${normalizedScope}:${ownerSegment}:${normalizedKey}`;
}

function canWriteGlobalState(role, key) {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === "admin") return true;
  const keyRaw = text(key).toLowerCase();
  return CORE_CLIENT_STATE_GLOBAL_WRITE_PREFIXES_NON_ADMIN.some((prefix) =>
    keyRaw.startsWith(prefix)
  );
}

function normalizeRecordValue(record, fallback = {}) {
  const value =
    record && typeof record === "object" && !Array.isArray(record)
      ? record
      : {};
  const payload =
    value.value && typeof value.value === "object" && !Array.isArray(value.value)
      ? value.value
      : value;
  return {
    key: text(payload.key, text(value.key, text(fallback.key))),
    scope: normalizeScope(payload.scope || fallback.scope),
    ownerId: toId(payload.ownerId || fallback.ownerId),
    value: payload.data,
    updatedAt: text(payload.updatedAt || value.updatedAt || value.updatedAtUtc)
  };
}

function readMemoryRecord(storageKey) {
  const rows = ensureMemoryStore();
  const row = rows.find((item) => text(item.storageKey) === text(storageKey));
  if (!row) return null;
  return { ...row };
}

function upsertMemoryRecord(next = {}) {
  const rows = ensureMemoryStore();
  const storageKey = text(next.storageKey);
  if (!storageKey) return null;
  const index = rows.findIndex((item) => text(item.storageKey) === storageKey);
  if (index >= 0) {
    rows[index] = { ...rows[index], ...next };
    return { ...rows[index] };
  }
  rows.unshift({ ...next });
  if (rows.length > 3000) rows.length = 3000;
  return { ...rows[0] };
}

async function readClientStateRecord({
  key,
  scope = "user",
  userId = ""
} = {}) {
  const normalizedScope = normalizeScope(scope);
  const storageKey = buildStorageKey({ key, scope: normalizedScope, userId });
  const fallback = {
    key,
    scope: normalizedScope,
    ownerId: normalizedScope === "global" ? "" : toId(userId)
  };

  if (proRuntime.dbConnected) {
    const row = await CoreRuntimeConfig.findOne({ key: storageKey }).lean();
    if (row) {
      const normalized = normalizeRecordValue(row, fallback);
      upsertMemoryRecord({
        storageKey,
        ...normalized,
        updatedBy: toId(row.updatedBy),
        source: "mongodb"
      });
      return {
        ...normalized,
        storageKey,
        source: "mongodb"
      };
    }
  }

  const memory = readMemoryRecord(storageKey);
  if (!memory) return null;
  const normalized = normalizeRecordValue(memory, fallback);
  return {
    ...normalized,
    storageKey,
    source: "memory"
  };
}

async function writeClientStateRecord({
  key,
  scope = "user",
  userId = "",
  role = "buyer",
  value
} = {}) {
  const normalizedScope = normalizeScope(scope);
  if (normalizedScope === "global" && !canWriteGlobalState(role, key)) {
    const error = new Error("You do not have permission to update global state.");
    error.statusCode = 403;
    throw error;
  }

  const ownerId = normalizedScope === "global" ? "" : toId(userId);
  const updatedAt = new Date().toISOString();
  const sanitizedValue = sanitizeValue(value);
  const payload = {
    key: text(key),
    scope: normalizedScope,
    ownerId,
    data: sanitizedValue,
    updatedAt
  };
  const storageKey = buildStorageKey({ key, scope: normalizedScope, userId: ownerId });

  const memoryRow = upsertMemoryRecord({
    storageKey,
    key: payload.key,
    scope: payload.scope,
    ownerId: payload.ownerId,
    value: payload.data,
    updatedAt,
    updatedBy: toId(userId),
    source: proRuntime.dbConnected ? "mongodb" : "memory"
  });

  if (proRuntime.dbConnected) {
    await CoreRuntimeConfig.findOneAndUpdate(
      { key: storageKey },
      {
        $set: {
          value: payload,
          updatedBy: toObjectIdOrNull(userId),
          notes: `core-client-state:${normalizedScope}`
        }
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true
      }
    );
  }

  return normalizeRecordValue(memoryRow, payload);
}

function normalizeBatchRequests(rawItems = []) {
  const items = Array.isArray(rawItems) ? rawItems : [];
  return items.slice(0, CORE_CLIENT_STATE_MAX_BATCH).map((item) => ({
    key: text(item?.key),
    scope: normalizeScope(item?.scope)
  }));
}

function normalizeBatchWriteItems(rawItems = []) {
  const items = Array.isArray(rawItems) ? rawItems : [];
  return items.slice(0, CORE_CLIENT_STATE_MAX_BATCH).map((item) => ({
    key: text(item?.key),
    scope: normalizeScope(item?.scope),
    value: item?.value
  }));
}

export async function getCoreClientState(req, res, next) {
  try {
    const keyValidation = validateStateKey(req.query.key || req.body?.key);
    if (!keyValidation.ok) {
      return res.status(400).json({ success: false, message: keyValidation.message });
    }
    const key = keyValidation.key;
    const scope = normalizeScope(req.query.scope || req.body?.scope);
    const userId = toId(req.coreUser?.id);

    if (scope === "user" && !userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required for user scope."
      });
    }

    const row = await readClientStateRecord({ key, scope, userId });
    if (!row) {
      return res.json({
        success: true,
        exists: false,
        key,
        scope,
        value: null
      });
    }

    return res.json({
      success: true,
      exists: true,
      key: row.key,
      scope: row.scope,
      value: row.value,
      updatedAt: row.updatedAt,
      source: row.source
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateCoreClientState(req, res, next) {
  try {
    const keyValidation = validateStateKey(req.body?.key);
    if (!keyValidation.ok) {
      return res.status(400).json({ success: false, message: keyValidation.message });
    }
    const key = keyValidation.key;
    const scope = normalizeScope(req.body?.scope);
    const userId = toId(req.coreUser?.id);
    const role = normalizeRole(req.coreUser?.role);

    if (scope === "user" && !userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required for user scope."
      });
    }

    const item = await writeClientStateRecord({
      key,
      scope,
      userId,
      role,
      value: req.body?.value
    });

    return res.json({
      success: true,
      item
    });
  } catch (error) {
    if (String(error?.statusCode || "") === "403") {
      return res.status(403).json({
        success: false,
        message: error.message || "You do not have permission for this action."
      });
    }
    if (String(error?.message || "").includes("Value exceeds")) {
      return res.status(413).json({
        success: false,
        message: error.message
      });
    }
    if (String(error?.message || "").includes("valid JSON")) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    return next(error);
  }
}

export async function batchReadCoreClientState(req, res, next) {
  try {
    const userId = toId(req.coreUser?.id);
    const requests = normalizeBatchRequests(req.body?.requests);
    if (!requests.length) {
      return res.status(400).json({
        success: false,
        message: "requests[] is required."
      });
    }

    for (const item of requests) {
      const keyValidation = validateStateKey(item.key);
      if (!keyValidation.ok) {
        return res.status(400).json({
          success: false,
          message: keyValidation.message
        });
      }
      if (item.scope === "user" && !userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required for user scope."
        });
      }
    }

    const rows = await Promise.all(
      requests.map(async (item) => {
        const row = await readClientStateRecord({
          key: item.key,
          scope: item.scope,
          userId
        });
        if (!row) {
          return {
            key: item.key,
            scope: item.scope,
            exists: false,
            value: null
          };
        }
        return {
          key: row.key,
          scope: row.scope,
          exists: true,
          value: row.value,
          updatedAt: row.updatedAt,
          source: row.source
        };
      })
    );

    return res.json({
      success: true,
      total: rows.length,
      items: rows
    });
  } catch (error) {
    return next(error);
  }
}

export async function batchWriteCoreClientState(req, res, next) {
  try {
    const userId = toId(req.coreUser?.id);
    const role = normalizeRole(req.coreUser?.role);
    const items = normalizeBatchWriteItems(req.body?.items);
    if (!items.length) {
      return res.status(400).json({
        success: false,
        message: "items[] is required."
      });
    }

    for (const item of items) {
      const keyValidation = validateStateKey(item.key);
      if (!keyValidation.ok) {
        return res.status(400).json({
          success: false,
          message: keyValidation.message
        });
      }
      if (item.scope === "user" && !userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required for user scope."
        });
      }
      if (item.scope === "global" && !canWriteGlobalState(role, item.key)) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to update global state."
        });
      }
    }

    const saved = [];
    for (const item of items) {
      const row = await writeClientStateRecord({
        key: item.key,
        scope: item.scope,
        userId,
        role,
        value: item.value
      });
      saved.push(row);
    }

    return res.json({
      success: true,
      total: saved.length,
      items: saved
    });
  } catch (error) {
    if (String(error?.message || "").includes("Value exceeds")) {
      return res.status(413).json({
        success: false,
        message: error.message
      });
    }
    if (String(error?.message || "").includes("valid JSON")) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    return next(error);
  }
}
