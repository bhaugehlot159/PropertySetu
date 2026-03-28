import mongoose from "mongoose";
import CoreProperty from "../models/CoreProperty.js";
import { proRuntime } from "../../config/proRuntime.js";
import { proMemoryStore } from "../../runtime/proMemoryStore.js";
import {
  CORE_PROPERTY_CATEGORY_VALUES,
  CORE_PROPERTY_TYPE_VALUES,
  getCorePropertyTaxonomy as getCorePropertyTaxonomyConfig,
  normalizeCorePropertyCategory,
  normalizeCorePropertyType
} from "../config/corePropertyTaxonomy.js";
import { normalizeCoreProperty, toId } from "../utils/coreMappers.js";

const PROPERTY_TYPES = new Set(CORE_PROPERTY_TYPE_VALUES);
const PROPERTY_CATEGORIES = new Set(CORE_PROPERTY_CATEGORY_VALUES);
const FURNISHING_TYPES = new Set(["furnished", "semi", "unfurnished"]);
const CONSTRUCTION_STATUS_TYPES = new Set(["ready-to-move", "under-construction"]);
const MIN_REQUIRED_PHOTOS = 5;
const MIN_VIDEO_DURATION_SEC = 30;
const MAX_VIDEO_DURATION_SEC = 60;

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

function parseOptionalNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDateValue(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function getViewerFromRequest(req) {
  if (req?.coreUser?.id) {
    return {
      id: toId(req.coreUser.id),
      role: text(req.coreUser.role, "buyer").toLowerCase()
    };
  }
  return null;
}

function normalizeType(type) {
  return normalizeCorePropertyType(type, "buy");
}

function normalizeCategory(category) {
  return normalizeCorePropertyCategory(category, "house");
}

function normalizeBhk(value) {
  const parsed = Math.round(numberValue(value, 0));
  return Math.max(0, Math.min(20, parsed));
}

function normalizeFurnishing(value) {
  const normalized = text(value).toLowerCase();
  return FURNISHING_TYPES.has(normalized) ? normalized : "";
}

function normalizeConstructionStatus(value) {
  const normalized = text(value).toLowerCase();
  return CONSTRUCTION_STATUS_TYPES.has(normalized) ? normalized : "";
}

function normalizeCoordinates(value = {}, fallback = null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    if (fallback && typeof fallback === "object" && !Array.isArray(fallback)) {
      return normalizeCoordinates(fallback, null);
    }
    return { lat: null, lng: null };
  }
  const lat = parseOptionalNumber(value.lat);
  const lng = parseOptionalNumber(value.lng);
  const validLat = lat !== null && lat >= -90 && lat <= 90 ? lat : null;
  const validLng = lng !== null && lng >= -180 && lng <= 180 ? lng : null;
  return { lat: validLat, lng: validLng };
}

function hasCoordinates(value = {}) {
  return Number.isFinite(Number(value.lat)) && Number.isFinite(Number(value.lng));
}

function distanceInKm(from, to) {
  if (!hasCoordinates(from) || !hasCoordinates(to)) return Number.POSITIVE_INFINITY;

  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(Number(to.lat) - Number(from.lat));
  const dLng = toRad(Number(to.lng) - Number(from.lng));
  const lat1 = toRad(Number(from.lat));
  const lat2 = toRad(Number(to.lat));
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
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

function normalizeObject(value, fallback = {}) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...value };
  }
  return { ...fallback };
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => text(item)).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => text(item))
      .filter(Boolean);
  }
  return [];
}

function normalizeMedia(media = {}) {
  const row = normalizeObject(media);
  return {
    ...row,
    photosCount: Math.max(
      0,
      numberValue(row.photosCount, normalizeStringArray(row.photoNames).length)
    ),
    videoUploaded:
      typeof row.videoUploaded === "boolean"
        ? row.videoUploaded
        : Boolean(text(row.videoName || row.videoUrl)),
    videoDurationSec: Math.max(0, numberValue(row.videoDurationSec, 0)),
    photoNames: normalizeStringArray(row.photoNames),
    videoName: text(row.videoName),
    floorPlanName: text(row.floorPlanName)
  };
}

