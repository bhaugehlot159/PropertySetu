import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { proRuntime } from "../../config/proRuntime.js";
import { getStorageProvider } from "../../config/proStorage.js";
import { getRazorpayPublicKey } from "../../config/proRazorpay.js";
import {
  applyProSecurityControlProfile,
  getProSecurityAuditEvents,
  getProSecurityChainIntegrityStatus,
  getProSecurityControlPersistenceStatus,
  getProSecurityControlState,
  getProSecurityThreatIntelligence,
  isValidProSecurityThreatFingerprint,
  listProSecurityControlProfiles,
  normalizeProSecurityThreatFingerprint,
  quarantineProSecurityThreatProfile,
  releaseProSecurityThreatProfile,
  resetProSecurityControlState,
  restoreProSecurityControlStateFromDisk,
  updateProSecurityControlState
} from "../../middleware/proSecurityMiddleware.js";
import {
  getCoreRateLimiterSecurityState,
  resetCoreRateLimiterSecurityState,
  updateCoreRateLimiterSecurityControls
} from "../middleware/coreSecurityMiddleware.js";
import {
  getCorePrivateDocCryptoControlState,
  resetCorePrivateDocCryptoControlState,
  updateCorePrivateDocCryptoControlState
} from "../utils/corePrivateDocSecurity.js";
import CoreRuntimeConfig from "../models/CoreRuntimeConfig.js";
import CoreUser from "../models/CoreUser.js";
import CoreProperty from "../models/CoreProperty.js";
import CoreReview from "../models/CoreReview.js";
import CoreSubscription from "../models/CoreSubscription.js";
import {
  buildCoreDatabaseContract,
  coreSystemsBlueprint
} from "../contracts/coreDatabaseContract.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../../..");
const PRIVATE_DOC_CRYPTO_CONTROL_CONFIG_KEY = "private-doc-crypto-control";
const PRIVATE_DOC_CRYPTO_CONTROL_HYDRATE_COOLDOWN_MS = Math.max(
  5_000,
  Number(process.env.CORE_PRIVATE_DOC_CRYPTO_CONTROL_HYDRATE_COOLDOWN_MS || 45_000)
);
let privateDocCryptoControlHydratedAtTs = 0;

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

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  const normalized = text(value).toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return fallback;
}

function toPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function resolveChainOverrideApproval(body = {}) {
  const safeBody = toPlainObject(body) || {};
  return (
    toPlainObject(safeBody.chainOverrideApproval) ||
    toPlainObject(safeBody.dualControlApproval) ||
    toPlainObject(safeBody.chainApproval) ||
    null
  );
}

function sanitizePrivateDocCryptoControlPatch(value = {}) {
  const safe = toPlainObject(value) || {};
  const out = {};
  if (typeof safe.activeKeyId !== "undefined") {
    out.activeKeyId = text(safe.activeKeyId).toLowerCase();
  }
  if (typeof safe.allowLegacyTokenFormat !== "undefined") {
    out.allowLegacyTokenFormat = toBoolean(safe.allowLegacyTokenFormat, true);
  }
  if (typeof safe.legacyDecryptEnabled !== "undefined") {
    out.legacyDecryptEnabled = toBoolean(safe.legacyDecryptEnabled, true);
  }
  return out;
}

function buildPersistablePrivateDocCryptoControlState() {
  const state = getCorePrivateDocCryptoControlState();
  return {
    activeKeyId: text(state.activeKeyId).toLowerCase(),
    allowLegacyTokenFormat: Boolean(state.allowLegacyTokenFormat),
    legacyDecryptEnabled: Boolean(state.legacyDecryptEnabled)
  };
}

