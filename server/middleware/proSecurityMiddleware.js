import crypto from "crypto";

const proRateBuckets = new Map();
const proSecurityAuditEvents = [];

const SECURITY_AUDIT_MAX_ITEMS = Math.max(
  200,
  Number(process.env.SECURITY_AUDIT_MAX_ITEMS || 1000)
);
const SECURITY_MAX_OBJECT_DEPTH = Math.max(
  5,
  Number(process.env.SECURITY_MAX_OBJECT_DEPTH || 12)
);
const SECURITY_MAX_OBJECT_NODES = Math.max(
  100,
  Number(process.env.SECURITY_MAX_OBJECT_NODES || 4000)
);
const SUSPICIOUS_KEY_RULES = [/^\$/, /__proto__/i, /^constructor$/i, /^prototype$/i];
const NULL_BYTE_PATTERN = /\0/;

function text(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nowIso() {
  return new Date().toISOString();
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function getForwardedIp(req) {
  const forwarded = req?.headers?.["x-forwarded-for"];
  if (Array.isArray(forwarded) && forwarded.length) {
    return text(forwarded[0]).split(",")[0].trim();
  }
  if (text(forwarded)) {
    return text(forwarded).split(",")[0].trim();
  }
  return "";
}

export function getClientIp(req) {
  return (
    getForwardedIp(req) ||
    text(req?.ip || req?.socket?.remoteAddress || "0.0.0.0")
  );
}

function sanitizeRequestId(value) {
  const cleaned = text(value)
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .slice(0, 80);
  return cleaned;
}

function requestFingerprint(req) {
  const ip = getClientIp(req);
  const ua = text(req?.headers?.["user-agent"]).slice(0, 256);
  return sha256(`${ip}|${ua}`).slice(0, 24);
}

function pushSecurityAuditEventInternal(event = {}) {
  const row = {
    id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: nowIso(),
    severity: text(event.severity, "medium").toLowerCase(),
    type: text(event.type, "general"),
    requestId: text(event.requestId),
    ip: text(event.ip),
    fingerprint: text(event.fingerprint),
    path: text(event.path),
    method: text(event.method).toUpperCase(),
    details: event.details && typeof event.details === "object" ? event.details : {}
  };
  proSecurityAuditEvents.unshift(row);
  if (proSecurityAuditEvents.length > SECURITY_AUDIT_MAX_ITEMS) {
    proSecurityAuditEvents.length = SECURITY_AUDIT_MAX_ITEMS;
  }
}

export function pushProSecurityAuditEvent(req, payload = {}) {
  pushSecurityAuditEventInternal({
    ...payload,
    requestId: text(payload.requestId || req?.requestId),
    ip: text(payload.ip || getClientIp(req)),
    fingerprint: text(payload.fingerprint || requestFingerprint(req)),
    path: text(payload.path || req?.originalUrl || req?.path),
    method: text(payload.method || req?.method)
  });
}

export function getProSecurityAuditEvents(limit = 200) {
  const safeLimit = Math.min(1000, Math.max(1, toNumber(limit, 200)));
  return proSecurityAuditEvents.slice(0, safeLimit);
}

function looksLikeAllowedLocalhostOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(
    text(origin)
  );
}

export function createProCorsOptions() {
  const raw = text(process.env.CORS_ORIGIN);
  const allowAll = !raw || raw === "*";
  const allowLocalhost =
    text(process.env.CORS_ALLOW_LOCALHOST, "true").toLowerCase() !== "false";
  const allowList = new Set(
    raw
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );

  return {
    credentials: true,
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowAll) return callback(null, true);
      if (allowList.has(origin)) return callback(null, true);
      if (allowLocalhost && looksLikeAllowedLocalhostOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Origin blocked by CORS policy."));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "X-Requested-With",
      "X-Request-Id"
    ],
    exposedHeaders: ["X-Request-Id", "Retry-After", "X-RateLimit-Limit", "X-RateLimit-Remaining"]
  };
}

function isSecureRequest(req) {
  const forwardedProto = text(req?.headers?.["x-forwarded-proto"]).toLowerCase();
  if (forwardedProto.includes("https")) return true;
  return text(req?.protocol).toLowerCase() === "https";
}

export function proAttachRequestContext(req, res, next) {
  const incoming = sanitizeRequestId(req?.headers?.["x-request-id"]);
  const requestId = incoming || crypto.randomUUID();
  req.requestId = requestId;
  req.requestStartedAt = Date.now();
  req.clientIp = getClientIp(req);
  res.setHeader("X-Request-Id", requestId);
  next();
}

export function proSecurityHeaders(req, res, next) {
  const requestPath = String(req.originalUrl || req.baseUrl || req.path || "");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  res.setHeader("Origin-Agent-Cluster", "?1");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
  );

  if (isSecureRequest(req)) {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }

  if (requestPath.startsWith("/api")) {
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
    );
  }

  if (
    requestPath.includes("/auth/") ||
    requestPath.startsWith("/api/auth")
  ) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }

  next();
}

