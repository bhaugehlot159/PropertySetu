import crypto from "crypto";

const FALLBACK_PRIVATE_DOC_SECRET = "propertysetu-core-private-doc-secret";
const FALLBACK_PRIVATE_DOC_SECONDARY_SECRET = "propertysetu-core-private-doc-secondary-secret";
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
const CORE_PRIVATE_DOC_CRYPTO_KEYRING_MAX = Math.max(
  1,
  Math.min(20, Number(process.env.CORE_PRIVATE_DOC_CRYPTO_KEYRING_MAX || 8))
);
const CORE_PRIVATE_DOC_CRYPTO_DEFAULT_ACTIVE_KEY_ID = String(
  process.env.CORE_PRIVATE_DOC_ACTIVE_KEY_ID || "legacy-v1"
)
  .trim()
  .toLowerCase();
const CORE_PRIVATE_DOC_CRYPTO_ALLOW_LEGACY_TOKEN_FORMAT_DEFAULT =
  String(process.env.CORE_PRIVATE_DOC_ALLOW_LEGACY_TOKEN_FORMAT || "true")
    .trim()
    .toLowerCase() !== "false";
const CORE_PRIVATE_DOC_CRYPTO_LEGACY_DECRYPT_ENABLED_DEFAULT =
  String(process.env.CORE_PRIVATE_DOC_LEGACY_DECRYPT_ENABLED || "true")
    .trim()
    .toLowerCase() !== "false";

