import { Router } from "express";
import {
  createCoreVisitBooking,
  listAllCoreVisitBookings,
  listMyCoreVisitBookings,
  listOwnerCoreVisitBookings,
  updateCoreVisitBookingStatus
} from "../controllers/coreVisitController.js";
import {
  coreAuthRequired,
  coreRoleRequired
} from "../middleware/coreAuthMiddleware.js";

const router = Router();

router.post("/", coreAuthRequired, createCoreVisitBooking);
router.get("/mine", coreAuthRequired, listMyCoreVisitBookings);
router.get("/owner", coreAuthRequired, listOwnerCoreVisitBookings);
router.get("/", coreAuthRequired, coreRoleRequired("admin"), listAllCoreVisitBookings);
router.post("/:visitId/status", coreAuthRequired, updateCoreVisitBookingStatus);

export default router;
