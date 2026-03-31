import { Router } from "express";
import {
  createCoreReport,
  listMyCoreReports
} from "../controllers/coreReportController.js";
import { coreAuthRequired } from "../middleware/coreAuthMiddleware.js";

const router = Router();

router.post("/", coreAuthRequired, createCoreReport);
router.get("/mine", coreAuthRequired, listMyCoreReports);

export default router;
