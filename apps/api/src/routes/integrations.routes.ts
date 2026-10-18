import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import { requireAuth } from "../middlewares/auth";
import { isConnectedToMongo } from "../config/database";
import { env } from "../config/env";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const integrationsRouter: Router = Router();

const ALLOWED_INTEGRATIONS = ["mongodb", "gemini", "storage", "opc_ua", "modbus", "sap", "maximo"] as const;
type IntegrationId = typeof ALLOWED_INTEGRATIONS[number];

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMsg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMsg)), timeoutMs)
    ),
  ]);
}

// GET /integrations/status - Current dynamic status of all ecosystem integrations
integrationsRouter.get("/status", requireAuth, async (req: Request, res: Response) => {
  const isMongoConnected = Boolean(isConnectedToMongo && mongoose.connection.readyState === 1);
  const isGeminiConfigured = Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.length > 5);

  const isCloudinaryActive = env.STORAGE_PROVIDER === "cloudinary";
  const hasCloudinaryCreds = Boolean(
    (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) ||
    env.CLOUDINARY_URL
  );

  let storageStatus = "not_configured";
  let storageProtocol = "Local Filesystem Storage (./uploads)";
  let storageDetails = "Local unencrypted filesystem storage adapter";

  if (isCloudinaryActive) {
    storageStatus = hasCloudinaryCreds ? "configured" : "not_configured";
    storageProtocol = "Cloudinary Raw Object API";
    storageDetails = hasCloudinaryCreds
      ? "Cloudinary secure object storage configured"
      : "Cloudinary credentials missing in environment";
  } else {
    storageStatus = "connected";
    storageProtocol = "Local Filesystem Storage (./uploads)";
    storageDetails = "Local disk storage active (development/single-node)";
  }

  return res.json({
    success: true,
    data: {
      mongodb: {
        id: "mongodb",
        name: "MongoDB Database & Vector Search",
        category: "vector",
        status: isMongoConnected ? "connected" : "disconnected",
        configured: true,
        protocol: "MongoDB Wire Protocol v7.0",
        details: `Status: ${isMongoConnected ? "connected" : "disconnected"} · Store: ${env.VECTOR_STORE}`,
      },
      gemini: {
        id: "gemini",
        name: "Google Gemini Multimodal AI Engine",
        category: "ai",
        status: isGeminiConfigured ? "configured" : "not_configured",
        configured: isGeminiConfigured,
        protocol: "Google Gemini REST / gRPC",
        details: `Model: ${env.GEMINI_MODEL} · API Key: ${isGeminiConfigured ? "Configured" : "Not configured"}`,
      },
      storage: {
        id: "storage",
        name: isCloudinaryActive ? "Cloudinary Object Storage" : "Local Filesystem Storage",
        category: "storage",
        provider: env.STORAGE_PROVIDER,
        status: storageStatus,
        configured: isCloudinaryActive ? hasCloudinaryCreds : true,
        protocol: storageProtocol,
        details: storageDetails,
      },
      opc_ua: {
        id: "opc_ua",
        name: "OPC-UA Plant SCADA Gateway",
        category: "scada",
        status: "not_configured",
        configured: false,
        protocol: "opc.tcp:// (Unconfigured)",
        details: "Hardware stream not connected. No live industrial gateway attached.",
      },
      sap: {
        id: "sap",
        name: "SAP Plant Maintenance (PM)",
        category: "cmms",
        status: "not_implemented",
        configured: false,
        protocol: "SAP OData REST",
        details: "Enterprise connector unconfigured in environment.",
      },
      maximo: {
        id: "maximo",
        name: "IBM Maximo Asset Management",
        category: "cmms",
        status: "not_implemented",
        configured: false,
        protocol: "Maximo Integration Framework (MIF)",
        details: "Enterprise connector unconfigured in environment.",
      },
      modbus: {
        id: "modbus",
        name: "Modbus TCP Gateway",
        category: "scada",
        status: "not_configured",
        configured: false,
        protocol: "Port 502 TCP",
        details: "Modbus gateway unconfigured in environment.",
      },
    },
  });
});