function normalizePrivateDocs(privateDocs = {}) {
  const row = normalizeObject(privateDocs);
  const uploadedPrivateDocs = Array.isArray(row.uploadedPrivateDocs)
    ? row.uploadedPrivateDocs
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          id: text(item.id),
          category: text(item.category),
          name: text(item.name),
          url: text(item.url),
          sizeBytes: numberValue(item.sizeBytes, 0)
        }))
    : [];

  return {
    ...row,
    propertyDocuments: normalizeStringArray(row.propertyDocuments),
    ownerIdProof: text(row.ownerIdProof),
    addressProof: text(row.addressProof),
    privateViewMode: text(row.privateViewMode, "Private View Only"),
    uploadedPrivateDocs
  };
}

function normalizeMixedObject(value) {
  return normalizeObject(value);
}

function canViewerAccessPrivateDocs(property = {}, viewer = null) {
  const viewerId = toId(viewer?.id);
  const viewerRole = text(viewer?.role).toLowerCase();
  const ownerId = toId(property?.ownerId);

  if (!viewerId && viewerRole !== "admin") return false;
  if (viewerRole === "admin") return true;
  return Boolean(viewerId && ownerId && viewerId === ownerId);
}

function buildRestrictedPrivateDocs(privateDocs = {}) {
  const docs =
    privateDocs && typeof privateDocs === "object" && !Array.isArray(privateDocs)
      ? privateDocs
      : {};
  const uploadedPrivateDocs = Array.isArray(docs.uploadedPrivateDocs)
    ? docs.uploadedPrivateDocs
    : [];
  const propertyDocuments = Array.isArray(docs.propertyDocuments)
    ? docs.propertyDocuments
    : [];

  const totalDocuments =
    uploadedPrivateDocs.length +
    propertyDocuments.length +
    (text(docs.ownerIdProof) ? 1 : 0) +
    (text(docs.addressProof) ? 1 : 0);

  return {
    privateViewMode: "Restricted",
    totalDocuments,
    hasOwnerIdProof: Boolean(text(docs.ownerIdProof)),
    hasAddressProof: Boolean(text(docs.addressProof)),
    uploadedPrivateDocs: uploadedPrivateDocs.map((item) => ({
      id: text(item?.id),
      category: text(item?.category),
      name: text(item?.name)
    })),
    note: "Private documents are visible only to property owner or admin."
  };
}

function normalizePrivateDocsForSecureView(privateDocs = {}) {
  const docs =
    privateDocs && typeof privateDocs === "object" && !Array.isArray(privateDocs)
      ? privateDocs
      : {};
  return {
    propertyDocuments: normalizeStringArray(docs.propertyDocuments),
    ownerIdProof: text(docs.ownerIdProof),
    addressProof: text(docs.addressProof),
    privateViewMode: text(docs.privateViewMode, "Private View Only"),
    uploadedPrivateDocs: Array.isArray(docs.uploadedPrivateDocs)
      ? docs.uploadedPrivateDocs
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            id: text(item.id),
            category: text(item.category),
            name: text(item.name),
            url: text(item.url),
            sizeBytes: numberValue(item.sizeBytes, 0)
          }))
      : []
  };
}

function projectPropertyForViewer(property, viewer = null, options = {}) {
  const normalized = normalizeCoreProperty(property);
  if (!normalized) return null;

  if (options.includePrivateDocs || canViewerAccessPrivateDocs(normalized, viewer)) {
    return normalized;
  }

  return {
    ...normalized,
    privateDocs: buildRestrictedPrivateDocs(normalized.privateDocs)
  };
}

function buildAutoDescription(payload = {}) {
  const title = text(payload.title, "Property");
  const category = text(payload.category, "house");
  const type = text(payload.type, "buy");
  const location = text(payload.location, "Udaipur");
  const city = text(payload.city, "Udaipur");
  const size = numberValue(payload.size, 0);
  const price = numberValue(payload.price, 0);
  const bhk = normalizeBhk(payload.bhk);
  const furnishing = normalizeFurnishing(payload.furnishing);
  const constructionStatus = normalizeConstructionStatus(payload.constructionStatus);
  const loanAvailable = Boolean(parseBool(payload.loanAvailable));
  const photosCount = Math.max(
    normalizeImages(payload.images).length,
    numberValue(payload?.media?.photosCount, 0)
  );
  const hasVideo = Boolean(text(payload.video) || payload?.media?.videoUploaded);
  const documentsReady = Boolean(
    normalizePrivateDocs(payload.privateDocs).propertyDocuments.length ||
      normalizePrivateDocs(payload.privateDocs).uploadedPrivateDocs.length
  );

  return [
    `${title} available for ${type} in ${location}, ${city}.`,
    `${category} category with ${size} sqft built-up area and expected price INR ${price.toLocaleString(
      "en-IN"
    )}.`,
    `${bhk > 0 ? `${bhk} BHK configuration` : "Configuration details"} with ${furnishing || "flexible furnishing"} and ${constructionStatus || "ready timeline under review"}.`,
    `${loanAvailable ? "Loan support is available for eligible buyers." : "Loan support details can be requested from owner."}`,
    `${photosCount} photos and ${hasVideo ? "a short video tour" : "media details"} are attached for listing review.`,
    `${documentsReady ? "Private documents are uploaded for verification." : "Private document verification is in progress."}`
  ].join(" ");
}

