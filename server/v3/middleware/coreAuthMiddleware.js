import { verifyCoreToken } from "../utils/coreAuth.js";

function extractBearerToken(authHeader = "") {
  const raw = String(authHeader || "").trim();
  if (!raw.toLowerCase().startsWith("bearer ")) return "";
  return raw.slice(7).trim();
}

export function coreAuthRequired(req, res, next) {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authorization token is required."
      });
    }

    const payload = verifyCoreToken(token);
    req.coreUser = {
      id: String(payload.userId || ""),
      role: String(payload.role || "buyer"),
      email: String(payload.email || ""),
      phone: String(payload.phone || "")
    };

    return next();
  } catch (_error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token."
    });
  }
}

export function coreRoleRequired(...roles) {
  const allowed = roles.map((role) => String(role || "").toLowerCase());

  return (req, res, next) => {
    const currentRole = String(req.coreUser?.role || "").toLowerCase();
    if (!allowed.includes(currentRole)) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission for this action."
      });
    }

    return next();
  };
}
