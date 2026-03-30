import mongoose from "mongoose";

const PRIVATE_DOC_CRYPTO_CONTROL_AUDIT_ACTIONS = [
  "approval-requested",
  "approval-confirmed",
  "approval-reset",
  "updated"
];

const corePrivateDocCryptoControlAuditSchema = new mongoose.Schema(
  {
    auditId: {
      type: String,
      required: true,
      trim: true
    },
    action: {
      type: String,
      enum: PRIVATE_DOC_CRYPTO_CONTROL_AUDIT_ACTIONS,
      required: true
    },
    actorAdminId: {
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
    canonicalPayload: {
      type: mongoose.Schema.Types.Mixed,
      default: null
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

corePrivateDocCryptoControlAuditSchema.index({ auditId: 1 }, { unique: true });
corePrivateDocCryptoControlAuditSchema.index({ chainIndex: -1, occurredAt: -1 });
corePrivateDocCryptoControlAuditSchema.index({ decisionHash: 1 });
corePrivateDocCryptoControlAuditSchema.index({ previousDecisionHash: 1 });
corePrivateDocCryptoControlAuditSchema.index({ action: 1, occurredAt: -1 });

const CorePrivateDocCryptoControlAudit =
  mongoose.models.CorePrivateDocCryptoControlAudit ||
  mongoose.model(
    "CorePrivateDocCryptoControlAudit",
    corePrivateDocCryptoControlAuditSchema,
    "privateDocCryptoControlAudits"
  );

export default CorePrivateDocCryptoControlAudit;
