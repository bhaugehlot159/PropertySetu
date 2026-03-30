import fs from "fs";
import path from "path";
import crypto from "crypto";
import mongoose from "mongoose";
import { fileURLToPath } from "url";
import { proRuntime } from "../../config/proRuntime.js";
import { getStorageProvider } from "../../config/proStorage.js";
import { getRazorpayPublicKey } from "../../config/proRazorpay.js";
import {
  applyProSecurityControlProfile,
  getProSecurityAuditEvents,
  getProSecurityChainIntegrityStatus,
  getProSecurityControlPersistenceStatus,
  getProSecurityControlState,
  getProSecurityThreatIntelligence,
  isValidProSecurityThreatFingerprint,
  listProSecurityControlProfiles,
  normalizeProSecurityThreatFingerprint,
  quarantineProSecurityThreatProfile,
  releaseProSecurityThreatProfile,
  resetProSecurityControlState,
  restoreProSecurityControlStateFromDisk,
  updateProSecurityControlState
} from "../../middleware/proSecurityMiddleware.js";
import {
  getCoreRateLimiterSecurityState,
  resetCoreRateLimiterSecurityState,
  updateCoreRateLimiterSecurityControls
} from "../middleware/coreSecurityMiddleware.js";
import {
  getCorePrivateDocCryptoControlFactoryDefaults,
  getCorePrivateDocCryptoControlState,
  updateCorePrivateDocCryptoControlState
} from "../utils/corePrivateDocSecurity.js";
import { proMemoryStore } from "../../runtime/proMemoryStore.js";
import CorePrivateDocCryptoControlAudit from "../models/CorePrivateDocCryptoControlAudit.js";
import CoreRuntimeConfig from "../models/CoreRuntimeConfig.js";
import CoreUser from "../models/CoreUser.js";
import CoreProperty from "../models/CoreProperty.js";
import CoreReview from "../models/CoreReview.js";
import CoreSubscription from "../models/CoreSubscription.js";
import {
  buildCoreDatabaseContract,
  coreSystemsBlueprint
} from "../contracts/coreDatabaseContract.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../..");
const PRIVATE_DOC_CRYPTO_CONTROL_CONFIG_KEY = "private-doc-crypto-control";
const PRIVATE_DOC_CRYPTO_CONTROL_HYDRATE_COOLDOWN_MS = Math.max(
  5_000,
  Number(process.env.CORE_PRIVATE_DOC_CRYPTO_CONTROL_HYDRATE_COOLDOWN_MS || 45_000)
);
const PRIVATE_DOC_CRYPTO_CONTROL_DUAL_ADMIN_REQUIRED =
  String(process.env.CORE_PRIVATE_DOC_CRYPTO_CONTROL_DUAL_ADMIN_REQUIRED || "true")
    .trim()
    .toLowerCase() !== "false";
const PRIVATE_DOC_CRYPTO_CONTROL_APPROVAL_WINDOW_MS = Math.max(
  15 * 60 * 1000,
  Math.min(
    7 * 24 * 60 * 60 * 1000,
    Number(process.env.CORE_PRIVATE_DOC_CRYPTO_CONTROL_APPROVAL_WINDOW_MINUTES || 240) *
      60 *
      1000
  )
);
const PRIVATE_DOC_CRYPTO_CONTROL_APPROVAL_REASON_MIN = Math.max(
  8,
  Number(process.env.CORE_PRIVATE_DOC_CRYPTO_CONTROL_APPROVAL_REASON_MIN || 14)
);
const PRIVATE_DOC_CRYPTO_CONTROL_APPROVAL_CONFIG_KEY =
  "private-doc-crypto-control-approval-request";
const PRIVATE_DOC_CRYPTO_CONTROL_APPROVAL_HYDRATE_COOLDOWN_MS = Math.max(
  5_000,
  Number(process.env.CORE_PRIVATE_DOC_CRYPTO_CONTROL_APPROVAL_HYDRATE_COOLDOWN_MS || 45_000)
);
const PRIVATE_DOC_CRYPTO_CONTROL_APPROVAL_SECRET = text(
  process.env.CORE_PRIVATE_DOC_CRYPTO_CONTROL_APPROVAL_SECRET ||
    process.env.CORE_PRIVATE_DOC_SECRET ||
    process.env.CORE_JWT_SECRET ||
    process.env.JWT_SECRET ||
    "propertysetu-core-private-doc-crypto-control-approval-secret"
);
const PRIVATE_DOC_CRYPTO_CONTROL_AUDIT_SECRET = text(
  process.env.CORE_PRIVATE_DOC_CRYPTO_AUDIT_SECRET ||
    process.env.CORE_PRIVATE_DOC_SECRET ||
    process.env.CORE_JWT_SECRET ||
    process.env.JWT_SECRET ||
    "propertysetu-core-private-doc-crypto-audit-secret"
);
const PRIVATE_DOC_CRYPTO_CONTROL_AUDIT_SALT = text(
  process.env.CORE_PRIVATE_DOC_CRYPTO_AUDIT_SALT ||
    "propertysetu-core-private-doc-crypto-audit-salt"
);
const PRIVATE_DOC_CRYPTO_CONTROL_AUDIT_KEY_VERSION = text(
  process.env.CORE_PRIVATE_DOC_CRYPTO_AUDIT_KEY_VERSION,
  "v1"
);
const PRIVATE_DOC_CRYPTO_CONTROL_AUDIT_MAX_ITEMS = Math.max(
  200,
  Number(process.env.CORE_PRIVATE_DOC_CRYPTO_AUDIT_MAX_ITEMS || 6_000)
);
const PRIVATE_DOC_CRYPTO_CONTROL_AUDIT_ACTIONS = new Set([
  "approval-requested",
  "approval-confirmed",
  "approval-reset",
  "updated"
]);
let privateDocCryptoControlHydratedAtTs = 0;
let privateDocCryptoControlApprovalHydratedAtTs = 0;
let privateDocCryptoControlApprovalRequest = {
  active: false,
  requestedBy: "",
  requestedAt: "",
  reason: "",
  riskSignals: [],
  requestDigest: "",
  currentControlHash: "",
  currentControl: null,
  proposedPatch: null,
  proposedControl: null
};

function text(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function isConfiguredCredential(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return false;
  return (
    !raw.includes("replace_with") &&
    !raw.includes("placeholder") &&
    !raw.startsWith("your_")
  );
}

function readJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function safeBool(value) {
  return Boolean(value);
}

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  const normalized = text(value).toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return fallback;
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toId(value = "") {
  return text(value);
}

function toObjectIdOrNull(value = "") {
  const raw = text(value);
  if (!raw) return null;
  return mongoose.Types.ObjectId.isValid(raw) ? raw : null;
}

function toPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function resolveChainOverrideApproval(body = {}) {
  const safeBody = toPlainObject(body) || {};
  return (
    toPlainObject(safeBody.chainOverrideApproval) ||
    toPlainObject(safeBody.dualControlApproval) ||
    toPlainObject(safeBody.chainApproval) ||
    null
  );
}

function sanitizePrivateDocCryptoControlPatch(value = {}) {
  const safe = toPlainObject(value) || {};
  const out = {};
  if (typeof safe.activeKeyId !== "undefined") {
    out.activeKeyId = text(safe.activeKeyId).toLowerCase();
  }
  if (typeof safe.allowLegacyTokenFormat !== "undefined") {
    out.allowLegacyTokenFormat = toBoolean(safe.allowLegacyTokenFormat, true);
  }
  if (typeof safe.legacyDecryptEnabled !== "undefined") {
    out.legacyDecryptEnabled = toBoolean(safe.legacyDecryptEnabled, true);
  }
  return out;
}

function stableJsonStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJsonStringify(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableJsonStringify(value[key])}`)
    .join(",")}}`;
}

function buildPrivateDocCryptoControlStateSnapshot() {
  const state = getCorePrivateDocCryptoControlState();
  return {
    activeKeyId: text(state.activeKeyId).toLowerCase(),
    allowLegacyTokenFormat: Boolean(state.allowLegacyTokenFormat),
    legacyDecryptEnabled: Boolean(state.legacyDecryptEnabled),
    keyIds: Array.isArray(state.keyIds)
      ? state.keyIds.map((item) => text(item).toLowerCase()).filter((item) => Boolean(item)).slice(0, 40)
      : []
  };
}

function buildPrivateDocCryptoControlStateHash(snapshot = {}) {
  return crypto
    .createHash("sha256")
    .update(stableJsonStringify(snapshot))
    .digest("hex");
}

function applyPrivateDocCryptoControlPatchToSnapshot(snapshot = {}, patch = {}) {
  const base = {
    activeKeyId: text(snapshot.activeKeyId).toLowerCase(),
    allowLegacyTokenFormat: Boolean(snapshot.allowLegacyTokenFormat),
    legacyDecryptEnabled: Boolean(snapshot.legacyDecryptEnabled),
    keyIds: Array.isArray(snapshot.keyIds)
      ? snapshot.keyIds.map((item) => text(item).toLowerCase()).filter((item) => Boolean(item)).slice(0, 40)
      : []
  };
  const safePatch = sanitizePrivateDocCryptoControlPatch(patch);
  return {
    ...base,
    activeKeyId:
      typeof safePatch.activeKeyId === "undefined"
        ? base.activeKeyId
        : text(safePatch.activeKeyId).toLowerCase(),
    allowLegacyTokenFormat:
      typeof safePatch.allowLegacyTokenFormat === "undefined"
        ? base.allowLegacyTokenFormat
        : Boolean(safePatch.allowLegacyTokenFormat),
    legacyDecryptEnabled:
      typeof safePatch.legacyDecryptEnabled === "undefined"
        ? base.legacyDecryptEnabled
        : Boolean(safePatch.legacyDecryptEnabled)
  };
}

