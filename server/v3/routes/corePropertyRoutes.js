import { Router } from "express";
import {
  compareCoreProperties,
  createCoreProperty,
  createCorePropertyProfessional,
  decideCorePropertyModeration,
  deleteCoreProperty,
  featureCoreProperty,
  getCorePropertyPrivateDocs,
  getCorePropertyById,
  getCorePropertyTaxonomyOptions,
  listCorePropertyModerationAudit,
  listCorePropertyModerationQueue,
  listCoreProperties,
  previewCorePropertyDescription,
  updateCoreProperty,
  updateCorePropertyProfessional,
  verifyCoreProperty
} from "../controllers/corePropertyController.js";
import { createCoreVisitBookingForProperty } from "../controllers/coreVisitController.js";
import {
  coreAuthRequired,
  coreRoleRequired
} from "../middleware/coreAuthMiddleware.js";
import {
  corePropertyModerationLimiter,
  corePropertyWriteLimiter
} from "../middleware/coreSecurityMiddleware.js";

const router = Router();

router.get("/", listCoreProperties);
router.get("/taxonomy", getCorePropertyTaxonomyOptions);
router.get("/compare", compareCoreProperties);
router.post("/compare", compareCoreProperties);
router.post(
  "/auto-description",
  coreAuthRequired,
  coreRoleRequired("seller", "admin"),
  previewCorePropertyDescription
);
router.post(
  "/professional",
  coreAuthRequired,
  coreRoleRequired("seller", "admin"),
  corePropertyWriteLimiter,
  createCorePropertyProfessional
);
router.get(
  "/moderation/queue",
  coreAuthRequired,
  coreRoleRequired("admin"),
  corePropertyModerationLimiter,
  listCorePropertyModerationQueue
);
router.post(
  "/:propertyId/moderation/decision",
  coreAuthRequired,
  coreRoleRequired("admin"),
  corePropertyModerationLimiter,
  decideCorePropertyModeration
);
router.get(
  "/:propertyId/moderation/audit",
  coreAuthRequired,
  corePropertyModerationLimiter,
  listCorePropertyModerationAudit
);
router.post("/:propertyId/visit", coreAuthRequired, createCoreVisitBookingForProperty);
router.get("/:propertyId", getCorePropertyById);
router.get("/:propertyId/private-docs", coreAuthRequired, getCorePropertyPrivateDocs);
router.post(
  "/",
  coreAuthRequired,
  coreRoleRequired("seller", "admin"),
  corePropertyWriteLimiter,
  createCoreProperty
);
router.patch(
  "/:propertyId/professional",
  coreAuthRequired,
  corePropertyWriteLimiter,
  updateCorePropertyProfessional
);
router.patch("/:propertyId", coreAuthRequired, corePropertyWriteLimiter, updateCoreProperty);
router.delete("/:propertyId", coreAuthRequired, deleteCoreProperty);
router.post(
  "/:propertyId/verify",
  coreAuthRequired,
  coreRoleRequired("admin"),
  verifyCoreProperty
);
router.post(
  "/:propertyId/feature",
  coreAuthRequired,
  coreRoleRequired("admin"),
  featureCoreProperty
);

export default router;
