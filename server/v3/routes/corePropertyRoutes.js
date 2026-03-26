import { Router } from "express";
import {
  createCoreProperty,
  createCorePropertyProfessional,
  deleteCoreProperty,
  featureCoreProperty,
  getCorePropertyPrivateDocs,
  getCorePropertyById,
  listCoreProperties,
  previewCorePropertyDescription,
  updateCoreProperty,
  updateCorePropertyProfessional,
  verifyCoreProperty
} from "../controllers/corePropertyController.js";
import {
  coreAuthRequired,
  coreRoleRequired
} from "../middleware/coreAuthMiddleware.js";

const router = Router();

router.get("/", listCoreProperties);
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
  createCorePropertyProfessional
);
router.get("/:propertyId", getCorePropertyById);
router.get("/:propertyId/private-docs", coreAuthRequired, getCorePropertyPrivateDocs);
router.post("/", coreAuthRequired, coreRoleRequired("seller", "admin"), createCoreProperty);
router.patch(
  "/:propertyId/professional",
  coreAuthRequired,
  updateCorePropertyProfessional
);
router.patch("/:propertyId", coreAuthRequired, updateCoreProperty);
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
