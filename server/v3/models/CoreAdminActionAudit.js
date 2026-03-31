import mongoose from "mongoose";

const coreAdminActionAuditSchema = new mongoose.Schema(
  {
    auditId: {
      type: String,
      required: true,
      trim: true,
      unique: true
    },
    action: {
      type: String,
      required: true,
      trim: true
    },
    targetId: {
      type: String,
      default: "",
      trim: true
    },
    status: {
      type: String,
      default: "success",
      trim: true
    },
    severity: {
      type: String,
      enum: ["critical", "high", "medium", "low"],
      default: "high"
    },
    reason: {
      type: String,
      default: "",
      trim: true
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      default: null
    },
    adminRole: {
      type: String,
      default: "admin",
      trim: true
    },
    clientIp: {
      type: String,
      default: "",
      trim: true
    },
    userAgent: {
      type: String,
      default: "",
      trim: true
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

coreAdminActionAuditSchema.index({ action: 1, createdAt: -1 });
coreAdminActionAuditSchema.index({ status: 1, severity: 1, createdAt: -1 });
coreAdminActionAuditSchema.index({ targetId: 1, createdAt: -1 });
coreAdminActionAuditSchema.index({ adminId: 1, createdAt: -1 });

const CoreAdminActionAudit =
  mongoose.models.CoreAdminActionAudit ||
  mongoose.model("CoreAdminActionAudit", coreAdminActionAuditSchema, "adminActionAudits");

export default CoreAdminActionAudit;
