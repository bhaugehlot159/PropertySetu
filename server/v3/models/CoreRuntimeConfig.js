import mongoose from "mongoose";

const coreRuntimeConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      default: null
    },
    notes: {
      type: String,
      default: "",
      trim: true
    }
  },
  {
    timestamps: true
  }
);

const CoreRuntimeConfig =
  mongoose.models.CoreRuntimeConfig ||
  mongoose.model("CoreRuntimeConfig", coreRuntimeConfigSchema, "runtimeConfigs");

export default CoreRuntimeConfig;
