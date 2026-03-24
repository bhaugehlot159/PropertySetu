import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { connectProDatabase } from "./config/proDatabase.js";
import { proRuntime } from "./config/proRuntime.js";
import { getStorageProvider } from "./config/proStorage.js";
import { proErrorHandler, proNotFound } from "./middleware/proErrorMiddleware.js";
import proHealthRoutes from "./routes/proHealthRoutes.js";
import proLegacyBridgeRoutes from "./routes/proLegacyBridgeRoutes.js";
import proPaymentRoutes from "./routes/proPaymentRoutes.js";
import proPropertyRoutes from "./routes/proPropertyRoutes.js";
import proStorageRoutes from "./routes/proStorageRoutes.js";
import coreAuthRoutes from "./v3/routes/coreAuthRoutes.js";
import coreHealthRoutes from "./v3/routes/coreHealthRoutes.js";
import corePropertyRoutes from "./v3/routes/corePropertyRoutes.js";
import coreReviewRoutes from "./v3/routes/coreReviewRoutes.js";
import coreSubscriptionRoutes from "./v3/routes/coreSubscriptionRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, ".env.pro") });
dotenv.config();

const app = express();
const port = Number(process.env.PRO_PORT || process.env.PORT || 5200);
const apiPrefix = "/api/v2";
const apiV3Prefix = "/api/v3";
const clientDistPath = path.resolve(__dirname, "../client/dist");
const legacyWebRoot = path.resolve(__dirname, "..");

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((item) => item.trim())
  : "*";

app.use(
  cors({
    origin: allowedOrigins
  })
);

app.use(express.json({ limit: "4mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "PropertySetu Professional API is running.",
    docs: `${apiPrefix}/health`
  });
});

app.use(`${apiPrefix}/health`, proHealthRoutes);
app.use(`${apiPrefix}/properties`, proPropertyRoutes);
app.use(`${apiPrefix}/payments`, proPaymentRoutes);
app.use(`${apiPrefix}/storage`, proStorageRoutes);
app.use("/api", proLegacyBridgeRoutes);
app.use("/legacy", express.static(legacyWebRoot));

app.use(`${apiV3Prefix}/health`, coreHealthRoutes);
app.use(`${apiV3Prefix}/auth`, coreAuthRoutes);
app.use(`${apiV3Prefix}/properties`, corePropertyRoutes);
app.use(`${apiV3Prefix}/reviews`, coreReviewRoutes);
app.use(`${apiV3Prefix}/subscriptions`, coreSubscriptionRoutes);

if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));

  app.get("*", (req, res, next) => {
    if (req.path.startsWith(apiPrefix) || req.path.startsWith("/api/") || req.path === "/api") {
      return next();
    }

    return res.sendFile(path.join(clientDistPath, "index.html"));
  });
}

app.use(proNotFound);
app.use(proErrorHandler);

async function bootstrap() {
  const dbInfo = await connectProDatabase();
  proRuntime.dbConnected = dbInfo.connected;
  proRuntime.dbUri = dbInfo.mongoUri;
  proRuntime.storageProvider = getStorageProvider();

  if (dbInfo.connected) {
    console.log(`[pro] MongoDB connected: ${dbInfo.mongoUri}`);
  } else {
    console.warn(
      `[pro] MongoDB unavailable (${dbInfo.mongoUri}). API will use memory mode for properties.`
    );
  }

  app.listen(port, () => {
    console.log(`[pro] Server running at http://localhost:${port}`);
    console.log(`[pro] Health endpoint: http://localhost:${port}${apiPrefix}/health`);
  });
}

bootstrap();
