import Property from "../models/Property.js";

export const searchProperties = async (req, res) => {
    try {
        const { city, type, minPrice, maxPrice, keyword } = req.query;

        let query = {};

        if (city) query.location = { $regex: city, $options: "i" };

        if (type) query.type = type;

        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = Number(minPrice);
            if (maxPrice) query.price.$lte = Number(maxPrice);
        }

        if (keyword) {
            query.title = { $regex: keyword, $options: "i" };
        }

        const properties = await Property.find(query);

        res.json(properties);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};