import { Router } from "express";
import {
  createCoreProperty,
  deleteCoreProperty,
  featureCoreProperty,
  getCorePropertyById,
  listCoreProperties,
  updateCoreProperty,
  verifyCoreProperty
} from "../controllers/corePropertyController.js";
import {
  coreAuthRequired,
  coreRoleRequired
} from "../middleware/coreAuthMiddleware.js";

const router = Router();

router.get("/", listCoreProperties);
router.get("/:propertyId", getCorePropertyById);
router.post("/", coreAuthRequired, coreRoleRequired("seller", "admin"), createCoreProperty);
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
