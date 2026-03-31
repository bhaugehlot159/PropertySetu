import mongoose from "mongoose";

const coreServicePartnerBookingSchema = new mongoose.Schema(
  {
    serviceId: {
      type: String,
      required: true,
      trim: true
    },
    serviceName: {
      type: String,
      required: true,
      trim: true
    },
    serviceFee: {
      type: Number,
      default: 0,
      min: 0
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      required: true
    },
    userName: {
      type: String,
      default: "User",
      trim: true
    },
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreProperty",
      default: null
    },
    city: {
      type: String,
      default: "Udaipur",
      trim: true
    },
    locality: {
      type: String,
      default: "",
      trim: true
    },
    preferredDate: {
      type: String,
      default: "",
      trim: true
    },
    budget: {
      type: Number,
      default: 0,
      min: 0
    },
    contactName: {
      type: String,
      default: "",
      trim: true
    },
    contactPhone: {
      type: String,
      default: "",
      trim: true
    },
    notes: {
      type: String,
      default: "",
      trim: true
    },
    status: {
      type: String,
      default: "Requested",
      trim: true
    },
    adminNote: {
      type: String,
      default: "",
      trim: true
    },
    moderationReason: {
      type: String,
      default: "",
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

coreServicePartnerBookingSchema.index({ userId: 1, createdAt: -1 });
coreServicePartnerBookingSchema.index({ status: 1, createdAt: -1 });
coreServicePartnerBookingSchema.index({ serviceId: 1, createdAt: -1 });

const CoreServicePartnerBooking =
  mongoose.models.CoreServicePartnerBooking ||
  mongoose.model(
    "CoreServicePartnerBooking",
    coreServicePartnerBookingSchema,
    "servicePartnerBookings"
  );

export default CoreServicePartnerBooking;