function shouldApplyProfessionalUploadRules(payload = {}, options = {}) {
  if (Boolean(options.forceProfessionalRules)) return true;
  return Boolean(
    payload.media ||
      payload.privateDocs ||
      payload.detailStructure ||
      payload.verification ||
      payload.videoVisit
  );
}

function validateProfessionalUploadRules(payload = {}, options = {}) {
  if (!shouldApplyProfessionalUploadRules(payload, options)) return "";

  const media = normalizeMedia(payload.media);
  const privateDocs = normalizePrivateDocs(payload.privateDocs);
  const imageCount = normalizeImages(payload.images).length;
  const photoCount = Math.max(
    imageCount,
    numberValue(media.photosCount, 0),
    normalizeStringArray(media.photoNames).length
  );

  if (photoCount < MIN_REQUIRED_PHOTOS) {
    return `Minimum ${MIN_REQUIRED_PHOTOS} photos are required for professional upload.`;
  }

  const hasSingleVideo =
    Boolean(text(payload.video)) || Boolean(media.videoUploaded || text(media.videoName));
  if (!hasSingleVideo) {
    return "One short property video is required for professional upload.";
  }

  const duration = numberValue(media.videoDurationSec, 0);
  if (
    duration > 0 &&
    (duration < MIN_VIDEO_DURATION_SEC || duration > MAX_VIDEO_DURATION_SEC)
  ) {
    return `Video duration must be between ${MIN_VIDEO_DURATION_SEC} and ${MAX_VIDEO_DURATION_SEC} seconds.`;
  }

  const hasPrivateDocs =
    privateDocs.propertyDocuments.length > 0 ||
    Boolean(privateDocs.ownerIdProof) ||
    Boolean(privateDocs.addressProof) ||
    privateDocs.uploadedPrivateDocs.length > 0;

  if (!hasPrivateDocs) {
    return "Private document upload is required for professional listing flow.";
  }

  return "";
}

function normalizeCreatePayload(body = {}) {
  const payload = {
    title: text(body.title),
    description: text(body.description),
    city: text(body.city),
    location: text(body.location),
    type: normalizeType(body.type),
    category: normalizeCategory(body.category),
    price: numberValue(body.price, 0),
    size: numberValue(body.size, 0),
    bhk: normalizeBhk(body.bhk),
    furnishing: normalizeFurnishing(body.furnishing),
    constructionStatus: normalizeConstructionStatus(body.constructionStatus),
    loanAvailable: Boolean(parseBool(body.loanAvailable)),
    coordinates: normalizeCoordinates(
      body.coordinates,
      typeof body.latitude !== "undefined" || typeof body.longitude !== "undefined"
        ? { lat: body.latitude, lng: body.longitude }
        : null
    ),
    images: normalizeImages(body.images),
    video: text(body.video),
    media: normalizeMedia(body.media),
    privateDocs: normalizePrivateDocs(body.privateDocs),
    detailStructure: normalizeMixedObject(body.detailStructure),
    verification: normalizeMixedObject(body.verification),
    virtualTour: normalizeMixedObject(body.virtualTour),
    visitBooking: normalizeMixedObject(body.visitBooking),
    videoVisit: normalizeMixedObject(body.videoVisit),
    aiReview: normalizeMixedObject(body.aiReview),
    verified: Boolean(body.verified),
    verifiedByPropertySetu: Boolean(body.verifiedByPropertySetu),
    verifiedBadge: normalizeMixedObject(body.verifiedBadge),
    featured: Boolean(body.featured),
    featuredUntil: normalizeDateValue(body.featuredUntil)
  };
  if (!payload.description) {
    payload.description = buildAutoDescription(payload);
  }
  return payload;
}