async function hydratePrivateDocCryptoControlState({ force = false } = {}) {
  const nowTs = Date.now();
  if (!proRuntime.dbConnected) {
    privateDocCryptoControlHydratedAtTs = nowTs;
    return getCorePrivateDocCryptoControlState();
  }
  if (
    !force &&
    privateDocCryptoControlHydratedAtTs &&
    privateDocCryptoControlHydratedAtTs + PRIVATE_DOC_CRYPTO_CONTROL_HYDRATE_COOLDOWN_MS > nowTs
  ) {
    return getCorePrivateDocCryptoControlState();
  }
  try {
    const row = await CoreRuntimeConfig.findOne({
      key: PRIVATE_DOC_CRYPTO_CONTROL_CONFIG_KEY
    })
      .select("value updatedBy")
      .lean();
    const persistedValue = toPlainObject(row?.value);
    if (persistedValue) {
      updateCorePrivateDocCryptoControlState(sanitizePrivateDocCryptoControlPatch(persistedValue), {
        actorId: text(row?.updatedBy),
        actorRole: "persisted-config",
        source: "persisted-hydrate"
      });
    }
  } catch {
    // Keep current runtime state when persistence read fails.
  }
  privateDocCryptoControlHydratedAtTs = nowTs;
  return getCorePrivateDocCryptoControlState();
}

async function persistPrivateDocCryptoControlState({
  actorId = "",
  notes = ""
} = {}) {
  const control = buildPersistablePrivateDocCryptoControlState();
  if (!proRuntime.dbConnected) {
    return {
      persisted: false,
      source: "memory",
      control,
      state: getCorePrivateDocCryptoControlState()
    };
  }
  try {
    await CoreRuntimeConfig.findOneAndUpdate(
      { key: PRIVATE_DOC_CRYPTO_CONTROL_CONFIG_KEY },
      {
        $set: {
          value: control,
          updatedBy: text(actorId) || null,
          notes: text(notes).slice(0, 220)
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    privateDocCryptoControlHydratedAtTs = Date.now();
    return {
      persisted: true,
      source: "mongodb",
      control,
      state: getCorePrivateDocCryptoControlState()
    };
  } catch {
    return {
      persisted: false,
      source: "memory",
      control,
      state: getCorePrivateDocCryptoControlState()
    };
  }
}

export async function bootstrapCorePrivateDocCryptoControlState() {
  return hydratePrivateDocCryptoControlState({ force: true });
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
  const nodeEnv = text(process.env.NODE_ENV, "development").toLowerCase();
  const developmentFallbackActive = nodeEnv !== "production";
  const storageReady = storageConfigured || developmentFallbackActive;

  const razorpayConfigured =
    isConfiguredCredential(getRazorpayPublicKey()) &&
    isConfiguredCredential(process.env.RAZORPAY_KEY_SECRET);
  const paymentReady = razorpayConfigured || developmentFallbackActive;

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
    storageConfigReady: storageReady,
    storageExternalConfigured: storageConfigured,
    paymentConfigReady: paymentReady,
    paymentExternalConfigured: razorpayConfigured,
    developmentFallbackActive,
    hostingFrontendVercelConfig: vercelConfigExists,
    hostingBackendRenderConfig: renderConfigExists
  };

  return {
    checks,
    runtime: {
      nodeEnv,
      dbMode: proRuntime.dbConnected ? "mongodb" : "memory-fallback",
      storageProvider,
      readinessMode: developmentFallbackActive
        ? "development-with-fallback"
        : "production-strict",
      apiVersion: "v3"
    }
  };
}

function buildCoreSystemsStatus(checks = {}) {
  const dependencyState = {
    authentication: Boolean(checks.authConfigReady),
    fileStorage: Boolean(checks.storageConfigReady),
    paymentGateway: Boolean(checks.paymentConfigReady),
    database: Boolean(checks.databaseMongoConfigured),
    backendServer: Boolean(checks.backendExpress),
    hosting: Boolean(checks.hostingBackendRenderConfig || checks.hostingFrontendVercelConfig)
  };

  return coreSystemsBlueprint.map((system) => {
    const dependencyResults = (system.dependencies || []).map((dependency) => ({
      dependency,
      ready: Boolean(dependencyState[dependency])
    }));
    const status = dependencyResults.every((item) => item.ready) ? "ready" : "setup-required";

    return {
      ...system,
      status,
      dependencyResults
    };
  });
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
    checks.storageConfigReady
      ? checks.storageExternalConfigured
        ? ""
        : "Running in development fallback mode. Add real storage credentials for production."
      : "Storage provider credentials are missing."
  );
  const subscriptionStep = stepStatus(
    checks.paymentConfigReady,
    checks.paymentConfigReady
      ? checks.paymentExternalConfigured
        ? ""
        : "Running in development fallback mode. Add Razorpay keys for production."
      : "Razorpay keys are missing."
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
        "/api/v3/properties/taxonomy",
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
    },
    {
      step: 8,
      title: "Sealed bid hidden bidding",
      status: checks.authConfigReady && checks.databaseMongoConfigured ? "ready" : "setup-required",
      blockedBy:
        checks.authConfigReady && checks.databaseMongoConfigured
          ? ""
          : "Auth + database setup required for sealed hidden bidding.",
      endpoints: [
        "/api/v3/sealed-bids",
        "/api/v3/sealed-bids/admin",
        "/api/v3/sealed-bids/decision",
        "/api/v3/sealed-bids/winner/:propertyId"
      ]
    }
  ];
}

