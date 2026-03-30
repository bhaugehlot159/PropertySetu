import crypto from "crypto";

const rateBuckets = new Map();
const rateBlocks = new Map();
const rateScopeMetrics = new Map();
const rateLimiterScopeRegistry = new Map();
const rateLimiterAuditEvents = [];

const CORE_RATE_LIMITER_MAX_BUCKET_KEYS = Math.max(
  200,
  Number(process.env.CORE_RATE_LIMITER_MAX_BUCKET_KEYS || 15_000)
);
const CORE_RATE_LIMITER_MAX_BLOCK_KEYS = Math.max(
  100,
  Number(process.env.CORE_RATE_LIMITER_MAX_BLOCK_KEYS || 8_000)
);
const CORE_RATE_LIMITER_SCOPE_POLICY_MAX = Math.max(
  20,
  Number(process.env.CORE_RATE_LIMITER_SCOPE_POLICY_MAX || 240)
);
const CORE_RATE_LIMITER_AUDIT_MAX = Math.max(
  50,
  Number(process.env.CORE_RATE_LIMITER_AUDIT_MAX || 1_000)
);
const CORE_RATE_LIMITER_PRUNE_INTERVAL_MS = Math.max(
  5_000,
  Number(process.env.CORE_RATE_LIMITER_PRUNE_INTERVAL_MS || 45_000)
);
const CORE_RATE_LIMITER_ACTOR_TRACK_TTL_MS = Math.max(
  60_000,
  Number(process.env.CORE_RATE_LIMITER_ACTOR_TRACK_TTL_MS || 6 * 60 * 60 * 1000)
);

let lastRateLimiterPruneTs = 0;

const coreRateLimiterAdminControls = {
  enabled: String(process.env.CORE_RATE_LIMITER_ENABLED || "true").trim().toLowerCase() !== "false",
  adaptiveBlockingEnabled:
    String(process.env.CORE_RATE_LIMITER_ADAPTIVE_BLOCKING_ENABLED || "true").trim().toLowerCase() !== "false",
  escalationFactor: Math.max(
    1,
    Math.min(4, Number(process.env.CORE_RATE_LIMITER_ESCALATION_FACTOR || 2))
  ),
  baseBlockMs: Math.max(
    10_000,
    Math.min(30 * 60 * 1000, Number(process.env.CORE_RATE_LIMITER_BASE_BLOCK_MS || 120_000))
  ),
  maxBlockMs: Math.max(
    60_000,
    Math.min(24 * 60 * 60 * 1000, Number(process.env.CORE_RATE_LIMITER_MAX_BLOCK_MS || 60 * 60 * 1000))
  ),
  strikeResetMs: Math.max(
    60_000,
    Math.min(7 * 24 * 60 * 60 * 1000, Number(process.env.CORE_RATE_LIMITER_STRIKE_RESET_MS || 6 * 60 * 60 * 1000))
  ),
  staleBucketTtlMs: Math.max(
    60_000,
    Math.min(24 * 60 * 60 * 1000, Number(process.env.CORE_RATE_LIMITER_STALE_BUCKET_TTL_MS || 2 * 60 * 60 * 1000))
  ),
  scopePolicies: {}
};

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

function toIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (Array.isArray(forwarded) && forwarded.length) {
    return text(forwarded[0]).split(",")[0].trim();
  }
  if (text(forwarded)) {
    return text(forwarded).split(",")[0].trim();
  }
  return text(req.ip || req.socket?.remoteAddress || "0.0.0.0");
}

function toActorHash(value = "") {
  const safe = text(value, "anonymous");
  return crypto.createHash("sha256").update(safe).digest("hex").slice(0, 20);
}

function pruneWindow(record, nowTs, windowMs) {
  if (!record || !Array.isArray(record.hits)) return [];
  const minTs = nowTs - windowMs;
  return record.hits.filter((ts) => Number(ts) >= minTs);
}

function trimMapByTimestamp(mapRef, maxItems, timestampSelector) {
  if (!(mapRef instanceof Map) || mapRef.size <= maxItems) return;
  const ordered = [...mapRef.entries()]
    .map(([key, value]) => ({
      key,
      ts: Math.max(0, Math.round(numberValue(timestampSelector(value), 0)))
    }))
    .sort((a, b) => a.ts - b.ts);
  const removeCount = Math.max(0, mapRef.size - maxItems);
  for (let i = 0; i < removeCount; i += 1) {
    const item = ordered[i];
    if (!item) continue;
    mapRef.delete(item.key);
  }
}

