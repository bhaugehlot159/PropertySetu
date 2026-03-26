import mongoose from "mongoose";

const coreMessageSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreProperty",
      required: true
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      required: true
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      default: null
    },
    senderRole: {
      type: String,
      enum: ["buyer", "seller", "admin"],
      default: "buyer"
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    containsDirectContact: {
      type: Boolean,
      default: false
    },
    containsSpam: {
      type: Boolean,
      default: false
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

coreMessageSchema.index({ propertyId: 1, createdAt: -1 });
coreMessageSchema.index({ senderId: 1, createdAt: -1 });
coreMessageSchema.index({ receiverId: 1, createdAt: -1 });

const CoreMessage =
  mongoose.models.CoreMessage ||
  mongoose.model("CoreMessage", coreMessageSchema, "messages");

export default CoreMessage;
