import mongoose from "mongoose";

const coreSealedBidDecisionSchema = new mongoose.Schema(
  {
    action: {
      type: String,
      enum: ["accept", "reject", "reveal"],
      required: true
    },
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      required: true
    },
    byRole: {
      type: String,
      enum: ["admin"],
      default: "admin"
    },
    at: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const coreSealedBidSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreProperty",
      required: true
    },
    propertyTitle: {
      type: String,
      required: true,
      trim: true
    },
    bidderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      required: true
    },
    bidderName: {
      type: String,
      required: true,
      trim: true
    },
    bidderRole: {
      type: String,
      enum: ["buyer", "seller"],
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 1
    },
    status: {
      type: String,
      enum: ["submitted", "accepted", "rejected", "revealed"],
      default: "submitted"
    },
    sealed: {
      type: Boolean,
      default: true
    },
    adminVisible: {
      type: Boolean,
      default: true
    },
    isWinningBid: {
      type: Boolean,
      default: false
    },
    winnerRevealed: {
      type: Boolean,
      default: false
    },
    decisionByAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      default: null
    },
    decisionByAdminName: {
      type: String,
      default: "",
      trim: true
    },
    decisionAt: {
      type: Date,
      default: null
    },
    decisionHistory: {
      type: [coreSealedBidDecisionSchema],
      default: []
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

coreSealedBidSchema.index({ propertyId: 1, amount: -1, createdAt: 1 });
coreSealedBidSchema.index({ bidderId: 1, createdAt: -1 });
coreSealedBidSchema.index({ status: 1, winnerRevealed: 1, createdAt: -1 });

const CoreSealedBid =
  mongoose.models.CoreSealedBid ||
  mongoose.model("CoreSealedBid", coreSealedBidSchema, "sealedBids");

export default CoreSealedBid;
