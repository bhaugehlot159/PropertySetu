import notificationRoutes from "./routes/notificationRoutes.js";

import chatRoutes from "./routes/chatRoutes.js";

import paymentRoutes from "./routes/paymentRoutes.js";

import adminRoutes from "./routes/adminRoutes.js";

import reviewRoutes from "./routes/reviewRoutes.js";

import subscriptionRoutes from "./routes/subscriptionRoutes.js";

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/authRoutes.js";
import propertyRoutes from "./routes/propertyRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
app.use("/api/admin", adminRoutes);

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// MongoDB Connect
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch((err) => console.log(err));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/notifications", notificationRoutes);

// Test Route
app.get("/", (req, res) => {
    res.json({ message: "PropertySetu API Running" });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});