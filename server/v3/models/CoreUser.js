import mongoose from "mongoose";

const coreUserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ["buyer", "seller", "admin"],
      default: "buyer"
    },
    verified: {
      type: Boolean,
      default: false
    },
    blocked: {
      type: Boolean,
      default: false
    },
    subscriptionPlan: {
      type: String,
      default: "free"
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

const CoreUser =
  mongoose.models.CoreUser || mongoose.model("CoreUser", coreUserSchema, "users");

export default CoreUser;
