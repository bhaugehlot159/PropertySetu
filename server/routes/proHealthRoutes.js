import { Router } from "express";
import { getProHealth } from "../controllers/proHealthController.js";

const router = Router();

router.get("/", getProHealth);

export default router;
