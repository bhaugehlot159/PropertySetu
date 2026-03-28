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

export const coreAiRequestLimiter = createCoreRateLimiter({
  scope: "ai-request",
  limit: Math.max(20, Number(process.env.CORE_AI_REQUEST_RATE_LIMIT || 120)),
  windowMs: 5 * 60 * 1000,
  keyBuilder: (req) => `${text(req.coreUser?.id, "anon")}:${toIp(req)}`,
  message: "AI request limit reached. Please retry after a short pause."
});
