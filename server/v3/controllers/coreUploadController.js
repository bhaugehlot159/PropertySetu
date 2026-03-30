import crypto from "crypto";
import net from "net";
import mongoose from "mongoose";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
import { proRuntime } from "../../config/proRuntime.js";
import { proMemoryStore } from "../../runtime/proMemoryStore.js";
import CoreProperty from "../models/CoreProperty.js";
import CorePrivateDocIntegrityDecisionAudit from "../models/CorePrivateDocIntegrityDecisionAudit.js";
import CorePrivateDocSecurityEvent from "../models/CorePrivateDocSecurityEvent.js";
import CorePrivateDocShieldBlock from "../models/CorePrivateDocShieldBlock.js";
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
const PRIVATE_DOC_UPLOAD_THREAT_SCAN_ENABLED =
  String(process.env.CORE_PRIVATE_DOC_UPLOAD_THREAT_SCAN_ENABLED || "true")
    .trim()
    .toLowerCase() !== "false";
const PRIVATE_DOC_UPLOAD_THREAT_PENDING_SCORE = Math.max(
  20,
  Math.min(95, Number(process.env.CORE_PRIVATE_DOC_UPLOAD_THREAT_PENDING_SCORE || 42))
);
const PRIVATE_DOC_UPLOAD_THREAT_QUARANTINE_SCORE = Math.max(
  PRIVATE_DOC_UPLOAD_THREAT_PENDING_SCORE,
  Math.min(100, Number(process.env.CORE_PRIVATE_DOC_UPLOAD_THREAT_QUARANTINE_SCORE || 72))
);
const PRIVATE_DOC_UPLOAD_THREAT_RISKY_EXTENSIONS = new Set([
  "docm",
  "xlsm",
  "pptm",
  "xlsb",
  "zip",
  "rar",
  "7z"
]);
const PRIVATE_DOC_UPLOAD_THREAT_MACRO_EXTENSIONS = new Set(["docm", "xlsm", "pptm", "xlsb"]);
const PRIVATE_DOC_UPLOAD_THREAT_NAME_HINTS = [
  "macro",
  "script",
  "payload",
  "crack",
  "keygen",
  "bypass",
  "inject"
];
const PRIVATE_DOC_UPLOAD_MIME_BY_EXTENSION = {
  pdf: ["application/pdf"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  txt: ["text/plain"],
  docm: ["application/vnd.ms-word.document.macroEnabled.12"],
  xlsm: ["application/vnd.ms-excel.sheet.macroEnabled.12"],
  xlsb: ["application/vnd.ms-excel.sheet.binary.macroEnabled.12"],
  pptm: ["application/vnd.ms-powerpoint.presentation.macroEnabled.12"]
};
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
const PRIVATE_DOC_ACCESS_SHIELD_ENABLED =
  String(process.env.CORE_PRIVATE_DOC_ACCESS_SHIELD_ENABLED || "true").trim().toLowerCase() !== "false";
const PRIVATE_DOC_ACCESS_SHIELD_ADMIN_BYPASS =
  String(process.env.CORE_PRIVATE_DOC_ACCESS_SHIELD_ADMIN_BYPASS || "true").trim().toLowerCase() !== "false";
const PRIVATE_DOC_SHIELD_RELEASE_DUAL_ADMIN_REQUIRED =
  String(process.env.CORE_PRIVATE_DOC_SHIELD_RELEASE_DUAL_ADMIN_REQUIRED || "true").trim().toLowerCase() !== "false";
const PRIVATE_DOC_SHIELD_RELEASE_REQUEST_WINDOW_MS = Math.max(
  15 * 60 * 1000,
  Math.min(
    7 * 24 * 60 * 60 * 1000,
    Number(process.env.CORE_PRIVATE_DOC_SHIELD_RELEASE_REQUEST_WINDOW_MINUTES || 180) * 60 * 1000
  )
);
const PRIVATE_DOC_SHIELD_RELEASE_REASON_MIN = Math.max(
  8,
  Number(process.env.CORE_PRIVATE_DOC_SHIELD_RELEASE_REASON_MIN || 12)
);
const PRIVATE_DOC_ACCESS_SHIELD_WINDOW_MS = Math.max(
  60_000,
  Math.min(
    24 * 60 * 60 * 1000,
    Number(process.env.CORE_PRIVATE_DOC_ACCESS_SHIELD_WINDOW_MINUTES || 20) * 60 * 1000
  )
);
const PRIVATE_DOC_ACCESS_SHIELD_RISK_THRESHOLD = Math.max(
  6,
  Number(process.env.CORE_PRIVATE_DOC_ACCESS_SHIELD_RISK_THRESHOLD || 18)
);
const PRIVATE_DOC_ACCESS_SHIELD_REPLAY_THRESHOLD = Math.max(
  2,
  Number(process.env.CORE_PRIVATE_DOC_ACCESS_SHIELD_REPLAY_THRESHOLD || 4)
);
const PRIVATE_DOC_ACCESS_SHIELD_DISTINCT_HASH_THRESHOLD = Math.max(
  2,
  Number(process.env.CORE_PRIVATE_DOC_ACCESS_SHIELD_DISTINCT_HASH_THRESHOLD || 6)
);
const PRIVATE_DOC_ACCESS_SHIELD_BLOCK_MIN_MS = Math.max(
  60_000,
  Number(process.env.CORE_PRIVATE_DOC_ACCESS_SHIELD_BLOCK_MINUTES || 20) * 60 * 1000
);
const PRIVATE_DOC_ACCESS_SHIELD_BLOCK_MAX_MS = Math.max(
  PRIVATE_DOC_ACCESS_SHIELD_BLOCK_MIN_MS,
  Number(process.env.CORE_PRIVATE_DOC_ACCESS_SHIELD_MAX_BLOCK_MINUTES || 360) * 60 * 1000
);
const PRIVATE_DOC_ACCESS_SHIELD_PENALTY_WINDOW_MS = Math.max(
  PRIVATE_DOC_ACCESS_SHIELD_BLOCK_MIN_MS,
  Math.min(
    7 * 24 * 60 * 60 * 1000,
    Number(process.env.CORE_PRIVATE_DOC_ACCESS_SHIELD_PENALTY_WINDOW_MINUTES || 240) * 60 * 1000
  )
);
const PRIVATE_DOC_ACCESS_SHIELD_PROFILE_MAX = Math.max(
  100,
  Number(process.env.CORE_PRIVATE_DOC_ACCESS_SHIELD_PROFILE_MAX || 6000)
);
const PRIVATE_DOC_ACCESS_SHIELD_EVENT_MAX_ITEMS = Math.max(
  100,
  Number(process.env.CORE_PRIVATE_DOC_ACCESS_SHIELD_EVENT_MAX_ITEMS || 3000)
);
const PRIVATE_DOC_SECURITY_PERSIST_ENABLED =
  String(process.env.CORE_PRIVATE_DOC_SECURITY_PERSIST_ENABLED || "true").trim().toLowerCase() !== "false";
const PRIVATE_DOC_SECURITY_PERSIST_EVENT_MAX = Math.max(
  200,
  Number(process.env.CORE_PRIVATE_DOC_SECURITY_PERSIST_EVENT_MAX || 12000)
);
const PRIVATE_DOC_SECURITY_HYDRATE_COOLDOWN_MS = Math.max(
  30_000,
  Math.min(
    15 * 60 * 1000,
    Number(process.env.CORE_PRIVATE_DOC_SECURITY_HYDRATE_COOLDOWN_SEC || 90) * 1000
  )
);
const PRIVATE_DOC_STREAM_PATH = "/api/v3/uploads/private-docs/stream";
const PRIVATE_DOC_STREAM_TOKEN_TTL_SEC = Math.max(
  20,
  Math.min(30 * 60, Number(process.env.CORE_PRIVATE_DOC_STREAM_TOKEN_TTL_SEC || 90))
);
const PRIVATE_DOC_STREAM_TOKEN_REPLAY_GUARD_ENABLED =
  String(process.env.CORE_PRIVATE_DOC_STREAM_TOKEN_REPLAY_GUARD_ENABLED || "true")
    .trim()
    .toLowerCase() !== "false";
const PRIVATE_DOC_STREAM_TOKEN_REPLAY_CACHE_MAX = Math.max(
  100,
  Number(process.env.CORE_PRIVATE_DOC_STREAM_TOKEN_REPLAY_CACHE_MAX || 12000)
);
const PRIVATE_DOC_PROXY_ENABLED =
  String(process.env.CORE_PRIVATE_DOC_PROXY_ENABLED || "true").trim().toLowerCase() !== "false";
const PRIVATE_DOC_PROXY_TIMEOUT_MS = Math.max(
  3_000,
  Math.min(120_000, Number(process.env.CORE_PRIVATE_DOC_PROXY_TIMEOUT_MS || 25_000))
);
const PRIVATE_DOC_PROXY_MAX_BYTES = Math.max(
  1 * 1024 * 1024,
  Math.min(200 * 1024 * 1024, Number(process.env.CORE_PRIVATE_DOC_PROXY_MAX_BYTES || 25 * 1024 * 1024))
);
const PRIVATE_DOC_PROXY_ALLOW_INSECURE_HTTP =
  String(process.env.CORE_PRIVATE_DOC_PROXY_ALLOW_INSECURE_HTTP || "false").trim().toLowerCase() === "true";
const PRIVATE_DOC_PROXY_BLOCK_PRIVATE_IPS =
  String(process.env.CORE_PRIVATE_DOC_PROXY_BLOCK_PRIVATE_IPS || "true").trim().toLowerCase() !== "false";
const PRIVATE_DOC_RAW_URL_EXPOSURE_ALLOWED =
  String(process.env.CORE_PRIVATE_DOC_RAW_URL_EXPOSURE_ALLOWED || "false").trim().toLowerCase() === "true";
const PRIVATE_DOC_CONTENT_ATTEST_ENABLED =
  String(process.env.CORE_PRIVATE_DOC_CONTENT_ATTEST_ENABLED || "true").trim().toLowerCase() !== "false";
const PRIVATE_DOC_UPSTREAM_HEADER_ENFORCE =
  String(process.env.CORE_PRIVATE_DOC_UPSTREAM_HEADER_ENFORCE || "true").trim().toLowerCase() !== "false";
const PRIVATE_DOC_INTEGRITY_BLOCK_ON_MISMATCH =
  String(process.env.CORE_PRIVATE_DOC_INTEGRITY_BLOCK_ON_MISMATCH || "true").trim().toLowerCase() !== "false";
const PRIVATE_DOC_INTEGRITY_MISMATCH_ADMIN_BYPASS =
  String(process.env.CORE_PRIVATE_DOC_INTEGRITY_MISMATCH_ADMIN_BYPASS || "true").trim().toLowerCase() !== "false";
const PRIVATE_DOC_INTEGRITY_REVIEW_REASON_MIN = Math.max(
  8,
  Number(process.env.CORE_PRIVATE_DOC_INTEGRITY_REVIEW_REASON_MIN || 12)
);
const PRIVATE_DOC_ACCESS_EPOCH_ROTATE_REASON_MIN = Math.max(
  8,
  Number(process.env.CORE_PRIVATE_DOC_ACCESS_EPOCH_ROTATE_REASON_MIN || 10)
);
const PRIVATE_DOC_AUTO_EMERGENCY_LOCK_ENABLED =
  String(process.env.CORE_PRIVATE_DOC_AUTO_EMERGENCY_LOCK_ENABLED || "true").trim().toLowerCase() !== "false";
const PRIVATE_DOC_AUTO_EMERGENCY_LOCK_WINDOW_MS = Math.max(
  60_000,
  Math.min(
    24 * 60 * 60 * 1000,
    Number(process.env.CORE_PRIVATE_DOC_AUTO_EMERGENCY_LOCK_WINDOW_MINUTES || 20) * 60 * 1000
  )
);
const PRIVATE_DOC_AUTO_EMERGENCY_LOCK_THRESHOLD = Math.max(
  3,
  Number(process.env.CORE_PRIVATE_DOC_AUTO_EMERGENCY_LOCK_THRESHOLD || 6)
);
const PRIVATE_DOC_AUTO_EMERGENCY_LOCK_DISTINCT_REASONS_MIN = Math.max(
  1,
  Number(process.env.CORE_PRIVATE_DOC_AUTO_EMERGENCY_LOCK_DISTINCT_REASONS_MIN || 2)
);
const PRIVATE_DOC_AUTO_EMERGENCY_LOCK_PROFILE_MAX = Math.max(
  100,
  Number(process.env.CORE_PRIVATE_DOC_AUTO_EMERGENCY_LOCK_PROFILE_MAX || 5000)
);
const PRIVATE_DOC_EMERGENCY_LOCK_REASON_MIN = Math.max(
  8,
  Number(process.env.CORE_PRIVATE_DOC_EMERGENCY_LOCK_REASON_MIN || 12)
);
const PRIVATE_DOC_EMERGENCY_LOCK_ADMIN_BYPASS =
  String(process.env.CORE_PRIVATE_DOC_EMERGENCY_LOCK_ADMIN_BYPASS || "true").trim().toLowerCase() !== "false";
const PRIVATE_DOC_EMERGENCY_UNLOCK_DUAL_ADMIN_REQUIRED =
  String(process.env.CORE_PRIVATE_DOC_EMERGENCY_UNLOCK_DUAL_ADMIN_REQUIRED || "true").trim().toLowerCase() !== "false";
const PRIVATE_DOC_EMERGENCY_UNLOCK_REQUEST_WINDOW_MS = Math.max(
  15 * 60 * 1000,
  Math.min(
    7 * 24 * 60 * 60 * 1000,
    Number(process.env.CORE_PRIVATE_DOC_EMERGENCY_UNLOCK_REQUEST_WINDOW_MINUTES || 240) * 60 * 1000
  )
);
const PRIVATE_DOC_INTEGRITY_DUAL_APPROVAL_REQUIRED =
  String(process.env.CORE_PRIVATE_DOC_INTEGRITY_DUAL_APPROVAL_REQUIRED || "true").trim().toLowerCase() !== "false";
const PRIVATE_DOC_INTEGRITY_DUAL_APPROVAL_WINDOW_MS = Math.max(
  15 * 60 * 1000,
  Math.min(
    7 * 24 * 60 * 60 * 1000,
    Number(process.env.CORE_PRIVATE_DOC_INTEGRITY_DUAL_APPROVAL_WINDOW_MINUTES || 240) * 60 * 1000
  )
);
const PRIVATE_DOC_INTEGRITY_AUDIT_SECRET = text(
  process.env.CORE_PRIVATE_DOC_INTEGRITY_AUDIT_SECRET ||
  process.env.CORE_PRIVATE_DOC_SECRET ||
  process.env.CORE_JWT_SECRET ||
  process.env.JWT_SECRET ||
  "propertysetu-core-private-doc-integrity-audit-secret"
);
const PRIVATE_DOC_INTEGRITY_AUDIT_SALT = text(
  process.env.CORE_PRIVATE_DOC_INTEGRITY_AUDIT_SALT || "propertysetu-core-private-doc-integrity-audit-salt"
);
const PRIVATE_DOC_INTEGRITY_AUDIT_KEY_VERSION = text(
  process.env.CORE_PRIVATE_DOC_INTEGRITY_AUDIT_KEY_VERSION,
  "v1"
).slice(0, 24);
const PRIVATE_DOC_INTEGRITY_AUDIT_SECONDARY_SECRET = text(
  process.env.CORE_PRIVATE_DOC_INTEGRITY_AUDIT_SECONDARY_SECRET
);
const PRIVATE_DOC_INTEGRITY_AUDIT_MAX_ITEMS = Math.max(
  200,
  Number(process.env.CORE_PRIVATE_DOC_INTEGRITY_AUDIT_MAX_ITEMS || 12000)
);
const PRIVATE_DOC_PROXY_ALLOWED_HOST_PATTERNS = (() => {
  const defaults = ["secure-cdn.propertysetu.local", "cdn.propertysetu.local"];
  const raw = text(process.env.CORE_PRIVATE_DOC_PROXY_ALLOWED_HOSTS);
  if (!raw) return defaults;
  const parsed = raw
    .split(/[,\s;]+/)
    .map((item) => text(item).toLowerCase())
    .filter((item) => Boolean(item));
  return parsed.length ? parsed : defaults;
})();
const privateDocConsumedTokenMap = new Map();
const privateDocConsumedStreamTokenMap = new Map();
const privateDocAccessShieldProfiles = new Map();
const privateDocAccessShieldBlocks = new Map();
const privateDocAccessShieldPenalty = new Map();
const privateDocAutoEmergencyLockProfiles = new Map();
const privateDocAutoEmergencyLockInFlight = new Set();
let privateDocShieldHydratedAtTs = 0;

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

function formatPrivateDocThreatMismatchReason({
  score = 0,
  signals = []
} = {}) {
  const safeScore = Math.max(0, Math.round(numberValue(score, 0)));
  const safeSignals = Array.isArray(signals)
    ? signals
        .map((item) => text(item).toLowerCase())
        .filter((item) => Boolean(item))
        .slice(0, 10)
    : [];
  const encodedSignals = safeSignals.length ? safeSignals.join(",") : "none";
  return `upload-threat-detected|score=${safeScore}|signals=${encodedSignals}`;
}

function parsePrivateDocThreatMismatchReason(reason = "") {
  const raw = text(reason);
  if (!raw.toLowerCase().startsWith("upload-threat-detected|")) {
    return {
      active: false,
      score: 0,
      signals: []
    };
  }
  const parts = raw.split("|").slice(1);
  const map = new Map();
  parts.forEach((entry) => {
    const [key, ...rest] = String(entry).split("=");
    map.set(text(key).toLowerCase(), text(rest.join("=")));
  });
  const signals = text(map.get("signals"))
    .split(",")
    .map((item) => text(item))
    .filter((item) => Boolean(item) && item !== "none");
  return {
    active: true,
    score: Math.max(0, Math.round(numberValue(map.get("score"), 0))),
    signals
  };
}

function evaluatePrivateDocUploadThreat(row = {}) {
  const privateDoc = Boolean(row?.isPrivate) || categoryImpliesPrivate(row?.category);
  if (!privateDoc || !PRIVATE_DOC_UPLOAD_THREAT_SCAN_ENABLED) {
    return { score: 0, signals: [], status: "clear" };
  }

  const fileName = text(row?.name).toLowerCase();
  const extension = extractExtension(fileName);
  const mimeType = text(row?.type, "application/octet-stream").toLowerCase();
  const sourceUrl = text(row?.url).toLowerCase();
  const sizeBytes = Math.max(0, Math.round(numberValue(row?.sizeBytes, 0)));
  const signals = [];
  let score = 0;

  if (PRIVATE_DOC_UPLOAD_THREAT_RISKY_EXTENSIONS.has(extension)) {
    signals.push(`risky-extension:${extension}`);
    score += PRIVATE_DOC_UPLOAD_THREAT_MACRO_EXTENSIONS.has(extension) ? 45 : 30;
  }
  if (PRIVATE_DOC_UPLOAD_THREAT_MACRO_EXTENSIONS.has(extension)) {
    signals.push("macro-enabled-office-file");
  }
  const allowedByExtension = PRIVATE_DOC_UPLOAD_MIME_BY_EXTENSION[extension];
  if (Array.isArray(allowedByExtension) && allowedByExtension.length) {
    const mimeMatched = allowedByExtension.includes(mimeType);
    if (!mimeMatched) {
      signals.push(`mime-mismatch:${extension}->${mimeType}`);
      score += 28;
    }
  }
  if (mimeType === "application/octet-stream" && extension && extension !== "bin") {
    signals.push("unknown-octet-stream");
    score += 16;
  }
  if (sourceUrl && !sourceUrl.startsWith("https://")) {
    signals.push("non-https-source");
    score += 15;
  }
  if (extension && (extension === "doc" || extension === "docx" || extension === "pdf") && sizeBytes < 1500) {
    signals.push("abnormally-small-doc");
    score += 12;
  }

  const nameHintsMatched = PRIVATE_DOC_UPLOAD_THREAT_NAME_HINTS.filter((hint) =>
    fileName.includes(hint)
  );
  if (nameHintsMatched.length) {
    signals.push(`risky-name:${nameHintsMatched.join("+")}`);
    score += Math.min(24, nameHintsMatched.length * 8);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const status =
    score >= PRIVATE_DOC_UPLOAD_THREAT_QUARANTINE_SCORE
      ? "quarantined"
      : score >= PRIVATE_DOC_UPLOAD_THREAT_PENDING_SCORE
        ? "pending"
        : "clear";
  return {
    score,
    signals,
    status
  };
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

function sanitizeDownloadFileName(name = "", fallback = "private-document.bin") {
  const base = text(name, fallback)
    .replace(/[/\\]/g, "-")
    .replace(/[^\w.\-() ]+/g, "")
    .trim();
  return text(base, fallback).slice(0, 120);
}

function isHostPatternMatch(hostname = "", pattern = "") {
  const host = text(hostname).toLowerCase();
  const rule = text(pattern).toLowerCase();
  if (!host || !rule) return false;
  if (rule.startsWith("*.")) {
    const suffix = rule.slice(2);
    return host === suffix || host.endsWith(`.${suffix}`);
  }
  return host === rule;
}

function isPrivateOrLoopbackIp(hostname = "") {
  const host = text(hostname).toLowerCase();
  const version = net.isIP(host);
  if (version === 4) {
    const octets = host.split(".").map((item) => Number(item));
    if (octets.length !== 4 || octets.some((item) => !Number.isFinite(item))) return false;
    if (octets[0] === 10) return true;
    if (octets[0] === 127) return true;
    if (octets[0] === 0) return true;
    if (octets[0] === 169 && octets[1] === 254) return true;
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
    if (octets[0] === 192 && octets[1] === 168) return true;
    return false;
  }
  if (version === 6) {
    if (host === "::1") return true;
    if (host.startsWith("fc") || host.startsWith("fd")) return true;
    if (host.startsWith("fe80")) return true;
  }
  return false;
}

function isPrivateDocProxyHostAllowed(hostname = "") {
  const host = text(hostname).toLowerCase();
  if (!host) return false;
  if (PRIVATE_DOC_PROXY_ALLOWED_HOST_PATTERNS.some((rule) => isHostPatternMatch(host, rule))) {
    return true;
  }
  return false;
}

function normalizePrivateDocIntegrityStatus(value = "") {
  const raw = text(value, "unknown").toLowerCase();
  if (raw === "verified" || raw === "mismatch") return raw;
  return "unknown";
}

function normalizePrivateDocIntegrityReviewStatus(value = "") {
  const raw = text(value, "none").toLowerCase();
  if (raw === "pending" || raw === "approved" || raw === "quarantined") return raw;
  return "none";
}

function normalizePrivateDocIntegrityDecisionAction(value = "") {
  const raw = text(value).toLowerCase();
  if (raw === "approve" || raw === "approved") return "approved";
  if (raw === "quarantine" || raw === "quarantined") return "quarantined";
  if (raw === "reset" || raw === "recheck" || raw === "retry") return "reset";
  return "";
}

function normalizePrivateDocAccessEpoch(value, fallback = 1) {
  const parsed = Math.round(numberValue(value, fallback));
  return Math.max(1, parsed);
}

function normalizePrivateDocEmergencyLockAction(value = "") {
  const raw = text(value).toLowerCase();
  if (raw === "lock" || raw === "enable" || raw === "on" || raw === "activate") return "lock";
  if (raw === "unlock" || raw === "disable" || raw === "off" || raw === "deactivate") return "unlock";
  return "lock";
}

function isPrivateDocAutoEmergencyLockReasonCandidate(reason = "", authorizationDenied = false) {
  const normalized = text(reason).toLowerCase();
  if (!normalized && !authorizationDenied) return false;
  if (normalized === "private-doc-emergency-lock-active") return false;
  if (normalized === "missing-token") return false;
  if (
    normalized.includes("replay") ||
    normalized.includes("binding-mismatch") ||
    normalized.includes("signature-mismatch") ||
    normalized.includes("payload-invalid") ||
    normalized.includes("subject-mismatch") ||
    normalized.includes("context-mismatch") ||
    normalized.includes("integrity-validation-failed") ||
    normalized.includes("access-epoch-revoked") ||
    normalized.includes("token-purpose-mismatch") ||
    normalized.includes("token-issued-in-future") ||
    normalized.includes("token-source-hash-mismatch")
  ) {
    return true;
  }
  return Boolean(authorizationDenied);
}

function prunePrivateDocAutoEmergencyLockProfiles(nowTs = Date.now()) {
  const now = Math.max(0, Math.round(numberValue(nowTs, Date.now())));
  const cutoffTs = now - PRIVATE_DOC_AUTO_EMERGENCY_LOCK_WINDOW_MS;

  for (const [uploadId, row] of privateDocAutoEmergencyLockProfiles.entries()) {
    const events = (Array.isArray(row?.events) ? row.events : [])
      .filter((item) => Math.max(0, Math.round(numberValue(item?.atTs, 0))) >= cutoffTs)
      .slice(-Math.max(20, PRIVATE_DOC_AUTO_EMERGENCY_LOCK_THRESHOLD * 6));
    if (!events.length) {
      privateDocAutoEmergencyLockProfiles.delete(uploadId);
      continue;
    }
    privateDocAutoEmergencyLockProfiles.set(uploadId, {
      ...row,
      events,
      updatedAtTs: now
    });
  }

  if (privateDocAutoEmergencyLockProfiles.size > PRIVATE_DOC_AUTO_EMERGENCY_LOCK_PROFILE_MAX) {
    const sorted = [...privateDocAutoEmergencyLockProfiles.entries()]
      .sort(
        (a, b) =>
          Math.max(0, Math.round(numberValue(a?.[1]?.updatedAtTs, 0))) -
          Math.max(0, Math.round(numberValue(b?.[1]?.updatedAtTs, 0)))
      );
    while (privateDocAutoEmergencyLockProfiles.size > PRIVATE_DOC_AUTO_EMERGENCY_LOCK_PROFILE_MAX && sorted.length) {
      const next = sorted.shift();
      if (!next) break;
      privateDocAutoEmergencyLockProfiles.delete(text(next[0]));
    }
  }
}

async function registerPrivateDocAutoEmergencyLockFromEvent(event = {}) {
  if (!PRIVATE_DOC_AUTO_EMERGENCY_LOCK_ENABLED) return;
  const uploadId = text(event.uploadId);
  if (!uploadId) return;
  const role = text(event.role, "buyer").toLowerCase();
  if (role === "admin") return;

  const reason = text(event.reason);
  const authorizationDenied = Boolean(event.authorizationDenied);
  if (!isPrivateDocAutoEmergencyLockReasonCandidate(reason, authorizationDenied)) return;
  if (privateDocAutoEmergencyLockInFlight.has(uploadId)) return;

  const nowTs = Date.now();
  prunePrivateDocAutoEmergencyLockProfiles(nowTs);
  const cutoffTs = nowTs - PRIVATE_DOC_AUTO_EMERGENCY_LOCK_WINDOW_MS;
  const profile = privateDocAutoEmergencyLockProfiles.get(uploadId) || {
    uploadId,
    events: [],
    updatedAtTs: nowTs,
    totalAutoLocks: 0,
    lastAutoLockAtTs: 0
  };
  const previousEvents = (Array.isArray(profile.events) ? profile.events : [])
    .filter((item) => Math.max(0, Math.round(numberValue(item?.atTs, 0))) >= cutoffTs);

  const nextEvent = {
    atTs: nowTs,
    reason: reason || (authorizationDenied ? "authorization-denied" : "unknown"),
    source: text(event.source),
    role,
    userId: text(event.userId),
    ipHash: hashPrivateDocShieldIp(event.ip),
    actorKey: buildPrivateDocShieldActorKey({
      userId: text(event.userId),
      ip: text(event.ip)
    })
  };
  const events = [...previousEvents, nextEvent].slice(-Math.max(30, PRIVATE_DOC_AUTO_EMERGENCY_LOCK_THRESHOLD * 8));
  const distinctReasons = new Set(events.map((item) => text(item.reason)).filter((item) => Boolean(item))).size;
  const suspiciousCount = events.length;

  privateDocAutoEmergencyLockProfiles.set(uploadId, {
    ...profile,
    events,
    updatedAtTs: nowTs
  });

  if (
    suspiciousCount < PRIVATE_DOC_AUTO_EMERGENCY_LOCK_THRESHOLD ||
    distinctReasons < PRIVATE_DOC_AUTO_EMERGENCY_LOCK_DISTINCT_REASONS_MIN
  ) {
    return;
  }

  privateDocAutoEmergencyLockInFlight.add(uploadId);
  try {
    const uploadRow = await findUploadById(uploadId);
    if (!uploadRow || !Boolean(uploadRow?.isPrivate)) return;
    if (Boolean(uploadRow?.privateDocEmergencyLockActive)) return;

    const nowIso = new Date(nowTs).toISOString();
    const previousEpoch = normalizePrivateDocAccessEpoch(uploadRow?.privateDocAccessEpoch, 1);
    const nextEpoch = previousEpoch + 1;
    const autoReason = `auto-emergency-lock:${suspiciousCount}-events/${distinctReasons}-reasons`;

    await updatePrivateDocEmergencyLockState({
      uploadId: toId(uploadRow?._id || uploadRow?.id) || uploadId,
      lockActive: true,
      lockReason: autoReason,
      lockBy: "",
      lockAt: nowIso,
      unlockBy: "",
      unlockAt: ""
    });
    await rotatePrivateDocAccessEpoch({
      uploadId: toId(uploadRow?._id || uploadRow?.id) || uploadId,
      nextEpoch,
      rotatedBy: "",
      rotatedAt: nowIso,
      rotateReason: `auto-emergency-lock:${reason || "suspicious-activity"}`
    });

    privateDocAutoEmergencyLockProfiles.set(uploadId, {
      ...profile,
      events: [],
      updatedAtTs: nowTs,
      totalAutoLocks: Math.max(0, Math.round(numberValue(profile.totalAutoLocks, 0))) + 1,
      lastAutoLockAtTs: nowTs
    });

    recordPrivateDocShieldEvent({
      type: "auto-emergency-lock",
      actorKey: text(nextEvent.actorKey),
      userId: text(nextEvent.userId),
      role,
      source: text(event.source, "private-doc-auto-emergency-lock"),
      reason: "private-doc-auto-emergency-lock-triggered",
      triggerReason: text(reason || "suspicious-activity"),
      uploadId,
      propertyId: text(event.propertyId),
      blockLevel: 0,
      triggers: [
        `events:${suspiciousCount}`,
        `reasons:${distinctReasons}`,
        `threshold:${PRIVATE_DOC_AUTO_EMERGENCY_LOCK_THRESHOLD}`
      ],
      metadata: {
        mode: "auto-emergency-lock",
        previousEpoch,
        nextEpoch,
        lockReason: autoReason
      }
    });
  } finally {
    privateDocAutoEmergencyLockInFlight.delete(uploadId);
  }
}

function toMs(value) {
  if (!value) return 0;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return date.getTime();
}

function getPrivateDocIntegrityApprovalRequestState(uploadRow = {}, nowTs = Date.now()) {
  const requestedBy = toId(uploadRow?.privateDocIntegrityApprovalRequestedBy);
  const requestedAtMs = toMs(uploadRow?.privateDocIntegrityApprovalRequestedAt);
  const reason = text(uploadRow?.privateDocIntegrityApprovalRequestReason);
  if (!requestedBy || !requestedAtMs) {
    return {
      active: false,
      expired: false,
      requestedBy: "",
      requestedAt: null,
      reason: ""
    };
  }
  const expiresAtMs = requestedAtMs + PRIVATE_DOC_INTEGRITY_DUAL_APPROVAL_WINDOW_MS;
  const expired = expiresAtMs <= nowTs;
  return {
    active: !expired,
    expired,
    requestedBy,
    requestedAt: asIso(requestedAtMs),
    reason
  };
}

function getPrivateDocEmergencyUnlockRequestState(uploadRow = {}, nowTs = Date.now()) {
  const requestedBy = toId(uploadRow?.privateDocEmergencyUnlockRequestedBy);
  const requestedAtMs = toMs(uploadRow?.privateDocEmergencyUnlockRequestedAt);
  const reason = text(uploadRow?.privateDocEmergencyUnlockRequestReason);
  if (!requestedBy || !requestedAtMs) {
    return {
      active: false,
      expired: false,
      requestedBy: "",
      requestedAt: null,
      reason: ""
    };
  }
  const expiresAtMs = requestedAtMs + PRIVATE_DOC_EMERGENCY_UNLOCK_REQUEST_WINDOW_MS;
  const expired = expiresAtMs <= nowTs;
  return {
    active: !expired,
    expired,
    requestedBy,
    requestedAt: asIso(requestedAtMs),
    reason
  };
}

function getPrivateDocShieldReleaseRequestState(blockRow = {}, nowTs = Date.now()) {
  const requestedBy = toId(blockRow?.releaseRequestedBy);
  const requestedAtMs = toMs(blockRow?.releaseRequestedAt);
  const reason = text(blockRow?.releaseRequestReason);
  if (!requestedBy || !requestedAtMs) {
    return {
      active: false,
      expired: false,
      requestedBy: "",
      requestedAt: null,
      reason: ""
    };
  }
  const expiresAtMs = requestedAtMs + PRIVATE_DOC_SHIELD_RELEASE_REQUEST_WINDOW_MS;
  const expired = expiresAtMs <= nowTs;
  return {
    active: !expired,
    expired,
    requestedBy,
    requestedAt: asIso(requestedAtMs),
    reason
  };
}

function normalizePrivateDocIntegrityAuditAction(value = "") {
  const raw = text(value).toLowerCase();
  if (raw === "approval-requested") return "approval-requested";
  if (raw === "approval-confirmed") return "approval-confirmed";
  if (raw === "approved") return "approved";
  if (raw === "quarantined") return "quarantined";
  if (raw === "reset") return "reset";
  return "";
}

function normalizePrivateDocIntegrityAuditPhase(value = "") {
  const raw = text(value).toLowerCase();
  if (raw === "request") return "request";
  if (raw === "confirm") return "confirm";
  return "single";
}

function hashPrivateDocIntegrityAuditValue(value = "", scope = "generic") {
  const safe = text(value);
  if (!safe) return "";
  return crypto
    .createHash("sha256")
    .update(`${PRIVATE_DOC_INTEGRITY_AUDIT_SALT}|${text(scope, "generic")}|${safe}`)
    .digest("hex");
}

function normalizePrivateDocIntegrityDecisionActionForPatch(value = "") {
  const normalized = normalizePrivateDocIntegrityAuditAction(value);
  if (normalized) return normalized;
  return "";
}

function sortObjectDeep(value) {
  if (Array.isArray(value)) return value.map((item) => sortObjectDeep(item));
  if (!value || typeof value !== "object") return value;

  return Object.keys(value)
    .sort()
    .reduce((acc, key) => {
      acc[key] = sortObjectDeep(value[key]);
      return acc;
    }, {});
}

function stableJsonStringify(value) {
  return JSON.stringify(sortObjectDeep(value));
}

function hashPrivateDocIntegrityAuditPayload(payload = {}) {
  return crypto
    .createHash("sha256")
    .update(stableJsonStringify(payload))
    .digest("hex");
}

function signPrivateDocIntegrityAuditPayload(
  payloadHash = "",
  keyVersion = PRIVATE_DOC_INTEGRITY_AUDIT_KEY_VERSION,
  secret = PRIVATE_DOC_INTEGRITY_AUDIT_SECRET
) {
  const safePayloadHash = text(payloadHash);
  if (!safePayloadHash) return "";
  const safeSecret = text(secret);
  if (!safeSecret) return "";
  const safeKeyVersion = text(keyVersion, "v1");
  return crypto
    .createHmac("sha256", safeSecret)
    .update(`${safeKeyVersion}|${safePayloadHash}`)
    .digest("hex");
}

function buildPrivateDocIntegrityDecisionHash({
  previousDecisionHash = "",
  payloadHash = "",
  signature = "",
  decisionId = "",
  action = ""
} = {}) {
  const seed = [
    text(previousDecisionHash),
    text(payloadHash),
    text(signature),
    text(decisionId),
    text(action)
  ].join("|");
  return crypto.createHash("sha256").update(seed).digest("hex");
}

function buildPrivateDocIntegrityDecisionAuditPayload({
  decisionId = "",
  uploadId = "",
  propertyId = "",
  ownerId = "",
  action = "",
  phase = "single",
  actorAdminId = "",
  requestedBy = "",
  confirmedBy = "",
  reasonHash = "",
  requestIpHash = "",
  requestUserAgentHash = "",
  statusBefore = "unknown",
  reviewStatusBefore = "none",
  statusAfter = "unknown",
  reviewStatusAfter = "none",
  occurredAt = null,
  previousDecisionHash = "",
  chainIndex = 1
} = {}) {
  return {
    v: 1,
    keyVersion: text(PRIVATE_DOC_INTEGRITY_AUDIT_KEY_VERSION, "v1"),
    decisionId: text(decisionId),
    uploadId: text(uploadId),
    propertyId: text(propertyId),
    ownerId: text(ownerId),
    action: normalizePrivateDocIntegrityAuditAction(action),
    phase: normalizePrivateDocIntegrityAuditPhase(phase),
    actorAdminId: text(actorAdminId),
    requestedBy: text(requestedBy),
    confirmedBy: text(confirmedBy),
    reasonHash: text(reasonHash),
    requestIpHash: text(requestIpHash),
    requestUserAgentHash: text(requestUserAgentHash),
    statusBefore: normalizePrivateDocIntegrityStatus(statusBefore),
    reviewStatusBefore: normalizePrivateDocIntegrityReviewStatus(reviewStatusBefore),
    statusAfter: normalizePrivateDocIntegrityStatus(statusAfter),
    reviewStatusAfter: normalizePrivateDocIntegrityReviewStatus(reviewStatusAfter),
    occurredAt: asIso(occurredAt),
    previousDecisionHash: text(previousDecisionHash),
    chainIndex: Math.max(1, Math.round(numberValue(chainIndex, 1)))
  };
}

function normalizePrivateDocIntegrityDecisionAuditRow(row = {}) {
  return {
    decisionId: text(row?.decisionId),
    uploadId: text(row?.uploadId),
    propertyId: toId(row?.propertyId),
    ownerId: toId(row?.ownerId),
    action: normalizePrivateDocIntegrityAuditAction(row?.action),
    dualControlPhase: normalizePrivateDocIntegrityAuditPhase(row?.dualControlPhase),
    adminId: toId(row?.adminId),
    requestedBy: toId(row?.requestedBy),
    confirmedBy: toId(row?.confirmedBy),
    reviewReasonHash: text(row?.reviewReasonHash),
    reviewReasonPreview: text(row?.reviewReasonPreview),
    requestIpHash: text(row?.requestIpHash),
    requestUserAgentHash: text(row?.requestUserAgentHash),
    previousDecisionHash: text(row?.previousDecisionHash),
    payloadHash: text(row?.payloadHash),
    signature: text(row?.signature),
    decisionHash: text(row?.decisionHash),
    signatureKeyVersion: text(row?.signatureKeyVersion, "v1"),
    canonicalPayload:
      row?.canonicalPayload && typeof row.canonicalPayload === "object"
        ? row.canonicalPayload
        : null,
    chainIndex: Math.max(1, Math.round(numberValue(row?.chainIndex, 1))),
    occurredAt: asIso(row?.occurredAt),
    createdAt: asIso(row?.createdAt),
    updatedAt: asIso(row?.updatedAt)
  };
}

function buildPrivateDocIntegrityDecisionAuditItem(
  row = {},
  { includeCryptographic = false, includePayload = false } = {}
) {
  const normalized = normalizePrivateDocIntegrityDecisionAuditRow(row);
  const item = {
    decisionId: normalized.decisionId,
    uploadId: normalized.uploadId,
    propertyId: normalized.propertyId,
    ownerId: normalized.ownerId,
    action: normalized.action,
    dualControlPhase: normalized.dualControlPhase,
    adminId: normalized.adminId,
    requestedBy: normalized.requestedBy,
    confirmedBy: normalized.confirmedBy,
    reviewReasonHash: normalized.reviewReasonHash,
    reviewReasonPreview: normalized.reviewReasonPreview,
    requestIpHash: normalized.requestIpHash,
    requestUserAgentHash: normalized.requestUserAgentHash,
    chain: {
      chainIndex: normalized.chainIndex,
      previousDecisionHash: normalized.previousDecisionHash,
      decisionHash: normalized.decisionHash
    },
    signatureKeyVersion: normalized.signatureKeyVersion,
    occurredAt: normalized.occurredAt,
    createdAt: normalized.createdAt
  };
  if (includeCryptographic) {
    item.cryptographic = {
      payloadHash: normalized.payloadHash,
      signature: normalized.signature
    };
  }
  if (includePayload) {
    item.canonicalPayload = normalized.canonicalPayload;
  }
  return item;
}

async function listPrivateDocIntegrityDecisionAudits(uploadId = "", limit = 120) {
  const safeUploadId = text(uploadId);
  if (!safeUploadId) return [];
  const safeLimit = Math.min(500, Math.max(1, Math.round(numberValue(limit, 120))));

  if (proRuntime.dbConnected) {
    return CorePrivateDocIntegrityDecisionAudit.find({ uploadId: safeUploadId })
      .sort({ chainIndex: -1, occurredAt: -1, createdAt: -1 })
      .limit(safeLimit)
      .lean();
  }

  return (Array.isArray(proMemoryStore.corePrivateDocIntegrityDecisionAudits)
    ? proMemoryStore.corePrivateDocIntegrityDecisionAudits
    : []
  )
    .filter((item) => text(item?.uploadId) === safeUploadId)
    .sort((a, b) => {
      const chainDelta = Math.max(0, numberValue(b?.chainIndex, 0)) - Math.max(0, numberValue(a?.chainIndex, 0));
      if (chainDelta) return chainDelta;
      return new Date(b?.occurredAt || b?.createdAt || 0) - new Date(a?.occurredAt || a?.createdAt || 0);
    })
    .slice(0, safeLimit);
}

function verifyPrivateDocIntegrityDecisionAuditChain(rows = []) {
  const normalizedRows = (Array.isArray(rows) ? rows : [])
    .map((item) => normalizePrivateDocIntegrityDecisionAuditRow(item))
    .filter((item) => Boolean(item.decisionId && item.action && item.decisionHash))
    .sort((a, b) => {
      const chainDelta = Math.max(0, numberValue(a.chainIndex, 0)) - Math.max(0, numberValue(b.chainIndex, 0));
      if (chainDelta) return chainDelta;
      return new Date(a.occurredAt || a.createdAt || 0) - new Date(b.occurredAt || b.createdAt || 0);
    });

  const issues = [];
  let previousDecisionHash = normalizedRows.length ? text(normalizedRows[0].previousDecisionHash) : "";
  let latestDecisionHash = "";

  normalizedRows.forEach((row, index) => {
    const payload = row.canonicalPayload && typeof row.canonicalPayload === "object"
      ? row.canonicalPayload
      : null;
    if (!payload) {
      issues.push({
        code: "missing-payload",
        chainIndex: row.chainIndex,
        decisionId: row.decisionId
      });
      previousDecisionHash = text(row.decisionHash);
      latestDecisionHash = text(row.decisionHash);
      return;
    }

    const expectedPayloadHash = hashPrivateDocIntegrityAuditPayload(payload);
    if (row.payloadHash !== expectedPayloadHash) {
      issues.push({
        code: "payload-hash-mismatch",
        chainIndex: row.chainIndex,
        decisionId: row.decisionId
      });
    }

    const signatureKeyVersion = text(row.signatureKeyVersion, "v1");
    const expectedSignature = signPrivateDocIntegrityAuditPayload(
      expectedPayloadHash,
      signatureKeyVersion,
      PRIVATE_DOC_INTEGRITY_AUDIT_SECRET
    );
    const expectedSignatureSecondary = PRIVATE_DOC_INTEGRITY_AUDIT_SECONDARY_SECRET
      ? signPrivateDocIntegrityAuditPayload(
          expectedPayloadHash,
          signatureKeyVersion,
          PRIVATE_DOC_INTEGRITY_AUDIT_SECONDARY_SECRET
        )
      : "";
    const signatureValid =
      row.signature === expectedSignature ||
      (Boolean(expectedSignatureSecondary) && row.signature === expectedSignatureSecondary);
    if (!signatureValid) {
      issues.push({
        code: "signature-mismatch",
        chainIndex: row.chainIndex,
        decisionId: row.decisionId
      });
    }

    const expectedDecisionHash = buildPrivateDocIntegrityDecisionHash({
      previousDecisionHash,
      payloadHash: expectedPayloadHash,
      signature: row.signature,
      decisionId: row.decisionId,
      action: row.action
    });
    if (row.decisionHash !== expectedDecisionHash) {
      issues.push({
        code: "decision-hash-mismatch",
        chainIndex: row.chainIndex,
        decisionId: row.decisionId
      });
    }

    if (index > 0 && row.previousDecisionHash !== previousDecisionHash) {
      issues.push({
        code: "chain-link-mismatch",
        chainIndex: row.chainIndex,
        decisionId: row.decisionId
      });
    }

    previousDecisionHash = text(row.decisionHash);
    latestDecisionHash = text(row.decisionHash);
  });

  const oldest = normalizedRows[0] || null;
  const newest = normalizedRows[normalizedRows.length - 1] || null;
  const partial =
    Boolean(oldest && text(oldest.previousDecisionHash)) &&
    Math.max(1, Math.round(numberValue(oldest?.chainIndex, 1))) > 1;

  return {
    valid: issues.length === 0,
    total: normalizedRows.length,
    issues,
    partial,
    chain: {
      headDecisionHash: text(newest?.decisionHash),
      tailDecisionHash: text(oldest?.decisionHash),
      latestVerifiedDecisionHash: latestDecisionHash,
      minChainIndex: oldest ? Math.max(1, Math.round(numberValue(oldest.chainIndex, 1))) : 0,
      maxChainIndex: newest ? Math.max(1, Math.round(numberValue(newest.chainIndex, 1))) : 0
    }
  };
}

async function createPrivateDocIntegrityDecisionAudit({
  uploadRow = {},
  uploadId = "",
  propertyId = "",
  ownerId = "",
  action = "",
  phase = "single",
  actorAdminId = "",
  requestedBy = "",
  confirmedBy = "",
  reason = "",
  requestIp = "",
  requestUserAgent = "",
  statusBefore = "unknown",
  reviewStatusBefore = "none",
  statusAfter = "unknown",
  reviewStatusAfter = "none",
  occurredAt = null
} = {}) {
  const normalizedAction = normalizePrivateDocIntegrityAuditAction(action);
  const safeUploadId = text(uploadId || toId(uploadRow?._id || uploadRow?.id));
  if (!safeUploadId || !normalizedAction) return null;

  const normalizedOccurredAt = asIso(occurredAt || new Date()) || new Date().toISOString();
  const decisionId = crypto.randomUUID();
  const previousDecisionHash = text(uploadRow?.privateDocIntegrityDecisionChainHead);
  const previousChainLength = Math.max(
    0,
    Math.round(numberValue(uploadRow?.privateDocIntegrityDecisionChainLength, 0))
  );
  const chainIndex = previousChainLength + 1;
  const reasonHash = hashPrivateDocIntegrityAuditValue(reason, "reason");
  const requestIpHash = hashPrivateDocIntegrityAuditValue(requestIp, "ip");
  const requestUserAgentHash = hashPrivateDocIntegrityAuditValue(requestUserAgent, "ua");
  const canonicalPayload = buildPrivateDocIntegrityDecisionAuditPayload({
    decisionId,
    uploadId: safeUploadId,
    propertyId,
    ownerId,
    action: normalizedAction,
    phase,
    actorAdminId,
    requestedBy,
    confirmedBy,
    reasonHash,
    requestIpHash,
    requestUserAgentHash,
    statusBefore,
    reviewStatusBefore,
    statusAfter,
    reviewStatusAfter,
    occurredAt: normalizedOccurredAt,
    previousDecisionHash,
    chainIndex
  });
  const payloadHash = hashPrivateDocIntegrityAuditPayload(canonicalPayload);
  const signature = signPrivateDocIntegrityAuditPayload(
    payloadHash,
    PRIVATE_DOC_INTEGRITY_AUDIT_KEY_VERSION,
    PRIVATE_DOC_INTEGRITY_AUDIT_SECRET
  );
  const decisionHash = buildPrivateDocIntegrityDecisionHash({
    previousDecisionHash,
    payloadHash,
    signature,
    decisionId,
    action: normalizedAction
  });

  const row = {
    decisionId,
    uploadId: safeUploadId,
    propertyId: toObjectIdOrNull(propertyId),
    ownerId: toObjectIdOrNull(ownerId),
    action: normalizedAction,
    dualControlPhase: normalizePrivateDocIntegrityAuditPhase(phase),
    adminId: toObjectIdOrNull(actorAdminId),
    requestedBy: toObjectIdOrNull(requestedBy),
    confirmedBy: toObjectIdOrNull(confirmedBy),
    reviewReasonHash: reasonHash,
    reviewReasonPreview: text(reason).replace(/\s+/g, " ").slice(0, 140),
    requestIpHash,
    requestUserAgentHash,
    previousDecisionHash,
    payloadHash,
    signature,
    decisionHash,
    signatureKeyVersion: text(PRIVATE_DOC_INTEGRITY_AUDIT_KEY_VERSION, "v1"),
    canonicalPayload,
    chainIndex,
    occurredAt: new Date(normalizedOccurredAt)
  };

  if (proRuntime.dbConnected) {
    await CorePrivateDocIntegrityDecisionAudit.create(row);
    if (PRIVATE_DOC_INTEGRITY_AUDIT_MAX_ITEMS > 0) {
      const overLimit = await CorePrivateDocIntegrityDecisionAudit.countDocuments({
        uploadId: safeUploadId
      }) - PRIVATE_DOC_INTEGRITY_AUDIT_MAX_ITEMS;
      if (overLimit > 0) {
        const stale = await CorePrivateDocIntegrityDecisionAudit.find({ uploadId: safeUploadId })
          .sort({ chainIndex: 1, occurredAt: 1, createdAt: 1 })
          .limit(overLimit)
          .select({ _id: 1 })
          .lean();
        const staleIds = stale.map((item) => item?._id).filter((item) => Boolean(item));
        if (staleIds.length) {
          await CorePrivateDocIntegrityDecisionAudit.deleteMany({ _id: { $in: staleIds } });
        }
      }
    }
  } else {
    const nextRow = {
      ...row,
      propertyId: text(propertyId),
      ownerId: text(ownerId),
      adminId: text(actorAdminId),
      requestedBy: text(requestedBy),
      confirmedBy: text(confirmedBy),
      occurredAt: normalizedOccurredAt,
      createdAt: normalizedOccurredAt,
      updatedAt: normalizedOccurredAt
    };
    const previous = Array.isArray(proMemoryStore.corePrivateDocIntegrityDecisionAudits)
      ? proMemoryStore.corePrivateDocIntegrityDecisionAudits
      : [];
    proMemoryStore.corePrivateDocIntegrityDecisionAudits = [...previous, nextRow].slice(
      -PRIVATE_DOC_INTEGRITY_AUDIT_MAX_ITEMS
    );
  }

  return {
    decisionId,
    decisionHash,
    payloadHash,
    signature,
    signatureKeyVersion: text(PRIVATE_DOC_INTEGRITY_AUDIT_KEY_VERSION, "v1"),
    chainIndex,
    occurredAt: normalizedOccurredAt,
    action: normalizedAction,
    phase: normalizePrivateDocIntegrityAuditPhase(phase),
    requestedBy: text(requestedBy),
    confirmedBy: text(confirmedBy)
  };
}

function normalizeEtagValue(value = "") {
  const raw = text(value).toLowerCase();
  if (!raw) return "";
  const cleaned = raw.startsWith("w/") ? raw.slice(2) : raw;
  return cleaned.replace(/^"+|"+$/g, "");
}

function sameEtagValue(left = "", right = "") {
  const a = normalizeEtagValue(left);
  const b = normalizeEtagValue(right);
  if (!a || !b) return false;
  return a === b;
}

function hashPrivateDocShieldIdentity(value = "") {
  const safe = text(value);
  if (!safe) return "";
  return crypto.createHash("sha256").update(safe).digest("hex").slice(0, 32);
}

function buildPrivateDocShieldActorKey({
  userId = "",
  ip = ""
} = {}) {
  const normalizedUserId = text(userId);
  if (normalizedUserId) {
    const digest = hashPrivateDocShieldIdentity(`user:${normalizedUserId}`);
    return digest ? `user:${digest}` : "";
  }
  const normalizedIp = text(ip);
  if (!normalizedIp) return "";
  const digest = hashPrivateDocShieldIdentity(`ip:${normalizedIp}`);
  return digest ? `ip:${digest}` : "";
}

function toObjectIdOrNull(value) {
  const id = text(value);
  if (!id) return null;
  return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;
}

function canPersistPrivateDocSecurity() {
  return Boolean(proRuntime.dbConnected && PRIVATE_DOC_SECURITY_PERSIST_ENABLED);
}

function hashPrivateDocShieldIp(ip = "") {
  const safeIp = text(ip);
  if (!safeIp) return "";
  return crypto.createHash("sha256").update(`private-doc-ip:${safeIp}`).digest("hex");
}

function normalizePersistedShieldBlock(row = {}) {
  const blockUntil = asIso(row.blockUntil);
  const blockUntilTs = blockUntil ? new Date(blockUntil).getTime() : 0;
  const blockStartedAt = asIso(row.blockStartedAt);
  const blockStartedAtTs = blockStartedAt ? new Date(blockStartedAt).getTime() : Date.now();
  const releaseRequestedAt = asIso(row.releaseRequestedAt);
  return {
    actorKey: text(row.actorKey),
    userId: toId(row.userId),
    role: text(row.role, "buyer"),
    ip: "",
    ipHash: text(row.ipHash),
    source: text(row.source),
    reason: text(row.reason),
    triggers: Array.isArray(row.triggers) ? row.triggers.map((item) => text(item)).filter((item) => Boolean(item)) : [],
    blockLevel: Math.max(1, Math.round(numberValue(row.blockLevel, 1))),
    blockStartedAtTs,
    blockUntilTs,
    riskScore: Math.max(0, numberValue(row.riskScore, 0)),
    replayEvents: Math.max(0, Math.round(numberValue(row.replayEvents, 0))),
    distinctHashes: Math.max(0, Math.round(numberValue(row.distinctHashes, 0))),
    releaseRequestedBy: toId(row.releaseRequestedBy),
    releaseRequestedAt,
    releaseRequestReason: text(row.releaseRequestReason)
  };
}

function isPrivateDocFailureReason(reason = "") {
  const normalized = text(reason).toLowerCase();
  if (!normalized) return false;
  if (normalized === "ok" || normalized === "token-consumed") return false;
  return true;
}

function privateDocFailureRiskWeight({
  reason = "",
  replayBlocked = false,
  authorizationDenied = false,
  contextBindingFailure = false
} = {}) {
  const normalized = text(reason).toLowerCase();
  let weight = 2;

  if (normalized.includes("token-replay")) {
    weight = 6;
  } else if (
    normalized.includes("integrity") ||
    normalized.includes("binding-mismatch") ||
    normalized.includes("source-hash-mismatch") ||
    normalized.includes("signature-mismatch")
  ) {
    weight = 5;
  } else if (
    normalized.includes("context-mismatch") ||
    normalized.includes("subject-mismatch") ||
    normalized.includes("authorization")
  ) {
    weight = 4;
  } else if (
    normalized.includes("expired") ||
    normalized.includes("issued-in-future") ||
    normalized.includes("payload-invalid")
  ) {
    weight = 3;
  } else if (
    normalized.includes("missing-token") ||
    normalized.includes("source-unavailable") ||
    normalized.includes("upload-not-found")
  ) {
    weight = 1;
  }

  if (Boolean(replayBlocked)) weight += 2;
  if (Boolean(authorizationDenied)) weight += 1;
  if (Boolean(contextBindingFailure)) weight += 1;
  return Math.max(1, Math.min(16, weight));
}

function privateDocShieldBlockDurationMs(level = 1) {
  const safeLevel = Math.max(1, Math.round(numberValue(level, 1)));
  const scaled = Math.round(PRIVATE_DOC_ACCESS_SHIELD_BLOCK_MIN_MS * Math.pow(1.8, safeLevel - 1));
  return Math.max(
    PRIVATE_DOC_ACCESS_SHIELD_BLOCK_MIN_MS,
    Math.min(PRIVATE_DOC_ACCESS_SHIELD_BLOCK_MAX_MS, scaled)
  );
}

function listPrivateDocShieldActiveBlocks(nowTs = Date.now()) {
  const now = Math.max(0, Math.round(numberValue(nowTs, Date.now())));
  const rows = [];
  for (const [actorKey, row] of privateDocAccessShieldBlocks.entries()) {
    const blockUntilTs = Math.max(0, Math.round(numberValue(row?.blockUntilTs, 0)));
    if (!blockUntilTs || blockUntilTs <= now) continue;
    const releaseRequestState = getPrivateDocShieldReleaseRequestState(row, now);
    rows.push({
      actorKey,
      reason: text(row?.reason),
      blockLevel: Math.max(1, Math.round(numberValue(row?.blockLevel, 1))),
      blockStartedAt: asIso(row?.blockStartedAtTs),
      blockUntil: asIso(blockUntilTs),
      remainingSec: Math.max(1, Math.ceil((blockUntilTs - now) / 1000)),
      triggers: Array.isArray(row?.triggers) ? row.triggers.slice(0, 6) : [],
      userId: text(row?.userId),
      role: text(row?.role),
      ip: text(row?.ip),
      ipHash: text(row?.ipHash),
      source: text(row?.source),
      releaseRequest: {
        required: Boolean(PRIVATE_DOC_SHIELD_RELEASE_DUAL_ADMIN_REQUIRED),
        windowMinutes: Math.max(1, Math.round(PRIVATE_DOC_SHIELD_RELEASE_REQUEST_WINDOW_MS / 60_000)),
        requestedBy: text(releaseRequestState.requestedBy),
        requestedAt: asIso(releaseRequestState.requestedAt),
        reason: text(releaseRequestState.reason),
        active: Boolean(releaseRequestState.active),
        expired: Boolean(releaseRequestState.expired)
      }
    });
  }
  return rows.sort((a, b) => new Date(b.blockStartedAt || 0) - new Date(a.blockStartedAt || 0));
}

function syncPrivateDocShieldBlocksSnapshot(nowTs = Date.now()) {
  proMemoryStore.corePrivateDocShieldBlocks = listPrivateDocShieldActiveBlocks(nowTs);
}

function prunePrivateDocAccessShieldState(nowTs = Date.now()) {
  const now = Math.max(0, Math.round(numberValue(nowTs, Date.now())));
  const cutoffTs = now - PRIVATE_DOC_ACCESS_SHIELD_WINDOW_MS;

  for (const [actorKey, row] of privateDocAccessShieldProfiles.entries()) {
    const events = (Array.isArray(row?.events) ? row.events : [])
      .filter((item) => Math.max(0, Math.round(numberValue(item?.atTs, 0))) >= cutoffTs)
      .slice(-Math.max(10, PRIVATE_DOC_ACCESS_SHIELD_RISK_THRESHOLD * 8));

    if (!events.length && !privateDocAccessShieldBlocks.has(actorKey)) {
      privateDocAccessShieldProfiles.delete(actorKey);
      continue;
    }
    privateDocAccessShieldProfiles.set(actorKey, {
      ...row,
      events,
      updatedAtTs: Math.max(0, Math.round(numberValue(row?.updatedAtTs, now)))
    });
  }

  for (const [actorKey, row] of privateDocAccessShieldBlocks.entries()) {
    const blockUntilTs = Math.max(0, Math.round(numberValue(row?.blockUntilTs, 0)));
    if (!blockUntilTs || blockUntilTs <= now) {
      privateDocAccessShieldBlocks.delete(actorKey);
    }
  }

  for (const [actorKey, row] of privateDocAccessShieldPenalty.entries()) {
    const expiresAtTs = Math.max(0, Math.round(numberValue(row?.expiresAtTs, 0)));
    if (!expiresAtTs || expiresAtTs <= now) {
      privateDocAccessShieldPenalty.delete(actorKey);
    }
  }

  if (privateDocAccessShieldProfiles.size > PRIVATE_DOC_ACCESS_SHIELD_PROFILE_MAX) {
    const sortedByUpdated = [...privateDocAccessShieldProfiles.entries()]
      .sort((left, right) => {
        const leftTs = Math.max(0, Math.round(numberValue(left[1]?.updatedAtTs, 0)));
        const rightTs = Math.max(0, Math.round(numberValue(right[1]?.updatedAtTs, 0)));
        return leftTs - rightTs;
      });
    while (
      privateDocAccessShieldProfiles.size > PRIVATE_DOC_ACCESS_SHIELD_PROFILE_MAX &&
      sortedByUpdated.length
    ) {
      const next = sortedByUpdated.shift();
      if (!next) break;
      privateDocAccessShieldProfiles.delete(text(next[0]));
    }
  }

  syncPrivateDocShieldBlocksSnapshot(now);
}

async function hydratePrivateDocShieldBlocksFromDb(nowTs = Date.now()) {
  if (!canPersistPrivateDocSecurity()) return;
  const now = Math.max(0, Math.round(numberValue(nowTs, Date.now())));
  if (privateDocShieldHydratedAtTs && privateDocShieldHydratedAtTs + PRIVATE_DOC_SECURITY_HYDRATE_COOLDOWN_MS > now) {
    return;
  }

  try {
    const rows = await CorePrivateDocShieldBlock.find({
      blockUntil: { $gt: new Date(now) }
    })
      .sort({ blockUntil: -1 })
      .limit(Math.max(200, PRIVATE_DOC_ACCESS_SHIELD_PROFILE_MAX))
      .lean();

    rows.forEach((item) => {
      const normalized = normalizePersistedShieldBlock(item);
      if (!normalized.actorKey || !normalized.blockUntilTs || normalized.blockUntilTs <= now) return;
      privateDocAccessShieldBlocks.set(normalized.actorKey, normalized);
    });
    privateDocShieldHydratedAtTs = now;
    syncPrivateDocShieldBlocksSnapshot(now);
  } catch {
    // Fallback remains in-memory only if persistence lookup fails.
  }
}

function buildPrivateDocSecurityPersistenceMetadata(event = {}) {
  return {
    replayGuardEnabled: Boolean(event.replayGuardEnabled),
    replayBlocked: Boolean(event.replayBlocked),
    authorizationDenied: Boolean(event.authorizationDenied),
    contextBindingEnforced: Boolean(event.contextBindingEnforced),
    contextBindingFailure: Boolean(event.contextBindingFailure),
    expiresAt: text(event.expiresAt),
    shieldTriggers: Array.isArray(event.shieldTriggers) ? event.shieldTriggers.slice(0, 8) : [],
    shieldReason: text(event.shieldReason),
    shieldBlocked: Boolean(event.shieldBlocked),
    shieldActive: Boolean(event.shieldActive),
    shieldBlockLevel: Math.max(0, Math.round(numberValue(event.shieldBlockLevel, 0))),
    shieldRemainingSec: Math.max(0, Math.round(numberValue(event.shieldRemainingSec, 0))),
    dualControlRequired: Boolean(event.dualControlRequired),
    dualControlConfirmed: Boolean(event.dualControlConfirmed),
    releaseRequestedBy: text(event.releaseRequestedBy),
    releaseRequestedAt: asIso(event.releaseRequestedAt),
    releaseConfirmedBy: text(event.releaseConfirmedBy)
  };
}

async function persistPrivateDocSecurityEvent(event = {}, eventType = "access") {
  if (!canPersistPrivateDocSecurity()) return;
  const occurredAt = asIso(event.at) || new Date().toISOString();
  const actorKey = text(event.shieldActorKey) || buildPrivateDocShieldActorKey({
    userId: text(event.userId),
    ip: text(event.ip)
  });
  const row = {
    eventType: text(eventType) === "shield" ? "shield" : "access",
    eventId: text(event.id),
    actorKey,
    userId: toObjectIdOrNull(event.userId),
    role: text(event.role, "buyer").toLowerCase(),
    ipHash: hashPrivateDocShieldIp(event.ip),
    source: text(event.source),
    reason: text(event.reason),
    tokenFingerprint: text(event.tokenFingerprint),
    privateDocHash: text(event.hash),
    uploadId: text(event.uploadId),
    propertyId: toObjectIdOrNull(event.propertyId),
    shieldEnabled: Boolean(event.shieldEnabled),
    shieldActive: Boolean(event.shieldActive),
    shieldBlocked: Boolean(event.shieldBlocked),
    shieldReason: text(event.shieldReason),
    shieldBlockLevel: Math.max(0, Math.round(numberValue(event.shieldBlockLevel, 0))),
    shieldRemainingSec: Math.max(0, Math.round(numberValue(event.shieldRemainingSec, 0))),
    triggers: Array.isArray(event.shieldTriggers)
      ? event.shieldTriggers.slice(0, 8).map((item) => text(item)).filter((item) => Boolean(item))
      : [],
    metadata: buildPrivateDocSecurityPersistenceMetadata(event),
    occurredAt: new Date(occurredAt)
  };
  try {
    await CorePrivateDocSecurityEvent.create(row);
    if (Math.random() < 0.05) {
      const total = await CorePrivateDocSecurityEvent.estimatedDocumentCount();
      if (total > PRIVATE_DOC_SECURITY_PERSIST_EVENT_MAX) {
        const overflow = total - PRIVATE_DOC_SECURITY_PERSIST_EVENT_MAX;
        const staleIds = await CorePrivateDocSecurityEvent.find({})
          .sort({ occurredAt: -1, createdAt: -1 })
          .skip(PRIVATE_DOC_SECURITY_PERSIST_EVENT_MAX)
          .limit(Math.max(1, Math.min(overflow, 3000)))
          .select({ _id: 1 })
          .lean();
        if (staleIds.length) {
          await CorePrivateDocSecurityEvent.deleteMany({
            _id: { $in: staleIds.map((item) => item?._id).filter((item) => Boolean(item)) }
          });
        }
      }
    }
  } catch {
    // Keep runtime path resilient; persistence failures should not break access flow.
  }
}

async function upsertPrivateDocShieldBlockPersistence(row = {}) {
  if (!canPersistPrivateDocSecurity()) return;
  const actorKey = text(row.actorKey);
  if (!actorKey) return;
  const blockUntilTs = Math.max(0, Math.round(numberValue(row.blockUntilTs, 0)));
  if (!blockUntilTs) return;

  try {
    await CorePrivateDocShieldBlock.findOneAndUpdate(
      { actorKey },
      {
        $set: {
          actorKey,
          userId: toObjectIdOrNull(row.userId),
          role: text(row.role, "buyer"),
          ipHash: text(row.ipHash) || hashPrivateDocShieldIp(row.ip),
          source: text(row.source),
          reason: text(row.reason),
          triggers: Array.isArray(row.triggers)
            ? row.triggers.slice(0, 8).map((item) => text(item)).filter((item) => Boolean(item))
            : [],
          blockLevel: Math.max(1, Math.round(numberValue(row.blockLevel, 1))),
          blockStartedAt: new Date(Math.max(0, Math.round(numberValue(row.blockStartedAtTs, Date.now())))),
          blockUntil: new Date(blockUntilTs),
          riskScore: Math.max(0, numberValue(row.riskScore, 0)),
          replayEvents: Math.max(0, Math.round(numberValue(row.replayEvents, 0))),
          distinctHashes: Math.max(0, Math.round(numberValue(row.distinctHashes, 0))),
          releaseRequestedBy: toObjectIdOrNull(row.releaseRequestedBy),
          releaseRequestedAt: row.releaseRequestedAt ? new Date(row.releaseRequestedAt) : null,
          releaseRequestReason: text(row.releaseRequestReason).slice(0, 240),
          metadata: {
            persistedBy: "core-upload-controller",
            persistedAt: new Date().toISOString()
          }
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } catch {
    // Preserve main flow if persistence upsert fails.
  }
}

async function deletePrivateDocShieldBlockPersistence(actorKey = "") {
  if (!canPersistPrivateDocSecurity()) return;
  const key = text(actorKey);
  if (!key) return;
  try {
    await CorePrivateDocShieldBlock.deleteOne({ actorKey: key });
  } catch {
    // Preserve main flow if persistence delete fails.
  }
}

function recordPrivateDocShieldEvent(event = {}) {
  const rows = Array.isArray(proMemoryStore.corePrivateDocShieldEvents)
    ? proMemoryStore.corePrivateDocShieldEvents
    : [];
  const normalized = {
    id: `doc-shield-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    ...event
  };
  rows.unshift(normalized);
  if (rows.length > PRIVATE_DOC_ACCESS_SHIELD_EVENT_MAX_ITEMS) {
    rows.length = PRIVATE_DOC_ACCESS_SHIELD_EVENT_MAX_ITEMS;
  }
  proMemoryStore.corePrivateDocShieldEvents = rows;
  const isAutoBlockEvent = text(normalized.type).toLowerCase() === "auto-block";
  persistPrivateDocSecurityEvent(
    {
      ...normalized,
      shieldEnabled: true,
      shieldActive: isAutoBlockEvent,
      shieldBlocked: isAutoBlockEvent,
      shieldReason: text(normalized.reason),
      shieldBlockLevel: Math.max(0, Math.round(numberValue(normalized.blockLevel, 0))),
      shieldTriggers: Array.isArray(normalized.triggers) ? normalized.triggers.slice(0, 8) : [],
      shieldActorKey: text(normalized.actorKey)
    },
    "shield"
  ).catch(() => {});
  return normalized;
}

async function evaluatePrivateDocAccessShieldStatus({
  userId = "",
  role = "",
  ip = "",
  nowTs = Date.now()
} = {}) {
  const now = Math.max(0, Math.round(numberValue(nowTs, Date.now())));
  await hydratePrivateDocShieldBlocksFromDb(now);
  prunePrivateDocAccessShieldState(now);
  const actorKey = buildPrivateDocShieldActorKey({ userId, ip });
  const actorRole = text(role, "buyer").toLowerCase();
  const bypassed = actorRole === "admin" && PRIVATE_DOC_ACCESS_SHIELD_ADMIN_BYPASS;

  if (!PRIVATE_DOC_ACCESS_SHIELD_ENABLED || !actorKey || bypassed) {
    return {
      actorKey,
      active: false,
      bypassed,
      enabled: PRIVATE_DOC_ACCESS_SHIELD_ENABLED
    };
  }

  const block = privateDocAccessShieldBlocks.get(actorKey);
  if (!block) {
    if (canPersistPrivateDocSecurity()) {
      try {
        const persisted = await CorePrivateDocShieldBlock.findOne({
          actorKey,
          blockUntil: { $gt: new Date(now) }
        }).lean();
        if (persisted) {
          const normalized = normalizePersistedShieldBlock(persisted);
          if (normalized.actorKey) {
            privateDocAccessShieldBlocks.set(normalized.actorKey, normalized);
            syncPrivateDocShieldBlocksSnapshot(now);
            return {
              actorKey,
              active: true,
              bypassed: false,
              enabled: true,
              reason: text(normalized.reason),
              blockLevel: Math.max(1, Math.round(numberValue(normalized.blockLevel, 1))),
              blockUntilTs: Math.max(0, Math.round(numberValue(normalized.blockUntilTs, 0))),
              blockUntil: asIso(normalized.blockUntilTs),
              remainingSec: Math.max(1, Math.ceil((Math.max(0, Math.round(numberValue(normalized.blockUntilTs, 0))) - now) / 1000))
            };
          }
        }
      } catch {
        // Continue with runtime-only flow on lookup error.
      }
    }
    return {
      actorKey,
      active: false,
      bypassed: false,
      enabled: true
    };
  }

  const blockUntilTs = Math.max(0, Math.round(numberValue(block?.blockUntilTs, 0)));
  if (!blockUntilTs || blockUntilTs <= now) {
    privateDocAccessShieldBlocks.delete(actorKey);
    syncPrivateDocShieldBlocksSnapshot(now);
    return {
      actorKey,
      active: false,
      bypassed: false,
      enabled: true
    };
  }

  return {
    actorKey,
    active: true,
    bypassed: false,
    enabled: true,
    reason: text(block?.reason),
    blockLevel: Math.max(1, Math.round(numberValue(block?.blockLevel, 1))),
    blockUntilTs,
    blockUntil: asIso(blockUntilTs),
    remainingSec: Math.max(1, Math.ceil((blockUntilTs - now) / 1000))
  };
}

function registerPrivateDocAccessShieldFailure(event = {}) {
  if (!PRIVATE_DOC_ACCESS_SHIELD_ENABLED) {
    return { enabled: false, active: false, blockedNow: false };
  }

  const userId = text(event.userId);
  const role = text(event.role, "buyer").toLowerCase();
  const ip = text(event.ip);
  const actorKey = buildPrivateDocShieldActorKey({ userId, ip });
  if (!actorKey) {
    return { enabled: true, active: false, blockedNow: false };
  }
  if (role === "admin" && PRIVATE_DOC_ACCESS_SHIELD_ADMIN_BYPASS) {
    return {
      enabled: true,
      active: false,
      blockedNow: false,
      actorKey,
      bypassed: true
    };
  }

  const replayBlocked = Boolean(event.replayBlocked);
  const authorizationDenied = Boolean(event.authorizationDenied);
  const contextBindingFailure = Boolean(event.contextBindingFailure);
  const reason = text(event.reason);
  if (!replayBlocked && !authorizationDenied && !contextBindingFailure && !isPrivateDocFailureReason(reason)) {
    return { enabled: true, active: false, blockedNow: false, actorKey };
  }

  const nowTs = Date.now();
  prunePrivateDocAccessShieldState(nowTs);
  const profile = privateDocAccessShieldProfiles.get(actorKey) || {
    actorKey,
    userId,
    role,
    ip,
    events: [],
    updatedAtTs: nowTs
  };
  const cutoffTs = nowTs - PRIVATE_DOC_ACCESS_SHIELD_WINDOW_MS;
  const previousEvents = (Array.isArray(profile.events) ? profile.events : [])
    .filter((item) => Math.max(0, Math.round(numberValue(item?.atTs, 0))) >= cutoffTs);

  const nextEvent = {
    atTs: nowTs,
    reason: reason || "private-doc-access-failure",
    source: text(event.source),
    hash: text(event.hash).slice(0, 128),
    replayBlocked,
    authorizationDenied,
    contextBindingFailure,
    weight: privateDocFailureRiskWeight({
      reason,
      replayBlocked,
      authorizationDenied,
      contextBindingFailure
    })
  };
  const events = [...previousEvents, nextEvent].slice(-Math.max(10, PRIVATE_DOC_ACCESS_SHIELD_RISK_THRESHOLD * 8));
  const failures = events.filter((item) => isPrivateDocFailureReason(item.reason));
  const riskScore = failures.reduce((sum, item) => sum + Math.max(1, numberValue(item.weight, 1)), 0);
  const replayEvents = failures.filter((item) => Boolean(item.replayBlocked)).length;
  const distinctHashes = new Set(
    failures.map((item) => text(item.hash)).filter((item) => Boolean(item))
  ).size;

  const triggers = [];
  if (riskScore >= PRIVATE_DOC_ACCESS_SHIELD_RISK_THRESHOLD) {
    triggers.push("risk-threshold");
  }
  if (replayEvents >= PRIVATE_DOC_ACCESS_SHIELD_REPLAY_THRESHOLD) {
    triggers.push("replay-threshold");
  }
  if (
    distinctHashes >= PRIVATE_DOC_ACCESS_SHIELD_DISTINCT_HASH_THRESHOLD &&
    failures.length >= Math.max(2, PRIVATE_DOC_ACCESS_SHIELD_DISTINCT_HASH_THRESHOLD - 1)
  ) {
    triggers.push("distinct-doc-threshold");
  }
  const shouldBlock = triggers.length > 0;

  const profileRow = {
    ...profile,
    userId: profile.userId || userId,
    role: profile.role || role,
    ip: profile.ip || ip,
    events,
    riskScore,
    replayEvents,
    distinctHashes,
    updatedAtTs: nowTs
  };
  privateDocAccessShieldProfiles.set(actorKey, profileRow);

  const currentBlock = privateDocAccessShieldBlocks.get(actorKey);
  const currentBlockUntilTs = Math.max(0, Math.round(numberValue(currentBlock?.blockUntilTs, 0)));
  const blockActive = currentBlockUntilTs > nowTs;
  if (shouldBlock && !blockActive) {
    const penalty = privateDocAccessShieldPenalty.get(actorKey);
    const penaltyExpiresAtTs = Math.max(0, Math.round(numberValue(penalty?.expiresAtTs, 0)));
    const nextBlockLevel =
      penalty && penaltyExpiresAtTs > nowTs
        ? Math.min(12, Math.max(1, Math.round(numberValue(penalty?.blockLevel, 1))) + 1)
        : 1;
    const durationMs = privateDocShieldBlockDurationMs(nextBlockLevel);
    const blockUntilTs = nowTs + durationMs;
    const blockReason = `private-doc-shield-${triggers.join("-")}`;

    privateDocAccessShieldBlocks.set(actorKey, {
      actorKey,
      userId: profileRow.userId,
      role: profileRow.role,
      ip: profileRow.ip,
      ipHash: hashPrivateDocShieldIp(profileRow.ip),
      source: text(nextEvent.source),
      reason: blockReason,
      triggers: [...triggers],
      blockLevel: nextBlockLevel,
      blockStartedAtTs: nowTs,
      blockUntilTs,
      riskScore,
      replayEvents,
      distinctHashes,
      releaseRequestedBy: "",
      releaseRequestedAt: null,
      releaseRequestReason: ""
    });
    upsertPrivateDocShieldBlockPersistence({
      actorKey,
      userId: profileRow.userId,
      role: profileRow.role,
      ip: profileRow.ip,
      ipHash: hashPrivateDocShieldIp(profileRow.ip),
      source: text(nextEvent.source),
      reason: blockReason,
      triggers,
      blockLevel: nextBlockLevel,
      blockStartedAtTs: nowTs,
      blockUntilTs,
      riskScore,
      replayEvents,
      distinctHashes,
      releaseRequestedBy: "",
      releaseRequestedAt: null,
      releaseRequestReason: ""
    }).catch(() => {});
    privateDocAccessShieldPenalty.set(actorKey, {
      blockLevel: nextBlockLevel,
      blockedAtTs: nowTs,
      expiresAtTs: nowTs + PRIVATE_DOC_ACCESS_SHIELD_PENALTY_WINDOW_MS
    });
    syncPrivateDocShieldBlocksSnapshot(nowTs);
    recordPrivateDocShieldEvent({
      type: "auto-block",
      actorKey,
      userId: profileRow.userId,
      role: profileRow.role,
      ip: profileRow.ip,
      source: text(nextEvent.source),
      reason: blockReason,
      triggerReason: text(nextEvent.reason),
      triggers,
      riskScore,
      replayEvents,
      distinctHashes,
      blockLevel: nextBlockLevel,
      durationSec: Math.max(1, Math.ceil(durationMs / 1000)),
      blockUntil: asIso(blockUntilTs)
    });
    return {
      enabled: true,
      actorKey,
      active: true,
      blockedNow: true,
      reason: blockReason,
      blockLevel: nextBlockLevel,
      blockUntil: asIso(blockUntilTs),
      remainingSec: Math.max(1, Math.ceil((blockUntilTs - nowTs) / 1000)),
      triggers,
      riskScore,
      replayEvents,
      distinctHashes
    };
  }

  if (blockActive) {
    return {
      enabled: true,
      actorKey,
      active: true,
      blockedNow: false,
      reason: text(currentBlock?.reason),
      blockLevel: Math.max(1, Math.round(numberValue(currentBlock?.blockLevel, 1))),
      blockUntil: asIso(currentBlockUntilTs),
      remainingSec: Math.max(1, Math.ceil((currentBlockUntilTs - nowTs) / 1000)),
      triggers: Array.isArray(currentBlock?.triggers) ? currentBlock.triggers.slice(0, 6) : [],
      riskScore,
      replayEvents,
      distinctHashes
    };
  }

  return {
    enabled: true,
    actorKey,
    active: false,
    blockedNow: false,
    riskScore,
    replayEvents,
    distinctHashes
  };
}

async function releasePrivateDocAccessShieldActor(actorKey = "", releasedBy = "", reason = "", options = {}) {
  const key = text(actorKey);
  if (!key) return null;
  const block = privateDocAccessShieldBlocks.get(key);
  if (!block) {
    if (canPersistPrivateDocSecurity()) {
      const persisted = await CorePrivateDocShieldBlock.findOne({ actorKey: key }).lean();
      if (persisted) {
        privateDocAccessShieldBlocks.set(key, normalizePersistedShieldBlock(persisted));
      } else {
        return null;
      }
    } else {
      return null;
    }
  }
  const resolvedBlock = privateDocAccessShieldBlocks.get(key);
  if (!resolvedBlock) return null;
  const releaseRequestState = getPrivateDocShieldReleaseRequestState(resolvedBlock, Date.now());
  const releaseRequestedBy = text(options?.releaseRequestedBy, releaseRequestState.requestedBy);
  const releaseRequestedAt = asIso(options?.releaseRequestedAt || releaseRequestState.requestedAt);
  privateDocAccessShieldBlocks.delete(key);
  privateDocAccessShieldPenalty.delete(key);
  await deletePrivateDocShieldBlockPersistence(key);
  const releasedAt = new Date().toISOString();
  syncPrivateDocShieldBlocksSnapshot(Date.now());
  recordPrivateDocShieldEvent({
    type: "manual-release",
    actorKey: key,
    reason: text(reason, "admin-manual-release"),
    releasedBy: text(releasedBy),
    releasedAt,
    previousReason: text(resolvedBlock.reason),
    previousBlockLevel: Math.max(1, Math.round(numberValue(resolvedBlock.blockLevel, 1))),
    dualControlRequired: Boolean(PRIVATE_DOC_SHIELD_RELEASE_DUAL_ADMIN_REQUIRED),
    dualControlConfirmed: Boolean(PRIVATE_DOC_SHIELD_RELEASE_DUAL_ADMIN_REQUIRED && releaseRequestedBy),
    releaseRequestedBy,
    releaseRequestedAt,
    releaseConfirmedBy: text(releasedBy)
  });
  return {
    actorKey: key,
    reason: text(reason, "admin-manual-release"),
    releasedBy: text(releasedBy),
    releasedAt,
    releaseRequestedBy,
    releaseRequestedAt
  };
}

async function releaseAllPrivateDocAccessShieldActors(releasedBy = "", reason = "") {
  await hydratePrivateDocShieldBlocksFromDb(Date.now());
  const keys = [...privateDocAccessShieldBlocks.keys()];
  const released = [];
  for (const key of keys) {
    const row = await releasePrivateDocAccessShieldActor(key, releasedBy, reason);
    if (row) released.push(row);
  }
  return released;
}

async function markPrivateDocShieldReleaseRequest({
  actorKey = "",
  requestedBy = "",
  requestedAt = "",
  requestReason = ""
} = {}) {
  const key = text(actorKey);
  const requester = text(requestedBy);
  if (!key) return null;

  const resolvedRequestedAt = requester
    ? (asIso(requestedAt) || new Date().toISOString())
    : null;
  const resolvedReason = requester ? text(requestReason).slice(0, 240) : "";

  let block = privateDocAccessShieldBlocks.get(key);
  if (!block && canPersistPrivateDocSecurity()) {
    try {
      const persisted = await CorePrivateDocShieldBlock.findOne({ actorKey: key }).lean();
      if (persisted) {
        const normalized = normalizePersistedShieldBlock(persisted);
        privateDocAccessShieldBlocks.set(key, normalized);
        block = normalized;
      }
    } catch {
      // If persistence lookup fails, keep in-memory behavior.
    }
  }
  if (!block) return null;

  const nextBlock = {
    ...block,
    releaseRequestedBy: requester,
    releaseRequestedAt: resolvedRequestedAt,
    releaseRequestReason: resolvedReason
  };
  privateDocAccessShieldBlocks.set(key, nextBlock);

  if (canPersistPrivateDocSecurity()) {
    try {
      await CorePrivateDocShieldBlock.findOneAndUpdate(
        { actorKey: key },
        {
          $set: {
            releaseRequestedBy: toObjectIdOrNull(requester),
            releaseRequestedAt: resolvedRequestedAt ? new Date(resolvedRequestedAt) : null,
            releaseRequestReason: resolvedReason
          }
        }
      );
    } catch {
      // Keep runtime release flow resilient if persistence update fails.
    }
  }

  syncPrivateDocShieldBlocksSnapshot(Date.now());
  return nextBlock;
}

function recordPrivateDocAccessEvent(event = {}) {
  const rows = Array.isArray(proMemoryStore.corePrivateDocAccessEvents)
    ? proMemoryStore.corePrivateDocAccessEvents
    : [];
  const normalized = {
    id: `doc-access-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    ...event
  };
  const shield = registerPrivateDocAccessShieldFailure(normalized);
  if (shield && shield.enabled) {
    normalized.shieldEnabled = true;
    normalized.shieldActorKey = text(shield.actorKey);
    normalized.shieldActive = Boolean(shield.active);
    normalized.shieldBlocked = Boolean(shield.blockedNow || shield.active);
    normalized.shieldReason = text(shield.reason);
    normalized.shieldBlockLevel = Math.max(0, Math.round(numberValue(shield.blockLevel, 0)));
    normalized.shieldRemainingSec = Math.max(0, Math.round(numberValue(shield.remainingSec, 0)));
    normalized.shieldTriggers = Array.isArray(shield.triggers) ? shield.triggers.slice(0, 6) : [];
  }
  rows.unshift(normalized);
  if (rows.length > PRIVATE_DOC_ACCESS_EVENT_MAX_ITEMS) {
    rows.length = PRIVATE_DOC_ACCESS_EVENT_MAX_ITEMS;
  }
  proMemoryStore.corePrivateDocAccessEvents = rows;
  registerPrivateDocAutoEmergencyLockFromEvent(normalized).catch(() => {});
  persistPrivateDocSecurityEvent(normalized, "access").catch(() => {});
  return normalized;
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

function pruneConsumedPrivateDocStreamTokens(nowSec = Math.floor(Date.now() / 1000)) {
  const safeNowSec = Math.max(0, Math.round(numberValue(nowSec, 0)));
  for (const [key, row] of privateDocConsumedStreamTokenMap.entries()) {
    const expiresAtSec = Math.max(0, Math.round(numberValue(row?.expiresAtSec, 0)));
    if (!expiresAtSec || expiresAtSec <= safeNowSec) {
      privateDocConsumedStreamTokenMap.delete(key);
    }
  }
  while (privateDocConsumedStreamTokenMap.size > PRIVATE_DOC_STREAM_TOKEN_REPLAY_CACHE_MAX) {
    const oldestKey = privateDocConsumedStreamTokenMap.keys().next().value;
    if (!oldestKey) break;
    privateDocConsumedStreamTokenMap.delete(oldestKey);
  }
}

function consumePrivateDocStreamToken({
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
      reason: "stream-token-replay-params-invalid",
      replay: true
    };
  }

  pruneConsumedPrivateDocStreamTokens(safeNowSec);
  const key = `${safeTokenId}:${safeTokenFingerprint}`;
  const existing = privateDocConsumedStreamTokenMap.get(key);
  const existingExpiresAtSec = Math.max(0, Math.round(numberValue(existing?.expiresAtSec, 0)));
  if (existing && existingExpiresAtSec > safeNowSec) {
    return {
      ok: false,
      reason: "stream-token-replay-detected",
      replay: true
    };
  }

  privateDocConsumedStreamTokenMap.set(key, {
    tokenId: safeTokenId,
    tokenFingerprint: safeTokenFingerprint,
    consumedAtSec: safeNowSec,
    expiresAtSec: safeExpiresAtSec
  });
  pruneConsumedPrivateDocStreamTokens(safeNowSec);
  return {
    ok: true,
    reason: "stream-token-consumed",
    replay: false
  };
}

async function proxyPrivateDocToResponse({
  sourceUrl = "",
  docName = "",
  hash = "",
  expectedContentHash = "",
  expectedUpstreamEtag = "",
  expectedUpstreamLastModified = "",
  enforceHeaderIntegrity = false,
  res
} = {}) {
  const safeSourceUrl = text(sourceUrl);
  if (!safeSourceUrl) {
    return { ok: false, reason: "proxy-source-missing" };
  }

  let parsedUrl = null;
  try {
    parsedUrl = new URL(safeSourceUrl);
  } catch {
    return { ok: false, reason: "proxy-source-invalid-url" };
  }

  const protocol = text(parsedUrl.protocol).toLowerCase();
  if (protocol !== "https:" && !(PRIVATE_DOC_PROXY_ALLOW_INSECURE_HTTP && protocol === "http:")) {
    return { ok: false, reason: "proxy-source-protocol-not-allowed" };
  }
  const host = text(parsedUrl.hostname).toLowerCase();
  if (!isPrivateDocProxyHostAllowed(host)) {
    return { ok: false, reason: "proxy-source-host-not-allowlisted" };
  }
  if (PRIVATE_DOC_PROXY_BLOCK_PRIVATE_IPS && isPrivateOrLoopbackIp(host)) {
    return { ok: false, reason: "proxy-source-private-ip-blocked" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PRIVATE_DOC_PROXY_TIMEOUT_MS);

  let upstream = null;
  try {
    upstream = await fetch(parsedUrl.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "PropertySetu-PrivateDocProxy/1.0",
        accept: "*/*"
      }
    });
  } catch {
    clearTimeout(timeout);
    return { ok: false, reason: "proxy-upstream-fetch-failed" };
  }
  clearTimeout(timeout);

  if (!upstream.ok) {
    return {
      ok: false,
      reason: `proxy-upstream-status-${Math.max(0, Math.round(numberValue(upstream.status, 0)))}`
    };
  }
  const upstreamEtag = text(upstream.headers.get("etag")).slice(0, 180);
  const upstreamLastModified = text(upstream.headers.get("last-modified")).slice(0, 180);
  if (Boolean(enforceHeaderIntegrity)) {
    const expectedEtag = text(expectedUpstreamEtag).slice(0, 180);
    const expectedLastModified = text(expectedUpstreamLastModified).slice(0, 180);
    if (expectedEtag && upstreamEtag && !sameEtagValue(expectedEtag, upstreamEtag)) {
      return { ok: false, reason: "proxy-upstream-etag-mismatch" };
    }
    if (
      expectedLastModified &&
      upstreamLastModified &&
      expectedLastModified.toLowerCase() !== upstreamLastModified.toLowerCase()
    ) {
      return { ok: false, reason: "proxy-upstream-last-modified-mismatch" };
    }
  }

  const upstreamLength = Math.max(0, Math.round(numberValue(upstream.headers.get("content-length"), 0)));
  if (upstreamLength > PRIVATE_DOC_PROXY_MAX_BYTES) {
    return { ok: false, reason: "proxy-upstream-content-length-too-large" };
  }
  if (!upstream.body) {
    return { ok: false, reason: "proxy-upstream-empty-body" };
  }

  const contentType = text(upstream.headers.get("content-type"), "application/octet-stream").slice(0, 160);
  const fileName = sanitizeDownloadFileName(docName, "private-document.bin");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Type", contentType || "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
  if (hash) {
    res.setHeader("X-PropertySetu-Private-Doc-Hash", text(hash).slice(0, 128));
  }
  if (upstreamLength > 0) {
    res.setHeader("Content-Length", String(upstreamLength));
  }

  let streamedBytes = 0;
  const contentHasher = crypto.createHash("sha256");
  const limiter = new Transform({
    transform(chunk, _encoding, callback) {
      const size = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk || ""));
      streamedBytes += Math.max(0, size);
      if (streamedBytes > PRIVATE_DOC_PROXY_MAX_BYTES) {
        callback(new Error("proxy-upstream-stream-too-large"));
        return;
      }
      if (size > 0) {
        contentHasher.update(chunk);
      }
      callback(null, chunk);
    }
  });

  try {
    const sourceStream =
      typeof Readable.fromWeb === "function"
        ? Readable.fromWeb(upstream.body)
        : Readable.from(Buffer.from(await upstream.arrayBuffer()));
    await pipeline(sourceStream, limiter, res);
    const contentHash = contentHasher.digest("hex");
    const expectedHash = text(expectedContentHash).toLowerCase();
    const contentIntegrityMatch = !expectedHash || expectedHash === contentHash;
    return {
      ok: true,
      reason: "proxy-streamed",
      streamedBytes,
      contentType,
      contentHash,
      contentIntegrityMatch,
      upstreamEtag,
      upstreamLastModified
    };
  } catch (error) {
    if (!res.headersSent) {
      return { ok: false, reason: text(error?.message, "proxy-stream-failed") };
    }
    try {
      res.destroy(error);
    } catch {
      // no-op
    }
    return { ok: false, reason: text(error?.message, "proxy-stream-failed"), headersSent: true };
  }
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
  const privateDocIntegrityStatus = normalizePrivateDocIntegrityStatus(row.privateDocIntegrityStatus);
  const privateDocIntegrityReviewStatus = normalizePrivateDocIntegrityReviewStatus(
    row.privateDocIntegrityReviewStatus
  );
  const privateDocAccessEpoch = normalizePrivateDocAccessEpoch(row.privateDocAccessEpoch, 1);
  const privateDocEmergencyLockActive = Boolean(row.privateDocEmergencyLockActive);
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
          accessEpoch: privateDocAccessEpoch,
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
    privateDocAccessEpoch,
    privateDocAccessEpochRotatedAt: asIso(row.privateDocAccessEpochRotatedAt),
    privateDocAccessEpochRotatedBy: toId(row.privateDocAccessEpochRotatedBy),
    privateDocAccessEpochRotateReason: text(row.privateDocAccessEpochRotateReason),
    privateDocEmergencyLockActive,
    privateDocEmergencyLockReason: text(row.privateDocEmergencyLockReason),
    privateDocEmergencyLockBy: toId(row.privateDocEmergencyLockBy),
    privateDocEmergencyLockAt: asIso(row.privateDocEmergencyLockAt),
    privateDocEmergencyUnlockBy: toId(row.privateDocEmergencyUnlockBy),
    privateDocEmergencyUnlockAt: asIso(row.privateDocEmergencyUnlockAt),
    privateDocEmergencyUnlockRequestedBy: toId(row.privateDocEmergencyUnlockRequestedBy),
    privateDocEmergencyUnlockRequestedAt: asIso(row.privateDocEmergencyUnlockRequestedAt),
    privateDocEmergencyUnlockRequestReason: text(row.privateDocEmergencyUnlockRequestReason),
    privateDocLastAccessAt: asIso(row.privateDocLastAccessAt),
    privateDocIntegrity:
      isPrivate
        ? {
            status: privateDocIntegrityStatus,
            attestedAt: asIso(row.privateDocAttestedAt),
            contentHash: text(row.privateDocContentHash),
            contentBytes: Math.max(0, numberValue(row.privateDocContentBytes, 0)),
            contentType: text(row.privateDocContentType),
            upstreamEtag: text(row.privateDocUpstreamEtag),
            upstreamLastModified: text(row.privateDocUpstreamLastModified),
            mismatchAt: asIso(row.privateDocIntegrityMismatchAt),
            mismatchReason: text(row.privateDocIntegrityMismatchReason),
            reviewStatus: privateDocIntegrityReviewStatus,
            reviewedBy: toId(row.privateDocIntegrityReviewedBy),
            reviewedAt: asIso(row.privateDocIntegrityReviewedAt),
            reviewReason: text(row.privateDocIntegrityReviewReason),
            threat: parsePrivateDocThreatMismatchReason(text(row.privateDocIntegrityMismatchReason)),
            approvalRequest: {
              requestedBy: toId(row.privateDocIntegrityApprovalRequestedBy),
              requestedAt: asIso(row.privateDocIntegrityApprovalRequestedAt),
              reason: text(row.privateDocIntegrityApprovalRequestReason),
              active: Boolean(
                toId(row.privateDocIntegrityApprovalRequestedBy) &&
                toMs(row.privateDocIntegrityApprovalRequestedAt) &&
                toMs(row.privateDocIntegrityApprovalRequestedAt) + PRIVATE_DOC_INTEGRITY_DUAL_APPROVAL_WINDOW_MS > Date.now()
              )
            },
            reviewHistory: Array.isArray(row.privateDocIntegrityReviewHistory)
              ? row.privateDocIntegrityReviewHistory.slice(-20).map((item) => ({
                  action: text(item?.action),
                  byUserId: toId(item?.byUserId),
                  reason: text(item?.reason),
                  previousStatus: text(item?.previousStatus),
                  nextStatus: text(item?.nextStatus),
                  at: asIso(item?.at)
                }))
              : [],
            decisionAudit: {
              chainHead: text(row.privateDocIntegrityDecisionChainHead),
              lastDecisionHash: text(row.privateDocIntegrityLastDecisionHash),
              lastDecisionId: text(row.privateDocIntegrityLastDecisionId),
              lastDecisionAction: text(row.privateDocIntegrityLastDecisionAction),
              lastDecisionBy: toId(row.privateDocIntegrityLastDecisionBy),
              lastDecisionAt: asIso(row.privateDocIntegrityLastDecisionAt),
              chainLength: Math.max(0, numberValue(row.privateDocIntegrityDecisionChainLength, 0)),
              signatureKeyVersion: text(row.privateDocIntegrityDecisionSignatureVersion)
            }
          }
        : null,
    secureAccess:
      isPrivate && accessEnvelope
        ? {
            token: text(accessEnvelope.token),
            expiresAt: text(accessEnvelope.expiresAt),
            expiresInSec: Math.max(0, numberValue(accessEnvelope.expiresInSec, 0)),
            accessPath: text(accessEnvelope.accessPath),
            maskedUrl: text(accessEnvelope.maskedUrl),
            hash: text(accessEnvelope.hash),
            epoch: privateDocAccessEpoch
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
      privateDocAccessEpoch: 1,
      privateDocAccessEpochRotatedAt: null,
      privateDocAccessEpochRotatedBy: null,
      privateDocAccessEpochRotateReason: "",
      privateDocEmergencyLockActive: false,
      privateDocEmergencyLockReason: "",
      privateDocEmergencyLockBy: null,
      privateDocEmergencyLockAt: null,
      privateDocEmergencyUnlockBy: null,
      privateDocEmergencyUnlockAt: null,
      privateDocEmergencyUnlockRequestedBy: null,
      privateDocEmergencyUnlockRequestedAt: null,
      privateDocEmergencyUnlockRequestReason: "",
      privateDocLastAccessAt: null,
      privateDocContentHash: "",
      privateDocContentBytes: 0,
      privateDocContentType: "",
      privateDocUpstreamEtag: "",
      privateDocUpstreamLastModified: "",
      privateDocAttestedAt: null,
      privateDocIntegrityStatus: isPrivate ? "unknown" : "verified",
      privateDocIntegrityMismatchAt: null,
      privateDocIntegrityMismatchReason: "",
      privateDocIntegrityReviewStatus: "none",
      privateDocIntegrityReviewedBy: null,
      privateDocIntegrityReviewedAt: null,
      privateDocIntegrityReviewReason: "",
      privateDocIntegrityApprovalRequestedBy: null,
      privateDocIntegrityApprovalRequestedAt: null,
      privateDocIntegrityApprovalRequestReason: "",
      privateDocIntegrityReviewHistory: [],
      privateDocIntegrityDecisionChainHead: "",
      privateDocIntegrityLastDecisionHash: "",
      privateDocIntegrityLastDecisionId: "",
      privateDocIntegrityLastDecisionAction: "",
      privateDocIntegrityLastDecisionBy: null,
      privateDocIntegrityLastDecisionAt: null,
      privateDocIntegrityDecisionChainLength: 0,
      privateDocIntegrityDecisionSignatureVersion: "",
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

    let rows = buildUploadRows(req, files);
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

    let privateDocThreatScans = [];
    if (PRIVATE_DOC_UPLOAD_THREAT_SCAN_ENABLED) {
      rows = rows.map((row) => {
        if (!Boolean(row?.isPrivate)) return row;
        const scan = evaluatePrivateDocUploadThreat(row);
        privateDocThreatScans.push({
          name: text(row?.name),
          status: scan.status,
          score: Math.max(0, Math.round(numberValue(scan.score, 0))),
          signals: Array.isArray(scan.signals) ? scan.signals : []
        });
        if (scan.status === "clear") return row;

        const nowIso = new Date().toISOString();
        const nextReviewStatus = scan.status === "quarantined" ? "quarantined" : "pending";
        return {
          ...row,
          privateDocIntegrityStatus: "mismatch",
          privateDocIntegrityReviewStatus: nextReviewStatus,
          privateDocIntegrityMismatchAt: nowIso,
          privateDocIntegrityMismatchReason: formatPrivateDocThreatMismatchReason({
            score: scan.score,
            signals: scan.signals
          }),
          privateDocIntegrityReviewReason: "auto-upload-threat-scan",
          privateDocIntegrityReviewedBy: null,
          privateDocIntegrityReviewedAt: null,
          privateDocIntegrityApprovalRequestedBy: null,
          privateDocIntegrityApprovalRequestedAt: null,
          privateDocIntegrityApprovalRequestReason: "",
          privateDocIntegrityReviewHistory: [
            {
              action: "auto-mismatch",
              byUserId: null,
              reason: `upload-threat-scan(score:${Math.max(
                0,
                Math.round(numberValue(scan.score, 0))
              )})`,
              previousStatus: "unknown:none",
              nextStatus: `mismatch:${nextReviewStatus}`,
              at: nowIso
            }
          ]
        };
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
      threatScan: {
        enabled: Boolean(PRIVATE_DOC_UPLOAD_THREAT_SCAN_ENABLED),
        pendingScore: PRIVATE_DOC_UPLOAD_THREAT_PENDING_SCORE,
        quarantineScore: PRIVATE_DOC_UPLOAD_THREAT_QUARANTINE_SCORE,
        flaggedCount: privateDocThreatScans.filter((item) => item.status !== "clear").length,
        quarantinedCount: privateDocThreatScans.filter((item) => item.status === "quarantined").length
      },
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

async function rotatePrivateDocAccessEpoch({
  uploadId = "",
  nextEpoch = 1,
  rotatedBy = "",
  rotatedAt = "",
  rotateReason = ""
} = {}) {
  const id = text(uploadId);
  if (!id) return;
  const normalizedEpoch = normalizePrivateDocAccessEpoch(nextEpoch, 1);
  const normalizedRotatedAt = asIso(rotatedAt) || new Date().toISOString();

  if (proRuntime.dbConnected) {
    if (!mongoose.Types.ObjectId.isValid(id)) return;
    await CoreUpload.findByIdAndUpdate(id, {
      $set: {
        privateDocAccessEpoch: normalizedEpoch,
        privateDocAccessEpochRotatedAt: new Date(normalizedRotatedAt),
        privateDocAccessEpochRotatedBy: toObjectIdOrNull(rotatedBy),
        privateDocAccessEpochRotateReason: text(rotateReason).slice(0, 240)
      }
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
    privateDocAccessEpoch: normalizedEpoch,
    privateDocAccessEpochRotatedAt: normalizedRotatedAt,
    privateDocAccessEpochRotatedBy: text(rotatedBy),
    privateDocAccessEpochRotateReason: text(rotateReason).slice(0, 240)
  };
}

async function updatePrivateDocEmergencyLockState({
  uploadId = "",
  lockActive = false,
  lockReason = "",
  lockBy = "",
  lockAt = "",
  unlockBy = "",
  unlockAt = "",
  clearUnlockRequest = true
} = {}) {
  const id = text(uploadId);
  if (!id) return;
  const normalizedLockAt = asIso(lockAt);
  const normalizedUnlockAt = asIso(unlockAt);

  if (proRuntime.dbConnected) {
    if (!mongoose.Types.ObjectId.isValid(id)) return;
    const updateSet = {
      privateDocEmergencyLockActive: Boolean(lockActive),
      privateDocEmergencyLockReason: Boolean(lockActive)
        ? text(lockReason).slice(0, 240)
        : "",
      privateDocEmergencyLockBy: Boolean(lockActive) ? toObjectIdOrNull(lockBy) : null,
      privateDocEmergencyLockAt: Boolean(lockActive) && normalizedLockAt
        ? new Date(normalizedLockAt)
        : null,
      privateDocEmergencyUnlockBy: !Boolean(lockActive) ? toObjectIdOrNull(unlockBy) : null,
      privateDocEmergencyUnlockAt: !Boolean(lockActive) && normalizedUnlockAt
        ? new Date(normalizedUnlockAt)
        : null
    };
    if (clearUnlockRequest) {
      updateSet.privateDocEmergencyUnlockRequestedBy = null;
      updateSet.privateDocEmergencyUnlockRequestedAt = null;
      updateSet.privateDocEmergencyUnlockRequestReason = "";
    }
    await CoreUpload.findByIdAndUpdate(id, {
      $set: updateSet
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
    privateDocEmergencyLockActive: Boolean(lockActive),
    privateDocEmergencyLockReason: Boolean(lockActive)
      ? text(lockReason).slice(0, 240)
      : "",
    privateDocEmergencyLockBy: Boolean(lockActive) ? text(lockBy) : null,
    privateDocEmergencyLockAt: Boolean(lockActive) ? (normalizedLockAt || new Date().toISOString()) : null,
    privateDocEmergencyUnlockBy: !Boolean(lockActive) ? text(unlockBy) : null,
    privateDocEmergencyUnlockAt: !Boolean(lockActive) ? (normalizedUnlockAt || new Date().toISOString()) : null,
    privateDocEmergencyUnlockRequestedBy: clearUnlockRequest ? null : previous.privateDocEmergencyUnlockRequestedBy,
    privateDocEmergencyUnlockRequestedAt: clearUnlockRequest ? null : previous.privateDocEmergencyUnlockRequestedAt,
    privateDocEmergencyUnlockRequestReason: clearUnlockRequest ? "" : previous.privateDocEmergencyUnlockRequestReason
  };
}

async function markPrivateDocEmergencyUnlockRequest({
  uploadId = "",
  requestedBy = "",
  requestedAt = "",
  requestReason = ""
} = {}) {
  const id = text(uploadId);
  if (!id) return;
  const normalizedRequestedAt = asIso(requestedAt);

  if (proRuntime.dbConnected) {
    if (!mongoose.Types.ObjectId.isValid(id)) return;
    await CoreUpload.findByIdAndUpdate(id, {
      $set: {
        privateDocEmergencyUnlockRequestedBy: toObjectIdOrNull(requestedBy),
        privateDocEmergencyUnlockRequestedAt: normalizedRequestedAt ? new Date(normalizedRequestedAt) : null,
        privateDocEmergencyUnlockRequestReason: text(requestReason).slice(0, 240)
      }
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
    privateDocEmergencyUnlockRequestedBy: text(requestedBy),
    privateDocEmergencyUnlockRequestedAt: normalizedRequestedAt,
    privateDocEmergencyUnlockRequestReason: text(requestReason).slice(0, 240)
  };
}

async function markPrivateDocIntegrity(uploadId = "", patch = {}) {
  const id = text(uploadId);
  if (!id || !patch || typeof patch !== "object" || Array.isArray(patch)) return;
  const reviewHistoryInput =
    patch.privateDocIntegrityReviewHistoryEvent &&
    typeof patch.privateDocIntegrityReviewHistoryEvent === "object" &&
    !Array.isArray(patch.privateDocIntegrityReviewHistoryEvent)
      ? patch.privateDocIntegrityReviewHistoryEvent
      : null;
  const reviewAction = text(reviewHistoryInput?.action).toLowerCase();
  const allowedHistoryActions = new Set([
    "auto-mismatch",
    "auto-verified",
    "approval-requested",
    "approval-confirmed",
    "approved",
    "quarantined",
    "reset"
  ]);
  const reviewHistoryEvent = reviewAction && allowedHistoryActions.has(reviewAction)
    ? {
        action: reviewAction,
        byUserId: toObjectIdOrNull(reviewHistoryInput?.byUserId),
        reason: text(reviewHistoryInput?.reason).slice(0, 400),
        previousStatus: text(reviewHistoryInput?.previousStatus).slice(0, 40),
        nextStatus: text(reviewHistoryInput?.nextStatus).slice(0, 40),
        at: reviewHistoryInput?.at ? new Date(reviewHistoryInput.at) : new Date()
      }
    : null;
  const next = {
    privateDocContentHash: text(patch.privateDocContentHash),
    privateDocContentBytes: Math.max(0, numberValue(patch.privateDocContentBytes, 0)),
    privateDocContentType: text(patch.privateDocContentType),
    privateDocUpstreamEtag: text(patch.privateDocUpstreamEtag),
    privateDocUpstreamLastModified: text(patch.privateDocUpstreamLastModified),
    privateDocAttestedAt: patch.privateDocAttestedAt ? new Date(patch.privateDocAttestedAt) : null,
    privateDocIntegrityStatus: normalizePrivateDocIntegrityStatus(patch.privateDocIntegrityStatus),
    privateDocIntegrityReviewStatus: normalizePrivateDocIntegrityReviewStatus(
      patch.privateDocIntegrityReviewStatus
    ),
    privateDocIntegrityReviewedBy: toObjectIdOrNull(patch.privateDocIntegrityReviewedBy),
    privateDocIntegrityReviewedAt: patch.privateDocIntegrityReviewedAt
      ? new Date(patch.privateDocIntegrityReviewedAt)
      : null,
    privateDocIntegrityReviewReason: text(patch.privateDocIntegrityReviewReason).slice(0, 600),
    privateDocIntegrityApprovalRequestedBy: toObjectIdOrNull(
      patch.privateDocIntegrityApprovalRequestedBy
    ),
    privateDocIntegrityApprovalRequestedAt: patch.privateDocIntegrityApprovalRequestedAt
      ? new Date(patch.privateDocIntegrityApprovalRequestedAt)
      : null,
    privateDocIntegrityApprovalRequestReason: text(
      patch.privateDocIntegrityApprovalRequestReason
    ).slice(0, 600),
    privateDocIntegrityMismatchAt: patch.privateDocIntegrityMismatchAt
      ? new Date(patch.privateDocIntegrityMismatchAt)
      : null,
    privateDocIntegrityMismatchReason: text(patch.privateDocIntegrityMismatchReason),
    privateDocIntegrityDecisionChainHead: text(patch.privateDocIntegrityDecisionChainHead),
    privateDocIntegrityLastDecisionHash: text(patch.privateDocIntegrityLastDecisionHash),
    privateDocIntegrityLastDecisionId: text(patch.privateDocIntegrityLastDecisionId),
    privateDocIntegrityLastDecisionAction: normalizePrivateDocIntegrityDecisionActionForPatch(
      patch.privateDocIntegrityLastDecisionAction
    ),
    privateDocIntegrityLastDecisionBy: toObjectIdOrNull(patch.privateDocIntegrityLastDecisionBy),
    privateDocIntegrityLastDecisionAt: patch.privateDocIntegrityLastDecisionAt
      ? new Date(patch.privateDocIntegrityLastDecisionAt)
      : null,
    privateDocIntegrityDecisionChainLength: Math.max(
      0,
      Math.round(numberValue(patch.privateDocIntegrityDecisionChainLength, 0))
    ),
    privateDocIntegrityDecisionSignatureVersion: text(
      patch.privateDocIntegrityDecisionSignatureVersion
    ).slice(0, 24)
  };

  if (proRuntime.dbConnected) {
    if (!mongoose.Types.ObjectId.isValid(id)) return;
    const update = {
      $set: next
    };
    if (reviewHistoryEvent) {
      update.$push = {
        privateDocIntegrityReviewHistory: {
          $each: [reviewHistoryEvent],
          $slice: -120
        }
      };
    }
    await CoreUpload.findByIdAndUpdate(id, update);
    return;
  }

  const index = proMemoryStore.coreUploads.findIndex(
    (item) => toId(item._id || item.id) === id
  );
  if (index < 0) return;
  const previous = proMemoryStore.coreUploads[index] || {};
  const previousHistory = Array.isArray(previous.privateDocIntegrityReviewHistory)
    ? previous.privateDocIntegrityReviewHistory
    : [];
  const nextHistory = reviewHistoryEvent
    ? [...previousHistory, {
        ...reviewHistoryEvent,
        byUserId: toId(reviewHistoryEvent.byUserId)
      }].slice(-120)
    : previousHistory;
  proMemoryStore.coreUploads[index] = {
    ...previous,
    ...next,
    privateDocAttestedAt: next.privateDocAttestedAt ? next.privateDocAttestedAt.toISOString() : null,
    privateDocIntegrityReviewedBy: toId(next.privateDocIntegrityReviewedBy),
    privateDocIntegrityReviewedAt: next.privateDocIntegrityReviewedAt
      ? next.privateDocIntegrityReviewedAt.toISOString()
      : null,
    privateDocIntegrityApprovalRequestedBy: toId(next.privateDocIntegrityApprovalRequestedBy),
    privateDocIntegrityApprovalRequestedAt: next.privateDocIntegrityApprovalRequestedAt
      ? next.privateDocIntegrityApprovalRequestedAt.toISOString()
      : null,
    privateDocIntegrityMismatchAt: next.privateDocIntegrityMismatchAt
      ? next.privateDocIntegrityMismatchAt.toISOString()
      : null,
    privateDocIntegrityLastDecisionBy: toId(next.privateDocIntegrityLastDecisionBy),
    privateDocIntegrityLastDecisionAt: next.privateDocIntegrityLastDecisionAt
      ? next.privateDocIntegrityLastDecisionAt.toISOString()
      : null,
    privateDocIntegrityReviewHistory: nextHistory
  };
}

function buildPrivateDocIntegrityDecisionChainPatchFromUpload(uploadRow = {}) {
  return {
    privateDocIntegrityDecisionChainHead: text(uploadRow?.privateDocIntegrityDecisionChainHead),
    privateDocIntegrityLastDecisionHash: text(uploadRow?.privateDocIntegrityLastDecisionHash),
    privateDocIntegrityLastDecisionId: text(uploadRow?.privateDocIntegrityLastDecisionId),
    privateDocIntegrityLastDecisionAction: text(uploadRow?.privateDocIntegrityLastDecisionAction),
    privateDocIntegrityLastDecisionBy: toId(uploadRow?.privateDocIntegrityLastDecisionBy),
    privateDocIntegrityLastDecisionAt: asIso(uploadRow?.privateDocIntegrityLastDecisionAt),
    privateDocIntegrityDecisionChainLength: Math.max(
      0,
      Math.round(numberValue(uploadRow?.privateDocIntegrityDecisionChainLength, 0))
    ),
    privateDocIntegrityDecisionSignatureVersion: text(
      uploadRow?.privateDocIntegrityDecisionSignatureVersion
    )
  };
}

function buildPrivateDocIntegrityDecisionChainPatchFromAudit(audit = {}, fallback = {}) {
  return {
    privateDocIntegrityDecisionChainHead: text(
      audit?.decisionHash,
      text(fallback?.privateDocIntegrityDecisionChainHead)
    ),
    privateDocIntegrityLastDecisionHash: text(
      audit?.decisionHash,
      text(fallback?.privateDocIntegrityLastDecisionHash)
    ),
    privateDocIntegrityLastDecisionId: text(
      audit?.decisionId,
      text(fallback?.privateDocIntegrityLastDecisionId)
    ),
    privateDocIntegrityLastDecisionAction: normalizePrivateDocIntegrityDecisionActionForPatch(
      text(audit?.action, fallback?.privateDocIntegrityLastDecisionAction)
    ),
    privateDocIntegrityLastDecisionBy: text(
      audit?.confirmedBy || audit?.requestedBy || fallback?.privateDocIntegrityLastDecisionBy
    ),
    privateDocIntegrityLastDecisionAt: asIso(
      audit?.occurredAt || fallback?.privateDocIntegrityLastDecisionAt
    ),
    privateDocIntegrityDecisionChainLength: Math.max(
      0,
      Math.round(
        numberValue(
          audit?.chainIndex,
          numberValue(fallback?.privateDocIntegrityDecisionChainLength, 0)
        )
      )
    ),
    privateDocIntegrityDecisionSignatureVersion: text(
      audit?.signatureKeyVersion,
      text(fallback?.privateDocIntegrityDecisionSignatureVersion)
    )
  };
}

function buildPrivateDocIntegrityDecisionAuditSummary(audit = {}) {
  if (!audit || typeof audit !== "object") return null;
  const decisionId = text(audit.decisionId);
  if (!decisionId) return null;
  return {
    decisionId,
    decisionHash: text(audit.decisionHash),
    chainIndex: Math.max(1, Math.round(numberValue(audit.chainIndex, 1))),
    action: text(audit.action),
    phase: text(audit.phase, "single"),
    occurredAt: asIso(audit.occurredAt),
    signatureKeyVersion: text(audit.signatureKeyVersion)
  };
}

function buildPrivateDocStreamEnvelope({
  sourceUrl = "",
  ownerId = "",
  propertyId = "",
  uploadId = "",
  docId = "",
  category = "",
  name = "",
  accessEpoch = 1,
  viewerId = "",
  viewerRole = "",
  requestIp = "",
  requestUserAgent = ""
} = {}) {
  if (!PRIVATE_DOC_PROXY_ENABLED) return null;
  return buildPrivateDocAccessEnvelope({
    sourceUrl,
    ownerId,
    propertyId,
    uploadId,
    docId,
    category,
    name,
    accessEpoch: normalizePrivateDocAccessEpoch(accessEpoch, 1),
    viewerId,
    viewerRole,
    requestIp,
    requestUserAgent,
    purpose: "stream",
    accessPath: PRIVATE_DOC_STREAM_PATH,
    ttlSec: PRIVATE_DOC_STREAM_TOKEN_TTL_SEC
  });
}

export async function resolveCorePrivateDocAccess(req, res, next) {
  try {
    const token = text(req.body?.token || req.query?.token);
    const requestIp = getClientIp(req);
    const requestUserAgent = text(req.headers?.["user-agent"]);
    const currentRole = text(req.coreUser?.role, "buyer").toLowerCase();
    const actorId = text(req.coreUser?.id);
    const actorRole = currentRole;
    const actorIsAdmin = actorRole === "admin";
    const contextBindingEnforced = PRIVATE_DOC_CONTEXT_BINDING_REQUIRED &&
      !(PRIVATE_DOC_CONTEXT_BINDING_ADMIN_BYPASS && currentRole === "admin");
    const shieldStatus = await evaluatePrivateDocAccessShieldStatus({
      userId: actorId,
      role: actorRole,
      ip: requestIp
    });
    if (shieldStatus.active) {
      res.setHeader("Retry-After", String(Math.max(1, Math.round(numberValue(shieldStatus.remainingSec, 1)))));
      recordPrivateDocAccessEvent({
        userId: actorId,
        role: actorRole,
        reason: "private-doc-shield-blocked",
        ip: requestIp,
        userAgent: requestUserAgent.slice(0, 240),
        source: "shield-block",
        shieldBlocked: true,
        shieldReason: text(shieldStatus.reason),
        shieldRemainingSec: Math.max(1, Math.round(numberValue(shieldStatus.remainingSec, 1)))
      });
      return res.status(429).json({
        success: false,
        message: "Private document access is temporarily blocked by security shield.",
        reason: text(shieldStatus.reason, "private-doc-shield-blocked"),
        retryAfterSec: Math.max(1, Math.round(numberValue(shieldStatus.remainingSec, 1)))
      });
    }
    if (!token) {
      recordPrivateDocAccessEvent({
        userId: actorId,
        role: actorRole,
        reason: "missing-token",
        replayGuardEnabled: Boolean(PRIVATE_DOC_TOKEN_REPLAY_GUARD_ENABLED),
        ip: requestIp,
        userAgent: requestUserAgent.slice(0, 240),
        source: "token-missing"
      });
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
    const tokenAccessEpoch = normalizePrivateDocAccessEpoch(payload.epoch, 1);
    let sourceUrl = text(payload.sourceUrl);
    let ownerId = text(payload.ownerId);
    let propertyId = text(payload.propertyId);
    let docName = text(payload.name);
    let docCategory = text(payload.category);
    let uploadAccessEpoch = tokenAccessEpoch;

    if (uploadId) {
      const uploadRow = await findUploadById(uploadId);
      if (!uploadRow) {
        recordPrivateDocAccessEvent({
          userId: actorId,
          role: actorRole,
          uploadId,
          tokenId,
          tokenFingerprint,
          replayGuardEnabled: Boolean(PRIVATE_DOC_TOKEN_REPLAY_GUARD_ENABLED),
          reason: "upload-not-found",
          ip: requestIp,
          userAgent: requestUserAgent.slice(0, 240),
          source: "upload"
        });
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
        recordPrivateDocAccessEvent({
          userId: actorId,
          role: actorRole,
          uploadId,
          tokenId,
          tokenFingerprint,
          replayGuardEnabled: Boolean(PRIVATE_DOC_TOKEN_REPLAY_GUARD_ENABLED),
          reason: "upload-not-private",
          ip: requestIp,
          userAgent: requestUserAgent.slice(0, 240),
          source: "upload"
        });
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
      uploadAccessEpoch = normalizePrivateDocAccessEpoch(uploadRow?.privateDocAccessEpoch, 1);
      const resolvedUploadId = toId(uploadRow?._id || uploadRow?.id);
      if (!sameId(uploadId, resolvedUploadId)) {
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
          reason: "token-upload-binding-mismatch",
          ip: requestIp,
          userAgent: requestUserAgent.slice(0, 240),
          source: "upload"
        });
        return res.status(409).json({
          success: false,
          message: "Private document token upload binding mismatch."
        });
      }
      if (text(payload.ownerId) && !sameId(payload.ownerId, ownerId)) {
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
          reason: "token-owner-binding-mismatch",
          ip: requestIp,
          userAgent: requestUserAgent.slice(0, 240),
          source: "upload"
        });
        return res.status(409).json({
          success: false,
          message: "Private document token owner binding mismatch."
        });
      }
      if (text(payload.propertyId) && !sameId(payload.propertyId, propertyId)) {
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
          reason: "token-property-binding-mismatch",
          ip: requestIp,
          userAgent: requestUserAgent.slice(0, 240),
          source: "upload"
        });
        return res.status(409).json({
          success: false,
          message: "Private document token property binding mismatch."
        });
      }
      if (text(payload.category) && text(payload.category).toLowerCase() !== text(docCategory).toLowerCase()) {
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
          reason: "token-category-binding-mismatch",
          ip: requestIp,
          userAgent: requestUserAgent.slice(0, 240),
          source: "upload"
        });
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
          reason: "document-integrity-validation-failed",
          ip: requestIp,
          userAgent: requestUserAgent.slice(0, 240),
          source: "upload"
        });
        return res.status(409).json({
          success: false,
          message: "Document integrity validation failed."
        });
      }
      if (
        Boolean(uploadRow?.privateDocEmergencyLockActive) &&
        !(actorIsAdmin && PRIVATE_DOC_EMERGENCY_LOCK_ADMIN_BYPASS)
      ) {
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
          reason: "private-doc-emergency-lock-active",
          ip: requestIp,
          userAgent: requestUserAgent.slice(0, 240),
          source: "upload"
        });
        return res.status(423).json({
          success: false,
          message: "Private document access is locked by emergency security control.",
          reason: "private-doc-emergency-lock-active"
        });
      }
      if (tokenAccessEpoch !== uploadAccessEpoch) {
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
          reason: "private-doc-access-epoch-revoked",
          ip: requestIp,
          userAgent: requestUserAgent.slice(0, 240),
          source: "upload"
        });
        return res.status(409).json({
          success: false,
          message: "Private document access token has been revoked. Request a fresh token.",
          reason: "private-doc-access-epoch-revoked"
        });
      }
      const uploadIntegrityStatus = normalizePrivateDocIntegrityStatus(
        uploadRow?.privateDocIntegrityStatus
      );
      const uploadIntegrityReviewStatus = normalizePrivateDocIntegrityReviewStatus(
        uploadRow?.privateDocIntegrityReviewStatus
      );
      if (
        PRIVATE_DOC_CONTENT_ATTEST_ENABLED &&
        PRIVATE_DOC_INTEGRITY_BLOCK_ON_MISMATCH &&
        uploadIntegrityStatus === "mismatch" &&
        uploadIntegrityReviewStatus !== "approved" &&
        !(actorIsAdmin && PRIVATE_DOC_INTEGRITY_MISMATCH_ADMIN_BYPASS)
      ) {
        const threatMeta = parsePrivateDocThreatMismatchReason(
          text(uploadRow?.privateDocIntegrityMismatchReason)
        );
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
          reason: "private-doc-integrity-mismatch-blocked",
          ip: requestIp,
          userAgent: requestUserAgent.slice(0, 240),
          source: "upload",
          threatDetected: Boolean(threatMeta.active),
          threatScore: Math.max(0, Math.round(numberValue(threatMeta.score, 0)))
        });
        return res.status(423).json({
          success: false,
          message: threatMeta.active
            ? "Private document is blocked by upload threat scan. Admin approval required."
            : "Private document is temporarily locked due to integrity mismatch. Admin review required.",
          reason: threatMeta.active
            ? "private-doc-upload-threat-review-pending"
            : "private-doc-integrity-mismatch-blocked"
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
      const streamEnvelope = buildPrivateDocStreamEnvelope({
        sourceUrl,
        ownerId,
        propertyId,
        uploadId: normalizedUpload.id || uploadId,
        docId: text(payload.docId),
        category: docCategory,
        name: docName,
        accessEpoch: uploadAccessEpoch,
        viewerId: actorId,
        viewerRole: actorRole,
        requestIp,
        requestUserAgent
      });
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
          accessEpoch: uploadAccessEpoch,
          accessExpiresAt: text(payload.expiresAt),
          url: PRIVATE_DOC_RAW_URL_EXPOSURE_ALLOWED ? sourceUrl : buildMaskedPrivateDocUrl(sourceUrl),
          secureStream: streamEnvelope
            ? {
                token: text(streamEnvelope.token),
                accessPath: text(streamEnvelope.accessPath, PRIVATE_DOC_STREAM_PATH),
                expiresAt: text(streamEnvelope.expiresAt),
                expiresInSec: Math.max(0, numberValue(streamEnvelope.expiresInSec, 0)),
                maskedUrl: text(streamEnvelope.maskedUrl),
                hash: text(streamEnvelope.hash),
                epoch: uploadAccessEpoch
              }
            : null
        }
      });
    }

    if (!sourceUrl) {
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
        reason: "source-unavailable",
        ip: requestIp,
        userAgent: requestUserAgent.slice(0, 240),
        source: "inline-private-doc"
      });
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
    const inlineStreamEnvelope = buildPrivateDocStreamEnvelope({
      sourceUrl,
      ownerId,
      propertyId,
      uploadId: "",
      docId: text(payload.docId),
      category: docCategory,
      name: docName,
      accessEpoch: tokenAccessEpoch,
      viewerId: actorId,
      viewerRole: actorRole,
      requestIp,
      requestUserAgent
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
        accessEpoch: tokenAccessEpoch,
        accessExpiresAt: text(payload.expiresAt),
        url: PRIVATE_DOC_RAW_URL_EXPOSURE_ALLOWED ? sourceUrl : buildMaskedPrivateDocUrl(sourceUrl),
        secureStream: inlineStreamEnvelope
          ? {
              token: text(inlineStreamEnvelope.token),
              accessPath: text(inlineStreamEnvelope.accessPath, PRIVATE_DOC_STREAM_PATH),
              expiresAt: text(inlineStreamEnvelope.expiresAt),
              expiresInSec: Math.max(0, numberValue(inlineStreamEnvelope.expiresInSec, 0)),
              maskedUrl: text(inlineStreamEnvelope.maskedUrl),
              hash: text(inlineStreamEnvelope.hash),
              epoch: tokenAccessEpoch
            }
          : null
      }
    });
  } catch (error) {
    return next(error);
  }
}

