import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { proRuntime } from "../../config/proRuntime.js";
import { getStorageProvider } from "../../config/proStorage.js";
import { getRazorpayPublicKey } from "../../config/proRazorpay.js";
import CoreUser from "../models/CoreUser.js";
import CoreProperty from "../models/CoreProperty.js";
import CoreReview from "../models/CoreReview.js";
import CoreSubscription from "../models/CoreSubscription.js";
import { buildCoreDatabaseContract } from "../contracts/coreDatabaseContract.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../..");

function text(value, fallback = "") {
  const normalized = String(value || "").trim();
  return normalized || fallback;
}

function isConfiguredCredential(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return false;
  return (
    !raw.includes("replace_with") &&
    !raw.includes("placeholder") &&
    !raw.startsWith("your_")
  );
}

function readJsonSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function safeBool(value) {
  return Boolean(value);
}

function checkModelCoverage(model, requiredFields = []) {
  const schemaPaths = model?.schema?.paths
    ? Object.keys(model.schema.paths)
    : [];

  const missing = requiredFields.filter((field) => !schemaPaths.includes(field));
  const present = requiredFields.filter((field) => schemaPaths.includes(field));

  return {
    present,
    missing,
    coveragePercent: requiredFields.length
      ? Math.round((present.length / requiredFields.length) * 100)
      : 100
  };
}

function getStackChecksSnapshot() {
  const clientPackageJson = readJsonSafe(path.join(rootDir, "client", "package.json"));
  const serverPackageJson = readJsonSafe(path.join(rootDir, "server", "package.json"));

  const reactDetected = safeBool(clientPackageJson?.dependencies?.react);
  const nextDetected = safeBool(clientPackageJson?.dependencies?.next);
  const expressDetected = safeBool(serverPackageJson?.dependencies?.express);

  const mongoUriConfigured = isConfiguredCredential(process.env.MONGO_URI || process.env.MONGODB_URI);
  const storageProvider = text(getStorageProvider(), "cloudinary").toLowerCase();
  const cloudinaryConfigured =
    isConfiguredCredential(process.env.CLOUDINARY_CLOUD_NAME) &&
    isConfiguredCredential(process.env.CLOUDINARY_API_KEY) &&
    isConfiguredCredential(process.env.CLOUDINARY_API_SECRET);
  const s3Configured =
    isConfiguredCredential(process.env.AWS_REGION) &&
    isConfiguredCredential(process.env.AWS_S3_BUCKET);
  const storageConfigured =
    storageProvider === "cloudinary" ? cloudinaryConfigured : s3Configured;

  const razorpayConfigured =
    isConfiguredCredential(getRazorpayPublicKey()) &&
    isConfiguredCredential(process.env.RAZORPAY_KEY_SECRET);

  const authConfigured =
    isConfiguredCredential(process.env.JWT_SECRET) &&
    isConfiguredCredential(process.env.ADMIN_REGISTRATION_KEY);

  const vercelConfigExists = fs.existsSync(path.join(rootDir, "client", "vercel.json"));
  const renderConfigExists = fs.existsSync(path.join(rootDir, "server", "render.yaml"));

  const checks = {
    frontendReactOrNext: reactDetected || nextDetected,
    backendExpress: expressDetected,
    databaseMongoConfigured: mongoUriConfigured,
    databaseMongoConnected: Boolean(proRuntime.dbConnected),
    authConfigReady: authConfigured,
    storageConfigReady: storageConfigured,
    paymentConfigReady: razorpayConfigured,
    hostingFrontendVercelConfig: vercelConfigExists,
    hostingBackendRenderConfig: renderConfigExists
  };

  return {
    checks,
    runtime: {
      dbMode: proRuntime.dbConnected ? "mongodb" : "memory-fallback",
      storageProvider,
      apiVersion: "v3"
    }
  };
}

function buildExecutionSteps(checks) {
  const stepStatus = (done, blockedBy = "") => ({
    status: done ? "ready" : "setup-required",
    blockedBy
  });

  const backendStep = stepStatus(
    checks.backendExpress,
    checks.backendExpress ? "" : "Express backend dependency not detected."
  );
  const dbStep = stepStatus(
    checks.databaseMongoConfigured,
    checks.databaseMongoConfigured ? "" : "MONGO_URI/MONGODB_URI is not configured."
  );
  const authStep = stepStatus(
    checks.authConfigReady,
    checks.authConfigReady ? "" : "JWT/ADMIN auth secrets are not fully configured."
  );
  const uploadStep = stepStatus(
    checks.storageConfigReady,
    checks.storageConfigReady ? "" : "Storage provider credentials are missing."
  );
  const subscriptionStep = stepStatus(
    checks.paymentConfigReady,
    checks.paymentConfigReady ? "" : "Razorpay keys are missing."
  );

  return [
    {
      step: 1,
      title: "Backend setup",
      ...backendStep,
      endpoints: ["/api/v3/health"]
    },
    {
      step: 2,
      title: "Database connect",
      ...dbStep,
      details: {
        configured: checks.databaseMongoConfigured,
        connectedNow: checks.databaseMongoConnected
      },
      endpoints: ["/api/v3/system/database-structure"]
    },
    {
      step: 3,
      title: "Auth system (OTP + JWT + Role access)",
      ...authStep,
      endpoints: [
        "/api/v3/auth/request-otp",
        "/api/v3/auth/login-otp",
        "/api/v3/auth/login"
      ]
    },
    {
      step: 4,
      title: "Property CRUD",
      status: "ready",
      blockedBy: "",
      endpoints: [
        "/api/v3/properties",
        "/api/v3/properties/:propertyId",
        "/api/v3/properties/professional"
      ]
    },
    {
      step: 5,
      title: "File upload (photo/video/private docs)",
      ...uploadStep,
      endpoints: [
        "/api/v3/uploads/property-media",
        "/api/v3/properties/professional"
      ]
    },
    {
      step: 6,
      title: "Subscription + payment",
      ...subscriptionStep,
      endpoints: [
        "/api/v3/subscriptions/plans",
        "/api/v3/subscriptions/payment/order",
        "/api/v3/subscriptions/payment/verify",
        "/api/v3/subscriptions"
      ]
    },
    {
      step: 7,
      title: "AI phase-2",
      status: "ready",
      blockedBy: "",
      endpoints: [
        "/api/v3/ai/smart-pricing",
        "/api/v3/ai/similar-properties",
        "/api/v3/ai/fake-listing-detection"
      ]
    }
  ];
}