function registerRateLimiterScope(scope = "", defaults = {}) {
  const safeScope = text(scope, "core").toLowerCase();
  const current = rateLimiterScopeRegistry.get(safeScope) || {};
  rateLimiterScopeRegistry.set(safeScope, {
    ...current,
    scope: safeScope,
    defaultLimit: Math.max(1, Math.round(numberValue(defaults.defaultLimit, current.defaultLimit || 60))),
    defaultWindowMs: Math.max(
      1_000,
      Math.round(numberValue(defaults.defaultWindowMs, current.defaultWindowMs || 60_000))
    ),
    defaultMessage: text(defaults.defaultMessage, current.defaultMessage || "Too many requests. Please try again shortly."),
    updatedAt: new Date().toISOString()
  });
}

function sanitizeRateLimiterScopePolicy(value = {}) {
  const safe = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const out = {};
  if (typeof safe.enabled !== "undefined") {
    out.enabled = toBoolean(safe.enabled, true);
  }
  if (typeof safe.adaptiveBlockingEnabled !== "undefined") {
    out.adaptiveBlockingEnabled = toBoolean(safe.adaptiveBlockingEnabled, true);
  }
  if (typeof safe.limit !== "undefined") {
    out.limit = Math.max(1, Math.min(5_000, Math.round(numberValue(safe.limit, 60))));
  }
  if (typeof safe.windowMs !== "undefined") {
    out.windowMs = Math.max(1_000, Math.min(24 * 60 * 60 * 1000, Math.round(numberValue(safe.windowMs, 60_000))));
  }
  if (typeof safe.baseBlockMs !== "undefined") {
    out.baseBlockMs = Math.max(
      5_000,
      Math.min(30 * 60 * 1000, Math.round(numberValue(safe.baseBlockMs, coreRateLimiterAdminControls.baseBlockMs)))
    );
  }
  if (typeof safe.maxBlockMs !== "undefined") {
    out.maxBlockMs = Math.max(
      10_000,
      Math.min(24 * 60 * 60 * 1000, Math.round(numberValue(safe.maxBlockMs, coreRateLimiterAdminControls.maxBlockMs)))
    );
  }
  return out;
}

function resolveRateLimiterPolicy(scope = "", defaults = {}) {
  const safeScope = text(scope, "core").toLowerCase();
  const override =
    coreRateLimiterAdminControls.scopePolicies &&
    typeof coreRateLimiterAdminControls.scopePolicies === "object" &&
    !Array.isArray(coreRateLimiterAdminControls.scopePolicies)
      ? coreRateLimiterAdminControls.scopePolicies[safeScope]
      : null;
  const normalizedOverride = sanitizeRateLimiterScopePolicy(override);
  const limit = Math.max(
    1,
    Math.min(
      5_000,
      Math.round(numberValue(normalizedOverride.limit, numberValue(defaults.limit, 60)))
    )
  );
  const windowMs = Math.max(
    1_000,
    Math.min(
      24 * 60 * 60 * 1000,
      Math.round(numberValue(normalizedOverride.windowMs, numberValue(defaults.windowMs, 60_000)))
    )
  );
  const baseBlockMs = Math.max(
    5_000,
    Math.min(
      30 * 60 * 1000,
      Math.round(numberValue(normalizedOverride.baseBlockMs, coreRateLimiterAdminControls.baseBlockMs))
    )
  );
  const maxBlockMs = Math.max(
    baseBlockMs,
    Math.min(
      24 * 60 * 60 * 1000,
      Math.round(numberValue(normalizedOverride.maxBlockMs, coreRateLimiterAdminControls.maxBlockMs))
    )
  );
  return {
    scope: safeScope,
    enabled:
      toBoolean(normalizedOverride.enabled, true) && toBoolean(coreRateLimiterAdminControls.enabled, true),
    adaptiveBlockingEnabled:
      toBoolean(normalizedOverride.adaptiveBlockingEnabled, coreRateLimiterAdminControls.adaptiveBlockingEnabled) &&
      toBoolean(coreRateLimiterAdminControls.adaptiveBlockingEnabled, true),
    limit,
    windowMs,
    baseBlockMs,
    maxBlockMs,
    message: text(defaults.message, "Too many requests. Please try again shortly.")
  };
}

function ensureRateLimiterMetric(scope = "") {
  const safeScope = text(scope, "core").toLowerCase();
  let metric = rateScopeMetrics.get(safeScope);
  if (!metric) {
    metric = {
      scope: safeScope,
      allowedCount: 0,
      deniedCount: 0,
      deniedByBlockCount: 0,
      lastAllowedAt: null,
      lastDeniedAt: null,
      lastDeniedReason: "",
      actorTouches: new Map(),
      updatedAtTs: Date.now()
    };
    rateScopeMetrics.set(safeScope, metric);
  }
  return metric;
}