export async function revokeCorePrivateDocAccess(req, res, next) {
  try {
    const uploadIdInput = text(req.body?.uploadId || req.params?.uploadId || req.query?.uploadId);
    const actorId = text(req.coreUser?.id);
    const actorRole = text(req.coreUser?.role, "buyer").toLowerCase();
    const actorIsAdmin = actorRole === "admin";
    const requestIp = getClientIp(req);
    const requestUserAgent = text(req.headers?.["user-agent"]);
    const reasonDefault = actorIsAdmin
      ? "admin-revoked-private-doc-access"
      : "owner-revoked-private-doc-access";
    const reason = text(req.body?.reason, reasonDefault);

    if (!uploadIdInput) {
      return res.status(400).json({
        success: false,
        message: "uploadId is required."
      });
    }
    if (reason.length < PRIVATE_DOC_ACCESS_EPOCH_ROTATE_REASON_MIN) {
      return res.status(400).json({
        success: false,
        message: `reason must be at least ${PRIVATE_DOC_ACCESS_EPOCH_ROTATE_REASON_MIN} characters.`
      });
    }

    const uploadRow = await findUploadById(uploadIdInput);
    if (!uploadRow) {
      return res.status(404).json({
        success: false,
        message: "Upload record not found."
      });
    }
    if (!Boolean(uploadRow?.isPrivate)) {
      return res.status(400).json({
        success: false,
        message: "Token revocation is only supported for private documents."
      });
    }

    const authorized = await canActorAccessPrivateUpload({
      actorId,
      actorRole,
      uploadRow
    });
    if (!authorized) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to revoke this private document access."
      });
    }

    const resolvedUploadId = toId(uploadRow?._id || uploadRow?.id) || uploadIdInput;
    const previousEpoch = normalizePrivateDocAccessEpoch(uploadRow?.privateDocAccessEpoch, 1);
    const currentEpoch = previousEpoch + 1;
    const nowIso = new Date().toISOString();
    await rotatePrivateDocAccessEpoch({
      uploadId: resolvedUploadId,
      nextEpoch: currentEpoch,
      rotatedBy: actorId,
      rotatedAt: nowIso,
      rotateReason: reason
    });

    const updatedRow = await findUploadById(resolvedUploadId);
    const normalized = normalizeUpload(updatedRow || uploadRow, {
      ...req.coreUser,
      clientIp: requestIp,
      userAgent: requestUserAgent
    }) || {};
    const ownerId = text(normalized.userId || toId(uploadRow?.userId));
    const propertyId = text(normalized.propertyId || toId(uploadRow?.propertyId));
    const docCategory = text(normalized.category || uploadRow?.category);
    const privateDocHash = text(
      normalized.privateDocHash || uploadRow?.privateDocHash || hashPrivateDocSourceUrl(text(uploadRow?.url))
    );

    recordPrivateDocAccessEvent({
      userId: actorId,
      role: actorRole,
      ownerId,
      propertyId,
      uploadId: resolvedUploadId,
      docId: text(normalized.id || resolvedUploadId),
      category: docCategory,
      hash: privateDocHash,
      reason: "private-doc-access-epoch-rotated",
      ip: requestIp,
      userAgent: requestUserAgent.slice(0, 240),
      source: "access-epoch-rotate"
    });

    return res.json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      rotation: {
        uploadId: resolvedUploadId,
        previousEpoch,
        currentEpoch: normalizePrivateDocAccessEpoch(normalized.privateDocAccessEpoch, currentEpoch),
        rotatedAt: asIso(normalized.privateDocAccessEpochRotatedAt) || nowIso,
        rotatedBy: text(normalized.privateDocAccessEpochRotatedBy, actorId),
        reason
      },
      doc: {
        uploadId: resolvedUploadId,
        ownerId,
        propertyId,
        name: text(normalized.name || uploadRow?.name),
        category: docCategory,
        privateDocHash,
        accessEpoch: normalizePrivateDocAccessEpoch(normalized.privateDocAccessEpoch, currentEpoch),
        accessExpiresAt: text(normalized?.secureAccess?.expiresAt),
        secureAccess: normalized?.secureAccess
          ? {
              token: text(normalized.secureAccess.token),
              accessPath: text(normalized.secureAccess.accessPath),
              expiresAt: text(normalized.secureAccess.expiresAt),
              expiresInSec: Math.max(0, numberValue(normalized.secureAccess.expiresInSec, 0)),
              maskedUrl: text(normalized.secureAccess.maskedUrl),
              hash: text(normalized.secureAccess.hash),
              epoch: normalizePrivateDocAccessEpoch(normalized.privateDocAccessEpoch, currentEpoch)
            }
          : null
      }
    });
  } catch (error) {
    return next(error);
  }
}

