import mongoose from "mongoose";

const coreReviewSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreProperty",
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      required: true
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: {
      type: String,
      required: true,
      trim: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

coreReviewSchema.index({ propertyId: 1, createdAt: -1 });

const CoreReview =
  mongoose.models.CoreReview || mongoose.model("CoreReview", coreReviewSchema, "reviews");

export default CoreReview;
