import { Router } from "express";
import {
  applyCoreSystemSecurityControlProfile,
  getCoreSystemArchitecturePlan,
  getCoreSystemStackOptions,
  getCoreSystemStackReadiness,
  getCoreSystemDatabaseStructure,
  getCoreSystemBlueprint,
  getCoreSystemExecutionPlan,
  getCoreSystemSecurityControlProfiles,
  getCoreSystemSecurityControlPersistence,
  getCoreSystemSecurityControl,
  getCoreSystemSecurityAudit,
  getCoreSystemSecurityIntelligence,
  restoreCoreSystemSecurityControl,
  resetCoreSystemSecurityControl,
  quarantineCoreSystemSecurityThreatProfile,
  releaseCoreSystemSecurityThreatProfile,
  updateCoreSystemSecurityControl
} from "../controllers/coreSystemController.js";
import { coreAuthRequired, coreRoleRequired } from "../middleware/coreAuthMiddleware.js";

const router = Router();

router.get("/architecture-plan", getCoreSystemArchitecturePlan);
router.get("/stack-options", getCoreSystemStackOptions);
router.get("/stack-readiness", getCoreSystemStackReadiness);
router.get("/database-structure", getCoreSystemDatabaseStructure);
router.get("/core-systems", getCoreSystemBlueprint);
router.get("/execution-plan", getCoreSystemExecutionPlan);
router.get("/security-audit", coreAuthRequired, coreRoleRequired("admin"), getCoreSystemSecurityAudit);
router.get("/security-intelligence", coreAuthRequired, coreRoleRequired("admin"), getCoreSystemSecurityIntelligence);
router.get("/security-control", coreAuthRequired, coreRoleRequired("admin"), getCoreSystemSecurityControl);
router.patch("/security-control", coreAuthRequired, coreRoleRequired("admin"), updateCoreSystemSecurityControl);
router.get("/security-control/profiles", coreAuthRequired, coreRoleRequired("admin"), getCoreSystemSecurityControlProfiles);
router.get("/security-control/persistence", coreAuthRequired, coreRoleRequired("admin"), getCoreSystemSecurityControlPersistence);
router.post("/security-control/profile", coreAuthRequired, coreRoleRequired("admin"), applyCoreSystemSecurityControlProfile);
router.post("/security-control/restore", coreAuthRequired, coreRoleRequired("admin"), restoreCoreSystemSecurityControl);
router.post("/security-control/reset", coreAuthRequired, coreRoleRequired("admin"), resetCoreSystemSecurityControl);
router.post("/security-intelligence/release", coreAuthRequired, coreRoleRequired("admin"), releaseCoreSystemSecurityThreatProfile);
router.post("/security-intelligence/quarantine", coreAuthRequired, coreRoleRequired("admin"), quarantineCoreSystemSecurityThreatProfile);

export default router;
