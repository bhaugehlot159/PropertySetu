export function toId(value) {
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

function toPlain(doc) {
  if (!doc) return null;
  return typeof doc.toObject === "function" ? doc.toObject() : doc;
}

function buildGoogleMapView({
  city = "",
  location = "",
  coordinates = {}
} = {}) {
  const lat = Number(coordinates?.lat);
  const lng = Number(coordinates?.lng);
  const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lng);
  const query = hasCoordinates ? `${lat},${lng}` : `${location}, ${city}`.trim();
  const encodedQuery = encodeURIComponent(query || city || location || "India");
  const googleMapsUrl = hasCoordinates
    ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
  const googleDirectionsUrl = hasCoordinates
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : `https://www.google.com/maps/dir/?api=1&destination=${encodedQuery}`;
  const googleEmbedUrl = hasCoordinates
    ? `https://www.google.com/maps?q=${lat},${lng}&output=embed`
    : `https://www.google.com/maps?q=${encodedQuery}&output=embed`;

  return {
    query: query || "",
    hasCoordinates,
    googleMapsUrl,
    googleDirectionsUrl,
    googleEmbedUrl
  };
}

export function normalizeCoreUser(doc, { includePassword = false } = {}) {
  const row = toPlain(doc);
  if (!row) return null;

  const user = {
    _id: toId(row._id || row.id),
    id: toId(row._id || row.id),
    name: row.name || "",
    email: row.email || "",
    phone: row.phone || "",
    role: row.role || "buyer",
    verified: Boolean(row.verified),
    subscriptionPlan: row.subscriptionPlan || "free",
    createdAt: asIso(row.createdAt),
    updatedAt: asIso(row.updatedAt)
  };

  if (includePassword) {
    user.password = row.password || "";
  }

  return user;
}

export function normalizeCoreProperty(doc) {
  const row = toPlain(doc);
  if (!row) return null;
  const verification =
    row.verification &&
    typeof row.verification === "object" &&
    !Array.isArray(row.verification)
      ? row.verification
      : {};
  const verifiedBadgeRaw =
    row.verifiedBadge &&
    typeof row.verifiedBadge === "object" &&
    !Array.isArray(row.verifiedBadge)
      ? row.verifiedBadge
      : {};
  const verifiedByPropertySetu =
    Boolean(row.verifiedByPropertySetu) ||
    Boolean(verifiedBadgeRaw.show) ||
    String(verification.status || "").toLowerCase() === "verified" ||
    Boolean(row.verified);
  const verifiedBadge = {
    show: verifiedByPropertySetu,
    label: verifiedBadgeRaw.label || "Verified by PropertySetu",
    approvedAt: asIso(verifiedBadgeRaw.approvedAt || verification.reviewedAt),
    approvedBy: toId(verifiedBadgeRaw.approvedBy || verification.reviewedBy),
    status: verifiedByPropertySetu ? "Verified" : "Pending"
  };
  const coordinatesRaw =
    row.coordinates && typeof row.coordinates === "object" && !Array.isArray(row.coordinates)
      ? row.coordinates
      : {};
  const lat = Number(coordinatesRaw.lat);
  const lng = Number(coordinatesRaw.lng);
  const coordinates = {
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null
  };
  const mapView = buildGoogleMapView({
    city: row.city || "",
    location: row.location || "",
    coordinates
  });

  return {
    _id: toId(row._id || row.id),
    id: toId(row._id || row.id),
    title: row.title || "",
    description: row.description || "",
    city: row.city || "",
    location: row.location || "",
    type: row.type || "buy",
    category: row.category || "house",
    price: Number(row.price || 0),
    size: Number(row.size || 0),
    bhk: Number(row.bhk || 0),
    furnishing: row.furnishing || "",
    constructionStatus: row.constructionStatus || "",
    loanAvailable: Boolean(row.loanAvailable),
    coordinates,
    mapView,
    images: Array.isArray(row.images) ? row.images : [],
    video: row.video || "",
    media:
      row.media && typeof row.media === "object" && !Array.isArray(row.media)
        ? row.media
        : {},
    privateDocs:
      row.privateDocs && typeof row.privateDocs === "object" && !Array.isArray(row.privateDocs)
        ? row.privateDocs
        : {},
    detailStructure:
      row.detailStructure &&
      typeof row.detailStructure === "object" &&
      !Array.isArray(row.detailStructure)
        ? row.detailStructure
        : {},
    verification,
    virtualTour:
      row.virtualTour && typeof row.virtualTour === "object" && !Array.isArray(row.virtualTour)
        ? row.virtualTour
        : {},
    visitBooking:
      row.visitBooking &&
      typeof row.visitBooking === "object" &&
      !Array.isArray(row.visitBooking)
        ? row.visitBooking
        : {},
    videoVisit:
      row.videoVisit && typeof row.videoVisit === "object" && !Array.isArray(row.videoVisit)
        ? row.videoVisit
        : {},
    aiReview:
      row.aiReview && typeof row.aiReview === "object" && !Array.isArray(row.aiReview)
        ? row.aiReview
        : {},
    ownerId: toId(row.ownerId),
    verified: Boolean(row.verified),
    verifiedByPropertySetu,
    verifiedBadge,
    featured: Boolean(row.featured),
    featuredUntil: asIso(row.featuredUntil),
    createdAt: asIso(row.createdAt),
    updatedAt: asIso(row.updatedAt)
  };
}

export function normalizeCoreReview(doc) {
  const row = toPlain(doc);
  if (!row) return null;

  return {
    _id: toId(row._id || row.id),
    id: toId(row._id || row.id),
    propertyId: toId(row.propertyId),
    userId: toId(row.userId),
    rating: Number(row.rating || 0),
    comment: row.comment || "",
    createdAt: asIso(row.createdAt),
    updatedAt: asIso(row.updatedAt)
  };
}

export function normalizeCoreSubscription(doc) {
  const row = toPlain(doc);
  if (!row) return null;

  return {
    _id: toId(row._id || row.id),
    id: toId(row._id || row.id),
    userId: toId(row.userId),
    planName: row.planName || "",
    planType: row.planType || "",
    amount: Number(row.amount || 0),
    propertyId: toId(row.propertyId),
    paymentProvider: row.paymentProvider || "",
    paymentOrderId: row.paymentOrderId || "",
    paymentId: row.paymentId || "",
    paymentStatus: row.paymentStatus || "",
    startDate: asIso(row.startDate),
    endDate: asIso(row.endDate),
    createdAt: asIso(row.createdAt),
    updatedAt: asIso(row.updatedAt)
  };
}

export function reviewsSummary(items = []) {
  const ratings = items
    .map((item) => Number(item?.rating || 0))
    .filter((value) => Number.isFinite(value) && value > 0);
  const total = ratings.length;
  const average =
    total > 0
      ? Number((ratings.reduce((sum, value) => sum + value, 0) / total).toFixed(2))
      : 0;
  return { total, average };
}
