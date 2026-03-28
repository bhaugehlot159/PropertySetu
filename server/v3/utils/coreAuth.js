import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const FALLBACK_JWT_SECRET = "propertysetu-core-secret";

function coreJwtIssuer() {
  return String(process.env.CORE_JWT_ISSUER || process.env.JWT_ISSUER || "propertysetu-core-api").trim();
}

function coreJwtAudience() {
  return String(process.env.CORE_JWT_AUDIENCE || process.env.JWT_AUDIENCE || "propertysetu-core-clients").trim();
}

function coreJwtIssuers() {
  return [
    coreJwtIssuer(),
    String(process.env.JWT_ISSUER || "propertysetu-api").trim()
  ].filter(Boolean);
}

function coreJwtAudiences() {
  return [
    coreJwtAudience(),
    String(process.env.JWT_AUDIENCE || "propertysetu-clients").trim()
  ].filter(Boolean);
}

function coreJwtExpiry() {
  return String(process.env.CORE_JWT_EXPIRES_IN || "7d").trim();
}

function jwtSecret() {
  const configured =
    String(process.env.CORE_JWT_SECRET || "").trim() ||
    String(process.env.JWT_SECRET || "").trim();
  if (configured) return configured;

  const nodeEnv = String(process.env.NODE_ENV || "development").trim().toLowerCase();
  if (nodeEnv === "production") {
    throw new Error("CORE_JWT_SECRET/JWT_SECRET must be configured in production.");
  }

  return FALLBACK_JWT_SECRET;
}

export async function hashCorePassword(password) {
  return bcrypt.hash(String(password || ""), 12);
}

export async function compareCorePassword(password, passwordHash) {
  return bcrypt.compare(String(password || ""), String(passwordHash || ""));
}

export function signCoreToken(user) {
  const tokenVersion = Math.max(1, Number(user.tokenVersion || 1));
  const payload = {
    userId: user.id || user._id,
    role: user.role || "buyer",
    email: user.email || "",
    phone: user.phone || "",
    tokenVersion
  };
  return jwt.sign(payload, jwtSecret(), {
    algorithm: "HS256",
    expiresIn: coreJwtExpiry(),
    issuer: coreJwtIssuer(),
    audience: coreJwtAudience(),
    jwtid: crypto.randomUUID()
  });
}

export function verifyCoreToken(token) {
  return jwt.verify(String(token || ""), jwtSecret(), {
    algorithms: ["HS256"],
    issuer: coreJwtIssuers(),
    audience: coreJwtAudiences()
  });
}
