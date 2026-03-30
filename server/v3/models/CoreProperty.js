import mongoose from "mongoose";
import {
  CORE_PROPERTY_CATEGORY_VALUES,
  CORE_PROPERTY_TYPE_VALUES
} from "../config/corePropertyTaxonomy.js";

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
      enum: CORE_PROPERTY_TYPE_VALUES,
      default: "buy"
    },
    category: {
      type: String,
      enum: CORE_PROPERTY_CATEGORY_VALUES,
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
    bhk: {
      type: Number,
      default: 0,
      min: 0
    },
    furnishing: {
      type: String,
      enum: ["furnished", "semi", "unfurnished", ""],
      default: ""
    },
    constructionStatus: {
      type: String,
      enum: ["ready-to-move", "under-construction", ""],
      default: ""
    },
    loanAvailable: {
      type: Boolean,
      default: false
    },
    coordinates: {
      lat: {
        type: Number,
        default: null
      },
      lng: {
        type: Number,
        default: null
      }
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
corePropertySchema.index({ bhk: 1, furnishing: 1, constructionStatus: 1, loanAvailable: 1 });
corePropertySchema.index({ "aiReview.moderationStatus": 1, createdAt: -1 });
corePropertySchema.index({ ownerId: 1, "aiReview.moderationStatus": 1, updatedAt: -1 });

const CoreProperty =
  mongoose.models.CoreProperty ||
  mongoose.model("CoreProperty", corePropertySchema, "properties");

export default CoreProperty;