function getPrivateDocCryptoControlRiskSignals(current = {}, next = {}) {
  const safeCurrent = applyPrivateDocCryptoControlPatchToSnapshot(current, {});
  const safeNext = applyPrivateDocCryptoControlPatchToSnapshot(next, {});
  const signals = [];
  if (
    safeCurrent.activeKeyId &&
    safeNext.activeKeyId &&
    safeCurrent.activeKeyId !== safeNext.activeKeyId
  ) {
    signals.push("active-key-rotated");
  }
  if (
    Boolean(safeCurrent.allowLegacyTokenFormat) &&
    !Boolean(safeNext.allowLegacyTokenFormat)
  ) {
    signals.push("legacy-token-format-disabled");
  }
  if (
    Boolean(safeCurrent.legacyDecryptEnabled) &&
    !Boolean(safeNext.legacyDecryptEnabled)
  ) {
    signals.push("legacy-decrypt-disabled");
  }
  return [...new Set(signals)];
}

function buildPrivateDocCryptoControlApprovalDigest({
  requestedBy = "",
  requestedAt = "",
  reason = "",
  currentControl = {},
  proposedPatch = {},
  proposedControl = {},
  riskSignals = []
} = {}) {
  const payload = {
    requestedBy: text(requestedBy),
    requestedAt: text(requestedAt),
    reason: text(reason).replace(/\s+/g, " ").slice(0, 500),
    currentControl: applyPrivateDocCryptoControlPatchToSnapshot(currentControl, {}),
    proposedPatch: sanitizePrivateDocCryptoControlPatch(proposedPatch),
    proposedControl: applyPrivateDocCryptoControlPatchToSnapshot(proposedControl, {}),
    riskSignals: Array.isArray(riskSignals)
      ? [...new Set(riskSignals.map((item) => text(item).toLowerCase()).filter((item) => Boolean(item)))]
      : []
  };
  return crypto
    .createHmac("sha256", PRIVATE_DOC_CRYPTO_CONTROL_APPROVAL_SECRET)
    .update(stableJsonStringify(payload))
    .digest("hex");
}

function normalizePrivateDocCryptoControlApprovalRequest(value = {}) {
  const safe = toPlainObject(value) || {};
  const requestedBy = text(safe.requestedBy);
  const requestedAt = text(safe.requestedAt);
  const requestedAtMs = requestedAt ? new Date(requestedAt).getTime() : 0;
  const activeFlag = Boolean(safe.active);
  const expired =
    !requestedAtMs ||
    requestedAtMs + PRIVATE_DOC_CRYPTO_CONTROL_APPROVAL_WINDOW_MS <= Date.now();
  return {
    active: activeFlag && Boolean(requestedBy && requestedAtMs) && !expired,
    expired: Boolean(activeFlag && (expired || !requestedBy || !requestedAtMs)),
    requestedBy,
    requestedAt,
    reason: text(safe.reason).slice(0, 500),
    riskSignals: Array.isArray(safe.riskSignals)
      ? [...new Set(safe.riskSignals.map((item) => text(item).toLowerCase()).filter((item) => Boolean(item)))]
      : [],
    requestDigest: text(safe.requestDigest),
    currentControlHash: text(safe.currentControlHash),
    currentControl: applyPrivateDocCryptoControlPatchToSnapshot(safe.currentControl, {}),
    proposedPatch: sanitizePrivateDocCryptoControlPatch(safe.proposedPatch),
    proposedControl: applyPrivateDocCryptoControlPatchToSnapshot(safe.proposedControl, {})
  };
}

function getPrivateDocCryptoControlApprovalRequestState() {
  return normalizePrivateDocCryptoControlApprovalRequest(
    privateDocCryptoControlApprovalRequest
  );
}

function applyPersistedPrivateDocCryptoControlApprovalRequest(value = {}) {
  const normalized = normalizePrivateDocCryptoControlApprovalRequest(value);
  privateDocCryptoControlApprovalRequest = normalized;
  return normalized;
}

function sanitizePrivateDocCryptoAuditMetadata(value, depth = 0) {
  if (depth > 3) return "[depth-truncated]";
  if (value === null || typeof value === "undefined") return null;
  if (typeof value === "string") return value.slice(0, 320);
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value
      .slice(0, 20)
      .map((item) => sanitizePrivateDocCryptoAuditMetadata(item, depth + 1));
  }
  if (typeof value === "object") {
    const output = {};
    for (const key of Object.keys(value).slice(0, 30)) {
      output[text(key).slice(0, 60)] = sanitizePrivateDocCryptoAuditMetadata(
        value[key],
        depth + 1
      );
    }
    return output;
  }
  return String(value).slice(0, 120);
}

function hashPrivateDocCryptoAuditReason(reason = "") {
  const normalized = text(reason).replace(/\s+/g, " ").toLowerCase().slice(0, 500);
  if (!normalized) return "";
  return crypto
    .createHash("sha256")
    .update(`${PRIVATE_DOC_CRYPTO_CONTROL_AUDIT_SALT}|${normalized}`)
    .digest("hex");
}

function buildPrivateDocCryptoAuditPayloadHash(canonicalPayload = {}) {
  return crypto
    .createHash("sha256")
    .update(stableJsonStringify(canonicalPayload))
    .digest("hex");
}

function buildPrivateDocCryptoAuditSignature({
  payloadHash = "",
  chainIndex = 1,
  occurredAt = "",
  signatureKeyVersion = PRIVATE_DOC_CRYPTO_CONTROL_AUDIT_KEY_VERSION
} = {}) {
  return crypto
    .createHmac("sha256", PRIVATE_DOC_CRYPTO_CONTROL_AUDIT_SECRET)
    .update(
      `${text(payloadHash)}|${Math.max(
        1,
        Math.round(numberValue(chainIndex, 1))
      )}|${text(occurredAt)}|${text(signatureKeyVersion)}`
    )
    .digest("hex");
}

function buildPrivateDocCryptoAuditDecisionHash({
  previousDecisionHash = "",
  payloadHash = "",
  signature = "",
  chainIndex = 1,
  occurredAt = ""
} = {}) {
  return crypto
    .createHash("sha256")
    .update(
      `${PRIVATE_DOC_CRYPTO_CONTROL_AUDIT_SALT}|${text(previousDecisionHash)}|${text(
        payloadHash
      )}|${text(signature)}|${Math.max(
        1,
        Math.round(numberValue(chainIndex, 1))
      )}|${text(occurredAt)}`
    )
    .digest("hex");
}

function normalizePrivateDocCryptoControlAuditRow(row = {}) {
  const safe = toPlainObject(row) || {};
  const actorAdminId = toId(safe.actorAdminId);
  const requestedBy = toId(safe.requestedBy);
  const confirmedBy = toId(safe.confirmedBy);
  const occurredAt = text(safe.occurredAt);
  const chainIndex = Math.max(1, Math.round(numberValue(safe.chainIndex, 1)));
  return {
    auditId: text(safe.auditId),
    action: text(safe.action).toLowerCase(),
    actorAdminId,
    requestedBy,
    confirmedBy,
    reasonHash: text(safe.reasonHash),
    reasonPreview: text(safe.reasonPreview),
    previousDecisionHash: text(safe.previousDecisionHash),
    payloadHash: text(safe.payloadHash),
    signature: text(safe.signature),
    decisionHash: text(safe.decisionHash),
    signatureKeyVersion: text(safe.signatureKeyVersion, PRIVATE_DOC_CRYPTO_CONTROL_AUDIT_KEY_VERSION),
    canonicalPayload: toPlainObject(safe.canonicalPayload) || {},
    metadata: sanitizePrivateDocCryptoAuditMetadata(
      toPlainObject(safe.metadata) || {}
    ),
    chainIndex,
    occurredAt,
    createdAt: text(safe.createdAt),
    updatedAt: text(safe.updatedAt),
    chain: {
      chainIndex,
      previousDecisionHash: text(safe.previousDecisionHash),
      decisionHash: text(safe.decisionHash)
    }
  };
}

function sortPrivateDocCryptoControlAuditsDesc(rows = []) {
  return [...rows].sort((a, b) => {
    const chainDelta =
      Math.max(0, numberValue(b?.chainIndex, 0)) -
      Math.max(0, numberValue(a?.chainIndex, 0));
    if (chainDelta) return chainDelta;
    return new Date(text(b?.occurredAt) || 0).getTime() - new Date(text(a?.occurredAt) || 0).getTime();
  });
}

function getPrivateDocCryptoControlAuditMemoryStore() {
  if (!Array.isArray(proMemoryStore.corePrivateDocCryptoControlAudits)) {
    proMemoryStore.corePrivateDocCryptoControlAudits = [];
  }
  return proMemoryStore.corePrivateDocCryptoControlAudits;
}

