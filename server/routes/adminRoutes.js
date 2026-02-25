import express from "express";
import { getPendingProperties, approveProperty } from "../controllers/adminController.js";
import { protect } from "../middleware/authMiddleware.js";
import { adminOnly } from "../middleware/adminMiddleware.js";

const router = express.Router();

router.get("/pending-properties", protect, adminOnly, getPendingProperties);
router.put("/approve/:id", protect, adminOnly, approveProperty);

export default router;