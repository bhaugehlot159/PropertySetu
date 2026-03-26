import { Router } from "express";
import {
  getCoreSystemArchitecturePlan,
  getCoreSystemStackOptions,
  getCoreSystemStackReadiness,
  getCoreSystemDatabaseStructure,
  getCoreSystemBlueprint,
  getCoreSystemExecutionPlan
} from "../controllers/coreSystemController.js";

const router = Router();

router.get("/architecture-plan", getCoreSystemArchitecturePlan);
router.get("/stack-options", getCoreSystemStackOptions);
router.get("/stack-readiness", getCoreSystemStackReadiness);
router.get("/database-structure", getCoreSystemDatabaseStructure);
router.get("/core-systems", getCoreSystemBlueprint);
router.get("/execution-plan", getCoreSystemExecutionPlan);

export default router;
