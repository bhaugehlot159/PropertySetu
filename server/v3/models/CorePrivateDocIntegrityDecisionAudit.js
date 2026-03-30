import mongoose from "mongoose";

const corePrivateDocIntegrityDecisionAuditSchema = new mongoose.Schema(
  {
    decisionId: {
      type: String,
      required: true,
      trim: true
    },
    uploadId: {
      type: String,
      required: true,
      trim: true
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreProperty",
      default: null
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      default: null
    },
    action: {
      type: String,
      enum: ["approval-requested", "approval-confirmed", "approved", "quarantined", "reset"],
      required: true
    },
    dualControlPhase: {
      type: String,
      enum: ["single", "request", "confirm"],
      default: "single"
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      default: null
    },
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      default: null
    },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      default: null
    },
    reviewReasonHash: {
      type: String,
      default: "",
      trim: true
    },
    reviewReasonPreview: {
      type: String,
      default: "",
      trim: true
    },
    requestIpHash: {
      type: String,
      default: "",
      trim: true
    },
    requestUserAgentHash: {
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
    canonicalPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    chainIndex: {
      type: Number,
      default: 1,
      min: 1
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

corePrivateDocIntegrityDecisionAuditSchema.index({ decisionId: 1 }, { unique: true });
corePrivateDocIntegrityDecisionAuditSchema.index({ uploadId: 1, chainIndex: -1 });
corePrivateDocIntegrityDecisionAuditSchema.index({ uploadId: 1, occurredAt: -1 });
corePrivateDocIntegrityDecisionAuditSchema.index({ decisionHash: 1 });
corePrivateDocIntegrityDecisionAuditSchema.index({ previousDecisionHash: 1 });

const CorePrivateDocIntegrityDecisionAudit =
  mongoose.models.CorePrivateDocIntegrityDecisionAudit ||
  mongoose.model(
    "CorePrivateDocIntegrityDecisionAudit",
    corePrivateDocIntegrityDecisionAuditSchema,
    "privateDocIntegrityDecisionAudits"
  );

export default CorePrivateDocIntegrityDecisionAudit;
