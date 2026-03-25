import { Router } from "express";
import {
  listMyCoreUploads,
  uploadCorePropertyMedia
} from "../controllers/coreUploadController.js";
import { coreAuthRequired } from "../middleware/coreAuthMiddleware.js";

const router = Router();

router.post("/property-media", coreAuthRequired, uploadCorePropertyMedia);
router.get("/mine", coreAuthRequired, listMyCoreUploads);

export default router;
