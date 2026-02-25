import Property from "../models/Property.js";


// ============================
// ADD PROPERTY (Seller Only)
// ============================
export const addProperty = async (req, res) => {
    try {

        if (req.user.role !== "seller") {
            return res.status(403).json({ message: "Only sellers can add property" });
        }

        const property = await Property.create({
            ...req.body,
            owner: req.user.id,
            isApproved: false,
            isFeatured: false
        });

        res.status(201).json({
            message: "Property Added Successfully. Waiting for admin approval.",
            property
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};



// ============================
// GET ALL APPROVED PROPERTIES
// ============================
export const getProperties = async (req, res) => {
    try {

        const properties = await Property.find({
            isApproved: true,
            $or: [
                { isFeatured: false },
                { isFeatured: true, featuredUntil: { $gte: new Date() } }
            ]
        })
        .sort({ isFeatured: -1, createdAt: -1 })
        .populate("owner", "name email");

        res.json(properties);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};



// ============================
// UPDATE PROPERTY (Owner Only)
// ============================
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



// ============================
// DELETE PROPERTY (Owner Only)
// ============================
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



// ============================
// ADMIN APPROVE PROPERTY
// ============================
export const approveProperty = async (req, res) => {
    try {

        if (req.user.role !== "admin") {
            return res.status(403).json({ message: "Only admin can approve property" });
        }

        const property = await Property.findByIdAndUpdate(
            req.params.id,
            {
                isApproved: true,
                approvedBy: req.user.id
            },
            { new: true }
        );

        res.json({
            message: "Property Approved Successfully",
            property
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};



// ============================
// ADMIN FEATURE PROPERTY
// ============================
export const featureProperty = async (req, res) => {
    try {

        if (req.user.role !== "admin") {
            return res.status(403).json({ message: "Only admin can feature property" });
        }

        const days = req.body.days || 7;

        const property = await Property.findByIdAndUpdate(
            req.params.id,
            {
                isFeatured: true,
                featuredUntil: new Date(Date.now() + days * 24 * 60 * 60 * 1000)
            },
            { new: true }
        );

        res.json({
            message: "Property Featured Successfully",
            property
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};