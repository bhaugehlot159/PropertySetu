const rateBuckets = new Map();

function text(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
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

function pruneWindow(record, nowTs, windowMs) {
  if (!record || !Array.isArray(record.hits)) return [];
  const minTs = nowTs - windowMs;
  return record.hits.filter((ts) => Number(ts) >= minTs);
}

export function createCoreRateLimiter({
  scope = "core",
  limit = 60,
  windowMs = 60_000,
  keyBuilder = () => "anonymous",
  message = "Too many requests. Please try again shortly."
} = {}) {
  const safeLimit = Math.max(1, Number(limit) || 1);
  const safeWindowMs = Math.max(1_000, Number(windowMs) || 60_000);

  return (req, res, next) => {
    const nowTs = Date.now();
    const scopedKey = `${text(scope, "core")}:${text(keyBuilder(req), "anonymous")}`;

    const current = rateBuckets.get(scopedKey) || { hits: [] };
    const hits = pruneWindow(current, nowTs, safeWindowMs);

    if (hits.length >= safeLimit) {
      const oldestInWindow = Math.min(...hits);
      const retryAfterSec = Math.max(1, Math.ceil((safeWindowMs - (nowTs - oldestInWindow)) / 1000));
      res.setHeader("Retry-After", String(retryAfterSec));
      return res.status(429).json({
        success: false,
        message,
        retryAfterSec
      });
    }

    hits.push(nowTs);
    rateBuckets.set(scopedKey, { hits });
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
