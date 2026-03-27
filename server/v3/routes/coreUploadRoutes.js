import { Router } from "express";
import {
  listMyCoreUploads,
  uploadCorePropertyMedia
} from "../controllers/coreUploadController.js";
import { coreAuthRequired, coreRoleRequired } from "../middleware/coreAuthMiddleware.js";
import { coreUploadWriteLimiter } from "../middleware/coreSecurityMiddleware.js";

const router = Router();

router.post(
  "/property-media",
  coreAuthRequired,
  coreRoleRequired("seller", "admin"),
  coreUploadWriteLimiter,
  uploadCorePropertyMedia
);
router.get("/mine", coreAuthRequired, listMyCoreUploads);

export default router;
