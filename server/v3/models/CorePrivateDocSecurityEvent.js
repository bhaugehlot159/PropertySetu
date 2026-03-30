import mongoose from "mongoose";

const corePrivateDocSecurityEventSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      enum: ["access", "shield"],
      required: true
    },
    eventId: {
      type: String,
      default: "",
      trim: true
    },
    actorKey: {
      type: String,
      default: "",
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
    tokenFingerprint: {
      type: String,
      default: "",
      trim: true
    },
    privateDocHash: {
      type: String,
      default: "",
      trim: true
    },
    uploadId: {
      type: String,
      default: "",
      trim: true
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreProperty",
      default: null
    },
    shieldEnabled: {
      type: Boolean,
      default: false
    },
    shieldActive: {
      type: Boolean,
      default: false
    },
    shieldBlocked: {
      type: Boolean,
      default: false
    },
    shieldReason: {
      type: String,
      default: "",
      trim: true
    },
    shieldBlockLevel: {
      type: Number,
      default: 0,
      min: 0
    },
    shieldRemainingSec: {
      type: Number,
      default: 0,
      min: 0
    },
    triggers: {
      type: [String],
      default: []
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    occurredAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

corePrivateDocSecurityEventSchema.index({ occurredAt: -1 });
corePrivateDocSecurityEventSchema.index({ eventType: 1, occurredAt: -1 });
corePrivateDocSecurityEventSchema.index({ actorKey: 1, occurredAt: -1 });
corePrivateDocSecurityEventSchema.index({ userId: 1, occurredAt: -1 });

const CorePrivateDocSecurityEvent =
  mongoose.models.CorePrivateDocSecurityEvent ||
  mongoose.model(
    "CorePrivateDocSecurityEvent",
    corePrivateDocSecurityEventSchema,
    "privateDocSecurityEvents"
  );

export default CorePrivateDocSecurityEvent;
