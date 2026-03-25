import { Router } from "express";
import {
  getCoreAiDescription,
  getCoreAiFraudScan,
  getCoreAiMarketTrend,
  getCoreAiPricingSuggestion,
  getCoreAiRecommendations
} from "../controllers/coreAiController.js";

const router = Router();

router.get("/market-trend", getCoreAiMarketTrend);
router.post("/pricing-suggestion", getCoreAiPricingSuggestion);
router.post("/description-generate", getCoreAiDescription);
router.post("/fraud-scan", getCoreAiFraudScan);
router.get("/recommendations", getCoreAiRecommendations);

export default router;
