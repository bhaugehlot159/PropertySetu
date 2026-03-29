import { Router } from "express";
import {
  listMyCoreUploads,
  resolveCorePrivateDocAccess,
  uploadCorePropertyMedia
} from "../controllers/coreUploadController.js";
import { coreAuthRequired, coreRoleRequired } from "../middleware/coreAuthMiddleware.js";
import {
  coreUploadPrivateDocAccessLimiter,
  coreUploadWriteLimiter
} from "../middleware/coreSecurityMiddleware.js";

const router = Router();

router.post(
  "/property-media",
  coreAuthRequired,
  coreRoleRequired("seller", "admin"),
  coreUploadWriteLimiter,
  uploadCorePropertyMedia
);
router.post(
  "/private-docs/access",
  coreAuthRequired,
  coreUploadPrivateDocAccessLimiter,
  resolveCorePrivateDocAccess
);
router.get("/mine", coreAuthRequired, listMyCoreUploads);

export default router;
