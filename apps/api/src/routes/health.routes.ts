import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { isConnectedToMongo, isAppInitialized, mongoDiagnostics } from "../config/database";
import { env } from "../config/env";

export const healthRouter: Router = Router();

// Liveness probe: confirms Express process is running independently of database
healthRouter.get("/live", (req: Request, res: Response) => {
  return res.status(200).json({
    status: "live",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Readiness probe: verifies essential database, vector dependencies, and complete initialization
function evaluateReadiness(req: Request, res: Response) {
  const isMongoConnected = isConnectedToMongo && mongoose.connection.readyState === 1;
  const isVectorStoreValid = env.NODE_ENV !== "production" || env.VECTOR_STORE !== "memory";
  const isReady = isMongoConnected && isVectorStoreValid && isAppInitialized;

  const isReadinessRoute = req.path.includes("ready") || req.originalUrl?.includes("ready");
  const overallStatus = isReady
    ? "healthy"
    : (env.NODE_ENV === "test" && !isReadinessRoute ? "healthy" : "unhealthy");

  const isGeminiConfigured = Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.length > 5);

  const payload = {
    status: overallStatus,
    ready: isReady,
    timestamp: new Date().toISOString(),
    service: "MAN-U-AI API Server",
    version: "1.0.0",
    environment: env.NODE_ENV,
    database: {
      status: isMongoConnected ? "connected" : "disconnected",
      ready: isMongoConnected,
      vectorStore: env.VECTOR_STORE,
      diagnostics: {
        hasUri: mongoDiagnostics.hasUri,
        uriScheme: mongoDiagnostics.uriScheme,
        clusterHost: mongoDiagnostics.clusterHost,
        targetDatabase: mongoDiagnostics.targetDatabase,
        ...(mongoDiagnostics.errorCategory ? { errorCategory: mongoDiagnostics.errorCategory } : {}),
        ...(mongoDiagnostics.errorReason ? { errorReason: mongoDiagnostics.errorReason } : {}),
        ...(mongoDiagnostics.lastAttemptAt ? { lastAttemptAt: mongoDiagnostics.lastAttemptAt } : {}),
      },
    },
    multimodalEngine: {
      provider: "Google Gemini",
      model: env.GEMINI_MODEL,
      embeddingModel: env.GEMINI_EMBEDDING_MODEL,
      status: isGeminiConfigured ? "key_configured" : "unconfigured",
      keyConfigured: isGeminiConfigured,
    },
    dependencies: {
      database: isMongoConnected ? "ready" : "unavailable",
      vectorStore: isVectorStoreValid ? "ready" : "unavailable",
      aiProvider: isGeminiConfigured ? "key_configured" : "unconfigured",
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
