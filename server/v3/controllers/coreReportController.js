import mongoose from "mongoose";
import { proRuntime } from "../../config/proRuntime.js";
import { proMemoryStore } from "../../runtime/proMemoryStore.js";
import CoreProperty from "../models/CoreProperty.js";
import CoreReport from "../models/CoreReport.js";
import { toId } from "../utils/coreMappers.js";

const CORE_REPORT_REASON_MIN = Math.max(
  8,
  Number(process.env.CORE_REPORT_REASON_MIN || 10)
);

function text(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function asIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function toObjectIdOrNull(value = "") {
  const normalized = toId(value);
  if (!normalized || !mongoose.Types.ObjectId.isValid(normalized)) return null;
  return normalized;
}

function ensureArrayStore(key) {
  if (!Array.isArray(proMemoryStore[key])) {
    proMemoryStore[key] = [];
  }
  return proMemoryStore[key];
}

function normalizeReport(doc = {}) {
  const row = doc && typeof doc.toObject === "function" ? doc.toObject() : doc;
  const id = toId(row?._id || row?.id);
  return {
    id,
    _id: id,
    propertyId: toId(row?.propertyId),
    propertyTitle: text(row?.propertyTitle),
    userId: toId(row?.userId),
    reason: text(row?.reason),
    status: text(row?.status, "open"),
    resolvedAt: asIso(row?.resolvedAt),
    resolvedReason: text(row?.resolvedReason),
    resolvedBy: toId(row?.resolvedBy),
    createdAt: asIso(row?.createdAt),
    updatedAt: asIso(row?.updatedAt)
  };
}

async function resolvePropertyTitle(propertyId = "", fallbackTitle = "") {
  const normalizedId = toId(propertyId);
  if (!normalizedId) return text(fallbackTitle);

  if (proRuntime.dbConnected && mongoose.Types.ObjectId.isValid(normalizedId)) {
    const row = await CoreProperty.findById(normalizedId).select("title").lean();
    return text(row?.title, text(fallbackTitle));
  }

  const memoryRow = ensureArrayStore("coreProperties").find(
    (item) => toId(item?._id || item?.id) === normalizedId
  );
  return text(memoryRow?.title, text(fallbackTitle));
}

export async function createCoreReport(req, res, next) {
  try {
    const userId = toId(req.coreUser?.id);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    const reason = text(req.body?.reason).replace(/\s+/g, " ");
    if (reason.length < CORE_REPORT_REASON_MIN) {
      return res.status(400).json({
        success: false,
        message: `reason must be at least ${CORE_REPORT_REASON_MIN} characters.`
      });
    }

    const propertyIdRaw = toId(req.body?.propertyId);
    const propertyIdObject = toObjectIdOrNull(propertyIdRaw);
    const propertyTitle = await resolvePropertyTitle(
      propertyIdRaw,
      req.body?.propertyTitle
    );

    let created = null;
    if (proRuntime.dbConnected) {
      created = await CoreReport.create({
        propertyId: propertyIdObject,
        propertyTitle,
        userId: toObjectIdOrNull(userId) || userId,
        reason,
        status: "open"
      });
    } else {
      created = {
        _id: `report-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        propertyId: propertyIdRaw || null,
        propertyTitle,
        userId,
        reason,
        status: "open",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const rows = ensureArrayStore("coreReports");
      rows.unshift(created);
      if (rows.length > 3000) rows.length = 3000;
    }

    const normalized = normalizeReport(created);
    const memoryRows = ensureArrayStore("coreReports");
    if (!memoryRows.some((item) => toId(item?._id || item?.id) === normalized.id)) {
      memoryRows.unshift(normalized);
      if (memoryRows.length > 3000) memoryRows.length = 3000;
    }

    return res.status(201).json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      item: normalized
    });
  } catch (error) {
    return next(error);
  }
}

export async function listMyCoreReports(req, res, next) {
  try {
    const userId = toId(req.coreUser?.id);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    let items = [];
    if (proRuntime.dbConnected && mongoose.Types.ObjectId.isValid(userId)) {
      const dbRows = await CoreReport.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      items = dbRows.map((row) => normalizeReport(row));
    } else {
      items = ensureArrayStore("coreReports")
        .filter((row) => toId(row?.userId) === userId)
        .sort(
          (a, b) =>
            new Date(b?.createdAt || 0).getTime() -
            new Date(a?.createdAt || 0).getTime()
        )
        .slice(0, limit)
        .map((row) => normalizeReport(row));
    }

    return res.json({
      success: true,
      total: items.length,
      items
    });
  } catch (error) {
    return next(error);
  }
}
