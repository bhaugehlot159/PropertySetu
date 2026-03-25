import mongoose from "mongoose";

const coreOwnerVerificationSchema = new mongoose.Schema(
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
    ownerAadhaarPanStatus: {
      type: String,
      default: "Submitted",
      trim: true
    },
    addressVerificationStatus: {
      type: String,
      default: "Submitted",
      trim: true
    },
    ownerAadhaarPanRef: {
      type: String,
      default: "",
      trim: true
    },
    addressVerificationRef: {
      type: String,
      default: "",
      trim: true
    },
    privateDocsUploaded: {
      type: Boolean,
      default: false
    },
    note: {
      type: String,
      default: "",
      trim: true
    },
    status: {
      type: String,
      enum: ["Pending Review", "Verified", "Rejected"],
      default: "Pending Review"
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      default: null
    },
    reviewedAt: {
      type: Date,
      default: null
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

coreOwnerVerificationSchema.index({ userId: 1, createdAt: -1 });
coreOwnerVerificationSchema.index({ status: 1, createdAt: -1 });

const CoreOwnerVerification =
  mongoose.models.CoreOwnerVerification ||
  mongoose.model(
    "CoreOwnerVerification",
    coreOwnerVerificationSchema,
    "ownerVerificationRequests"
  );

export default CoreOwnerVerification;