export async function setCorePrivateDocEmergencyAccessLock(req, res, next) {
  try {
    const uploadIdInput = text(req.body?.uploadId || req.params?.uploadId || req.query?.uploadId);
    const action = normalizePrivateDocEmergencyLockAction(
      req.body?.action || req.query?.action || req.params?.action
    );
    const actorId = text(req.coreUser?.id);
    const actorRole = text(req.coreUser?.role, "buyer").toLowerCase();
    const actorIsAdmin = actorRole === "admin";
    const requestIp = getClientIp(req);
    const requestUserAgent = text(req.headers?.["user-agent"]);
    const reasonDefault = action === "lock"
      ? (actorIsAdmin
          ? "admin-emergency-locked-private-doc-access"
          : "owner-emergency-locked-private-doc-access")
      : (actorIsAdmin
          ? "admin-emergency-unlocked-private-doc-access"
          : "owner-emergency-unlocked-private-doc-access");
    const reason = text(req.body?.reason, reasonDefault);
    const unlockApprove =
      String(req.body?.unlockApprove || req.query?.unlockApprove || "false")
        .trim()
        .toLowerCase() === "true";
    const forceRotate =
      String(req.body?.forceRotate || req.query?.forceRotate || "false")
        .trim()
        .toLowerCase() === "true";

    if (!uploadIdInput) {
      return res.status(400).json({
        success: false,
        message: "uploadId is required."
      });
    }
    if (reason.length < PRIVATE_DOC_EMERGENCY_LOCK_REASON_MIN) {
      return res.status(400).json({
        success: false,
        message: `reason must be at least ${PRIVATE_DOC_EMERGENCY_LOCK_REASON_MIN} characters.`
      });
    }

    const uploadRow = await findUploadById(uploadIdInput);
    if (!uploadRow) {
      return res.status(404).json({
        success: false,
        message: "Upload record not found."
      });
    }
    if (!Boolean(uploadRow?.isPrivate)) {
      return res.status(400).json({
        success: false,
        message: "Emergency lock is only supported for private documents."
      });
    }

    const authorized = await canActorAccessPrivateUpload({
      actorId,
      actorRole,
      uploadRow
    });
    if (!authorized) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to change emergency lock for this private document."
      });
    }
    if (action === "unlock" && !actorIsAdmin) {
      return res.status(403).json({
        success: false,
        message: "Only admin can unlock emergency locked private documents."
      });
    }

    const resolvedUploadId = toId(uploadRow?._id || uploadRow?.id) || uploadIdInput;
    const previousLockActive = Boolean(uploadRow?.privateDocEmergencyLockActive);
    const targetLockActive = action === "lock";
    const shouldRotate = forceRotate || previousLockActive !== targetLockActive;

    if (!shouldRotate && previousLockActive === targetLockActive) {
      return res.status(409).json({
        success: false,
        message: targetLockActive
          ? "Private document is already emergency locked."
          : "Private document is already emergency unlocked."
      });
    }

    const nowTs = Date.now();
    const unlockRequestState = getPrivateDocEmergencyUnlockRequestState(uploadRow, nowTs);
    const nowIso = new Date().toISOString();
    const previousEpoch = normalizePrivateDocAccessEpoch(uploadRow?.privateDocAccessEpoch, 1);

    if (
      action === "unlock" &&
      previousLockActive &&
      PRIVATE_DOC_EMERGENCY_UNLOCK_DUAL_ADMIN_REQUIRED
    ) {
      if (!unlockRequestState.active) {
        await markPrivateDocEmergencyUnlockRequest({
          uploadId: resolvedUploadId,
          requestedBy: actorId,
          requestedAt: nowIso,
          requestReason: reason
        });
        recordPrivateDocAccessEvent({
          userId: actorId,
          role: actorRole,
          ownerId: toId(uploadRow?.userId),
          propertyId: toId(uploadRow?.propertyId),
          uploadId: resolvedUploadId,
          docId: resolvedUploadId,
          category: text(uploadRow?.category),
          hash: text(uploadRow?.privateDocHash, hashPrivateDocSourceUrl(text(uploadRow?.url))),
          reason: "private-doc-emergency-unlock-requested",
          ip: requestIp,
          userAgent: requestUserAgent.slice(0, 240),
          source: "access-emergency-lock"
        });
        const requestedRow = await findUploadById(resolvedUploadId);
        const normalizedRequested = normalizeUpload(requestedRow || uploadRow, {
          ...req.coreUser,
          clientIp: requestIp,
          userAgent: requestUserAgent
        }) || {};
        return res.status(202).json({
          success: true,
          requiresSecondAdmin: true,
          action: "unlock-requested",
          uploadId: resolvedUploadId,
          unlockRequest: {
            requestedBy: actorId,
            requestedAt: nowIso,
            reason,
            windowMinutes: Math.max(1, Math.round(PRIVATE_DOC_EMERGENCY_UNLOCK_REQUEST_WINDOW_MS / 60_000))
          },
          epoch: {
            previous: previousEpoch,
            current: normalizePrivateDocAccessEpoch(normalizedRequested.privateDocAccessEpoch, previousEpoch),
            rotated: false
          },
          lock: {
            active: Boolean(normalizedRequested.privateDocEmergencyLockActive),
            reason: text(normalizedRequested.privateDocEmergencyLockReason),
            lockedBy: text(normalizedRequested.privateDocEmergencyLockBy),
            lockedAt: asIso(normalizedRequested.privateDocEmergencyLockAt),
            unlockedBy: text(normalizedRequested.privateDocEmergencyUnlockBy),
            unlockedAt: asIso(normalizedRequested.privateDocEmergencyUnlockAt),
            adminBypassEnabled: Boolean(PRIVATE_DOC_EMERGENCY_LOCK_ADMIN_BYPASS),
            unlockRequest: {
              required: true,
              requestedBy: actorId,
              requestedAt: nowIso,
              reason,
              active: true
            }
          }
        });
      }
      if (unlockRequestState.requestedBy === actorId) {
        return res.status(409).json({
          success: false,
          message: "A different admin must confirm emergency unlock request."
        });
      }
      if (!unlockApprove) {
        return res.status(409).json({
          success: false,
          message: "unlockApprove=true is required for second admin confirmation."
        });
      }
    }

    await updatePrivateDocEmergencyLockState({
      uploadId: resolvedUploadId,
      lockActive: targetLockActive,
      lockReason: reason,
      lockBy: targetLockActive ? actorId : "",
      lockAt: targetLockActive ? nowIso : "",
      unlockBy: targetLockActive ? "" : actorId,
      unlockAt: targetLockActive ? "" : nowIso,
      clearUnlockRequest: targetLockActive || action === "unlock"
    });
    if (targetLockActive) {
      await markPrivateDocEmergencyUnlockRequest({
        uploadId: resolvedUploadId,
        requestedBy: "",
        requestedAt: "",
        requestReason: ""
      });
    }

    const nextEpoch = previousEpoch + 1;
    if (shouldRotate) {
      await rotatePrivateDocAccessEpoch({
        uploadId: resolvedUploadId,
        nextEpoch,
        rotatedBy: actorId,
        rotatedAt: nowIso,
        rotateReason: `emergency-${action}: ${reason}`
      });
    }

    const updatedRow = await findUploadById(resolvedUploadId);
    const normalized = normalizeUpload(updatedRow || uploadRow, {
      ...req.coreUser,
      clientIp: requestIp,
      userAgent: requestUserAgent
    }) || {};
    const ownerId = text(normalized.userId || toId(uploadRow?.userId));
    const propertyId = text(normalized.propertyId || toId(uploadRow?.propertyId));
    const docCategory = text(normalized.category || uploadRow?.category);
    const privateDocHash = text(
      normalized.privateDocHash || uploadRow?.privateDocHash || hashPrivateDocSourceUrl(text(uploadRow?.url))
    );
    const currentEpoch = normalizePrivateDocAccessEpoch(
      normalized.privateDocAccessEpoch,
      shouldRotate ? nextEpoch : previousEpoch
    );

    recordPrivateDocAccessEvent({
      userId: actorId,
      role: actorRole,
      ownerId,
      propertyId,
      uploadId: resolvedUploadId,
      docId: text(normalized.id || resolvedUploadId),
      category: docCategory,
      hash: privateDocHash,
      reason: targetLockActive
        ? "private-doc-emergency-lock-enabled"
        : "private-doc-emergency-lock-disabled",
      ip: requestIp,
      userAgent: requestUserAgent.slice(0, 240),
      source: "access-emergency-lock"
    });

    return res.json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      requiresSecondAdmin: false,
      action,
      uploadId: resolvedUploadId,
      epoch: {
        previous: previousEpoch,
        current: currentEpoch,
        rotated: shouldRotate
      },
      lock: {
        active: Boolean(normalized.privateDocEmergencyLockActive),
        reason: text(normalized.privateDocEmergencyLockReason),
        lockedBy: text(normalized.privateDocEmergencyLockBy),
        lockedAt: asIso(normalized.privateDocEmergencyLockAt),
        unlockedBy: text(normalized.privateDocEmergencyUnlockBy),
        unlockedAt: asIso(normalized.privateDocEmergencyUnlockAt),
        adminBypassEnabled: Boolean(PRIVATE_DOC_EMERGENCY_LOCK_ADMIN_BYPASS),
        unlockRequest: {
          required: Boolean(PRIVATE_DOC_EMERGENCY_UNLOCK_DUAL_ADMIN_REQUIRED),
          requestedBy: text(normalized.privateDocEmergencyUnlockRequestedBy),
          requestedAt: asIso(normalized.privateDocEmergencyUnlockRequestedAt),
          reason: text(normalized.privateDocEmergencyUnlockRequestReason),
          active: Boolean(
            text(normalized.privateDocEmergencyUnlockRequestedBy) &&
            toMs(normalized.privateDocEmergencyUnlockRequestedAt) &&
            toMs(normalized.privateDocEmergencyUnlockRequestedAt) + PRIVATE_DOC_EMERGENCY_UNLOCK_REQUEST_WINDOW_MS > Date.now()
          )
        }
      },
      doc: {
        uploadId: resolvedUploadId,
        ownerId,
        propertyId,
        name: text(normalized.name || uploadRow?.name),
        category: docCategory,
        privateDocHash,
        secureAccess: normalized?.secureAccess
          ? {
              token: text(normalized.secureAccess.token),
              accessPath: text(normalized.secureAccess.accessPath),
              expiresAt: text(normalized.secureAccess.expiresAt),
              expiresInSec: Math.max(0, numberValue(normalized.secureAccess.expiresInSec, 0)),
              maskedUrl: text(normalized.secureAccess.maskedUrl),
              hash: text(normalized.secureAccess.hash),
              epoch: currentEpoch
            }
          : null
      }
    });
  } catch (error) {
    return next(error);
  }
}

