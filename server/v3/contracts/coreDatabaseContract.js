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

export function buildCoreDatabaseContract(runtime = {}) {
  const mode = runtime.dbConnected ? "mongodb" : "memory-fallback";

  return {
    version: CORE_DATABASE_STRUCTURE_VERSION,
    mode,
    collections: coreMongoCollections
  };
}
