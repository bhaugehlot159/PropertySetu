import Review from "../models/Review.js";
import Property from "../models/Property.js";

// Add Review
export const addReview = async (req, res) => {
    try {

        const { propertyId, rating, comment } = req.body;

        const alreadyReviewed = await Review.findOne({
            property: propertyId,
            user: req.user.id
        });

        if (alreadyReviewed) {
            return res.status(400).json({ message: "You already reviewed this property" });
        }

        const review = await Review.create({
            property: propertyId,
            user: req.user.id,
            rating,
            comment
        });

        res.status(201).json({
            message: "Review Added",
            review
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get Reviews by Property
export const getReviews = async (req, res) => {
    try {

        const reviews = await Review.find({
            property: req.params.propertyId
        }).populate("user", "name");

        const average =
            reviews.reduce((acc, item) => acc + item.rating, 0) /
            (reviews.length || 1);

        res.json({
            reviews,
            averageRating: average.toFixed(1)
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};