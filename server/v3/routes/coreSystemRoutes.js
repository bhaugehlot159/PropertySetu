import { Router } from "express";
import {
  batchReadCoreClientState,
  batchWriteCoreClientState,
  getCoreClientState,
  listCoreClientState,
  updateCoreClientState
} from "../controllers/coreClientStateController.js";
import {
  applyCoreSystemSecurityControlProfile,
  getCoreSystemAppLaunchConfig,
  getCoreSystemArchitecturePlan,
  getCoreSystemAppLaunchReadiness,
  getCoreSystemStackOptions,
  getCoreSystemStackReadiness,
  getCoreSystemDatabaseStructure,
  getCoreSystemBlueprint,
  getCoreSystemExecutionPlan,
  listCoreSystemPrivateDocCryptoControlAudit,
  getCoreSystemPrivateDocCryptoControl,
  getCoreSystemRateLimiterControl,
  getCoreSystemSecurityControlProfiles,
  getCoreSystemSecurityControlPersistence,
  getCoreSystemSecurityControl,
  getCoreSystemSecurityAudit,
  getCoreSystemSecurityIntelligence,
  resetCoreSystemPrivateDocCryptoControl,
  resetCoreSystemRateLimiterControl,
  restoreCoreSystemSecurityControl,
  resetCoreSystemSecurityControl,
  quarantineCoreSystemSecurityThreatProfile,
  releaseCoreSystemSecurityThreatProfile,
  updateCoreSystemPrivateDocCryptoControl,
  updateCoreSystemAppLaunchConfig,
  updateCoreSystemRateLimiterControl,
  updateCoreSystemSecurityControl
} from "../controllers/coreSystemController.js";
import { coreAuthRequired, coreRoleRequired } from "../middleware/coreAuthMiddleware.js";
import { coreSystemSecurityControlLimiter } from "../middleware/coreSecurityMiddleware.js";

const router = Router();

router.get("/architecture-plan", getCoreSystemArchitecturePlan);
router.get("/stack-options", getCoreSystemStackOptions);
router.get("/stack-readiness", getCoreSystemStackReadiness);
router.get("/app-launch-readiness", getCoreSystemAppLaunchReadiness);
router.get("/app-launch-config", coreAuthRequired, coreRoleRequired("admin"), coreSystemSecurityControlLimiter, getCoreSystemAppLaunchConfig);
router.patch("/app-launch-config", coreAuthRequired, coreRoleRequired("admin"), coreSystemSecurityControlLimiter, updateCoreSystemAppLaunchConfig);
router.get("/database-structure", getCoreSystemDatabaseStructure);
router.get("/core-systems", getCoreSystemBlueprint);
router.get("/execution-plan", getCoreSystemExecutionPlan);
router.get("/client-state/list", coreAuthRequired, listCoreClientState);
router.get("/client-state", coreAuthRequired, getCoreClientState);
router.patch("/client-state", coreAuthRequired, updateCoreClientState);
router.post("/client-state/batch-read", coreAuthRequired, batchReadCoreClientState);
router.patch("/client-state/batch-write", coreAuthRequired, batchWriteCoreClientState);
router.get("/security-audit", coreAuthRequired, coreRoleRequired("admin"), coreSystemSecurityControlLimiter, getCoreSystemSecurityAudit);
router.get("/security-intelligence", coreAuthRequired, coreRoleRequired("admin"), coreSystemSecurityControlLimiter, getCoreSystemSecurityIntelligence);
router.get("/security-control", coreAuthRequired, coreRoleRequired("admin"), coreSystemSecurityControlLimiter, getCoreSystemSecurityControl);
router.patch("/security-control", coreAuthRequired, coreRoleRequired("admin"), coreSystemSecurityControlLimiter, updateCoreSystemSecurityControl);
router.get("/security-control/profiles", coreAuthRequired, coreRoleRequired("admin"), coreSystemSecurityControlLimiter, getCoreSystemSecurityControlProfiles);
router.get("/security-control/persistence", coreAuthRequired, coreRoleRequired("admin"), coreSystemSecurityControlLimiter, getCoreSystemSecurityControlPersistence);
router.post("/security-control/profile", coreAuthRequired, coreRoleRequired("admin"), coreSystemSecurityControlLimiter, applyCoreSystemSecurityControlProfile);
router.post("/security-control/restore", coreAuthRequired, coreRoleRequired("admin"), coreSystemSecurityControlLimiter, restoreCoreSystemSecurityControl);
router.post("/security-control/reset", coreAuthRequired, coreRoleRequired("admin"), coreSystemSecurityControlLimiter, resetCoreSystemSecurityControl);
router.post("/security-intelligence/release", coreAuthRequired, coreRoleRequired("admin"), coreSystemSecurityControlLimiter, releaseCoreSystemSecurityThreatProfile);
router.post("/security-intelligence/quarantine", coreAuthRequired, coreRoleRequired("admin"), coreSystemSecurityControlLimiter, quarantineCoreSystemSecurityThreatProfile);
router.get("/rate-limiter-control", coreAuthRequired, coreRoleRequired("admin"), coreSystemSecurityControlLimiter, getCoreSystemRateLimiterControl);
router.patch("/rate-limiter-control", coreAuthRequired, coreRoleRequired("admin"), coreSystemSecurityControlLimiter, updateCoreSystemRateLimiterControl);
router.post("/rate-limiter-control/reset", coreAuthRequired, coreRoleRequired("admin"), coreSystemSecurityControlLimiter, resetCoreSystemRateLimiterControl);
router.get("/private-doc-crypto-control", coreAuthRequired, coreRoleRequired("admin"), coreSystemSecurityControlLimiter, getCoreSystemPrivateDocCryptoControl);
router.get("/private-doc-crypto-control/audit", coreAuthRequired, coreRoleRequired("admin"), coreSystemSecurityControlLimiter, listCoreSystemPrivateDocCryptoControlAudit);
router.patch("/private-doc-crypto-control", coreAuthRequired, coreRoleRequired("admin"), coreSystemSecurityControlLimiter, updateCoreSystemPrivateDocCryptoControl);
router.post("/private-doc-crypto-control/reset", coreAuthRequired, coreRoleRequired("admin"), coreSystemSecurityControlLimiter, resetCoreSystemPrivateDocCryptoControl);

export default router;
