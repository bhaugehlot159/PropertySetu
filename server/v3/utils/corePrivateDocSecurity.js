import crypto from "crypto";

const FALLBACK_PRIVATE_DOC_SECRET = "propertysetu-core-private-doc-secret";
const ACCESS_PATH = "/api/v3/uploads/private-docs/access";
const MAX_TOKEN_TTL_SEC = 60 * 60;
const MIN_TOKEN_TTL_SEC = 30;
const DEFAULT_TOKEN_TTL_SEC = Math.max(
  MIN_TOKEN_TTL_SEC,
  Math.min(
    MAX_TOKEN_TTL_SEC,
    Number(process.env.CORE_PRIVATE_DOC_TOKEN_TTL_SEC || 5 * 60)
  )
);
const CLOCK_SKEW_SEC = Math.max(
  5,
  Math.min(120, Number(process.env.CORE_PRIVATE_DOC_TOKEN_CLOCK_SKEW_SEC || 30))
);
const DOC_HASH_SALT = String(
  process.env.CORE_PRIVATE_DOC_HASH_SALT || "propertysetu-core-private-doc-hash-salt"
).trim();

function text(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeUserAgent(value = "") {
  return text(value).toLowerCase().slice(0, 220);
}

function normalizeIp(value = "") {
  return text(value).toLowerCase();
}

function normalizeIpPrefix(ip = "") {
  const safeIp = normalizeIp(ip);
  if (!safeIp) return "";
  if (safeIp.includes(".")) {
    const segments = safeIp.split(".").slice(0, 3);
    return segments.length ? `${segments.join(".")}.*` : safeIp;
  }
  if (safeIp.includes(":")) {
    const segments = safeIp.split(":").slice(0, 4);
    return segments.length ? `${segments.join(":")}::*` : safeIp;
  }
  return safeIp;
}

function base64UrlEncode(input) {
  const raw = Buffer.isBuffer(input) ? input : Buffer.from(String(input || ""), "utf8");
  return raw
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecodeToBuffer(value = "") {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  if (!normalized) return Buffer.alloc(0);
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  return Buffer.from(padded, "base64");
}

function resolvedPrivateDocSecret() {
  const configured =
    text(process.env.CORE_PRIVATE_DOC_SECRET) ||
    text(process.env.CORE_JWT_SECRET) ||
    text(process.env.JWT_SECRET);
  if (configured) return configured;

  const nodeEnv = text(process.env.NODE_ENV, "development").toLowerCase();
  if (nodeEnv === "production") {
    throw new Error(
      "CORE_PRIVATE_DOC_SECRET (or CORE_JWT_SECRET/JWT_SECRET) must be configured in production."
    );
  }

  return FALLBACK_PRIVATE_DOC_SECRET;
}

function deriveEncryptionKey() {
  return crypto
    .createHash("sha256")
    .update(`${resolvedPrivateDocSecret()}::private-doc-enc`)
    .digest();
}

function hmacPayload(payloadB64 = "") {
  return base64UrlEncode(
    crypto
      .createHmac("sha256", resolvedPrivateDocSecret())
      .update(text(payloadB64))
      .digest()
  );
}

function secureEqual(a = "", b = "") {
  const left = Buffer.from(text(a), "utf8");
  const right = Buffer.from(text(b), "utf8");
  if (!left.length || !right.length || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function encryptSourceUrl(url = "") {
  const safeUrl = text(url);
  if (!safeUrl) return null;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(safeUrl, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    iv: base64UrlEncode(iv),
    data: base64UrlEncode(encrypted),
    tag: base64UrlEncode(tag)
  };
}

function decryptSourceUrl(encrypted = {}) {
  if (!encrypted || typeof encrypted !== "object") return "";
  const iv = base64UrlDecodeToBuffer(encrypted.iv);
  const data = base64UrlDecodeToBuffer(encrypted.data);
  const tag = base64UrlDecodeToBuffer(encrypted.tag);
  if (!iv.length || !data.length || !tag.length) return "";

  const decipher = crypto.createDecipheriv("aes-256-gcm", deriveEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return text(decrypted.toString("utf8"));
}

function toIsoFromEpochSec(epochSec = 0) {
  if (!Number.isFinite(Number(epochSec)) || Number(epochSec) <= 0) return "";
  return new Date(Number(epochSec) * 1000).toISOString();
}

export function hashPrivateDocSourceUrl(url = "") {
  const safeUrl = text(url);
  if (!safeUrl) return "";
  return crypto
    .createHash("sha256")
    .update(`${DOC_HASH_SALT}|${safeUrl}`)
    .digest("hex");
}

export function buildMaskedPrivateDocUrl(url = "") {
  const hash = hashPrivateDocSourceUrl(url);
  if (!hash) return "";
  return `private://doc/${hash.slice(0, 24)}`;
}

export function fingerprintPrivateDocAccessToken(token = "") {
  const raw = text(token);
  if (!raw) return "";
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function computePrivateDocAccessContextHash({
  requestIp = "",
  requestUserAgent = ""
} = {}) {
  const ipPrefix = normalizeIpPrefix(requestIp);
  const normalizedUa = normalizeUserAgent(requestUserAgent);
  if (!ipPrefix && !normalizedUa) return "";
  return crypto
    .createHmac("sha256", resolvedPrivateDocSecret())
    .update(`ctx|${ipPrefix}|${normalizedUa}`)
    .digest("hex");
}

export function buildPrivateDocAccessEnvelope({
  sourceUrl = "",
  ownerId = "",
  propertyId = "",
  uploadId = "",
  docId = "",
  category = "",
  name = "",
  viewerId = "",
  viewerRole = "",
  requestIp = "",
  requestUserAgent = "",
  ttlSec = DEFAULT_TOKEN_TTL_SEC
} = {}) {
  const safeSourceUrl = text(sourceUrl);
  if (!safeSourceUrl) return null;

  const boundedTtlSec = Math.max(
    MIN_TOKEN_TTL_SEC,
    Math.min(MAX_TOKEN_TTL_SEC, Math.round(numberValue(ttlSec, DEFAULT_TOKEN_TTL_SEC)))
  );
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + boundedTtlSec;
  const sourceHash = hashPrivateDocSourceUrl(safeSourceUrl);
  const encryptedSource = encryptSourceUrl(safeSourceUrl);
  if (!encryptedSource) return null;

  const payload = {
    v: 1,
    iat: nowSec,
    exp: expSec,
    jti: crypto.randomUUID(),
    sub: text(viewerId),
    role: text(viewerRole, "buyer").toLowerCase(),
    ownerId: text(ownerId),
    propertyId: text(propertyId),
    uploadId: text(uploadId),
    docId: text(docId, sourceHash.slice(0, 18)),
    category: text(category),
    name: text(name).slice(0, 120),
    hash: sourceHash,
    ctx: computePrivateDocAccessContextHash({
      requestIp,
      requestUserAgent
    }),
    enc: encryptedSource
  };
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signature = hmacPayload(payloadB64);
  const token = `v1.${payloadB64}.${signature}`;

  return {
    token,
    hash: sourceHash,
    maskedUrl: buildMaskedPrivateDocUrl(safeSourceUrl),
    accessPath: ACCESS_PATH,
    expiresAt: toIsoFromEpochSec(expSec),
    expiresInSec: boundedTtlSec
  };
}

export function verifyPrivateDocAccessToken(
  token = "",
  {
    viewerId = "",
    viewerRole = "",
    requestIp = "",
    requestUserAgent = "",
    enforceContextBinding = true
  } = {}
) {
  const raw = text(token);
  if (!raw) {
    return { ok: false, reason: "missing-token" };
  }
  const parts = raw.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") {
    return { ok: false, reason: "invalid-token-format" };
  }

  const payloadB64 = text(parts[1]);
  const signature = text(parts[2]);
  const expectedSignature = hmacPayload(payloadB64);
  if (!secureEqual(signature, expectedSignature)) {
    return { ok: false, reason: "token-signature-mismatch" };
  }

  let payload = null;
  try {
    payload = JSON.parse(base64UrlDecodeToBuffer(payloadB64).toString("utf8"));
  } catch {
    return { ok: false, reason: "token-payload-invalid" };
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, reason: "token-payload-invalid" };
  }
  const tokenId = text(payload.jti);
  if (!tokenId || tokenId.length < 16 || tokenId.length > 120) {
    return { ok: false, reason: "token-id-invalid" };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const issuedAtSec = Math.max(0, Math.round(numberValue(payload.iat, 0)));
  const expiresAtSec = Math.max(0, Math.round(numberValue(payload.exp, 0)));
  if (!issuedAtSec || !expiresAtSec || expiresAtSec <= issuedAtSec) {
    return { ok: false, reason: "token-time-window-invalid" };
  }
  if (issuedAtSec > nowSec + CLOCK_SKEW_SEC) {
    return { ok: false, reason: "token-issued-in-future" };
  }
  if (expiresAtSec + CLOCK_SKEW_SEC < nowSec) {
    return { ok: false, reason: "token-expired" };
  }

  const safeViewerId = text(viewerId);
  const safeViewerRole = text(viewerRole, "buyer").toLowerCase();
  const tokenSubject = text(payload.sub);
  if (!tokenSubject) {
    return { ok: false, reason: "token-subject-missing" };
  }
  if (safeViewerId && safeViewerId !== tokenSubject && safeViewerRole !== "admin") {
    return { ok: false, reason: "token-subject-mismatch" };
  }

  const sourceUrl = decryptSourceUrl(payload.enc);
  if (!sourceUrl) {
    return { ok: false, reason: "token-source-decrypt-failed" };
  }
  const computedHash = hashPrivateDocSourceUrl(sourceUrl);
  if (!computedHash || !secureEqual(computedHash, text(payload.hash))) {
    return { ok: false, reason: "token-source-hash-mismatch" };
  }
  const expectedContextHash = text(payload.ctx);
  const runtimeContextHash = computePrivateDocAccessContextHash({
    requestIp,
    requestUserAgent
  });
  const contextBound = Boolean(expectedContextHash);
  const contextMatch = !contextBound || (runtimeContextHash && secureEqual(runtimeContextHash, expectedContextHash));
  if (Boolean(enforceContextBinding) && contextBound && !contextMatch) {
    return { ok: false, reason: "token-context-mismatch" };
  }

  return {
    ok: true,
    reason: "ok",
    payload: {
      ...payload,
      tokenId,
      hash: computedHash,
      sourceUrl,
      contextBound,
      contextMatch,
      issuedAt: toIsoFromEpochSec(issuedAtSec),
      expiresAt: toIsoFromEpochSec(expiresAtSec),
      expiresInSec: Math.max(0, expiresAtSec - nowSec)
    }
  };
}
