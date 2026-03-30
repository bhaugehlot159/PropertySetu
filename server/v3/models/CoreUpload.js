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
    privateDocProtected: {
      type: Boolean,
      default: false
    },
    privateDocHash: {
      type: String,
      default: "",
      trim: true
    },
    privateDocAccessCount: {
      type: Number,
      default: 0,
      min: 0
    },
    privateDocAccessEpoch: {
      type: Number,
      default: 1,
      min: 1
    },
    privateDocAccessEpochRotatedAt: {
      type: Date,
      default: null
    },
    privateDocAccessEpochRotatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      default: null
    },
    privateDocAccessEpochRotateReason: {
      type: String,
      default: "",
      trim: true
    },
    privateDocEmergencyLockActive: {
      type: Boolean,
      default: false
    },
    privateDocEmergencyLockReason: {
      type: String,
      default: "",
      trim: true
    },
    privateDocEmergencyLockBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      default: null
    },
    privateDocEmergencyLockAt: {
      type: Date,
      default: null
    },
    privateDocEmergencyUnlockBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      default: null
    },
    privateDocEmergencyUnlockAt: {
      type: Date,
      default: null
    },
    privateDocLastAccessAt: {
      type: Date,
      default: null
    },
    privateDocContentHash: {
      type: String,
      default: "",
      trim: true
    },
    privateDocContentBytes: {
      type: Number,
      default: 0,
      min: 0
    },
    privateDocContentType: {
      type: String,
      default: "",
      trim: true
    },
    privateDocUpstreamEtag: {
      type: String,
      default: "",
      trim: true
    },
    privateDocUpstreamLastModified: {
      type: String,
      default: "",
      trim: true
    },
    privateDocAttestedAt: {
      type: Date,
      default: null
    },
    privateDocIntegrityStatus: {
      type: String,
      enum: ["unknown", "verified", "mismatch"],
      default: "unknown"
    },
    privateDocIntegrityMismatchAt: {
      type: Date,
      default: null
    },
    privateDocIntegrityMismatchReason: {
      type: String,
      default: "",
      trim: true
    },
    privateDocIntegrityReviewStatus: {
      type: String,
      enum: ["none", "pending", "approved", "quarantined"],
      default: "none"
    },
    privateDocIntegrityReviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      default: null
    },
    privateDocIntegrityReviewedAt: {
      type: Date,
      default: null
    },
    privateDocIntegrityReviewReason: {
      type: String,
      default: "",
      trim: true
    },
    privateDocIntegrityApprovalRequestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      default: null
    },
    privateDocIntegrityApprovalRequestedAt: {
      type: Date,
      default: null
    },
    privateDocIntegrityApprovalRequestReason: {
      type: String,
      default: "",
      trim: true
    },
    privateDocIntegrityReviewHistory: {
      type: [
        {
          action: {
            type: String,
            enum: [
              "auto-mismatch",
              "auto-verified",
              "approval-requested",
              "approval-confirmed",
              "approved",
              "quarantined",
              "reset"
            ],
            required: true
          },
          byUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "CoreUser",
            default: null
          },
          reason: {
            type: String,
            default: "",
            trim: true
          },
          previousStatus: {
            type: String,
            default: "",
            trim: true
          },
          nextStatus: {
            type: String,
            default: "",
            trim: true
          },
          at: {
            type: Date,
            default: Date.now
          }
        }
      ],
      default: []
    },
    privateDocIntegrityDecisionChainHead: {
      type: String,
      default: "",
      trim: true
    },
    privateDocIntegrityLastDecisionHash: {
      type: String,
      default: "",
      trim: true
    },
    privateDocIntegrityLastDecisionId: {
      type: String,
      default: "",
      trim: true
    },
    privateDocIntegrityLastDecisionAction: {
      type: String,
      enum: ["", "approval-requested", "approval-confirmed", "approved", "quarantined", "reset"],
      default: ""
    },
    privateDocIntegrityLastDecisionBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      default: null
    },
    privateDocIntegrityLastDecisionAt: {
      type: Date,
      default: null
    },
    privateDocIntegrityDecisionChainLength: {
      type: Number,
      default: 0,
      min: 0
    },
    privateDocIntegrityDecisionSignatureVersion: {
      type: String,
      default: "",
      trim: true
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
coreUploadSchema.index({ isPrivate: 1, privateDocIntegrityStatus: 1, privateDocIntegrityReviewStatus: 1, updatedAt: -1 });
coreUploadSchema.index({ privateDocIntegrityApprovalRequestedAt: -1 });
coreUploadSchema.index({ privateDocIntegrityDecisionChainHead: 1 });
coreUploadSchema.index({ isPrivate: 1, privateDocAccessEpoch: -1, updatedAt: -1 });
coreUploadSchema.index({ isPrivate: 1, privateDocEmergencyLockActive: 1, updatedAt: -1 });

const CoreUpload =
  mongoose.models.CoreUpload ||
  mongoose.model("CoreUpload", coreUploadSchema, "uploads");

export default CoreUpload;
