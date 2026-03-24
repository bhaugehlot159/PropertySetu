import mongoose from "mongoose";
import CoreProperty from "../models/CoreProperty.js";
import { proRuntime } from "../../config/proRuntime.js";
import { proMemoryStore } from "../../runtime/proMemoryStore.js";
import { normalizeCoreProperty, toId } from "../utils/coreMappers.js";

const PROPERTY_TYPES = new Set(["buy", "rent"]);
const PROPERTY_CATEGORIES = new Set(["house", "plot", "commercial"]);

function text(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseBool(value) {
  if (typeof value === "boolean") return value;
  const raw = String(value || "").toLowerCase();
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  return undefined;
}

function normalizeType(type) {
  const value = text(type, "buy").toLowerCase();
  return PROPERTY_TYPES.has(value) ? value : "buy";
}

function normalizeCategory(category) {
  const value = text(category, "house").toLowerCase();
  return PROPERTY_CATEGORIES.has(value) ? value : "house";
}

function normalizeImages(images) {
  if (Array.isArray(images)) {
    return images.map((item) => text(item)).filter(Boolean);
  }
  if (typeof images === "string") {
    return images
      .split(",")
      .map((item) => text(item))
      .filter(Boolean);
  }
  return [];
}

function normalizeCreatePayload(body = {}) {
  return {
    title: text(body.title),
    description: text(body.description),
    city: text(body.city),
    location: text(body.location),
    type: normalizeType(body.type),
    category: normalizeCategory(body.category),
    price: numberValue(body.price, 0),
    size: numberValue(body.size, 0),
    images: normalizeImages(body.images),
    video: text(body.video),
    verified: Boolean(body.verified),
    featured: Boolean(body.featured)
  };
}

function normalizeUpdatePayload(body = {}) {
  const updates = {};

  if (typeof body.title !== "undefined") updates.title = text(body.title);
  if (typeof body.description !== "undefined") updates.description = text(body.description);
  if (typeof body.city !== "undefined") updates.city = text(body.city);
  if (typeof body.location !== "undefined") updates.location = text(body.location);
  if (typeof body.type !== "undefined") updates.type = normalizeType(body.type);
  if (typeof body.category !== "undefined") updates.category = normalizeCategory(body.category);
  if (typeof body.price !== "undefined") updates.price = numberValue(body.price, 0);
  if (typeof body.size !== "undefined") updates.size = numberValue(body.size, 0);
  if (typeof body.images !== "undefined") updates.images = normalizeImages(body.images);
  if (typeof body.video !== "undefined") updates.video = text(body.video);
  if (typeof body.verified !== "undefined") updates.verified = Boolean(body.verified);
  if (typeof body.featured !== "undefined") updates.featured = Boolean(body.featured);

  return updates;
}

function validatePropertyPayload(payload) {
  if (!payload.title) return "title is required.";
  if (!payload.city) return "city is required.";
  if (!payload.location) return "location is required.";
  if (!payload.price || payload.price <= 0) return "price must be greater than zero.";
  if (!payload.size || payload.size <= 0) return "size must be greater than zero.";
  return "";
}

function isAdmin(req) {
  return String(req.coreUser?.role || "").toLowerCase() === "admin";
}

function isOwner(record, userId) {
  return toId(record?.ownerId) === toId(userId);
}

function sortRows(rows, sortKey) {
  const list = [...rows];
  const key = text(sortKey, "newest").toLowerCase();

  if (key === "price_asc") {
    list.sort((a, b) => numberValue(a.price) - numberValue(b.price));
    return list;
  }
  if (key === "price_desc") {
    list.sort((a, b) => numberValue(b.price) - numberValue(a.price));
    return list;
  }
  if (key === "oldest") {
    list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    return list;
  }
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return list;
}

async function findCorePropertyById(propertyId) {
  if (!propertyId) return null;
  if (proRuntime.dbConnected) {
    return CoreProperty.findById(propertyId);
  }
  return proMemoryStore.coreProperties.find((item) => item._id === propertyId) || null;
}

export async function listCoreProperties(req, res, next) {
  try {
    const page = Math.max(1, numberValue(req.query.page, 1));
    const limit = Math.min(100, Math.max(1, numberValue(req.query.limit, 20)));
    const skip = (page - 1) * limit;
    const verified = parseBool(req.query.verified);
    const featured = parseBool(req.query.featured);
    const city = text(req.query.city);
    const type = text(req.query.type).toLowerCase();
    const category = text(req.query.category).toLowerCase();
    const ownerId = text(req.query.ownerId);
    const minPrice = numberValue(req.query.minPrice, 0);
    const maxPrice = numberValue(req.query.maxPrice, 0);
    const sort = text(req.query.sort, "newest");

    if (proRuntime.dbConnected) {
      const filters = {};
      if (city) filters.city = city;
      if (PROPERTY_TYPES.has(type)) filters.type = type;
      if (PROPERTY_CATEGORIES.has(category)) filters.category = category;
      if (typeof verified === "boolean") filters.verified = verified;
      if (typeof featured === "boolean") filters.featured = featured;
      if (ownerId && mongoose.Types.ObjectId.isValid(ownerId)) {
        filters.ownerId = ownerId;
      }

      if (minPrice > 0 || maxPrice > 0) {
        filters.price = {};
        if (minPrice > 0) filters.price.$gte = minPrice;
        if (maxPrice > 0) filters.price.$lte = maxPrice;
      }

      const sortObj =
        sort === "price_asc"
          ? { price: 1 }
          : sort === "price_desc"
            ? { price: -1 }
            : sort === "oldest"
              ? { createdAt: 1 }
              : { createdAt: -1 };

      const [rows, total] = await Promise.all([
        CoreProperty.find(filters).sort(sortObj).skip(skip).limit(limit).lean(),
        CoreProperty.countDocuments(filters)
      ]);

      return res.json({
        success: true,
        source: "mongodb",
        page,
        limit,
        total,
        count: rows.length,
        items: rows.map((item) => normalizeCoreProperty(item))
      });
    }

    let rows = [...proMemoryStore.coreProperties];
    if (city) rows = rows.filter((item) => item.city === city);
    if (PROPERTY_TYPES.has(type)) rows = rows.filter((item) => item.type === type);
    if (PROPERTY_CATEGORIES.has(category)) {
      rows = rows.filter((item) => item.category === category);
    }
    if (typeof verified === "boolean") {
      rows = rows.filter((item) => Boolean(item.verified) === verified);
    }
    if (typeof featured === "boolean") {
      rows = rows.filter((item) => Boolean(item.featured) === featured);
    }
    if (ownerId) rows = rows.filter((item) => toId(item.ownerId) === ownerId);
    if (minPrice > 0) rows = rows.filter((item) => numberValue(item.price) >= minPrice);
    if (maxPrice > 0) rows = rows.filter((item) => numberValue(item.price) <= maxPrice);

    rows = sortRows(rows, sort);
    const paginated = rows.slice(skip, skip + limit);

    return res.json({
      success: true,
      source: "memory",
      page,
      limit,
      total: rows.length,
      count: paginated.length,
      items: paginated.map((item) => normalizeCoreProperty(item))
    });
  } catch (error) {
    return next(error);
  }
}

export async function getCorePropertyById(req, res, next) {
  try {
    const propertyId = text(req.params.propertyId);
    const property = await findCorePropertyById(propertyId);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found."
      });
    }

    return res.json({
      success: true,
      item: normalizeCoreProperty(property)
    });
  } catch (error) {
    return next(error);
  }
}

