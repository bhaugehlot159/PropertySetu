import { Router } from "express";
import {
  getCoreSystemArchitecturePlan,
  getCoreSystemStackOptions,
  getCoreSystemStackReadiness,
  getCoreSystemDatabaseStructure,
  getCoreSystemExecutionPlan
} from "../controllers/coreSystemController.js";

const router = Router();

router.get("/architecture-plan", getCoreSystemArchitecturePlan);
router.get("/stack-options", getCoreSystemStackOptions);
router.get("/stack-readiness", getCoreSystemStackReadiness);
router.get("/database-structure", getCoreSystemDatabaseStructure);
router.get("/execution-plan", getCoreSystemExecutionPlan);

export default router;
