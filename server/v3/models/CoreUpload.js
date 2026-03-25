import mongoose from "mongoose";

const coreUploadSchema = new mongoose.Schema(
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
    category: {
      type: String,
      default: "misc",
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      default: "application/octet-stream",
      trim: true
    },
    sizeBytes: {
      type: Number,
      default: 0,
      min: 0
    },
    url: {
      type: String,
      default: "",
      trim: true
    },
    isPrivate: {
      type: Boolean,
      default: false
    },
    storageProvider: {
      type: String,
      default: "memory",
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

coreUploadSchema.index({ userId: 1, createdAt: -1 });
coreUploadSchema.index({ propertyId: 1, createdAt: -1 });

const CoreUpload =
  mongoose.models.CoreUpload ||
  mongoose.model("CoreUpload", coreUploadSchema, "uploads");

export default CoreUpload;
