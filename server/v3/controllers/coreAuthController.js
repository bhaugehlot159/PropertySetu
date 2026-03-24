import CoreUser from "../models/CoreUser.js";
import crypto from "crypto";
import { proRuntime } from "../../config/proRuntime.js";
import { proMemoryStore } from "../../runtime/proMemoryStore.js";
import {
  compareCorePassword,
  hashCorePassword,
  signCoreToken
} from "../utils/coreAuth.js";
import { normalizeCoreUser, toId } from "../utils/coreMappers.js";

function text(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

const OTP_TTL_MS = Math.max(60_000, Number(process.env.CORE_OTP_TTL_MS || 300_000));
const OTP_MAX_ATTEMPTS = Math.max(1, Number(process.env.CORE_OTP_MAX_ATTEMPTS || 5));
const coreOtpStore = new Map();

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}

function isValidPhone(phone) {
  return /^[0-9]{8,15}$/.test(String(phone || ""));
}

function normalizeIdentity(value) {
  const raw = text(value);
  if (!raw) return "";
  if (raw.includes("@")) return raw.toLowerCase();
  return raw.replace(/\D/g, "");
}

function otpStorageKey(identity) {
  return `otp:${normalizeIdentity(identity)}`;
}

function hashOtp(otpCode) {
  return crypto.createHash("sha256").update(String(otpCode || "")).digest("hex");
}

function generateOtpCode() {
  const configured = text(process.env.CORE_STATIC_OTP);
  if (configured) return configured;
  return String(Math.floor(100_000 + Math.random() * 900_000));
}

function shouldExposeOtpHint() {
  return (
    text(process.env.CORE_EXPOSE_OTP).toLowerCase() === "true" ||
    text(process.env.NODE_ENV).toLowerCase() !== "production"
  );
}

function pruneExpiredOtps() {
  const now = Date.now();
  for (const [key, value] of coreOtpStore.entries()) {
    if (!value || now >= Number(value.expiresAt || 0)) {
      coreOtpStore.delete(key);
    }
  }
}

function storeOtpForUser(user, otpCode) {
  const identityKeys = [text(user?.email).toLowerCase(), text(user?.phone)]
    .map(otpStorageKey)
    .filter(Boolean);

  const entry = {
    otpHash: hashOtp(otpCode),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0
  };

  identityKeys.forEach((key) => {
    coreOtpStore.set(key, entry);
  });
}

function clearOtpForUser(user) {
  [text(user?.email).toLowerCase(), text(user?.phone)]
    .map(otpStorageKey)
    .filter(Boolean)
    .forEach((key) => coreOtpStore.delete(key));
}

function getOtpEntryForUser(user) {
  const keys = [text(user?.email).toLowerCase(), text(user?.phone)]
    .map(otpStorageKey)
    .filter(Boolean);
  for (const key of keys) {
    const value = coreOtpStore.get(key);
    if (value) return value;
  }
  return null;
}

function normalizeRole(role) {
  const raw = text(role, "buyer").toLowerCase();
  if (["buyer", "seller", "admin"].includes(raw)) return raw;
  return "buyer";
}

async function findUserByIdentity({ email = "", phone = "", emailOrPhone = "" } = {}) {
  const normalizedEmail = text(email).toLowerCase();
  const normalizedPhone = text(phone);
  const identity = text(emailOrPhone).toLowerCase();

  if (proRuntime.dbConnected) {
    if (normalizedEmail || normalizedPhone) {
      return CoreUser.findOne({
        $or: [
          ...(normalizedEmail ? [{ email: normalizedEmail }] : []),
          ...(normalizedPhone ? [{ phone: normalizedPhone }] : [])
        ]
      });
    }

    if (identity) {
      return CoreUser.findOne({
        $or: [{ email: identity }, { phone: identity }]
      });
    }
    return null;
  }

  const users = proMemoryStore.coreUsers;
  if (normalizedEmail || normalizedPhone) {
    return (
      users.find(
        (item) =>
          (normalizedEmail && String(item.email || "").toLowerCase() === normalizedEmail) ||
          (normalizedPhone && String(item.phone || "") === normalizedPhone)
      ) || null
    );
  }

  if (identity) {
    return (
      users.find(
        (item) =>
          String(item.email || "").toLowerCase() === identity ||
          String(item.phone || "").toLowerCase() === identity
      ) || null
    );
  }

  return null;
}

async function findUserById(userId) {
  if (!userId) return null;
  if (proRuntime.dbConnected) {
    return CoreUser.findById(userId);
  }
  return proMemoryStore.coreUsers.find((item) => item._id === userId) || null;
}

export async function requestCoreOtp(req, res, next) {
  try {
    pruneExpiredOtps();

    const emailOrPhone = text(req.body?.emailOrPhone || req.body?.email || req.body?.phone);
    if (!emailOrPhone) {
      return res.status(400).json({
        success: false,
        message: "emailOrPhone is required."
      });
    }

    const identity = normalizeIdentity(emailOrPhone);
    const looksLikeEmail = identity.includes("@");
    if (looksLikeEmail && !isValidEmail(identity)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format."
      });
    }

    if (!looksLikeEmail && !isValidPhone(identity)) {
      return res.status(400).json({
        success: false,
        message: "Phone must contain 8 to 15 digits."
      });
    }

    const user = await findUserByIdentity({ emailOrPhone: identity });
    if (!user) {
      return res.status(200).json({
        success: true,
        message: "If account exists, OTP has been sent.",
        expiresInSec: Math.floor(OTP_TTL_MS / 1000)
      });
    }

    const otpCode = generateOtpCode();
    storeOtpForUser(user, otpCode);

    const response = {
      success: true,
      message: "OTP generated successfully.",
      expiresInSec: Math.floor(OTP_TTL_MS / 1000)
    };
    if (shouldExposeOtpHint()) {
      response.otpHint = otpCode;
    }

    return res.json(response);
  } catch (error) {
    return next(error);
  }
}