async function fetchLatestPrivateDocCryptoControlAuditRow() {
  if (proRuntime.dbConnected) {
    try {
      const row = await CorePrivateDocCryptoControlAudit.findOne({})
        .sort({ chainIndex: -1, occurredAt: -1, createdAt: -1 })
        .lean();
      if (row) return normalizePrivateDocCryptoControlAuditRow(row);
    } catch {
      // Fallback to memory state on query failure.
    }
  }
  const memory = getPrivateDocCryptoControlAuditMemoryStore();
  const latest = sortPrivateDocCryptoControlAuditsDesc(memory)[0];
  return latest ? normalizePrivateDocCryptoControlAuditRow(latest) : null;
}

async function appendPrivateDocCryptoControlAuditRow(record = {}) {
  const normalized = normalizePrivateDocCryptoControlAuditRow(record);
  if (proRuntime.dbConnected) {
    try {
      const created = await CorePrivateDocCryptoControlAudit.create({
        auditId: text(normalized.auditId),
        action: text(normalized.action),
        actorAdminId: toObjectIdOrNull(normalized.actorAdminId),
        requestedBy: toObjectIdOrNull(normalized.requestedBy),
        confirmedBy: toObjectIdOrNull(normalized.confirmedBy),
        reasonHash: text(normalized.reasonHash),
        reasonPreview: text(normalized.reasonPreview),
        previousDecisionHash: text(normalized.previousDecisionHash),
        payloadHash: text(normalized.payloadHash),
        signature: text(normalized.signature),
        decisionHash: text(normalized.decisionHash),
        signatureKeyVersion: text(normalized.signatureKeyVersion),
        canonicalPayload: toPlainObject(normalized.canonicalPayload) || {},
        metadata: sanitizePrivateDocCryptoAuditMetadata(
          toPlainObject(normalized.metadata) || {}
        ),
        chainIndex: Math.max(1, Math.round(numberValue(normalized.chainIndex, 1))),
        occurredAt: text(normalized.occurredAt)
      });
      return normalizePrivateDocCryptoControlAuditRow(created?.toObject?.() || created);
    } catch {
      // Fallback to memory when DB write fails.
    }
  }
  const memory = getPrivateDocCryptoControlAuditMemoryStore();
  memory.unshift(normalized);
  if (memory.length > PRIVATE_DOC_CRYPTO_CONTROL_AUDIT_MAX_ITEMS) {
    memory.length = PRIVATE_DOC_CRYPTO_CONTROL_AUDIT_MAX_ITEMS;
  }
  return normalized;
}

async function listPrivateDocCryptoControlAudits(limit = 120) {
  const safeLimit = Math.max(1, Math.min(500, Math.round(numberValue(limit, 120))));
  if (proRuntime.dbConnected) {
    try {
      const rows = await CorePrivateDocCryptoControlAudit.find({})
        .sort({ chainIndex: -1, occurredAt: -1, createdAt: -1 })
        .limit(safeLimit)
        .lean();
      return (Array.isArray(rows) ? rows : []).map((row) =>
        normalizePrivateDocCryptoControlAuditRow(row)
      );
    } catch {
      // Fallback to memory state when DB read fails.
    }
  }
  const memory = getPrivateDocCryptoControlAuditMemoryStore();
  return sortPrivateDocCryptoControlAuditsDesc(memory)
    .slice(0, safeLimit)
    .map((row) => normalizePrivateDocCryptoControlAuditRow(row));
}

function verifyPrivateDocCryptoControlAuditChain(rows = []) {
  const normalized = (Array.isArray(rows) ? rows : [])
    .map((row) => normalizePrivateDocCryptoControlAuditRow(row))
    .sort((a, b) => {
      const delta =
        Math.max(0, numberValue(a.chainIndex, 0)) -
        Math.max(0, numberValue(b.chainIndex, 0));
      if (delta) return delta;
      return (
        new Date(text(a.occurredAt) || 0).getTime() -
        new Date(text(b.occurredAt) || 0).getTime()
      );
    });

  const issues = [];
  let previous = null;
  for (const row of normalized) {
    if (!PRIVATE_DOC_CRYPTO_CONTROL_AUDIT_ACTIONS.has(text(row.action).toLowerCase())) {
      issues.push({
        code: "invalid-action",
        chainIndex: row.chainIndex,
        action: row.action
      });
    }

    const expectedPayloadHash = buildPrivateDocCryptoAuditPayloadHash(
      toPlainObject(row.canonicalPayload) || {}
    );
    if (expectedPayloadHash !== text(row.payloadHash)) {
      issues.push({
        code: "payload-hash-mismatch",
        chainIndex: row.chainIndex
      });
    }

    const expectedSignature = buildPrivateDocCryptoAuditSignature({
      payloadHash: expectedPayloadHash,
      chainIndex: row.chainIndex,
      occurredAt: row.occurredAt,
      signatureKeyVersion: row.signatureKeyVersion
    });
    if (expectedSignature !== text(row.signature)) {
      issues.push({
        code: "signature-mismatch",
        chainIndex: row.chainIndex
      });
    }

    const expectedDecisionHash = buildPrivateDocCryptoAuditDecisionHash({
      previousDecisionHash: text(row.previousDecisionHash),
      payloadHash: expectedPayloadHash,
      signature: expectedSignature,
      chainIndex: row.chainIndex,
      occurredAt: row.occurredAt
    });
    if (expectedDecisionHash !== text(row.decisionHash)) {
      issues.push({
        code: "decision-hash-mismatch",
        chainIndex: row.chainIndex
      });
    }

    if (previous) {
      if (row.previousDecisionHash !== previous.decisionHash) {
        issues.push({
          code: "chain-link-mismatch",
          chainIndex: row.chainIndex,
          expectedPreviousDecisionHash: previous.decisionHash,
          observedPreviousDecisionHash: row.previousDecisionHash
        });
      }
      if (row.chainIndex !== previous.chainIndex + 1) {
        issues.push({
          code: "chain-index-gap",
          chainIndex: row.chainIndex,
          previousChainIndex: previous.chainIndex
        });
      }
    } else if (text(row.previousDecisionHash)) {
      issues.push({
        code: "unexpected-chain-head-previous-hash",
        chainIndex: row.chainIndex
      });
    }

    previous = row;
  }

  const oldest = normalized[0] || null;
  const newest = normalized[normalized.length - 1] || null;
  return {
    valid: issues.length === 0,
    total: normalized.length,
    chain: {
      headDecisionHash: text(newest?.decisionHash),
      tailDecisionHash: text(oldest?.decisionHash),
      minChainIndex: oldest ? Math.max(1, Math.round(numberValue(oldest.chainIndex, 1))) : 0,
      maxChainIndex: newest ? Math.max(1, Math.round(numberValue(newest.chainIndex, 1))) : 0,
      continuityExpected:
        Boolean(oldest) &&
        Math.max(1, Math.round(numberValue(oldest?.chainIndex, 1))) > 1
    },
    issues: issues.slice(0, 80)
  };
}

