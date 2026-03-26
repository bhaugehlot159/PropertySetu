import mongoose from "mongoose";

const coreVisitBookingSchema = new mongoose.Schema(
  {
    propertyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreProperty",
      required: true
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      required: true
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CoreUser",
      required: true
    },
    preferredAt: {
      type: Date,
      required: true
    },
    note: {
      type: String,
      default: "",
      trim: true
    },
    status: {
      type: String,
      enum: ["requested", "confirmed", "completed", "cancelled", "rejected"],
      default: "requested"
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

coreVisitBookingSchema.index({ customerId: 1, createdAt: -1 });
coreVisitBookingSchema.index({ ownerId: 1, createdAt: -1 });
coreVisitBookingSchema.index({ propertyId: 1, createdAt: -1 });

const CoreVisitBooking =
  mongoose.models.CoreVisitBooking ||
  mongoose.model("CoreVisitBooking", coreVisitBookingSchema, "visitBookings");

export default CoreVisitBooking;
