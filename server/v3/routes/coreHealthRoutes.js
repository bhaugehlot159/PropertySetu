import { Router } from "express";
import { getCoreHealth } from "../controllers/coreHealthController.js";

const router = Router();

router.get("/", getCoreHealth);

export default router;
