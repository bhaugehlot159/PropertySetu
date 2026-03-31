import mongoose from "mongoose";

const coreFranchiseRequestSchema = new mongoose.Schema(
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
    city: {
      type: String,
      required: true,
      trim: true
    },
    experienceYears: {
      type: Number,
      default: 0,
      min: 0
    },
    teamSize: {
      type: Number,
      default: 0,
      min: 0
    },
    officeAddress: {
      type: String,
      default: "",
      trim: true
    },
    investmentBudget: {
      type: Number,
      required: true,
      min: 0
    },
    initialFeePotential: {
      type: Number,
      default: 0,
      min: 0
    },
    notes: {
      type: String,
      default: "",
      trim: true
    },
    status: {
      type: String,
      default: "screening",
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

coreFranchiseRequestSchema.index({ userId: 1, createdAt: -1 });
coreFranchiseRequestSchema.index({ status: 1, createdAt: -1 });
coreFranchiseRequestSchema.index({ city: 1, createdAt: -1 });

const CoreFranchiseRequest =
  mongoose.models.CoreFranchiseRequest ||
  mongoose.model("CoreFranchiseRequest", coreFranchiseRequestSchema, "franchiseRequests");

export default CoreFranchiseRequest;