export async function listCorePrivateDocEmergencyLockQueue(req, res, next) {
  try {
    const limit = Math.min(300, Math.max(1, Number(req.query?.limit || 100)));
    const status = text(req.query?.status, "active").toLowerCase();
    const includeAll = status === "all";
    let rows = [];

    if (proRuntime.dbConnected) {
      const query = {
        isPrivate: true
      };
      if (includeAll) {
        query.$or = [
          { privateDocEmergencyLockActive: true },
          { privateDocEmergencyUnlockRequestedBy: { $ne: null } }
        ];
      } else {
        query.privateDocEmergencyLockActive = true;
      }
      rows = await CoreUpload.find(query).sort({ updatedAt: -1 }).limit(limit).lean();
    } else {
      rows = (Array.isArray(proMemoryStore.coreUploads) ? proMemoryStore.coreUploads : [])
        .filter((item) => {
          if (!Boolean(item?.isPrivate)) return false;
          if (includeAll) {
            return Boolean(item?.privateDocEmergencyLockActive) ||
              Boolean(toId(item?.privateDocEmergencyUnlockRequestedBy));
          }
          return Boolean(item?.privateDocEmergencyLockActive);
        })
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
        .slice(0, limit);
    }

    const nowTs = Date.now();
    const items = rows.map((row) => {
      const item = buildPrivateDocIntegrityQueueItem(row);
      const unlockState = getPrivateDocEmergencyUnlockRequestState(row, nowTs);
      return {
        ...item,
        accessControl: {
          ...(item.accessControl || {}),
          emergencyLock: {
            ...(item?.accessControl?.emergencyLock || {}),
            unlockRequest: {
              ...(item?.accessControl?.emergencyLock?.unlockRequest || {}),
              active: Boolean(unlockState.active),
              expired: Boolean(unlockState.expired),
              requestedBy: text(unlockState.requestedBy),
              requestedAt: asIso(unlockState.requestedAt),
              reason: text(unlockState.reason)
            }
          }
        }
      };
    });

    const activeLockCount = items.filter((item) => Boolean(item?.accessControl?.emergencyLock?.active)).length;
    const activeUnlockRequests = items.filter(
      (item) => Boolean(item?.accessControl?.emergencyLock?.unlockRequest?.active)
    ).length;

    return res.json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      total: items.length,
      filters: {
        status: includeAll ? "all" : "active",
        limit
      },
      summary: {
        activeLockCount,
        activeUnlockRequests,
        dualAdminRequired: Boolean(PRIVATE_DOC_EMERGENCY_UNLOCK_DUAL_ADMIN_REQUIRED),
        unlockWindowMinutes: Math.max(1, Math.round(PRIVATE_DOC_EMERGENCY_UNLOCK_REQUEST_WINDOW_MS / 60_000))
      },
      items
    });
  } catch (error) {
    return next(error);
  }
}