function normalizeUpdatePayload(body = {}, existing = null) {
  const updates = {};

  if (typeof body.title !== "undefined") updates.title = text(body.title);
  if (typeof body.description !== "undefined") updates.description = text(body.description);
  if (typeof body.city !== "undefined") updates.city = text(body.city);
  if (typeof body.location !== "undefined") updates.location = text(body.location);
  if (typeof body.type !== "undefined") updates.type = normalizeType(body.type);
  if (typeof body.category !== "undefined") updates.category = normalizeCategory(body.category);
  if (typeof body.price !== "undefined") updates.price = numberValue(body.price, 0);
  if (typeof body.size !== "undefined") updates.size = numberValue(body.size, 0);
  if (typeof body.bhk !== "undefined") updates.bhk = normalizeBhk(body.bhk);
  if (typeof body.furnishing !== "undefined") {
    updates.furnishing = normalizeFurnishing(body.furnishing);
  }
  if (typeof body.constructionStatus !== "undefined") {
    updates.constructionStatus = normalizeConstructionStatus(body.constructionStatus);
  }
  if (typeof body.loanAvailable !== "undefined") {
    updates.loanAvailable = Boolean(parseBool(body.loanAvailable));
  }
  if (
    typeof body.coordinates !== "undefined" ||
    typeof body.latitude !== "undefined" ||
    typeof body.longitude !== "undefined"
  ) {
    updates.coordinates = normalizeCoordinates(
      body.coordinates,
      typeof body.latitude !== "undefined" || typeof body.longitude !== "undefined"
        ? { lat: body.latitude, lng: body.longitude }
        : null
    );
  }
  if (typeof body.images !== "undefined") updates.images = normalizeImages(body.images);
  if (typeof body.video !== "undefined") updates.video = text(body.video);
  if (typeof body.media !== "undefined") updates.media = normalizeMedia(body.media);
  if (typeof body.privateDocs !== "undefined") {
    updates.privateDocs = normalizePrivateDocs(body.privateDocs);
  }
  if (typeof body.detailStructure !== "undefined") {
    updates.detailStructure = normalizeMixedObject(body.detailStructure);
  }
  if (typeof body.verification !== "undefined") {
    updates.verification = normalizeMixedObject(body.verification);
  }
  if (typeof body.virtualTour !== "undefined") {
    updates.virtualTour = normalizeMixedObject(body.virtualTour);
  }
  if (typeof body.visitBooking !== "undefined") {
    updates.visitBooking = normalizeMixedObject(body.visitBooking);
  }
  if (typeof body.videoVisit !== "undefined") {
    updates.videoVisit = normalizeMixedObject(body.videoVisit);
  }
  if (typeof body.aiReview !== "undefined") updates.aiReview = normalizeMixedObject(body.aiReview);
  if (typeof body.verified !== "undefined") updates.verified = Boolean(body.verified);
  if (typeof body.verifiedByPropertySetu !== "undefined") {
    updates.verifiedByPropertySetu = Boolean(body.verifiedByPropertySetu);
  }
  if (typeof body.verifiedBadge !== "undefined") {
    updates.verifiedBadge = normalizeMixedObject(body.verifiedBadge);
  }
  if (typeof body.featured !== "undefined") updates.featured = Boolean(body.featured);
  if (typeof body.featuredUntil !== "undefined") {
    updates.featuredUntil = normalizeDateValue(body.featuredUntil);
  }

  const merged = {
    ...(existing && typeof existing === "object" ? existing : {}),
    ...updates
  };
  const shouldAutoGenerate =
    typeof body.description !== "undefined"
      ? !updates.description
      : !text(merged.description);
  if (shouldAutoGenerate) {
    updates.description = buildAutoDescription(merged);
  }

  return updates;
}

function validatePropertyPayload(payload, options = {}) {
  if (!payload.title) return "title is required.";
  if (!payload.city) return "city is required.";
  if (!payload.location) return "location is required.";
  if (!payload.price || payload.price <= 0) return "price must be greater than zero.";
  if (!payload.size || payload.size <= 0) return "size must be greater than zero.";
  return validateProfessionalUploadRules(payload, options);
}