function touchRateLimiterMetric(scope = "", actorHash = "", { denied = false, deniedByBlock = false, reason = "" } = {}) {
  const metric = ensureRateLimiterMetric(scope);
  const nowIso = new Date().toISOString();
  const nowTs = Date.now();
  if (denied) {
    metric.deniedCount += 1;
    if (deniedByBlock) metric.deniedByBlockCount += 1;
    metric.lastDeniedAt = nowIso;
    metric.lastDeniedReason = text(reason).slice(0, 120);
  } else {
    metric.allowedCount += 1;
    metric.lastAllowedAt = nowIso;
  }
  if (actorHash) {
    metric.actorTouches.set(actorHash, nowTs);
    if (metric.actorTouches.size > CORE_RATE_LIMITER_MAX_BUCKET_KEYS) {
      trimMapByTimestamp(metric.actorTouches, CORE_RATE_LIMITER_MAX_BUCKET_KEYS, (value) => value);
    }
  }
  metric.updatedAtTs = nowTs;
}

function sanitizeRateLimiterMetric(metric = {}, nowTs = Date.now()) {
  const touches =
    metric.actorTouches instanceof Map
      ? [...metric.actorTouches.values()].filter((ts) => Number(ts) + CORE_RATE_LIMITER_ACTOR_TRACK_TTL_MS > nowTs)
      : [];
  return {
    scope: text(metric.scope).toLowerCase(),
    allowedCount: Math.max(0, Math.round(numberValue(metric.allowedCount, 0))),
    deniedCount: Math.max(0, Math.round(numberValue(metric.deniedCount, 0))),
    deniedByBlockCount: Math.max(0, Math.round(numberValue(metric.deniedByBlockCount, 0))),
    lastAllowedAt: text(metric.lastAllowedAt),
    lastDeniedAt: text(metric.lastDeniedAt),
    lastDeniedReason: text(metric.lastDeniedReason),
    uniqueActorsRecent: touches.length
  };
}

