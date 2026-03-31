import mongoose from "mongoose";

const coreDocumentationRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      required: true
    },
    userName: {
      type: String,
      default: "User",
      trim: true
    },
    serviceId: {
      type: String,
      required: true,
      trim: true
    },
    serviceName: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      default: "agreement",
      trim: true
    },
    amount: {
      type: Number,
      default: 0,
      min: 0
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreProperty",
      default: null
    },
    city: {
      type: String,
      default: "Udaipur",
      trim: true
    },
    details: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      default: "Requested",
      trim: true
    },
    adminNote: {
      type: String,
      default: "",
      trim: true
    },
    moderationReason: {
      type: String,
      default: "",
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

coreDocumentationRequestSchema.index({ userId: 1, createdAt: -1 });
coreDocumentationRequestSchema.index({ status: 1, createdAt: -1 });
coreDocumentationRequestSchema.index({ serviceId: 1, createdAt: -1 });

const CoreDocumentationRequest =
  mongoose.models.CoreDocumentationRequest ||
  mongoose.model(
    "CoreDocumentationRequest",
    coreDocumentationRequestSchema,
    "documentationRequests"
  );

export default CoreDocumentationRequest;
