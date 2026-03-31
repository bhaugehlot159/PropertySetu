import mongoose from "mongoose";

const coreValuationRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      default: null
    },
    userName: {
      type: String,
      default: "guest",
      trim: true
    },
    locality: {
      type: String,
      default: "Udaipur",
      trim: true
    },
    propertyType: {
      type: String,
      default: "House",
      trim: true
    },
    areaSqft: {
      type: Number,
      default: 0,
      min: 0
    },
    bedrooms: {
      type: Number,
      default: 0,
      min: 0
    },
    ageYears: {
      type: Number,
      default: 0,
      min: 0
    },
    furnished: {
      type: String,
      default: "semi",
      trim: true
    },
    expectedPrice: {
      type: Number,
      default: 0,
      min: 0
    },
    estimatedPrice: {
      type: Number,
      default: 0,
      min: 0
    },
    suggestedBand: {
      min: {
        type: Number,
        default: 0
      },
      max: {
        type: Number,
        default: 0
      }
    },
    confidence: {
      type: Number,
      default: 0
    },
    source: {
      type: String,
      default: "propertysetu-valuation-tool-v3",
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

coreValuationRequestSchema.index({ userId: 1, createdAt: -1 });
coreValuationRequestSchema.index({ createdAt: -1 });

const CoreValuationRequest =
  mongoose.models.CoreValuationRequest ||
  mongoose.model("CoreValuationRequest", coreValuationRequestSchema, "valuationRequests");

export default CoreValuationRequest;
