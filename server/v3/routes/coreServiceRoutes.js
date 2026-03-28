import { Router } from "express";
import {
  createCoreDocumentationRequest,
  createCoreEcosystemBooking,
  createCoreFranchiseRequest,
  createCoreLoanAssistance,
  createCoreRentAgreementDraft,
  createCoreValuationEstimate,
  listCoreDocumentationRequestsForUser,
  listCoreDocumentationServices,
  listCoreEcosystemBookingsForUser,
  listCoreEcosystemServices,
  listCoreFranchiseRegions,
  listCoreFranchiseRequestsForUser,
  listCoreLoanAssistanceForUser,
  listCoreLoanPartnerBanks,
  listCoreRentAgreementDraftsForUser,
  listCoreValuationRequestsForAdmin
} from "../controllers/coreServiceController.js";
import {
  coreAuthOptional,
  coreAuthRequired,
  coreRoleRequired
} from "../middleware/coreAuthMiddleware.js";

const router = Router();

router.get("/documentation/services", listCoreDocumentationServices);
router.post("/documentation/requests", coreAuthRequired, createCoreDocumentationRequest);
router.get("/documentation/requests", coreAuthRequired, listCoreDocumentationRequestsForUser);

router.get("/loan/banks", listCoreLoanPartnerBanks);
router.post("/loan/assistance", coreAuthRequired, createCoreLoanAssistance);
router.get("/loan/assistance", coreAuthRequired, listCoreLoanAssistanceForUser);

router.get("/ecosystem/services", listCoreEcosystemServices);
router.post("/ecosystem/bookings", coreAuthRequired, createCoreEcosystemBooking);
router.get("/ecosystem/bookings", coreAuthRequired, listCoreEcosystemBookingsForUser);

router.post("/valuation/estimate", coreAuthOptional, createCoreValuationEstimate);
router.get(
  "/valuation/requests",
  coreAuthRequired,
  coreRoleRequired("admin"),
  listCoreValuationRequestsForAdmin
);

router.post("/rent-agreement/generate", coreAuthRequired, createCoreRentAgreementDraft);
router.get("/rent-agreement/drafts", coreAuthRequired, listCoreRentAgreementDraftsForUser);

router.get("/franchise/regions", listCoreFranchiseRegions);
router.post("/franchise/requests", coreAuthRequired, createCoreFranchiseRequest);
router.get("/franchise/requests", coreAuthRequired, listCoreFranchiseRequestsForUser);

export default router;