function pushRateLimiterAuditEvent(event = {}) {
  const item = {
    id: `rate-audit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    occurredAt: new Date().toISOString(),
    type: text(event.type, "unknown"),
    scope: text(event.scope).toLowerCase(),
    actorId: text(event.actorId),
    actorRole: text(event.actorRole),
    actorHash: text(event.actorHash),
    metadata:
      event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
        ? event.metadata
        : {}
  };
  rateLimiterAuditEvents.unshift(item);
  if (rateLimiterAuditEvents.length > CORE_RATE_LIMITER_AUDIT_MAX) {
    rateLimiterAuditEvents.length = CORE_RATE_LIMITER_AUDIT_MAX;
  }
}

function pruneRateLimiterState(nowTs = Date.now()) {
  if (lastRateLimiterPruneTs && lastRateLimiterPruneTs + CORE_RATE_LIMITER_PRUNE_INTERVAL_MS > nowTs) {
    return;
  }
  lastRateLimiterPruneTs = nowTs;

  for (const [scopedKey, bucket] of rateBuckets.entries()) {
    const scope = text(scopedKey.split(":")[0], "core").toLowerCase();
    const registry = rateLimiterScopeRegistry.get(scope) || {};
    const policy = resolveRateLimiterPolicy(scope, {
      limit: numberValue(registry.defaultLimit, 60),
      windowMs: numberValue(registry.defaultWindowMs, 60_000),
      message: registry.defaultMessage
    });
    const hits = pruneWindow(bucket, nowTs, policy.windowMs);
    const lastSeenTs = Math.max(0, Math.round(numberValue(bucket?.lastSeenTs, 0)));
    if (
      !hits.length &&
      lastSeenTs + Math.max(policy.windowMs, coreRateLimiterAdminControls.staleBucketTtlMs) <= nowTs
    ) {
      rateBuckets.delete(scopedKey);
      continue;
    }
    rateBuckets.set(scopedKey, { hits, lastSeenTs: lastSeenTs || nowTs });
  }

  for (const [scopedKey, block] of rateBlocks.entries()) {
    const blockedUntilTs = Math.max(0, Math.round(numberValue(block?.blockedUntilTs, 0)));
    const lastViolationAtTs = Math.max(0, Math.round(numberValue(block?.lastViolationAtTs, 0)));
    if (blockedUntilTs <= nowTs && lastViolationAtTs + coreRateLimiterAdminControls.strikeResetMs <= nowTs) {
      rateBlocks.delete(scopedKey);
    }
  }

  for (const metric of rateScopeMetrics.values()) {
    if (!(metric.actorTouches instanceof Map)) continue;
    for (const [actorHash, seenAt] of metric.actorTouches.entries()) {
      if (Number(seenAt) + CORE_RATE_LIMITER_ACTOR_TRACK_TTL_MS <= nowTs) {
        metric.actorTouches.delete(actorHash);
      }
    }
  }

  trimMapByTimestamp(rateBuckets, CORE_RATE_LIMITER_MAX_BUCKET_KEYS, (value) => numberValue(value?.lastSeenTs, 0));
  trimMapByTimestamp(
    rateBlocks,
    CORE_RATE_LIMITER_MAX_BLOCK_KEYS,
    (value) => Math.max(numberValue(value?.blockedUntilTs, 0), numberValue(value?.lastViolationAtTs, 0))
  );
  trimMapByTimestamp(rateScopeMetrics, CORE_RATE_LIMITER_SCOPE_POLICY_MAX, (value) => numberValue(value?.updatedAtTs, 0));
}

function getRateLimiterDefaultScopeConfig(scope = "") {
  const safeScope = text(scope, "core").toLowerCase();
  const registry = rateLimiterScopeRegistry.get(safeScope) || {};
  return {
    scope: safeScope,
    limit: Math.max(1, Math.round(numberValue(registry.defaultLimit, 60))),
    windowMs: Math.max(1_000, Math.round(numberValue(registry.defaultWindowMs, 60_000))),
    message: text(registry.defaultMessage, "Too many requests. Please try again shortly.")
  };
}

export function getCoreRateLimiterSecurityState({
  includeAudit = true,
  auditLimit = 120
} = {}) {
  const nowTs = Date.now();
  pruneRateLimiterState(nowTs);
  const scopes = [...new Set([
    ...rateLimiterScopeRegistry.keys(),
    ...rateScopeMetrics.keys(),
    ...Object.keys(coreRateLimiterAdminControls.scopePolicies || {})
  ])].sort();

  const byScope = scopes.map((scope) => {
    const defaults = getRateLimiterDefaultScopeConfig(scope);
    const policy = resolveRateLimiterPolicy(scope, defaults);
    const metric = sanitizeRateLimiterMetric(ensureRateLimiterMetric(scope), nowTs);
    const activeBlocks = [...rateBlocks.values()].filter(
      (item) => text(item.scope).toLowerCase() === scope && numberValue(item.blockedUntilTs, 0) > nowTs
    );
    return {
      scope,
      defaults: {
        limit: defaults.limit,
        windowMs: defaults.windowMs
      },
      effectivePolicy: {
        enabled: Boolean(policy.enabled),
        adaptiveBlockingEnabled: Boolean(policy.adaptiveBlockingEnabled),
        limit: policy.limit,
        windowMs: policy.windowMs,
        baseBlockMs: policy.baseBlockMs,
        maxBlockMs: policy.maxBlockMs
      },
      metrics: metric,
      activeBlocks: activeBlocks.length
    };
  });

  return {
    controls: {
      enabled: Boolean(coreRateLimiterAdminControls.enabled),
      adaptiveBlockingEnabled: Boolean(coreRateLimiterAdminControls.adaptiveBlockingEnabled),
      escalationFactor: Math.max(1, Math.min(4, Number(coreRateLimiterAdminControls.escalationFactor || 2))),
      baseBlockMs: Math.max(5_000, Math.round(numberValue(coreRateLimiterAdminControls.baseBlockMs, 120_000))),
      maxBlockMs: Math.max(10_000, Math.round(numberValue(coreRateLimiterAdminControls.maxBlockMs, 60 * 60 * 1000))),
      strikeResetMs: Math.max(60_000, Math.round(numberValue(coreRateLimiterAdminControls.strikeResetMs, 6 * 60 * 60 * 1000))),
      staleBucketTtlMs: Math.max(60_000, Math.round(numberValue(coreRateLimiterAdminControls.staleBucketTtlMs, 2 * 60 * 60 * 1000))),
      scopePolicies: coreRateLimiterAdminControls.scopePolicies || {}
    },
    totals: {
      bucketKeys: rateBuckets.size,
      blockKeys: rateBlocks.size,
      registeredScopes: rateLimiterScopeRegistry.size,
      scopeMetrics: rateScopeMetrics.size
    },
    scopes: byScope,
    activeBlocks: [...rateBlocks.values()]
      .filter((item) => numberValue(item.blockedUntilTs, 0) > nowTs)
      .map((item) => ({
        scope: text(item.scope).toLowerCase(),
        actorHash: text(item.actorHash),
        strikes: Math.max(1, Math.round(numberValue(item.strikes, 1))),
        blockedUntil: new Date(Math.max(0, numberValue(item.blockedUntilTs, nowTs))).toISOString(),
        retryAfterSec: Math.max(1, Math.ceil((Math.max(0, numberValue(item.blockedUntilTs, nowTs)) - nowTs) / 1000)),
        lastViolationAt: new Date(Math.max(0, numberValue(item.lastViolationAtTs, nowTs))).toISOString()
      }))
      .slice(0, 500),
    audit: includeAudit
      ? rateLimiterAuditEvents.slice(0, Math.max(1, Math.min(500, Math.round(numberValue(auditLimit, 120)))))
      : []
  };
}

export function updateCoreRateLimiterSecurityControls(
  patch = {},
  { actorId = "", actorRole = "" } = {}
) {
  const safePatch =
    patch && typeof patch === "object" && !Array.isArray(patch) ? patch : {};
  const controlsPatch =
    safePatch.controls && typeof safePatch.controls === "object" && !Array.isArray(safePatch.controls)
      ? safePatch.controls
      : safePatch;

  if (typeof controlsPatch.enabled !== "undefined") {
    coreRateLimiterAdminControls.enabled = toBoolean(controlsPatch.enabled, coreRateLimiterAdminControls.enabled);
  }
  if (typeof controlsPatch.adaptiveBlockingEnabled !== "undefined") {
    coreRateLimiterAdminControls.adaptiveBlockingEnabled = toBoolean(
      controlsPatch.adaptiveBlockingEnabled,
      coreRateLimiterAdminControls.adaptiveBlockingEnabled
    );
  }
  if (typeof controlsPatch.escalationFactor !== "undefined") {
    coreRateLimiterAdminControls.escalationFactor = Math.max(
      1,
      Math.min(4, Number(controlsPatch.escalationFactor || coreRateLimiterAdminControls.escalationFactor))
    );
  }
  if (typeof controlsPatch.baseBlockMs !== "undefined") {
    coreRateLimiterAdminControls.baseBlockMs = Math.max(
      5_000,
      Math.min(30 * 60 * 1000, Math.round(numberValue(controlsPatch.baseBlockMs, coreRateLimiterAdminControls.baseBlockMs)))
    );
  }
  if (typeof controlsPatch.maxBlockMs !== "undefined") {
    coreRateLimiterAdminControls.maxBlockMs = Math.max(
      coreRateLimiterAdminControls.baseBlockMs,
      Math.min(24 * 60 * 60 * 1000, Math.round(numberValue(controlsPatch.maxBlockMs, coreRateLimiterAdminControls.maxBlockMs)))
    );
  }
  if (typeof controlsPatch.strikeResetMs !== "undefined") {
    coreRateLimiterAdminControls.strikeResetMs = Math.max(
      60_000,
      Math.min(7 * 24 * 60 * 60 * 1000, Math.round(numberValue(controlsPatch.strikeResetMs, coreRateLimiterAdminControls.strikeResetMs)))
    );
  }
  if (typeof controlsPatch.staleBucketTtlMs !== "undefined") {
    coreRateLimiterAdminControls.staleBucketTtlMs = Math.max(
      60_000,
      Math.min(24 * 60 * 60 * 1000, Math.round(numberValue(controlsPatch.staleBucketTtlMs, coreRateLimiterAdminControls.staleBucketTtlMs)))
    );
  }

  const nextScopePolicies = {
    ...(coreRateLimiterAdminControls.scopePolicies || {})
  };
  if (toBoolean(safePatch.resetScopePolicies, false)) {
    Object.keys(nextScopePolicies).forEach((scope) => {
      delete nextScopePolicies[scope];
    });
  }
  if (safePatch.scopePolicies && typeof safePatch.scopePolicies === "object" && !Array.isArray(safePatch.scopePolicies)) {
    for (const [scopeRaw, value] of Object.entries(safePatch.scopePolicies)) {
      const scope = text(scopeRaw).toLowerCase();
      if (!scope) continue;
      if (value === null) {
        delete nextScopePolicies[scope];
        continue;
      }
      nextScopePolicies[scope] = sanitizeRateLimiterScopePolicy(value);
    }
  }
  coreRateLimiterAdminControls.scopePolicies = Object.fromEntries(
    Object.entries(nextScopePolicies).slice(0, CORE_RATE_LIMITER_SCOPE_POLICY_MAX)
  );

  pruneRateLimiterState(Date.now());
  const state = getCoreRateLimiterSecurityState({
    includeAudit: false
  });
  pushRateLimiterAuditEvent({
    type: "rate-limiter-control-updated",
    actorId,
    actorRole,
    metadata: {
      controlsUpdated: true,
      scopePolicies: Object.keys(coreRateLimiterAdminControls.scopePolicies || {}).length
    }
  });
  return {
    updated: true,
    state
  };
}

export function resetCoreRateLimiterSecurityState({
  scope = "",
  clearBuckets = true,
  clearBlocks = true,
  clearMetrics = false,
  clearAudit = false,
  clearScopePolicy = false,
  actorId = "",
  actorRole = ""
} = {}) {
  const safeScope = text(scope).toLowerCase();
  let removedBuckets = 0;
  let removedBlocks = 0;
  let removedMetrics = 0;

  const bucketKeys = [...rateBuckets.keys()];
  for (const key of bucketKeys) {
    if (!clearBuckets) break;
    const keyScope = text(key.split(":")[0]).toLowerCase();
    if (!safeScope || keyScope === safeScope) {
      rateBuckets.delete(key);
      removedBuckets += 1;
    }
  }

  const blockKeys = [...rateBlocks.keys()];
  for (const key of blockKeys) {
    if (!clearBlocks) break;
    const keyScope = text(key.split(":")[0]).toLowerCase();
    if (!safeScope || keyScope === safeScope) {
      rateBlocks.delete(key);
      removedBlocks += 1;
    }
  }

  if (clearMetrics) {
    const scopeKeys = [...rateScopeMetrics.keys()];
    for (const key of scopeKeys) {
      if (!safeScope || key === safeScope) {
        rateScopeMetrics.delete(key);
        removedMetrics += 1;
      }
    }
  }

  if (clearScopePolicy) {
    if (!safeScope) {
      coreRateLimiterAdminControls.scopePolicies = {};
    } else if (coreRateLimiterAdminControls.scopePolicies[safeScope]) {
      delete coreRateLimiterAdminControls.scopePolicies[safeScope];
    }
  }

  if (clearAudit) {
    rateLimiterAuditEvents.length = 0;
  }

  pushRateLimiterAuditEvent({
    type: "rate-limiter-state-reset",
    scope: safeScope,
    actorId,
    actorRole,
    metadata: {
      removedBuckets,
      removedBlocks,
      removedMetrics,
      clearAudit: Boolean(clearAudit),
      clearScopePolicy: Boolean(clearScopePolicy)
    }
  });

  return {
    reset: true,
    scope: safeScope || "all",
    removedBuckets,
    removedBlocks,
    removedMetrics,
    clearedAudit: Boolean(clearAudit),
    clearedScopePolicy: Boolean(clearScopePolicy),
    state: getCoreRateLimiterSecurityState({ includeAudit: false })
  };
}

export function createCoreRateLimiter({
  scope = "core",
  limit = 60,
  windowMs = 60_000,
  keyBuilder = () => "anonymous",
  message = "Too many requests. Please try again shortly."
} = {}) {
  const safeScope = text(scope, "core").toLowerCase();
  const safeLimit = Math.max(1, Number(limit) || 1);
  const safeWindowMs = Math.max(1_000, Number(windowMs) || 60_000);
  registerRateLimiterScope(safeScope, {
    defaultLimit: safeLimit,
    defaultWindowMs: safeWindowMs,
    defaultMessage: message
  });

  return (req, res, next) => {
    const nowTs = Date.now();
    pruneRateLimiterState(nowTs);
    const rawKey = `${text(keyBuilder(req), "anonymous")}`;
    const scopedKey = `${safeScope}:${rawKey}`;
    const actorHash = toActorHash(scopedKey);

    const policy = resolveRateLimiterPolicy(safeScope, {
      limit: safeLimit,
      windowMs: safeWindowMs,
      message
    });
    if (!policy.enabled) {
      return next();
    }

    const activeBlock = rateBlocks.get(scopedKey);
    if (activeBlock && numberValue(activeBlock.blockedUntilTs, 0) > nowTs) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((numberValue(activeBlock.blockedUntilTs, nowTs) - nowTs) / 1000)
      );
      touchRateLimiterMetric(safeScope, actorHash, {
        denied: true,
        deniedByBlock: true,
        reason: "active-block"
      });
      res.setHeader("Retry-After", String(retryAfterSec));
      return res.status(429).json({
        success: false,
        message: policy.message,
        retryAfterSec,
        shield: {
          active: true,
          adaptive: Boolean(policy.adaptiveBlockingEnabled),
          strikes: Math.max(1, Math.round(numberValue(activeBlock.strikes, 1)))
        }
      });
    }
    if (activeBlock && numberValue(activeBlock.blockedUntilTs, 0) <= nowTs) {
      rateBlocks.delete(scopedKey);
    }

    const currentBucket = rateBuckets.get(scopedKey) || { hits: [], lastSeenTs: nowTs };
    const hits = pruneWindow(currentBucket, nowTs, policy.windowMs);

    if (hits.length >= policy.limit) {
      const oldestInWindow = Math.min(...hits);
      const windowRetryAfterSec = Math.max(
        1,
        Math.ceil((policy.windowMs - (nowTs - oldestInWindow)) / 1000)
      );

      const previousBlock = rateBlocks.get(scopedKey);
      const recentStrike =
        previousBlock &&
        numberValue(previousBlock.lastViolationAtTs, 0) + coreRateLimiterAdminControls.strikeResetMs > nowTs;
      const strikes = recentStrike
        ? Math.max(1, Math.round(numberValue(previousBlock.strikes, 1))) + 1
        : 1;

      const escalationMultiplier = Math.pow(
        coreRateLimiterAdminControls.escalationFactor,
        Math.max(0, strikes - 1)
      );
      const adaptiveBlockMs = policy.adaptiveBlockingEnabled
        ? Math.max(
            policy.baseBlockMs,
            Math.min(
              policy.maxBlockMs,
              Math.round(policy.baseBlockMs * escalationMultiplier)
            )
          )
        : 0;

      let retryAfterSec = windowRetryAfterSec;
      if (policy.adaptiveBlockingEnabled && adaptiveBlockMs > 0) {
        const blockedUntilTs = nowTs + adaptiveBlockMs;
        rateBlocks.set(scopedKey, {
          scope: safeScope,
          actorHash,
          strikes,
          blockedUntilTs,
          createdAtTs: numberValue(previousBlock?.createdAtTs, nowTs),
          lastViolationAtTs: nowTs
        });
        retryAfterSec = Math.max(retryAfterSec, Math.max(1, Math.ceil(adaptiveBlockMs / 1000)));
      }

      touchRateLimiterMetric(safeScope, actorHash, {
        denied: true,
        deniedByBlock: policy.adaptiveBlockingEnabled,
        reason: policy.adaptiveBlockingEnabled ? "adaptive-block" : "window-limit"
      });
      pushRateLimiterAuditEvent({
        type: "rate-limiter-denied",
        scope: safeScope,
        actorHash,
        metadata: {
          limit: policy.limit,
          windowMs: policy.windowMs,
          retryAfterSec,
          adaptiveBlockingEnabled: Boolean(policy.adaptiveBlockingEnabled),
          strikes
        }
      });

      res.setHeader("Retry-After", String(retryAfterSec));
      return res.status(429).json({
        success: false,
        message: policy.message,
        retryAfterSec,
        shield: {
          active: Boolean(policy.adaptiveBlockingEnabled),
          adaptive: Boolean(policy.adaptiveBlockingEnabled),
          strikes
        }
      });
    }

    hits.push(nowTs);
    rateBuckets.set(scopedKey, { hits, lastSeenTs: nowTs });
    touchRateLimiterMetric(safeScope, actorHash, { denied: false });
    return next();
  };
}

export const coreSealedBidSubmitLimiter = createCoreRateLimiter({
  scope: "sealed-bid-submit",
  limit: 8,
  windowMs: 10 * 60 * 1000,
  keyBuilder: (req) => `${text(req.coreUser?.id, "anon")}:${toIp(req)}`,
  message: "Too many bid submissions. Please wait before trying again."
});

export const coreSealedBidReadLimiter = createCoreRateLimiter({
  scope: "sealed-bid-read",
  limit: 180,
  windowMs: 60 * 1000,
  keyBuilder: (req) => `${text(req.coreUser?.id, "anon")}:${toIp(req)}`,
  message: "Too many sealed bid requests. Please retry after a short pause."
});

export const coreSealedBidAdminDecisionLimiter = createCoreRateLimiter({
  scope: "sealed-bid-admin-decision",
  limit: 40,
  windowMs: 10 * 60 * 1000,
  keyBuilder: (req) => `${text(req.coreUser?.id, "admin")}:${toIp(req)}`,
  message: "Too many admin decisions in a short duration. Please retry after a short pause."
});

export const coreAuthRegisterLimiter = createCoreRateLimiter({
  scope: "auth-register",
  limit: Math.max(5, Number(process.env.CORE_AUTH_REGISTER_RATE_LIMIT || 20)),
  windowMs: 10 * 60 * 1000,
  keyBuilder: (req) => `${toIp(req)}:register`,
  message: "Too many signup requests. Please retry later."
});

export const coreAuthLoginLimiter = createCoreRateLimiter({
  scope: "auth-login",
  limit: Math.max(8, Number(process.env.CORE_AUTH_LOGIN_RATE_LIMIT || 40)),
  windowMs: 10 * 60 * 1000,
  keyBuilder: (req) => `${toIp(req)}:${text(req.body?.emailOrPhone || req.body?.email || req.body?.phone, "unknown")}`,
  message: "Too many login attempts. Please wait and retry."
});

export const coreAuthOtpRequestLimiter = createCoreRateLimiter({
  scope: "auth-request-otp",
  limit: Math.max(4, Number(process.env.CORE_AUTH_OTP_REQUEST_RATE_LIMIT || 12)),
  windowMs: 10 * 60 * 1000,
  keyBuilder: (req) => `${toIp(req)}:${text(req.body?.emailOrPhone || req.body?.email || req.body?.phone, "unknown")}`,
  message: "Too many OTP requests. Please wait before requesting again."
});

export const coreAuthOtpVerifyLimiter = createCoreRateLimiter({
  scope: "auth-login-otp",
  limit: Math.max(6, Number(process.env.CORE_AUTH_OTP_VERIFY_RATE_LIMIT || 25)),
  windowMs: 10 * 60 * 1000,
  keyBuilder: (req) => `${toIp(req)}:${text(req.body?.emailOrPhone || req.body?.email || req.body?.phone, "unknown")}`,
  message: "Too many OTP verification attempts. Please retry later."
});

export const coreAuthLogoutLimiter = createCoreRateLimiter({
  scope: "auth-logout",
  limit: Math.max(10, Number(process.env.CORE_AUTH_LOGOUT_RATE_LIMIT || 60)),
  windowMs: 10 * 60 * 1000,
  keyBuilder: (req) => `${text(req.coreUser?.id, "anon")}:${toIp(req)}`,
  message: "Too many logout requests. Please retry shortly."
});

export const coreChatSendLimiter = createCoreRateLimiter({
  scope: "chat-send",
  limit: Math.max(15, Number(process.env.CORE_CHAT_SEND_RATE_LIMIT || 90)),
  windowMs: 10 * 60 * 1000,
  keyBuilder: (req) => `${text(req.coreUser?.id, "anon")}:${toIp(req)}`,
  message: "Too many chat messages in a short duration. Please slow down."
});

export const coreUploadWriteLimiter = createCoreRateLimiter({
  scope: "upload-write",
  limit: Math.max(6, Number(process.env.CORE_UPLOAD_WRITE_RATE_LIMIT || 40)),
  windowMs: 10 * 60 * 1000,
  keyBuilder: (req) => `${text(req.coreUser?.id, "anon")}:${toIp(req)}`,
  message: "Too many upload attempts. Please retry after a short pause."
});

export const corePropertyWriteLimiter = createCoreRateLimiter({
  scope: "property-write",
  limit: Math.max(8, Number(process.env.CORE_PROPERTY_WRITE_RATE_LIMIT || 45)),
  windowMs: 10 * 60 * 1000,
  keyBuilder: (req) => `${text(req.coreUser?.id, "anon")}:${toIp(req)}`,
  message: "Too many property create/update requests. Please retry shortly."
});

export const corePropertyModerationLimiter = createCoreRateLimiter({
  scope: "property-moderation-admin",
  limit: Math.max(10, Number(process.env.CORE_PROPERTY_MODERATION_RATE_LIMIT || 80)),
  windowMs: 10 * 60 * 1000,
  keyBuilder: (req) => `${text(req.coreUser?.id, "admin")}:${toIp(req)}`,
  message: "Too many property moderation actions. Please retry shortly."
});

export const coreUploadPrivateDocAccessLimiter = createCoreRateLimiter({
  scope: "upload-private-doc-access",
  limit: Math.max(10, Number(process.env.CORE_UPLOAD_PRIVATE_DOC_ACCESS_RATE_LIMIT || 120)),
  windowMs: 10 * 60 * 1000,
  keyBuilder: (req) => `${text(req.coreUser?.id, "anon")}:${toIp(req)}`,
  message: "Too many private document access attempts. Please retry shortly."
});

export const coreAiRequestLimiter = createCoreRateLimiter({
  scope: "ai-request",
  limit: Math.max(20, Number(process.env.CORE_AI_REQUEST_RATE_LIMIT || 120)),
  windowMs: 5 * 60 * 1000,
  keyBuilder: (req) => `${text(req.coreUser?.id, "anon")}:${toIp(req)}`,
  message: "AI request limit reached. Please retry after a short pause."
});

export const coreSystemSecurityControlLimiter = createCoreRateLimiter({
  scope: "system-security-control-admin",
  limit: Math.max(30, Number(process.env.CORE_SYSTEM_SECURITY_CONTROL_RATE_LIMIT || 240)),
  windowMs: 10 * 60 * 1000,
  keyBuilder: (req) => `${text(req.coreUser?.id, "admin")}:${toIp(req)}`,
  message: "Too many admin security-control requests. Please retry after a short pause."
});

export const coreUploadPrivateDocSecurityAdminLimiter = createCoreRateLimiter({
  scope: "upload-private-doc-security-admin",
  limit: Math.max(12, Number(process.env.CORE_UPLOAD_PRIVATE_DOC_SECURITY_ADMIN_RATE_LIMIT || 120)),
  windowMs: 10 * 60 * 1000,
  keyBuilder: (req) => `${text(req.coreUser?.id, "admin")}:${toIp(req)}`,
  message: "Too many private document security admin actions. Please retry after a short pause."
});
