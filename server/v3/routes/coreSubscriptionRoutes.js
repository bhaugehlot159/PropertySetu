import { Router } from "express";
import {
  createCoreSubscription,
  listAllCoreSubscriptions,
  listMyCoreSubscriptions
} from "../controllers/coreSubscriptionController.js";
import {
  coreAuthRequired,
  coreRoleRequired
} from "../middleware/coreAuthMiddleware.js";

const router = Router();

router.post("/", coreAuthRequired, createCoreSubscription);
router.get("/me", coreAuthRequired, listMyCoreSubscriptions);
router.get("/", coreAuthRequired, coreRoleRequired("admin"), listAllCoreSubscriptions);

export default router;
