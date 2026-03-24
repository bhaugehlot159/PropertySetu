import crypto from "crypto";
import {
  getProRazorpayClient,
  getRazorpayPublicKey
} from "../config/proRazorpay.js";

export async function createPaymentOrder(req, res, next) {
  try {
    const client = getProRazorpayClient();
    if (!client) {
      return res.status(503).json({
        success: false,
        message: "Razorpay keys missing in environment."
      });
    }

    const amountInRupees = Number(req.body.amountInRupees || 0);
    if (!amountInRupees || amountInRupees <= 0) {
      return res.status(400).json({
        success: false,
        message: "amountInRupees must be greater than zero."
      });
    }

    const order = await client.orders.create({
      amount: Math.round(amountInRupees * 100),
      currency: "INR",
      receipt: `ps_${Date.now()}`,
      notes: {
        propertyId: req.body.propertyId || "unknown"
      }
    });

    return res.status(201).json({
      success: true,
      keyId: getRazorpayPublicKey(),
      data: order
    });
  } catch (error) {
    return next(error);
  }
}

export function verifyPaymentSignature(req, res, next) {
  try {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return res.status(503).json({
        success: false,
        message: "Razorpay secret missing in environment."
      });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Payment verification payload incomplete."
      });
    }

    const signatureBody = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(signatureBody)
      .digest("hex");

    const isValid = expectedSignature === razorpay_signature;

    return res.status(isValid ? 200 : 400).json({
      success: isValid,
      message: isValid ? "Payment verified." : "Invalid payment signature."
    });
  } catch (error) {
    return next(error);
  }
}
