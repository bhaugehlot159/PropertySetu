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