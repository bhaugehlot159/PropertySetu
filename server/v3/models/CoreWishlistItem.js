import mongoose from "mongoose";

const coreWishlistItemSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      required: true
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreProperty",
      required: true
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

coreWishlistItemSchema.index({ userId: 1, createdAt: -1 });
coreWishlistItemSchema.index({ userId: 1, propertyId: 1 }, { unique: true });

const CoreWishlistItem =
  mongoose.models.CoreWishlistItem ||
  mongoose.model("CoreWishlistItem", coreWishlistItemSchema, "wishlists");

export default CoreWishlistItem;