export async function streamCorePrivateDoc(req, res, next) {
  try {
    if (!PRIVATE_DOC_PROXY_ENABLED) {
      return res.status(503).json({
        success: false,
        message: "Private document secure streaming is disabled."
      });
    }

    const token = text(req.body?.token || req.query?.token);
    const requestIp = getClientIp(req);
    const requestUserAgent = text(req.headers?.["user-agent"]);
    const actorId = text(req.coreUser?.id);
    const actorRole = text(req.coreUser?.role, "buyer").toLowerCase();
    const actorIsAdmin = actorRole === "admin";
    const contextBindingEnforced = PRIVATE_DOC_CONTEXT_BINDING_REQUIRED &&
      !(PRIVATE_DOC_CONTEXT_BINDING_ADMIN_BYPASS && actorIsAdmin);
    const shieldStatus = await evaluatePrivateDocAccessShieldStatus({
      userId: actorId,
      role: actorRole,
      ip: requestIp
    });
    if (shieldStatus.active) {
      res.setHeader("Retry-After", String(Math.max(1, Math.round(numberValue(shieldStatus.remainingSec, 1)))));
      recordPrivateDocAccessEvent({
        userId: actorId,
        role: actorRole,
        reason: "private-doc-shield-blocked",
        ip: requestIp,
        userAgent: requestUserAgent.slice(0, 240),
        source: "stream-shield-block",
        shieldBlocked: true,
        shieldReason: text(shieldStatus.reason),
        shieldRemainingSec: Math.max(1, Math.round(numberValue(shieldStatus.remainingSec, 1)))
      });
      return res.status(429).json({
        success: false,
        message: "Private document streaming is temporarily blocked by security shield.",
        reason: text(shieldStatus.reason, "private-doc-shield-blocked"),
        retryAfterSec: Math.max(1, Math.round(numberValue(shieldStatus.remainingSec, 1)))
      });
    }

    if (!token) {
      recordPrivateDocAccessEvent({
        userId: actorId,
        role: actorRole,
        reason: "missing-token",
        replayGuardEnabled: Boolean(PRIVATE_DOC_STREAM_TOKEN_REPLAY_GUARD_ENABLED),
        ip: requestIp,
        userAgent: requestUserAgent.slice(0, 240),
        source: "stream-token-missing"
      });
      return res.status(400).json({
        success: false,
        message: "token is required."
      });
    }

    const verification = verifyPrivateDocAccessToken(token, {
      viewerId: actorId,
      viewerRole: actorRole,
      requestIp,
      requestUserAgent,
      enforceContextBinding: contextBindingEnforced,
      allowedPurposes: ["stream"]
    });
    if (!verification.ok) {
      recordPrivateDocAccessEvent({
        userId: actorId,
        role: actorRole,
        tokenFingerprint: fingerprintPrivateDocAccessToken(token),
        replayGuardEnabled: Boolean(PRIVATE_DOC_STREAM_TOKEN_REPLAY_GUARD_ENABLED),
        replayBlocked: false,
        contextBindingEnforced: Boolean(contextBindingEnforced),
        contextBindingFailure: text(verification.reason) === "token-context-mismatch",
        authorizationDenied: false,
        reason: text(verification.reason),
        ip: requestIp,
        userAgent: requestUserAgent.slice(0, 240),
        source: "stream-token-verify"
      });
      return res.status(403).json({
        success: false,
        message: "Private document stream token is invalid or expired.",
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
    const tokenAccessEpoch = normalizePrivateDocAccessEpoch(payload.epoch, 1);
    let sourceUrl = text(payload.sourceUrl);
    let ownerId = text(payload.ownerId);
    let propertyId = text(payload.propertyId);
    let docName = text(payload.name, "private-document.bin");
    let docCategory = text(payload.category);
    let resolvedUploadId = text(uploadId);
    let expectedContentHash = "";
    let expectedUpstreamEtag = "";
    let expectedUpstreamLastModified = "";
    let uploadIntegrityStatus = "unknown";
    let uploadIntegrityReviewStatus = "none";
    let uploadAccessEpoch = tokenAccessEpoch;
    let uploadRow = null;

    if (uploadId) {
      uploadRow = await findUploadById(uploadId);
      if (!uploadRow) {
        recordPrivateDocAccessEvent({
          userId: actorId,
          role: actorRole,
          uploadId,
          tokenId,
          tokenFingerprint,
          replayGuardEnabled: Boolean(PRIVATE_DOC_STREAM_TOKEN_REPLAY_GUARD_ENABLED),
          reason: "upload-not-found",
          ip: requestIp,
          userAgent: requestUserAgent.slice(0, 240),
          source: "stream-upload"
        });
        return res.status(404).json({
          success: false,
          message: "Upload record not found."
        });
      }
      if (!Boolean(uploadRow?.isPrivate)) {
        recordPrivateDocAccessEvent({
          userId: actorId,
          role: actorRole,
          uploadId,
          tokenId,
          tokenFingerprint,
          replayGuardEnabled: Boolean(PRIVATE_DOC_STREAM_TOKEN_REPLAY_GUARD_ENABLED),
          reason: "upload-not-private",
          ip: requestIp,
          userAgent: requestUserAgent.slice(0, 240),
          source: "stream-upload"
        });
        return res.status(400).json({
          success: false,
          message: "Requested upload is not marked as private."
        });
      }

      resolvedUploadId = toId(uploadRow?._id || uploadRow?.id);
      ownerId = text(toId(uploadRow?.userId), ownerId);
      propertyId = text(toId(uploadRow?.propertyId), propertyId);
      docName = text(uploadRow?.name, docName);
      docCategory = text(uploadRow?.category, docCategory);
      sourceUrl = text(uploadRow?.url, sourceUrl);
      uploadAccessEpoch = normalizePrivateDocAccessEpoch(uploadRow?.privateDocAccessEpoch, 1);
      uploadIntegrityStatus = normalizePrivateDocIntegrityStatus(uploadRow?.privateDocIntegrityStatus);
      uploadIntegrityReviewStatus = normalizePrivateDocIntegrityReviewStatus(
        uploadRow?.privateDocIntegrityReviewStatus
      );
      expectedContentHash = text(uploadRow?.privateDocContentHash).toLowerCase();
      expectedUpstreamEtag = text(uploadRow?.privateDocUpstreamEtag);
      expectedUpstreamLastModified = text(uploadRow?.privateDocUpstreamLastModified);

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
          replayGuardEnabled: Boolean(PRIVATE_DOC_STREAM_TOKEN_REPLAY_GUARD_ENABLED),
          replayBlocked: false,
          authorizationDenied: true,
          ip: requestIp,
          userAgent: requestUserAgent.slice(0, 240),
          expiresAt: text(payload.expiresAt),
          source: "stream-upload"
        });
        return res.status(403).json({
          success: false,
          message: "You are not authorized to stream this private document."
        });
      }

      const uploadHash = text(uploadRow?.privateDocHash, hashPrivateDocSourceUrl(sourceUrl));
      if (uploadHash && uploadHash !== text(payload.hash)) {
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
          replayGuardEnabled: Boolean(PRIVATE_DOC_STREAM_TOKEN_REPLAY_GUARD_ENABLED),
          reason: "document-integrity-validation-failed",
          ip: requestIp,
          userAgent: requestUserAgent.slice(0, 240),
          source: "stream-upload"
        });
        return res.status(409).json({
          success: false,
          message: "Document integrity validation failed."
        });
      }
      if (
        Boolean(uploadRow?.privateDocEmergencyLockActive) &&
        !(actorIsAdmin && PRIVATE_DOC_EMERGENCY_LOCK_ADMIN_BYPASS)
      ) {
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
          replayGuardEnabled: Boolean(PRIVATE_DOC_STREAM_TOKEN_REPLAY_GUARD_ENABLED),
          reason: "private-doc-emergency-lock-active",
          ip: requestIp,
          userAgent: requestUserAgent.slice(0, 240),
          source: "stream-upload"
        });
        return res.status(423).json({
          success: false,
          message: "Private document streaming is locked by emergency security control.",
          reason: "private-doc-emergency-lock-active"
        });
      }
      if (tokenAccessEpoch !== uploadAccessEpoch) {
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
          replayGuardEnabled: Boolean(PRIVATE_DOC_STREAM_TOKEN_REPLAY_GUARD_ENABLED),
          reason: "private-doc-access-epoch-revoked",
          ip: requestIp,
          userAgent: requestUserAgent.slice(0, 240),
          source: "stream-upload"
        });
        return res.status(409).json({
          success: false,
          message: "Private document stream token has been revoked. Request a fresh token.",
          reason: "private-doc-access-epoch-revoked"
        });
      }
      if (
        PRIVATE_DOC_CONTENT_ATTEST_ENABLED &&
        PRIVATE_DOC_INTEGRITY_BLOCK_ON_MISMATCH &&
        uploadIntegrityStatus === "mismatch" &&
        uploadIntegrityReviewStatus !== "approved" &&
        !(actorIsAdmin && PRIVATE_DOC_INTEGRITY_MISMATCH_ADMIN_BYPASS)
      ) {
        const threatMeta = parsePrivateDocThreatMismatchReason(
          text(uploadRow?.privateDocIntegrityMismatchReason)
        );
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
          replayGuardEnabled: Boolean(PRIVATE_DOC_STREAM_TOKEN_REPLAY_GUARD_ENABLED),
          reason: "private-doc-integrity-mismatch-blocked",
          ip: requestIp,
          userAgent: requestUserAgent.slice(0, 240),
          source: "stream-upload",
          threatDetected: Boolean(threatMeta.active),
          threatScore: Math.max(0, Math.round(numberValue(threatMeta.score, 0)))
        });
        return res.status(423).json({
          success: false,
          message: threatMeta.active
            ? "Private document is blocked by upload threat scan. Admin approval required."
            : "Private document is temporarily locked due to integrity mismatch. Admin review required.",
          reason: threatMeta.active
            ? "private-doc-upload-threat-review-pending"
            : "private-doc-integrity-mismatch-blocked"
        });
      }
    } else {
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
          replayGuardEnabled: Boolean(PRIVATE_DOC_STREAM_TOKEN_REPLAY_GUARD_ENABLED),
          replayBlocked: false,
          authorizationDenied: true,
          ip: requestIp,
          userAgent: requestUserAgent.slice(0, 240),
          expiresAt: text(payload.expiresAt),
          source: "stream-inline-private-doc"
        });
        return res.status(403).json({
          success: false,
          message: "You are not authorized to stream this private document."
        });
      }
    }

    if (PRIVATE_DOC_STREAM_TOKEN_REPLAY_GUARD_ENABLED) {
      const tokenConsume = consumePrivateDocStreamToken({
        tokenId,
        tokenFingerprint,
        expiresAtSec: tokenExpiresAtSec,
        nowSec
      });
      if (!tokenConsume.ok) {
        recordPrivateDocAccessEvent({
          userId: actorId,
          role: actorRole,
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
          ip: requestIp,
          userAgent: requestUserAgent.slice(0, 240),
          expiresAt: text(payload.expiresAt),
          source: "stream"
        });
        return res.status(409).json({
          success: false,
          message: "Private document stream token already used. Please request a fresh token.",
          reason: text(tokenConsume.reason)
        });
      }
    }

    const proxyResult = await proxyPrivateDocToResponse({
      sourceUrl,
      docName,
      hash: text(payload.hash),
      expectedContentHash,
      expectedUpstreamEtag,
      expectedUpstreamLastModified,
      enforceHeaderIntegrity: Boolean(
        PRIVATE_DOC_CONTENT_ATTEST_ENABLED &&
        PRIVATE_DOC_UPSTREAM_HEADER_ENFORCE &&
        uploadId
      ),
      res
    });
    if (!proxyResult.ok) {
      recordPrivateDocAccessEvent({
        userId: actorId,
        role: actorRole,
        ownerId,
        propertyId,
        uploadId,
        docId: text(payload.docId),
        category: docCategory,
        hash: text(payload.hash),
        tokenId,
        tokenFingerprint,
        replayGuardEnabled: Boolean(PRIVATE_DOC_STREAM_TOKEN_REPLAY_GUARD_ENABLED),
        replayBlocked: false,
        reason: text(proxyResult.reason),
        ip: requestIp,
        userAgent: requestUserAgent.slice(0, 240),
        source: "stream-proxy"
      });
      if (!proxyResult.headersSent) {
        return res.status(502).json({
          success: false,
          message: "Unable to stream private document securely.",
          reason: text(proxyResult.reason)
        });
      }
      return undefined;
    }

    if (uploadId && PRIVATE_DOC_CONTENT_ATTEST_ENABLED) {
      const computedContentHash = text(proxyResult.contentHash).toLowerCase();
      const upstreamEtag = text(proxyResult.upstreamEtag);
      const upstreamLastModified = text(proxyResult.upstreamLastModified);
      const contentType = text(proxyResult.contentType, "application/octet-stream");
      const contentBytes = Math.max(0, numberValue(proxyResult.streamedBytes, 0));
      let mismatchReason = "";

      if (expectedContentHash && computedContentHash && expectedContentHash !== computedContentHash) {
        mismatchReason = "private-doc-content-hash-mismatch";
      } else if (
        expectedUpstreamEtag &&
        upstreamEtag &&
        !sameEtagValue(expectedUpstreamEtag, upstreamEtag)
      ) {
        mismatchReason = "private-doc-upstream-etag-mismatch";
      } else if (
        expectedUpstreamLastModified &&
        upstreamLastModified &&
        expectedUpstreamLastModified.toLowerCase() !== upstreamLastModified.toLowerCase()
      ) {
        mismatchReason = "private-doc-upstream-last-modified-mismatch";
      }

      if (mismatchReason) {
        await markPrivateDocIntegrity(resolvedUploadId || uploadId, {
          privateDocContentHash: expectedContentHash || computedContentHash,
          privateDocContentBytes: contentBytes,
          privateDocContentType: contentType,
          privateDocUpstreamEtag: expectedUpstreamEtag || upstreamEtag,
          privateDocUpstreamLastModified: expectedUpstreamLastModified || upstreamLastModified,
          privateDocAttestedAt: nowIso,
          privateDocIntegrityStatus: "mismatch",
          privateDocIntegrityReviewStatus: "pending",
          privateDocIntegrityReviewedBy: null,
          privateDocIntegrityReviewedAt: null,
          privateDocIntegrityReviewReason: "",
          privateDocIntegrityApprovalRequestedBy: null,
          privateDocIntegrityApprovalRequestedAt: null,
          privateDocIntegrityApprovalRequestReason: "",
          ...buildPrivateDocIntegrityDecisionChainPatchFromUpload(uploadRow),
          privateDocIntegrityMismatchAt: nowIso,
          privateDocIntegrityMismatchReason: mismatchReason,
          privateDocIntegrityReviewHistoryEvent: {
            action: "auto-mismatch",
            byUserId: null,
            reason: mismatchReason,
            previousStatus: uploadIntegrityStatus,
            nextStatus: "mismatch"
          }
        });
        recordPrivateDocAccessEvent({
          userId: actorId,
          role: actorRole,
          ownerId,
          propertyId,
          uploadId: resolvedUploadId || uploadId,
          docId: text(payload.docId),
          category: docCategory,
          hash: text(payload.hash),
          tokenId,
          tokenFingerprint,
          replayGuardEnabled: Boolean(PRIVATE_DOC_STREAM_TOKEN_REPLAY_GUARD_ENABLED),
          replayBlocked: false,
          reason: mismatchReason,
          ip: requestIp,
          userAgent: requestUserAgent.slice(0, 240),
          source: "stream-integrity"
        });
      } else {
        await markPrivateDocIntegrity(resolvedUploadId || uploadId, {
          privateDocContentHash: computedContentHash,
          privateDocContentBytes: contentBytes,
          privateDocContentType: contentType,
          privateDocUpstreamEtag: upstreamEtag,
          privateDocUpstreamLastModified: upstreamLastModified,
          privateDocAttestedAt: nowIso,
          privateDocIntegrityStatus: "verified",
          privateDocIntegrityReviewStatus: "none",
          privateDocIntegrityReviewedBy: null,
          privateDocIntegrityReviewedAt: null,
          privateDocIntegrityReviewReason: "",
          privateDocIntegrityApprovalRequestedBy: null,
          privateDocIntegrityApprovalRequestedAt: null,
          privateDocIntegrityApprovalRequestReason: "",
          ...buildPrivateDocIntegrityDecisionChainPatchFromUpload(uploadRow),
          privateDocIntegrityMismatchAt: null,
          privateDocIntegrityMismatchReason: "",
          privateDocIntegrityReviewHistoryEvent: {
            action: "auto-verified",
            byUserId: null,
            reason: "content-attestation-verified",
            previousStatus: uploadIntegrityStatus,
            nextStatus: "verified"
          }
        });
      }
    }

    await markPrivateDocAccess(resolvedUploadId || uploadId, nowIso);
    recordPrivateDocAccessEvent({
      userId: actorId,
      role: actorRole,
      ownerId,
      propertyId,
      uploadId,
      docId: text(payload.docId),
      category: docCategory,
      hash: text(payload.hash),
      tokenId,
      tokenFingerprint,
      replayGuardEnabled: Boolean(PRIVATE_DOC_STREAM_TOKEN_REPLAY_GUARD_ENABLED),
      replayBlocked: false,
      ip: requestIp,
      userAgent: requestUserAgent.slice(0, 240),
      expiresAt: text(payload.expiresAt),
      source: "stream-proxy-success"
    });
    return undefined;
  } catch (error) {
    return next(error);
  }
}