function getStackOptionsAndFolderStructure() {
  const structure = {
    root: "PropertySetu/",
    tree: [
      "PropertySetu/",
      "|",
      "|-- client/              # Frontend (React)",
      "|   |-- pages/",
      "|   |-- components/",
      "|   |-- services/",
      "|   `-- utils/",
      "|",
      "|-- server/              # Backend",
      "|   |-- controllers/",
      "|   |-- models/",
      "|   |-- routes/",
      "|   |-- middleware/",
      "|   `-- config/",
      "|",
      "|-- database/",
      "|",
      "`-- package.json"
    ],
    requiredPaths: {
      client: "client/",
      clientPages: "client/pages/",
      clientComponents: "client/components/",
      clientServices: "client/services/",
      clientUtils: "client/utils/",
      server: "server/",
      serverControllers: "server/controllers/",
      serverModels: "server/models/",
      serverRoutes: "server/routes/",
      serverMiddleware: "server/middleware/",
      serverConfig: "server/config/",
      database: "database/",
      rootPackageJson: "package.json"
    }
  };

  const presence = Object.fromEntries(
    Object.entries(structure.requiredPaths).map(([key, rel]) => [
      key,
      fs.existsSync(path.join(rootDir, rel))
    ])
  );

  return {
    option1: {
      label: "Best & Modern",
      frontend: "React / Next.js",
      backend: "Node.js + Express",
      database: "MongoDB",
      fileStorage: "Cloudinary / AWS S3",
      hosting: "Vercel + Render",
      payment: "Razorpay"
    },
    option2: {
      label: "Easier for Beginner",
      frontend: "HTML + CSS + JS",
      backend: "Node.js",
      database: "MongoDB",
      adminPanel: "Simple admin panel"
    },
    recommendation: "If you plan a future app build, Option 1 is best.",
    folderStructure: structure,
    folderPresence: presence
  };
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

export function getCoreSystemStackOptions(_req, res) {
  const payload = getStackOptionsAndFolderStructure();
  return res.json({
    success: true,
    ...payload,
    source: "professional-system-api"
  });
}

export function getCoreSystemStackReadiness(_req, res) {
  const snapshot = getStackChecksSnapshot();
  const checks = snapshot.checks;

  const passedCount = Object.values(checks).filter(Boolean).length;
  const totalCount = Object.keys(checks).length;
  const productionExternalReady =
    checks.storageExternalConfigured && checks.paymentExternalConfigured;
  const coreOperationalReady =
    checks.frontendReactOrNext &&
    checks.backendExpress &&
    checks.databaseMongoConfigured &&
    checks.authConfigReady &&
    checks.storageConfigReady &&
    checks.paymentConfigReady &&
    (checks.hostingFrontendVercelConfig || checks.hostingBackendRenderConfig);
  const stage = coreOperationalReady
    ? productionExternalReady
      ? "production-ready"
      : "development-ready"
    : passedCount >= Math.ceil(totalCount * 0.7)
      ? "staging-ready"
      : "setup-required";

  return res.json({
    success: true,
    stage,
    productionExternalReady,
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

export function getCoreSystemBlueprint(_req, res) {
  const snapshot = getStackChecksSnapshot();
  const contract = buildCoreDatabaseContract(proRuntime);
  const systems = buildCoreSystemsStatus(snapshot.checks);
  const readyCount = systems.filter((item) => item.status === "ready").length;
  const productionExternalReady =
    snapshot.checks.storageExternalConfigured &&
    snapshot.checks.paymentExternalConfigured;

  return res.json({
    success: true,
    message: "MongoDB structure + core systems blueprint for real backend build.",
    mongodbStructure: contract.collections,
    coreSystems: systems,
    summary: {
      ready: readyCount,
      total: systems.length,
      stage:
        readyCount === systems.length
          ? productionExternalReady
            ? "core-systems-ready"
            : "core-systems-ready-development"
          : "core-systems-setup-required",
      productionExternalReady
    },
    runtime: snapshot.runtime
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

export function getCoreSystemSecurityAudit(req, res) {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit || 100)));
  const items = getProSecurityAuditEvents(limit);
  const chainIntegrity = getProSecurityChainIntegrityStatus({
    auditLimit: limit,
    threatLimit: limit
  });
  return res.json({
    success: true,
    total: items.length,
    requestedBy: {
      id: String(req.coreUser?.id || ""),
      role: String(req.coreUser?.role || "")
    },
    chainIntegrity,
    items
  });
}

export function getCoreSystemSecurityIntelligence(req, res) {
  const limit = Math.min(500, Math.max(1, Number(req.query.limit || 100)));
  const intelligence = getProSecurityThreatIntelligence(limit);
  return res.json({
    success: true,
    requestedBy: {
      id: String(req.coreUser?.id || ""),
      role: String(req.coreUser?.role || "")
    },
    ...intelligence
  });
}

export function getCoreSystemSecurityControl(req, res) {
  return res.json({
    success: true,
    requestedBy: {
      id: String(req.coreUser?.id || ""),
      role: String(req.coreUser?.role || "")
    },
    state: getProSecurityControlState()
  });
}

export async function getCoreSystemPrivateDocCryptoControl(req, res, next) {
  try {
    await hydratePrivateDocCryptoControlState();
    return res.json({
      success: true,
      requestedBy: {
        id: String(req.coreUser?.id || ""),
        role: String(req.coreUser?.role || "")
      },
      state: getCorePrivateDocCryptoControlState()
    });
  } catch (error) {
    return next(error);
  }
}

export async function updateCoreSystemPrivateDocCryptoControl(req, res, next) {
  try {
    await hydratePrivateDocCryptoControlState();
    const body =
      req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? req.body
        : {};
    const patch =
      body.patch && typeof body.patch === "object" && !Array.isArray(body.patch)
        ? body.patch
        : body;
    const sanitizedPatch = sanitizePrivateDocCryptoControlPatch(patch);
    if (!Object.keys(sanitizedPatch).length) {
      return res.status(400).json({
        success: false,
        message: "At least one crypto-control field is required."
      });
    }

    const actorId = String(req.coreUser?.id || "");
    const actorRole = String(req.coreUser?.role || "");
    const result = updateCorePrivateDocCryptoControlState(sanitizedPatch, {
      actorId,
      actorRole
    });
    if (!result.updated) {
      return res.status(400).json({
        success: false,
        message: text(result.error, "Unable to update private-doc crypto control."),
        availableKeyIds: Array.isArray(result.availableKeyIds)
          ? result.availableKeyIds
          : []
      });
    }

    const persistence = await persistPrivateDocCryptoControlState({
      actorId,
      notes: "private-doc-crypto-control-update"
    });
    return res.json({
      success: true,
      action: "updated",
      requestedBy: {
        id: actorId,
        role: actorRole
      },
      persistence: {
        source: text(persistence.source, proRuntime.dbConnected ? "mongodb" : "memory"),
        persisted: Boolean(persistence.persisted)
      },
      state: result.state
    });
  } catch (error) {
    return next(error);
  }
}

export async function resetCoreSystemPrivateDocCryptoControl(req, res, next) {
  try {
    await hydratePrivateDocCryptoControlState();
    const actorId = String(req.coreUser?.id || "");
    const actorRole = String(req.coreUser?.role || "");
    const reset = resetCorePrivateDocCryptoControlState({
      actorId,
      actorRole
    });
    const persistence = await persistPrivateDocCryptoControlState({
      actorId,
      notes: "private-doc-crypto-control-reset"
    });
    return res.json({
      success: true,
      action: "reset",
      requestedBy: {
        id: actorId,
        role: actorRole
      },
      persistence: {
        source: text(persistence.source, proRuntime.dbConnected ? "mongodb" : "memory"),
        persisted: Boolean(persistence.persisted)
      },
      state: reset.state
    });
  } catch (error) {
    return next(error);
  }
}

export function getCoreSystemRateLimiterControl(req, res) {
  const includeAudit = toBoolean(req.query?.includeAudit, true);
  const auditLimit = Math.max(1, Math.min(500, Number(req.query?.auditLimit || 120)));
  return res.json({
    success: true,
    requestedBy: {
      id: String(req.coreUser?.id || ""),
      role: String(req.coreUser?.role || "")
    },
    state: getCoreRateLimiterSecurityState({
      includeAudit,
      auditLimit
    })
  });
}

export function updateCoreSystemRateLimiterControl(req, res) {
  const body =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? req.body
      : {};
  const patch =
    body.patch && typeof body.patch === "object" && !Array.isArray(body.patch)
      ? body.patch
      : body;
  const result = updateCoreRateLimiterSecurityControls(patch, {
    actorId: String(req.coreUser?.id || ""),
    actorRole: String(req.coreUser?.role || "")
  });
  return res.json({
    success: true,
    action: "updated",
    requestedBy: {
      id: String(req.coreUser?.id || ""),
      role: String(req.coreUser?.role || "")
    },
    ...result
  });
}

export function resetCoreSystemRateLimiterControl(req, res) {
  const body =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? req.body
      : {};
  const scope = text(body.scope || req.query?.scope).toLowerCase();
  const result = resetCoreRateLimiterSecurityState({
    scope,
    clearBuckets: toBoolean(body.clearBuckets, true),
    clearBlocks: toBoolean(body.clearBlocks, true),
    clearMetrics: toBoolean(body.clearMetrics, false),
    clearAudit: toBoolean(body.clearAudit, false),
    clearScopePolicy: toBoolean(body.clearScopePolicy, false),
    actorId: String(req.coreUser?.id || ""),
    actorRole: String(req.coreUser?.role || "")
  });
  return res.json({
    success: true,
    action: "reset",
    requestedBy: {
      id: String(req.coreUser?.id || ""),
      role: String(req.coreUser?.role || "")
    },
    ...result
  });
}

export function updateCoreSystemSecurityControl(req, res) {
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? req.body
    : {};
  const chainOverrideApproval = resolveChainOverrideApproval(body);
  const confirmChainIntegrityOverride = toBoolean(
    body.confirmChainIntegrityOverride || body.chainBreakGlass || body.confirmChainOverride,
    false
  );
  const confirmHighRiskDowngrade = toBoolean(
    body.confirmHighRiskDowngrade || body.breakGlass || body.confirmHighRiskChange,
    false
  );
  const patch =
    body.patch && typeof body.patch === "object" && !Array.isArray(body.patch)
      ? body.patch
      : body;
  const result = updateProSecurityControlState(patch, {
    actorId: String(req.coreUser?.id || ""),
    actorRole: String(req.coreUser?.role || ""),
    confirmChainIntegrityOverride,
    chainOverrideApproval,
    confirmHighRiskDowngrade
  });
  if (result.blocked) {
    return res.status(429).json({
      success: false,
      action: "update-blocked",
      requestedBy: {
        id: String(req.coreUser?.id || ""),
        role: String(req.coreUser?.role || "")
      },
      warnings: Array.isArray(result.warnings) ? result.warnings : [],
      guard: result.guard && typeof result.guard === "object" ? result.guard : null,
      chainGuard: result.chainGuard && typeof result.chainGuard === "object"
        ? result.chainGuard
        : null,
      chainDualControl: result.chainDualControl && typeof result.chainDualControl === "object"
        ? result.chainDualControl
        : null,
      downgradeGuard: result.downgradeGuard && typeof result.downgradeGuard === "object"
        ? result.downgradeGuard
        : null,
      state: result.state
    });
  }
  return res.json({
    success: true,
    action: "updated",
    requestedBy: {
      id: String(req.coreUser?.id || ""),
      role: String(req.coreUser?.role || "")
    },
    warnings: Array.isArray(result.warnings) ? result.warnings : [],
    guard: result.guard && typeof result.guard === "object" ? result.guard : null,
    chainGuard: result.chainGuard && typeof result.chainGuard === "object"
      ? result.chainGuard
      : null,
    chainDualControl: result.chainDualControl && typeof result.chainDualControl === "object"
      ? result.chainDualControl
      : null,
    downgradeGuard: result.downgradeGuard && typeof result.downgradeGuard === "object"
      ? result.downgradeGuard
      : null,
    state: result.state
  });
}

export function getCoreSystemSecurityControlProfiles(req, res) {
  return res.json({
    success: true,
    requestedBy: {
      id: String(req.coreUser?.id || ""),
      role: String(req.coreUser?.role || "")
    },
    profiles: listProSecurityControlProfiles()
  });
}

export function applyCoreSystemSecurityControlProfile(req, res) {
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? req.body
    : {};
  const profileId = text(body.profileId || body.profile || body.mode).toLowerCase();
  const chainOverrideApproval = resolveChainOverrideApproval(body);
  const confirmChainIntegrityOverride = toBoolean(
    body.confirmChainIntegrityOverride || body.chainBreakGlass || body.confirmChainOverride,
    false
  );
  const confirmHighRiskDowngrade = toBoolean(
    body.confirmHighRiskDowngrade || body.breakGlass || body.confirmHighRiskChange,
    false
  );
  const result = applyProSecurityControlProfile(profileId, {
    actorId: String(req.coreUser?.id || ""),
    actorRole: String(req.coreUser?.role || ""),
    confirmChainIntegrityOverride,
    chainOverrideApproval,
    confirmHighRiskDowngrade
  });
  const statusCode = result.blocked ? 429 : (result.applied ? 200 : 400);
  return res.status(statusCode).json({
    success: result.applied,
    action: result.blocked ? "profile-blocked" : (result.applied ? "profile-applied" : "profile-rejected"),
    requestedBy: {
      id: String(req.coreUser?.id || ""),
      role: String(req.coreUser?.role || "")
    },
    profileId: result.profileId,
    warnings: Array.isArray(result.warnings) ? result.warnings : [],
    guard: result.guard && typeof result.guard === "object" ? result.guard : null,
    chainGuard: result.chainGuard && typeof result.chainGuard === "object"
      ? result.chainGuard
      : null,
    chainDualControl: result.chainDualControl && typeof result.chainDualControl === "object"
      ? result.chainDualControl
      : null,
    downgradeGuard: result.downgradeGuard && typeof result.downgradeGuard === "object"
      ? result.downgradeGuard
      : null,
    state: result.state
  });
}

export function getCoreSystemSecurityControlPersistence(req, res) {
  return res.json({
    success: true,
    requestedBy: {
      id: String(req.coreUser?.id || ""),
      role: String(req.coreUser?.role || "")
    },
    persistence: getProSecurityControlPersistenceStatus()
  });
}

export function restoreCoreSystemSecurityControl(req, res) {
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? req.body
    : {};
  const chainOverrideApproval = resolveChainOverrideApproval(body);
  const confirmChainIntegrityOverride = toBoolean(
    body.confirmChainIntegrityOverride || body.chainBreakGlass || body.confirmChainOverride,
    false
  );
  const result = restoreProSecurityControlStateFromDisk({
    actorId: String(req.coreUser?.id || ""),
    actorRole: String(req.coreUser?.role || ""),
    confirmChainIntegrityOverride,
    chainOverrideApproval
  });
  const statusCode = result.blocked ? 429 : (result.restored ? 200 : 404);
  return res.status(statusCode).json({
    success: result.restored,
    action: result.blocked ? "restore-blocked" : (result.restored ? "restored" : "restore-missed"),
    requestedBy: {
      id: String(req.coreUser?.id || ""),
      role: String(req.coreUser?.role || "")
    },
    warnings: Array.isArray(result.warnings) ? result.warnings : [],
    guard: result.guard && typeof result.guard === "object" ? result.guard : null,
    chainGuard: result.chainGuard && typeof result.chainGuard === "object"
      ? result.chainGuard
      : null,
    chainDualControl: result.chainDualControl && typeof result.chainDualControl === "object"
      ? result.chainDualControl
      : null,
    state: result.state
  });
}

export function resetCoreSystemSecurityControl(req, res) {
  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? req.body
    : {};
  const chainOverrideApproval = resolveChainOverrideApproval(body);
  const confirmChainIntegrityOverride = toBoolean(
    body.confirmChainIntegrityOverride || body.chainBreakGlass || body.confirmChainOverride,
    false
  );
  const result = resetProSecurityControlState({
    actorId: String(req.coreUser?.id || ""),
    actorRole: String(req.coreUser?.role || ""),
    confirmChainIntegrityOverride,
    chainOverrideApproval
  });
  const statusCode = result.blocked ? 429 : 200;
  return res.status(statusCode).json({
    success: !result.blocked,
    action: result.blocked ? "reset-blocked" : "reset",
    requestedBy: {
      id: String(req.coreUser?.id || ""),
      role: String(req.coreUser?.role || "")
    },
    warnings: Array.isArray(result.warnings) ? result.warnings : [],
    guard: result.guard && typeof result.guard === "object" ? result.guard : null,
    chainGuard: result.chainGuard && typeof result.chainGuard === "object"
      ? result.chainGuard
      : null,
    chainDualControl: result.chainDualControl && typeof result.chainDualControl === "object"
      ? result.chainDualControl
      : null,
    state: result.state
  });
}

export function releaseCoreSystemSecurityThreatProfile(req, res) {
  const fingerprint = normalizeProSecurityThreatFingerprint(req.body?.fingerprint);
  if (!fingerprint) {
    return res.status(400).json({
      success: false,
      message: "fingerprint is required."
    });
  }
  if (!isValidProSecurityThreatFingerprint(fingerprint)) {
    return res.status(400).json({
      success: false,
      message: "Invalid fingerprint format."
    });
  }

  const profile = releaseProSecurityThreatProfile(fingerprint);
  if (!profile) {
    return res.status(404).json({
      success: false,
      message: "Threat profile not found for fingerprint."
    });
  }

  return res.json({
    success: true,
    action: "released",
    requestedBy: {
      id: String(req.coreUser?.id || ""),
      role: String(req.coreUser?.role || "")
    },
    profile
  });
}

export function quarantineCoreSystemSecurityThreatProfile(req, res) {
  const fingerprint = normalizeProSecurityThreatFingerprint(req.body?.fingerprint);
  const reason = text(req.body?.reason || "manual-admin-quarantine").slice(0, 200);
  const durationMs = Math.max(
    60_000,
    Math.min(Number(req.body?.durationMs || 30 * 60 * 1000), 24 * 60 * 60 * 1000)
  );

  if (!fingerprint) {
    return res.status(400).json({
      success: false,
      message: "fingerprint is required."
    });
  }
  if (!isValidProSecurityThreatFingerprint(fingerprint)) {
    return res.status(400).json({
      success: false,
      message: "Invalid fingerprint format."
    });
  }

  const profile = quarantineProSecurityThreatProfile(fingerprint, {
    durationMs,
    reason: reason || "manual-admin-quarantine"
  });

  if (!profile) {
    return res.status(400).json({
      success: false,
      message: "Unable to quarantine threat profile."
    });
  }

  return res.json({
    success: true,
    action: "quarantined",
    requestedBy: {
      id: String(req.coreUser?.id || ""),
      role: String(req.coreUser?.role || "")
    },
    profile
  });
}
