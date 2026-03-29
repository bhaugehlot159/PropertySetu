import {
  CORE_PROPERTY_CATEGORY_VALUES,
  CORE_PROPERTY_TYPE_VALUES
} from "../config/corePropertyTaxonomy.js";

export const CORE_DATABASE_STRUCTURE_VERSION = "2026-03-28";

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
    typeEnum: CORE_PROPERTY_TYPE_VALUES,
    categoryEnum: CORE_PROPERTY_CATEGORY_VALUES,
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
      "Role based access",
      "Token-version session revocation on logout",
      "Account lockout and OTP cooldown hardening"
    ],
    endpoints: [
      "/api/v3/auth/request-otp",
      "/api/v3/auth/login-otp",
      "/api/v3/auth/login",
      "/api/v3/auth/logout",
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
      "Role-aware protected access",
      "Receiver-aware direct messaging",
      "WhatsApp handoff link support"
    ],
    endpoints: [
      "/api/v3/chat/send",
      "/api/v3/chat/:propertyId",
      "/api/v3/chat/mine",
      "/api/v3/chat/:propertyId/whatsapp-link"
    ],
    dependencies: ["authentication"]
  },
  {
    id: "sealed-bid-system",
    title: "Sealed Bid (Hidden Bidding) System",
    capabilities: [
      "Buyer/seller can place hidden bids",
      "Bid amount stays hidden for everyone except admin",
      "Property owner cannot view hidden bids",
      "Admin can accept highest, reject all, or reveal winner",
      "Admin decision reason mandatory",
      "Integrity hash trail for tamper detection",
      "Rate-limited bid submission and admin decisions"
    ],
    endpoints: [
      "/api/v3/sealed-bids",
      "/api/v3/sealed-bids/mine",
      "/api/v3/sealed-bids/summary",
      "/api/v3/sealed-bids/admin",
      "/api/v3/sealed-bids/decision",
      "/api/v3/sealed-bids/winner/:propertyId"
    ],
    dependencies: ["authentication", "database"]
  },
  {
    id: "platform-security-system",
    title: "Platform Security Hardening",
    capabilities: [
      "Global API security headers",
      "Suspicious payload guard against operator injection patterns",
      "Request ID tracing for audits",
      "Brute-force protection on auth/OTP endpoints",
      "High-risk route throttling for admin and write actions",
      "AI auto-detected threat scoring and temporary quarantine",
      "Admin-controlled security control plane (modules, thresholds, trusted fingerprints)",
      "Security profiles (balanced/hardened/lockdown) and emergency read-only mode",
      "Runtime blocklists for IP, fingerprint, user-agent signature, and token subject",
      "Persisted security-control state with restore support for admin recovery",
      "Tamper-evident signed security-control state persistence with integrity verification",
      "AI-based account takeover detection using subject-level anomaly intelligence",
      "Automatic offender-to-blocklist promotion with admin-tunable thresholds",
      "Threat-surge auto escalation to hardened/lockdown mode with cooldown controls",
      "Auto de-escalation back to safer mode after calm window using admin-defined thresholds",
      "Critical attack immediate response (instant blocklist and optional lockdown)",
      "Distributed campaign detection with AI-triggered lockdown and full admin control",
      "Auth-storm shield for OTP/login routes with auto activation and admin bypass control",
      "Targeted identity protection for attacked login/OTP identities with temporary shield",
      "Token-subject takeover auto protection with temporary shield and admin overrides",
      "Subject session-churn shield to stop token-family abuse with automated containment",
      "Network-velocity shield for impossible subject movement across IP prefixes",
      "Admin mutation attack shield for suspicious control-plane write attempts",
      "Signed admin mutation requests (HMAC + nonce + timestamp) with anti-replay controls",
      "Volume-gated admin credential attack auto-detection with controlled critical response",
      "High-risk shield bypass hardening: action-key bypass now requires signed proof verification",
      "Admin signature key rotation support (primary + secondary secret) for zero-downtime secret rollover",
      "Signed admin-security responses with body-hash integrity headers for tamper detection",
      "Signed security-control snapshot backups with tamper-evident hash-chain and automatic fallback restore",
      "Rollback attack protection: stale primary state auto-detected and replaced with latest valid snapshot",
      "Snapshot chain continuity verification: missing/looped/duplicate links are auto-rejected before restore",
      "Security-control mutation abuse guard: rapid admin update/reset/restore/profile actions auto-throttled with temporary actor block",
      "Filesystem path hardening for security-control persistence: allowed-root enforcement plus symlink path rejection",
      "High-risk security downgrade guard: critical module/control weakening blocked unless explicit break-glass confirm",
      "Runtime hash-chain integrity verification for audit and threat incident streams with mismatch telemetry",
      "Chain-enforcement guard: security-control mutations blocked while chain integrity is compromised unless explicit chain break-glass confirm",
      "Dual-control chain override approvals: compromised-chain break-glass requires a second approver with signed anti-replay approval proof",
      "Dual-control abuse guard: repeated invalid chain approvals auto-throttled with temporary actor lock",
      "Approver abuse shield: repeated invalid approvals for the same approverId are auto-blocked, including distributed multi-actor and multi-digest abuse patterns",
      "Operation-digest bound approvals: signed chain override cannot be replayed across different mutation payloads",
      "Reason-bound dual signatures: strict admin mode enforces reason-integrity-bound override signatures while optional legacy signatures can stay enabled for staged migration"
    ],
    endpoints: [
      "/api/v3/auth/*",
      "/api/v3/uploads/property-media",
      "/api/v3/chat/send",
      "/api/sealed-bids/*",
      "/api/system/security-audit",
      "/api/system/security-intelligence",
      "/api/system/security-control",
      "/api/system/security-control/profiles",
      "/api/system/security-control/persistence",
      "/api/system/security-control/profile",
      "/api/system/security-control/restore",
      "/api/system/security-control/reset",
      "/api/system/security-intelligence/release",
      "/api/system/security-intelligence/quarantine",
      "/api/v3/system/security-audit",
      "/api/v3/system/security-intelligence",
      "/api/v3/system/security-control",
      "/api/v3/system/security-control/profiles",
      "/api/v3/system/security-control/persistence",
      "/api/v3/system/security-control/profile",
      "/api/v3/system/security-control/restore",
      "/api/v3/system/security-control/reset",
      "/api/v3/system/security-intelligence/release",
      "/api/v3/system/security-intelligence/quarantine"
    ],
    dependencies: ["authentication", "backendServer"]
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
      "Compare up to 3 properties",
      "Direct compare using propertyIds without wishlist dependency"
    ],
    endpoints: [
      "/api/v3/wishlist",
      "/api/v3/wishlist/:propertyId",
      "/api/v3/wishlist/compare",
      "/api/v3/properties/compare"
    ],
    dependencies: ["authentication", "database"]
  },
  {
    id: "customer-emi-calculator-system",
    title: "Customer EMI Calculator",
    capabilities: [
      "Loan amount input",
      "Interest rate input",
      "Tenure months/years input",
      "Monthly EMI + total interest output"
    ],
    endpoints: [
      "/api/v3/ai/emi-calculator"
    ],
    dependencies: ["database"]
  },
  {
    id: "property-map-integration-system",
    title: "Google Maps Property View",
    capabilities: [
      "Google Maps view URL in property response",
      "Google Directions URL in property response",
      "Google Embed URL in property response"
    ],
    endpoints: [
      "/api/v3/properties",
      "/api/v3/properties/:propertyId"
    ],
    dependencies: ["database"]
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
