import mongoose from "mongoose";

const coreSubscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      required: true
    },
    planName: {
      type: String,
      required: true,
      trim: true
    },
    planType: {
      type: String,
      default: "subscription",
      trim: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreProperty",
      default: null
    },
    paymentProvider: {
      type: String,
      default: "",
      trim: true
    },
    paymentOrderId: {
      type: String,
      default: "",
      trim: true
    },
    paymentId: {
      type: String,
      default: "",
      trim: true
    },
    paymentStatus: {
      type: String,
      default: "",
      trim: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
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

coreSubscriptionSchema.index({ userId: 1, endDate: -1 });

const CoreSubscription =
  mongoose.models.CoreSubscription ||
  mongoose.model("CoreSubscription", coreSubscriptionSchema, "subscriptions");

export default CoreSubscription;