function validateUpdatePayload(existing = {}, updates = {}, options = {}) {
  const merged = { ...existing, ...updates };
  if (!merged.title) return "title is required.";
  if (!merged.city) return "city is required.";
  if (!merged.location) return "location is required.";
  if (!numberValue(merged.price, 0) || numberValue(merged.price, 0) <= 0) {
    return "price must be greater than zero.";
  }
  if (!numberValue(merged.size, 0) || numberValue(merged.size, 0) <= 0) {
    return "size must be greater than zero.";
  }
  return validateProfessionalUploadRules(merged, options);
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

function buildPropertyCompareSummary(item = {}) {
  return {
    id: toId(item.id || item._id),
    title: text(item.title),
    city: text(item.city),
    location: text(item.location),
    type: text(item.type),
    category: text(item.category),
    price: numberValue(item.price, 0),
    size: numberValue(item.size, 0),
    bhk: numberValue(item.bhk, 0),
    furnishing: text(item.furnishing),
    constructionStatus: text(item.constructionStatus),
    loanAvailable: Boolean(item.loanAvailable),
    verified: Boolean(item.verified),
    featured: Boolean(item.featured),
    mapView:
      item.mapView && typeof item.mapView === "object" && !Array.isArray(item.mapView)
        ? item.mapView
        : {},
    images: Array.isArray(item.images) ? item.images.slice(0, 3) : []
  };
}

function buildCompareHighlights(items = []) {
  if (!items.length) return {};
  const bestPrice = [...items].sort((a, b) => numberValue(a.price, 0) - numberValue(b.price, 0))[0];
  const largestSize = [...items].sort((a, b) => numberValue(b.size, 0) - numberValue(a.size, 0))[0];
  return {
    bestPrice: bestPrice ? { propertyId: bestPrice.id, price: bestPrice.price } : null,
    largestSize: largestSize ? { propertyId: largestSize.id, size: largestSize.size } : null,
    verifiedCount: items.filter((item) => item.verified).length
  };
}

async function findCorePropertyById(propertyId) {
  if (!propertyId) return null;
  if (proRuntime.dbConnected) {
    if (!mongoose.Types.ObjectId.isValid(propertyId)) return null;
    return CoreProperty.findById(propertyId);
  }
  return (
    proMemoryStore.coreProperties.find((item) => toId(item._id || item.id) === propertyId) ||
    null
  );
}

export function getCorePropertyTaxonomyOptions(_req, res) {
  const taxonomy = getCorePropertyTaxonomyConfig();
  return res.json({
    success: true,
    defaults: {
      type: "buy",
      category: "house"
    },
    ...taxonomy
  });
}

export async function compareCoreProperties(req, res, next) {
  try {
    const viewer = getViewerFromRequest(req);
    const rawFromQuery = text(req.query?.propertyIds);
    const rawFromBody = Array.isArray(req.body?.propertyIds)
      ? req.body.propertyIds.join(",")
      : text(req.body?.propertyIds);

    const propertyIds = [...new Set(text(rawFromQuery || rawFromBody)
      .split(",")
      .map((item) => text(item))
      .filter(Boolean))]
      .slice(0, 3);

    if (propertyIds.length < 2) {
      return res.status(400).json({
        success: false,
        message: "At least 2 propertyIds are required for compare."
      });
    }

    let rows = [];
    if (proRuntime.dbConnected) {
      const validIds = propertyIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
      if (validIds.length < 2) {
        return res.status(400).json({
          success: false,
          message: "At least 2 valid propertyIds are required for compare."
        });
      }
      rows = await CoreProperty.find({
        _id: { $in: validIds }
      }).lean();
    } else {
      rows = proMemoryStore.coreProperties.filter((item) =>
        propertyIds.includes(toId(item._id || item.id))
      );
    }

    const mapById = new Map(
      rows.map((row) => {
        const normalized = projectPropertyForViewer(row, viewer);
        const summary = buildPropertyCompareSummary(normalized);
        return [summary.id, summary];
      })
    );
    const items = propertyIds.map((id) => mapById.get(id)).filter(Boolean);

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
        { key: "loanAvailable", label: "Loan Available", values: items.map((item) => item.loanAvailable) },
        { key: "verified", label: "Verified", values: items.map((item) => item.verified) }
      ],
      highlights: buildCompareHighlights(items)
    });
  } catch (error) {
    return next(error);
  }
}

