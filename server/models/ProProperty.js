import mongoose from "mongoose";

const proPropertySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    price: {
      type: Number,
      required: true,
      min: 1
    },
    propertyType: {
      type: String,
      default: "Apartment",
      trim: true
    },
    bedrooms: {
      type: Number,
      default: 0,
      min: 0
    },
    bathrooms: {
      type: Number,
      default: 0,
      min: 0
    },
    areaSqft: {
      type: Number,
      default: 0,
      min: 0
    },
    description: {
      type: String,
      default: "",
      trim: true
    },
    imageUrls: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      default: "published",
      enum: ["draft", "published", "sold", "rented"]
    }
  },
  {
    timestamps: true
  }
);

proPropertySchema.index({ city: 1, propertyType: 1, status: 1 });
proPropertySchema.index({ createdAt: -1 });

const ProProperty =
  mongoose.models.ProProperty || mongoose.model("ProProperty", proPropertySchema);

export default ProProperty;
