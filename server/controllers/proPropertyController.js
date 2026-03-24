import ProProperty from "../models/ProProperty.js";
import { proRuntime } from "../config/proRuntime.js";
import { proMemoryStore } from "../runtime/proMemoryStore.js";

function normalizePayload(payload = {}) {
  const imageUrls = Array.isArray(payload.imageUrls)
    ? payload.imageUrls.filter(Boolean)
    : typeof payload.imageUrls === "string"
      ? payload.imageUrls
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

  const city = String(payload.city || "").trim();
  const propertyType = String(payload.propertyType || payload.category || "Apartment").trim();
  const location = String(payload.location || payload.locality || city || "").trim();

  return {
    title: String(payload.title || "").trim(),
    city,
    price: Number(payload.price || 0),
    propertyType,
    bedrooms: Number(payload.bedrooms || 0),
    bathrooms: Number(payload.bathrooms || 0),
    areaSqft: Number(payload.areaSqft || payload.builtUpArea || payload.plotSize || 0),
    description: String(payload.description || "").trim(),
    imageUrls,
    status: String(payload.status || "published"),
    location,
    ownerId: String(payload.ownerId || "").trim(),
    ownerName: String(payload.ownerName || "").trim(),
    category: String(payload.category || propertyType).trim(),
    type: String(payload.type || payload.saleRentMode || "Sell").trim(),
    featured: Boolean(payload.featured),
    verified: Boolean(payload.verified || payload.verifiedByPropertySetu),
    trustScore: Number(payload.trustScore || 0),
    media: payload.media && typeof payload.media === "object" ? payload.media : {},
    aiReview: payload.aiReview && typeof payload.aiReview === "object" ? payload.aiReview : {}
  };
}

function validatePayload(payload) {
  if (!payload.title) return "Title is required.";
  if (!payload.city) return "City is required.";
  if (!payload.price || Number.isNaN(payload.price) || payload.price <= 0) {
    return "Price must be greater than zero.";
  }
  return "";
}

function applyMemoryFilters(items, filters = {}) {
  let rows = [...items];

  if (filters.city) rows = rows.filter((item) => item.city === filters.city);
  if (filters.propertyType) {
    rows = rows.filter((item) => item.propertyType === filters.propertyType);
  }
  if (filters.status) rows = rows.filter((item) => item.status === filters.status);
  if (filters.ownerId) rows = rows.filter((item) => item.ownerId === filters.ownerId);
  if (filters.includeMine && filters.ownerId) {
    rows = rows.filter((item) => item.ownerId === filters.ownerId);
  }

  return rows;
}

function normalizeLegacyStatus(status) {
  const raw = String(status || "").toLowerCase();
  if (raw === "approved") return "published";
  if (raw === "pending approval") return "draft";
  if (raw === "rejected") return "draft";
  return raw || "published";
}

export async function listProPropertyRecords({
  filters = {},
  page = 1,
  limit = 12
} = {}) {
  const safePage = Math.max(1, Number(page || 1));
  const safeLimit = Math.min(100, Math.max(1, Number(limit || 12)));
  const skip = (safePage - 1) * safeLimit;

  if (proRuntime.dbConnected) {
    const [rows, total] = await Promise.all([
      ProProperty.find(filters).sort({ createdAt: -1 }).skip(skip).limit(safeLimit).lean(),
      ProProperty.countDocuments(filters)
    ]);

    return {
      source: "mongodb",
      rows,
      total,
      page: safePage,
      limit: safeLimit
    };
  }

  const rows = applyMemoryFilters(proMemoryStore.properties, filters).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  const paginated = rows.slice(skip, skip + safeLimit);

  return {
    source: "memory",
    rows: paginated,
    total: rows.length,
    page: safePage,
    limit: safeLimit
  };
}

export async function findProPropertyRecordById(propertyId) {
  if (!propertyId) return null;

  if (proRuntime.dbConnected) {
    return ProProperty.findById(propertyId).lean();
  }

  return proMemoryStore.properties.find((item) => item._id === propertyId) || null;
}