export async function listCoreProperties(req, res, next) {
  try {
    const viewer = getViewerFromRequest(req);
    const page = Math.max(1, numberValue(req.query.page, 1));
    const limit = Math.min(100, Math.max(1, numberValue(req.query.limit, 20)));
    const skip = (page - 1) * limit;
    const verified = parseBool(req.query.verified);
    const verifiedOnly = parseBool(req.query.verifiedOnly);
    const featured = parseBool(req.query.featured);
    const city = text(req.query.city);
    const typeQuery = text(req.query.type);
    const categoryQuery = text(req.query.category);
    const type = typeQuery ? normalizeType(typeQuery) : "";
    const category = categoryQuery ? normalizeCategory(categoryQuery) : "";
    const bhk = Math.max(0, Math.round(numberValue(req.query.bhk, 0)));
    const furnishing = normalizeFurnishing(req.query.furnishing);
    const constructionStatus = normalizeConstructionStatus(
      req.query.constructionStatus || req.query.readyStatus
    );
    const loanAvailable = parseBool(req.query.loanAvailable);
    const ownerId = text(req.query.ownerId);
    const minPrice = numberValue(req.query.minPrice, 0);
    const maxPrice = numberValue(req.query.maxPrice, 0);
    const centerLat = parseOptionalNumber(req.query.centerLat || req.query.lat);
    const centerLng = parseOptionalNumber(req.query.centerLng || req.query.lng);
    const radiusKm = numberValue(req.query.radiusKm, 0);
    const sort = text(req.query.sort, "newest");
    const radiusFilterActive =
      Number.isFinite(centerLat) &&
      Number.isFinite(centerLng) &&
      Number.isFinite(radiusKm) &&
      radiusKm > 0;
    const radiusCenter = {
      lat: centerLat,
      lng: centerLng
    };

    if (proRuntime.dbConnected) {
      const filters = {};
      if (city) filters.city = city;
      if (type && PROPERTY_TYPES.has(type)) filters.type = type;
      if (category && PROPERTY_CATEGORIES.has(category)) filters.category = category;
      if (typeof verified === "boolean") filters.verified = verified;
      if (verifiedOnly === true) filters.verified = true;
      if (typeof featured === "boolean") filters.featured = featured;
      if (bhk > 0) filters.bhk = bhk;
      if (furnishing) filters.furnishing = furnishing;
      if (constructionStatus) filters.constructionStatus = constructionStatus;
      if (typeof loanAvailable === "boolean") filters.loanAvailable = loanAvailable;
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

      if (radiusFilterActive) {
        const allRows = await CoreProperty.find(filters).sort(sortObj).lean();
        const filteredRows = allRows.filter((item) => {
          const rowCoordinates = normalizeCoordinates(item.coordinates);
          if (!hasCoordinates(rowCoordinates)) return false;
          return distanceInKm(radiusCenter, rowCoordinates) <= radiusKm;
        });
        const paginatedRows = filteredRows.slice(skip, skip + limit);
        return res.json({
          success: true,
          source: "mongodb",
          page,
          limit,
          total: filteredRows.length,
          count: paginatedRows.length,
          filtersApplied: {
            city,
            type: type && PROPERTY_TYPES.has(type) ? type : "",
            category: category && PROPERTY_CATEGORIES.has(category) ? category : "",
            verified: typeof verified === "boolean" ? verified : undefined,
            verifiedOnly: verifiedOnly === true,
            featured: typeof featured === "boolean" ? featured : undefined,
            bhk: bhk > 0 ? bhk : undefined,
            furnishing: furnishing || undefined,
            constructionStatus: constructionStatus || undefined,
            loanAvailable,
            radiusKm
          },
          items: paginatedRows.map((item) => projectPropertyForViewer(item, viewer))
        });
      }

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
        filtersApplied: {
          city,
          type: type && PROPERTY_TYPES.has(type) ? type : "",
          category: category && PROPERTY_CATEGORIES.has(category) ? category : "",
          verified: typeof verified === "boolean" ? verified : undefined,
          verifiedOnly: verifiedOnly === true,
          featured: typeof featured === "boolean" ? featured : undefined,
          bhk: bhk > 0 ? bhk : undefined,
          furnishing: furnishing || undefined,
          constructionStatus: constructionStatus || undefined,
          loanAvailable,
          radiusKm: undefined
        },
        items: rows.map((item) => projectPropertyForViewer(item, viewer))
      });
    }

    let rows = [...proMemoryStore.coreProperties];
    if (city) rows = rows.filter((item) => item.city === city);
    if (type && PROPERTY_TYPES.has(type)) rows = rows.filter((item) => item.type === type);
    if (category && PROPERTY_CATEGORIES.has(category)) {
      rows = rows.filter((item) => item.category === category);
    }
    if (typeof verified === "boolean") {
      rows = rows.filter((item) => Boolean(item.verified) === verified);
    }
    if (verifiedOnly === true) {
      rows = rows.filter((item) => Boolean(item.verified));
    }
    if (typeof featured === "boolean") {
      rows = rows.filter((item) => Boolean(item.featured) === featured);
    }
    if (bhk > 0) rows = rows.filter((item) => Math.round(numberValue(item.bhk, 0)) === bhk);
    if (furnishing) {
      rows = rows.filter((item) => normalizeFurnishing(item.furnishing) === furnishing);
    }
    if (constructionStatus) {
      rows = rows.filter(
        (item) => normalizeConstructionStatus(item.constructionStatus) === constructionStatus
      );
    }
    if (typeof loanAvailable === "boolean") {
      rows = rows.filter((item) => Boolean(item.loanAvailable) === loanAvailable);
    }
    if (ownerId) rows = rows.filter((item) => toId(item.ownerId) === ownerId);
    if (minPrice > 0) rows = rows.filter((item) => numberValue(item.price) >= minPrice);
    if (maxPrice > 0) rows = rows.filter((item) => numberValue(item.price) <= maxPrice);
    if (radiusFilterActive) {
      rows = rows.filter((item) => {
        const rowCoordinates = normalizeCoordinates(item.coordinates);
        if (!hasCoordinates(rowCoordinates)) return false;
        return distanceInKm(radiusCenter, rowCoordinates) <= radiusKm;
      });
    }

    rows = sortRows(rows, sort);
    const paginated = rows.slice(skip, skip + limit);

    return res.json({
      success: true,
      source: "memory",
      page,
      limit,
      total: rows.length,
      count: paginated.length,
      filtersApplied: {
        city,
        type: type && PROPERTY_TYPES.has(type) ? type : "",
        category: category && PROPERTY_CATEGORIES.has(category) ? category : "",
        verified: typeof verified === "boolean" ? verified : undefined,
        verifiedOnly: verifiedOnly === true,
        featured: typeof featured === "boolean" ? featured : undefined,
        bhk: bhk > 0 ? bhk : undefined,
        furnishing: furnishing || undefined,
        constructionStatus: constructionStatus || undefined,
        loanAvailable,
        radiusKm: radiusFilterActive ? radiusKm : undefined
      },
      items: paginated.map((item) => projectPropertyForViewer(item, viewer))
    });
  } catch (error) {
    return next(error);
  }
}

