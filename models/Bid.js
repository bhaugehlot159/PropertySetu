import mongoose from "mongoose";

const bidSchema = new mongoose.Schema({
    property: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Property",
        required: true
    },
    bidder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    role: {
        type: String,
        enum: ["buyer", "seller"],
        required: true
    },
    isAccepted: {
        type: Boolean,
        default: false
    },
    isRevealed: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

export default mongoose.model("Bid", bidSchema);