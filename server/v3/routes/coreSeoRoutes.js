import { Router } from "express";
import { getCoreCitySeoStructure } from "../controllers/coreSeoController.js";

const router = Router();

router.get("/city-structure", getCoreCitySeoStructure);

export default router;
