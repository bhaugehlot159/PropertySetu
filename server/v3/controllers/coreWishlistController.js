import mongoose from "mongoose";
import CoreProperty from "../models/CoreProperty.js";
import CoreWishlistItem from "../models/CoreWishlistItem.js";
import { proRuntime } from "../../config/proRuntime.js";
import { proMemoryStore } from "../../runtime/proMemoryStore.js";
import { normalizeCoreProperty, toId } from "../utils/coreMappers.js";

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

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeWishlistRow(doc) {
  const row = doc && typeof doc.toObject === "function" ? doc.toObject() : doc;
  if (!row) return null;
  return {
    _id: toId(row._id || row.id),
    id: toId(row._id || row.id),
    userId: toId(row.userId),
    propertyId: toId(row.propertyId),
    createdAt: asIso(row.createdAt),
    updatedAt: asIso(row.updatedAt)
  };
}

function propertyCompareSummary(property) {
  const row = normalizeCoreProperty(property);
  if (!row) return null;

  return {
    id: row.id,
    title: row.title,
    city: row.city,
    location: row.location,
    type: row.type,
    category: row.category,
    price: numberValue(row.price, 0),
    size: numberValue(row.size, 0),
    bhk: numberValue(row.bhk, 0),
    furnishing: text(row.furnishing, ""),
    constructionStatus: text(row.constructionStatus, ""),
    loanAvailable: Boolean(row.loanAvailable),
    verified: Boolean(row.verified),
    featured: Boolean(row.featured),
    images: Array.isArray(row.images) ? row.images.slice(0, 3) : []
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

async function listUserWishlistRows(userId) {
  if (proRuntime.dbConnected) {
    if (!mongoose.Types.ObjectId.isValid(userId)) return [];
    return CoreWishlistItem.find({ userId }).sort({ createdAt: -1 }).lean();
  }
  return proMemoryStore.coreWishlistItems
    .filter((item) => toId(item.userId) === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function getPropertyMapByIds(propertyIds = []) {
  const ids = [...new Set(propertyIds.filter(Boolean))];
  if (!ids.length) return {};

  if (proRuntime.dbConnected) {
    const validIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
    if (!validIds.length) return {};
    const rows = await CoreProperty.find({ _id: { $in: validIds } }).lean();
    return rows.reduce((acc, row) => {
      acc[toId(row._id)] = propertyCompareSummary(row);
      return acc;
    }, {});
  }

  const map = {};
  proMemoryStore.coreProperties.forEach((item) => {
    const id = toId(item._id || item.id);
    if (ids.includes(id)) {
      map[id] = propertyCompareSummary(item);
    }
  });
  return map;
}

function buildCompareHighlights(items = []) {
  if (!items.length) return {};
  const bestPrice = [...items].sort((a, b) => a.price - b.price)[0];
  const largestSize = [...items].sort((a, b) => b.size - a.size)[0];
  const mostVerified = items.filter((item) => item.verified).length;

  return {
    bestPrice: bestPrice ? { propertyId: bestPrice.id, price: bestPrice.price } : null,
    largestSize: largestSize ? { propertyId: largestSize.id, size: largestSize.size } : null,
    verifiedCount: mostVerified
  };
}

export async function addCoreWishlistItem(req, res, next) {
  try {
    const userId = toId(req.coreUser?.id);
    const propertyId = text(req.params.propertyId || req.body?.propertyId);
    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: "propertyId is required."
      });
    }

    const property = await findPropertyById(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found."
      });
    }

    let saved = null;
    let alreadySaved = false;

    if (proRuntime.dbConnected) {
      if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(propertyId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user/property id for wishlist."
        });
      }

      const existing = await CoreWishlistItem.findOne({ userId, propertyId }).lean();
      if (existing) {
        saved = existing;
        alreadySaved = true;
      } else {
        saved = await CoreWishlistItem.create({ userId, propertyId });
      }
    } else {
      const existing = proMemoryStore.coreWishlistItems.find(
        (item) => toId(item.userId) === userId && toId(item.propertyId) === propertyId
      );
      if (existing) {
        saved = existing;
        alreadySaved = true;
      } else {
        saved = {
          _id: `wish-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          userId,
          propertyId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        proMemoryStore.coreWishlistItems.unshift(saved);
        proMemoryStore.coreWishlistItems = proMemoryStore.coreWishlistItems.slice(0, 8000);
      }
    }

    return res.status(alreadySaved ? 200 : 201).json({
      success: true,
      alreadySaved,
      item: normalizeWishlistRow(saved),
      property: propertyCompareSummary(property)
    });
  } catch (error) {
    return next(error);
  }
}

export async function removeCoreWishlistItem(req, res, next) {
  try {
    const userId = toId(req.coreUser?.id);
    const propertyId = text(req.params.propertyId || req.body?.propertyId);
    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: "propertyId is required."
      });
    }

    let removedCount = 0;
    if (proRuntime.dbConnected) {
      if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(propertyId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user/property id for wishlist."
        });
      }
      const result = await CoreWishlistItem.deleteOne({ userId, propertyId });
      removedCount = Number(result.deletedCount || 0);
    } else {
      const before = proMemoryStore.coreWishlistItems.length;
      proMemoryStore.coreWishlistItems = proMemoryStore.coreWishlistItems.filter(
        (item) => !(toId(item.userId) === userId && toId(item.propertyId) === propertyId)
      );
      removedCount = before - proMemoryStore.coreWishlistItems.length;
    }

    return res.json({
      success: true,
      removed: removedCount > 0
    });
  } catch (error) {
    return next(error);
  }
}

export async function listCoreWishlistItems(req, res, next) {
  try {
    const userId = toId(req.coreUser?.id);
    const rows = await listUserWishlistRows(userId);
    const normalizedRows = rows.map((row) => normalizeWishlistRow(row));
    const propertyMap = await getPropertyMapByIds(
      normalizedRows.map((item) => item.propertyId)
    );

    const items = normalizedRows
      .map((item) => ({
        ...item,
        property: propertyMap[item.propertyId] || null
      }))
      .filter((item) => item.property);

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

export async function compareCoreWishlistProperties(req, res, next) {
  try {
    const userId = toId(req.coreUser?.id);
    const incomingIds = text(req.query.propertyIds)
      .split(",")
      .map((item) => text(item))
      .filter(Boolean);

    let propertyIds = [...new Set(incomingIds)];
    if (!propertyIds.length) {
      const wishlistRows = await listUserWishlistRows(userId);
      propertyIds = wishlistRows
        .slice(0, 3)
        .map((item) => toId(item.propertyId))
        .filter(Boolean);
    }

    propertyIds = propertyIds.slice(0, 3);
    if (propertyIds.length < 2) {
      return res.status(400).json({
        success: false,
        message: "At least 2 propertyIds are required for compare."
      });
    }

    const propertyMap = await getPropertyMapByIds(propertyIds);
    const items = propertyIds.map((id) => propertyMap[id]).filter(Boolean);
    if (items.length < 2) {
      return res.status(404).json({
        success: false,
        message: "Compare properties not found."
      });
    }

    return res.json({
      success: true,
      total: items.length,
      items,
      compareTable: [
        { key: "price", label: "Price", values: items.map((item) => item.price) },
        { key: "size", label: "Size", values: items.map((item) => item.size) },
        { key: "bhk", label: "BHK", values: items.map((item) => item.bhk) },
        { key: "furnishing", label: "Furnishing", values: items.map((item) => item.furnishing) },
        {
          key: "constructionStatus",
          label: "Construction Status",
          values: items.map((item) => item.constructionStatus)
        },
        {
          key: "loanAvailable",
          label: "Loan Available",
          values: items.map((item) => item.loanAvailable)
        },
        { key: "verified", label: "Verified", values: items.map((item) => item.verified) }
      ],
      highlights: buildCompareHighlights(items)
    });
  } catch (error) {
    return next(error);
  }
}