export function getCoreSystemArchitecturePlan(_req, res) {
  const recommendedStack = {
    frontend: "React / Next.js",
    backend: "Node.js + Express",
    database: "MongoDB",
    fileStorage: "Cloudinary / AWS S3",
    hosting: "Vercel + Render",
    payment: "Razorpay"
  };

  const liveImplementation = {
    frontend: {
      primary: "React (Vite)",
      path: "client/",
      fallback: "Static multipage web in frontend/"
    },
    backend: {
      primary: "Node.js + Express",
      path: "server/professional-server.js",
      apiV2: "/api/v2/*",
      apiV3: "/api/v3/*"
    },
    database: {
      primary: proRuntime.dbConnected ? "MongoDB (Connected)" : "MongoDB (Configured) + Memory Fallback",
      runtimeMode: proRuntime.dbConnected ? "mongodb" : "memory-fallback"
    },
    fileStorage: {
      primary: text(proRuntime.storageProvider || getStorageProvider(), "cloudinary"),
      supported: ["cloudinary", "s3"]
    },
    payment: {
      primary: "Razorpay",
      api: "/api/v2/payments/*"
    },
    hosting: {
      frontend: "Vercel (client/vercel.json)",
      backend: "Render (server/render.yaml)"
    }
  };

  return res.json({
    success: true,
    recommendedStack,
    liveImplementation,
    structure: {
      client: "client/ (React frontend)",
      backend: "backend/ (entry wrappers + scripts)",
      server: "server/ (professional + legacy APIs)",
      database: "database/ (legacy JSON persistence)",
      docs: "docs/ (deployment + architecture guides)"
    }
  });
}

export function getCoreSystemStackReadiness(_req, res) {
  const snapshot = getStackChecksSnapshot();
  const checks = snapshot.checks;

  const passedCount = Object.values(checks).filter(Boolean).length;
  const totalCount = Object.keys(checks).length;
  const stage =
    passedCount === totalCount
      ? "production-ready"
      : passedCount >= Math.ceil(totalCount * 0.7)
        ? "staging-ready"
        : "setup-required";

  return res.json({
    success: true,
    stage,
    score: {
      passed: passedCount,
      total: totalCount
    },
    runtime: snapshot.runtime,
    checks
  });
}

export function getCoreSystemDatabaseStructure(_req, res) {
  const contract = buildCoreDatabaseContract(proRuntime);
  const modelCoverage = {
    users: checkModelCoverage(CoreUser, contract.collections.users.requiredFields),
    properties: checkModelCoverage(CoreProperty, contract.collections.properties.requiredFields),
    reviews: checkModelCoverage(CoreReview, contract.collections.reviews.requiredFields),
    subscriptions: checkModelCoverage(CoreSubscription, contract.collections.subscriptions.requiredFields)
  };

  const missingRequired = Object.entries(modelCoverage).reduce(
    (sum, [, details]) => sum + details.missing.length,
    0
  );

  return res.json({
    success: true,
    source: proRuntime.dbConnected ? "mongodb" : "memory-fallback",
    contract,
    modelCoverage,
    status: missingRequired === 0 ? "contract-aligned" : "contract-mismatch"
  });
}

export function getCoreSystemExecutionPlan(_req, res) {
  const snapshot = getStackChecksSnapshot();
  const checks = snapshot.checks;
  const steps = buildExecutionSteps(checks);
  const readyCount = steps.filter((item) => item.status === "ready").length;

  return res.json({
    success: true,
    message:
      "Real startup features require backend server, database, auth, storage, payment gateway, and hosting setup.",
    startupNeed: {
      backendServer: true,
      database: true,
      authentication: true,
      fileStorage: true,
      paymentGateway: true,
      hostingSetup: true
    },
    steps,
    summary: {
      ready: readyCount,
      total: steps.length,
      stage: readyCount === steps.length ? "execution-ready" : "setup-in-progress"
    },
    runtime: snapshot.runtime
  });
}
