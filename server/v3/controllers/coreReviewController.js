import mongoose from "mongoose";
import CoreProperty from "../models/CoreProperty.js";
import CoreReview from "../models/CoreReview.js";
import { proRuntime } from "../../config/proRuntime.js";
import { proMemoryStore } from "../../runtime/proMemoryStore.js";
import {
  normalizeCoreReview,
  reviewsSummary,
  toId
} from "../utils/coreMappers.js";

function text(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function propertyExists(propertyId) {
  if (!propertyId) return false;
  if (proRuntime.dbConnected) {
    if (!mongoose.Types.ObjectId.isValid(propertyId)) return false;
    const count = await CoreProperty.countDocuments({ _id: propertyId });
    return count > 0;
  }
  return proMemoryStore.coreProperties.some((item) => item._id === propertyId);
}

export async function createCoreReview(req, res, next) {
  try {
    const propertyId = text(req.body?.propertyId);
    const rating = numberValue(req.body?.rating, 0);
    const comment = text(req.body?.comment);
    const userId = toId(req.coreUser?.id);

    if (!propertyId || !rating || !comment) {
      return res.status(400).json({
        success: false,
        message: "propertyId, rating and comment are required."
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "rating must be between 1 and 5."
      });
    }

    const exists = await propertyExists(propertyId);
    if (!exists) {
      return res.status(404).json({
        success: false,
        message: "Property not found."
      });
    }

    if (proRuntime.dbConnected) {
      const existingReview = await CoreReview.findOne({ propertyId, userId });
      if (existingReview) {
        return res.status(409).json({
          success: false,
          message: "You already reviewed this property."
        });
      }

      const created = await CoreReview.create({
        propertyId,
        userId,
        rating,
        comment
      });

      return res.status(201).json({
        success: true,
        source: "mongodb",
        item: normalizeCoreReview(created)
      });
    }

    const duplicate = proMemoryStore.coreReviews.find(
      (item) => toId(item.propertyId) === propertyId && toId(item.userId) === userId
    );
    if (duplicate) {
      return res.status(409).json({
        success: false,
        message: "You already reviewed this property."
      });
    }

    const created = {
      _id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      propertyId,
      userId,
      rating,
      comment,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    proMemoryStore.coreReviews.push(created);

    return res.status(201).json({
      success: true,
      source: "memory",
      item: normalizeCoreReview(created)
    });
  } catch (error) {
    return next(error);
  }
}

export async function listCoreReviewsByProperty(req, res, next) {
  try {
    const propertyId = text(req.params.propertyId || req.query.propertyId);
    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: "propertyId is required."
      });
    }

    let rows;
    if (proRuntime.dbConnected) {
      rows = await CoreReview.find({ propertyId }).sort({ createdAt: -1 }).lean();
    } else {
      rows = proMemoryStore.coreReviews
        .filter((item) => toId(item.propertyId) === propertyId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    const items = rows.map((item) => normalizeCoreReview(item));
    return res.json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      total: items.length,
      summary: reviewsSummary(items),
      items
    });
  } catch (error) {
    return next(error);
  }
}
