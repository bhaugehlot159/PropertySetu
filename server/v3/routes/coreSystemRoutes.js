import { Router } from "express";
import {
  getCoreSystemArchitecturePlan,
  getCoreSystemStackReadiness
} from "../controllers/coreSystemController.js";

const router = Router();

router.get("/architecture-plan", getCoreSystemArchitecturePlan);
router.get("/stack-readiness", getCoreSystemStackReadiness);

export default router;
