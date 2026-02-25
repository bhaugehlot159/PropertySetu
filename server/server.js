import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// MongoDB Connect
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch((err) => console.log(err));

// Test Route
app.get("/", (req, res) => {
    res.json({ message: "PropertySetu API Running" });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
import authRoutes from "./routes/authRoutes.js";

app.use("/api/auth", authRoutes);