export async function registerCoreUser(req, res, next) {
  try {
    const name = text(req.body?.name);
    const email = text(req.body?.email).toLowerCase();
    const phone = text(req.body?.phone);
    const password = text(req.body?.password);
    const role = normalizeRole(req.body?.role);
    const adminSecret = text(req.body?.adminSecret);

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "name, email, phone and password are required."
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format."
      });
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: "Phone must contain 8 to 15 digits."
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters."
      });
    }

    if (role === "admin") {
      const envSecret = text(process.env.ADMIN_REGISTRATION_KEY);
      if (!envSecret || envSecret !== adminSecret) {
        return res.status(403).json({
          success: false,
          message: "Admin registration requires valid adminSecret."
        });
      }
    }

    const existing = await findUserByIdentity({ email, phone });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "User already exists with this email or phone."
      });
    }

    const passwordHash = await hashCorePassword(password);
    let created;

    if (proRuntime.dbConnected) {
      created = await CoreUser.create({
        name,
        email,
        phone,
        password: passwordHash,
        role,
        verified: false,
        subscriptionPlan: "free"
      });
    } else {
      created = {
        _id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name,
        email,
        phone,
        password: passwordHash,
        role,
        verified: false,
        subscriptionPlan: "free",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      proMemoryStore.coreUsers.push(created);
    }

    const safeUser = normalizeCoreUser(created);
    const token = signCoreToken(safeUser);

    return res.status(201).json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      user: safeUser,
      token
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "User already exists with this email or phone."
      });
    }
    return next(error);
  }
}

export async function loginCoreUser(req, res, next) {
  try {
    const emailOrPhone = text(req.body?.emailOrPhone || req.body?.email || req.body?.phone);
    const password = text(req.body?.password);

    if (!emailOrPhone || !password) {
      return res.status(400).json({
        success: false,
        message: "emailOrPhone and password are required."
      });
    }

    const user = await findUserByIdentity({ emailOrPhone });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials."
      });
    }

    const fullUser = normalizeCoreUser(user, { includePassword: true });
    const isPasswordValid = await compareCorePassword(password, fullUser.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials."
      });
    }

    const safeUser = normalizeCoreUser(user);
    const token = signCoreToken(safeUser);

    return res.json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      user: safeUser,
      token
    });
  } catch (error) {
    return next(error);
  }
}

export async function loginCoreUserWithOtp(req, res, next) {
  try {
    pruneExpiredOtps();

    const emailOrPhone = text(req.body?.emailOrPhone || req.body?.email || req.body?.phone);
    const otp = text(req.body?.otp);

    if (!emailOrPhone || !otp) {
      return res.status(400).json({
        success: false,
        message: "emailOrPhone and otp are required."
      });
    }

    const identity = normalizeIdentity(emailOrPhone);
    const user = await findUserByIdentity({ emailOrPhone: identity });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid OTP credentials."
      });
    }

    const entry = getOtpEntryForUser(user);
    if (!entry) {
      return res.status(401).json({
        success: false,
        message: "OTP not requested or expired."
      });
    }

    if (Date.now() >= Number(entry.expiresAt || 0)) {
      clearOtpForUser(user);
      return res.status(401).json({
        success: false,
        message: "OTP expired. Please request a new OTP."
      });
    }

    if (Number(entry.attempts || 0) >= OTP_MAX_ATTEMPTS) {
      clearOtpForUser(user);
      return res.status(429).json({
        success: false,
        message: "Too many invalid OTP attempts. Request a new OTP."
      });
    }

    const otpValid = hashOtp(otp) === String(entry.otpHash || "");
    if (!otpValid) {
      entry.attempts = Number(entry.attempts || 0) + 1;
      return res.status(401).json({
        success: false,
        message: "Invalid OTP."
      });
    }

    clearOtpForUser(user);

    const safeUser = normalizeCoreUser(user);
    const token = signCoreToken(safeUser);

    return res.json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      user: safeUser,
      token
    });
  } catch (error) {
    return next(error);
  }
}

export async function getCoreMe(req, res, next) {
  try {
    const userId = toId(req.coreUser?.id);
    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    return res.json({
      success: true,
      user: normalizeCoreUser(user)
    });
  } catch (error) {
    return next(error);
  }
}

export async function listCoreUsers(req, res, next) {
  try {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));

    let users;
    if (proRuntime.dbConnected) {
      users = await CoreUser.find({}).sort({ createdAt: -1 }).limit(limit).lean();
    } else {
      users = [...proMemoryStore.coreUsers]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit);
    }

    const items = users.map((item) => normalizeCoreUser(item));
    return res.json({
      success: true,
      total: items.length,
      items
    });
  } catch (error) {
    return next(error);
  }
}

export async function setCoreUserVerified(req, res, next) {
  try {
    const userId = text(req.params.userId);
    const verified = Boolean(req.body?.verified);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required."
      });
    }

    let updated;
    if (proRuntime.dbConnected) {
      updated = await CoreUser.findByIdAndUpdate(
        userId,
        { $set: { verified } },
        { new: true }
      );
    } else {
      const index = proMemoryStore.coreUsers.findIndex((item) => item._id === userId);
      if (index >= 0) {
        proMemoryStore.coreUsers[index] = {
          ...proMemoryStore.coreUsers[index],
          verified,
          updatedAt: new Date().toISOString()
        };
        updated = proMemoryStore.coreUsers[index];
      }
    }

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    return res.json({
      success: true,
      user: normalizeCoreUser(updated)
    });
  } catch (error) {
    return next(error);
  }
}