export async function createProPropertyRecord(inputPayload) {
  const payload = normalizePayload(inputPayload);
  const validationMessage = validatePayload(payload);

  if (validationMessage) {
    const error = new Error(validationMessage);
    error.statusCode = 400;
    throw error;
  }

  if (proRuntime.dbConnected) {
    const created = await ProProperty.create(payload);
    return {
      source: "mongodb",
      data: created.toObject ? created.toObject() : created
    };
  }

  const memoryEntry = {
    _id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ...payload,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  proMemoryStore.properties.push(memoryEntry);

  return {
    source: "memory",
    data: memoryEntry
  };
}

export async function updateProPropertyRecord(propertyId, updates = {}) {
  if (!propertyId) return null;

  if (proRuntime.dbConnected) {
    const updated = await ProProperty.findByIdAndUpdate(
      propertyId,
      { $set: updates },
      { new: true, runValidators: false }
    ).lean();
    return updated || null;
  }

  const index = proMemoryStore.properties.findIndex((item) => item._id === propertyId);
  if (index < 0) return null;

  const current = proMemoryStore.properties[index];
  const next = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString()
  };

  proMemoryStore.properties[index] = next;
  return next;
}

export async function deleteProPropertyRecord(propertyId) {
  if (!propertyId) return false;

  if (proRuntime.dbConnected) {
    const deleted = await ProProperty.findByIdAndDelete(propertyId).lean();
    return Boolean(deleted);
  }

  const before = proMemoryStore.properties.length;
  proMemoryStore.properties = proMemoryStore.properties.filter((item) => item._id !== propertyId);
  return proMemoryStore.properties.length !== before;
}

export async function listProProperties(req, res, next) {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 12)));
    const page = Math.max(1, Number(req.query.page || 1));
    const skip = (page - 1) * limit;

    const filters = {};
    if (req.query.city) filters.city = req.query.city;
    if (req.query.propertyType) filters.propertyType = req.query.propertyType;
    if (req.query.status) filters.status = req.query.status;

    const listResult = await listProPropertyRecords({
      filters,
      page,
      limit
    });

    return res.json({
      success: true,
      source: listResult.source,
      page,
      limit,
      total: listResult.total,
      count: listResult.rows.length,
      data: listResult.rows
    });
  } catch (error) {
    return next(error);
  }
}

export async function getProPropertyById(req, res, next) {
  try {
    const { propertyId } = req.params;
    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: "Property id is required."
      });
    }

    const property = await findProPropertyRecordById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found."
      });
    }

    return res.json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      data: property
    });
  } catch (error) {
    return next(error);
  }
}

