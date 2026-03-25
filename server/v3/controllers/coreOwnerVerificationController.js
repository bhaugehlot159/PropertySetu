import mongoose from "mongoose";
import { proRuntime } from "../../config/proRuntime.js";
import { proMemoryStore } from "../../runtime/proMemoryStore.js";
import CoreOwnerVerification from "../models/CoreOwnerVerification.js";

function text(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function toId(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object" && value._id) return toId(value._id);
  return String(value);
}

function asIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeVerification(doc) {
  const row = doc && typeof doc.toObject === "function" ? doc.toObject() : doc;
  if (!row) return null;
  return {
    _id: toId(row._id || row.id),
    id: toId(row._id || row.id),
    userId: toId(row.userId),
    propertyId: toId(row.propertyId),
    ownerAadhaarPanStatus: text(row.ownerAadhaarPanStatus, "Submitted"),
    addressVerificationStatus: text(row.addressVerificationStatus, "Submitted"),
    ownerAadhaarPanRef: text(row.ownerAadhaarPanRef),
    addressVerificationRef: text(row.addressVerificationRef),
    privateDocsUploaded: Boolean(row.privateDocsUploaded),
    note: text(row.note),
    status: text(row.status, "Pending Review"),
    reviewedBy: toId(row.reviewedBy),
    reviewedAt: asIso(row.reviewedAt),
    createdAt: asIso(row.createdAt),
    updatedAt: asIso(row.updatedAt)
  };
}

function normalizeStatus(value) {
  const raw = text(value, "Pending Review").toLowerCase();
  if (raw === "verified") return "Verified";
  if (raw === "rejected") return "Rejected";
  return "Pending Review";
}

export async function requestCoreOwnerVerification(req, res, next) {
  try {
    const userId = text(req.coreUser?.id);
    const payload = {
      userId,
      propertyId:
        text(req.body?.propertyId) && mongoose.Types.ObjectId.isValid(text(req.body?.propertyId))
          ? text(req.body?.propertyId)
          : null,
      ownerAadhaarPanStatus: text(req.body?.ownerAadhaarPanStatus, "Submitted"),
      addressVerificationStatus: text(req.body?.addressVerificationStatus, "Submitted"),
      ownerAadhaarPanRef: text(req.body?.ownerAadhaarPanRef),
      addressVerificationRef: text(req.body?.addressVerificationRef),
      privateDocsUploaded: Boolean(req.body?.privateDocsUploaded),
      note: text(req.body?.note),
      status: "Pending Review"
    };

    let created;
    if (proRuntime.dbConnected) {
      created = await CoreOwnerVerification.create(payload);
    } else {
      created = {
        _id: `ov-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ...payload,
        reviewedBy: null,
        reviewedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      proMemoryStore.coreOwnerVerificationRequests.unshift(created);
      proMemoryStore.coreOwnerVerificationRequests =
        proMemoryStore.coreOwnerVerificationRequests.slice(0, 1500);
    }

    return res.status(201).json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      item: normalizeVerification(created)
    });
  } catch (error) {
    return next(error);
  }
}

export async function listMyCoreOwnerVerification(req, res, next) {
  try {
    const userId = text(req.coreUser?.id);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    let items;

    if (proRuntime.dbConnected) {
      const rows = await CoreOwnerVerification.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      items = rows.map((row) => normalizeVerification(row));
    } else {
      items = proMemoryStore.coreOwnerVerificationRequests
        .filter((row) => text(row.userId) === userId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit)
        .map((row) => normalizeVerification(row));
    }

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

export async function listAllCoreOwnerVerification(req, res, next) {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit || 100)));
    let items;

    if (proRuntime.dbConnected) {
      const rows = await CoreOwnerVerification.find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      items = rows.map((row) => normalizeVerification(row));
    } else {
      items = [...proMemoryStore.coreOwnerVerificationRequests]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit)
        .map((row) => normalizeVerification(row));
    }

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

export async function decideCoreOwnerVerification(req, res, next) {
  try {
    const requestId = text(req.params.requestId);
    const status = normalizeStatus(req.body?.status);
    const reviewedBy = text(req.coreUser?.id);
    const reviewedAt = new Date();
    let updated = null;

    if (proRuntime.dbConnected) {
      if (!mongoose.Types.ObjectId.isValid(requestId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid requestId."
        });
      }
      updated = await CoreOwnerVerification.findByIdAndUpdate(
        requestId,
        {
          $set: {
            status,
            reviewedBy,
            reviewedAt
          }
        },
        { new: true }
      );
    } else {
      const index = proMemoryStore.coreOwnerVerificationRequests.findIndex(
        (row) => text(row._id) === requestId || text(row.id) === requestId
      );
      if (index >= 0) {
        proMemoryStore.coreOwnerVerificationRequests[index] = {
          ...proMemoryStore.coreOwnerVerificationRequests[index],
          status,
          reviewedBy,
          reviewedAt: reviewedAt.toISOString(),
          updatedAt: new Date().toISOString()
        };
        updated = proMemoryStore.coreOwnerVerificationRequests[index];
      }
    }

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Verification request not found."
      });
    }

    return res.json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      item: normalizeVerification(updated)
    });
  } catch (error) {
    return next(error);
  }
}
