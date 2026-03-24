import { Router } from "express";
import {
  addProPropertyVisit,
  approveProProperty,
  createProProperty,
  deleteProProperty,
  featureProProperty,
  getProPropertyById,
  listProProperties,
  updateProProperty
} from "../controllers/proPropertyController.js";

const router = Router();

router.get("/", listProProperties);
router.get("/:propertyId", getProPropertyById);
router.post("/", createProProperty);
router.patch("/:propertyId", updateProProperty);
router.delete("/:propertyId", deleteProProperty);
router.post("/:propertyId/visit", addProPropertyVisit);
router.post("/:propertyId/approve", approveProProperty);
router.post("/:propertyId/feature", featureProProperty);

export default router;
