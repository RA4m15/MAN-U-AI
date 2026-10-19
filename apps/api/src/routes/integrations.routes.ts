import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import rateLimit from "express-rate-limit";
import { v2 as cloudinary } from "cloudinary";
import { GoogleGenAI } from "@google/genai";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middlewares/auth";
import { isConnectedToMongo } from "../config/database";
import { env } from "../config/env";
import { sanitizeError } from "./settings.routes";
import { SUPPORTED_MODELS, settingsService } from "../services/settings.service";
import { modelQuotaTracker } from "../services/gemini.service";

export const integrationsRouter: Router = Router();

const ALLOWED_INTEGRATIONS = ["mongodb", "gemini", "storage", "opc_ua", "modbus", "sap", "maximo"] as const;
type IntegrationId = (typeof ALLOWED_INTEGRATIONS)[number];

// Rate limiter for connection test probes to prevent quota exhaustion
export const integrationTestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 connection tests per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many integration connection tests. Please wait before testing connections again.",
    },
  },
});

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMsg: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutMsg)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export interface CandidateModelProbeResult {
  model: string;
  supported: boolean;
  category: "success" | "quota_exhausted" | "zero_quota" | "access_denied" | "unsupported_model" | "provider_outage" | "unknown";
  httpStatus: number;
  latencyMs: number;
  retryDelaySeconds?: number;
}

export async function probeCandidateModel(ai: GoogleGenAI, model: string): Promise<CandidateModelProbeResult> {
  const supported = (SUPPORTED_MODELS as readonly string[]).includes(model);
  const startTime = Date.now();
  try {
    await withTimeout(
      ai.models.generateContent({
        model,
        contents: "health-probe",
        config: { maxOutputTokens: 1 },
      }),
      4000,
      "Model probe request timed out after 4000ms"
    );
    return {
      model,
      supported,
      category: "success",
      httpStatus: 200,
      latencyMs: Date.now() - startTime,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    const rawMsg = err instanceof Error ? err.message : String(err);
    let status = err?.status || err?.httpStatus || err?.statusCode || 500;
    let errorObj = typeof err?.error === "object" && err?.error !== null ? err.error : null;
    if (!errorObj) {
      const match = rawMsg.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const parsed = JSON.parse(match[0]);
          errorObj = parsed?.error || parsed;
        } catch {}
      }
    }
    if (errorObj?.code && typeof errorObj.code === "number") {
      status = errorObj.code;
    }

    const isZeroQuota =
      /limit:\s*0/i.test(rawMsg) ||
      errorObj?.message?.includes("limit: 0") ||
      (Array.isArray(errorObj?.details) &&
        errorObj.details.some((d: any) =>
          Array.isArray(d.violations) && d.violations.some((v: any) => v.quotaValue === "0" || v.quotaValue === 0)
        ));

    let retryDelaySeconds: number | undefined;
    if (Array.isArray(errorObj?.details)) {
      const retryInfo = errorObj.details.find((d: any) => d["@type"]?.includes("RetryInfo") || d.retryDelay);
      if (retryInfo?.retryDelay) {
        const match = String(retryInfo.retryDelay).match(/^([0-9]+(?:\.[0-9]+)?)s?$/);
        if (match) {
          retryDelaySeconds = Math.round(parseFloat(match[1]));
        }
      }
    }

    let category: CandidateModelProbeResult["category"] = "unknown";
    if (isZeroQuota) {
      category = "zero_quota";
    } else if (
      status === 429 ||
      errorObj?.status === "RESOURCE_EXHAUSTED" ||
      /RESOURCE_EXHAUSTED|quota exceeded|exceeded your current quota/i.test(rawMsg)
    ) {
      category = "quota_exhausted";
    } else if (status === 403 || /permission denied|access denied/i.test(rawMsg)) {
      category = "access_denied";
    } else if (status === 404 || /is not supported|is no longer available|model not found/i.test(rawMsg)) {
      category = "unsupported_model";
    } else if (status === 503 || /high demand|spikes in demand|overloaded|service unavailable/i.test(rawMsg)) {
      category = "provider_outage";
    }

    return {
      model,
      supported,
      category,
      httpStatus: status,
      latencyMs,
      ...(typeof retryDelaySeconds === "number" ? { retryDelaySeconds } : {}),
    };
  }
}

