import mongoose from "mongoose";
import CoreProperty from "../models/CoreProperty.js";
import CoreVisitBooking from "../models/CoreVisitBooking.js";
import { proRuntime } from "../../config/proRuntime.js";
import { proMemoryStore } from "../../runtime/proMemoryStore.js";
import { normalizeCoreProperty, toId } from "../utils/coreMappers.js";
import { createCoreNotification } from "./coreNotificationController.js";

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

function normalizeVisitStatus(value) {
  const raw = text(value, "requested").toLowerCase();
  if (raw === "confirmed") return "confirmed";
  if (raw === "completed") return "completed";
  if (raw === "cancelled") return "cancelled";
  if (raw === "rejected") return "rejected";
  return "requested";
}

function parsePreferredAt(body = {}) {
  const preferredAt = text(body.preferredAt || body.visitAt);
  if (preferredAt) {
    const date = new Date(preferredAt);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const visitDate = text(body.visitDate);
  const visitTime = text(body.visitTime);
  if (visitDate && visitTime) {
    const composed = new Date(`${visitDate}T${visitTime}:00`);
    if (!Number.isNaN(composed.getTime())) return composed;
  }

  return null;
}

function normalizeVisit(doc, propertyMap = {}) {
  const row = doc && typeof doc.toObject === "function" ? doc.toObject() : doc;
  if (!row) return null;
  const propertyId = toId(row.propertyId);
  const property = propertyMap[propertyId];

  return {
    _id: toId(row._id || row.id),
    id: toId(row._id || row.id),
    propertyId,
    customerId: toId(row.customerId),
    ownerId: toId(row.ownerId),
    preferredAt: asIso(row.preferredAt),
    note: text(row.note),
    status: normalizeVisitStatus(row.status),
    createdAt: asIso(row.createdAt),
    updatedAt: asIso(row.updatedAt),
    property: property || undefined
  };
}

function compactPropertySummary(property) {
  const normalized = normalizeCoreProperty(property);
  if (!normalized) return null;
  return {
    id: normalized.id,
    title: normalized.title,
    city: normalized.city,
    location: normalized.location,
    type: normalized.type,
    category: normalized.category,
    price: normalized.price,
    verified: normalized.verified,
    featured: normalized.featured,
    ownerId: normalized.ownerId
  };
}

async function findPropertyById(propertyId) {
  if (!propertyId) return null;
  if (proRuntime.dbConnected) {
    if (!mongoose.Types.ObjectId.isValid(propertyId)) return null;
    return CoreProperty.findById(propertyId);
  }
  return proMemoryStore.coreProperties.find((item) => toId(item._id || item.id) === propertyId) || null;
}

async function findVisitById(visitId) {
  if (!visitId) return null;
  if (proRuntime.dbConnected) {
    if (!mongoose.Types.ObjectId.isValid(visitId)) return null;
    return CoreVisitBooking.findById(visitId);
  }
  return proMemoryStore.coreVisitBookings.find((item) => toId(item._id || item.id) === visitId) || null;
}

async function buildPropertyMap(visits = []) {
  const propertyIds = [...new Set(visits.map((item) => toId(item.propertyId)).filter(Boolean))];
  if (!propertyIds.length) return {};

  if (proRuntime.dbConnected) {
    const objectIds = propertyIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (!objectIds.length) return {};
    const rows = await CoreProperty.find({ _id: { $in: objectIds } }).lean();
    return rows.reduce((acc, row) => {
      acc[toId(row._id)] = compactPropertySummary(row);
      return acc;
    }, {});
  }

  const map = {};
  proMemoryStore.coreProperties.forEach((item) => {
    const id = toId(item._id || item.id);
    if (propertyIds.includes(id)) {
      map[id] = compactPropertySummary(item);
    }
  });
  return map;
}

async function createVisitInternal({ propertyId, customerId, note, preferredAt }) {
  const property = await findPropertyById(propertyId);
  if (!property) return { error: "Property not found.", status: 404 };

  const normalizedProperty = normalizeCoreProperty(property);
  const ownerId = toId(normalizedProperty?.ownerId);
  if (!ownerId) return { error: "Property owner not found.", status: 400 };
  if (ownerId === customerId) {
    return { error: "Owner cannot book visit on own property.", status: 400 };
  }

  let created = null;
  if (proRuntime.dbConnected) {
    created = await CoreVisitBooking.create({
      propertyId,
      customerId,
      ownerId,
      preferredAt,
      note: text(note),
      status: "requested"
    });
  } else {
    created = {
      _id: `visit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      propertyId,
      customerId,
      ownerId,
      preferredAt: preferredAt.toISOString(),
      note: text(note),
      status: "requested",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    proMemoryStore.coreVisitBookings.unshift(created);
    proMemoryStore.coreVisitBookings = proMemoryStore.coreVisitBookings.slice(0, 4000);
  }

  const notification = await createCoreNotification({
    userId: ownerId,
    title: "New Property Visit Request",
    message: `A customer booked a visit for ${text(normalizedProperty?.title, "your property")}.`,
    category: "visit-booking",
    metadata: {
      visitId: toId(created?._id || created?.id),
      propertyId,
      customerId
    }
  });

  return {
    created,
    property: compactPropertySummary(property),
    notification
  };
}

export async function createCoreVisitBookingForProperty(req, res, next) {
  try {
    const propertyId = text(req.params.propertyId || req.body?.propertyId);
    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: "propertyId is required."
      });
    }

    const preferredAt = parsePreferredAt(req.body || {});
    if (!preferredAt) {
      return res.status(400).json({
        success: false,
        message: "preferredAt or visitDate+visitTime is required."
      });
    }

    const customerId = toId(req.coreUser?.id);
    const created = await createVisitInternal({
      propertyId,
      customerId,
      note: req.body?.note,
      preferredAt
    });

    if (created?.error) {
      return res.status(created.status || 400).json({
        success: false,
        message: created.error
      });
    }

    return res.status(201).json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      item: normalizeVisit(created.created, {
        [toId(created.property?.id)]: created.property
      }),
      ownerNotification: created.notification || undefined
    });
  } catch (error) {
    return next(error);
  }
}

export async function createCoreVisitBooking(req, res, next) {
  return createCoreVisitBookingForProperty(req, res, next);
}

export async function listMyCoreVisitBookings(req, res, next) {
  try {
    const customerId = toId(req.coreUser?.id);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50)));
    let rows = [];

    if (proRuntime.dbConnected) {
      rows = await CoreVisitBooking.find({ customerId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
    } else {
      rows = proMemoryStore.coreVisitBookings
        .filter((item) => toId(item.customerId) === customerId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit);
    }

    const propertyMap = await buildPropertyMap(rows);
    const items = rows.map((row) => normalizeVisit(row, propertyMap));

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

export async function listOwnerCoreVisitBookings(req, res, next) {
  try {
    const ownerId = toId(req.coreUser?.id);
    const limit = Math.min(300, Math.max(1, Number(req.query.limit || 80)));
    let rows = [];

    if (proRuntime.dbConnected) {
      rows = await CoreVisitBooking.find({ ownerId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
    } else {
      rows = proMemoryStore.coreVisitBookings
        .filter((item) => toId(item.ownerId) === ownerId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit);
    }

    const propertyMap = await buildPropertyMap(rows);
    const items = rows.map((row) => normalizeVisit(row, propertyMap));

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

export async function listAllCoreVisitBookings(req, res, next) {
  try {
    const limit = Math.min(500, Math.max(1, Number(req.query.limit || 100)));
    let rows = [];

    if (proRuntime.dbConnected) {
      rows = await CoreVisitBooking.find({}).sort({ createdAt: -1 }).limit(limit).lean();
    } else {
      rows = [...proMemoryStore.coreVisitBookings]
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit);
    }

    const propertyMap = await buildPropertyMap(rows);
    const items = rows.map((row) => normalizeVisit(row, propertyMap));

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

export async function updateCoreVisitBookingStatus(req, res, next) {
  try {
    const visitId = text(req.params.visitId);
    const status = normalizeVisitStatus(req.body?.status);
    if (!visitId) {
      return res.status(400).json({
        success: false,
        message: "visitId is required."
      });
    }

    const existing = await findVisitById(visitId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Visit booking not found."
      });
    }

    const existingOwnerId = toId(existing.ownerId);
    const currentUserId = toId(req.coreUser?.id);
    const currentRole = text(req.coreUser?.role).toLowerCase();
    const isAdmin = currentRole === "admin";

    if (!isAdmin && existingOwnerId !== currentUserId) {
      return res.status(403).json({
        success: false,
        message: "Only owner or admin can update visit status."
      });
    }

    let updated = null;
    if (proRuntime.dbConnected) {
      updated = await CoreVisitBooking.findByIdAndUpdate(
        visitId,
        { $set: { status } },
        { new: true }
      );
    } else {
      const index = proMemoryStore.coreVisitBookings.findIndex(
        (item) => toId(item._id || item.id) === visitId
      );
      if (index >= 0) {
        proMemoryStore.coreVisitBookings[index] = {
          ...proMemoryStore.coreVisitBookings[index],
          status,
          updatedAt: new Date().toISOString()
        };
        updated = proMemoryStore.coreVisitBookings[index];
      }
    }

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Visit booking not found."
      });
    }

    const propertyMap = await buildPropertyMap([updated]);
    const normalized = normalizeVisit(updated, propertyMap);
    const customerNotification = await createCoreNotification({
      userId: normalized.customerId,
      title: "Visit Booking Updated",
      message: `Your visit request status is now "${status}".`,
      category: "visit-booking",
      metadata: {
        visitId: normalized.id,
        propertyId: normalized.propertyId,
        status
      }
    });

    return res.json({
      success: true,
      item: normalized,
      customerNotification: customerNotification || undefined
    });
  } catch (error) {
    return next(error);
  }
}
