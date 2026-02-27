import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/authRoutes.js";
import propertyRoutes from "./routes/propertyRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import featureRoutes from "./routes/featureRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.join(__dirname, "..");

app.use(cors());
app.use(express.json());

if (process.env.MONGO_URI) {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Connected"))
    .catch((err) => console.error("MongoDB connection failed:", err.message));
} else {
  console.warn("MONGO_URI missing. Running without database connection.");
}

app.use("/api/auth", authRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/feature", featureRoutes);
app.use("/api/admin", adminRoutes);

app.get("/api", (req, res) => {
  res.json({ message: "PropertySetu API Running" });
});

app.use(express.static(webRoot));

app.get("*", (req, res) => {
  res.sendFile(path.join(webRoot, "index.html"));
});

app.listen(PORT, () => {
  console.log(`PropertySetu server running on port ${PORT}`);
});
