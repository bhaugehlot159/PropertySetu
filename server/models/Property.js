import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
  {
    photosCount: { type: Number, default: 0 },
    videoUploaded: { type: Boolean, default: false },
    videoDurationSec: { type: Number, default: 0 },
    floorPlanName: { type: String, default: "" },
    uploads: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { _id: false },
);

const verificationSchema = new mongoose.Schema(
  {
    ownerAadhaarPanStatus: { type: String, default: "Pending" },
    addressVerificationStatus: { type: String, default: "Pending" },
    ownerKycRef: { type: String, default: "" },
    propertyAddressRef: { type: String, default: "" },
    verificationOfficerNote: { type: String, default: "" },
    badgeEligible: { type: Boolean, default: false },
    verificationScore: { type: Number, default: 0 },
  },
  { _id: false },
);

const aiReviewSchema = new mongoose.Schema(
  {
    fraudRiskScore: { type: Number, default: 0 },
    duplicatePhotoDetected: { type: Boolean, default: false },
    duplicatePhotoCount: { type: Number, default: 0 },
    suspiciousPricingAlert: { type: Boolean, default: false },
    fakeListingSignal: { type: Boolean, default: false },
    riskReasons: { type: [String], default: [] },
    recommendation: { type: String, default: "" },
  },
  { _id: false },
);

const propertySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    city: { type: String, default: "Udaipur", index: true },
    locality: { type: String, default: "Udaipur", index: true },
    location: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true, index: true },
    negotiable: { type: Boolean, default: false },
    listingType: {
      type: String,
      enum: ["buy", "sell", "rent", "lease", "resale", "mortgage", "service"],
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: [
        "house",
        "flat",
        "villa",
        "plot",
        "land",
        "farmhouse",
        "vadi",
        "commercial",
        "shop",
        "office",
        "warehouse",
        "pg",
        "hostel",
        "agriculture",
        "other",
      ],
      required: true,
      index: true,
    },
    propertyType: { type: String, default: "" },
    builtUpArea: { type: String, default: "" },
    carpetArea: { type: String, default: "" },
    plotSize: { type: String, default: "" },
    floors: { type: String, default: "" },
    facing: { type: String, default: "" },
    furnished: { type: String, default: "" },
    bedrooms: { type: Number, default: 0 },
    bathrooms: { type: Number, default: 0 },
    parking: { type: String, default: "" },
    garden: { type: String, default: "" },
    borewell: { type: String, default: "" },
    roadWidth: { type: String, default: "" },
    landmark: { type: String, default: "" },
    image: { type: String, default: "" },
    media: { type: mediaSchema, default: () => ({}) },
    privateDocs: { type: mongoose.Schema.Types.Mixed, default: {} },
    verification: { type: verificationSchema, default: () => ({}) },
    aiReview: { type: aiReviewSchema, default: () => ({}) },
    detailStructure: { type: mongoose.Schema.Types.Mixed, default: {} },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    ownerName: { type: String, default: "" },
    status: {
      type: String,
      enum: ["Pending Approval", "Approved", "Rejected"],
      default: "Pending Approval",
      index: true,
    },
    isApproved: { type: Boolean, default: false, index: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    isFeatured: { type: Boolean, default: false, index: true },
    featuredUntil: { type: Date, default: null },
    trustScore: { type: Number, default: 0, index: true },
    reviewCount: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
  },
  { timestamps: true },
);

propertySchema.index({ city: 1, locality: 1, category: 1, listingType: 1 });

export default mongoose.models.Property || mongoose.model("Property", propertySchema);
