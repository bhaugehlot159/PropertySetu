import { verifyCoreToken } from "../utils/coreAuth.js";
import CoreUser from "../models/CoreUser.js";
import { proRuntime } from "../../config/proRuntime.js";
import { proMemoryStore } from "../../runtime/proMemoryStore.js";
import { toId } from "../utils/coreMappers.js";

function extractBearerToken(authHeader = "") {
  const raw = String(authHeader || "").trim();
  if (!raw.toLowerCase().startsWith("bearer ")) return "";
  return raw.slice(7).trim();
}

async function findCoreUserById(userId) {
  const id = String(userId || "").trim();
  if (!id) return null;
  if (proRuntime.dbConnected) {
    return CoreUser.findById(id).lean();
  }
  return (
    proMemoryStore.coreUsers.find((item) => toId(item?._id || item?.id) === id) || null
  );
}

function buildCoreAuthPayload(user, tokenPayload) {
  const resolvedRole =
    String(user?.role || tokenPayload?.role || "buyer").toLowerCase();
  return {
    id: String(user?._id || user?.id || tokenPayload?.userId || ""),
    role: resolvedRole,
    email: String(user?.email || tokenPayload?.email || ""),
    phone: String(user?.phone || tokenPayload?.phone || ""),
    tokenVersion: Math.max(1, Number(user?.tokenVersion || tokenPayload?.tokenVersion || 1))
  };
}

export async function coreAuthRequired(req, res, next) {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authorization token is required."
      });
    }

    const payload = verifyCoreToken(token);
    const user = await findCoreUserById(payload.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Session expired. Please login again."
      });
    }

    if (Boolean(user?.blocked)) {
      return res.status(403).json({
        success: false,
        message: "Your account is blocked. Please contact admin."
      });
    }

    const tokenVersion = Math.max(1, Number(payload.tokenVersion || 1));
    const userTokenVersion = Math.max(1, Number(user?.tokenVersion || 1));
    if (tokenVersion !== userTokenVersion) {
      return res.status(401).json({
        success: false,
        message: "Session has been revoked. Please login again."
      });
    }

    req.coreUser = buildCoreAuthPayload(user, payload);

    return next();
  } catch (_error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token."
    });
  }
}

export async function coreAuthOptional(req, res, next) {
  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) return next();

    const payload = verifyCoreToken(token);
    const user = await findCoreUserById(payload.userId);
    if (!user || Boolean(user?.blocked)) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired token."
      });
    }

    const tokenVersion = Math.max(1, Number(payload.tokenVersion || 1));
    const userTokenVersion = Math.max(1, Number(user?.tokenVersion || 1));
    if (tokenVersion !== userTokenVersion) {
      return res.status(401).json({
        success: false,
        message: "Session has been revoked. Please login again."
      });
    }

    req.coreUser = buildCoreAuthPayload(user, payload);
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
