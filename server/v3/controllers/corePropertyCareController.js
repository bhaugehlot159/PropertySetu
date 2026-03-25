import mongoose from "mongoose";
import { proRuntime } from "../../config/proRuntime.js";
import { proMemoryStore } from "../../runtime/proMemoryStore.js";
import CorePropertyCareRequest from "../models/CorePropertyCareRequest.js";

function text(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function normalizeStatus(status) {
  const raw = text(status, "open").toLowerCase();
  if (raw === "in-progress") return "in-progress";
  if (raw === "completed") return "completed";
  if (raw === "cancelled") return "cancelled";
  return "open";
}

function normalizeRequest(doc) {
  const row = doc && typeof doc.toObject === "function" ? doc.toObject() : doc;
  if (!row) return null;
  return {
    _id: toId(row._id || row.id),
    id: toId(row._id || row.id),
    userId: toId(row.userId),
    propertyId: toId(row.propertyId),
    planName: text(row.planName, "care-basic"),
    amount: numberValue(row.amount, 0),
    issueType: text(row.issueType, "general"),
    notes: text(row.notes),
    preferredDate: asIso(row.preferredDate),
    status: normalizeStatus(row.status),
    createdAt: asIso(row.createdAt),
    updatedAt: asIso(row.updatedAt)
  };
}

export async function createCorePropertyCareRequest(req, res, next) {
  try {
    const userId = text(req.coreUser?.id);
    const payload = {
      userId,
      propertyId:
        text(req.body?.propertyId) && mongoose.Types.ObjectId.isValid(text(req.body?.propertyId))
          ? text(req.body?.propertyId)
          : null,
      planName: text(req.body?.planName, "care-basic"),
      amount: Math.max(0, numberValue(req.body?.amount, 0)),
      issueType: text(req.body?.issueType, "general"),
      notes: text(req.body?.notes),
      preferredDate: req.body?.preferredDate ? new Date(req.body.preferredDate) : null,
      status: "open"
    };

    let created;
    if (proRuntime.dbConnected) {
      created = await CorePropertyCareRequest.create(payload);
    } else {
      created = {
        _id: `care-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ...payload,
        preferredDate: payload.preferredDate ? payload.preferredDate.toISOString() : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      proMemoryStore.corePropertyCareRequests.unshift(created);
      proMemoryStore.corePropertyCareRequests =
        proMemoryStore.corePropertyCareRequests.slice(0, 1500);
    }

    return res.status(201).json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      item: normalizeRequest(created)
    });
  } catch (error) {
    return next(error);
  }
}

export async function listMyCorePropertyCareRequests(req, res, next) {
  try {
    const userId = text(req.coreUser?.id);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
    let items;

    if (proRuntime.dbConnected) {
      const rows = await CorePropertyCareRequest.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      items = rows.map((row) => normalizeRequest(row));
    } else {
      items = proMemoryStore.corePropertyCareRequests
        .filter((row) => text(row.userId) === userId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit)
        .map((row) => normalizeRequest(row));
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

export async function listAllCorePropertyCareRequests(req, res, next) {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit || 100)));
    let items;

    if (proRuntime.dbConnected) {
      const rows = await CorePropertyCareRequest.find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      items = rows.map((row) => normalizeRequest(row));
    } else {
      items = [...proMemoryStore.corePropertyCareRequests]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit)
        .map((row) => normalizeRequest(row));
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

export async function updateCorePropertyCareStatus(req, res, next) {
  try {
    const requestId = text(req.params.requestId);
    const status = normalizeStatus(req.body?.status);
    let updated = null;

    if (proRuntime.dbConnected) {
      if (!mongoose.Types.ObjectId.isValid(requestId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid requestId."
        });
      }
      updated = await CorePropertyCareRequest.findByIdAndUpdate(
        requestId,
        { $set: { status } },
        { new: true }
      );
    } else {
      const index = proMemoryStore.corePropertyCareRequests.findIndex(
        (row) => text(row._id) === requestId || text(row.id) === requestId
      );
      if (index >= 0) {
        proMemoryStore.corePropertyCareRequests[index] = {
          ...proMemoryStore.corePropertyCareRequests[index],
          status,
          updatedAt: new Date().toISOString()
        };
        updated = proMemoryStore.corePropertyCareRequests[index];
      }
    }

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Property care request not found."
      });
    }

    return res.json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      item: normalizeRequest(updated)
    });
  } catch (error) {
    return next(error);
  }
}
