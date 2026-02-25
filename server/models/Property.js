import mongoose from "mongoose";

const propertySchema = new mongoose.Schema({
    title: { type: String, required: true },
    location: { type: String, required: true },
    price: { type: Number, required: true },
    type: { type: String, enum: ["buy", "rent"], required: true },
    description: { type: String },
    image: { type: String },
    featured: { type: Boolean, default: false },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }
}, { timestamps: true });

export default mongoose.model("Property", propertySchema);

isApproved: {
    type: Boolean,
    default: false
},
approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
},