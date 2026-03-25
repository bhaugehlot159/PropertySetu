import { Router } from "express";
import {
  getCoreSystemArchitecturePlan,
  getCoreSystemStackReadiness,
  getCoreSystemDatabaseStructure
} from "../controllers/coreSystemController.js";

const router = Router();

router.get("/architecture-plan", getCoreSystemArchitecturePlan);
router.get("/stack-readiness", getCoreSystemStackReadiness);
router.get("/database-structure", getCoreSystemDatabaseStructure);

export default router;
