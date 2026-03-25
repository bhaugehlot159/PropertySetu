import mongoose from "mongoose";

const corePropertyCareRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      required: true
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreProperty",
      default: null
    },
    planName: {
      type: String,
      default: "care-basic",
      trim: true
    },
    amount: {
      type: Number,
      default: 0,
      min: 0
    },
    issueType: {
      type: String,
      default: "general",
      trim: true
    },
    notes: {
      type: String,
      default: "",
      trim: true
    },
    preferredDate: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: ["open", "in-progress", "completed", "cancelled"],
      default: "open"
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

corePropertyCareRequestSchema.index({ userId: 1, createdAt: -1 });
corePropertyCareRequestSchema.index({ status: 1, createdAt: -1 });

const CorePropertyCareRequest =
  mongoose.models.CorePropertyCareRequest ||
  mongoose.model(
    "CorePropertyCareRequest",
    corePropertyCareRequestSchema,
    "propertyCareRequests"
  );

export default CorePropertyCareRequest;
