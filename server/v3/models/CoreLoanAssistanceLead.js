import mongoose from "mongoose";

const coreLoanAssistanceLeadSchema = new mongoose.Schema(
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
    bankId: {
      type: String,
      required: true,
      trim: true
    },
    bankName: {
      type: String,
      required: true,
      trim: true
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
    locality: {
      type: String,
      default: "",
      trim: true
    },
    loanType: {
      type: String,
      default: "home-loan",
      trim: true
    },
    requestedAmount: {
      type: Number,
      required: true,
      min: 0
    },
    propertyValue: {
      type: Number,
      default: 0,
      min: 0
    },
    monthlyIncome: {
      type: Number,
      default: 0,
      min: 0
    },
    cibilScore: {
      type: Number,
      default: 0,
      min: 0
    },
    referralSource: {
      type: String,
      default: "platform",
      trim: true
    },
    commissionPercent: {
      type: Number,
      default: 0,
      min: 0
    },
    estimatedCommission: {
      type: Number,
      default: 0,
      min: 0
    },
    finalCommissionAmount: {
      type: Number,
      default: null,
      min: 0
    },
    status: {
      type: String,
      default: "lead-created",
      trim: true
    },
    notes: {
      type: String,
      default: "",
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

coreLoanAssistanceLeadSchema.index({ userId: 1, createdAt: -1 });
coreLoanAssistanceLeadSchema.index({ status: 1, createdAt: -1 });
coreLoanAssistanceLeadSchema.index({ bankId: 1, createdAt: -1 });

const CoreLoanAssistanceLead =
  mongoose.models.CoreLoanAssistanceLead ||
  mongoose.model(
    "CoreLoanAssistanceLead",
    coreLoanAssistanceLeadSchema,
    "loanAssistanceLeads"
  );

export default CoreLoanAssistanceLead;
