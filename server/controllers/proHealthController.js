import { proRuntime } from "../config/proRuntime.js";

export function getProHealth(_req, res) {
  res.json({
    status: "ok",
    service: "PropertySetu Pro API",
    environment: process.env.NODE_ENV || "development",
    database: proRuntime.dbConnected ? "connected" : "degraded",
    storageProvider: proRuntime.storageProvider,
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime())
  });
}
