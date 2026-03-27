import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const FALLBACK_JWT_SECRET = "propertysetu-core-secret";

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
  const payload = {
    userId: user.id || user._id,
    role: user.role || "buyer",
    email: user.email || "",
    phone: user.phone || ""
  };
  return jwt.sign(payload, jwtSecret(), {
    algorithm: "HS256",
    expiresIn: "7d"
  });
}

export function verifyCoreToken(token) {
  return jwt.verify(String(token || ""), jwtSecret(), {
    algorithms: ["HS256"]
  });
}
