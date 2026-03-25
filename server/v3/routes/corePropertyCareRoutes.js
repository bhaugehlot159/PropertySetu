import { Router } from "express";
import {
  createCorePropertyCareRequest,
  listAllCorePropertyCareRequests,
  listMyCorePropertyCareRequests,
  updateCorePropertyCareStatus
} from "../controllers/corePropertyCareController.js";
import {
  coreAuthRequired,
  coreRoleRequired
} from "../middleware/coreAuthMiddleware.js";

const router = Router();

router.post("/requests", coreAuthRequired, createCorePropertyCareRequest);
router.get("/requests/me", coreAuthRequired, listMyCorePropertyCareRequests);
router.get(
  "/requests",
  coreAuthRequired,
  coreRoleRequired("admin"),
  listAllCorePropertyCareRequests
);
router.post(
  "/requests/:requestId/status",
  coreAuthRequired,
  coreRoleRequired("admin"),
  updateCorePropertyCareStatus
);

export default router;
