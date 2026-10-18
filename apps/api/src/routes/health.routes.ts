import { Router, Request, Response } from "express";
import { isConnectedToMongo } from "../config/database";
import { env } from "../config/env";

export const healthRouter: Router = Router();

healthRouter.get("/", (req: Request, res: Response) => {
  return res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "MAN-U-AI API Server",
    version: "1.0.0",
    environment: env.NODE_ENV,
    database: {
      mongodb: isConnectedToMongo ? "connected" : "fallback-active",
      vectorStore: env.VECTOR_STORE,
    },
    multimodalEngine: {
      provider: "Google Gemini",
      model: env.GEMINI_MODEL,
      embeddingModel: env.GEMINI_EMBEDDING_MODEL,
      status: env.GEMINI_API_KEY ? "active" : "offline-simulation-mode",
    },
  });
});