export async function createCoreProperty(req, res, next) {
  try {
    const payload = normalizeCreatePayload(req.body);
    const validation = validatePropertyPayload(payload);
    if (validation) {
      return res.status(400).json({
        success: false,
        message: validation
      });
    }

    const ownerId = toId(req.coreUser?.id);
    let created;

    if (proRuntime.dbConnected) {
      created = await CoreProperty.create({
        ...payload,
        ownerId
      });
    } else {
      created = {
        _id: `prop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ...payload,
        ownerId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      proMemoryStore.coreProperties.push(created);
    }

    return res.status(201).json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      item: normalizeCoreProperty(created)
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateCoreProperty(req, res, next) {
  try {
    const propertyId = text(req.params.propertyId);
    const existing = await findCorePropertyById(propertyId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Property not found."
      });
    }

    const currentUserId = toId(req.coreUser?.id);
    if (!isAdmin(req) && !isOwner(existing, currentUserId)) {
      return res.status(403).json({
        success: false,
        message: "You can update only your own property."
      });
    }

    const updates = normalizeUpdatePayload(req.body);
    if (!Object.keys(updates).length) {
      return res.status(400).json({
        success: false,
        message: "No valid update fields provided."
      });
    }

    let updated;
    if (proRuntime.dbConnected) {
      updated = await CoreProperty.findByIdAndUpdate(
        propertyId,
        { $set: updates },
        { new: true }
      );
    } else {
      const index = proMemoryStore.coreProperties.findIndex((item) => item._id === propertyId);
      if (index >= 0) {
        proMemoryStore.coreProperties[index] = {
          ...proMemoryStore.coreProperties[index],
          ...updates,
          updatedAt: new Date().toISOString()
        };
        updated = proMemoryStore.coreProperties[index];
      }
    }

    return res.json({
      success: true,
      item: normalizeCoreProperty(updated)
    });
  } catch (error) {
    return next(error);
  }
}

export async function deleteCoreProperty(req, res, next) {
  try {
    const propertyId = text(req.params.propertyId);
    const existing = await findCorePropertyById(propertyId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Property not found."
      });
    }

    const currentUserId = toId(req.coreUser?.id);
    if (!isAdmin(req) && !isOwner(existing, currentUserId)) {
      return res.status(403).json({
        success: false,
        message: "You can delete only your own property."
      });
    }

    if (proRuntime.dbConnected) {
      await CoreProperty.findByIdAndDelete(propertyId);
    } else {
      proMemoryStore.coreProperties = proMemoryStore.coreProperties.filter(
        (item) => item._id !== propertyId
      );
      proMemoryStore.coreReviews = proMemoryStore.coreReviews.filter(
        (item) => toId(item.propertyId) !== propertyId
      );
    }

    return res.json({
      success: true,
      message: "Property deleted successfully."
    });
  } catch (error) {
    return next(error);
  }
}

export async function verifyCoreProperty(req, res, next) {
  try {
    const propertyId = text(req.params.propertyId);
    const verified =
      typeof req.body?.verified === "undefined" ? true : Boolean(req.body?.verified);

    let updated;
    if (proRuntime.dbConnected) {
      updated = await CoreProperty.findByIdAndUpdate(
        propertyId,
        { $set: { verified } },
        { new: true }
      );
    } else {
      const index = proMemoryStore.coreProperties.findIndex((item) => item._id === propertyId);
      if (index >= 0) {
        proMemoryStore.coreProperties[index] = {
          ...proMemoryStore.coreProperties[index],
          verified,
          updatedAt: new Date().toISOString()
        };
        updated = proMemoryStore.coreProperties[index];
      }
    }

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Property not found."
      });
    }

    return res.json({
      success: true,
      item: normalizeCoreProperty(updated)
    });
  } catch (error) {
    return next(error);
  }
}

export async function featureCoreProperty(req, res, next) {
  try {
    const propertyId = text(req.params.propertyId);
    const featured =
      typeof req.body?.featured === "undefined" ? true : Boolean(req.body?.featured);

    let updated;
    if (proRuntime.dbConnected) {
      updated = await CoreProperty.findByIdAndUpdate(
        propertyId,
        { $set: { featured } },
        { new: true }
      );
    } else {
      const index = proMemoryStore.coreProperties.findIndex((item) => item._id === propertyId);
      if (index >= 0) {
        proMemoryStore.coreProperties[index] = {
          ...proMemoryStore.coreProperties[index],
          featured,
          updatedAt: new Date().toISOString()
        };
        updated = proMemoryStore.coreProperties[index];
      }
    }

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Property not found."
      });
    }

    return res.json({
      success: true,
      item: normalizeCoreProperty(updated)
    });
  } catch (error) {
    return next(error);
  }
}
