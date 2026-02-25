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

    listingType: {
    type: String,
    enum: [
        "buy",
        "sell",
        "rent",
        "lease",
        "mortgage",        // girvi
        "service"          // property care / maintenance
    ],
    required: true
},

category: {
    type: String,
    enum: [
        "house",
        "villa",
        "apartment",
        "plot",
        "land",
        "farmhouse",
        "commercial",
        "shop",
        "office",
        "warehouse",
        "pg",
        "hostel",
        "agriculture",
        "other"
    ],
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