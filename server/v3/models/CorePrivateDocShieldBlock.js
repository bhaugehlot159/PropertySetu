import mongoose from "mongoose";

const corePrivateDocShieldBlockSchema = new mongoose.Schema(
  {
    actorKey: {
      type: String,
      required: true,
      trim: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      default: null
    },
    role: {
      type: String,
      default: "buyer",
      trim: true
    },
    ipHash: {
      type: String,
      default: "",
      trim: true
    },
    source: {
      type: String,
      default: "",
      trim: true
    },
    reason: {
      type: String,
      default: "",
      trim: true
    },
    triggers: {
      type: [String],
      default: []
    },
    blockLevel: {
      type: Number,
      default: 1,
      min: 1
    },
    blockStartedAt: {
      type: Date,
      default: Date.now
    },
    blockUntil: {
      type: Date,
      required: true
    },
    riskScore: {
      type: Number,
      default: 0,
      min: 0
    },
    replayEvents: {
      type: Number,
      default: 0,
      min: 0
    },
    distinctHashes: {
      type: Number,
      default: 0,
      min: 0
    },
    releaseRequestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      default: null
    },
    releaseRequestedAt: {
      type: Date,
      default: null
    },
    releaseRequestReason: {
      type: String,
      default: "",
      trim: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    }
  },
  {
    timestamps: true
  }
);

corePrivateDocShieldBlockSchema.index({ actorKey: 1 }, { unique: true });
corePrivateDocShieldBlockSchema.index({ blockUntil: -1 });
corePrivateDocShieldBlockSchema.index({ userId: 1, blockUntil: -1 });
corePrivateDocShieldBlockSchema.index({ releaseRequestedAt: -1, blockUntil: -1 });

const CorePrivateDocShieldBlock =
  mongoose.models.CorePrivateDocShieldBlock ||
  mongoose.model("CorePrivateDocShieldBlock", corePrivateDocShieldBlockSchema, "privateDocShieldBlocks");

export default CorePrivateDocShieldBlock;
