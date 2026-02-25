import express from "express";
import { makeFeatured } from "../controllers/featureController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.put("/:id", protect, makeFeatured);

export default router;