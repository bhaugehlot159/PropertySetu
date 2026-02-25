import razorpay from "../config/razorpay.js";
import crypto from "crypto";
import Subscription from "../models/Subscription.js";
import User from "../models/User.js";

// Create Order
export const createOrder = async (req, res) => {
    try {

        const { plan } = req.body;

        let amount = 0;
        if (plan === "basic") amount = 499;
        if (plan === "premium") amount = 999;
        if (plan === "pro") amount = 1999;

        const options = {
            amount: amount * 100,
            currency: "INR",
            receipt: `receipt_${Date.now()}`
        };

        const order = await razorpay.orders.create(options);

        res.json({ order });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Verify Payment
export const verifyPayment = async (req, res) => {
    try {
import Notification from "../models/Notification.js";

await Notification.create({
    user: req.user.id,
    title: "Payment Successful",
    message: "Your subscription has been activated",
    type: "payment"
});
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            plan
        } = req.body;

        const body = razorpay_order_id + "|" + razorpay_payment_id;

        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest("hex");

        if (expectedSignature === razorpay_signature) {

            const endDate = new Date();
            endDate.setDate(endDate.getDate() + 30);

            await Subscription.create({
                user: req.user.id,
                plan,
                amount: plan === "basic" ? 499 : plan === "premium" ? 999 : 1999,
                endDate
            });

            await User.findByIdAndUpdate(req.user.id, {
                subscriptionPlan: plan
            });

            return res.json({ message: "Payment Verified & Subscription Activated" });
        }

        res.status(400).json({ message: "Invalid Signature" });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};