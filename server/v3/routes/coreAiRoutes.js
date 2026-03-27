import { Router } from "express";
import {
  getCoreAiDescription,
  getCoreAiFraudScan,
  getCoreAiMarketTrend,
  getCoreAiPricingSuggestion,
  getCoreAiRecommendations,
  getCoreEmiCalculator
} from "../controllers/coreAiController.js";
import { coreAiRequestLimiter } from "../middleware/coreSecurityMiddleware.js";

const router = Router();
router.use(coreAiRequestLimiter);

router.get("/market-trend", getCoreAiMarketTrend);
router.get("/emi-calculator", getCoreEmiCalculator);
router.post("/pricing-suggestion", getCoreAiPricingSuggestion);
router.post("/smart-pricing", getCoreAiPricingSuggestion);
router.post("/emi-calculator", getCoreEmiCalculator);
router.post("/description-generate", getCoreAiDescription);
router.post("/fraud-scan", getCoreAiFraudScan);
router.post("/fake-listing-detection", getCoreAiFraudScan);
router.get("/recommendations", getCoreAiRecommendations);
router.get("/similar-properties", getCoreAiRecommendations);

export default router;
