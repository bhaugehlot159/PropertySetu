import { Router } from "express";
import {
  addCoreAdminCategory,
  addCoreAdminCity,
  decideCoreAdminOwnerVerification,
  getCoreAdminCategories,
  getCoreAdminCities,
  getCoreAdminCommissionAnalytics,
  getCoreAdminConfig,
  getCoreAdminFeaturedPricing,
  getCoreAdminOverview,
  listCoreAdminOwnerVerification,
  listCoreAdminProperties,
  listCoreAdminReports,
  listCoreAdminUsers,
  listCoreDocumentationRequests,
  listCoreEcosystemBookings,
  listCoreFranchiseRequests,
  listCoreLoanAssistance,
  listCoreRentAgreementDrafts,
  listCoreValuationRequests,
  removeCoreAdminCategory,
  removeCoreAdminCity,
  resolveCoreAdminReport,
  setCoreAdminFeaturedPricing,
  updateCoreAdminUserBlock,
  updateCoreDocumentationRequestStatus,
  updateCoreEcosystemBookingStatus,
  updateCoreFranchiseRequestStatus,
  updateCoreLoanAssistanceStatus
} from "../controllers/coreAdminController.js";
import {
  coreAuthRequired,
  coreRoleRequired
} from "../middleware/coreAuthMiddleware.js";

const router = Router();

router.use(coreAuthRequired, coreRoleRequired("admin"));

router.get("/properties", listCoreAdminProperties);
router.get("/overview", getCoreAdminOverview);

router.get("/config", getCoreAdminConfig);
router.get("/config/categories", getCoreAdminCategories);
router.post("/config/categories", addCoreAdminCategory);
router.delete("/config/categories", removeCoreAdminCategory);
router.delete("/config/categories/:name", removeCoreAdminCategory);
router.get("/config/cities", getCoreAdminCities);
router.post("/config/cities", addCoreAdminCity);
router.delete("/config/cities", removeCoreAdminCity);
router.delete("/config/cities/:city", removeCoreAdminCity);
router.get("/config/featured-pricing", getCoreAdminFeaturedPricing);
router.post("/config/featured-pricing", setCoreAdminFeaturedPricing);

router.get("/users", listCoreAdminUsers);
router.post("/users/:userId/:action", updateCoreAdminUserBlock);

router.get("/reports", listCoreAdminReports);
router.post("/reports/:reportId/resolve", resolveCoreAdminReport);

router.get("/commission-analytics", getCoreAdminCommissionAnalytics);

router.get("/owner-verification", listCoreAdminOwnerVerification);
router.post(
  "/owner-verification/:requestId/decision",
  decideCoreAdminOwnerVerification
);

router.get("/documentation/requests", listCoreDocumentationRequests);
router.post(
  "/documentation/requests/:requestId/status",
  updateCoreDocumentationRequestStatus
);

router.get("/loan/assistance", listCoreLoanAssistance);
router.post("/loan/assistance/:leadId/status", updateCoreLoanAssistanceStatus);

router.get("/ecosystem/bookings", listCoreEcosystemBookings);
router.post(
  "/ecosystem/bookings/:bookingId/status",
  updateCoreEcosystemBookingStatus
);

router.get("/valuation/requests", listCoreValuationRequests);
router.get("/rent-agreement/drafts", listCoreRentAgreementDrafts);

router.get("/franchise/requests", listCoreFranchiseRequests);
router.post(
  "/franchise/requests/:requestId/status",
  updateCoreFranchiseRequestStatus
);

export default router;