// POST /integrations/:id/test - Perform a live, verified health test for an individual integration
integrationsRouter.post("/:id/test", requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id as IntegrationId;

  if (!ALLOWED_INTEGRATIONS.includes(id)) {
    return res.status(404).json({
      success: false,
      error: {
        code: "INVALID_INTEGRATION_ID",
        message: `Unknown integration '${id}'. Valid IDs: ${ALLOWED_INTEGRATIONS.join(", ")}`,
      },
    });
  }

  // 1. MongoDB Database Probe
  if (id === "mongodb") {
    if (!isConnectedToMongo || mongoose.connection.readyState !== 1) {
      return res.json({
        success: false,
        status: "disconnected",
        message: "MongoDB connection is currently down or disconnected.",
      });
    }

    try {
      const startTime = Date.now();
      await withTimeout(
        (async () => {
          if (mongoose.connection.db) {
            await mongoose.connection.db.admin().ping();
          }
        })(),
        5000,
        "MongoDB ping timed out after 5000ms"
      );
      const latency = Date.now() - startTime;
      return res.json({
        success: true,
        status: "connected",
        message: `MongoDB ping verified (latency: ${latency}ms).`,
      });
    } catch (err: any) {
      return res.json({
        success: false,
        status: "error",
        message: `MongoDB ping failed: ${err.message || String(err)}`,
      });
    }
  }

  // 2. Google Gemini API Probe
  if (id === "gemini") {
    if (!env.GEMINI_API_KEY || env.GEMINI_API_KEY.length <= 5) {
      return res.json({
        success: false,
        status: "not_configured",
        message: "Google Gemini API key is not configured in server environment.",
      });
    }

    try {
      const startTime = Date.now();
      const client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
      const model = client.getGenerativeModel({ model: env.GEMINI_MODEL || "gemini-1.5-flash" });

      await withTimeout(
        model.countTokens("probe-health-check"),
        5000,
        "Gemini API request timed out after 5000ms"
      );
      const latency = Date.now() - startTime;

      return res.json({
        success: true,
        status: "connected",
        message: `Gemini API connection verified (token count probe OK, latency: ${latency}ms).`,
      });
    } catch (err: any) {
      const rawMsg = err.message || String(err);
      const safeMsg = rawMsg.replace(/(?:key|apiKey)=[a-zA-Z0-9_\-]+/gi, "key=[REDACTED]");
      return res.json({
        success: false,
        status: "error",
        message: `Gemini verification probe failed: ${safeMsg}`,
      });
    }
  }

  // 3. Document Storage Provider Probe
  if (id === "storage") {
    if (env.STORAGE_PROVIDER === "cloudinary") {
      const hasCreds = Boolean(
        (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) ||
        env.CLOUDINARY_URL
      );
      if (!hasCreds) {
        return res.json({
          success: false,
          status: "not_configured",
          message: "Cloudinary credentials (cloud name, API key, secret) are not configured.",
        });
      }

      try {
        const startTime = Date.now();
        await withTimeout(
          new Promise<void>((resolve, reject) => {
            cloudinary.api.ping((err, res) => {
              if (err) return reject(err);
              resolve();
            });
          }),
          5000,
          "Cloudinary API ping timed out after 5000ms"
        );
        const latency = Date.now() - startTime;
        return res.json({
          success: true,
          status: "connected",
          message: `Cloudinary storage API connection verified (latency: ${latency}ms).`,
        });
      } catch (err: any) {
        return res.json({
          success: false,
          status: "error",
          message: `Cloudinary ping probe failed: ${err.message || String(err)}`,
        });
      }
    } else {
      // Local storage check
      try {
        const fs = await import("fs");
        const path = await import("path");
        const dir = path.resolve(process.cwd(), env.STORAGE_LOCAL_PATH);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        return res.json({
          success: true,
          status: "connected",
          message: `Local filesystem storage directory verified at ${env.STORAGE_LOCAL_PATH}.`,
        });
      } catch (err: any) {
        return res.json({
          success: false,
          status: "error",
          message: `Local storage check failed: ${err.message || String(err)}`,
        });
      }
    }
  }

  // 4. Industrial SCADA & CMMS connectors (Truthful reporting: never pretend success)
  if (id === "opc_ua" || id === "modbus") {
    return res.json({
      success: false,
      status: "not_configured",
      message: `Industrial gateway for ${id.toUpperCase()} is not configured. No hardware transmitters or PLCs attached.`,
    });
  }

  if (id === "sap" || id === "maximo") {
    return res.json({
      success: false,
      status: "not_implemented",
      message: `Enterprise CMMS integration for ${id.toUpperCase()} is not implemented in this deployment.`,
    });
  }

  return res.status(400).json({
    success: false,
    error: { code: "UNHANDLED_INTEGRATION", message: "Unhandled integration ID" },
  });
});
