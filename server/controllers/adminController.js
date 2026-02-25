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