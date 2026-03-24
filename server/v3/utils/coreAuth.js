import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const FALLBACK_JWT_SECRET = "propertysetu-core-secret";

function jwtSecret() {
  return process.env.JWT_SECRET || process.env.CORE_JWT_SECRET || FALLBACK_JWT_SECRET;
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
    expiresIn: "7d"
  });
}

export function verifyCoreToken(token) {
  return jwt.verify(String(token || ""), jwtSecret());
}
