import { Router } from "express";
import {
  createCoreReview,
  listCoreReviewsByProperty
} from "../controllers/coreReviewController.js";
import { coreAuthRequired } from "../middleware/coreAuthMiddleware.js";

const router = Router();

router.get("/:propertyId", listCoreReviewsByProperty);
router.post("/", coreAuthRequired, createCoreReview);

export default router;
