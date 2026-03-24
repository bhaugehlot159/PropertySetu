import { Router } from "express";
import {
  createPaymentOrder,
  verifyPaymentSignature
} from "../controllers/proPaymentController.js";

const router = Router();

router.post("/order", createPaymentOrder);
router.post("/verify", verifyPaymentSignature);

export default router;
