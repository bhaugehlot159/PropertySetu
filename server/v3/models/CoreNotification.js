import mongoose from "mongoose";

const coreNotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      default: "general",
      trim: true
    },
    isRead: {
      type: Boolean,
      default: false
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
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

coreNotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

const CoreNotification =
  mongoose.models.CoreNotification ||
  mongoose.model("CoreNotification", coreNotificationSchema, "notifications");

export default CoreNotification;
