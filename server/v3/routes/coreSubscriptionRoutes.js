import { Router } from "express";
import {
  createCoreSubscriptionPaymentOrder,
  createCoreSubscription,
  listAllCoreSubscriptions,
  listCoreSubscriptionPlans,
  listMyCoreSubscriptions,
  verifyCoreSubscriptionPayment
} from "../controllers/coreSubscriptionController.js";
import {
  coreAuthRequired,
  coreRoleRequired
} from "../middleware/coreAuthMiddleware.js";

const router = Router();

router.get("/plans", listCoreSubscriptionPlans);
router.post("/payment/order", coreAuthRequired, createCoreSubscriptionPaymentOrder);
router.post("/payment/verify", coreAuthRequired, verifyCoreSubscriptionPayment);
router.post("/", coreAuthRequired, createCoreSubscription);
router.get("/me", coreAuthRequired, listMyCoreSubscriptions);
router.get("/", coreAuthRequired, coreRoleRequired("admin"), listAllCoreSubscriptions);

export default router;
