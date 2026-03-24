import mongoose from "mongoose";

const DEFAULT_MONGO_URI = "mongodb://127.0.0.1:27017/propertysetu_pro";

export async function connectProDatabase() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || DEFAULT_MONGO_URI;

  mongoose.set("strictQuery", true);

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000
    });

    return {
      connected: true,
      mongoUri
    };
  } catch (error) {
    return {
      connected: false,
      mongoUri,
      error
    };
  }
}
