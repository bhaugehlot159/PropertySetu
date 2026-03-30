import mongoose from "mongoose";
import crypto from "crypto";
import { proRuntime } from "../../config/proRuntime.js";
import { proMemoryStore } from "../../runtime/proMemoryStore.js";
import CoreProperty from "../models/CoreProperty.js";
import CoreSealedBid from "../models/CoreSealedBid.js";
import CoreUser from "../models/CoreUser.js";
import { normalizeCoreProperty, toId } from "../utils/coreMappers.js";
import { createCoreNotification } from "./coreNotificationController.js";

const ALLOWED_BIDDER_ROLES = new Set(["buyer", "seller"]);
const ADMIN_ROLE = "admin";

function text(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const SEALED_BID_MAX_AMOUNT = Math.max(
  1_000,
  numberValue(process.env.SEALED_BID_MAX_AMOUNT, 5_000_000_000)
);
const SEALED_BID_DECISION_REASON_MIN = Math.max(
  8,
  Math.round(numberValue(process.env.SEALED_BID_DECISION_REASON_MIN, 12))
);
const SEALED_BID_REPEAT_WINDOW_MS = Math.max(
  5_000,
  Math.round(numberValue(process.env.SEALED_BID_REPEAT_WINDOW_MS, 30_000))
);
const SEALED_BID_INTEGRITY_SECRET = text(
  process.env.SEALED_BID_INTEGRITY_SECRET || process.env.JWT_SECRET || "propertysetu-sealed-bid-integrity"
);
const SEALED_BID_DUAL_ADMIN_DECISION_REQUIRED =
  String(process.env.SEALED_BID_DUAL_ADMIN_DECISION_REQUIRED || "true")
    .trim()
    .toLowerCase() !== "false";
const SEALED_BID_DUAL_ADMIN_WINDOW_MS = Math.max(
  15 * 60 * 1000,
  Math.min(
    7 * 24 * 60 * 60 * 1000,
    Math.round(numberValue(process.env.SEALED_BID_DUAL_ADMIN_WINDOW_MINUTES, 240)) * 60 * 1000
  )
);
const SEALED_BID_DUAL_ADMIN_ACTIONS = new Set(
  text(process.env.SEALED_BID_DUAL_ADMIN_ACTIONS, "accept,reject,reveal")
    .split(",")
    .map((item) => normalizeDecisionAction(item))
    .filter(Boolean)
);

function requestIp(req) {
  const forwarded = req?.headers?.["x-forwarded-for"];
  if (Array.isArray(forwarded) && forwarded.length) {
    return text(forwarded[0]).split(",")[0].trim();
  }
  if (text(forwarded)) {
    return text(forwarded).split(",")[0].trim();
  }
  return text(req?.ip || req?.socket?.remoteAddress || "0.0.0.0");
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function normalizeDecisionReason(value) {
  return text(value).replace(/\s+/g, " ").slice(0, 300);
}

function createDecisionIntegrityHash({
  bidId,
  action,
  by,
  at,
  reason,
  prevIntegrityHash = ""
} = {}) {
  const payload = [
    text(bidId),
    normalizeDecisionAction(action),
    text(by),
    text(at),
    normalizeDecisionReason(reason),
    text(prevIntegrityHash),
    SEALED_BID_INTEGRITY_SECRET
  ].join("|");
  return sha256(payload);
}

function createBidIntegrityHash({
  propertyId,
  bidderId,
  amount,
  createdAt,
  bidNonceHash
} = {}) {
  const payload = [
    text(propertyId),
    text(bidderId),
    Math.round(numberValue(amount, 0)),
    text(createdAt),
    text(bidNonceHash),
    SEALED_BID_INTEGRITY_SECRET
  ].join("|");
  return sha256(payload);
}

function createSealedBidDecisionRequestDigest({
  propertyId = "",
  action = "",
  reason = "",
  requestedBy = "",
  requestedAt = "",
  highestBidId = "",
  highestBidAmount = 0,
  totalBids = 0
} = {}) {
  return sha256(
    [
      text(propertyId),
      normalizeDecisionAction(action),
      normalizeDecisionReason(reason),
      text(requestedBy),
      text(requestedAt),
      text(highestBidId),
      Math.max(0, Math.round(numberValue(highestBidAmount, 0))),
      Math.max(0, Math.round(numberValue(totalBids, 0))),
      SEALED_BID_INTEGRITY_SECRET
    ].join("|")
  );
}

function shouldRequireDualAdminDecision(action = "") {
  if (!SEALED_BID_DUAL_ADMIN_DECISION_REQUIRED) return false;
  const normalized = normalizeDecisionAction(action);
  if (!normalized) return false;
  if (!SEALED_BID_DUAL_ADMIN_ACTIONS.size) return true;
  return SEALED_BID_DUAL_ADMIN_ACTIONS.has(normalized);
}

function extractDecisionRequestState(rows = [], nowTs = Date.now()) {
  const reference = Array.isArray(rows)
    ? rows.find((item) => item?.adminDecisionRequest && typeof item.adminDecisionRequest === "object")
    : null;
  const request =
    reference?.adminDecisionRequest &&
    typeof reference.adminDecisionRequest === "object" &&
    !Array.isArray(reference.adminDecisionRequest)
      ? reference.adminDecisionRequest
      : {};
  const requestedBy = toId(request.requestedBy);
  const requestedAtTs = request.requestedAt ? new Date(request.requestedAt).getTime() : 0;
  if (!requestedBy || !requestedAtTs) {
    return {
      active: false,
      expired: false,
      action: "",
      requestedBy: "",
      requestedAt: null,
      reason: "",
      requestDigest: "",
      highestBidId: "",
      highestBidAmount: 0,
      totalBids: 0
    };
  }
  const expiresAtTs = requestedAtTs + SEALED_BID_DUAL_ADMIN_WINDOW_MS;
  return {
    active: expiresAtTs > nowTs,
    expired: expiresAtTs <= nowTs,
    action: normalizeDecisionAction(request.action),
    requestedBy,
    requestedAt: asIso(request.requestedAt),
    reason: normalizeDecisionReason(request.reason),
    requestDigest: text(request.requestDigest),
    highestBidId: toId(request.highestBidId),
    highestBidAmount: Math.max(0, Math.round(numberValue(request.highestBidAmount, 0))),
    totalBids: Math.max(0, Math.round(numberValue(request.totalBids, 0)))
  };
}

function buildBidSecurityMeta({
  req,
  propertyId,
  bidderId,
  amount,
  createdAt
} = {}) {
  const nonce = crypto.randomBytes(16).toString("hex");
  const bidNonceHash = sha256(nonce);
  return {
    bidIpHash: sha256(requestIp(req)),
    bidUserAgentHash: sha256(text(req?.headers?.["user-agent"]).slice(0, 512)),
    bidNonceHash,
    bidIntegrityHash: createBidIntegrityHash({
      propertyId,
      bidderId,
      amount,
      createdAt,
      bidNonceHash
    })
  };
}

function evaluateBidRecordIntegrity(item = {}) {
  const security = item && typeof item.security === "object" ? item.security : {};
  const bidNonceHash = text(security.bidNonceHash);
  const bidIntegrityHash = text(security.bidIntegrityHash);
  if (!bidNonceHash || !bidIntegrityHash) return "legacy-unhashed";

  const expected = createBidIntegrityHash({
    propertyId: item.propertyId,
    bidderId: item.bidderId,
    amount: item.amount,
    createdAt: item.createdAt,
    bidNonceHash
  });
  return expected === bidIntegrityHash ? "verified" : "tamper-alert";
}

function evaluateDecisionHistoryIntegrity(item = {}) {
  const history = Array.isArray(item?.decisionHistory) ? item.decisionHistory : [];
  if (!history.length) return "no-decisions";

  let previousHash = "";
  for (const entry of history) {
    const action = normalizeDecisionAction(entry?.action);
    const by = text(toId(entry?.by) || entry?.by);
    const at = text(asIso(entry?.at) || entry?.at);
    const reason = normalizeDecisionReason(entry?.reason);
    const storedPrev = text(entry?.prevIntegrityHash);
    const storedHash = text(entry?.integrityHash);

    if (!storedPrev && !storedHash) return "legacy-unhashed";
    if (storedPrev !== previousHash) return "tamper-alert";

    const expected = createDecisionIntegrityHash({
      bidId: toId(item.id || item._id),
      action,
      by,
      at,
      reason,
      prevIntegrityHash: previousHash
    });
    if (storedHash !== expected) return "tamper-alert";
    previousHash = storedHash;
  }

  return "verified";
}

function asIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function toEpoch(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 0;
  return date.getTime();
}

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(String(value || ""));
}

function normalizeBidStatus(value) {
  const raw = text(value, "submitted").toLowerCase();
  if (raw === "accepted") return "accepted";
  if (raw === "rejected") return "rejected";
  if (raw === "revealed") return "revealed";
  return "submitted";
}

function normalizeDecisionAction(value) {
  const raw = text(value).toLowerCase();
  if (raw === "accept") return "accept";
  if (raw === "reject") return "reject";
  if (raw === "reveal") return "reveal";
  return "";
}

function normalizeBidderRole(role) {
  const raw = text(role, "buyer").toLowerCase();
  if (ALLOWED_BIDDER_ROLES.has(raw)) return raw;
  return "buyer";
}

function isAdminRole(role) {
  return text(role).toLowerCase() === ADMIN_ROLE;
}

function compareBidsHighToLow(a, b) {
  const amountDiff = numberValue(b?.amount, 0) - numberValue(a?.amount, 0);
  if (amountDiff !== 0) return amountDiff;
  return toEpoch(a?.createdAt) - toEpoch(b?.createdAt);
}

function summarizeSealedBidStatus(bids = []) {
  if (!Array.isArray(bids) || !bids.length) return "no-bids";
  const statuses = bids.map((bid) => normalizeBidStatus(bid?.status));
  if (statuses.every((status) => status === "rejected")) return "rejected-all";
  if (bids.some((bid) => Boolean(bid?.winnerRevealed))) return "revealed";
  if (statuses.some((status) => status === "accepted")) return "accepted";
  return "submitted";
}

function normalizeBid(doc) {
  const row = doc && typeof doc.toObject === "function" ? doc.toObject() : doc;
  if (!row) return null;
  const normalized = {
    _id: toId(row._id || row.id),
    id: toId(row._id || row.id),
    propertyId: toId(row.propertyId),
    propertyTitle: text(row.propertyTitle, "Property"),
    bidderId: toId(row.bidderId),
    bidderName: text(row.bidderName, "PropertySetu User"),
    bidderRole: normalizeBidderRole(row.bidderRole),
    amount: Math.max(0, Math.round(numberValue(row.amount, 0))),
    status: normalizeBidStatus(row.status),
    sealed: Boolean(row.sealed),
    adminVisible: Boolean(row.adminVisible),
    isWinningBid: Boolean(row.isWinningBid),
    winnerRevealed: Boolean(row.winnerRevealed),
    decisionByAdminId: toId(row.decisionByAdminId),
    decisionByAdminName: text(row.decisionByAdminName),
    decisionAt: asIso(row.decisionAt),
    decisionHistory: Array.isArray(row.decisionHistory)
      ? row.decisionHistory.map((item) => ({
          action: normalizeDecisionAction(item?.action),
          by: toId(item?.by) || text(item?.by),
          byRole: text(item?.byRole, "admin"),
          reason: normalizeDecisionReason(item?.reason),
          prevIntegrityHash: text(item?.prevIntegrityHash),
          integrityHash: text(item?.integrityHash),
          at: asIso(item?.at)
        }))
      : [],
    adminDecisionRequest:
      row.adminDecisionRequest &&
      typeof row.adminDecisionRequest === "object" &&
      !Array.isArray(row.adminDecisionRequest)
        ? {
            action: normalizeDecisionAction(row.adminDecisionRequest.action),
            requestedBy: toId(row.adminDecisionRequest.requestedBy),
            requestedAt: asIso(row.adminDecisionRequest.requestedAt),
            reason: normalizeDecisionReason(row.adminDecisionRequest.reason),
            requestDigest: text(row.adminDecisionRequest.requestDigest),
            highestBidId: toId(row.adminDecisionRequest.highestBidId),
            highestBidAmount: Math.max(
              0,
              Math.round(numberValue(row.adminDecisionRequest.highestBidAmount, 0))
            ),
            totalBids: Math.max(0, Math.round(numberValue(row.adminDecisionRequest.totalBids, 0)))
          }
        : null,
    security:
      row.security && typeof row.security === "object" && !Array.isArray(row.security)
        ? {
            bidIpHash: text(row.security.bidIpHash),
            bidUserAgentHash: text(row.security.bidUserAgentHash),
            bidIntegrityHash: text(row.security.bidIntegrityHash),
            bidNonceHash: text(row.security.bidNonceHash)
          }
        : {
            bidIpHash: "",
            bidUserAgentHash: "",
            bidIntegrityHash: "",
            bidNonceHash: ""
          },
    createdAt: asIso(row.createdAt),
    updatedAt: asIso(row.updatedAt)
  };

  const bidRecordIntegrity = evaluateBidRecordIntegrity(normalized);
  const decisionHistoryIntegrity = evaluateDecisionHistoryIntegrity(normalized);
  const integrityStatus =
    bidRecordIntegrity === "tamper-alert" || decisionHistoryIntegrity === "tamper-alert"
      ? "tamper-alert"
      : bidRecordIntegrity === "legacy-unhashed" || decisionHistoryIntegrity === "legacy-unhashed"
        ? "legacy-unhashed"
        : "verified";

  return {
    ...normalized,
    bidRecordIntegrity,
    decisionHistoryIntegrity,
    integrityStatus
  };
}

function maskName(name = "") {
  const value = text(name);
  if (!value) return "PropertySetu User";
  if (value.length <= 2) return `${value[0] || "U"}*`;
  return `${value.slice(0, 1)}${"*".repeat(Math.max(1, value.length - 2))}${value.slice(-1)}`;
}

function sanitizeBidForAdmin(bid) {
  const item = normalizeBid(bid);
  if (!item) return null;
  return item;
}

function sanitizeBidForBidder(bid) {
  const item = normalizeBid(bid);
  if (!item) return null;
  return {
    id: item.id,
    propertyId: item.propertyId,
    propertyTitle: item.propertyTitle,
    amount: item.amount,
    status: item.status,
    isWinningBid: item.isWinningBid,
    winnerRevealed: item.winnerRevealed,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

function sanitizeWinnerForPublic(bid) {
  const item = normalizeBid(bid);
  if (!item) return null;
  return {
    bidId: item.id,
    propertyId: item.propertyId,
    propertyTitle: item.propertyTitle,
    amount: item.amount,
    bidderRole: item.bidderRole,
    bidderName: maskName(item.bidderName),
    status: item.status,
    winnerRevealed: item.winnerRevealed,
    revealedAt: item.decisionAt || item.updatedAt
  };
}

async function findCorePropertyById(propertyId) {
  if (!propertyId) return null;
  if (proRuntime.dbConnected) {
    if (!isObjectId(propertyId)) return null;
    return CoreProperty.findById(propertyId).lean();
  }
  return (
    proMemoryStore.coreProperties.find((item) => toId(item._id || item.id) === propertyId) || null
  );
}

async function findCoreUserById(userId) {
  if (!userId) return null;
  if (proRuntime.dbConnected) {
    if (!isObjectId(userId)) return null;
    return CoreUser.findById(userId).lean();
  }
  return proMemoryStore.coreUsers.find((item) => toId(item._id || item.id) === userId) || null;
}

async function listAdminUserIds() {
  if (proRuntime.dbConnected) {
    const rows = await CoreUser.find({ role: ADMIN_ROLE }).select("_id").lean();
    return rows.map((item) => toId(item._id)).filter(Boolean);
  }
  return proMemoryStore.coreUsers
    .filter((item) => text(item.role).toLowerCase() === ADMIN_ROLE)
    .map((item) => toId(item._id || item.id))
    .filter(Boolean);
}

async function listBids({ propertyId = "", bidderId = "", limit = 1000 } = {}) {
  const safeLimit = Math.min(5000, Math.max(1, Number(limit || 1000)));
  if (proRuntime.dbConnected) {
    if (propertyId && !isObjectId(propertyId)) return [];
    if (bidderId && !isObjectId(bidderId)) return [];
    const filters = {};
    if (propertyId) filters.propertyId = propertyId;
    if (bidderId) filters.bidderId = bidderId;
    const rows = await CoreSealedBid.find(filters).sort({ createdAt: -1 }).limit(safeLimit).lean();
    return rows.map((row) => normalizeBid(row)).filter(Boolean);
  }

  let rows = [...proMemoryStore.coreSealedBids];
  if (propertyId) rows = rows.filter((item) => toId(item.propertyId) === propertyId);
  if (bidderId) rows = rows.filter((item) => toId(item.bidderId) === bidderId);
  rows.sort((a, b) => toEpoch(b.createdAt) - toEpoch(a.createdAt));
  rows = rows.slice(0, safeLimit);
  return rows.map((row) => normalizeBid(row)).filter(Boolean);
}

function resolveHighestBid(bids = []) {
  const sorted = [...bids].sort(compareBidsHighToLow);
  return sorted[0] || null;
}

function buildGroupedSummary(bids = []) {
  const grouped = new Map();
  bids.forEach((bid) => {
    const key = toId(bid?.propertyId);
    if (!key) return;
    const bucket = grouped.get(key) || [];
    bucket.push(normalizeBid(bid));
    grouped.set(key, bucket);
  });

  return [...grouped.entries()].map(([propertyId, bucket]) => {
    const sorted = bucket.sort(compareBidsHighToLow);
    const winnerBid = resolveHighestBid(sorted);
    return {
      propertyId,
      propertyTitle: text(winnerBid?.propertyTitle, "Property"),
      totalBids: sorted.length,
      status: summarizeSealedBidStatus(sorted),
      winningBidRevealed: Boolean(winnerBid?.winnerRevealed),
      winnerBid,
      bids: sorted
    };
  });
}

async function updateBidById(bidId, payload = {}, action = "") {
  const normalizedAction = normalizeDecisionAction(action);
  const safePayload = {
    ...payload,
    updatedAt: new Date().toISOString()
  };
  if (typeof payload.status !== "undefined") {
    safePayload.status = normalizeBidStatus(payload.status);
  }
  const decisionReason = normalizeDecisionReason(payload.decisionReason);

  let decisionEntry = null;
  if (normalizedAction) {
    let previousHash = "";
    if (proRuntime.dbConnected) {
      const row = await CoreSealedBid.findById(bidId).select("decisionHistory").lean();
      const history = Array.isArray(row?.decisionHistory) ? row.decisionHistory : [];
      previousHash = text(history[history.length - 1]?.integrityHash);
    } else {
      const currentRecord = proMemoryStore.coreSealedBids.find(
        (item) => toId(item._id || item.id) === bidId
      );
      const history = Array.isArray(currentRecord?.decisionHistory)
        ? currentRecord.decisionHistory
        : [];
      previousHash = text(history[history.length - 1]?.integrityHash);
    }

    const decisionAt = text(payload.decisionAt || new Date().toISOString());
    const decisionBy = toId(payload.decisionByAdminId) || text(payload.decisionByAdminId);
    decisionEntry = {
      action: normalizedAction,
      by: decisionBy,
      byRole: ADMIN_ROLE,
      reason: decisionReason,
      prevIntegrityHash: previousHash,
      integrityHash: createDecisionIntegrityHash({
        bidId,
        action: normalizedAction,
        by: decisionBy,
        at: decisionAt,
        reason: decisionReason,
        prevIntegrityHash: previousHash
      }),
      at: decisionAt
    };
  }

  if (proRuntime.dbConnected) {
    await CoreSealedBid.findByIdAndUpdate(
      bidId,
      {
        $set: safePayload,
        ...(decisionEntry
          ? {
              $push: {
                decisionHistory: decisionEntry
              }
            }
          : {})
      },
      { new: true }
    );
    return;
  }

  const index = proMemoryStore.coreSealedBids.findIndex(
    (item) => toId(item._id || item.id) === bidId
  );
  if (index < 0) return;
  const current = proMemoryStore.coreSealedBids[index];
  const currentHistory = Array.isArray(current?.decisionHistory) ? current.decisionHistory : [];
  proMemoryStore.coreSealedBids[index] = {
    ...current,
    ...safePayload,
    decisionHistory: decisionEntry
      ? [
          ...currentHistory,
          decisionEntry
        ]
      : currentHistory
  };
}

async function patchBidsByPropertyId(propertyId, payload = {}) {
  if (!propertyId) return 0;
  const safePayload = {
    ...payload,
    updatedAt: new Date().toISOString()
  };
  if (proRuntime.dbConnected) {
    const result = await CoreSealedBid.updateMany(
      { propertyId },
      { $set: safePayload }
    );
    return Number(result?.modifiedCount || result?.nModified || 0);
  }

  let updates = 0;
  proMemoryStore.coreSealedBids = proMemoryStore.coreSealedBids.map((item) => {
    if (toId(item?.propertyId) !== propertyId) return item;
    updates += 1;
    return {
      ...item,
      ...safePayload
    };
  });
  return updates;
}

async function notifyAdmins({
  title,
  message,
  metadata = {}
} = {}) {
  const adminIds = await listAdminUserIds();
  await Promise.all(
    adminIds.map((adminId) =>
      createCoreNotification({
        userId: adminId,
        title,
        message,
        category: "sealed-bid",
        metadata
      })
    )
  );
}

export async function createCoreSealedBid(req, res, next) {
  try {
    const userId = toId(req.coreUser?.id);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }
    const rawRole = text(req.coreUser?.role).toLowerCase();
    if (!ALLOWED_BIDDER_ROLES.has(rawRole)) {
      return res.status(403).json({
        success: false,
        message: "Only buyer/seller accounts can place sealed bids."
      });
    }
    const userRole = normalizeBidderRole(rawRole);

    const propertyId = text(req.body?.propertyId);
    const amount = Math.round(numberValue(req.body?.amount, 0));
    if (!propertyId || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "propertyId and positive amount are required."
      });
    }
    if (amount > SEALED_BID_MAX_AMOUNT) {
      return res.status(400).json({
        success: false,
        message: `Bid amount is too high. Maximum allowed is ${SEALED_BID_MAX_AMOUNT.toLocaleString("en-IN")}.`
      });
    }

    const property = await findCorePropertyById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found."
      });
    }

    const normalizedProperty = normalizeCoreProperty(property);
    const propertyStatus = text(normalizedProperty?.status).toLowerCase();
    if (propertyStatus && propertyStatus !== "approved") {
      return res.status(403).json({
        success: false,
        message: "Bidding is allowed only on approved properties."
      });
    }
    const ownerId = toId(normalizedProperty?.ownerId);
    if (ownerId && ownerId === userId) {
      return res.status(403).json({
        success: false,
        message: "Property owner cannot bid on own listing."
      });
    }

    if (proRuntime.dbConnected && (!isObjectId(propertyId) || !isObjectId(userId))) {
      return res.status(400).json({
        success: false,
        message: "Invalid propertyId or bidder identity."
      });
    }

    const existingActive = proRuntime.dbConnected
      ? await CoreSealedBid.findOne({
          propertyId,
          bidderId: userId,
          status: { $ne: "rejected" }
        }).lean()
      : proMemoryStore.coreSealedBids.find((item) => {
          const bid = normalizeBid(item);
          return (
            bid &&
            bid.propertyId === propertyId &&
            bid.bidderId === userId &&
            normalizeBidStatus(bid.status) !== "rejected"
          );
        });

    if (existingActive) {
      return res.status(409).json({
        success: false,
        message: "You already have an active sealed bid for this property."
      });
    }

    const recentBid = proRuntime.dbConnected
      ? await CoreSealedBid.findOne({ propertyId, bidderId: userId })
          .sort({ createdAt: -1 })
          .lean()
      : [...proMemoryStore.coreSealedBids]
          .map((item) => normalizeBid(item))
          .filter((bid) => bid && bid.propertyId === propertyId && bid.bidderId === userId)
          .sort((a, b) => toEpoch(b.createdAt) - toEpoch(a.createdAt))[0] || null;

    if (recentBid && Date.now() - toEpoch(recentBid.createdAt) < SEALED_BID_REPEAT_WINDOW_MS) {
      return res.status(429).json({
        success: false,
        message: "Repeated bid attempt detected. Please wait before submitting again."
      });
    }

    const bidder = await findCoreUserById(userId);
    const bidderName = text(bidder?.name, "PropertySetu User");
    const createdAt = new Date().toISOString();
    const securityMeta = buildBidSecurityMeta({
      req,
      propertyId,
      bidderId: userId,
      amount,
      createdAt
    });

    let created = null;
    if (proRuntime.dbConnected) {
      created = await CoreSealedBid.create({
        propertyId,
        propertyTitle: text(normalizedProperty?.title, "Property"),
        bidderId: userId,
        bidderName,
        bidderRole: userRole,
        amount,
        status: "submitted",
        sealed: true,
        adminVisible: true,
        isWinningBid: false,
        winnerRevealed: false,
        security: securityMeta
      });
    } else {
      created = {
        _id: `sbid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        propertyId,
        propertyTitle: text(normalizedProperty?.title, "Property"),
        bidderId: userId,
        bidderName,
        bidderRole: userRole,
        amount,
        status: "submitted",
        sealed: true,
        adminVisible: true,
        isWinningBid: false,
        winnerRevealed: false,
        decisionByAdminId: "",
        decisionByAdminName: "",
        decisionAt: null,
        decisionHistory: [],
        security: securityMeta,
        createdAt,
        updatedAt: createdAt
      };
      proMemoryStore.coreSealedBids.unshift(created);
      proMemoryStore.coreSealedBids = proMemoryStore.coreSealedBids.slice(0, 10000);
    }

    if (ownerId && ownerId !== userId) {
      await createCoreNotification({
        userId: ownerId,
        title: "New Sealed Bid Submitted",
        message: `A hidden bid has been submitted for ${text(normalizedProperty?.title, "your property")}.`,
        category: "sealed-bid",
        metadata: {
          propertyId,
          bidId: toId(created?._id || created?.id)
        }
      });
    }

    await notifyAdmins({
      title: "New Sealed Bid",
      message: `${bidderName} placed a sealed bid on ${text(normalizedProperty?.title, "a property")}.`,
      metadata: {
        propertyId,
        bidId: toId(created?._id || created?.id)
      }
    });

    return res.status(201).json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      item: sanitizeBidForBidder(created),
      policy:
        "Bids remain hidden for buyer/seller/owner. Only admin can view all bids until winner is revealed.",
      securityPolicy: {
        bidVisibility: "admin-only",
        antiReplay: `${Math.round(SEALED_BID_REPEAT_WINDOW_MS / 1000)}s cooldown`,
        amountMax: SEALED_BID_MAX_AMOUNT
      }
    });
  } catch (error) {
    return next(error);
  }
}

export async function listMyCoreSealedBids(req, res, next) {
  try {
    const userId = toId(req.coreUser?.id);
    const limit = Math.min(300, Math.max(1, Number(req.query.limit || 100)));
    const rows = await listBids({ bidderId: userId, limit });
    const items = rows.map((row) => sanitizeBidForBidder(row));

    return res.json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      total: items.length,
      items
    });
  } catch (error) {
    return next(error);
  }
}

export async function listCoreSealedBidSummary(req, res, next) {
  try {
    const propertyId = text(req.query.propertyId);
    const limit = Math.min(5000, Math.max(1, Number(req.query.limit || 2000)));
    const rows = await listBids({ propertyId, limit });
    const grouped = buildGroupedSummary(rows)
      .map((entry) => {
        const requestState = extractDecisionRequestState(entry.bids, Date.now());
        return {
          propertyId: entry.propertyId,
          propertyTitle: entry.propertyTitle,
          totalBids: entry.totalBids,
          status: entry.status,
          winningBidRevealed: entry.winningBidRevealed,
          decisionRequest: {
            active: Boolean(requestState.active),
            expired: Boolean(requestState.expired),
            action: text(requestState.action),
            requestedBy: text(requestState.requestedBy),
            requestedAt: asIso(requestState.requestedAt)
          },
          updatedAt: entry.winnerBid?.updatedAt || entry.winnerBid?.createdAt || null
        };
      })
      .sort((a, b) => toEpoch(b.updatedAt) - toEpoch(a.updatedAt));

    return res.json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      totalProperties: grouped.length,
      openDecisionRequests: grouped.filter((item) => item?.decisionRequest?.active).length,
      items: grouped
    });
  } catch (error) {
    return next(error);
  }
}

export async function listAdminCoreSealedBids(req, res, next) {
  try {
    const propertyId = text(req.query.propertyId);
    const limit = Math.min(5000, Math.max(1, Number(req.query.limit || 2000)));
    const rows = await listBids({ propertyId, limit });
    const grouped = buildGroupedSummary(rows)
      .map((entry) => {
        const requestState = extractDecisionRequestState(entry.bids, Date.now());
        return {
          propertyId: entry.propertyId,
          propertyTitle: entry.propertyTitle,
          totalBids: entry.totalBids,
          status: entry.status,
          winningBidRevealed: entry.winningBidRevealed,
          decisionRequest: {
            active: Boolean(requestState.active),
            expired: Boolean(requestState.expired),
            action: text(requestState.action),
            requestedBy: text(requestState.requestedBy),
            requestedAt: asIso(requestState.requestedAt),
            reason: text(requestState.reason),
            highestBidId: text(requestState.highestBidId),
            highestBidAmount: Math.max(0, Math.round(numberValue(requestState.highestBidAmount, 0))),
            totalBids: Math.max(0, Math.round(numberValue(requestState.totalBids, 0)))
          },
          winnerBid: entry.winnerBid ? sanitizeBidForAdmin(entry.winnerBid) : null,
          bids: entry.bids.map((bid) => sanitizeBidForAdmin(bid))
        };
      })
      .sort((a, b) => toEpoch(b.winnerBid?.updatedAt || b.winnerBid?.createdAt) - toEpoch(a.winnerBid?.updatedAt || a.winnerBid?.createdAt));

    return res.json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      totalProperties: grouped.length,
      openDecisionRequests: grouped.filter((item) => item?.decisionRequest?.active).length,
      items: grouped
    });
  } catch (error) {
    return next(error);
  }
}

export async function getCoreSealedBidWinner(req, res, next) {
  try {
    const propertyId = text(req.params.propertyId || req.query.propertyId);
    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: "propertyId is required."
      });
    }

    const rows = await listBids({ propertyId, limit: 2000 });
    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "No bids found for property."
      });
    }

    if (!resolveHighestBid(rows)) {
      return res.status(404).json({
        success: false,
        message: "No winning bid available."
      });
    }

    const adminView = isAdminRole(req.coreUser?.role);
    if (!adminView && !winner.winnerRevealed) {
      return res.status(403).json({
        success: false,
        message: "Winning bid has not been revealed by admin yet."
      });
    }

    return res.json({
      success: true,
      propertyId,
      propertyTitle: text(winner.propertyTitle, "Property"),
      status: summarizeSealedBidStatus(rows),
      ...(adminView ? { totalBids: rows.length } : {}),
      winner: adminView ? sanitizeBidForAdmin(winner) : sanitizeWinnerForPublic(winner)
    });
  } catch (error) {
    return next(error);
  }
}

export async function applyCoreSealedBidDecision(req, res, next) {
  try {
    const propertyId = text(req.body?.propertyId);
    const action = normalizeDecisionAction(req.body?.action);
    const decisionReasonInput = normalizeDecisionReason(req.body?.decisionReason || req.body?.note);
    const decisionConfirm =
      String(req.body?.decisionConfirm || req.query?.decisionConfirm || "false")
        .trim()
        .toLowerCase() === "true";
    const requestReset =
      String(req.body?.requestReset || req.query?.requestReset || "false")
        .trim()
        .toLowerCase() === "true";

    if (!propertyId || !action) {
      return res.status(400).json({
        success: false,
        message: "propertyId and valid action (accept/reject/reveal) are required."
      });
    }

    const rows = await listBids({ propertyId, limit: 5000 });
    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "No bids found for property."
      });
    }

    const winner = resolveHighestBid(rows);
    if (!winner) {
      return res.status(404).json({
        success: false,
        message: "No winning bid available."
      });
    }

    const adminId = toId(req.coreUser?.id);
    const adminName = text(req.coreUser?.name, "PropertySetu Admin");
    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: "Admin authentication required."
      });
    }

    const dualAdminRequired = shouldRequireDualAdminDecision(action);
    let effectiveDecisionReason = decisionReasonInput;
    let decisionRequestedBy = "";
    let confirmedRequestSnapshot = null;

    if (dualAdminRequired) {
      const initialRequestState = extractDecisionRequestState(rows, Date.now());
      if (
        initialRequestState.active &&
        initialRequestState.action &&
        initialRequestState.action !== action
      ) {
        if (!requestReset) {
          return res.status(409).json({
            success: false,
            message:
              "Another admin decision request is active for this property. Set requestReset=true to replace it."
          });
        }
        await patchBidsByPropertyId(propertyId, { adminDecisionRequest: null });
      }

      const decisionRowsForRequest = requestReset
        ? await listBids({ propertyId, limit: 5000 })
        : rows;
      const decisionWinnerForRequest = resolveHighestBid(decisionRowsForRequest);
      if (!decisionWinnerForRequest) {
        return res.status(404).json({
          success: false,
          message: "No winning bid available."
        });
      }
      const requestState = extractDecisionRequestState(decisionRowsForRequest, Date.now());

      if (!requestState.active) {
        if (decisionReasonInput.length < SEALED_BID_DECISION_REASON_MIN) {
          return res.status(400).json({
            success: false,
            message: `decisionReason must be at least ${SEALED_BID_DECISION_REASON_MIN} characters.`
          });
        }

        const requestedAt = new Date().toISOString();
        const requestDigest = createSealedBidDecisionRequestDigest({
          propertyId,
          action,
          reason: decisionReasonInput,
          requestedBy: adminId,
          requestedAt,
          highestBidId: decisionWinnerForRequest.id,
          highestBidAmount: decisionWinnerForRequest.amount,
          totalBids: decisionRowsForRequest.length
        });
        const decisionRequest = {
          action,
          requestedBy: adminId,
          requestedAt,
          reason: decisionReasonInput,
          requestDigest,
          highestBidId: decisionWinnerForRequest.id,
          highestBidAmount: Math.max(
            0,
            Math.round(numberValue(decisionWinnerForRequest.amount, 0))
          ),
          totalBids: decisionRowsForRequest.length
        };
        await patchBidsByPropertyId(propertyId, { adminDecisionRequest: decisionRequest });

        const property = await findCorePropertyById(propertyId);
        const propertyTitle = text(
          normalizeCoreProperty(property)?.title || decisionWinnerForRequest?.propertyTitle,
          "Property"
        );
        await notifyAdmins({
          title: "Sealed Bid Dual-Admin Request",
          message: `Admin confirmation required for ${action} decision on ${propertyTitle}.`,
          metadata: {
            propertyId,
            action,
            requestedBy: adminId,
            requestDigest,
            highestBidId: decisionWinnerForRequest.id,
            highestBidAmount: Math.max(
              0,
              Math.round(numberValue(decisionWinnerForRequest.amount, 0))
            )
          }
        });

        return res.status(202).json({
          success: true,
          source: proRuntime.dbConnected ? "mongodb" : "memory",
          action: `${action}-requested`,
          requiresSecondAdmin: true,
          request: {
            action,
            requestedBy: adminId,
            requestedAt,
            reason: decisionReasonInput,
            requestDigest,
            highestBidId: decisionWinnerForRequest.id,
            highestBidAmount: Math.max(
              0,
              Math.round(numberValue(decisionWinnerForRequest.amount, 0))
            ),
            totalBids: decisionRowsForRequest.length,
            windowMinutes: Math.max(1, Math.round(SEALED_BID_DUAL_ADMIN_WINDOW_MS / 60_000))
          },
          message:
            "First admin request recorded. A second admin must confirm this decision using decisionConfirm=true."
        });
      }

      if (requestState.requestedBy === adminId) {
        return res.status(409).json({
          success: false,
          message: "A different admin must confirm this sealed bid decision."
        });
      }
      if (!decisionConfirm) {
        return res.status(409).json({
          success: false,
          message: "decisionConfirm=true is required for second-admin confirmation."
        });
      }
      if (requestState.action !== action) {
        return res.status(409).json({
          success: false,
          message:
            "Active request action mismatch. Create a fresh request for this action before confirmation."
        });
      }

      const expectedDigest = createSealedBidDecisionRequestDigest({
        propertyId,
        action: requestState.action,
        reason: requestState.reason,
        requestedBy: requestState.requestedBy,
        requestedAt: requestState.requestedAt,
        highestBidId: requestState.highestBidId,
        highestBidAmount: requestState.highestBidAmount,
        totalBids: requestState.totalBids
      });
      if (!requestState.requestDigest || expectedDigest !== requestState.requestDigest) {
        return res.status(409).json({
          success: false,
          message:
            "Decision request integrity mismatch detected. Create a new request before approval."
        });
      }

      effectiveDecisionReason = requestState.reason || decisionReasonInput;
      decisionRequestedBy = requestState.requestedBy;
      confirmedRequestSnapshot = {
        highestBidId: requestState.highestBidId,
        highestBidAmount: requestState.highestBidAmount,
        totalBids: requestState.totalBids
      };
    } else if (decisionReasonInput.length < SEALED_BID_DECISION_REASON_MIN) {
      return res.status(400).json({
        success: false,
        message: `decisionReason must be at least ${SEALED_BID_DECISION_REASON_MIN} characters.`
      });
    }

    if (effectiveDecisionReason.length < SEALED_BID_DECISION_REASON_MIN) {
      return res.status(400).json({
        success: false,
        message: `decisionReason must be at least ${SEALED_BID_DECISION_REASON_MIN} characters.`
      });
    }

    const decisionRows = await listBids({ propertyId, limit: 5000 });
    const decisionWinner = resolveHighestBid(decisionRows);
    if (!decisionWinner) {
      return res.status(404).json({
        success: false,
        message: "No winning bid available."
      });
    }
    if (dualAdminRequired && confirmedRequestSnapshot) {
      const snapshotWinnerId = text(confirmedRequestSnapshot.highestBidId);
      const snapshotWinnerAmount = Math.max(
        0,
        Math.round(numberValue(confirmedRequestSnapshot.highestBidAmount, 0))
      );
      const snapshotTotalBids = Math.max(
        0,
        Math.round(numberValue(confirmedRequestSnapshot.totalBids, 0))
      );
      const currentWinnerAmount = Math.max(0, Math.round(numberValue(decisionWinner.amount, 0)));
      if (
        snapshotWinnerId !== text(decisionWinner.id) ||
        snapshotWinnerAmount !== currentWinnerAmount ||
        snapshotTotalBids !== decisionRows.length
      ) {
        return res.status(409).json({
          success: false,
          message:
            "Bid state changed after approval request. Create a fresh dual-admin request before final decision."
        });
      }
    }

    const decisionAt = new Date().toISOString();
    for (const bid of decisionRows) {
      const isWinner = bid.id === decisionWinner.id;
      const nextPayload = {
        decisionByAdminId: adminId,
        decisionByAdminName: adminName,
        decisionAt,
        decisionReason: effectiveDecisionReason,
        adminDecisionRequest: null
      };

      if (action === "accept") {
        nextPayload.status = isWinner ? "accepted" : "rejected";
        nextPayload.isWinningBid = isWinner;
        nextPayload.winnerRevealed = false;
      } else if (action === "reject") {
        nextPayload.status = "rejected";
        nextPayload.isWinningBid = false;
        nextPayload.winnerRevealed = false;
      } else {
        nextPayload.isWinningBid = isWinner;
        if (isWinner) {
          nextPayload.winnerRevealed = true;
          nextPayload.status =
            normalizeBidStatus(bid.status) === "accepted" ? "accepted" : "revealed";
        }
      }

      await updateBidById(bid.id, nextPayload, action);
    }
    await patchBidsByPropertyId(propertyId, { adminDecisionRequest: null });

    const refreshedRows = await listBids({ propertyId, limit: 5000 });
    const refreshedWinner = resolveHighestBid(refreshedRows);
    const currentStatus = summarizeSealedBidStatus(refreshedRows);
    const property = await findCorePropertyById(propertyId);
    const propertyTitle = text(
      normalizeCoreProperty(property)?.title || refreshedWinner?.propertyTitle,
      "Property"
    );

    const bidderIds = [...new Set(refreshedRows.map((item) => toId(item.bidderId)).filter(Boolean))];
    if (action === "accept") {
      await Promise.all(
        bidderIds.map((bidderId) =>
          createCoreNotification({
            userId: bidderId,
            title:
              refreshedWinner && bidderId === refreshedWinner.bidderId
                ? "Sealed Bid Accepted"
                : "Sealed Bid Result",
            message:
              refreshedWinner && bidderId === refreshedWinner.bidderId
                ? `Your sealed bid for ${propertyTitle} has been accepted by admin.`
                : `Your sealed bid for ${propertyTitle} was not selected.`,
            category: "sealed-bid",
            metadata: {
              propertyId,
              action,
              decisionReason: effectiveDecisionReason
            }
          })
        )
      );
    } else if (action === "reject") {
      await Promise.all(
        bidderIds.map((bidderId) =>
          createCoreNotification({
            userId: bidderId,
            title: "Sealed Bids Rejected",
            message: `All sealed bids for ${propertyTitle} were rejected by admin.`,
            category: "sealed-bid",
            metadata: {
              propertyId,
              action,
              decisionReason: effectiveDecisionReason
            }
          })
        )
      );
    } else {
      await Promise.all(
        bidderIds.map((bidderId) =>
          createCoreNotification({
            userId: bidderId,
            title: "Winning Bid Revealed",
            message: `Admin revealed winning bid for ${propertyTitle}.`,
            category: "sealed-bid",
            metadata: {
              propertyId,
              action,
              decisionReason: effectiveDecisionReason
            }
          })
        )
      );
    }

    const ownerId = toId(normalizeCoreProperty(property)?.ownerId);
    if (ownerId) {
      await createCoreNotification({
        userId: ownerId,
        title:
          action === "accept"
            ? "Winning Bid Accepted"
            : action === "reject"
              ? "All Bids Rejected"
              : "Winning Bid Revealed",
        message:
          action === "accept"
            ? `Admin accepted highest sealed bid for ${propertyTitle}.`
            : action === "reject"
              ? `Admin rejected all sealed bids for ${propertyTitle}.`
              : `Admin revealed winning sealed bid for ${propertyTitle}.`,
        category: "sealed-bid",
        metadata: {
          propertyId,
          action,
          decisionReason: effectiveDecisionReason
        }
      });
    }

    return res.json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      action,
      decisionReason: effectiveDecisionReason,
      propertyId,
      propertyTitle,
      status: currentStatus,
      dualAdmin: {
        required: Boolean(dualAdminRequired),
        confirmedBySecondAdmin: Boolean(dualAdminRequired),
        requestedBy: text(decisionRequestedBy),
        requestWindowMinutes: Math.max(1, Math.round(SEALED_BID_DUAL_ADMIN_WINDOW_MS / 60_000))
      },
      totalBids: refreshedRows.length,
      winnerBid: refreshedWinner ? sanitizeBidForAdmin(refreshedWinner) : null,
      items: refreshedRows.sort(compareBidsHighToLow).map((item) => sanitizeBidForAdmin(item))
    });
  } catch (error) {
    return next(error);
  }
}
