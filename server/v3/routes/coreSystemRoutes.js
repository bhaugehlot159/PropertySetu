import { Router } from "express";
import {
  getCoreSystemArchitecturePlan,
  getCoreSystemStackReadiness,
  getCoreSystemDatabaseStructure,
  getCoreSystemExecutionPlan
} from "../controllers/coreSystemController.js";

const router = Router();

router.get("/architecture-plan", getCoreSystemArchitecturePlan);
router.get("/stack-readiness", getCoreSystemStackReadiness);
router.get("/database-structure", getCoreSystemDatabaseStructure);
router.get("/execution-plan", getCoreSystemExecutionPlan);

export default router;
