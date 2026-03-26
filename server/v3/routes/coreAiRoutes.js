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
router.post("/smart-pricing", getCoreAiPricingSuggestion);
router.post("/description-generate", getCoreAiDescription);
router.post("/fraud-scan", getCoreAiFraudScan);
router.post("/fake-listing-detection", getCoreAiFraudScan);
router.get("/recommendations", getCoreAiRecommendations);
router.get("/similar-properties", getCoreAiRecommendations);

export default router;