async function recordPrivateDocCryptoControlAudit({
  action = "updated",
  actorAdminId = "",
  requestedBy = "",
  confirmedBy = "",
  reason = "",
  metadata = {}
} = {}) {
  const safeAction = text(action).toLowerCase();
  if (!PRIVATE_DOC_CRYPTO_CONTROL_AUDIT_ACTIONS.has(safeAction)) {
    return null;
  }
  const previous = await fetchLatestPrivateDocCryptoControlAuditRow();
  const previousDecisionHash = text(previous?.decisionHash);
  const chainIndex = Math.max(
    1,
    Math.round(numberValue(previous?.chainIndex, 0)) + 1
  );
  const occurredAt = new Date().toISOString();
  const reasonPreview = text(reason).replace(/\s+/g, " ").slice(0, 140);
  const reasonHash = hashPrivateDocCryptoAuditReason(reason);
  const canonicalPayload = {
    action: safeAction,
    actorAdminId: toId(actorAdminId),
    requestedBy: toId(requestedBy),
    confirmedBy: toId(confirmedBy),
    reasonHash,
    reasonPreview,
    previousDecisionHash,
    chainIndex,
    occurredAt,
    metadata: sanitizePrivateDocCryptoAuditMetadata(metadata)
  };
  const payloadHash = buildPrivateDocCryptoAuditPayloadHash(canonicalPayload);
  const signature = buildPrivateDocCryptoAuditSignature({
    payloadHash,
    chainIndex,
    occurredAt
  });
  const decisionHash = buildPrivateDocCryptoAuditDecisionHash({
    previousDecisionHash,
    payloadHash,
    signature,
    chainIndex,
    occurredAt
  });
  const auditId = `pdcc-audit-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  return appendPrivateDocCryptoControlAuditRow({
    auditId,
    action: safeAction,
    actorAdminId: toId(actorAdminId),
    requestedBy: toId(requestedBy),
    confirmedBy: toId(confirmedBy),
    reasonHash,
    reasonPreview,
    previousDecisionHash,
    payloadHash,
    signature,
    decisionHash,
    signatureKeyVersion: PRIVATE_DOC_CRYPTO_CONTROL_AUDIT_KEY_VERSION,
    canonicalPayload,
    metadata: sanitizePrivateDocCryptoAuditMetadata(metadata),
    chainIndex,
    occurredAt
  });
}

function buildPersistablePrivateDocCryptoControlState() {
  const state = getCorePrivateDocCryptoControlState();
  return {
    activeKeyId: text(state.activeKeyId).toLowerCase(),
    allowLegacyTokenFormat: Boolean(state.allowLegacyTokenFormat),
    legacyDecryptEnabled: Boolean(state.legacyDecryptEnabled)
  };
}

async function hydratePrivateDocCryptoControlState({ force = false } = {}) {
  const nowTs = Date.now();
  if (!proRuntime.dbConnected) {
    privateDocCryptoControlHydratedAtTs = nowTs;
    return getCorePrivateDocCryptoControlState();
  }
  if (
    !force &&
    privateDocCryptoControlHydratedAtTs &&
    privateDocCryptoControlHydratedAtTs + PRIVATE_DOC_CRYPTO_CONTROL_HYDRATE_COOLDOWN_MS > nowTs
  ) {
    return getCorePrivateDocCryptoControlState();
  }
  try {
    const row = await CoreRuntimeConfig.findOne({
      key: PRIVATE_DOC_CRYPTO_CONTROL_CONFIG_KEY
    })
      .select("value updatedBy")
      .lean();
    const persistedValue = toPlainObject(row?.value);
    if (persistedValue) {
      updateCorePrivateDocCryptoControlState(sanitizePrivateDocCryptoControlPatch(persistedValue), {
        actorId: text(row?.updatedBy),
        actorRole: "persisted-config",
        source: "persisted-hydrate"
      });
    }
  } catch {
    // Keep current runtime state when persistence read fails.
  }
  privateDocCryptoControlHydratedAtTs = nowTs;
  return getCorePrivateDocCryptoControlState();
}

async function persistPrivateDocCryptoControlState({
  actorId = "",
  notes = ""
} = {}) {
  const control = buildPersistablePrivateDocCryptoControlState();
  if (!proRuntime.dbConnected) {
    return {
      persisted: false,
      source: "memory",
      control,
      state: getCorePrivateDocCryptoControlState()
    };
  }
  try {
    await CoreRuntimeConfig.findOneAndUpdate(
      { key: PRIVATE_DOC_CRYPTO_CONTROL_CONFIG_KEY },
      {
        $set: {
          value: control,
          updatedBy: text(actorId) || null,
          notes: text(notes).slice(0, 220)
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    privateDocCryptoControlHydratedAtTs = Date.now();
    return {
      persisted: true,
      source: "mongodb",
      control,
      state: getCorePrivateDocCryptoControlState()
    };
  } catch {
    return {
      persisted: false,
      source: "memory",
      control,
      state: getCorePrivateDocCryptoControlState()
    };
  }
}

async function hydratePrivateDocCryptoControlApprovalRequest({ force = false } = {}) {
  const nowTs = Date.now();
  if (!proRuntime.dbConnected) {
    privateDocCryptoControlApprovalHydratedAtTs = nowTs;
    return getPrivateDocCryptoControlApprovalRequestState();
  }
  if (
    !force &&
    privateDocCryptoControlApprovalHydratedAtTs &&
    privateDocCryptoControlApprovalHydratedAtTs +
      PRIVATE_DOC_CRYPTO_CONTROL_APPROVAL_HYDRATE_COOLDOWN_MS >
      nowTs
  ) {
    return getPrivateDocCryptoControlApprovalRequestState();
  }
  try {
    const row = await CoreRuntimeConfig.findOne({
      key: PRIVATE_DOC_CRYPTO_CONTROL_APPROVAL_CONFIG_KEY
    })
      .select("value")
      .lean();
    const persistedValue = toPlainObject(row?.value);
    if (persistedValue) {
      applyPersistedPrivateDocCryptoControlApprovalRequest(persistedValue);
    } else {
      applyPersistedPrivateDocCryptoControlApprovalRequest({
        active: false
      });
    }
  } catch {
    // Keep current runtime state when persistence read fails.
  }
  privateDocCryptoControlApprovalHydratedAtTs = nowTs;
  return getPrivateDocCryptoControlApprovalRequestState();
}

async function persistPrivateDocCryptoControlApprovalRequest({
  actorId = "",
  notes = ""
} = {}) {
  const request = getPrivateDocCryptoControlApprovalRequestState();
  if (!proRuntime.dbConnected) {
    return {
      persisted: false,
      source: "memory",
      request
    };
  }
  try {
    await CoreRuntimeConfig.findOneAndUpdate(
      { key: PRIVATE_DOC_CRYPTO_CONTROL_APPROVAL_CONFIG_KEY },
      {
        $set: {
          value: request,
          updatedBy: text(actorId) || null,
          notes: text(notes).slice(0, 220)
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    privateDocCryptoControlApprovalHydratedAtTs = Date.now();
    return {
      persisted: true,
      source: "mongodb",
      request
    };
  } catch {
    return {
      persisted: false,
      source: "memory",
      request
    };
  }
}

async function clearPrivateDocCryptoControlApprovalRequest({
  actorId = "",
  notes = "clear"
} = {}) {
  applyPersistedPrivateDocCryptoControlApprovalRequest({
    active: false
  });
  return persistPrivateDocCryptoControlApprovalRequest({
    actorId,
    notes
  });
}

export async function bootstrapCorePrivateDocCryptoControlState() {
  await hydratePrivateDocCryptoControlState({ force: true });
  await hydratePrivateDocCryptoControlApprovalRequest({ force: true });
  return getCorePrivateDocCryptoControlState();
}

function checkModelCoverage(model, requiredFields = []) {
  const schemaPaths = model?.schema?.paths
    ? Object.keys(model.schema.paths)
    : [];

  const missing = requiredFields.filter((field) => !schemaPaths.includes(field));
  const present = requiredFields.filter((field) => schemaPaths.includes(field));

  return {
    present,
    missing,
    coveragePercent: requiredFields.length
      ? Math.round((present.length / requiredFields.length) * 100)
      : 100
  };
}

function getStackChecksSnapshot() {
  const clientPackageJson = readJsonSafe(path.join(rootDir, "client", "package.json"));
  const serverPackageJson = readJsonSafe(path.join(rootDir, "server", "package.json"));

  const reactDetected = safeBool(clientPackageJson?.dependencies?.react);
  const nextDetected = safeBool(clientPackageJson?.dependencies?.next);
  const expressDetected = safeBool(serverPackageJson?.dependencies?.express);

  const mongoUriConfigured = isConfiguredCredential(process.env.MONGO_URI || process.env.MONGODB_URI);
  const storageProvider = text(getStorageProvider(), "cloudinary").toLowerCase();
  const cloudinaryConfigured =
    isConfiguredCredential(process.env.CLOUDINARY_CLOUD_NAME) &&
    isConfiguredCredential(process.env.CLOUDINARY_API_KEY) &&
    isConfiguredCredential(process.env.CLOUDINARY_API_SECRET);
  const s3Configured =
    isConfiguredCredential(process.env.AWS_REGION) &&
    isConfiguredCredential(process.env.AWS_S3_BUCKET);
  const storageConfigured =
    storageProvider === "cloudinary" ? cloudinaryConfigured : s3Configured;
  const nodeEnv = text(process.env.NODE_ENV, "development").toLowerCase();
  const developmentFallbackActive = nodeEnv !== "production";
  const storageReady = storageConfigured || developmentFallbackActive;

  const razorpayConfigured =
    isConfiguredCredential(getRazorpayPublicKey()) &&
    isConfiguredCredential(process.env.RAZORPAY_KEY_SECRET);
  const paymentReady = razorpayConfigured || developmentFallbackActive;

  const authConfigured =
    isConfiguredCredential(process.env.JWT_SECRET) &&
    isConfiguredCredential(process.env.ADMIN_REGISTRATION_KEY);

  const vercelConfigExists = fs.existsSync(path.join(rootDir, "client", "vercel.json"));
  const renderConfigExists = fs.existsSync(path.join(rootDir, "server", "render.yaml"));

  const checks = {
    frontendReactOrNext: reactDetected || nextDetected,
    backendExpress: expressDetected,
    databaseMongoConfigured: mongoUriConfigured,
    databaseMongoConnected: Boolean(proRuntime.dbConnected),
    authConfigReady: authConfigured,
    storageConfigReady: storageReady,
    storageExternalConfigured: storageConfigured,
    paymentConfigReady: paymentReady,
    paymentExternalConfigured: razorpayConfigured,
    developmentFallbackActive,
    hostingFrontendVercelConfig: vercelConfigExists,
    hostingBackendRenderConfig: renderConfigExists
  };

  return {
    checks,
    runtime: {
      nodeEnv,
      dbMode: proRuntime.dbConnected ? "mongodb" : "memory-fallback",
      storageProvider,
      readinessMode: developmentFallbackActive
        ? "development-with-fallback"
        : "production-strict",
      apiVersion: "v3"
    }
  };
}

function buildCoreSystemsStatus(checks = {}) {
  const dependencyState = {
    authentication: Boolean(checks.authConfigReady),
    fileStorage: Boolean(checks.storageConfigReady),
    paymentGateway: Boolean(checks.paymentConfigReady),
    database: Boolean(checks.databaseMongoConfigured),
    backendServer: Boolean(checks.backendExpress),
    hosting: Boolean(checks.hostingBackendRenderConfig || checks.hostingFrontendVercelConfig)
  };

  return coreSystemsBlueprint.map((system) => {
    const dependencyResults = (system.dependencies || []).map((dependency) => ({
      dependency,
      ready: Boolean(dependencyState[dependency])
    }));
    const status = dependencyResults.every((item) => item.ready) ? "ready" : "setup-required";

    return {
      ...system,
      status,
      dependencyResults
    };
  });
}

function buildExecutionSteps(checks) {
  const stepStatus = (done, blockedBy = "") => ({
    status: done ? "ready" : "setup-required",
    blockedBy
  });

  const backendStep = stepStatus(
    checks.backendExpress,
    checks.backendExpress ? "" : "Express backend dependency not detected."
  );
  const dbStep = stepStatus(
    checks.databaseMongoConfigured,
    checks.databaseMongoConfigured ? "" : "MONGO_URI/MONGODB_URI is not configured."
  );
  const authStep = stepStatus(
    checks.authConfigReady,
    checks.authConfigReady ? "" : "JWT/ADMIN auth secrets are not fully configured."
  );
  const uploadStep = stepStatus(
    checks.storageConfigReady,
    checks.storageConfigReady
      ? checks.storageExternalConfigured
        ? ""
        : "Running in development fallback mode. Add real storage credentials for production."
      : "Storage provider credentials are missing."
  );
  const subscriptionStep = stepStatus(
    checks.paymentConfigReady,
    checks.paymentConfigReady
      ? checks.paymentExternalConfigured
        ? ""
        : "Running in development fallback mode. Add Razorpay keys for production."
      : "Razorpay keys are missing."
  );

  return [
    {
      step: 1,
      title: "Backend setup",
      ...backendStep,
      endpoints: ["/api/v3/health"]
    },
    {
      step: 2,
      title: "Database connect",
      ...dbStep,
      details: {
        configured: checks.databaseMongoConfigured,
        connectedNow: checks.databaseMongoConnected
      },
      endpoints: ["/api/v3/system/database-structure"]
    },
    {
      step: 3,
      title: "Auth system (OTP + JWT + Role access)",
      ...authStep,
      endpoints: [
        "/api/v3/auth/request-otp",
        "/api/v3/auth/login-otp",
        "/api/v3/auth/login"
      ]
    },
    {
      step: 4,
      title: "Property CRUD",
      status: "ready",
      blockedBy: "",
      endpoints: [
        "/api/v3/properties",
        "/api/v3/properties/taxonomy",
        "/api/v3/properties/:propertyId",
        "/api/v3/properties/professional"
      ]
    },
    {
      step: 5,
      title: "File upload (photo/video/private docs)",
      ...uploadStep,
      endpoints: [
        "/api/v3/uploads/property-media",
        "/api/v3/properties/professional"
      ]
    },
    {
      step: 6,
      title: "Subscription + payment",
      ...subscriptionStep,
      endpoints: [
        "/api/v3/subscriptions/plans",
        "/api/v3/subscriptions/payment/order",
        "/api/v3/subscriptions/payment/verify",
        "/api/v3/subscriptions"
      ]
    },
    {
      step: 7,
      title: "AI phase-2",
      status: "ready",
      blockedBy: "",
      endpoints: [
        "/api/v3/ai/smart-pricing",
        "/api/v3/ai/similar-properties",
        "/api/v3/ai/fake-listing-detection"
      ]
    },
    {
      step: 8,
      title: "Sealed bid hidden bidding",
      status: checks.authConfigReady && checks.databaseMongoConfigured ? "ready" : "setup-required",
      blockedBy:
        checks.authConfigReady && checks.databaseMongoConfigured
          ? ""
          : "Auth + database setup required for sealed hidden bidding.",
      endpoints: [
        "/api/v3/sealed-bids",
        "/api/v3/sealed-bids/admin",
        "/api/v3/sealed-bids/decision",
        "/api/v3/sealed-bids/winner/:propertyId"
      ]
    }
  ];
}

function getStackOptionsAndFolderStructure() {
  const structure = {
    root: "PropertySetu/",
    tree: [
      "PropertySetu/",
      "|",
      "|-- client/              # Frontend (React)",
      "|   |-- pages/",
      "|   |-- components/",
      "|   |-- services/",
      "|   `-- utils/",
      "|",
      "|-- server/              # Backend",
      "|   |-- controllers/",
      "|   |-- models/",
      "|   |-- routes/",
      "|   |-- middleware/",
      "|   `-- config/",
      "|",
      "|-- database/",
      "|",
      "`-- package.json"
    ],
    requiredPaths: {
      client: "client/",
      clientPages: "client/pages/",
      clientComponents: "client/components/",
      clientServices: "client/services/",
      clientUtils: "client/utils/",
      server: "server/",
      serverControllers: "server/controllers/",
      serverModels: "server/models/",
      serverRoutes: "server/routes/",
      serverMiddleware: "server/middleware/",
      serverConfig: "server/config/",
      database: "database/",
      rootPackageJson: "package.json"
    }
  };

  const presence = Object.fromEntries(
    Object.entries(structure.requiredPaths).map(([key, rel]) => [
      key,
      fs.existsSync(path.join(rootDir, rel))
    ])
  );

  return {
    option1: {
      label: "Best & Modern",
      frontend: "React / Next.js",
      backend: "Node.js + Express",
      database: "MongoDB",
      fileStorage: "Cloudinary / AWS S3",
      hosting: "Vercel + Render",
      payment: "Razorpay"
    },
    option2: {
      label: "Easier for Beginner",
      frontend: "HTML + CSS + JS",
      backend: "Node.js",
      database: "MongoDB",
      adminPanel: "Simple admin panel"
    },
    recommendation: "If you plan a future app build, Option 1 is best.",
    folderStructure: structure,
    folderPresence: presence
  };
}

