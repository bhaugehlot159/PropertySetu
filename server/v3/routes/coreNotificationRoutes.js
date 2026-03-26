import { Router } from "express";
import {
  listMyCoreNotifications,
  markAllCoreNotificationsRead,
  markCoreNotificationRead
} from "../controllers/coreNotificationController.js";
import { coreAuthRequired } from "../middleware/coreAuthMiddleware.js";

const router = Router();

router.get("/mine", coreAuthRequired, listMyCoreNotifications);
router.post("/read-all", coreAuthRequired, markAllCoreNotificationsRead);
router.post("/:notificationId/read", coreAuthRequired, markCoreNotificationRead);

export default router;
