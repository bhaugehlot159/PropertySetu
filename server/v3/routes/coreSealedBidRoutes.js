import { Router } from "express";
import {
  applyCoreSealedBidDecision,
  createCoreSealedBid,
  getCoreSealedBidWinner,
  listAdminCoreSealedBids,
  listCoreSealedBidSummary,
  listMyCoreSealedBids
} from "../controllers/coreSealedBidController.js";
import {
  coreAuthRequired,
  coreRoleRequired
} from "../middleware/coreAuthMiddleware.js";

const router = Router();

router.post("/", coreAuthRequired, coreRoleRequired("buyer", "seller"), createCoreSealedBid);
router.get("/mine", coreAuthRequired, listMyCoreSealedBids);
router.get("/summary", coreAuthRequired, coreRoleRequired("admin"), listCoreSealedBidSummary);
router.get("/admin", coreAuthRequired, coreRoleRequired("admin"), listAdminCoreSealedBids);
router.get("/winner/:propertyId", coreAuthRequired, getCoreSealedBidWinner);
router.post("/decision", coreAuthRequired, coreRoleRequired("admin"), applyCoreSealedBidDecision);

export default router;