export function getCoreSystemArchitecturePlan(_req, res) {
  const recommendedStack = {
    frontend: "React / Next.js",
    backend: "Node.js + Express",
    database: "MongoDB",
    fileStorage: "Cloudinary / AWS S3",
    hosting: "Vercel + Render",
    payment: "Razorpay"
  };

  const liveImplementation = {
    frontend: {
      primary: "React (Vite)",
      path: "client/",
      fallback: "Static multipage web in frontend/"
    },
    backend: {
      primary: "Node.js + Express",
      path: "server/professional-server.js",
      apiV2: "/api/v2/*",
      apiV3: "/api/v3/*"
    },
    database: {
      primary: proRuntime.dbConnected ? "MongoDB (Connected)" : "MongoDB (Configured) + Memory Fallback",
      runtimeMode: proRuntime.dbConnected ? "mongodb" : "memory-fallback"
    },
    fileStorage: {
      primary: text(proRuntime.storageProvider || getStorageProvider(), "cloudinary"),
      supported: ["cloudinary", "s3"]
    },
    payment: {
      primary: "Razorpay",
      api: "/api/v2/payments/*"
    },
    hosting: {
      frontend: "Vercel (client/vercel.json)",
      backend: "Render (server/render.yaml)"
    }
  };

  return res.json({
    success: true,
    recommendedStack,
    liveImplementation,
    structure: {
      client: "client/ (React frontend)",
      backend: "backend/ (entry wrappers + scripts)",
      server: "server/ (professional + legacy APIs)",
      database: "database/ (legacy JSON persistence)",
      docs: "docs/ (deployment + architecture guides)"
    }
  });
}

export function getCoreSystemStackOptions(_req, res) {
  const payload = getStackOptionsAndFolderStructure();
  return res.json({
    success: true,
    ...payload,
    source: "professional-system-api"
  });
}

export function getCoreSystemStackReadiness(_req, res) {
  const snapshot = getStackChecksSnapshot();
  const checks = snapshot.checks;

  const passedCount = Object.values(checks).filter(Boolean).length;
  const totalCount = Object.keys(checks).length;
  const productionExternalReady =
    checks.storageExternalConfigured && checks.paymentExternalConfigured;
  const coreOperationalReady =
    checks.frontendReactOrNext &&
    checks.backendExpress &&
    checks.databaseMongoConfigured &&
    checks.authConfigReady &&
    checks.storageConfigReady &&
    checks.paymentConfigReady &&
    (checks.hostingFrontendVercelConfig || checks.hostingBackendRenderConfig);
  const stage = coreOperationalReady
    ? productionExternalReady
      ? "production-ready"
      : "development-ready"
    : passedCount >= Math.ceil(totalCount * 0.7)
      ? "staging-ready"
      : "setup-required";

  return res.json({
    success: true,
    stage,
    productionExternalReady,
    score: {
      passed: passedCount,
      total: totalCount
    },
    runtime: snapshot.runtime,
    checks
  });
}

export function getCoreSystemDatabaseStructure(_req, res) {
  const contract = buildCoreDatabaseContract(proRuntime);
  const modelCoverage = {
    users: checkModelCoverage(CoreUser, contract.collections.users.requiredFields),
    properties: checkModelCoverage(CoreProperty, contract.collections.properties.requiredFields),
    reviews: checkModelCoverage(CoreReview, contract.collections.reviews.requiredFields),
    subscriptions: checkModelCoverage(CoreSubscription, contract.collections.subscriptions.requiredFields)
  };

  const missingRequired = Object.entries(modelCoverage).reduce(
    (sum, [, details]) => sum + details.missing.length,
    0
  );

  return res.json({
    success: true,
    source: proRuntime.dbConnected ? "mongodb" : "memory-fallback",
    contract,
    modelCoverage,
    status: missingRequired === 0 ? "contract-aligned" : "contract-mismatch"
  });
}

