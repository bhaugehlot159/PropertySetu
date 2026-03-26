import mongoose from "mongoose";
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
  return {
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
          by: toId(item?.by),
          byRole: text(item?.byRole, "admin"),
          at: asIso(item?.at)
        }))
      : [],
    createdAt: asIso(row.createdAt),
    updatedAt: asIso(row.updatedAt)
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

  if (proRuntime.dbConnected) {
    await CoreSealedBid.findByIdAndUpdate(
      bidId,
      {
        $set: safePayload,
        ...(normalizedAction
          ? {
              $push: {
                decisionHistory: {
                  action: normalizedAction,
                  by: payload.decisionByAdminId,
                  byRole: ADMIN_ROLE,
                  at: payload.decisionAt
                }
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
    decisionHistory: normalizedAction
      ? [
          ...currentHistory,
          {
            action: normalizedAction,
            by: payload.decisionByAdminId,
            byRole: ADMIN_ROLE,
            at: payload.decisionAt
          }
        ]
      : currentHistory
  };
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

    const property = await findCorePropertyById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found."
      });
    }

    const normalizedProperty = normalizeCoreProperty(property);
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

    const bidder = await findCoreUserById(userId);
    const bidderName = text(bidder?.name, "PropertySetu User");
    const createdAt = new Date().toISOString();

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
        winnerRevealed: false
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
        "Bids remain hidden for buyer/seller/owner. Only admin can view all bids until winner is revealed."
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
      .map((entry) => ({
        propertyId: entry.propertyId,
        propertyTitle: entry.propertyTitle,
        totalBids: entry.totalBids,
        status: entry.status,
        winningBidRevealed: entry.winningBidRevealed,
        updatedAt: entry.winnerBid?.updatedAt || entry.winnerBid?.createdAt || null
      }))
      .sort((a, b) => toEpoch(b.updatedAt) - toEpoch(a.updatedAt));

    return res.json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      totalProperties: grouped.length,
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
      .map((entry) => ({
        propertyId: entry.propertyId,
        propertyTitle: entry.propertyTitle,
        totalBids: entry.totalBids,
        status: entry.status,
        winningBidRevealed: entry.winningBidRevealed,
        winnerBid: entry.winnerBid ? sanitizeBidForAdmin(entry.winnerBid) : null,
        bids: entry.bids.map((bid) => sanitizeBidForAdmin(bid))
      }))
      .sort((a, b) => toEpoch(b.winnerBid?.updatedAt || b.winnerBid?.createdAt) - toEpoch(a.winnerBid?.updatedAt || a.winnerBid?.createdAt));

    return res.json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      totalProperties: grouped.length,
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

    const winner = resolveHighestBid(rows);
    if (!winner) {
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
      totalBids: rows.length,
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
    const decisionAt = new Date().toISOString();

    for (const bid of rows) {
      const isWinner = bid.id === winner.id;
      const nextPayload = {
        decisionByAdminId: adminId,
        decisionByAdminName: adminName,
        decisionAt
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
          nextPayload.status = normalizeBidStatus(bid.status) === "accepted" ? "accepted" : "revealed";
        }
      }

      await updateBidById(bid.id, nextPayload, action);
    }

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
              action
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
              action
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
              action
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
          action
        }
      });
    }

    return res.json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      action,
      propertyId,
      propertyTitle,
      status: currentStatus,
      totalBids: refreshedRows.length,
      winnerBid: refreshedWinner ? sanitizeBidForAdmin(refreshedWinner) : null,
      items: refreshedRows.sort(compareBidsHighToLow).map((item) => sanitizeBidForAdmin(item))
    });
  } catch (error) {
    return next(error);
  }
}