export async function getCorePropertyById(req, res, next) {
  try {
    const viewer = getViewerFromRequest(req);
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
      item: projectPropertyForViewer(property, viewer)
    });
  } catch (error) {
    return next(error);
  }
}

async function createCorePropertyInternal(req, res, next, options = {}) {
  try {
    const payload = normalizeCreatePayload(req.body);
    if (!isAdmin(req)) {
      payload.verified = false;
      payload.verifiedByPropertySetu = false;
      payload.verifiedBadge = {
        show: false,
        label: "Verified by PropertySetu",
        approvedAt: null,
        approvedBy: null,
        status: "Pending"
      };
      payload.featured = false;
      payload.featuredUntil = null;
    }
    const validation = validatePropertyPayload(payload, options);
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
      item: projectPropertyForViewer(created, getViewerFromRequest(req), {
        includePrivateDocs: true
      })
    });
  } catch (error) {
    return next(error);
  }
}

async function updateCorePropertyInternal(req, res, next, options = {}) {
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

    const existingNormalized = normalizeCoreProperty(existing);
    const updates = normalizeUpdatePayload(req.body, existingNormalized);
    if (!isAdmin(req)) {
      delete updates.verified;
      delete updates.verifiedByPropertySetu;
      delete updates.verifiedBadge;
      delete updates.featured;
      delete updates.featuredUntil;
    }
    if (!Object.keys(updates).length) {
      return res.status(400).json({
        success: false,
        message: "No valid update fields provided."
      });
    }

    const validation = validateUpdatePayload(existingNormalized, updates, options);
    if (validation) {
      return res.status(400).json({
        success: false,
        message: validation
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
      const index = proMemoryStore.coreProperties.findIndex(
        (item) => toId(item._id || item.id) === propertyId
      );
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
      item: projectPropertyForViewer(updated, getViewerFromRequest(req), {
        includePrivateDocs: true
      })
    });
  } catch (error) {
    return next(error);
  }
}

