import mongoose from "mongoose";
import CoreProperty from "../models/CoreProperty.js";
import { proRuntime } from "../../config/proRuntime.js";
import { proMemoryStore } from "../../runtime/proMemoryStore.js";
import {
  buildMaskedPrivateDocUrl,
  buildPrivateDocAccessEnvelope,
  hashPrivateDocSourceUrl
} from "../utils/corePrivateDocSecurity.js";
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
const AI_FAKE_LISTING_AUTO_MODERATION_ENABLED =
  String(process.env.CORE_AI_FAKE_LISTING_AUTO_MODERATION_ENABLED || "true")
    .trim()
    .toLowerCase() !== "false";
const AI_FAKE_LISTING_PENDING_SCORE = Math.max(
  10,
  Math.min(95, Number(process.env.CORE_AI_FAKE_LISTING_PENDING_SCORE || 45))
);
const AI_FAKE_LISTING_QUARANTINE_SCORE = Math.max(
  AI_FAKE_LISTING_PENDING_SCORE,
  Math.min(100, Number(process.env.CORE_AI_FAKE_LISTING_QUARANTINE_SCORE || 76))
);
const AI_FAKE_LISTING_QUARANTINE_ON_SIGNAL =
  String(process.env.CORE_AI_FAKE_LISTING_QUARANTINE_ON_SIGNAL || "true")
    .trim()
    .toLowerCase() !== "false";
const AI_FAKE_LISTING_DECISION_REASON_MIN = Math.max(
  8,
  Number(process.env.CORE_AI_FAKE_LISTING_DECISION_REASON_MIN || 10)
);
const AI_FAKE_LISTING_SCAN_MAX_ROWS = Math.max(
  100,
  Math.min(5000, Number(process.env.CORE_AI_FAKE_LISTING_SCAN_MAX_ROWS || 1200))
);
const AI_FAKE_LISTING_RISKY_WORDS = [
  "urgent sale",
  "cash only",
  "advance first",
  "no visit",
  "token now"
];
const PROPERTY_MODERATION_STATUSES = new Set(["approved", "pending-review", "quarantined"]);

