import mongoose from "mongoose";

const ownerVerificationSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["Not Submitted", "Pending", "Approved", "Rejected"],
      default: "Not Submitted",
    },
    ownerKycRef: { type: String, default: "" },
    propertyAddressRef: { type: String, default: "" },
    verificationOfficerNote: { type: String, default: "" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: "", index: true, sparse: true },
    mobile: { type: String, trim: true, default: "", index: true, sparse: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["customer", "buyer", "tenant", "seller", "agent", "admin"],
      default: "customer",
      index: true,
    },
    city: { type: String, default: "Udaipur" },
    verified: { type: Boolean, default: false, index: true },
    ownerVerified: { type: Boolean, default: false },
    ownerVerification: { type: ownerVerificationSchema, default: () => ({}) },
    subscriptionPlan: { type: String, default: "free-basic" },
    subscriptionExpiresAt: { type: Date, default: null },
    blocked: { type: Boolean, default: false, index: true },
    lastLoginAt: { type: Date, default: null },
    otpRequestedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.index({ email: 1, role: 1 }, { sparse: true });
userSchema.index({ mobile: 1, role: 1 }, { sparse: true });

export default mongoose.models.User || mongoose.model("User", userSchema);
