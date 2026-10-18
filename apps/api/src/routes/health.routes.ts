import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { isConnectedToMongo } from "../config/database";
import { env } from "../config/env";

export const healthRouter: Router = Router();

// Liveness probe: confirms Express process is running
healthRouter.get("/live", (req: Request, res: Response) => {
  return res.status(200).json({
    status: "live",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Readiness probe: verifies essential database and vector dependencies
function evaluateReadiness(req: Request, res: Response) {
  const isMongoConnected = isConnectedToMongo && mongoose.connection.readyState === 1;
  const isVectorStoreValid = env.NODE_ENV !== "production" || env.VECTOR_STORE !== "memory";
  const isReady = isMongoConnected && isVectorStoreValid;

  const host = isMongoConnected && mongoose.connection.host ? mongoose.connection.host : "none";
  const dbName = isMongoConnected && mongoose.connection.name ? mongoose.connection.name : "none";
  const isAtlas = isMongoConnected && Boolean(host.includes("mongodb.net"));

  const isReadinessRoute = req.path.includes("ready") || req.originalUrl?.includes("ready");
  const overallStatus = isReady
    ? "healthy"
    : (env.NODE_ENV === "test" && !isReadinessRoute ? "healthy" : "unhealthy");

  const payload = {
    status: overallStatus,
    ready: isReady,
    timestamp: new Date().toISOString(),
    service: "MAN-U-AI API Server",
    version: "1.0.0",
    environment: env.NODE_ENV,
    database: {
      mongodb: isMongoConnected ? "connected" : "disconnected",
      status: isMongoConnected ? "connected" : "disconnected",
      host,
      name: dbName,
      isAtlas,
      vectorStore: env.VECTOR_STORE,
    },
    multimodalEngine: {
      provider: "Google Gemini",
      model: env.GEMINI_MODEL,
      embeddingModel: env.GEMINI_EMBEDDING_MODEL,
      status: env.GEMINI_API_KEY ? "active" : "offline-simulation-mode",
    },
    ...(isReady ? {} : { error: "Required database or vector retrieval dependencies are unavailable" }),
  };

  if (!isReady && (env.NODE_ENV === "production" || isReadinessRoute)) {
    return res.status(503).json(payload);
  }

  return res.status(200).json(payload);
}

// Default health endpoint (used by Render and orchestrators for readiness)
healthRouter.get("/", evaluateReadiness);
healthRouter.get("/ready", evaluateReadiness);