export function getCoreSystemBlueprint(_req, res) {
  const snapshot = getStackChecksSnapshot();
  const contract = buildCoreDatabaseContract(proRuntime);
  const systems = buildCoreSystemsStatus(snapshot.checks);
  const readyCount = systems.filter((item) => item.status === "ready").length;
  const productionExternalReady =
    snapshot.checks.storageExternalConfigured &&
    snapshot.checks.paymentExternalConfigured;

  return res.json({
    success: true,
    message: "MongoDB structure + core systems blueprint for real backend build.",
    mongodbStructure: contract.collections,
    coreSystems: systems,
    summary: {
      ready: readyCount,
      total: systems.length,
      stage:
        readyCount === systems.length
          ? productionExternalReady
            ? "core-systems-ready"
            : "core-systems-ready-development"
          : "core-systems-setup-required",
      productionExternalReady
    },
    runtime: snapshot.runtime
  });
}

export function getCoreSystemExecutionPlan(_req, res) {
  const snapshot = getStackChecksSnapshot();
  const checks = snapshot.checks;
  const steps = buildExecutionSteps(checks);
  const readyCount = steps.filter((item) => item.status === "ready").length;

  return res.json({
    success: true,
    message:
      "Real startup features require backend server, database, auth, storage, payment gateway, and hosting setup.",
    startupNeed: {
      backendServer: true,
      database: true,
      authentication: true,
      fileStorage: true,
      paymentGateway: true,
      hostingSetup: true
    },
    steps,
    summary: {
      ready: readyCount,
      total: steps.length,
      stage: readyCount === steps.length ? "execution-ready" : "setup-in-progress"
    },
    runtime: snapshot.runtime
  });
}

export function getCoreSystemSecurityAudit(req, res) {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit || 100)));
  const items = getProSecurityAuditEvents(limit);
  const chainIntegrity = getProSecurityChainIntegrityStatus({
    auditLimit: limit,
    threatLimit: limit
  });
  return res.json({
    success: true,
    total: items.length,
    requestedBy: {
      id: String(req.coreUser?.id || ""),
      role: String(req.coreUser?.role || "")
    },
    chainIntegrity,
    items
  });
}

export function getCoreSystemSecurityIntelligence(req, res) {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit || 100)));
  const intelligence = getProSecurityThreatIntelligence(limit);
  return res.json({
    success: true,
    requestedBy: {
      id: String(req.coreUser?.id || ""),
      role: String(req.coreUser?.role || "")
    },
    ...intelligence
  });
}

export function getCoreSystemSecurityControl(req, res) {
  return res.json({
    success: true,
    requestedBy: {
      id: String(req.coreUser?.id || ""),
      role: String(req.coreUser?.role || "")
    },
    state: getProSecurityControlState()
  });
}

export async function getCoreSystemPrivateDocCryptoControl(req, res, next) {
  try {
    await hydratePrivateDocCryptoControlState();
    await hydratePrivateDocCryptoControlApprovalRequest();
    const approval = getPrivateDocCryptoControlApprovalRequestState();
    const state = getCorePrivateDocCryptoControlState();
    return res.json({
      success: true,
      requestedBy: {
        id: String(req.coreUser?.id || ""),
        role: String(req.coreUser?.role || "")
      },
      dualAdmin: {
        required: Boolean(PRIVATE_DOC_CRYPTO_CONTROL_DUAL_ADMIN_REQUIRED),
        approvalWindowMinutes: Math.max(
          1,
          Math.round(PRIVATE_DOC_CRYPTO_CONTROL_APPROVAL_WINDOW_MS / 60_000)
        ),
        reasonMin: PRIVATE_DOC_CRYPTO_CONTROL_APPROVAL_REASON_MIN
      },
      state,
      approvalRequest: {
        active: Boolean(approval.active),
        expired: Boolean(approval.expired),
        requestedBy: text(approval.requestedBy),
        requestedAt: text(approval.requestedAt),
        reason: text(approval.reason),
        riskSignals: Array.isArray(approval.riskSignals)
          ? approval.riskSignals.slice(0, 20)
          : [],
        currentControlHash: text(approval.currentControlHash)
      }
    });
  } catch (error) {
    return next(error);
  }
}

