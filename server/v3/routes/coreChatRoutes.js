import { Router } from "express";
import {
  getCoreChatWhatsappLink,
  listCoreMessagesByProperty,
  listMyCoreMessages,
  sendCoreMessage
} from "../controllers/coreChatController.js";
import { coreAuthRequired } from "../middleware/coreAuthMiddleware.js";

const router = Router();

router.get("/mine", coreAuthRequired, listMyCoreMessages);
router.get("/:propertyId/whatsapp-link", coreAuthRequired, getCoreChatWhatsappLink);
router.get("/:propertyId", coreAuthRequired, listCoreMessagesByProperty);
router.post("/send", coreAuthRequired, sendCoreMessage);

export default router;
