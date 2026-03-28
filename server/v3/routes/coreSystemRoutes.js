import { Router } from "express";
import {
  getCoreSystemArchitecturePlan,
  getCoreSystemStackOptions,
  getCoreSystemStackReadiness,
  getCoreSystemDatabaseStructure,
  getCoreSystemBlueprint,
  getCoreSystemExecutionPlan,
  getCoreSystemSecurityAudit,
  getCoreSystemSecurityIntelligence,
  quarantineCoreSystemSecurityThreatProfile,
  releaseCoreSystemSecurityThreatProfile
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
router.post("/security-intelligence/release", coreAuthRequired, coreRoleRequired("admin"), releaseCoreSystemSecurityThreatProfile);
router.post("/security-intelligence/quarantine", coreAuthRequired, coreRoleRequired("admin"), quarantineCoreSystemSecurityThreatProfile);

export default router;