function buildPrivateDocIntegrityQueueItem(uploadRow = {}) {
  const normalized = normalizeUpload(uploadRow, null) || {};
  const integrity = normalized.privateDocIntegrity || {};
  return {
    uploadId: text(normalized.id),
    propertyId: text(normalized.propertyId),
    ownerId: text(normalized.userId),
    category: text(normalized.category),
    name: text(normalized.name),
    isPrivate: Boolean(normalized.isPrivate),
    accessControl: {
      epoch: normalizePrivateDocAccessEpoch(normalized.privateDocAccessEpoch, 1),
      rotatedAt: asIso(normalized.privateDocAccessEpochRotatedAt),
      rotatedBy: text(normalized.privateDocAccessEpochRotatedBy),
      rotateReason: text(normalized.privateDocAccessEpochRotateReason),
      emergencyLock: {
        active: Boolean(normalized.privateDocEmergencyLockActive),
        reason: text(normalized.privateDocEmergencyLockReason),
        lockedBy: text(normalized.privateDocEmergencyLockBy),
        lockedAt: asIso(normalized.privateDocEmergencyLockAt),
        unlockedBy: text(normalized.privateDocEmergencyUnlockBy),
        unlockedAt: asIso(normalized.privateDocEmergencyUnlockAt),
        adminBypassEnabled: Boolean(PRIVATE_DOC_EMERGENCY_LOCK_ADMIN_BYPASS),
        unlockRequest: {
          required: Boolean(PRIVATE_DOC_EMERGENCY_UNLOCK_DUAL_ADMIN_REQUIRED),
          windowMinutes: Math.max(1, Math.round(PRIVATE_DOC_EMERGENCY_UNLOCK_REQUEST_WINDOW_MS / 60_000)),
          requestedBy: text(normalized.privateDocEmergencyUnlockRequestedBy),
          requestedAt: asIso(normalized.privateDocEmergencyUnlockRequestedAt),
          reason: text(normalized.privateDocEmergencyUnlockRequestReason),
          active: Boolean(
            text(normalized.privateDocEmergencyUnlockRequestedBy) &&
            toMs(normalized.privateDocEmergencyUnlockRequestedAt) &&
            toMs(normalized.privateDocEmergencyUnlockRequestedAt) + PRIVATE_DOC_EMERGENCY_UNLOCK_REQUEST_WINDOW_MS > Date.now()
          )
        }
      }
    },
    integrity: {
      status: normalizePrivateDocIntegrityStatus(integrity.status),
      reviewStatus: normalizePrivateDocIntegrityReviewStatus(integrity.reviewStatus),
      mismatchAt: asIso(integrity.mismatchAt),
      mismatchReason: text(integrity.mismatchReason),
      attestedAt: asIso(integrity.attestedAt),
      contentHash: text(integrity.contentHash),
      contentBytes: Math.max(0, numberValue(integrity.contentBytes, 0)),
      contentType: text(integrity.contentType),
      upstreamEtag: text(integrity.upstreamEtag),
      upstreamLastModified: text(integrity.upstreamLastModified),
      reviewedBy: text(integrity.reviewedBy),
      reviewedAt: asIso(integrity.reviewedAt),
      reviewReason: text(integrity.reviewReason),
      threat: parsePrivateDocThreatMismatchReason(text(integrity.mismatchReason)),
      approvalRequest: {
        requestedBy: text(integrity?.approvalRequest?.requestedBy || ""),
        requestedAt: asIso(integrity?.approvalRequest?.requestedAt),
        reason: text(integrity?.approvalRequest?.reason || ""),
        active: Boolean(integrity?.approvalRequest?.active)
      },
      decisionAudit: {
        chainHead: text(integrity?.decisionAudit?.chainHead || ""),
        lastDecisionHash: text(integrity?.decisionAudit?.lastDecisionHash || ""),
        lastDecisionId: text(integrity?.decisionAudit?.lastDecisionId || ""),
        lastDecisionAction: text(integrity?.decisionAudit?.lastDecisionAction || ""),
        lastDecisionBy: text(integrity?.decisionAudit?.lastDecisionBy || ""),
        lastDecisionAt: asIso(integrity?.decisionAudit?.lastDecisionAt),
        chainLength: Math.max(0, numberValue(integrity?.decisionAudit?.chainLength, 0)),
        signatureKeyVersion: text(integrity?.decisionAudit?.signatureKeyVersion || "")
      },
      reviewHistory: Array.isArray(integrity.reviewHistory)
        ? integrity.reviewHistory.slice(-20)
        : []
    },
    createdAt: asIso(normalized.createdAt),
    updatedAt: asIso(normalized.updatedAt)
  };
}

