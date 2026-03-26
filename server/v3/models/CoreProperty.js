import mongoose from "mongoose";

const corePropertySchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: "",
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    location: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ["buy", "rent"],
      default: "buy"
    },
    category: {
      type: String,
      enum: ["house", "plot", "commercial"],
      default: "house"
    },
    price: {
      type: Number,
      required: true,
      min: 1
    },
    size: {
      type: Number,
      required: true,
      min: 1
    },
    images: {
      type: [String],
      default: []
    },
    video: {
      type: String,
      default: ""
    },
    media: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    privateDocs: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    detailStructure: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    verification: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    virtualTour: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    visitBooking: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    videoVisit: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    aiReview: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      required: true
    },
    verified: {
      type: Boolean,
      default: false
    },
    verifiedByPropertySetu: {
      type: Boolean,
      default: false
    },
    verifiedBadge: {
      type: mongoose.Schema.Types.Mixed,
      default: {
        show: false,
        label: "Verified by PropertySetu",
        approvedAt: null,
        approvedBy: null,
        status: "Pending"
      }
    },
    featured: {
      type: Boolean,
      default: false
    },
    featuredUntil: {
      type: Date,
      default: null
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

corePropertySchema.index({ city: 1, category: 1, type: 1, verified: 1 });

const CoreProperty =
  mongoose.models.CoreProperty ||
  mongoose.model("CoreProperty", corePropertySchema, "properties");

export default CoreProperty;
