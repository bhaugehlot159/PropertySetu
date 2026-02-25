import Property from "../models/Property.js";

// Make Property Featured
export const makeFeatured = async (req, res) => {
    try {

        const property = await Property.findById(req.params.id);

        if (!property) {
            return res.status(404).json({ message: "Property not found" });
        }

        // Check ownership
        if (property.owner.toString() !== req.user.id) {
            return res.status(403).json({ message: "Not authorized" });
        }

        // Only Premium or Pro
        if (!["premium", "pro"].includes(req.user.subscriptionPlan)) {
            return res.status(403).json({
                message: "Upgrade to Premium to feature property"
            });
        }

        const days = req.user.subscriptionPlan === "premium" ? 7 : 15;

        const featuredUntil = new Date();
        featuredUntil.setDate(featuredUntil.getDate() + days);

        property.isFeatured = true;
        property.featuredUntil = featuredUntil;

        await property.save();

        res.json({
            message: "Property Featured Successfully",
            featuredUntil
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};