function scanPayloadValue(value, state, contextPath = "$", depth = 0) {
  if (state.nodeCount >= SECURITY_MAX_OBJECT_NODES) {
    return {
      blocked: true,
      reason: "payload-node-limit-exceeded",
      path: contextPath
    };
  }

  state.nodeCount += 1;

  if (depth > SECURITY_MAX_OBJECT_DEPTH) {
    return {
      blocked: true,
      reason: "payload-depth-limit-exceeded",
      path: contextPath
    };
  }

  if (value === null || typeof value === "undefined") {
    return { blocked: false };
  }

  if (typeof value === "string") {
    if (NULL_BYTE_PATTERN.test(value)) {
      return { blocked: true, reason: "null-byte-detected", path: contextPath };
    }
    return { blocked: false };
  }

  if (typeof value !== "object") {
    return { blocked: false };
  }

  if (state.visited.has(value)) {
    return { blocked: false };
  }
  state.visited.add(value);

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const itemPath = `${contextPath}[${index}]`;
      const result = scanPayloadValue(value[index], state, itemPath, depth + 1);
      if (result.blocked) return result;
    }
    return { blocked: false };
  }

  const keys = Object.keys(value);
  for (const key of keys) {
    if (SUSPICIOUS_KEY_RULES.some((rule) => rule.test(key))) {
      return {
        blocked: true,
        reason: "suspicious-object-key",
        path: `${contextPath}.${key}`
      };
    }
    const result = scanPayloadValue(
      value[key],
      state,
      `${contextPath}.${key}`,
      depth + 1
    );
    if (result.blocked) return result;
  }

  return { blocked: false };
}

export function proApiPayloadGuard(req, res, next) {
  const requestPath = String(req.originalUrl || req.baseUrl || req.path || "");
  if (!requestPath.startsWith("/api")) {
    return next();
  }

  const payloadSegments = [
    { label: "query", value: req.query },
    { label: "params", value: req.params },
    { label: "body", value: req.body }
  ];

  for (const segment of payloadSegments) {
    const state = {
      visited: new WeakSet(),
      nodeCount: 0
    };
    const result = scanPayloadValue(segment.value, state, segment.label, 0);
    if (result.blocked) {
      pushProSecurityAuditEvent(req, {
        severity: "high",
        type: "payload_blocked",
        details: {
          segment: segment.label,
          reason: result.reason,
          path: result.path
        }
      });

      return res.status(400).json({
        success: false,
        message: "Suspicious payload rejected by security policy.",
        requestId: req.requestId
      });
    }
  }

  return next();
}

export function createProRateLimiter({
  scope = "api",
  limit = 120,
  windowMs = 60_000,
  keyBuilder = (req) => getClientIp(req),
  message = "Too many requests. Please retry after a short pause."
} = {}) {
  const safeLimit = Math.max(1, toNumber(limit, 120));
  const safeWindowMs = Math.max(1000, toNumber(windowMs, 60_000));

  return (req, res, next) => {
    const key = `${text(scope)}:${text(keyBuilder(req), "anonymous")}`;
    const nowTs = Date.now();
    const minTs = nowTs - safeWindowMs;

    const current = proRateBuckets.get(key) || { hits: [] };
    const hits = (Array.isArray(current.hits) ? current.hits : []).filter(
      (stamp) => Number(stamp) >= minTs
    );

    res.setHeader("X-RateLimit-Limit", String(safeLimit));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, safeLimit - hits.length)));

    if (hits.length >= safeLimit) {
      const oldest = Math.min(...hits);
      const retryAfterSec = Math.max(
        1,
        Math.ceil((safeWindowMs - (nowTs - oldest)) / 1000)
      );
      res.setHeader("Retry-After", String(retryAfterSec));
      pushProSecurityAuditEvent(req, {
        severity: "medium",
        type: "rate_limit_exceeded",
        details: {
          scope: text(scope),
          retryAfterSec
        }
      });
      return res.status(429).json({
        success: false,
        message,
        retryAfterSec,
        requestId: req.requestId
      });
    }

    hits.push(nowTs);
    proRateBuckets.set(key, { hits });
    return next();
  };
}

export const proApiRateLimiter = createProRateLimiter({
  scope: "api-global",
  limit: Math.max(60, toNumber(process.env.API_RATE_LIMIT_PER_MINUTE, 240)),
  windowMs: 60_000,
  keyBuilder: (req) => `${getClientIp(req)}:${requestFingerprint(req)}`,
  message: "API rate limit exceeded. Please slow down and retry."
});

export const proAuthRateLimiter = createProRateLimiter({
  scope: "api-auth",
  limit: Math.max(8, toNumber(process.env.AUTH_RATE_LIMIT_PER_10_MIN, 30)),
  windowMs: 10 * 60 * 1000,
  keyBuilder: (req) => `${getClientIp(req)}:${text(req.path)}`,
  message: "Too many authentication attempts. Please retry later."
});

export const proSensitiveWriteRateLimiter = createProRateLimiter({
  scope: "api-sensitive-write",
  limit: Math.max(10, toNumber(process.env.SENSITIVE_WRITE_RATE_LIMIT_PER_10_MIN, 80)),
  windowMs: 10 * 60 * 1000,
  keyBuilder: (req) => `${getClientIp(req)}:${requestFingerprint(req)}`,
  message: "Too many write operations in a short window. Please retry later."
});
