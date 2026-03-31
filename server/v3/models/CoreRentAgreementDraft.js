import mongoose from "mongoose";

const coreRentAgreementDraftSchema = new mongoose.Schema(
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
    ownerName: {
      type: String,
      required: true,
      trim: true
    },
    tenantName: {
      type: String,
      required: true,
      trim: true
    },
    propertyAddress: {
      type: String,
      required: true,
      trim: true
    },
    rentAmount: {
      type: Number,
      required: true,
      min: 0
    },
    depositAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    durationMonths: {
      type: Number,
      default: 11,
      min: 1
    },
    startDate: {
      type: String,
      default: "",
      trim: true
    },
    draftText: {
      type: String,
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

coreRentAgreementDraftSchema.index({ userId: 1, createdAt: -1 });

const CoreRentAgreementDraft =
  mongoose.models.CoreRentAgreementDraft ||
  mongoose.model(
    "CoreRentAgreementDraft",
    coreRentAgreementDraftSchema,
    "rentAgreementDrafts"
  );

export default CoreRentAgreementDraft;
