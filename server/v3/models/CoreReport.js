import mongoose from "mongoose";

const coreReportSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreProperty",
      default: null
    },
    propertyTitle: {
      type: String,
      default: "",
      trim: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      required: true
    },
    reason: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      default: "open",
      trim: true
    },
    resolvedAt: {
      type: Date,
      default: null
    },
    resolvedReason: {
      type: String,
      default: "",
      trim: true
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
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

coreReportSchema.index({ status: 1, createdAt: -1 });
coreReportSchema.index({ userId: 1, createdAt: -1 });
coreReportSchema.index({ propertyId: 1, createdAt: -1 });

const CoreReport =
  mongoose.models.CoreReport ||
  mongoose.model("CoreReport", coreReportSchema, "reports");

export default CoreReport;
