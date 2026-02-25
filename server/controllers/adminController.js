import Property from "../models/Property.js";

// Get All Pending Properties
export const getPendingProperties = async (req, res) => {
    try {
        const properties = await Property.find({ isApproved: false })
            .populate("owner", "name email");

        res.json(properties);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
import Notification from "../models/Notification.js";

await Notification.create({
    user: property.owner,
    title: "Property Approved",
    message: "Your property has been approved and is now live",
    type: "approval"
});

// Approve Property
export const approveProperty = async (req, res) => {
    try {

        const property = await Property.findById(req.params.id);

        if (!property) {
            return res.status(404).json({ message: "Property not found" });
        }

        property.isApproved = true;
        property.approvedBy = req.user.id;

        await property.save();

        res.json({ message: "Property Approved" });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};