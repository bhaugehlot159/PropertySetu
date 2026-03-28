import crypto from "crypto";

const proRateBuckets = new Map();
const proSecurityAuditEvents = [];
const proThreatProfiles = new Map();
const proThreatIncidents = [];

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
const SECURITY_INCIDENT_MAX_ITEMS = Math.max(
  200,
  Number(process.env.SECURITY_INCIDENT_MAX_ITEMS || 1200)
);
const SECURITY_AI_AUTO_DETECT_ENABLED =
  text(process.env.SECURITY_AI_AUTO_DETECT_ENABLED || "true").toLowerCase() !== "false";
const THREAT_SCORE_BLOCK_THRESHOLD = Math.max(
  40,
  Number(process.env.THREAT_SCORE_BLOCK_THRESHOLD || 120)
);
const THREAT_SCORE_ALERT_THRESHOLD = Math.max(
  20,
  Number(process.env.THREAT_SCORE_ALERT_THRESHOLD || 35)
);
const THREAT_SCORE_DECAY_WINDOW_MS = Math.max(
  60_000,
  Number(process.env.THREAT_SCORE_DECAY_WINDOW_MS || 15 * 60 * 1000)
);
const THREAT_BLOCK_DURATION_MS = Math.max(
  60_000,
  Number(process.env.THREAT_BLOCK_DURATION_MS || 30 * 60 * 1000)
);
const THREAT_PROFILE_MAX_SIZE = Math.max(
  200,
  Number(process.env.THREAT_PROFILE_MAX_SIZE || 6000)
);
const THREAT_BURST_WINDOW_MS = Math.max(
  5_000,
  Number(process.env.THREAT_BURST_WINDOW_MS || 60_000)
);
const THREAT_BURST_REQUEST_THRESHOLD = Math.max(
  10,
  Number(process.env.THREAT_BURST_REQUEST_THRESHOLD || 75)
);
const THREAT_SCAN_WINDOW_MS = Math.max(
  30_000,
  Number(process.env.THREAT_SCAN_WINDOW_MS || 5 * 60 * 1000)
);
const THREAT_SCAN_PATH_THRESHOLD = Math.max(
  5,
  Number(process.env.THREAT_SCAN_PATH_THRESHOLD || 30)
);
const THREAT_CREDENTIAL_STUFFING_WINDOW_MS = Math.max(
  60_000,
  Number(process.env.THREAT_CREDENTIAL_STUFFING_WINDOW_MS || 10 * 60 * 1000)
);
const THREAT_CREDENTIAL_STUFFING_IDENTITY_THRESHOLD = Math.max(
  3,
  Number(process.env.THREAT_CREDENTIAL_STUFFING_IDENTITY_THRESHOLD || 15)
);
const THREAT_MANUAL_QUARANTINE_MAX_MS = Math.max(
  THREAT_BLOCK_DURATION_MS,
  Number(process.env.THREAT_MANUAL_QUARANTINE_MAX_MS || 24 * 60 * 60 * 1000)
);
const THREAT_REPEAT_OFFENDER_THRESHOLD = Math.max(
  2,
  Number(process.env.THREAT_REPEAT_OFFENDER_THRESHOLD || 3)
);
const THREAT_REPEAT_OFFENDER_MULTIPLIER = Math.max(
  1.1,
  Number(process.env.THREAT_REPEAT_OFFENDER_MULTIPLIER || 1.8)
);
const THREAT_REPEAT_OFFENDER_MAX_BLOCK_MS = Math.max(
  THREAT_BLOCK_DURATION_MS,
  Number(process.env.THREAT_REPEAT_OFFENDER_MAX_BLOCK_MS || 12 * 60 * 60 * 1000)
);
const THREAT_FINGERPRINT_PATTERN = /^[a-f0-9]{24}$/i;
const API_ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"]);
const API_MAX_PATH_LENGTH = Math.max(
  400,
  Number(process.env.API_MAX_PATH_LENGTH || 2048)
);
const API_MAX_HOST_HEADER_LENGTH = Math.max(
  80,
  Number(process.env.API_MAX_HOST_HEADER_LENGTH || 255)
);
const SUSPICIOUS_KEY_RULES = [/^\$/, /__proto__/i, /^constructor$/i, /^prototype$/i];
const NULL_BYTE_PATTERN = /\0/;
const SUSPICIOUS_USER_AGENT_PATTERNS = [
  /sqlmap/i,
  /nikto/i,
  /acunetix/i,
  /nmap/i,
  /masscan/i,
  /w3af/i,
  /havij/i,
  /python-requests\/\d+/i,
  /curl\/\d+/i,
  /wget\/\d+/i
];
const HONEYPOT_FIELD_NAMES = [
  "website",
  "url",
  "homepage",
  "honeypot",
  "contact_time",
  "middle_name",
  "fax_number",
  "bot_field",
  "hp_token"
];
const ALLOWED_API_CONTENT_TYPES = [
  "application/json",
  "application/x-www-form-urlencoded",
  "multipart/form-data"
];
const THREAT_DETECTION_RULES = [
  {
    id: "sql-injection-pattern",
    score: 55,
    pattern: /\b(?:union\s+select|drop\s+table|insert\s+into|delete\s+from|or\s+1\s*=\s*1|sleep\s*\(|benchmark\s*\()/i
  },
  {
    id: "xss-pattern",
    score: 50,
    pattern: /(?:<script\b|javascript:|onerror\s*=|onload\s*=|<img[^>]+onerror=)/i
  },
  {
    id: "command-injection-pattern",
    score: 60,
    pattern: /(?:\|\||&&|;)\s*(?:curl|wget|bash|sh|powershell|cmd|nc|python)\b/i
  },
  {
    id: "path-traversal-pattern",
    score: 45,
    pattern: /(?:\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\\)/i
  },
  {
    id: "ssti-pattern",
    score: 35,
    pattern: /(?:\{\{.*\}\}|\$\{.*\}|<%=?\s*.*\s*%>)/i
  }
];
const SENSITIVE_PUBLIC_PATH_RULES = [
  /^\/(?:server|backend|database|deploy|docs|scripts|models|legal)(?:\/|$)/i,
  /^\/(?:\.git|\.github|\.vscode|node_modules)(?:\/|$)/i,
  /^\/(?:.*\/)?\.env(?:\..*)?$/i,
  /^\/(?:.*\/)?package-lock\.json$/i,
  /^\/(?:.*\/)?pnpm-lock\.ya?ml$/i,
  /^\/(?:.*\/)?yarn\.lock$/i,
  /^\/database\/.*\.json$/i,
  /^\/server\/.*\.(?:js|mjs|cjs|map)$/i,
  /^\/backend\/.*\.(?:js|mjs|cjs|map)$/i
];
const THREAT_DETECTION_EXCLUDED_PATHS = [
  /^\/api\/health(?:\/|$)/i,
  /^\/api\/v2\/health(?:\/|$)/i,
  /^\/api\/v3\/health(?:\/|$)/i,
  /^\/api\/system\/security-intelligence(?:\/|$)/i,
  /^\/api\/v3\/system\/security-intelligence(?:\/|$)/i
];
const API_SCANNER_PATH_RULES = [
  /^\/api\/(?:wp-admin|wp-login|wordpress)(?:\/|$)/i,
  /^\/api\/(?:phpmyadmin|pma|mysql-admin)(?:\/|$)/i,
  /^\/api\/(?:\.env|config\.php|web\.config)(?:\/|$)/i,
  /^\/api\/(?:vendor\/phpunit|cgi-bin|boaform|actuator|jenkins|hudson)(?:\/|$)/i,
  /^\/api\/(?:server-status|debug\/pprof|_ignition|_profiler)(?:\/|$)/i
];
const API_METHOD_OVERRIDE_HEADERS = [
  "x-http-method-override",
  "x-method-override",
  "x-original-url",
  "x-rewrite-url"
];

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

export function normalizeProSecurityThreatFingerprint(value = "") {
  return text(value).toLowerCase();
}

export function isValidProSecurityThreatFingerprint(value = "") {
  const normalized = normalizeProSecurityThreatFingerprint(value);
  return THREAT_FINGERPRINT_PATTERN.test(normalized);
}

function normalizeContentType(value) {
  return text(value).split(";")[0].trim().toLowerCase();
}

function isApiBodyMethod(method = "") {
  const raw = text(method).toUpperCase();
  return raw === "POST" || raw === "PUT" || raw === "PATCH" || raw === "DELETE";
}

function hasBodyPayload(req) {
  const contentLength = Number(req?.headers?.["content-length"] || 0);
  if (Number.isFinite(contentLength) && contentLength > 0) return true;
  const body = req?.body;
  if (body === null || typeof body === "undefined") return false;
  if (typeof body === "string") return body.trim().length > 0;
  if (Array.isArray(body)) return body.length > 0;
  if (typeof body === "object") return Object.keys(body).length > 0;
  return false;
}

function isSuspiciousUserAgent(req) {
  const ua = text(req?.headers?.["user-agent"]);
  if (!ua) return false;
  return SUSPICIOUS_USER_AGENT_PATTERNS.some((rule) => rule.test(ua));
}

function findHoneypotFieldHit(req) {
  const body = req?.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) return "";
  for (const fieldName of HONEYPOT_FIELD_NAMES) {
    const value = body[fieldName];
    if (!text(value)) continue;
    return fieldName;
  }
  return "";
}

function extractAuthIdentitySample(req) {
  const requestPath = String(req?.originalUrl || req?.path || "");
  if (!requestPath.includes("/auth")) return "";
  const identity = text(
    req?.body?.emailOrPhone || req?.body?.email || req?.body?.phone || req?.body?.mobile
  ).toLowerCase();
  if (!identity) return "";
  return identity.slice(0, 120);
}

function pruneThreatProfiles() {
  if (proThreatProfiles.size <= THREAT_PROFILE_MAX_SIZE) return;
  const entries = [...proThreatProfiles.entries()].sort(
    (a, b) => Number(a[1]?.lastSeenAt || 0) - Number(b[1]?.lastSeenAt || 0)
  );
  const overflow = proThreatProfiles.size - THREAT_PROFILE_MAX_SIZE;
  for (let index = 0; index < overflow; index += 1) {
    const key = entries[index]?.[0];
    if (key) proThreatProfiles.delete(key);
  }
}

function pushThreatIncident(incident = {}) {
  const row = {
    id: `threat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: nowIso(),
    fingerprint: text(incident.fingerprint),
    ip: text(incident.ip),
    requestId: text(incident.requestId),
    path: text(incident.path),
    method: text(incident.method).toUpperCase(),
    riskScore: Math.max(0, Number(incident.riskScore || 0)),
    cumulativeRiskScore: Math.max(0, Number(incident.cumulativeRiskScore || 0)),
    blocked: Boolean(incident.blocked),
    reason: text(incident.reason, "ai-auto-detected-risk"),
    rules: Array.isArray(incident.rules) ? incident.rules.slice(0, 12) : []
  };
  proThreatIncidents.unshift(row);
  if (proThreatIncidents.length > SECURITY_INCIDENT_MAX_ITEMS) {
    proThreatIncidents.length = SECURITY_INCIDENT_MAX_ITEMS;
  }
}

function normalizeThreatPayloadString(value) {
  return text(value).replace(/\s+/g, " ").slice(0, 2000);
}

function collectRequestTextSamples(req) {
  const samples = [];
  const pushSample = (value) => {
    const normalized = normalizeThreatPayloadString(value);
    if (!normalized) return;
    samples.push(normalized);
  };

  const walk = (value, depth = 0) => {
    if (samples.length >= 120) return;
    if (depth > 8) return;
    if (value === null || typeof value === "undefined") return;

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      pushSample(value);
      return;
    }

    if (Array.isArray(value)) {
      value.slice(0, 60).forEach((item) => walk(item, depth + 1));
      return;
    }

    if (typeof value === "object") {
      const keys = Object.keys(value).slice(0, 80);
      keys.forEach((key) => {
        pushSample(key);
        walk(value[key], depth + 1);
      });
    }
  };

  walk(req?.query || {});
  walk(req?.params || {});
  walk(req?.body || {});
  pushSample(req?.originalUrl || req?.path || "");
  pushSample(req?.headers?.["user-agent"] || "");
  return samples;
}

function evaluateThreatScore(req) {
  const samples = collectRequestTextSamples(req);
  const matchedRules = [];
  let score = 0;

  for (const rule of THREAT_DETECTION_RULES) {
    const hit = samples.some((sample) => rule.pattern.test(sample));
    if (!hit) continue;
    matchedRules.push(rule.id);
    score += Number(rule.score || 0);
  }

  const totalPayloadSize = JSON.stringify({
    query: req?.query || {},
    params: req?.params || {},
    body: req?.body || {}
  }).length;
  if (totalPayloadSize > 200_000) score += 20;
  if (text(req?.method).toUpperCase() === "TRACE") score += 20;

  if (isSuspiciousUserAgent(req)) {
    score += 35;
    matchedRules.push("suspicious-user-agent-pattern");
  }

  const honeypotField = findHoneypotFieldHit(req);
  if (honeypotField) {
    score += 55;
    matchedRules.push(`honeypot-field-hit:${honeypotField}`);
  }

  if (isApiBodyMethod(req?.method) && hasBodyPayload(req)) {
    const contentType = normalizeContentType(req?.headers?.["content-type"]);
    const allowed = ALLOWED_API_CONTENT_TYPES.some((item) => contentType.startsWith(item));
    if (!allowed) {
      score += 28;
      matchedRules.push(`unexpected-content-type:${contentType || "missing"}`);
    }
  }

  return {
    score,
    matchedRules,
    totalPayloadSize
  };
}

function nextProfileState(current = {}, nowTs = Date.now()) {
  const previous = {
    riskScore: Math.max(0, Number(current.riskScore || 0)),
    lastSeenAt: Number(current.lastSeenAt || nowTs),
    blockUntil: Number(current.blockUntil || 0),
    incidentCount: Math.max(0, Number(current.incidentCount || 0)),
    recentHits: Array.isArray(current.recentHits) ? current.recentHits : [],
    recentPaths: Array.isArray(current.recentPaths) ? current.recentPaths : [],
    authIdentityTrail: Array.isArray(current.authIdentityTrail) ? current.authIdentityTrail : [],
    quarantineReason: text(current.quarantineReason)
  };
  const elapsed = Math.max(0, nowTs - previous.lastSeenAt);
  const decayFactor = Math.max(0, 1 - elapsed / THREAT_SCORE_DECAY_WINDOW_MS);
  const decayedRisk = Math.round(previous.riskScore * decayFactor);
  return {
    ...previous,
    riskScore: decayedRisk,
    lastSeenAt: nowTs
  };
}

function applyBehaviorSignals({ req, state, nowTs }) {
  const matchedRules = [];
  let score = 0;

  const recentHits = [...state.recentHits, nowTs].filter(
    (stamp) => Number(stamp) >= nowTs - THREAT_BURST_WINDOW_MS
  );
  if (recentHits.length >= THREAT_BURST_REQUEST_THRESHOLD) {
    score += 28;
    matchedRules.push("burst-traffic-pattern");
  }

  const requestPath = text(req?.originalUrl || req?.path || "/");
  const recentPaths = [...state.recentPaths, { path: requestPath, at: nowTs }].filter(
    (item) => Number(item?.at || 0) >= nowTs - THREAT_SCAN_WINDOW_MS
  );
  const distinctPathCount = new Set(recentPaths.map((item) => text(item.path))).size;
  if (distinctPathCount >= THREAT_SCAN_PATH_THRESHOLD) {
    score += 24;
    matchedRules.push("endpoint-scan-pattern");
  }

  const authIdentity = extractAuthIdentitySample(req);
  const authIdentityTrail = [...state.authIdentityTrail];
  if (authIdentity) {
    authIdentityTrail.push({ identity: authIdentity, at: nowTs });
  }
  const normalizedAuthTrail = authIdentityTrail.filter(
    (item) => Number(item?.at || 0) >= nowTs - THREAT_CREDENTIAL_STUFFING_WINDOW_MS
  );
  const distinctIdentityCount = new Set(
    normalizedAuthTrail.map((item) => text(item.identity)).filter(Boolean)
  ).size;
  if (distinctIdentityCount >= THREAT_CREDENTIAL_STUFFING_IDENTITY_THRESHOLD) {
    score += 46;
    matchedRules.push("credential-stuffing-pattern");
  }

  return {
    score,
    matchedRules,
    recentHits,
    recentPaths,
    authIdentityTrail: normalizedAuthTrail
  };
}

export function releaseProSecurityThreatProfile(fingerprint = "") {
  const key = normalizeProSecurityThreatFingerprint(fingerprint);
  if (!isValidProSecurityThreatFingerprint(key)) return null;

  const current = proThreatProfiles.get(key);
  if (!current) return null;

  const nextState = {
    ...current,
    riskScore: Math.max(0, Math.round(Number(current.riskScore || 0) * 0.4)),
    blockUntil: 0,
    quarantineReason: "",
    lastSeenAt: Date.now()
  };
  proThreatProfiles.set(key, nextState);
  pushSecurityAuditEventInternal({
    severity: "medium",
    type: "manual-threat-profile-release",
    fingerprint: key,
    method: "POST",
    path: "/api/system/security-intelligence/release",
    details: {
      riskScore: Math.max(0, Number(nextState.riskScore || 0)),
      incidentCount: Math.max(0, Number(nextState.incidentCount || 0))
    }
  });
  return {
    fingerprint: key,
    riskScore: Math.max(0, Number(nextState.riskScore || 0)),
    blockUntil: 0,
    incidentCount: Math.max(0, Number(nextState.incidentCount || 0)),
    status: "released"
  };
}

export function quarantineProSecurityThreatProfile(
  fingerprint = "",
  {
    durationMs = THREAT_BLOCK_DURATION_MS,
    reason = "manual-admin-quarantine",
    minRiskScore = THREAT_SCORE_BLOCK_THRESHOLD
  } = {}
) {
  const key = normalizeProSecurityThreatFingerprint(fingerprint);
  if (!isValidProSecurityThreatFingerprint(key)) return null;

  const nowTs = Date.now();
  const safeDuration = Math.max(
    60_000,
    Math.min(THREAT_MANUAL_QUARANTINE_MAX_MS, Number(durationMs || THREAT_BLOCK_DURATION_MS))
  );
  const current = nextProfileState(proThreatProfiles.get(key), nowTs);
  const nextState = {
    ...current,
    riskScore: Math.max(
      Math.max(0, Number(current.riskScore || 0)),
      Math.max(1, Number(minRiskScore || THREAT_SCORE_BLOCK_THRESHOLD))
    ),
    blockUntil: nowTs + safeDuration,
    quarantineReason: text(reason, "manual-admin-quarantine"),
    incidentCount: Math.max(0, Number(current.incidentCount || 0)) + 1,
    lastSeenAt: nowTs
  };
  proThreatProfiles.set(key, nextState);
  pruneThreatProfiles();

  pushThreatIncident({
    fingerprint: key,
    ip: "",
    requestId: "",
    path: "manual-admin",
    method: "POST",
    riskScore: 0,
    cumulativeRiskScore: nextState.riskScore,
    blocked: true,
    reason: nextState.quarantineReason,
    rules: ["manual-admin-quarantine"]
  });
  pushSecurityAuditEventInternal({
    severity: "high",
    type: "manual-threat-profile-quarantine",
    fingerprint: key,
    method: "POST",
    path: "/api/system/security-intelligence/quarantine",
    details: {
      riskScore: Math.max(0, Number(nextState.riskScore || 0)),
      blockUntil: nextState.blockUntil,
      reason: nextState.quarantineReason
    }
  });

  return {
    fingerprint: key,
    riskScore: Math.max(0, Number(nextState.riskScore || 0)),
    blockUntil: nextState.blockUntil,
    incidentCount: Math.max(0, Number(nextState.incidentCount || 0)),
    status: "quarantined",
    reason: nextState.quarantineReason
  };
}

export function getProSecurityThreatIntelligence(limit = 200) {
  const safeLimit = Math.min(1000, Math.max(1, toNumber(limit, 200)));
  const incidents = proThreatIncidents.slice(0, safeLimit);
  const hotProfiles = [...proThreatProfiles.entries()]
    .map(([fingerprint, profile]) => ({
      fingerprint,
      riskScore: Math.max(0, Number(profile?.riskScore || 0)),
      blockUntil: Number(profile?.blockUntil || 0),
      incidentCount: Math.max(0, Number(profile?.incidentCount || 0)),
      lastSeenAt: Number(profile?.lastSeenAt || 0),
      quarantineReason: text(profile?.quarantineReason),
      status: Number(profile?.blockUntil || 0) > Date.now() ? "blocked" : "watch"
    }))
    .sort((a, b) => b.riskScore - a.riskScore || b.lastSeenAt - a.lastSeenAt)
    .slice(0, Math.min(200, safeLimit));

  return {
    incidents,
    hotProfiles,
    summary: {
      activeProfiles: proThreatProfiles.size,
      blockedProfiles: hotProfiles.filter((item) => item.blockUntil > Date.now()).length,
      totalIncidents: proThreatIncidents.length
    }
  };
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
  const strictCors =
    text(process.env.STRICT_CORS, "false").toLowerCase() === "true";
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
      if (allowAll && !strictCors) return callback(null, true);
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

function normalizeRequestPath(value) {
  const raw = String(value || "").trim();
  if (!raw) return "/";
  try {
    const decoded = decodeURIComponent(raw);
    const cleaned = decoded.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
    if (!cleaned.startsWith("/")) return `/${cleaned}`;
    return cleaned;
  } catch {
    const cleaned = raw.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
    if (!cleaned.startsWith("/")) return `/${cleaned}`;
    return cleaned;
  }
}

function isSensitivePublicPath(requestPath) {
  const normalized = normalizeRequestPath(requestPath);
  return SENSITIVE_PUBLIC_PATH_RULES.some((rule) => rule.test(normalized));
}

function isThreatDetectionExcludedPath(requestPath) {
  const normalized = normalizeRequestPath(requestPath);
  return THREAT_DETECTION_EXCLUDED_PATHS.some((rule) => rule.test(normalized));
}

function normalizeRequestMethod(value = "") {
  return text(value).toUpperCase();
}

function hasControlChars(value = "") {
  return /[\0\r\n]/.test(String(value || ""));
}

function hasEncodedControlChars(value = "") {
  return /%(?:00|0d|0a)/i.test(String(value || ""));
}

function hasMethodOverrideHeaders(req) {
  return API_METHOD_OVERRIDE_HEADERS.some((headerName) => text(req?.headers?.[headerName]));
}

function hasHeaderSmugglingSignals(req) {
  const transferEncoding = text(req?.headers?.["transfer-encoding"]).toLowerCase();
  const contentLength = text(req?.headers?.["content-length"]);
  if (transferEncoding && contentLength) return true;
  if (hasControlChars(transferEncoding) || hasControlChars(contentLength)) return true;
  return false;
}

function isSuspiciousHostHeader(req) {
  const host = text(req?.headers?.host).toLowerCase();
  if (!host) return false;
  if (host.length > API_MAX_HOST_HEADER_LENGTH) return true;
  if (host.includes(" ") || host.includes("/") || host.includes("@")) return true;
  if (hasControlChars(host)) return true;
  return !/^[a-z0-9.\-:\[\]]+$/i.test(host);
}

function isKnownScannerPath(requestPath = "") {
  const normalized = normalizeRequestPath(requestPath);
  return API_SCANNER_PATH_RULES.some((rule) => rule.test(normalized));
}

function computeAdaptiveBlockDurationMs(incidentCount = 0) {
  const normalizedIncidents = Math.max(0, Number(incidentCount || 0));
  const repeatStep = Math.floor(normalizedIncidents / THREAT_REPEAT_OFFENDER_THRESHOLD);
  const multiplier = Math.pow(THREAT_REPEAT_OFFENDER_MULTIPLIER, repeatStep);
  return Math.max(
    THREAT_BLOCK_DURATION_MS,
    Math.min(
      THREAT_REPEAT_OFFENDER_MAX_BLOCK_MS,
      Math.round(THREAT_BLOCK_DURATION_MS * multiplier)
    )
  );
}

function quarantineByFirewall(req, {
  reason = "firewall-block",
  requestPath = "/api",
  method = "GET",
  riskScore = 70,
  details = {}
} = {}) {
  const fingerprint = requestFingerprint(req);
  const nowTs = Date.now();
  const current = nextProfileState(proThreatProfiles.get(fingerprint), nowTs);
  const incidentCount = Math.max(0, Number(current.incidentCount || 0)) + 1;
  const durationMs = computeAdaptiveBlockDurationMs(incidentCount);
  const nextState = {
    ...current,
    riskScore: Math.max(
      THREAT_SCORE_BLOCK_THRESHOLD,
      Math.max(0, Number(current.riskScore || 0)) + Math.max(0, Number(riskScore || 0))
    ),
    incidentCount,
    blockUntil: nowTs + durationMs,
    lastSeenAt: nowTs,
    quarantineReason: text(reason, "firewall-block")
  };
  proThreatProfiles.set(fingerprint, nextState);
  pruneThreatProfiles();

  pushThreatIncident({
    fingerprint,
    ip: getClientIp(req),
    requestId: req.requestId,
    path: requestPath,
    method,
    riskScore: Math.max(0, Number(riskScore || 0)),
    cumulativeRiskScore: nextState.riskScore,
    blocked: true,
    reason: nextState.quarantineReason,
    rules: [nextState.quarantineReason]
  });

  const retryAfterSec = Math.max(1, Math.ceil(durationMs / 1000));
  pushProSecurityAuditEvent(req, {
    severity: "high",
    type: "request_firewall_blocked",
    details: {
      reason: nextState.quarantineReason,
      requestPath,
      method,
      riskScore: Math.max(0, Number(riskScore || 0)),
      incidentCount,
      retryAfterSec,
      ...details
    }
  });

  return {
    fingerprint,
    retryAfterSec,
    blockUntil: nextState.blockUntil
  };
}

export function proRequestFirewall(req, res, next) {
  const rawPath = String(req.originalUrl || req.baseUrl || req.path || "");
  if (!rawPath.startsWith("/api")) return next();

  const method = normalizeRequestMethod(req.method);
  const pathForChecks = normalizeRequestPath(req.path || rawPath || "/");

  const reject = ({
    reason,
    statusCode = 403,
    riskScore = 70,
    details = {},
    message = "Request blocked by firewall policy."
  }) => {
    const incident = quarantineByFirewall(req, {
      reason,
      requestPath: pathForChecks,
      method,
      riskScore,
      details
    });
    res.setHeader("Retry-After", String(incident.retryAfterSec));
    return res.status(statusCode).json({
      success: false,
      message,
      retryAfterSec: incident.retryAfterSec,
      requestId: req.requestId
    });
  };

  if (!API_ALLOWED_METHODS.has(method)) {
    return reject({
      reason: "firewall-method-not-allowed",
      statusCode: 405,
      riskScore: 95,
      message: "HTTP method is not allowed for this API."
    });
  }

  if (pathForChecks.length > API_MAX_PATH_LENGTH) {
    return reject({
      reason: "firewall-path-too-long",
      statusCode: 414,
      riskScore: 82,
      details: {
        pathLength: pathForChecks.length
      },
      message: "Request path is too long."
    });
  }

  if (hasControlChars(rawPath) || hasEncodedControlChars(rawPath)) {
    return reject({
      reason: "firewall-control-char-path",
      statusCode: 400,
      riskScore: 88,
      message: "Malformed request path blocked by firewall."
    });
  }

  if (isKnownScannerPath(pathForChecks)) {
    return reject({
      reason: "firewall-scanner-path",
      statusCode: 403,
      riskScore: 96,
      message: "Security policy blocked this request path."
    });
  }

  if (hasMethodOverrideHeaders(req)) {
    return reject({
      reason: "firewall-method-override-header",
      statusCode: 400,
      riskScore: 80,
      message: "Method override headers are not permitted."
    });
  }

  if (hasHeaderSmugglingSignals(req)) {
    return reject({
      reason: "firewall-header-smuggling-signal",
      statusCode: 400,
      riskScore: 95,
      message: "Malformed request headers blocked by firewall."
    });
  }

  if (isSuspiciousHostHeader(req)) {
    return reject({
      reason: "firewall-suspicious-host-header",
      statusCode: 400,
      riskScore: 85,
      message: "Suspicious host header blocked by firewall."
    });
  }

  return next();
}

export function proBlockSensitivePublicFiles(req, res, next) {
  const requestPath = normalizeRequestPath(req.path || req.originalUrl || "/");
  if (requestPath.startsWith("/api")) return next();

  if (isSensitivePublicPath(requestPath)) {
    pushProSecurityAuditEvent(req, {
      severity: "high",
      type: "sensitive_public_path_blocked",
      details: {
        requestPath
      }
    });
    return res.status(404).send("Not found");
  }

  return next();
}

export function createProSafeStaticOptions() {
  return {
    dotfiles: "deny",
    index: false,
    setHeaders(res, filePath) {
      const normalized = normalizeRequestPath(filePath);
      if (normalized.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache");
      } else {
        res.setHeader("Cache-Control", "public, max-age=86400");
      }
    }
  };
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

export function proAiThreatAutoDetector(req, res, next) {
  if (!SECURITY_AI_AUTO_DETECT_ENABLED) return next();

  const requestPath = String(req.originalUrl || req.baseUrl || req.path || "");
  if (!requestPath.startsWith("/api")) return next();
  if (isThreatDetectionExcludedPath(requestPath)) return next();

  const fingerprint = requestFingerprint(req);
  const nowTs = Date.now();
  const current = nextProfileState(proThreatProfiles.get(fingerprint), nowTs);

  if (Number(current.blockUntil || 0) > nowTs) {
    const retryAfterSec = Math.max(1, Math.ceil((current.blockUntil - nowTs) / 1000));
    res.setHeader("Retry-After", String(retryAfterSec));
    pushProSecurityAuditEvent(req, {
      severity: "high",
      type: "ai-threat-quarantine-block",
      details: {
        fingerprint,
        retryAfterSec
      }
    });
    return res.status(403).json({
      success: false,
      message: "Request blocked by automated security quarantine.",
      retryAfterSec,
      requestId: req.requestId
    });
  }

  const evaluation = evaluateThreatScore(req);
  const behavior = applyBehaviorSignals({
    req,
    state: current,
    nowTs
  });

  const riskScore = Math.max(0, Number(evaluation.score || 0)) + Math.max(0, Number(behavior.score || 0));
  const matchedRules = [...new Set([
    ...evaluation.matchedRules,
    ...behavior.matchedRules
  ])];

  if (riskScore <= 0) {
    proThreatProfiles.set(fingerprint, {
      ...current,
      recentHits: behavior.recentHits,
      recentPaths: behavior.recentPaths,
      authIdentityTrail: behavior.authIdentityTrail
    });
    pruneThreatProfiles();
    return next();
  }

  const cumulativeRiskScore = Math.max(0, Number(current.riskScore || 0)) + riskScore;
  const shouldQuarantine = cumulativeRiskScore >= THREAT_SCORE_BLOCK_THRESHOLD;
  const projectedIncidentCount = Math.max(0, Number(current.incidentCount || 0)) + 1;
  const quarantineDurationMs = shouldQuarantine
    ? computeAdaptiveBlockDurationMs(projectedIncidentCount)
    : 0;
  const nextState = {
    ...current,
    riskScore: cumulativeRiskScore,
    lastSeenAt: nowTs,
    incidentCount: projectedIncidentCount,
    blockUntil: shouldQuarantine ? nowTs + quarantineDurationMs : Number(current.blockUntil || 0),
    recentHits: behavior.recentHits,
    recentPaths: behavior.recentPaths,
    authIdentityTrail: behavior.authIdentityTrail,
    quarantineReason: shouldQuarantine ? "ai-auto-quarantine" : text(current.quarantineReason)
  };
  proThreatProfiles.set(fingerprint, nextState);
  pruneThreatProfiles();

  if (riskScore >= THREAT_SCORE_ALERT_THRESHOLD || shouldQuarantine) {
    pushThreatIncident({
      fingerprint,
      ip: getClientIp(req),
      requestId: req.requestId,
      path: requestPath,
      method: req.method,
      riskScore,
      cumulativeRiskScore,
      blocked: shouldQuarantine,
      reason: shouldQuarantine ? "ai-auto-quarantine" : "ai-auto-alert",
      rules: matchedRules
    });

    pushProSecurityAuditEvent(req, {
      severity: shouldQuarantine ? "high" : "medium",
      type: shouldQuarantine ? "ai-threat-quarantine" : "ai-threat-alert",
      details: {
        fingerprint,
        riskScore,
        cumulativeRiskScore,
        rules: matchedRules,
        payloadBytes: evaluation.totalPayloadSize,
        quarantineDurationSec: shouldQuarantine ? Math.max(1, Math.ceil(quarantineDurationMs / 1000)) : 0
      }
    });
  }

  if (shouldQuarantine) {
    const retryAfterSec = Math.max(1, Math.ceil(quarantineDurationMs / 1000));
    res.setHeader("Retry-After", String(retryAfterSec));
    return res.status(403).json({
      success: false,
      message: "Request blocked by automated AI threat detection.",
      retryAfterSec,
      requestId: req.requestId
    });
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
