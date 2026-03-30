import mongoose from "mongoose";

const MODERATION_AUDIT_ACTIONS = [
  "auto-approved",
  "auto-pending-review",
  "auto-quarantined",
  "admin-approve",
  "admin-pending-review",
  "admin-quarantine"
];

const MODERATION_STATUSES = ["approved", "pending-review", "quarantined"];

const corePropertyModerationAuditSchema = new mongoose.Schema(
  {
    auditId: {
      type: String,
      required: true,
      trim: true
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreProperty",
      required: true
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      default: null
    },
    actorAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      default: null
    },
    action: {
      type: String,
      enum: MODERATION_AUDIT_ACTIONS,
      required: true
    },
    source: {
      type: String,
      enum: ["auto", "admin"],
      default: "auto"
    },
    statusBefore: {
      type: String,
      enum: MODERATION_STATUSES,
      required: true
    },
    statusAfter: {
      type: String,
      enum: MODERATION_STATUSES,
      required: true
    },
    fraudRiskScore: {
      type: Number,
      default: 0,
      min: 0
    },
    fakeListingSignal: {
      type: Boolean,
      default: false
    },
    reasonHash: {
      type: String,
      default: "",
      trim: true
    },
    reasonPreview: {
      type: String,
      default: "",
      trim: true
    },
    previousDecisionHash: {
      type: String,
      default: "",
      trim: true
    },
    payloadHash: {
      type: String,
      required: true,
      trim: true
    },
    signature: {
      type: String,
      required: true,
      trim: true
    },
    decisionHash: {
      type: String,
      required: true,
      trim: true
    },
    signatureKeyVersion: {
      type: String,
      default: "v1",
      trim: true
    },
    chainIndex: {
      type: Number,
      default: 1,
      min: 1
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

corePropertyModerationAuditSchema.index({ auditId: 1 }, { unique: true });
corePropertyModerationAuditSchema.index({ propertyId: 1, chainIndex: -1 });
corePropertyModerationAuditSchema.index({ propertyId: 1, occurredAt: -1 });
corePropertyModerationAuditSchema.index({ decisionHash: 1 });
corePropertyModerationAuditSchema.index({ previousDecisionHash: 1 });

const CorePropertyModerationAudit =
  mongoose.models.CorePropertyModerationAudit ||
  mongoose.model(
    "CorePropertyModerationAudit",
    corePropertyModerationAuditSchema,
    "propertyModerationAudits"
  );

export default CorePropertyModerationAudit;
