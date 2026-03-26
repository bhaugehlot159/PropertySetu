export const CORE_DATABASE_STRUCTURE_VERSION = "2026-03-26";

export const coreMongoCollections = {
  users: {
    collection: "users",
    requiredFields: [
      "name",
      "email",
      "phone",
      "password",
      "role",
      "verified",
      "subscriptionPlan",
      "createdAt"
    ],
    roleEnum: ["buyer", "seller", "admin"],
    notes: [
      "password is stored as hash",
      "phone supports OTP login identity"
    ],
    indexes: ["email(unique)", "phone(unique)", "createdAt(desc)"]
  },
  properties: {
    collection: "properties",
    requiredFields: [
      "title",
      "description",
      "city",
      "location",
      "type",
      "category",
      "price",
      "size",
      "images",
      "video",
      "ownerId",
      "verified",
      "featured",
      "createdAt"
    ],
    typeEnum: ["buy", "rent"],
    categoryEnum: ["house", "plot", "commercial"],
    indexes: [
      "city",
      "category",
      "type",
      "verified",
      "featured"
    ]
  },
  reviews: {
    collection: "reviews",
    requiredFields: ["propertyId", "userId", "rating", "comment", "createdAt"],
    indexes: ["propertyId", "createdAt(desc)"]
  },
  subscriptions: {
    collection: "subscriptions",
    requiredFields: ["userId", "planName", "amount", "startDate", "endDate", "createdAt"],
    indexes: ["userId", "endDate(desc)"]
  }
};

export const coreSystemsBlueprint = [
  {
    id: "authentication-system",
    title: "Authentication System",
    capabilities: [
      "OTP login",
      "JWT token",
      "Role based access"
    ],
    endpoints: [
      "/api/v3/auth/request-otp",
      "/api/v3/auth/login-otp",
      "/api/v3/auth/login",
      "/api/v3/auth/me"
    ],
    dependencies: ["authentication"]
  },
  {
    id: "property-upload-system",
    title: "Property Upload System",
    capabilities: [
      "Minimum 5 photos validation",
      "1 video upload",
      "Document upload (private)",
      "Private document visibility only for owner/admin",
      "Auto description generator"
    ],
    endpoints: [
      "/api/v3/properties/professional",
      "/api/v3/properties/auto-description",
      "/api/v3/uploads/property-media"
    ],
    dependencies: ["fileStorage"]
  },
  {
    id: "verified-badge-system",
    title: "Verified Badge System",
    capabilities: [
      "Admin approve karega",
      "Verified by PropertySetu badge show hoga"
    ],
    endpoints: [
      "/api/v3/properties/:propertyId/verify"
    ],
    dependencies: ["authentication"]
  },
  {
    id: "subscription-payment-system",
    title: "Subscription and Payment",
    capabilities: [
      "Razorpay integration",
      "Featured listing system",
      "Payment proof support for strict verification mode",
      "Property care monthly package"
    ],
    endpoints: [
      "/api/v3/subscriptions/plans",
      "/api/v3/subscriptions/payment/order",
      "/api/v3/subscriptions/payment/verify",
      "/api/v3/subscriptions"
    ],
    dependencies: ["paymentGateway"]
  },
  {
    id: "ai-phase-2-system",
    title: "AI Features (Phase 2)",
    capabilities: [
      "Smart pricing suggestion",
      "Similar property recommendation",
      "Fake listing detection"
    ],
    endpoints: [
      "/api/v3/ai/smart-pricing",
      "/api/v3/ai/similar-properties",
      "/api/v3/ai/fake-listing-detection"
    ],
    dependencies: ["database"]
  },
  {
    id: "chat-system",
    title: "In-app Chat",
    capabilities: [
      "Buyer seller secure chat",
      "Role-aware protected access"
    ],
    endpoints: [
      "/api/v3/chat/send",
      "/api/v3/chat/:propertyId",
      "/api/v3/chat/mine"
    ],
    dependencies: ["authentication"]
  },
  {
    id: "city-seo-system",
    title: "City-wise SEO Structure",
    capabilities: [
      "Multi-city SEO structure endpoint",
      "Locality aware data model"
    ],
    endpoints: [
      "/api/v3/seo/city-structure"
    ],
    dependencies: ["database"]
  },
  {
    id: "property-care-system",
    title: "Property Care Subscription",
    capabilities: [
      "Monthly property care request flow",
      "Admin status update"
    ],
    endpoints: [
      "/api/v3/property-care/requests",
      "/api/v3/property-care/requests/me",
      "/api/v3/property-care/requests/:requestId/status"
    ],
    dependencies: ["authentication"]
  },
  {
    id: "customer-smart-filter-system",
    title: "Customer Smart Filter System",
    capabilities: [
      "Price range filter",
      "Location radius filter",
      "BHK filter",
      "Furnished/Semi/Unfurnished filter",
      "Ready to move/Under construction filter",
      "Loan available filter",
      "Verified property only filter"
    ],
    endpoints: [
      "/api/v3/properties?minPrice=&maxPrice=&bhk=&furnishing=&constructionStatus=&loanAvailable=&verifiedOnly=",
      "/api/v3/properties?centerLat=&centerLng=&radiusKm="
    ],
    dependencies: ["database"]
  },
  {
    id: "customer-wishlist-compare-system",
    title: "Customer Wishlist and Compare",
    capabilities: [
      "Save property to wishlist",
      "Remove from wishlist",
      "Compare up to 3 properties"
    ],
    endpoints: [
      "/api/v3/wishlist",
      "/api/v3/wishlist/:propertyId",
      "/api/v3/wishlist/compare"
    ],
    dependencies: ["authentication", "database"]
  },
  {
    id: "customer-visit-booking-system",
    title: "Customer Visit Booking and Owner Notification",
    capabilities: [
      "Customer selects visit time",
      "Owner receives notification",
      "Owner/Admin can update visit status"
    ],
    endpoints: [
      "/api/v3/properties/:propertyId/visit",
      "/api/v3/visits/mine",
      "/api/v3/visits/owner",
      "/api/v3/visits/:visitId/status",
      "/api/v3/notifications/mine"
    ],
    dependencies: ["authentication", "database"]
  }
];

export function buildCoreDatabaseContract(runtime = {}) {
  const mode = runtime.dbConnected ? "mongodb" : "memory-fallback";

  return {
    version: CORE_DATABASE_STRUCTURE_VERSION,
    mode,
    collections: coreMongoCollections,
    coreSystems: coreSystemsBlueprint
  };
}
