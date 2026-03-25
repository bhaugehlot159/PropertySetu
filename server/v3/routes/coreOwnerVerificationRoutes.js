import { Router } from "express";
import {
  decideCoreOwnerVerification,
  listAllCoreOwnerVerification,
  listMyCoreOwnerVerification,
  requestCoreOwnerVerification
} from "../controllers/coreOwnerVerificationController.js";
import {
  coreAuthRequired,
  coreRoleRequired
} from "../middleware/coreAuthMiddleware.js";

const router = Router();

router.post("/request", coreAuthRequired, requestCoreOwnerVerification);
router.get("/me", coreAuthRequired, listMyCoreOwnerVerification);
router.get(
  "/",
  coreAuthRequired,
  coreRoleRequired("admin"),
  listAllCoreOwnerVerification
);
router.post(
  "/:requestId/decision",
  coreAuthRequired,
  coreRoleRequired("admin"),
  decideCoreOwnerVerification
);

export default router;