// GET /integrations/status - Current dynamic status of all ecosystem integrations
integrationsRouter.get("/status", requireAuth, async (req: Request, res: Response) => {
  const isMongoConnected = Boolean(isConnectedToMongo && mongoose.connection.readyState === 1);
  const isGeminiConfigured = Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.length > 5);

  const isCloudinaryActive = env.STORAGE_PROVIDER === "cloudinary";
  const hasCloudinaryCreds = Boolean(
    (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) || env.CLOUDINARY_URL
  );

  let storageStatus = "not_configured";
  let storageProtocol = `Local Filesystem Storage (${env.STORAGE_LOCAL_PATH})`;
  let storageDetails = "Local unencrypted filesystem storage adapter";

  if (isCloudinaryActive) {
    storageStatus = hasCloudinaryCreds ? "configured" : "not_configured";
    storageProtocol = "Cloudinary Raw Object API";
    storageDetails = hasCloudinaryCreds
      ? "Cloudinary secure object storage configured"
      : "Cloudinary credentials missing in environment";
  } else {
    let localDirAccessible = false;
    let localDirWritable = false;
    try {
      const uploadPath = path.resolve(process.cwd(), env.STORAGE_LOCAL_PATH);
      if (fs.existsSync(uploadPath)) {
        localDirAccessible = true;
        fs.accessSync(uploadPath, fs.constants.R_OK | fs.constants.W_OK);
        localDirWritable = true;
      }
    } catch {
      localDirWritable = false;
    }

    storageStatus = localDirAccessible && localDirWritable ? "connected" : "disconnected";
    storageProtocol = `Local Filesystem Storage (${env.STORAGE_LOCAL_PATH})`;
    storageDetails =
      localDirAccessible && localDirWritable
        ? "Local disk storage active and writable"
        : "Local disk storage directory inaccessible or read-only";
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
        protocol: "Google GenAI SDK (@google/genai)",
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

// POST /integrations/:id/test - Perform a live, verified health test for an individual integration (Admin only)
integrationsRouter.post(
  "/:id/test",
  requireAuth,
  requireRole(["admin"]),
  integrationTestLimiter,
  async (req: AuthenticatedRequest, res: Response) => {
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
          message: `MongoDB ping failed: ${sanitizeError(err)}`,
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
        const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
        let activeModel = env.GEMINI_MODEL;
        try {
          const s = await settingsService.getEffectiveSettings();
          if (s?.selectedModel) activeModel = s.selectedModel;
        } catch {}

        // Gather candidates to probe (bounded to 4 candidates max to avoid quota exhaustion)
        let candidates: string[] = [];
        if (req.body?.model && typeof req.body.model === "string") {
          candidates = [req.body.model.trim()];
        } else if (Array.isArray(req.body?.models) && req.body.models.length > 0) {
          candidates = req.body.models.map((m: any) => String(m).trim()).filter(Boolean).slice(0, 4);
        } else {
          const configuredFallbacks = env.GEMINI_FALLBACK_MODELS.split(",").map((m) => m.trim()).filter(Boolean);
          const pool = [activeModel, env.GEMINI_MODEL, ...SUPPORTED_MODELS, ...configuredFallbacks];
          for (const m of pool) {
            if (!candidates.includes(m)) {
              candidates.push(m);
            }
          }
          candidates = candidates.slice(0, 4);
        }

        const results: CandidateModelProbeResult[] = [];
        for (const candidate of candidates) {
          const resModel = await probeCandidateModel(ai, candidate);
          results.push(resModel);
          if (resModel.category === "success") {
            modelQuotaTracker.recordSuccess(candidate);
          }
        }

        const anySuccess = results.some((r) => r.category === "success");

        return res.json({
          success: true,
          status: anySuccess ? "connected" : "degraded",
          message: anySuccess
            ? `Gemini verification probe: candidate model access verified via @google/genai.`
            : `Gemini verification probe: all candidate models unavailable.`,
          primaryModel: activeModel,
          envModel: env.GEMINI_MODEL,
          results,
        });
      } catch (err: any) {
        return res.json({
          success: false,
          status: "error",
          message: `Gemini verification probe failed: ${sanitizeError(err)}`,
        });
      }
    }

    // 3. Document Storage Provider Probe
    if (id === "storage") {
      if (env.STORAGE_PROVIDER === "cloudinary") {
        const hasCreds = Boolean(
          (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) || env.CLOUDINARY_URL
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
              cloudinary.api.ping((err) => {
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
            message: `Cloudinary ping probe failed: ${sanitizeError(err)}`,
          });
        }
      } else {
        // Local storage check
        try {
          const uploadPath = path.resolve(process.cwd(), env.STORAGE_LOCAL_PATH);
          if (!fs.existsSync(uploadPath)) {
            await fs.promises.mkdir(uploadPath, { recursive: true });
          }
          await fs.promises.access(uploadPath, fs.constants.R_OK | fs.constants.W_OK);
          const canary = path.join(uploadPath, `.write-canary-${Date.now()}`);
          await fs.promises.writeFile(canary, "canary");
          await fs.promises.unlink(canary);
          return res.json({
            success: true,
            status: "connected",
            message: `Local filesystem storage directory verified and writable at '${env.STORAGE_LOCAL_PATH}'.`,
          });
        } catch (err: any) {
          return res.json({
            success: false,
            status: "error",
            message: `Local storage check failed: ${sanitizeError(err)}`,
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
  }
);