export async function listCorePrivateDocIntegrityQueue(req, res, next) {
  try {
    const limit = Math.min(300, Math.max(1, Number(req.query?.limit || 100)));
    const requestedStatus = text(req.query?.status).toLowerCase();
    const requestedSource = text(req.query?.source).toLowerCase();
    const statusFilter = normalizePrivateDocIntegrityReviewStatus(requestedStatus);
    const sourceFilter = requestedSource === "upload-threat" ? "upload-threat" : "all";
    const includeAll = requestedStatus === "all";
    let rows = [];

    if (proRuntime.dbConnected) {
      const query = {
        isPrivate: true,
        privateDocIntegrityStatus: "mismatch"
      };
      if (sourceFilter === "upload-threat") {
        query.privateDocIntegrityMismatchReason = /^upload-threat-detected\|/i;
      }
      if (!includeAll && requestedStatus) {
        query.privateDocIntegrityReviewStatus = statusFilter;
      } else if (!includeAll && !requestedStatus) {
        query.privateDocIntegrityReviewStatus = "pending";
      }
      rows = await CoreUpload.find(query).sort({ updatedAt: -1 }).limit(limit).lean();
    } else {
      rows = (Array.isArray(proMemoryStore.coreUploads) ? proMemoryStore.coreUploads : [])
        .filter((item) => {
          if (!Boolean(item?.isPrivate)) return false;
          if (normalizePrivateDocIntegrityStatus(item?.privateDocIntegrityStatus) !== "mismatch") return false;
          if (
            sourceFilter === "upload-threat" &&
            !parsePrivateDocThreatMismatchReason(text(item?.privateDocIntegrityMismatchReason)).active
          ) {
            return false;
          }
          const reviewStatus = normalizePrivateDocIntegrityReviewStatus(item?.privateDocIntegrityReviewStatus);
          if (includeAll) return true;
          if (requestedStatus) return reviewStatus === statusFilter;
          return reviewStatus === "pending";
        })
        .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0))
        .slice(0, limit);
    }

    const items = rows.map((item) => buildPrivateDocIntegrityQueueItem(item));
    return res.json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      total: items.length,
      filters: {
        status: includeAll ? "all" : (requestedStatus ? statusFilter : "pending"),
        source: sourceFilter,
        limit
      },
      items
    });
  } catch (error) {
    return next(error);
  }
}

