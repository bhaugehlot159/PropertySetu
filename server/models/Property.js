import mongoose from "mongoose";

const propertySchema = new mongoose.Schema({

    title: { 
        type: String, 
        required: true 
    },

    location: { 
        type: String, 
        required: true 
    },

    price: { 
        type: Number, 
        required: true 
    },

    type: { 
        type: String, 
        enum: ["buy", "rent"], 
        required: true 
    },

    description: { 
        type: String 
    },

    image: { 
        type: String 
    },

    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    // 🔹 Admin Approval System
    isApproved: {
        type: Boolean,
        default: false
    },

    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    // 🔹 Featured System
    isFeatured: {
        type: Boolean,
        default: false
    },

    featuredUntil: {
        type: Date
    }

}, { timestamps: true });

export default mongoose.model("Property", propertySchema);