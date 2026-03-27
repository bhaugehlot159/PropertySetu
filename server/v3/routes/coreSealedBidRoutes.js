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
import {
  coreSealedBidAdminDecisionLimiter,
  coreSealedBidReadLimiter,
  coreSealedBidSubmitLimiter
} from "../middleware/coreSecurityMiddleware.js";

const router = Router();

router.post("/", coreAuthRequired, coreRoleRequired("buyer", "seller"), coreSealedBidSubmitLimiter, createCoreSealedBid);
router.get("/mine", coreAuthRequired, coreSealedBidReadLimiter, listMyCoreSealedBids);
router.get("/summary", coreAuthRequired, coreRoleRequired("admin"), coreSealedBidReadLimiter, listCoreSealedBidSummary);
router.get("/admin", coreAuthRequired, coreRoleRequired("admin"), coreSealedBidReadLimiter, listAdminCoreSealedBids);
router.get("/winner/:propertyId", coreAuthRequired, coreSealedBidReadLimiter, getCoreSealedBidWinner);
router.post("/decision", coreAuthRequired, coreRoleRequired("admin"), coreSealedBidAdminDecisionLimiter, applyCoreSealedBidDecision);

export default router;