function text(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function asIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
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

function getClientIp(req) {
  const forwarded = req?.headers?.["x-forwarded-for"];
  if (Array.isArray(forwarded) && forwarded.length) {
    return text(forwarded[0]).split(",")[0].trim();
  }
  if (text(forwarded)) {
    return text(forwarded).split(",")[0].trim();
  }
  return text(req?.ip || req?.socket?.remoteAddress || "0.0.0.0");
}

function getViewerFromRequest(req) {
  if (req?.coreUser?.id) {
    return {
      id: toId(req.coreUser.id),
      role: text(req.coreUser.role, "buyer").toLowerCase(),
      clientIp: getClientIp(req),
      userAgent: text(req.headers?.["user-agent"])
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

function normalizeModerationStatus(value, fallback = "approved") {
  const raw = text(value).toLowerCase();
  if (PROPERTY_MODERATION_STATUSES.has(raw)) return raw;
  return PROPERTY_MODERATION_STATUSES.has(text(fallback).toLowerCase())
    ? text(fallback).toLowerCase()
    : "approved";
}

function normalizeModerationAction(value) {
  const raw = text(value).toLowerCase();
  if (raw === "approve" || raw === "approved") return "approve";
  if (raw === "quarantine" || raw === "quarantined") return "quarantine";
  if (raw === "pending" || raw === "pending-review" || raw === "review") return "pending-review";
  return "";
}

function isPublicModerationStatus(status = "") {
  const normalized = normalizeModerationStatus(status, "approved");
  return normalized === "approved";
}

function isPropertyOwner(property = {}, viewer = null) {
  const viewerId = toId(viewer?.id);
  const ownerId = toId(property?.ownerId);
  return Boolean(viewerId && ownerId && viewerId === ownerId);
}

function canViewerAccessModeratedProperty(property = {}, viewer = null) {
  const role = text(viewer?.role).toLowerCase();
  if (role === "admin") return true;
  if (isPropertyOwner(property, viewer)) return true;
  return isPublicModerationStatus(property?.aiReview?.moderationStatus);
}

function buildModerationSummary(aiReview = {}) {
  const review =
    aiReview && typeof aiReview === "object" && !Array.isArray(aiReview)
      ? aiReview
      : {};
  const moderation =
    review.moderation && typeof review.moderation === "object" && !Array.isArray(review.moderation)
      ? review.moderation
      : {};
  const status = normalizeModerationStatus(
    moderation.status || review.moderationStatus || "approved"
  );
  return {
    status,
    fraudRiskScore: Math.max(0, Math.round(numberValue(review.fraudRiskScore, 0))),
    fakeListingSignal: Boolean(review.fakeListingSignal),
    duplicatePhotoDetected: Boolean(review.duplicatePhotoDetected),
    suspiciousPricingAlert: Boolean(review.suspiciousPricingAlert),
    scannedAt: asIso(review.scannedAt),
    recommendation: text(review.recommendation),
    source: text(moderation.source || "auto"),
    reviewedAt: asIso(moderation.reviewedAt),
    reviewedBy: toId(moderation.reviewedBy)
  };
}

async function estimateLocalAveragePropertyPrice(payload = {}, excludePropertyId = "") {
  const city = text(payload?.city);
  const type = normalizeType(payload?.type);
  const category = normalizeCategory(payload?.category);
  const location = text(payload?.location).toLowerCase();
  const excludeId = toId(excludePropertyId);

  let rows = [];
  if (proRuntime.dbConnected) {
    const query = {
      price: { $gt: 0 },
      city,
      type,
      category
    };
    rows = await CoreProperty.find(query)
      .select("_id city location price")
      .sort({ createdAt: -1 })
      .limit(AI_FAKE_LISTING_SCAN_MAX_ROWS)
      .lean();
  } else {
    rows = (Array.isArray(proMemoryStore.coreProperties) ? proMemoryStore.coreProperties : [])
      .filter(
        (item) =>
          text(item?.city) === city &&
          normalizeType(item?.type) === type &&
          normalizeCategory(item?.category) === category &&
          numberValue(item?.price, 0) > 0
      )
      .slice(-AI_FAKE_LISTING_SCAN_MAX_ROWS);
  }

  if (excludeId) {
    rows = rows.filter((item) => toId(item?._id || item?.id) !== excludeId);
  }

  const locationTokens = location
    .split(/[\s,/-]+/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3);
  const localRows = locationTokens.length
    ? rows.filter((item) => {
      const haystack = `${text(item?.location)} ${text(item?.city)}`.toLowerCase();
      return locationTokens.some((token) => haystack.includes(token));
    })
    : rows;
  const priceRows = localRows.length >= 5 ? localRows : rows;
  const prices = priceRows
    .map((item) => numberValue(item?.price, 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (!prices.length) return 0;
  return Math.round(prices.reduce((sum, value) => sum + value, 0) / prices.length);
}

function buildFakeListingScan(payload = {}, expectedAveragePrice = 0) {
  const media = normalizeMedia(payload?.media);
  const photosCount = Math.max(
    normalizeImages(payload?.images).length,
    numberValue(media?.photosCount, normalizeStringArray(media?.photoNames).length)
  );
  const duplicatePhotoMatches = Math.max(0, Math.round(numberValue(media?.duplicatePhotoMatches, 0)));
  const blurryPhotosDetected = Math.max(0, Math.round(numberValue(media?.blurryPhotosDetected, 0)));
  const title = text(payload?.title);
  const description = text(payload?.description);
  const combinedText = `${title} ${description}`.toLowerCase();
  const riskyMatches = AI_FAKE_LISTING_RISKY_WORDS.filter((word) => combinedText.includes(word));
  const price = numberValue(payload?.price, 0);
  const suspiciousPricingAlert =
    expectedAveragePrice > 0 && price > 0 && price < Math.round(expectedAveragePrice * 0.38);
  const riskScore = clamp(
    (riskyMatches.length * 20)
      + (suspiciousPricingAlert ? 24 : 0)
      + (photosCount > 0 && photosCount < MIN_REQUIRED_PHOTOS ? 16 : 0)
      + (duplicatePhotoMatches > 0 ? 28 : 0)
      + (blurryPhotosDetected >= 3 ? 12 : 0),
    0,
    100
  );
  const fakeListingSignal =
    duplicatePhotoMatches > 0 ||
    suspiciousPricingAlert ||
    blurryPhotosDetected >= 3 ||
    riskyMatches.length >= 2;
  const reasons = [
    ...riskyMatches.map((word) => `Contains risky phrase: "${word}"`),
    ...(suspiciousPricingAlert ? ["Price looks abnormally low for this locality"] : []),
    ...(photosCount > 0 && photosCount < MIN_REQUIRED_PHOTOS
      ? [`Minimum ${MIN_REQUIRED_PHOTOS} photos recommended for trust`]
      : []),
    ...(duplicatePhotoMatches > 0 ? [`Duplicate photo match detected (${duplicatePhotoMatches})`] : []),
    ...(blurryPhotosDetected >= 3 ? ["Multiple blurry photos detected"] : [])
  ];
  return {
    riskScore,
    fakeListingSignal,
    reasons,
    photosCount,
    duplicatePhotoMatches,
    blurryPhotosDetected,
    suspiciousPricingAlert
  };
}

function deriveAutoModerationStatus(scan = {}) {
  if (!AI_FAKE_LISTING_AUTO_MODERATION_ENABLED) return "approved";
  const riskScore = Math.max(0, Math.round(numberValue(scan?.riskScore, 0)));
  const fakeListingSignal = Boolean(scan?.fakeListingSignal);
  if (
    riskScore >= AI_FAKE_LISTING_QUARANTINE_SCORE ||
    (AI_FAKE_LISTING_QUARANTINE_ON_SIGNAL && fakeListingSignal)
  ) {
    return "quarantined";
  }
  if (riskScore >= AI_FAKE_LISTING_PENDING_SCORE) return "pending-review";
  return "approved";
}

async function buildServerAiReview(
  payload = {},
  {
    previousAiReview = {},
    excludePropertyId = "",
    actorIsAdmin = false
  } = {}
) {
  const existing =
    previousAiReview && typeof previousAiReview === "object" && !Array.isArray(previousAiReview)
      ? previousAiReview
      : {};
  const expectedAverageFromRequest = Math.max(
    0,
    numberValue(payload?.aiReview?.expectedAveragePrice, 0)
  );
  const expectedAveragePrice =
    expectedAverageFromRequest > 0
      ? expectedAverageFromRequest
      : await estimateLocalAveragePropertyPrice(payload, excludePropertyId);
  const scan = buildFakeListingScan(payload, expectedAveragePrice);
  const nowIso = new Date().toISOString();
  let moderationStatus = deriveAutoModerationStatus(scan);
  const previousStatus = normalizeModerationStatus(
    existing?.moderation?.status || existing?.moderationStatus || "approved"
  );
  if (!actorIsAdmin) {
    if (previousStatus === "quarantined") moderationStatus = "quarantined";
    if (previousStatus === "pending-review" && moderationStatus === "approved") {
      moderationStatus = "pending-review";
    }
  }
  return {
    engine: "core-fraud-v2",
    scannedAt: nowIso,
    expectedAveragePrice,
    fraudRiskScore: scan.riskScore,
    duplicatePhotoDetected: scan.duplicatePhotoMatches > 0,
    duplicatePhotoCount: scan.duplicatePhotoMatches,
    suspiciousPricingAlert: scan.suspiciousPricingAlert,
    fakeListingSignal: scan.fakeListingSignal,
    reasons: scan.reasons,
    recommendation:
      moderationStatus === "quarantined" || moderationStatus === "pending-review"
        ? "Manual admin verification required"
        : "Looks normal",
    moderationStatus,
    moderation: {
      status: moderationStatus,
      source: "auto",
      autoEnabled: Boolean(AI_FAKE_LISTING_AUTO_MODERATION_ENABLED),
      pendingThreshold: AI_FAKE_LISTING_PENDING_SCORE,
      quarantineThreshold: AI_FAKE_LISTING_QUARANTINE_SCORE,
      reviewedAt: asIso(existing?.moderation?.reviewedAt),
      reviewedBy: toId(existing?.moderation?.reviewedBy),
      reason: text(existing?.moderation?.reason),
      lastAutoDecisionAt: nowIso
    }
  };
}

function applyModerationFlagsToPropertyPayload(payload = {}) {
  const row = payload && typeof payload === "object" ? payload : {};
  const moderationStatus = normalizeModerationStatus(row?.aiReview?.moderationStatus, "approved");
  if (moderationStatus === "approved") return row;
  return {
    ...row,
    verified: false,
    verifiedByPropertySetu: false,
    verifiedBadge: {
      show: false,
      label: "Verified by PropertySetu",
      approvedAt: null,
      approvedBy: null,
      status: "Pending"
    },
    featured: false,
    featuredUntil: null,
    verification: {
      ...(row.verification && typeof row.verification === "object" && !Array.isArray(row.verification)
        ? row.verification
        : {}),
      status: moderationStatus === "quarantined" ? "Quarantined" : "Pending Approval",
      adminApproved: false,
      badgeEligible: false
    }
  };
}

function buildPropertyModerationQueueItem(property = {}) {
  const normalized = normalizeCoreProperty(property);
  if (!normalized) return null;
  const moderation = buildModerationSummary(normalized.aiReview);
  return {
    id: normalized.id,
    title: normalized.title,
    city: normalized.city,
    location: normalized.location,
    type: normalized.type,
    category: normalized.category,
    price: normalized.price,
    ownerId: normalized.ownerId,
    moderation,
    createdAt: normalized.createdAt,
    updatedAt: normalized.updatedAt
  };
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

function buildSecurePrivateDocRecord(
  {
    sourceUrl = "",
    docId = "",
    uploadId = "",
    category = "",
    name = "",
    sizeBytes = 0
  } = {},
  {
    viewer = null,
    property = {}
  } = {}
) {
  const resolvedSourceUrl = text(sourceUrl);
  const sourceHash = hashPrivateDocSourceUrl(resolvedSourceUrl);
  const envelope =
    resolvedSourceUrl &&
    viewer &&
    toId(viewer.id) &&
    buildPrivateDocAccessEnvelope({
      sourceUrl: resolvedSourceUrl,
      ownerId: toId(property?.ownerId),
      propertyId: toId(property?.id || property?._id),
      uploadId: text(uploadId),
      docId: text(docId, sourceHash.slice(0, 18)),
      category: text(category),
      name: text(name),
      viewerId: toId(viewer.id),
      viewerRole: text(viewer.role, "buyer").toLowerCase(),
      requestIp: text(viewer.clientIp),
      requestUserAgent: text(viewer.userAgent)
    });
  const maskedUrl = envelope?.maskedUrl || buildMaskedPrivateDocUrl(resolvedSourceUrl);

  return {
    id: text(docId, sourceHash.slice(0, 18)),
    uploadId: text(uploadId),
    category: text(category),
    name: text(name),
    sizeBytes: Math.max(0, numberValue(sizeBytes, 0)),
    url: maskedUrl,
    maskedUrl,
    hash: sourceHash,
    secureAccess: envelope
      ? {
          token: text(envelope.token),
          expiresAt: text(envelope.expiresAt),
          expiresInSec: Math.max(0, numberValue(envelope.expiresInSec, 0)),
          accessPath: text(envelope.accessPath),
          maskedUrl: text(envelope.maskedUrl),
          hash: text(envelope.hash)
        }
      : null
  };
}

function normalizePrivateDocsForSecureView(
  privateDocs = {},
  {
    viewer = null,
    property = {}
  } = {}
) {
  const docs =
    privateDocs && typeof privateDocs === "object" && !Array.isArray(privateDocs)
      ? privateDocs
      : {};
  const ownerIdProofRecord = text(docs.ownerIdProof)
    ? buildSecurePrivateDocRecord(
        {
          sourceUrl: text(docs.ownerIdProof),
          docId: "owner-id-proof",
          category: "owner-id-proof",
          name: "Owner ID Proof"
        },
        { viewer, property }
      )
    : null;
  const addressProofRecord = text(docs.addressProof)
    ? buildSecurePrivateDocRecord(
        {
          sourceUrl: text(docs.addressProof),
          docId: "address-proof",
          category: "address-proof",
          name: "Address Proof"
        },
        { viewer, property }
      )
    : null;
  const propertyDocumentAccess = normalizeStringArray(docs.propertyDocuments).map((item, index) =>
    buildSecurePrivateDocRecord(
      {
        sourceUrl: item,
        docId: `property-document-${index + 1}`,
        category: "property-document",
        name: `Property Document ${index + 1}`
      },
      { viewer, property }
    )
  );
  const uploadedPrivateDocs = Array.isArray(docs.uploadedPrivateDocs)
    ? docs.uploadedPrivateDocs
        .filter((item) => item && typeof item === "object")
        .map((item, index) =>
          buildSecurePrivateDocRecord(
            {
              sourceUrl: text(item.url),
              docId: text(item.id, `uploaded-private-doc-${index + 1}`),
              uploadId: text(item.id),
              category: text(item.category),
              name: text(item.name),
              sizeBytes: numberValue(item.sizeBytes, 0)
            },
            { viewer, property }
          )
        )
    : [];

  return {
    propertyDocuments: propertyDocumentAccess.map((item) => item.maskedUrl),
    propertyDocumentAccess,
    ownerIdProof: ownerIdProofRecord?.maskedUrl || "",
    ownerIdProofAccess: ownerIdProofRecord,
    addressProof: addressProofRecord?.maskedUrl || "",
    addressProofAccess: addressProofRecord,
    privateViewMode: text(docs.privateViewMode, "Private View Only"),
    uploadedPrivateDocs
  };
}

function projectPropertyForViewer(property, viewer = null, options = {}) {
  const normalized = normalizeCoreProperty(property);
  if (!normalized) return null;
  const canViewModerated = canViewerAccessModeratedProperty(normalized, viewer);
  if (!canViewModerated && !Boolean(options.includeHiddenForAdmin)) {
    return null;
  }

  const role = text(viewer?.role).toLowerCase();
  const isPrivileged = role === "admin" || isPropertyOwner(normalized, viewer);
  const aiReview = isPrivileged
    ? normalized.aiReview
    : {
      ...buildModerationSummary(normalized.aiReview),
      reasons: []
    };
  const baseNormalized = {
    ...normalized,
    aiReview
  };

  if (options.includePrivateDocs || canViewerAccessPrivateDocs(normalized, viewer)) {
    return {
      ...baseNormalized,
      privateDocs: normalizePrivateDocsForSecureView(normalized.privateDocs, {
        viewer,
        property: normalized
      })
    };
  }

  return {
    ...baseNormalized,
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

function shouldBypassPublicModerationFilter(viewer = null, ownerIdFilter = "") {
  const role = text(viewer?.role).toLowerCase();
  if (role === "admin") return true;
  const viewerId = toId(viewer?.id);
  const ownerId = toId(ownerIdFilter);
  return Boolean(viewerId && ownerId && viewerId === ownerId);
}

function buildPublicModerationQuery() {
  return {
    $or: [
      { "aiReview.moderationStatus": { $exists: false } },
      { "aiReview.moderationStatus": "" },
      { "aiReview.moderationStatus": "approved" }
    ]
  };
}

function passesPublicModerationFilter(item = {}) {
  return isPublicModerationStatus(item?.aiReview?.moderationStatus);
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
        if (!normalized) return null;
        const summary = buildPropertyCompareSummary(normalized);
        return [summary.id, summary];
      }).filter(Boolean)
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
    const bypassPublicModerationFilter = shouldBypassPublicModerationFilter(viewer, ownerId);
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
      if (!bypassPublicModerationFilter) {
        Object.assign(filters, buildPublicModerationQuery());
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
          items: paginatedRows
            .map((item) => projectPropertyForViewer(item, viewer))
            .filter(Boolean)
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
        items: rows
          .map((item) => projectPropertyForViewer(item, viewer))
          .filter(Boolean)
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
    if (!bypassPublicModerationFilter) {
      rows = rows.filter((item) => passesPublicModerationFilter(item));
    }
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
      items: paginated
        .map((item) => projectPropertyForViewer(item, viewer))
        .filter(Boolean)
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

    const item = projectPropertyForViewer(property, viewer);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Property not found."
      });
    }

    return res.json({
      success: true,
      item
    });
  } catch (error) {
    return next(error);
  }
}

async function createCorePropertyInternal(req, res, next, options = {}) {
  try {
    const payload = normalizeCreatePayload(req.body);
    const actorIsAdmin = isAdmin(req);
    if (!actorIsAdmin) {
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

    const computedAiReview = await buildServerAiReview(payload, {
      previousAiReview: payload.aiReview,
      actorIsAdmin
    });
    const finalPayload = applyModerationFlagsToPropertyPayload({
      ...payload,
      aiReview: computedAiReview
    });

    const ownerId = toId(req.coreUser?.id);
    let created;

    if (proRuntime.dbConnected) {
      created = await CoreProperty.create({
        ...finalPayload,
        ownerId
      });
    } else {
      created = {
        _id: `prop-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ...finalPayload,
        ownerId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      proMemoryStore.coreProperties.push(created);
    }

    const item = projectPropertyForViewer(created, getViewerFromRequest(req), {
      includePrivateDocs: true
    });

    return res.status(201).json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      moderation: buildModerationSummary(item?.aiReview || finalPayload.aiReview),
      item
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
    const actorIsAdmin = isAdmin(req);
    delete updates.aiReview;
    if (!actorIsAdmin) {
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

    const mergedPayloadForReview = {
      ...existingNormalized,
      ...updates
    };
    const computedAiReview = await buildServerAiReview(mergedPayloadForReview, {
      previousAiReview: existingNormalized?.aiReview,
      excludePropertyId: propertyId,
      actorIsAdmin
    });
    updates.aiReview = computedAiReview;

    if (normalizeModerationStatus(computedAiReview?.moderationStatus, "approved") !== "approved") {
      const moderatedPayload = applyModerationFlagsToPropertyPayload({
        ...mergedPayloadForReview,
        aiReview: computedAiReview
      });
      updates.verified = Boolean(moderatedPayload.verified);
      updates.verifiedByPropertySetu = Boolean(moderatedPayload.verifiedByPropertySetu);
      updates.verifiedBadge =
        moderatedPayload.verifiedBadge && typeof moderatedPayload.verifiedBadge === "object"
          ? moderatedPayload.verifiedBadge
          : {};
      updates.featured = Boolean(moderatedPayload.featured);
      updates.featuredUntil = moderatedPayload.featuredUntil || null;
      updates.verification =
        moderatedPayload.verification && typeof moderatedPayload.verification === "object"
          ? moderatedPayload.verification
          : {};
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

    const item = projectPropertyForViewer(updated, getViewerFromRequest(req), {
      includePrivateDocs: true
    });

    return res.json({
      success: true,
      moderation: buildModerationSummary(item?.aiReview || updates.aiReview),
      item
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

export async function listCorePropertyModerationQueue(req, res, next) {
  try {
    const status = text(req.query?.status, "pending").toLowerCase();
    const limit = Math.min(300, Math.max(1, Number(req.query?.limit || 120)));
    const allowedStatuses = (() => {
      if (status === "all") return ["approved", "pending-review", "quarantined"];
      if (status === "approved") return ["approved"];
      if (status === "quarantined") return ["quarantined"];
      if (status === "flagged") return ["pending-review", "quarantined"];
      return ["pending-review"];
    })();

    let rows = [];
    if (proRuntime.dbConnected) {
      rows = await CoreProperty.find({
        "aiReview.moderationStatus": { $in: allowedStatuses }
      })
        .sort({ "aiReview.fraudRiskScore": -1, updatedAt: -1 })
        .limit(limit)
        .lean();
    } else {
      rows = (Array.isArray(proMemoryStore.coreProperties) ? proMemoryStore.coreProperties : [])
        .filter((item) =>
          allowedStatuses.includes(normalizeModerationStatus(item?.aiReview?.moderationStatus))
        )
        .sort(
          (a, b) =>
            Math.round(numberValue(b?.aiReview?.fraudRiskScore, 0)) -
              Math.round(numberValue(a?.aiReview?.fraudRiskScore, 0)) ||
            new Date(b?.updatedAt || b?.createdAt || 0) - new Date(a?.updatedAt || a?.createdAt || 0)
        )
        .slice(0, limit);
    }

    const items = rows.map((item) => buildPropertyModerationQueueItem(item)).filter(Boolean);
    const summary = {
      approved: items.filter((item) => item?.moderation?.status === "approved").length,
      pendingReview: items.filter((item) => item?.moderation?.status === "pending-review").length,
      quarantined: items.filter((item) => item?.moderation?.status === "quarantined").length
    };

    return res.json({
      success: true,
      source: proRuntime.dbConnected ? "mongodb" : "memory",
      total: items.length,
      filters: {
        status,
        normalizedStatuses: allowedStatuses,
        limit
      },
      summary,
      items
    });
  } catch (error) {
    return next(error);
  }
}

export async function decideCorePropertyModeration(req, res, next) {
  try {
    const propertyId = text(req.params.propertyId);
    const action = normalizeModerationAction(req.body?.action || req.query?.action);
    const reason = text(req.body?.reason || req.query?.reason);
    const force =
      String(req.body?.force || req.query?.force || "false").trim().toLowerCase() === "true";

    if (!propertyId) {
      return res.status(400).json({
        success: false,
        message: "propertyId is required."
      });
    }
    if (!action) {
      return res.status(400).json({
        success: false,
        message: "action is required. Allowed: approve, quarantine, pending-review."
      });
    }
    if (reason.length < AI_FAKE_LISTING_DECISION_REASON_MIN) {
      return res.status(400).json({
        success: false,
        message: `Reason must be at least ${AI_FAKE_LISTING_DECISION_REASON_MIN} characters.`
      });
    }

    const existing = await findCorePropertyById(propertyId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Property not found."
      });
    }

    const normalized = normalizeCoreProperty(existing);
    const freshAiReview = await buildServerAiReview(normalized, {
      previousAiReview: normalized?.aiReview,
      excludePropertyId: propertyId,
      actorIsAdmin: true
    });
    const freshRiskScore = Math.max(0, numberValue(freshAiReview?.fraudRiskScore, 0));

    if (
      action === "approve" &&
      !force &&
      (freshRiskScore >= AI_FAKE_LISTING_QUARANTINE_SCORE || Boolean(freshAiReview?.fakeListingSignal))
    ) {
      return res.status(409).json({
        success: false,
        message:
          "High-risk listing cannot be approved without force=true. Review AI reasons before override."
      });
    }

    const moderationStatus =
      action === "approve" ? "approved" : action === "quarantine" ? "quarantined" : "pending-review";
    const nowIso = new Date().toISOString();
    const adminId = toId(req.coreUser?.id);
    const nextAiReview = {
      ...freshAiReview,
      moderationStatus,
      moderation: {
        ...(freshAiReview?.moderation &&
        typeof freshAiReview.moderation === "object" &&
        !Array.isArray(freshAiReview.moderation)
          ? freshAiReview.moderation
          : {}),
        status: moderationStatus,
        source: "admin-decision",
        reviewedAt: nowIso,
        reviewedBy: adminId,
        reason: reason.slice(0, 240),
        action,
        force: Boolean(force)
      }
    };

    const updatePatch = {
      aiReview: nextAiReview
    };
    if (moderationStatus !== "approved") {
      const moderatedPayload = applyModerationFlagsToPropertyPayload({
        ...normalized,
        aiReview: nextAiReview
      });
      updatePatch.verified = Boolean(moderatedPayload.verified);
      updatePatch.verifiedByPropertySetu = Boolean(moderatedPayload.verifiedByPropertySetu);
      updatePatch.verifiedBadge = moderatedPayload.verifiedBadge;
      updatePatch.featured = Boolean(moderatedPayload.featured);
      updatePatch.featuredUntil = moderatedPayload.featuredUntil || null;
      updatePatch.verification = moderatedPayload.verification;
    }

    let updated = null;
    if (proRuntime.dbConnected) {
      updated = await CoreProperty.findByIdAndUpdate(
        propertyId,
        { $set: updatePatch },
        { new: true }
      );
    } else {
      const index = proMemoryStore.coreProperties.findIndex(
        (item) => toId(item._id || item.id) === propertyId
      );
      if (index >= 0) {
        proMemoryStore.coreProperties[index] = {
          ...proMemoryStore.coreProperties[index],
          ...updatePatch,
          updatedAt: nowIso
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

    const item = projectPropertyForViewer(updated, getViewerFromRequest(req), {
      includePrivateDocs: true
    });

    return res.json({
      success: true,
      action,
      moderationStatus,
      moderation: buildModerationSummary(item?.aiReview || nextAiReview),
      item
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
      privateDocs: normalizePrivateDocsForSecureView(normalized.privateDocs, {
        viewer,
        property: normalized
      })
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

    const moderationStatus = normalizeModerationStatus(
      existing?.aiReview?.moderationStatus,
      "approved"
    );
    if (verified && moderationStatus === "quarantined") {
      return res.status(409).json({
        success: false,
        message:
          "Quarantined property cannot be verified directly. Use moderation decision endpoint first."
      });
    }

    const nowIso = new Date().toISOString();
    const previousVerification =
      existing?.verification && typeof existing.verification === "object"
        ? existing.verification
        : {};
    const nextVerification = {
      ...previousVerification,
      status: verified ? "Verified" : "Pending Approval",
      adminApproved: verified,
      badgeEligible: verified,
      reviewedAt: nowIso,
      reviewedBy: toId(req.coreUser?.id)
    };
    const nextBadge = {
      show: verified,
      label: "Verified by PropertySetu",
      approvedAt: verified ? nowIso : null,
      approvedBy: toId(req.coreUser?.id),
      status: verified ? "Verified" : "Pending"
    };
    const previousAiReview =
      existing?.aiReview && typeof existing.aiReview === "object" && !Array.isArray(existing.aiReview)
        ? existing.aiReview
        : {};
    const nextModerationStatus = verified
      ? "approved"
      : normalizeModerationStatus(previousAiReview?.moderationStatus, "pending-review");
    const nextAiReview = {
      ...previousAiReview,
      moderationStatus: nextModerationStatus,
      moderation: {
        ...(previousAiReview?.moderation &&
        typeof previousAiReview.moderation === "object" &&
        !Array.isArray(previousAiReview.moderation)
          ? previousAiReview.moderation
          : {}),
        status: nextModerationStatus,
        source: "admin-verification",
        reviewedAt: nowIso,
        reviewedBy: toId(req.coreUser?.id),
        reason: text(req.body?.reason, verified ? "admin-verified-property" : "admin-unverified-property")
      }
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
            verification: nextVerification,
            aiReview: nextAiReview
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
          aiReview: nextAiReview,
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
    const existing = await findCorePropertyById(propertyId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Property not found."
      });
    }
    if (
      featured &&
      normalizeModerationStatus(existing?.aiReview?.moderationStatus, "approved") !== "approved"
    ) {
      return res.status(409).json({
        success: false,
        message: "Only moderation-approved properties can be featured."
      });
    }

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
