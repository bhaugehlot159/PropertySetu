import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

import adminRoutes from "./routes/adminRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import featureRoutes from "./routes/featureRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import propertyRoutes from "./routes/propertyRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import featureRoutes from "./routes/featureRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
codex/develop-complete-propertysetu-website-structure-ajuciq
 main

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
codex/develop-complete-propertysetu-website-structure-ajuciq
 codex/set-up-and-run-all-code

 codex/make-entire-website-runnable-with-auto-suggestions
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.join(__dirname, "..");
app.use(cors());
app.use(express.json());

codex/develop-complete-propertysetu-website-structure-ajuciq

 codex/set-up-and-run-all-code

 codex/make-entire-website-runnable-with-auto-suggestions
 main
if (process.env.MONGO_URI) {
  mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Connected"))

  codex/set-up-and-run-all-code
    .catch((err) => console.error("MongoDB connection error:", err.message));
} else {
  console.warn("MONGO_URI is not set. Running without database connection.");
}

app.use("/api/admin", adminRoutes);

    .catch((err) => console.error("MongoDB connection failed:", err.message));
} else {
  console.warn("MONGO_URI missing. Running without database connection.");
}

// MongoDB Connect
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));
codex/develop-complete-propertysetu-website-structure-ajuciq
 
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/feature", featureRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/subscription", subscriptionRoutes);
 codex/set-up-and-run-all-code

app.use("/api/reviews", reviewRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/feature", featureRoutes);
app.use("/api/admin", adminRoutes);
codex/develop-complete-propertysetu-website-structure-ajuciq

 codex/make-entire-website-runnable-with-auto-suggestions
app.get("/api", (req, res) => {
  res.json({ message: "PropertySetu API Running" });
});

app.use(express.static(webRoot));

app.get("*", (req, res) => {
  res.sendFile(path.join(webRoot, "index.html"));
});

app.listen(PORT, () => {
  console.log(`PropertySetu server running on port ${PORT}`);

app.get("/", (req, res) => {
  res.json({ message: "PropertySetu API Running" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
codex/develop-complete-propertysetu-website-structure-ajuciq

 codex/set-up-and-run-all-code
});
