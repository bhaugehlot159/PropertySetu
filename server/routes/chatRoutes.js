import express from "express";
import { sendMessage, getConversation } from "../controllers/chatController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/send", protect, sendMessage);
router.get("/:propertyId", protect, getConversation);

export default router;