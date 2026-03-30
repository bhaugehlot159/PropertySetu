import { Router } from "express";
import {
  listCorePrivateDocSecurityEvents,
  listMyCoreUploads,
  releaseCorePrivateDocSecurityShield,
  resolveCorePrivateDocAccess,
  streamCorePrivateDoc,
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
router.get(
  "/private-docs/stream",
  coreAuthRequired,
  coreUploadPrivateDocAccessLimiter,
  streamCorePrivateDoc
);
router.post(
  "/private-docs/stream",
  coreAuthRequired,
  coreUploadPrivateDocAccessLimiter,
  streamCorePrivateDoc
);
router.get(
  "/private-docs/security/events",
  coreAuthRequired,
  coreRoleRequired("admin"),
  listCorePrivateDocSecurityEvents
);
router.post(
  "/private-docs/security/release",
  coreAuthRequired,
  coreRoleRequired("admin"),
  releaseCorePrivateDocSecurityShield
);
router.get("/mine", coreAuthRequired, listMyCoreUploads);

export default router;
