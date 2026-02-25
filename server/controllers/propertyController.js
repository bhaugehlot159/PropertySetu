import Property from "../models/Property.js";

// ADD PROPERTY (Seller Only)
export const addProperty = async (req, res) => {
    try {

        if (req.user.role !== "seller") {
            return res.status(403).json({ message: "Only sellers can add property" });
        }

        const property = await Property.create({
            ...req.body,
            owner: req.user.id
        });

        res.status(201).json({ message: "Property Added Successfully", property });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET ALL PROPERTIES
export const getProperties = async (req, res) => {
    try {
        const properties = await Property.find().populate("owner", "name");
        res.json(properties);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
// UPDATE PROPERTY (Owner Only)
export const updateProperty = async (req, res) => {
    try {
        const property = await Property.findById(req.params.id);

        if (!property) {
            return res.status(404).json({ message: "Property not found" });
        }

        if (property.owner.toString() !== req.user.id) {
            return res.status(403).json({ message: "Not authorized" });
        }

        const updated = await Property.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        res.json({ message: "Property Updated", updated });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// DELETE PROPERTY (Owner Only)
export const deleteProperty = async (req, res) => {
    try {
        const property = await Property.findById(req.params.id);

        if (!property) {
            return res.status(404).json({ message: "Property not found" });
        }

        if (property.owner.toString() !== req.user.id) {
            return res.status(403).json({ message: "Not authorized" });
        }

        await property.deleteOne();

        res.json({ message: "Property Deleted Successfully" });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};