export async function listCoreSystemPrivateDocCryptoControlAudit(req, res, next) {
  try {
    const limit = Math.max(1, Math.min(500, Number(req.query?.limit || 120)));
    const rows = await listPrivateDocCryptoControlAudits(limit);
    const verification = verifyPrivateDocCryptoControlAuditChain(rows);
    return res.json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      requestedBy: {
        id: String(req.coreUser?.id || ""),
        role: String(req.coreUser?.role || "")
      },
      total: rows.length,
      verification,
      items: rows
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateCoreSystemPrivateDocCryptoControl(req, res, next) {
  try {
    await hydratePrivateDocCryptoControlState();
    await hydratePrivateDocCryptoControlApprovalRequest();
    const body =
      req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? req.body
        : {};
    const policyConfirm = toBoolean(
      body.policyConfirm || req.query?.policyConfirm,
      false
    );
    const requestReset = toBoolean(
      body.requestReset || req.query?.requestReset,
      false
    );
    const reason = text(body.reason);
    const patch =
      body.patch && typeof body.patch === "object" && !Array.isArray(body.patch)
        ? body.patch
        : body;
    const sanitizedPatch = sanitizePrivateDocCryptoControlPatch(patch);
    const hasPatch = Object.keys(sanitizedPatch).length > 0;
    if (!policyConfirm && !requestReset && !hasPatch) {
      return res.status(400).json({
        success: false,
        message: "At least one crypto-control field is required."
      });
    }

    const actorId = String(req.coreUser?.id || "");
    const actorRole = String(req.coreUser?.role || "");
    if (typeof sanitizedPatch.activeKeyId !== "undefined") {
      const availableKeyIds = Array.isArray(getCorePrivateDocCryptoControlState().keyIds)
        ? getCorePrivateDocCryptoControlState().keyIds.map((item) => text(item).toLowerCase())
        : [];
      if (!availableKeyIds.includes(text(sanitizedPatch.activeKeyId).toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: "activeKeyId is not available in configured keyring.",
          availableKeyIds
        });
      }
    }

    let approval = getPrivateDocCryptoControlApprovalRequestState();
    if (approval.expired) {
      await clearPrivateDocCryptoControlApprovalRequest({
        actorId,
        notes: "expired-clear"
      });
      approval = getPrivateDocCryptoControlApprovalRequestState();
    }
    const approvalBeforeManualReset = approval;
    const hadActiveApprovalRequest = Boolean(approval.active);
    if (requestReset && approval.active) {
      await clearPrivateDocCryptoControlApprovalRequest({
        actorId,
        notes: "manual-reset"
      });
      approval = getPrivateDocCryptoControlApprovalRequestState();
    }
    if (requestReset && !policyConfirm && !hasPatch) {
      if (hadActiveApprovalRequest) {
        await recordPrivateDocCryptoControlAudit({
          action: "approval-reset",
          actorAdminId: actorId,
          requestedBy: text(approvalBeforeManualReset?.requestedBy),
          reason: reason || text(approvalBeforeManualReset?.reason) || "manual-approval-reset",
          metadata: {
            requestReset: true,
            previousRiskSignals: Array.isArray(approvalBeforeManualReset?.riskSignals)
              ? approvalBeforeManualReset.riskSignals
              : [],
            previousCurrentControlHash: text(
              approvalBeforeManualReset?.currentControlHash
            )
          }
        });
      }
      return res.json({
        success: true,
        action: "approval-request-reset",
        requestedBy: {
          id: actorId,
          role: actorRole
        },
        cleared: hadActiveApprovalRequest,
        approvalRequest: {
          active: Boolean(approval.active),
          expired: Boolean(approval.expired),
          requestedBy: text(approval.requestedBy),
          requestedAt: text(approval.requestedAt),
          reason: text(approval.reason),
          riskSignals: Array.isArray(approval.riskSignals)
            ? approval.riskSignals.slice(0, 20)
            : [],
          currentControlHash: text(approval.currentControlHash)
        }
      });
    }

    if (policyConfirm) {
      if (!PRIVATE_DOC_CRYPTO_CONTROL_DUAL_ADMIN_REQUIRED) {
        return res.status(409).json({
          success: false,
          message: "policyConfirm is not required when dual-admin is disabled."
        });
      }
      if (!approval.active) {
        return res.status(404).json({
          success: false,
          message: "No active private-doc crypto approval request found."
        });
      }
      if (approval.requestedBy === actorId) {
        return res.status(409).json({
          success: false,
          message: "A different admin must confirm this private-doc crypto update."
        });
      }

      const currentControl = buildPrivateDocCryptoControlStateSnapshot();
      const expectedDigest = buildPrivateDocCryptoControlApprovalDigest({
        requestedBy: approval.requestedBy,
        requestedAt: approval.requestedAt,
        reason: approval.reason,
        currentControl: approval.currentControl,
        proposedPatch: approval.proposedPatch,
        proposedControl: approval.proposedControl,
        riskSignals: approval.riskSignals
      });
      const currentControlHash = buildPrivateDocCryptoControlStateHash(currentControl);

      if (!approval.requestDigest || !approval.currentControlHash) {
        await clearPrivateDocCryptoControlApprovalRequest({
          actorId,
          notes: "approval-integrity-empty-clear"
        });
        return res.status(409).json({
          success: false,
          message:
            "Approval request integrity metadata is missing. Create a fresh request."
        });
      }
      if (
        expectedDigest !== approval.requestDigest ||
        currentControlHash !== approval.currentControlHash ||
        stableJsonStringify(currentControl) !== stableJsonStringify(approval.currentControl)
      ) {
        await clearPrivateDocCryptoControlApprovalRequest({
          actorId,
          notes: "approval-integrity-mismatch-clear"
        });
        return res.status(409).json({
          success: false,
          message:
            "Crypto-control approval request integrity mismatch. Submit a new request."
        });
      }

      const confirmed = updateCorePrivateDocCryptoControlState(
        approval.proposedPatch,
        {
          actorId,
          actorRole,
          source: "dual-admin-confirmed"
        }
      );
      if (!confirmed.updated) {
        await clearPrivateDocCryptoControlApprovalRequest({
          actorId,
          notes: "approval-confirm-failed-clear"
        });
        return res.status(400).json({
          success: false,
          message: text(confirmed.error, "Unable to apply confirmed private-doc crypto update."),
          availableKeyIds: Array.isArray(confirmed.availableKeyIds)
            ? confirmed.availableKeyIds
            : []
        });
      }

      const persistence = await persistPrivateDocCryptoControlState({
        actorId,
        notes: "private-doc-crypto-control-update-confirmed"
      });
      await clearPrivateDocCryptoControlApprovalRequest({
        actorId,
        notes: "confirmed-clear"
      });
      await recordPrivateDocCryptoControlAudit({
        action: "approval-confirmed",
        actorAdminId: actorId,
        requestedBy: text(approval.requestedBy),
        confirmedBy: actorId,
        reason: text(approval.reason),
        metadata: {
          riskSignals: Array.isArray(approval.riskSignals) ? approval.riskSignals : [],
          currentControlHash: text(approval.currentControlHash),
          requestDigest: text(approval.requestDigest),
          persisted: Boolean(persistence.persisted),
          persistenceSource: text(
            persistence.source,
            proRuntime.dbConnected ? "mongodb" : "memory"
          )
        }
      });
      return res.json({
        success: true,
        action: "updated",
        requiresSecondAdmin: false,
        dualAdmin: {
          required: true,
          confirmedBy: actorId,
          requestedBy: text(approval.requestedBy)
        },
        requestedBy: {
          id: actorId,
          role: actorRole
        },
        persistence: {
          source: text(persistence.source, proRuntime.dbConnected ? "mongodb" : "memory"),
          persisted: Boolean(persistence.persisted)
        },
        state: confirmed.state
      });
    }

    if (approval.active) {
      return res.status(409).json({
        success: false,
        message:
          "An active private-doc crypto approval request exists. Use policyConfirm=true or requestReset=true."
      });
    }

    const currentControl = buildPrivateDocCryptoControlStateSnapshot();
    const nextControl = applyPrivateDocCryptoControlPatchToSnapshot(
      currentControl,
      sanitizedPatch
    );
    const riskSignals = getPrivateDocCryptoControlRiskSignals(
      currentControl,
      nextControl
    );
    const highRisk = riskSignals.length > 0;

    if (PRIVATE_DOC_CRYPTO_CONTROL_DUAL_ADMIN_REQUIRED && highRisk) {
      if (reason.length < PRIVATE_DOC_CRYPTO_CONTROL_APPROVAL_REASON_MIN) {
        return res.status(400).json({
          success: false,
          message: `reason must be at least ${PRIVATE_DOC_CRYPTO_CONTROL_APPROVAL_REASON_MIN} characters for high-risk crypto-control changes.`
        });
      }
      const requestedAt = new Date().toISOString();
      const requestDigest = buildPrivateDocCryptoControlApprovalDigest({
        requestedBy: actorId,
        requestedAt,
        reason,
        currentControl,
        proposedPatch: sanitizedPatch,
        proposedControl: nextControl,
        riskSignals
      });
      const currentControlHash = buildPrivateDocCryptoControlStateHash(currentControl);
      applyPersistedPrivateDocCryptoControlApprovalRequest({
        active: true,
        requestedBy: actorId,
        requestedAt,
        reason,
        riskSignals,
        requestDigest,
        currentControlHash,
        currentControl,
        proposedPatch: sanitizedPatch,
        proposedControl: nextControl
      });
      const approvalPersistence = await persistPrivateDocCryptoControlApprovalRequest({
        actorId,
        notes: "private-doc-crypto-control-update-request"
      });
      await recordPrivateDocCryptoControlAudit({
        action: "approval-requested",
        actorAdminId: actorId,
        requestedBy: actorId,
        reason,
        metadata: {
          riskSignals,
          currentControlHash,
          requestDigest,
          persisted: Boolean(approvalPersistence.persisted),
          persistenceSource: text(
            approvalPersistence.source,
            proRuntime.dbConnected ? "mongodb" : "memory"
          ),
          statePreview: nextControl
        }
      });
      return res.status(202).json({
        success: true,
        action: "update-requested",
        requiresSecondAdmin: true,
        requestedBy: {
          id: actorId,
          role: actorRole
        },
        approvalRequest: {
          requestedBy: actorId,
          requestedAt,
          reason,
          riskSignals,
          currentControlHash,
          approvalWindowMinutes: Math.max(
            1,
            Math.round(PRIVATE_DOC_CRYPTO_CONTROL_APPROVAL_WINDOW_MS / 60_000)
          )
        },
        persistence: {
          source: text(
            approvalPersistence.source,
            proRuntime.dbConnected ? "mongodb" : "memory"
          ),
          persisted: Boolean(approvalPersistence.persisted)
        },
        statePreview: nextControl
      });
    }

    const result = updateCorePrivateDocCryptoControlState(sanitizedPatch, {
      actorId,
      actorRole
    });
    if (!result.updated) {
      return res.status(400).json({
        success: false,
        message: text(result.error, "Unable to update private-doc crypto control."),
        availableKeyIds: Array.isArray(result.availableKeyIds)
          ? result.availableKeyIds
          : []
      });
    }

    const persistence = await persistPrivateDocCryptoControlState({
      actorId,
      notes: "private-doc-crypto-control-update"
    });
    await recordPrivateDocCryptoControlAudit({
      action: "updated",
      actorAdminId: actorId,
      requestedBy: actorId,
      reason: reason || "crypto-control-update",
      metadata: {
        riskSignals,
        persisted: Boolean(persistence.persisted),
        persistenceSource: text(
          persistence.source,
          proRuntime.dbConnected ? "mongodb" : "memory"
        ),
        previousState: currentControl,
        nextState: result.state
      }
    });
    return res.json({
      success: true,
      action: "updated",
      requestedBy: {
        id: actorId,
        role: actorRole
      },
      requiresSecondAdmin: false,
      persistence: {
        source: text(persistence.source, proRuntime.dbConnected ? "mongodb" : "memory"),
        persisted: Boolean(persistence.persisted)
      },
      state: result.state
    });
  } catch (error) {
    return next(error);
  }
}

export async function resetCoreSystemPrivateDocCryptoControl(req, res, next) {
  try {
    const body =
      req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? req.body
        : {};
    req.body = {
      ...body,
      patch: getCorePrivateDocCryptoControlFactoryDefaults(),
      reason: text(
        body.reason,
        "admin-reset-private-doc-crypto-control-to-defaults"
      )
    };
    return updateCoreSystemPrivateDocCryptoControl(req, res, next);
  } catch (error) {
    return next(error);
  }
}

export function getCoreSystemRateLimiterControl(req, res) {
  const includeAudit = toBoolean(req.query?.includeAudit, true);
  const auditLimit = Math.max(1, Math.min(500, Number(req.query?.auditLimit || 120)));
  return res.json({
    success: true,
    requestedBy: {
      id: String(req.coreUser?.id || ""),
      role: String(req.coreUser?.role || "")
    },
    state: getCoreRateLimiterSecurityState({
      includeAudit,
      auditLimit
    })
  });
}

export function updateCoreSystemRateLimiterControl(req, res) {
  const body =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? req.body
      : {};
  const patch =
    body.patch && typeof body.patch === "object" && !Array.isArray(body.patch)
      ? body.patch
      : body;
  const result = updateCoreRateLimiterSecurityControls(patch, {
    actorId: String(req.coreUser?.id || ""),
    actorRole: String(req.coreUser?.role || "")
  });
  return res.json({
    success: true,
    action: "updated",
    requestedBy: {
      id: String(req.coreUser?.id || ""),
      role: String(req.coreUser?.role || "")
    },
    ...result
  });
}

export function resetCoreSystemRateLimiterControl(req, res) {
  const body =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? req.body
      : {};
  const scope = text(body.scope || req.query?.scope).toLowerCase();
  const result = resetCoreRateLimiterSecurityState({
    scope,
    clearBuckets: toBoolean(body.clearBuckets, true),
    clearBlocks: toBoolean(body.clearBlocks, true),
    clearMetrics: toBoolean(body.clearMetrics, false),
    clearAudit: toBoolean(body.clearAudit, false),
    clearScopePolicy: toBoolean(body.clearScopePolicy, false),
    actorId: String(req.coreUser?.id || ""),
    actorRole: String(req.coreUser?.role || "")
  });
  return res.json({
    success: true,
    action: "reset",
    requestedBy: {
      id: String(req.coreUser?.id || ""),
      role: String(req.coreUser?.role || "")
    },
    ...result
  });
}

export function updateCoreSystemSecurityControl(req, res) {
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? req.body
    : {};
  const chainOverrideApproval = resolveChainOverrideApproval(body);
  const confirmChainIntegrityOverride = toBoolean(
    body.confirmChainIntegrityOverride || body.chainBreakGlass || body.confirmChainOverride,
    false
  );
  const confirmHighRiskDowngrade = toBoolean(
    body.confirmHighRiskDowngrade || body.breakGlass || body.confirmHighRiskChange,
    false
  );
  const patch =
    body.patch && typeof body.patch === "object" && !Array.isArray(body.patch)
      ? body.patch
      : body;
  const result = updateProSecurityControlState(patch, {
    actorId: String(req.coreUser?.id || ""),
    actorRole: String(req.coreUser?.role || ""),
    confirmChainIntegrityOverride,
    chainOverrideApproval,
    confirmHighRiskDowngrade
  });
  if (result.blocked) {
    return res.status(429).json({
      success: false,
      action: "update-blocked",
      requestedBy: {
        id: String(req.coreUser?.id || ""),
        role: String(req.coreUser?.role || "")
      },
      warnings: Array.isArray(result.warnings) ? result.warnings : [],
      guard: result.guard && typeof result.guard === "object" ? result.guard : null,
      chainGuard: result.chainGuard && typeof result.chainGuard === "object"
        ? result.chainGuard
        : null,
      chainDualControl: result.chainDualControl && typeof result.chainDualControl === "object"
        ? result.chainDualControl
        : null,
      downgradeGuard: result.downgradeGuard && typeof result.downgradeGuard === "object"
        ? result.downgradeGuard
        : null,
      state: result.state
    });
  }
  return res.json({
    success: true,
    action: "updated",
    requestedBy: {
      id: String(req.coreUser?.id || ""),
      role: String(req.coreUser?.role || "")
    },
    warnings: Array.isArray(result.warnings) ? result.warnings : [],
    guard: result.guard && typeof result.guard === "object" ? result.guard : null,
    chainGuard: result.chainGuard && typeof result.chainGuard === "object"
      ? result.chainGuard
      : null,
    chainDualControl: result.chainDualControl && typeof result.chainDualControl === "object"
      ? result.chainDualControl
      : null,
    downgradeGuard: result.downgradeGuard && typeof result.downgradeGuard === "object"
      ? result.downgradeGuard
      : null,
    state: result.state
  });
}

export function getCoreSystemSecurityControlProfiles(req, res) {
  return res.json({
    success: true,
    requestedBy: {
      id: String(req.coreUser?.id || ""),
      role: String(req.coreUser?.role || "")
    },
    profiles: listProSecurityControlProfiles()
  });
}

export function applyCoreSystemSecurityControlProfile(req, res) {
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? req.body
    : {};
  const profileId = text(body.profileId || body.profile || body.mode).toLowerCase();
  const chainOverrideApproval = resolveChainOverrideApproval(body);
  const confirmChainIntegrityOverride = toBoolean(
    body.confirmChainIntegrityOverride || body.chainBreakGlass || body.confirmChainOverride,
    false
  );
  const confirmHighRiskDowngrade = toBoolean(
    body.confirmHighRiskDowngrade || body.breakGlass || body.confirmHighRiskChange,
    false
  );
  const result = applyProSecurityControlProfile(profileId, {
    actorId: String(req.coreUser?.id || ""),
    actorRole: String(req.coreUser?.role || ""),
    confirmChainIntegrityOverride,
    chainOverrideApproval,
    confirmHighRiskDowngrade
  });
  const statusCode = result.blocked ? 429 : (result.applied ? 200 : 400);
  return res.status(statusCode).json({
    success: result.applied,
    action: result.blocked ? "profile-blocked" : (result.applied ? "profile-applied" : "profile-rejected"),
    requestedBy: {
      id: String(req.coreUser?.id || ""),
      role: String(req.coreUser?.role || "")
    },
    profileId: result.profileId,
    warnings: Array.isArray(result.warnings) ? result.warnings : [],
    guard: result.guard && typeof result.guard === "object" ? result.guard : null,
    chainGuard: result.chainGuard && typeof result.chainGuard === "object"
      ? result.chainGuard
      : null,
    chainDualControl: result.chainDualControl && typeof result.chainDualControl === "object"
      ? result.chainDualControl
      : null,
    downgradeGuard: result.downgradeGuard && typeof result.downgradeGuard === "object"
      ? result.downgradeGuard
      : null,
    state: result.state
  });
}

export function getCoreSystemSecurityControlPersistence(req, res) {
  return res.json({
    success: true,
    requestedBy: {
      id: String(req.coreUser?.id || ""),
      role: String(req.coreUser?.role || "")
    },
    persistence: getProSecurityControlPersistenceStatus()
  });
}

export function restoreCoreSystemSecurityControl(req, res) {
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? req.body
    : {};
  const chainOverrideApproval = resolveChainOverrideApproval(body);
  const confirmChainIntegrityOverride = toBoolean(
    body.confirmChainIntegrityOverride || body.chainBreakGlass || body.confirmChainOverride,
    false
  );
  const result = restoreProSecurityControlStateFromDisk({
    actorId: String(req.coreUser?.id || ""),
    actorRole: String(req.coreUser?.role || ""),
    confirmChainIntegrityOverride,
    chainOverrideApproval
  });
  const statusCode = result.blocked ? 429 : (result.restored ? 200 : 404);
  return res.status(statusCode).json({
    success: result.restored,
    action: result.blocked ? "restore-blocked" : (result.restored ? "restored" : "restore-missed"),
    requestedBy: {
      id: String(req.coreUser?.id || ""),
      role: String(req.coreUser?.role || "")
    },
    warnings: Array.isArray(result.warnings) ? result.warnings : [],
    guard: result.guard && typeof result.guard === "object" ? result.guard : null,
    chainGuard: result.chainGuard && typeof result.chainGuard === "object"
      ? result.chainGuard
      : null,
    chainDualControl: result.chainDualControl && typeof result.chainDualControl === "object"
      ? result.chainDualControl
      : null,
    state: result.state
  });
}

export function resetCoreSystemSecurityControl(req, res) {
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? req.body
    : {};
  const chainOverrideApproval = resolveChainOverrideApproval(body);
  const confirmChainIntegrityOverride = toBoolean(
    body.confirmChainIntegrityOverride || body.chainBreakGlass || body.confirmChainOverride,
    false
  );
  const result = resetProSecurityControlState({
    actorId: String(req.coreUser?.id || ""),
    actorRole: String(req.coreUser?.role || ""),
    confirmChainIntegrityOverride,
    chainOverrideApproval
  });
  const statusCode = result.blocked ? 429 : 200;
  return res.status(statusCode).json({
    success: !result.blocked,
    action: result.blocked ? "reset-blocked" : "reset",
    requestedBy: {
      id: String(req.coreUser?.id || ""),
      role: String(req.coreUser?.role || "")
    },
    warnings: Array.isArray(result.warnings) ? result.warnings : [],
    guard: result.guard && typeof result.guard === "object" ? result.guard : null,
    chainGuard: result.chainGuard && typeof result.chainGuard === "object"
      ? result.chainGuard
      : null,
    chainDualControl: result.chainDualControl && typeof result.chainDualControl === "object"
      ? result.chainDualControl
      : null,
    state: result.state
  });
}

export function releaseCoreSystemSecurityThreatProfile(req, res) {
  const fingerprint = normalizeProSecurityThreatFingerprint(req.body?.fingerprint);
  if (!fingerprint) {
    return res.status(400).json({
      success: false,
      message: "fingerprint is required."
    });
  }
  if (!isValidProSecurityThreatFingerprint(fingerprint)) {
    return res.status(400).json({
      success: false,
      message: "Invalid fingerprint format."
    });
  }

  const profile = releaseProSecurityThreatProfile(fingerprint);
  if (!profile) {
    return res.status(404).json({
      success: false,
      message: "Threat profile not found for fingerprint."
    });
  }

  return res.json({
    success: true,
    action: "released",
    requestedBy: {
      id: String(req.coreUser?.id || ""),
      role: String(req.coreUser?.role || "")
    },
    profile
  });
}

export function quarantineCoreSystemSecurityThreatProfile(req, res) {
  const fingerprint = normalizeProSecurityThreatFingerprint(req.body?.fingerprint);
  const reason = text(req.body?.reason || "manual-admin-quarantine").slice(0, 200);
  const durationMs = Math.max(
    60_000,
    Math.min(Number(req.body?.durationMs || 30 * 60 * 1000), 24 * 60 * 60 * 1000)
  );

  if (!fingerprint) {
    return res.status(400).json({
      success: false,
      message: "fingerprint is required."
    });
  }
  if (!isValidProSecurityThreatFingerprint(fingerprint)) {
    return res.status(400).json({
      success: false,
      message: "Invalid fingerprint format."
    });
  }

  const profile = quarantineProSecurityThreatProfile(fingerprint, {
    durationMs,
    reason: reason || "manual-admin-quarantine"
  });

  if (!profile) {
    return res.status(400).json({
      success: false,
      message: "Unable to quarantine threat profile."
    });
  }

  return res.json({
    success: true,
    action: "quarantined",
    requestedBy: {
      id: String(req.coreUser?.id || ""),
      role: String(req.coreUser?.role || "")
    },
    profile
  });
}