export async function decideCorePrivateDocIntegrity(req, res, next) {
  try {
    const uploadId = text(req.body?.uploadId || req.params?.uploadId);
    const action = normalizePrivateDocIntegrityDecisionAction(req.body?.action);
    const reason = text(req.body?.reason);
    const adminId = text(req.coreUser?.id);
    const requestIp = getClientIp(req);
    const requestUserAgent = text(req.headers?.["user-agent"]);
    if (!uploadId) {
      return res.status(400).json({
        success: false,
        message: "uploadId is required."
      });
    }
    if (!action) {
      return res.status(400).json({
        success: false,
        message: "action is required. Allowed: approve, quarantine, reset."
      });
    }
    if (reason.length < PRIVATE_DOC_INTEGRITY_REVIEW_REASON_MIN) {
      return res.status(400).json({
        success: false,
        message: `reason must be at least ${PRIVATE_DOC_INTEGRITY_REVIEW_REASON_MIN} characters.`
      });
    }

    const uploadRow = await findUploadById(uploadId);
    if (!uploadRow) {
      return res.status(404).json({
        success: false,
        message: "Upload record not found."
      });
    }
    if (!Boolean(uploadRow?.isPrivate)) {
      return res.status(400).json({
        success: false,
        message: "Integrity review is only supported for private documents."
      });
    }

    const currentStatus = normalizePrivateDocIntegrityStatus(uploadRow?.privateDocIntegrityStatus);
    const currentReviewStatus = normalizePrivateDocIntegrityReviewStatus(
      uploadRow?.privateDocIntegrityReviewStatus
    );
    const nowTs = Date.now();
    const nowIso = new Date(nowTs).toISOString();
    const approvalState = getPrivateDocIntegrityApprovalRequestState(uploadRow, nowTs);
    const uploadOwnerId = toId(uploadRow?.userId);
    const uploadPropertyId = toId(uploadRow?.propertyId);

    if (action === "approved" && PRIVATE_DOC_INTEGRITY_DUAL_APPROVAL_REQUIRED) {
      if (!approvalState.active) {
        const requestDecisionStatus = currentStatus === "unknown" ? "mismatch" : currentStatus;
        const decisionAudit = await createPrivateDocIntegrityDecisionAudit({
          uploadRow,
          uploadId,
          propertyId: uploadPropertyId,
          ownerId: uploadOwnerId,
          action: "approval-requested",
          phase: "request",
          actorAdminId: adminId,
          requestedBy: adminId,
          confirmedBy: "",
          reason,
          requestIp,
          requestUserAgent,
          statusBefore: currentStatus,
          reviewStatusBefore: currentReviewStatus,
          statusAfter: requestDecisionStatus,
          reviewStatusAfter: "pending",
          occurredAt: nowIso
        });
        const requestPatch = {
          privateDocIntegrityStatus: requestDecisionStatus,
          privateDocIntegrityReviewStatus: "pending",
          privateDocIntegrityReviewedBy: null,
          privateDocIntegrityReviewedAt: null,
          privateDocIntegrityReviewReason: "",
          privateDocIntegrityApprovalRequestedBy: adminId,
          privateDocIntegrityApprovalRequestedAt: nowIso,
          privateDocIntegrityApprovalRequestReason: reason,
          ...buildPrivateDocIntegrityDecisionChainPatchFromAudit(decisionAudit, uploadRow),
          privateDocIntegrityReviewHistoryEvent: {
            action: "approval-requested",
            byUserId: adminId,
            reason,
            previousStatus: `${currentStatus}:${currentReviewStatus}`,
            nextStatus: "mismatch:pending-dual-approval"
          }
        };
        await markPrivateDocIntegrity(uploadId, requestPatch);
        const requested = await findUploadById(uploadId);
        return res.status(202).json({
          success: true,
          requiresSecondAdmin: true,
          decision: {
            uploadId,
            action: "approval-requested",
            reason,
            requestedBy: adminId,
            requestedAt: nowIso,
            audit: buildPrivateDocIntegrityDecisionAuditSummary(decisionAudit)
          },
          upload: buildPrivateDocIntegrityQueueItem(requested || uploadRow)
        });
      }

      if (approvalState.requestedBy === adminId) {
        return res.status(409).json({
          success: false,
          message: "A different admin must confirm this approval request."
        });
      }

      const confirmedDecisionStatus = currentStatus === "unknown" ? "verified" : currentStatus;
      const decisionAudit = await createPrivateDocIntegrityDecisionAudit({
        uploadRow,
        uploadId,
        propertyId: uploadPropertyId,
        ownerId: uploadOwnerId,
        action: "approval-confirmed",
        phase: "confirm",
        actorAdminId: adminId,
        requestedBy: approvalState.requestedBy,
        confirmedBy: adminId,
        reason,
        requestIp,
        requestUserAgent,
        statusBefore: currentStatus,
        reviewStatusBefore: currentReviewStatus,
        statusAfter: confirmedDecisionStatus,
        reviewStatusAfter: "approved",
        occurredAt: nowIso
      });
      const approvePatch = {
        privateDocIntegrityStatus: confirmedDecisionStatus,
        privateDocIntegrityReviewStatus: "approved",
        privateDocIntegrityReviewedBy: adminId,
        privateDocIntegrityReviewedAt: nowIso,
        privateDocIntegrityReviewReason: reason,
        privateDocIntegrityApprovalRequestedBy: null,
        privateDocIntegrityApprovalRequestedAt: null,
        privateDocIntegrityApprovalRequestReason: "",
        ...buildPrivateDocIntegrityDecisionChainPatchFromAudit(decisionAudit, uploadRow),
        privateDocIntegrityReviewHistoryEvent: {
          action: "approval-confirmed",
          byUserId: adminId,
          reason: `${reason} | requestedBy:${approvalState.requestedBy}`,
          previousStatus: `${currentStatus}:${currentReviewStatus}`,
          nextStatus: "mismatch:approved"
        }
      };
      await markPrivateDocIntegrity(uploadId, approvePatch);
      const approved = await findUploadById(uploadId);
      return res.json({
        success: true,
        requiresSecondAdmin: false,
        decision: {
          uploadId,
          action: "approved",
          reason,
          requestedBy: approvalState.requestedBy,
          confirmedBy: adminId,
          reviewedAt: nowIso,
          audit: buildPrivateDocIntegrityDecisionAuditSummary(decisionAudit)
        },
        upload: buildPrivateDocIntegrityQueueItem(approved || uploadRow)
      });
    }

    const patch = {
      privateDocIntegrityReviewedBy: adminId,
      privateDocIntegrityReviewedAt: nowIso,
      privateDocIntegrityReviewReason: reason,
      privateDocIntegrityApprovalRequestedBy: null,
      privateDocIntegrityApprovalRequestedAt: null,
      privateDocIntegrityApprovalRequestReason: ""
    };

    if (action === "approved") {
      patch.privateDocIntegrityStatus = currentStatus === "unknown" ? "verified" : currentStatus;
      patch.privateDocIntegrityReviewStatus = "approved";
      patch.privateDocIntegrityReviewHistoryEvent = {
        action: "approved",
        byUserId: adminId,
        reason,
        previousStatus: `${currentStatus}:${currentReviewStatus}`,
        nextStatus: `${patch.privateDocIntegrityStatus}:approved`
      };
    } else if (action === "quarantined") {
      patch.privateDocIntegrityStatus = "mismatch";
      patch.privateDocIntegrityReviewStatus = "quarantined";
      patch.privateDocIntegrityMismatchAt =
        asIso(uploadRow?.privateDocIntegrityMismatchAt) || nowIso;
      patch.privateDocIntegrityMismatchReason =
        text(uploadRow?.privateDocIntegrityMismatchReason) || "admin-quarantined-integrity";
      patch.privateDocIntegrityReviewHistoryEvent = {
        action: "quarantined",
        byUserId: adminId,
        reason,
        previousStatus: `${currentStatus}:${currentReviewStatus}`,
        nextStatus: "mismatch:quarantined"
      };
    } else {
      patch.privateDocIntegrityStatus = "unknown";
      patch.privateDocIntegrityReviewStatus = "none";
      patch.privateDocIntegrityMismatchAt = null;
      patch.privateDocIntegrityMismatchReason = "";
      patch.privateDocContentHash = "";
      patch.privateDocContentBytes = 0;
      patch.privateDocContentType = "";
      patch.privateDocUpstreamEtag = "";
      patch.privateDocUpstreamLastModified = "";
      patch.privateDocAttestedAt = null;
      patch.privateDocIntegrityReviewHistoryEvent = {
        action: "reset",
        byUserId: adminId,
        reason,
        previousStatus: `${currentStatus}:${currentReviewStatus}`,
        nextStatus: "unknown:none"
      };
    }

    const finalStatus = normalizePrivateDocIntegrityStatus(patch.privateDocIntegrityStatus);
    const finalReviewStatus = normalizePrivateDocIntegrityReviewStatus(
      patch.privateDocIntegrityReviewStatus
    );
    const decisionAuditAction =
      action === "approved"
        ? "approved"
        : (action === "quarantined" ? "quarantined" : "reset");
    const decisionAudit = await createPrivateDocIntegrityDecisionAudit({
      uploadRow,
      uploadId,
      propertyId: uploadPropertyId,
      ownerId: uploadOwnerId,
      action: decisionAuditAction,
      phase: "single",
      actorAdminId: adminId,
      requestedBy: "",
      confirmedBy: adminId,
      reason,
      requestIp,
      requestUserAgent,
      statusBefore: currentStatus,
      reviewStatusBefore: currentReviewStatus,
      statusAfter: finalStatus,
      reviewStatusAfter: finalReviewStatus,
      occurredAt: nowIso
    });
    Object.assign(
      patch,
      buildPrivateDocIntegrityDecisionChainPatchFromAudit(decisionAudit, uploadRow)
    );
    await markPrivateDocIntegrity(uploadId, patch);
    const updated = await findUploadById(uploadId);
    return res.json({
      success: true,
      decision: {
        uploadId,
        action,
        reason,
        reviewedBy: adminId,
        reviewedAt: nowIso,
        audit: buildPrivateDocIntegrityDecisionAuditSummary(decisionAudit)
      },
      upload: buildPrivateDocIntegrityQueueItem(updated || uploadRow)
    });
  } catch (error) {
    return next(error);
  }
}

export async function listCorePrivateDocIntegrityDecisionAudits(req, res, next) {
  try {
    const uploadId = text(req.query?.uploadId || req.params?.uploadId || req.body?.uploadId);
    const limit = Math.min(500, Math.max(1, Number(req.query?.limit || 120)));
    const includeCryptographic =
      String(req.query?.includeCryptographic || "false").trim().toLowerCase() === "true";
    const includePayload =
      String(req.query?.includePayload || "false").trim().toLowerCase() === "true";
    if (!uploadId) {
      return res.status(400).json({
        success: false,
        message: "uploadId is required."
      });
    }

    const rows = await listPrivateDocIntegrityDecisionAudits(uploadId, limit);
    const verification = verifyPrivateDocIntegrityDecisionAuditChain(rows);
    const uploadRow = await findUploadById(uploadId);
    const uploadChainHead = text(uploadRow?.privateDocIntegrityDecisionChainHead);
    const chainHeadMismatch = Boolean(
      uploadChainHead &&
      verification.chain.headDecisionHash &&
      uploadChainHead !== verification.chain.headDecisionHash
    );
    const issues = chainHeadMismatch
      ? [
          ...verification.issues,
          {
            code: "upload-chain-head-mismatch",
            expectedHead: uploadChainHead,
            observedHead: verification.chain.headDecisionHash
          }
        ]
      : verification.issues;

    const verificationResult = {
      ...verification,
      valid: verification.valid && !chainHeadMismatch,
      issues,
      uploadChainHead,
      chainHeadAligned: !chainHeadMismatch
    };
    const items = rows.map((row) =>
      buildPrivateDocIntegrityDecisionAuditItem(row, {
        includeCryptographic,
        includePayload
      })
    );

    return res.json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      uploadId,
      total: items.length,
      verification: verificationResult,
      items
    });
  } catch (error) {
    return next(error);
  }
}

export async function listCorePrivateDocSecurityEvents(req, res, next) {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.query?.limit || 120)));
    const nowTs = Date.now();
    await hydratePrivateDocShieldBlocksFromDb(nowTs);
    prunePrivateDocAccessShieldState(nowTs);
    prunePrivateDocAutoEmergencyLockProfiles(nowTs);
    const usePersistence = canPersistPrivateDocSecurity();

    const shieldEvents = usePersistence
      ? await CorePrivateDocSecurityEvent.find({ eventType: "shield" })
        .sort({ occurredAt: -1, createdAt: -1 })
        .limit(limit)
        .lean()
      : (Array.isArray(proMemoryStore.corePrivateDocShieldEvents)
        ? proMemoryStore.corePrivateDocShieldEvents
        : []);
    const accessEvents = usePersistence
      ? await CorePrivateDocSecurityEvent.find({ eventType: "access" })
        .sort({ occurredAt: -1, createdAt: -1 })
        .limit(Math.min(limit, 200))
        .lean()
      : (Array.isArray(proMemoryStore.corePrivateDocAccessEvents)
        ? proMemoryStore.corePrivateDocAccessEvents
        : []);
    const activeBlocks = usePersistence
      ? (await CorePrivateDocShieldBlock.find({
        blockUntil: { $gt: new Date(nowTs) }
      })
        .sort({ blockUntil: -1 })
        .lean())
        .map((item) => normalizePersistedShieldBlock(item))
        .map((item) => {
          const releaseRequestState = getPrivateDocShieldReleaseRequestState(item, nowTs);
          return {
            actorKey: text(item.actorKey),
            reason: text(item.reason),
            blockLevel: Math.max(1, Math.round(numberValue(item.blockLevel, 1))),
            blockStartedAt: asIso(item.blockStartedAtTs),
            blockUntil: asIso(item.blockUntilTs),
            remainingSec: Math.max(1, Math.ceil((Math.max(0, Math.round(numberValue(item.blockUntilTs, 0))) - nowTs) / 1000)),
            triggers: Array.isArray(item.triggers) ? item.triggers.slice(0, 6) : [],
            userId: text(item.userId),
            role: text(item.role),
            ipHash: text(item.ipHash),
            source: text(item.source),
            releaseRequest: {
              required: Boolean(PRIVATE_DOC_SHIELD_RELEASE_DUAL_ADMIN_REQUIRED),
              windowMinutes: Math.max(1, Math.round(PRIVATE_DOC_SHIELD_RELEASE_REQUEST_WINDOW_MS / 60_000)),
              requestedBy: text(releaseRequestState.requestedBy),
              requestedAt: asIso(releaseRequestState.requestedAt),
              reason: text(releaseRequestState.reason),
              active: Boolean(releaseRequestState.active),
              expired: Boolean(releaseRequestState.expired)
            }
          };
        })
      : listPrivateDocShieldActiveBlocks(nowTs);
    const pendingShieldReleaseRequests = activeBlocks.filter(
      (item) => Boolean(item?.releaseRequest?.active)
    ).length;
    const emergencyLockedPrivateDocs = proRuntime.dbConnected
      ? await CoreUpload.countDocuments({
        isPrivate: true,
        privateDocEmergencyLockActive: true
      })
      : (Array.isArray(proMemoryStore.coreUploads)
        ? proMemoryStore.coreUploads.filter(
          (item) => Boolean(item?.isPrivate) && Boolean(item?.privateDocEmergencyLockActive)
        ).length
        : 0);
    const pendingEmergencyUnlockRequests = proRuntime.dbConnected
      ? await CoreUpload.countDocuments({
        isPrivate: true,
        privateDocEmergencyUnlockRequestedBy: { $ne: null },
        privateDocEmergencyUnlockRequestedAt: {
          $gt: new Date(nowTs - PRIVATE_DOC_EMERGENCY_UNLOCK_REQUEST_WINDOW_MS)
        }
      })
      : (Array.isArray(proMemoryStore.coreUploads)
        ? proMemoryStore.coreUploads.filter(
          (item) =>
            Boolean(item?.isPrivate) &&
            Boolean(toId(item?.privateDocEmergencyUnlockRequestedBy)) &&
            toMs(item?.privateDocEmergencyUnlockRequestedAt) + PRIVATE_DOC_EMERGENCY_UNLOCK_REQUEST_WINDOW_MS > nowTs
        ).length
        : 0);

    return res.json({
      success: true,
      source: usePersistence ? "mongodb" : "memory",
      shield: {
        enabled: Boolean(PRIVATE_DOC_ACCESS_SHIELD_ENABLED),
        persistenceEnabled: Boolean(PRIVATE_DOC_SECURITY_PERSIST_ENABLED),
        adminBypass: Boolean(PRIVATE_DOC_ACCESS_SHIELD_ADMIN_BYPASS),
        dualAdminReleaseRequired: Boolean(PRIVATE_DOC_SHIELD_RELEASE_DUAL_ADMIN_REQUIRED),
        releaseRequestWindowMinutes: Math.max(1, Math.round(PRIVATE_DOC_SHIELD_RELEASE_REQUEST_WINDOW_MS / 60_000)),
        thresholds: {
          windowMinutes: Math.max(1, Math.round(PRIVATE_DOC_ACCESS_SHIELD_WINDOW_MS / 60_000)),
          riskThreshold: PRIVATE_DOC_ACCESS_SHIELD_RISK_THRESHOLD,
          replayThreshold: PRIVATE_DOC_ACCESS_SHIELD_REPLAY_THRESHOLD,
          distinctHashThreshold: PRIVATE_DOC_ACCESS_SHIELD_DISTINCT_HASH_THRESHOLD,
          blockMinMinutes: Math.max(1, Math.round(PRIVATE_DOC_ACCESS_SHIELD_BLOCK_MIN_MS / 60_000)),
          blockMaxMinutes: Math.max(1, Math.round(PRIVATE_DOC_ACCESS_SHIELD_BLOCK_MAX_MS / 60_000)),
          penaltyWindowMinutes: Math.max(1, Math.round(PRIVATE_DOC_ACCESS_SHIELD_PENALTY_WINDOW_MS / 60_000))
        },
        activeBlockCount: activeBlocks.length,
        pendingReleaseRequests: pendingShieldReleaseRequests,
        activeBlocks,
        totalEvents: shieldEvents.length,
        events: shieldEvents.slice(0, limit)
      },
      accessTelemetry: {
        total: accessEvents.length,
        items: accessEvents.slice(0, Math.min(limit, 200))
      },
      autoEmergencyLock: {
        enabled: Boolean(PRIVATE_DOC_AUTO_EMERGENCY_LOCK_ENABLED),
        thresholds: {
          windowMinutes: Math.max(1, Math.round(PRIVATE_DOC_AUTO_EMERGENCY_LOCK_WINDOW_MS / 60_000)),
          eventThreshold: PRIVATE_DOC_AUTO_EMERGENCY_LOCK_THRESHOLD,
          distinctReasonsMin: PRIVATE_DOC_AUTO_EMERGENCY_LOCK_DISTINCT_REASONS_MIN
        },
        trackedUploads: privateDocAutoEmergencyLockProfiles.size,
        emergencyLockedPrivateDocs,
        pendingEmergencyUnlockRequests,
        adminBypass: Boolean(PRIVATE_DOC_EMERGENCY_LOCK_ADMIN_BYPASS),
        dualAdminUnlockRequired: Boolean(PRIVATE_DOC_EMERGENCY_UNLOCK_DUAL_ADMIN_REQUIRED),
        unlockRequestWindowMinutes: Math.max(1, Math.round(PRIVATE_DOC_EMERGENCY_UNLOCK_REQUEST_WINDOW_MS / 60_000))
      }
    });
  } catch (error) {
    return next(error);
  }
}

export async function releaseCorePrivateDocSecurityShield(req, res, next) {
  try {
    const adminId = text(req.coreUser?.id);
    const reason = text(req.body?.reason, "admin-manual-release");
    const releaseApprove =
      String(req.body?.releaseApprove || req.query?.releaseApprove || "false")
        .trim()
        .toLowerCase() === "true";
    const releaseAll =
      String(req.body?.all || req.query?.all || "false").trim().toLowerCase() === "true";
    const nowTs = Date.now();
    const nowIso = new Date(nowTs).toISOString();
    await hydratePrivateDocShieldBlocksFromDb(nowTs);

    if (reason.length < PRIVATE_DOC_SHIELD_RELEASE_REASON_MIN) {
      return res.status(400).json({
        success: false,
        message: `Reason must be at least ${PRIVATE_DOC_SHIELD_RELEASE_REASON_MIN} characters for shield release action.`
      });
    }

    if (releaseAll) {
      if (PRIVATE_DOC_SHIELD_RELEASE_DUAL_ADMIN_REQUIRED) {
        return res.status(409).json({
          success: false,
          message: "all=true is disabled while dual-admin shield release control is enabled."
        });
      }
      const released = await releaseAllPrivateDocAccessShieldActors(adminId, reason);
      return res.json({
        success: true,
        requiresSecondAdmin: false,
        releasedAll: true,
        releasedCount: released.length,
        released,
        activeBlocks: listPrivateDocShieldActiveBlocks(Date.now())
      });
    }

    const actorKey = text(req.body?.actorKey || req.query?.actorKey || req.params?.actorKey);
    if (!actorKey) {
      return res.status(400).json({
        success: false,
        message: "actorKey or all=true is required."
      });
    }

    let activeBlock = privateDocAccessShieldBlocks.get(actorKey) || null;
    if (!activeBlock && canPersistPrivateDocSecurity()) {
      const persisted = await CorePrivateDocShieldBlock.findOne({
        actorKey,
        blockUntil: { $gt: new Date(nowTs) }
      }).lean();
      if (persisted) {
        activeBlock = normalizePersistedShieldBlock(persisted);
        privateDocAccessShieldBlocks.set(actorKey, activeBlock);
      }
    }
    if (!activeBlock) {
      return res.status(404).json({
        success: false,
        message: "Shield block not found for actorKey."
      });
    }

    const releaseRequestState = getPrivateDocShieldReleaseRequestState(activeBlock, nowTs);
    if (PRIVATE_DOC_SHIELD_RELEASE_DUAL_ADMIN_REQUIRED) {
      if (!releaseRequestState.active) {
        await markPrivateDocShieldReleaseRequest({
          actorKey,
          requestedBy: adminId,
          requestedAt: nowIso,
          requestReason: reason
        });
        recordPrivateDocShieldEvent({
          type: "manual-release-requested",
          actorKey,
          reason,
          requestedBy: adminId,
          requestedAt: nowIso,
          previousReason: text(activeBlock?.reason),
          previousBlockLevel: Math.max(1, Math.round(numberValue(activeBlock?.blockLevel, 1))),
          dualControlRequired: true
        });
        return res.status(202).json({
          success: true,
          action: "release-requested",
          requiresSecondAdmin: true,
          releasedAll: false,
          actorKey,
          releaseRequest: {
            requestedBy: adminId,
            requestedAt: nowIso,
            reason,
            windowMinutes: Math.max(1, Math.round(PRIVATE_DOC_SHIELD_RELEASE_REQUEST_WINDOW_MS / 60_000))
          },
          activeBlocks: listPrivateDocShieldActiveBlocks(Date.now())
        });
      }
      if (releaseRequestState.requestedBy === adminId) {
        return res.status(409).json({
          success: false,
          message: "A different admin must confirm shield release request."
        });
      }
      if (!releaseApprove) {
        return res.status(409).json({
          success: false,
          message: "releaseApprove=true is required for second admin confirmation."
        });
      }
    }

    const released = await releasePrivateDocAccessShieldActor(actorKey, adminId, reason, {
      releaseRequestedBy: releaseRequestState.requestedBy,
      releaseRequestedAt: releaseRequestState.requestedAt
    });
    if (!released) {
      return res.status(404).json({
        success: false,
        message: "Shield block not found for actorKey."
      });
    }

    return res.json({
      success: true,
      requiresSecondAdmin: false,
      releasedAll: false,
      released,
      activeBlocks: listPrivateDocShieldActiveBlocks(Date.now())
    });
  } catch (error) {
    return next(error);
  }
}
