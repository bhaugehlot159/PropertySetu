import Subscription from "../models/Subscription.js";
import User from "../models/User.js";

// Create Subscription
export const createSubscription = async (req, res) => {
    try {

        const { plan } = req.body;

        let amount = 0;
        let durationDays = 30;

        if (plan === "basic") amount = 499;
        if (plan === "premium") amount = 999;
        if (plan === "pro") amount = 1999;

        const endDate = new Date();
        endDate.setDate(endDate.getDate() + durationDays);

        const subscription = await Subscription.create({
            user: req.user.id,
            plan,
            amount,
            endDate
        });

        // Save plan in user
        await User.findByIdAndUpdate(req.user.id, {
            subscriptionPlan: plan
        });

        res.json({
            message: "Subscription Activated",
            subscription
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get My Subscription
export const getMySubscription = async (req, res) => {
    try {
        const subscription = await Subscription.findOne({
            user: req.user.id,
            status: "active"
        });

        res.json(subscription);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};