export async function previewCorePropertyDescription(req, res, next) {
  try {
    const payload = normalizeCreatePayload(req.body || {});
    return res.json({
      success: true,
      source: "server-generator",
      description: buildAutoDescription(payload),
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    return next(error);
  }
}

export async function createCoreProperty(req, res, next) {
  return createCorePropertyInternal(req, res, next, { forceProfessionalRules: false });
}

export async function createCorePropertyProfessional(req, res, next) {
  return createCorePropertyInternal(req, res, next, { forceProfessionalRules: true });
}

export async function updateCoreProperty(req, res, next) {
  return updateCorePropertyInternal(req, res, next, { forceProfessionalRules: false });
}

export async function updateCorePropertyProfessional(req, res, next) {
  return updateCorePropertyInternal(req, res, next, { forceProfessionalRules: true });
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
        (item) => toId(item._id || item.id) !== propertyId
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

export async function getCorePropertyPrivateDocs(req, res, next) {
  try {
    const propertyId = text(req.params.propertyId);
    const property = await findCorePropertyById(propertyId);

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found."
      });
    }

    const normalized = normalizeCoreProperty(property);
    const viewer = getViewerFromRequest(req);

    if (!canViewerAccessPrivateDocs(normalized, viewer)) {
      return res.status(403).json({
        success: false,
        message: "Private documents are only accessible to owner or admin."
      });
    }

    return res.json({
      success: true,
      propertyId: normalized.id,
      privateDocs: normalizePrivateDocsForSecureView(normalized.privateDocs)
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
    const existing = await findCorePropertyById(propertyId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Property not found."
      });
    }

    const previousVerification =
      existing?.verification && typeof existing.verification === "object"
        ? existing.verification
        : {};
    const nextVerification = {
      ...previousVerification,
      status: verified ? "Verified" : "Pending Approval",
      adminApproved: verified,
      badgeEligible: verified,
      reviewedAt: new Date().toISOString(),
      reviewedBy: toId(req.coreUser?.id)
    };
    const nextBadge = {
      show: verified,
      label: "Verified by PropertySetu",
      approvedAt: verified ? new Date().toISOString() : null,
      approvedBy: toId(req.coreUser?.id),
      status: verified ? "Verified" : "Pending"
    };

    let updated;
    if (proRuntime.dbConnected) {
      updated = await CoreProperty.findByIdAndUpdate(
        propertyId,
        {
          $set: {
            verified,
            verifiedByPropertySetu: verified,
            verifiedBadge: nextBadge,
            verification: nextVerification
          }
        },
        { new: true }
      );
    } else {
      const index = proMemoryStore.coreProperties.findIndex(
        (item) => toId(item._id || item.id) === propertyId
      );
      if (index >= 0) {
        proMemoryStore.coreProperties[index] = {
          ...proMemoryStore.coreProperties[index],
          verified,
          verifiedByPropertySetu: verified,
          verifiedBadge: nextBadge,
          verification: nextVerification,
          updatedAt: new Date().toISOString()
        };
        updated = proMemoryStore.coreProperties[index];
      }
    }

    return res.json({
      success: true,
      item: projectPropertyForViewer(updated, getViewerFromRequest(req), {
        includePrivateDocs: true
      })
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
    const durationDays = Math.max(1, numberValue(req.body?.durationDays, 30));
    const featuredUntil = featured
      ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)
      : null;

    let updated;
    if (proRuntime.dbConnected) {
      updated = await CoreProperty.findByIdAndUpdate(
        propertyId,
        { $set: { featured, featuredUntil } },
        { new: true }
      );
    } else {
      const index = proMemoryStore.coreProperties.findIndex(
        (item) => toId(item._id || item.id) === propertyId
      );
      if (index >= 0) {
        proMemoryStore.coreProperties[index] = {
          ...proMemoryStore.coreProperties[index],
          featured,
          featuredUntil: featuredUntil ? featuredUntil.toISOString() : null,
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
      item: projectPropertyForViewer(updated, getViewerFromRequest(req), {
        includePrivateDocs: true
      })
    });
  } catch (error) {
    return next(error);
  }
}