export async function createProProperty(req, res, next) {
  try {
    const created = await createProPropertyRecord(req.body);

    return res.status(201).json({
      success: true,
      source: created.source,
      data: created.data
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateProProperty(req, res, next) {
  try {
    const { propertyId } = req.params;
    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: "Property id is required."
      });
    }

    const incoming = { ...req.body };
    const updates = {
      updatedAt: new Date().toISOString()
    };

    if (typeof incoming.title !== "undefined") {
      updates.title = String(incoming.title || "").trim();
    }
    if (typeof incoming.city !== "undefined") {
      updates.city = String(incoming.city || "").trim();
    }
    if (typeof incoming.price !== "undefined") {
      updates.price = Number(incoming.price || 0);
    }
    if (typeof incoming.propertyType !== "undefined") {
      updates.propertyType = String(incoming.propertyType || "Apartment").trim();
    }
    if (typeof incoming.bedrooms !== "undefined") {
      updates.bedrooms = Number(incoming.bedrooms || 0);
    }
    if (typeof incoming.bathrooms !== "undefined") {
      updates.bathrooms = Number(incoming.bathrooms || 0);
    }
    if (typeof incoming.areaSqft !== "undefined") {
      updates.areaSqft = Number(incoming.areaSqft || 0);
    }
    if (typeof incoming.description !== "undefined") {
      updates.description = String(incoming.description || "").trim();
    }
    if (typeof incoming.imageUrls !== "undefined") {
      updates.imageUrls = Array.isArray(incoming.imageUrls)
        ? incoming.imageUrls.filter(Boolean)
        : [];
    }
    if (typeof incoming.status !== "undefined") {
      updates.status = normalizeLegacyStatus(incoming.status);
    }
    if (typeof incoming.featured !== "undefined") {
      updates.featured = Boolean(incoming.featured);
    }
    if (typeof incoming.verified !== "undefined") {
      updates.verified = Boolean(incoming.verified);
    }
    if (typeof incoming.location !== "undefined") {
      updates.location = String(incoming.location || "").trim();
    }
    if (typeof incoming.ownerId !== "undefined") {
      updates.ownerId = String(incoming.ownerId || "").trim();
    }
    if (typeof incoming.ownerName !== "undefined") {
      updates.ownerName = String(incoming.ownerName || "").trim();
    }
    if (typeof incoming.category !== "undefined") {
      updates.category = String(incoming.category || "").trim();
    }
    if (typeof incoming.type !== "undefined") {
      updates.type = String(incoming.type || "").trim();
    }
    if (typeof incoming.trustScore !== "undefined") {
      updates.trustScore = Number(incoming.trustScore || 0);
    }
    if (typeof incoming.media !== "undefined" && incoming.media && typeof incoming.media === "object") {
      updates.media = incoming.media;
    }
    if (typeof incoming.aiReview !== "undefined" && incoming.aiReview && typeof incoming.aiReview === "object") {
      updates.aiReview = incoming.aiReview;
    }
    if (typeof incoming.privateDocs !== "undefined" && incoming.privateDocs && typeof incoming.privateDocs === "object") {
      updates.privateDocs = incoming.privateDocs;
    }
    if (typeof incoming.verification !== "undefined" && incoming.verification && typeof incoming.verification === "object") {
      updates.verification = incoming.verification;
    }
    if (typeof incoming.virtualTour !== "undefined" && incoming.virtualTour && typeof incoming.virtualTour === "object") {
      updates.virtualTour = incoming.virtualTour;
    }
    if (typeof incoming.visitBooking !== "undefined" && incoming.visitBooking && typeof incoming.visitBooking === "object") {
      updates.visitBooking = incoming.visitBooking;
    }
    if (typeof incoming.videoVisit !== "undefined" && incoming.videoVisit && typeof incoming.videoVisit === "object") {
      updates.videoVisit = incoming.videoVisit;
    }

    const updated = await updateProPropertyRecord(propertyId, updates);
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Property not found."
      });
    }

    return res.json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      data: updated
    });
  } catch (error) {
    return next(error);
  }
}

export async function deleteProProperty(req, res, next) {
  try {
    const { propertyId } = req.params;
    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: "Property id is required."
      });
    }

    const deleted = await deleteProPropertyRecord(propertyId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Property not found."
      });
    }

    return res.json({
      success: true,
      message: "Property deleted."
    });
  } catch (error) {
    return next(error);
  }
}

export async function approveProProperty(req, res, next) {
  try {
    const { propertyId } = req.params;
    const updated = await updateProPropertyRecord(propertyId, {
      status: "published",
      verified: true,
      updatedAt: new Date().toISOString()
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Property not found."
      });
    }

    return res.json({
      success: true,
      message: "Property approved.",
      data: updated
    });
  } catch (error) {
    return next(error);
  }
}

export async function featureProProperty(req, res, next) {
  try {
    const { propertyId } = req.params;
    const updated = await updateProPropertyRecord(propertyId, {
      featured: true,
      updatedAt: new Date().toISOString()
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Property not found."
      });
    }

    return res.json({
      success: true,
      message: "Property featured.",
      data: updated
    });
  } catch (error) {
    return next(error);
  }
}

export async function addProPropertyVisit(req, res, next) {
  try {
    const { propertyId } = req.params;
    const visit = {
      id: `visit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      propertyId,
      preferredAt: req.body?.preferredAt || null,
      mode: req.body?.mode || "in-person",
      note: req.body?.note || "",
      createdAt: new Date().toISOString()
    };

    proMemoryStore.visits.unshift(visit);
    const trimmed = proMemoryStore.visits.slice(0, 300);
    proMemoryStore.visits = trimmed;

    return res.status(201).json({
      success: true,
      data: visit
    });
  } catch (error) {
    return next(error);
  }
}