function text(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  const normalized = text(value).toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return fallback;
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
  const raw = Buffer.isBuffer(input)
    ? input
    : Buffer.from(String(input || ""), "utf8");
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

function normalizeKeyId(value = "") {
  const normalized = text(value)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized.slice(0, 64);
}

function normalizeSecret(value = "") {
  return String(value || "").trim();
}

function fingerprintSecret(secret = "") {
  const safeSecret = normalizeSecret(secret);
  if (!safeSecret) return "";
  return crypto.createHash("sha256").update(safeSecret).digest("hex").slice(0, 16);
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

function resolvedPrivateDocSecondarySecret() {
  const secondary =
    text(process.env.CORE_PRIVATE_DOC_SECONDARY_SECRET) ||
    text(process.env.CORE_JWT_SECONDARY_SECRET) ||
    text(process.env.JWT_SECONDARY_SECRET);
  if (secondary) return secondary;
  const nodeEnv = text(process.env.NODE_ENV, "development").toLowerCase();
  if (nodeEnv === "production") return "";
  return FALLBACK_PRIVATE_DOC_SECONDARY_SECRET;
}

function parseKeyringFromEnv() {
  const keyring = {};

  const envJson = text(process.env.CORE_PRIVATE_DOC_KEYRING_JSON);
  if (envJson) {
    try {
      const parsed = JSON.parse(envJson);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        for (const [rawKeyId, rawSecret] of Object.entries(parsed)) {
          const keyId = normalizeKeyId(rawKeyId);
          const secret = normalizeSecret(rawSecret);
          if (!keyId || !secret) continue;
          keyring[keyId] = secret;
        }
      }
    } catch {
      // Ignore invalid keyring JSON and continue with fallback keys.
    }
  }

  const legacyPrimaryKeyId = normalizeKeyId(
    text(process.env.CORE_PRIVATE_DOC_PRIMARY_KEY_ID, CORE_PRIVATE_DOC_CRYPTO_DEFAULT_ACTIVE_KEY_ID)
  );
  keyring[legacyPrimaryKeyId || "legacy-v1"] = resolvedPrivateDocSecret();

  const secondarySecret = resolvedPrivateDocSecondarySecret();
  if (secondarySecret) {
    const secondaryKeyId = normalizeKeyId(
      text(process.env.CORE_PRIVATE_DOC_SECONDARY_KEY_ID, "legacy-v0")
    );
    if (secondaryKeyId && secondaryKeyId !== legacyPrimaryKeyId) {
      keyring[secondaryKeyId] = secondarySecret;
    }
  }

  const entries = Object.entries(keyring).slice(0, CORE_PRIVATE_DOC_CRYPTO_KEYRING_MAX);
  return Object.fromEntries(entries);
}

const configuredPrivateDocKeyring = parseKeyringFromEnv();
const configuredPrivateDocKeyIds = Object.keys(configuredPrivateDocKeyring);

function resolveInitialActiveKeyId() {
  const requested = normalizeKeyId(CORE_PRIVATE_DOC_CRYPTO_DEFAULT_ACTIVE_KEY_ID);
  if (requested && configuredPrivateDocKeyring[requested]) return requested;
  return configuredPrivateDocKeyIds[0] || "legacy-v1";
}

const defaultPrivateDocCryptoControl = {
  activeKeyId: resolveInitialActiveKeyId(),
  allowLegacyTokenFormat: CORE_PRIVATE_DOC_CRYPTO_ALLOW_LEGACY_TOKEN_FORMAT_DEFAULT,
  legacyDecryptEnabled: CORE_PRIVATE_DOC_CRYPTO_LEGACY_DECRYPT_ENABLED_DEFAULT,
  updatedAt: new Date().toISOString(),
  updatedBy: "runtime-default"
};

let privateDocCryptoControl = {
  ...defaultPrivateDocCryptoControl
};

function resolveActiveKeyId(candidate = "") {
  const requested = normalizeKeyId(candidate);
  if (requested && configuredPrivateDocKeyring[requested]) return requested;
  return resolveInitialActiveKeyId();
}

function resolveCorePrivateDocCryptoState() {
  const activeKeyId = resolveActiveKeyId(privateDocCryptoControl.activeKeyId);
  return {
    activeKeyId,
    activeKeySecret: configuredPrivateDocKeyring[activeKeyId] || resolvedPrivateDocSecret(),
    keyring: configuredPrivateDocKeyring,
    keyIds: Object.keys(configuredPrivateDocKeyring),
    allowLegacyTokenFormat: toBoolean(
      privateDocCryptoControl.allowLegacyTokenFormat,
      CORE_PRIVATE_DOC_CRYPTO_ALLOW_LEGACY_TOKEN_FORMAT_DEFAULT
    ),
    legacyDecryptEnabled: toBoolean(
      privateDocCryptoControl.legacyDecryptEnabled,
      CORE_PRIVATE_DOC_CRYPTO_LEGACY_DECRYPT_ENABLED_DEFAULT
    ),
    updatedAt: text(privateDocCryptoControl.updatedAt),
    updatedBy: text(privateDocCryptoControl.updatedBy)
  };
}

function deriveEncryptionKey(secret = "") {
  return crypto
    .createHash("sha256")
    .update(`${normalizeSecret(secret)}::private-doc-enc`)
    .digest();
}

function hmacPayload(payloadB64 = "", secret = "") {
  return base64UrlEncode(
    crypto
      .createHmac("sha256", normalizeSecret(secret))
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

function encryptSourceUrl(url = "", keyId = "") {
  const safeUrl = text(url);
  if (!safeUrl) return null;

  const state = resolveCorePrivateDocCryptoState();
  const kid = resolveActiveKeyId(keyId || state.activeKeyId);
  const secret = state.keyring[kid] || state.activeKeySecret;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveEncryptionKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(safeUrl, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    kid,
    iv: base64UrlEncode(iv),
    data: base64UrlEncode(encrypted),
    tag: base64UrlEncode(tag)
  };
}

function tryDecryptSourceUrlWithSecret(encrypted = {}, secret = "") {
  const iv = base64UrlDecodeToBuffer(encrypted.iv);
  const data = base64UrlDecodeToBuffer(encrypted.data);
  const tag = base64UrlDecodeToBuffer(encrypted.tag);
  if (!iv.length || !data.length || !tag.length) return "";
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    deriveEncryptionKey(secret),
    iv
  );
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return text(decrypted.toString("utf8"));
}

function decryptSourceUrl(encrypted = {}) {
  if (!encrypted || typeof encrypted !== "object") return "";
  const state = resolveCorePrivateDocCryptoState();
  const requestedKid = normalizeKeyId(encrypted.kid);
  const keyCandidates = [];

  if (requestedKid && state.keyring[requestedKid]) {
    keyCandidates.push(state.keyring[requestedKid]);
  }
  if (!requestedKid || toBoolean(state.legacyDecryptEnabled, true)) {
    keyCandidates.push(state.activeKeySecret);
    for (const keyId of state.keyIds) {
      if (keyId === requestedKid) continue;
      const secret = state.keyring[keyId];
      if (secret) keyCandidates.push(secret);
    }
  }

  const dedupedSecrets = [...new Set(keyCandidates.map((item) => normalizeSecret(item)).filter(Boolean))];
  for (const secret of dedupedSecrets) {
    try {
      const decrypted = tryDecryptSourceUrlWithSecret(encrypted, secret);
      if (decrypted) return decrypted;
    } catch {
      // Try next key for backward-compatible decrypt support.
    }
  }
  return "";
}

function toIsoFromEpochSec(epochSec = 0) {
  if (!Number.isFinite(Number(epochSec)) || Number(epochSec) <= 0) return "";
  return new Date(Number(epochSec) * 1000).toISOString();
}

function parseTokenSignatureInputs(token = "") {
  const raw = text(token);
  if (!raw) {
    return { ok: false, reason: "missing-token" };
  }
  const parts = raw.split(".");
  const state = resolveCorePrivateDocCryptoState();

  if (parts.length === 4 && parts[0] === "v2") {
    const signatureKeyId = normalizeKeyId(parts[1]);
    const payloadB64 = text(parts[2]);
    const signature = text(parts[3]);
    if (!signatureKeyId || !payloadB64 || !signature) {
      return { ok: false, reason: "invalid-token-format" };
    }
    const keySecret = state.keyring[signatureKeyId];
    if (!keySecret) {
      return { ok: false, reason: "unknown-signature-key" };
    }
    return {
      ok: true,
      tokenFormat: "v2",
      signatureKeyId,
      payloadB64,
      signature,
      signatureSecrets: [{ keyId: signatureKeyId, secret: keySecret }]
    };
  }

  if (parts.length === 3 && parts[0] === "v1") {
    if (!toBoolean(state.allowLegacyTokenFormat, true)) {
      return { ok: false, reason: "legacy-token-format-disabled" };
    }
    const payloadB64 = text(parts[1]);
    const signature = text(parts[2]);
    if (!payloadB64 || !signature) {
      return { ok: false, reason: "invalid-token-format" };
    }
    const secrets = state.keyIds
      .map((keyId) => ({
        keyId,
        secret: state.keyring[keyId]
      }))
      .filter((item) => Boolean(item.secret));
    return {
      ok: true,
      tokenFormat: "v1",
      signatureKeyId: "",
      payloadB64,
      signature,
      signatureSecrets: secrets
    };
  }

  return { ok: false, reason: "invalid-token-format" };
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

export function getCorePrivateDocCryptoControlState() {
  const state = resolveCorePrivateDocCryptoState();
  return {
    activeKeyId: state.activeKeyId,
    allowLegacyTokenFormat: Boolean(state.allowLegacyTokenFormat),
    legacyDecryptEnabled: Boolean(state.legacyDecryptEnabled),
    keyIds: state.keyIds.slice(0, CORE_PRIVATE_DOC_CRYPTO_KEYRING_MAX),
    keyFingerprints: state.keyIds.reduce((acc, keyId) => {
      acc[keyId] = fingerprintSecret(state.keyring[keyId]);
      return acc;
    }, {}),
    rotationReady: state.keyIds.length > 1,
    updatedAt: state.updatedAt,
    updatedBy: state.updatedBy
  };
}

export function updateCorePrivateDocCryptoControlState(
  patch = {},
  { actorId = "", actorRole = "", source = "runtime-update" } = {}
) {
  const safePatch =
    patch && typeof patch === "object" && !Array.isArray(patch) ? patch : {};
  const current = resolveCorePrivateDocCryptoState();
  const requestedActiveKeyId =
    typeof safePatch.activeKeyId === "undefined"
      ? current.activeKeyId
      : normalizeKeyId(safePatch.activeKeyId);

  if (!requestedActiveKeyId || !configuredPrivateDocKeyring[requestedActiveKeyId]) {
    return {
      updated: false,
      error: "activeKeyId is not available in configured keyring.",
      availableKeyIds: current.keyIds,
      state: getCorePrivateDocCryptoControlState()
    };
  }

  privateDocCryptoControl = {
    activeKeyId: requestedActiveKeyId,
    allowLegacyTokenFormat:
      typeof safePatch.allowLegacyTokenFormat === "undefined"
        ? current.allowLegacyTokenFormat
        : toBoolean(safePatch.allowLegacyTokenFormat, current.allowLegacyTokenFormat),
    legacyDecryptEnabled:
      typeof safePatch.legacyDecryptEnabled === "undefined"
        ? current.legacyDecryptEnabled
        : toBoolean(safePatch.legacyDecryptEnabled, current.legacyDecryptEnabled),
    updatedAt: new Date().toISOString(),
    updatedBy: text(actorId || actorRole, source)
  };

  return {
    updated: true,
    state: getCorePrivateDocCryptoControlState()
  };
}

export function resetCorePrivateDocCryptoControlState(
  { actorId = "", actorRole = "", source = "runtime-reset" } = {}
) {
  privateDocCryptoControl = {
    ...defaultPrivateDocCryptoControl,
    updatedAt: new Date().toISOString(),
    updatedBy: text(actorId || actorRole, source)
  };
  return {
    reset: true,
    state: getCorePrivateDocCryptoControlState()
  };
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
  accessEpoch = 1,
  purpose = "access",
  accessPath = ACCESS_PATH,
  ttlSec = DEFAULT_TOKEN_TTL_SEC
} = {}) {
  const safeSourceUrl = text(sourceUrl);
  if (!safeSourceUrl) return null;

  const state = resolveCorePrivateDocCryptoState();
  const boundedTtlSec = Math.max(
    MIN_TOKEN_TTL_SEC,
    Math.min(MAX_TOKEN_TTL_SEC, Math.round(numberValue(ttlSec, DEFAULT_TOKEN_TTL_SEC)))
  );
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + boundedTtlSec;
  const sourceHash = hashPrivateDocSourceUrl(safeSourceUrl);
  const encryptedSource = encryptSourceUrl(safeSourceUrl, state.activeKeyId);
  if (!encryptedSource) return null;

  const payload = {
    v: 2,
    iat: nowSec,
    exp: expSec,
    jti: crypto.randomUUID(),
    sub: text(viewerId),
    role: text(viewerRole, "buyer").toLowerCase(),
    ownerId: text(ownerId),
    propertyId: text(propertyId),
    uploadId: text(uploadId),
    docId: text(docId, sourceHash.slice(0, 18)),
    epoch: Math.max(1, Math.round(numberValue(accessEpoch, 1))),
    category: text(category),
    name: text(name).slice(0, 120),
    purpose: text(purpose, "access").toLowerCase().slice(0, 32),
    hash: sourceHash,
    sigKid: state.activeKeyId,
    ctx: computePrivateDocAccessContextHash({
      requestIp,
      requestUserAgent
    }),
    enc: encryptedSource
  };
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signature = hmacPayload(payloadB64, state.activeKeySecret);
  const token = `v2.${state.activeKeyId}.${payloadB64}.${signature}`;

  return {
    token,
    hash: sourceHash,
    maskedUrl: buildMaskedPrivateDocUrl(safeSourceUrl),
    accessPath: text(accessPath, ACCESS_PATH),
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
    enforceContextBinding = true,
    allowedPurposes = ["access"]
  } = {}
) {
  const tokenInfo = parseTokenSignatureInputs(token);
  if (!tokenInfo.ok) {
    return { ok: false, reason: tokenInfo.reason || "invalid-token-format" };
  }

  let signatureVerified = false;
  let verifiedSignatureKeyId = "";
  for (const item of tokenInfo.signatureSecrets) {
    const expectedSignature = hmacPayload(tokenInfo.payloadB64, item.secret);
    if (secureEqual(tokenInfo.signature, expectedSignature)) {
      signatureVerified = true;
      verifiedSignatureKeyId = item.keyId;
      break;
    }
  }
  if (!signatureVerified) {
    return { ok: false, reason: "token-signature-mismatch" };
  }

  let payload = null;
  try {
    payload = JSON.parse(base64UrlDecodeToBuffer(tokenInfo.payloadB64).toString("utf8"));
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
  const tokenPurpose = text(payload.purpose, "access").toLowerCase();
  const tokenEpoch = Math.max(1, Math.round(numberValue(payload.epoch, 1)));
  const allowed = Array.isArray(allowedPurposes)
    ? allowedPurposes
        .map((item) => text(item).toLowerCase())
        .filter((item) => Boolean(item))
    : [];
  const allowedSet = new Set(allowed.length ? allowed : ["access"]);
  if (!allowedSet.has(tokenPurpose)) {
    return { ok: false, reason: "token-purpose-mismatch" };
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
  const contextMatch =
    !contextBound ||
    (runtimeContextHash && secureEqual(runtimeContextHash, expectedContextHash));
  if (Boolean(enforceContextBinding) && contextBound && !contextMatch) {
    return { ok: false, reason: "token-context-mismatch" };
  }

  return {
    ok: true,
    reason: "ok",
    payload: {
      ...payload,
      tokenId,
      tokenFormat: tokenInfo.tokenFormat,
      verifiedSignatureKeyId,
      purpose: tokenPurpose,
      epoch: tokenEpoch,
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
