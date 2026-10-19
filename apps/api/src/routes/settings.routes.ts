import { Router, Request, Response } from "express";
import { z } from "zod";
import { AuditEvent } from "../models";
import { isConnectedToMongo } from "../config/database";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middlewares/auth";
import {
  settingsService,
  SUPPORTED_MODELS,
  DEFAULT_SETTINGS,
  FacilitySettingsData,
  MODEL_CAPABILITIES,
  getModelCapabilities,
} from "../services/settings.service";

export { SUPPORTED_MODELS, DEFAULT_SETTINGS, MODEL_CAPABILITIES, getModelCapabilities };

export const settingsRouter: Router = Router();

export function getActiveRuntimeSettings(): Promise<FacilitySettingsData> {
  return settingsService.getEffectiveSettings();
}

const UpdateSettingsZodSchema = z.object({
  facilityName: z.string().min(1, "Facility name cannot be empty").max(120, "Facility name too long").optional(),
  timezone: z
    .string()
    .min(1, "Timezone cannot be empty")
    .max(80, "Timezone too long")
    .refine(
      (tz) => {
        try {
          Intl.DateTimeFormat(undefined, { timeZone: tz });
          return true;
        } catch {
          return false;
        }
      },
      {
        message:
          "Invalid time zone identifier. Must be a valid IANA time zone (e.g. 'UTC', 'Asia/Kolkata', 'America/New_York').",
      }
    )
    .optional(),
  selectedModel: z
    .string()
    .refine((val) => (SUPPORTED_MODELS as readonly string[]).includes(val), {
      message: `Model must be one of the supported models: ${SUPPORTED_MODELS.join(", ")}`,
    })
    .optional(),
  temperature: z.number().min(0.0, "Temperature minimum is 0.0").max(1.0, "Temperature maximum is 1.0").optional(),
  topK: z.number().int("Top-K must be an integer").min(1, "Top-K minimum is 1").max(20, "Top-K maximum is 20").optional(),
  similarityThreshold: z
    .number()
    .min(0.1, "Similarity threshold minimum is 0.1")
    .max(0.99, "Similarity threshold maximum is 0.99")
    .optional(),
});

export function sanitizeError(err: unknown): string {
  if (!err) return "Unknown error";
  const errCategory =
    err instanceof Error
      ? err.name
      : typeof err === "object" && err !== null && "name" in err && typeof (err as any).name === "string"
      ? (err as any).name
      : "Error";
  let msg: string;
  if (err instanceof Error) {
    msg = err.message;
  } else if (typeof err === "string") {
    msg = err;
  } else {
    try {
      msg = JSON.stringify(err);
    } catch {
      msg = String(err);
    }
  }

  // If error message is a raw JSON/RPC error payload, extract message property cleanly
  if (msg.trim().startsWith("{") && msg.includes('"message"')) {
    try {
      const parsed = JSON.parse(msg.trim());
      if (parsed.error?.message && typeof parsed.error.message === "string") {
        msg = parsed.error.message;
      }
    } catch {
      // not valid JSON, proceed with normal string redaction
    }
  }

  // Redact MongoDB connection strings containing credentials
  msg = msg.replace(/mongodb(?:\+srv)?:\/\/[^\s@]+@[^\s/]+/gi, "mongodb://[REDACTED_USER:PASS]@[REDACTED_HOST]");

  // Redact Cloudinary connection strings and signed/authenticated URLs
  msg = msg.replace(/cloudinary:\/\/[^\s@]+@[^\s/]+/gi, "cloudinary://[REDACTED_CREDENTIALS]@[REDACTED_CLOUD]");
  msg = msg.replace(/https?:\/\/[^\s]+cloudinary\.com[^\s]*/gi, "[REDACTED_CLOUDINARY_URL]");

  // Redact sensitive parameter values while capturing parameter name in group 1 and replacing entire value
  msg = msg.replace(/(api_key|apiKey|api_secret|secret|password|token|key)\s*=\s*["']?([^"'`\s&,;]+)["']?/gi, "$1=[REDACTED]");

  // Redact absolute filesystem paths (Windows C:\... and Unix /var/..., /home/..., /app/...)
  msg = msg.replace(/(?:[a-zA-Z]:\\[a-zA-Z0-9_\-\.\\]+|\/(?:var|home|usr|etc|tmp|app|srv|opt)\/[a-zA-Z0-9_\-\.\/]+)/gi, "[REDACTED_PATH]");

  // Redact standalone MongoDB Atlas cluster and shard hostnames
  msg = msg.replace(/[a-zA-Z0-9_\-\.]+\.mongodb\.net(?::\d+)?/gi, "[REDACTED_HOST]");

  // Redact internal IPv4 addresses
  msg = msg.replace(/\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?::\d+)?\b/g, "[REDACTED_IP]");

  return `[${errCategory}] ${msg}`;
}

// GET /settings - Retrieve current authoritative facility and AI configuration
settingsRouter.get("/", requireAuth, async (req: Request, res: Response) => {
  if (!isConnectedToMongo) {
    return res.status(503).json({
      success: false,
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Database connection unavailable for retrieving persistent facility settings.",
      },
    });
  }

  try {
    const settings = await settingsService.getEffectiveSettings();
    return res.json({
      success: true,
      data: {
        ...settings,
        supportedModels: SUPPORTED_MODELS,
        modelCapabilities: MODEL_CAPABILITIES,
        currentModelCapabilities: getModelCapabilities(settings.selectedModel),
      },
    });
  } catch (err) {
    console.warn("[Settings] Failed to query authoritative settings:", sanitizeError(err));
    return res.status(500).json({
      success: false,
      error: {
        code: "SETTINGS_QUERY_FAILED",
        message: "Failed to retrieve facility settings from database.",
      },
    });
  }
});

// PUT /settings - Update facility and AI configuration (Admin only)
settingsRouter.put(
  "/",
  requireAuth,
  requireRole(["admin"]),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = UpdateSettingsZodSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid settings format or bounds",
          details: parsed.error.issues,
        },
      });
    }

    if (!isConnectedToMongo) {
      return res.status(503).json({
        success: false,
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Database connection unavailable for persisting settings changes.",
        },
      });
    }

    try {
      const updated = await settingsService.updateSettings(parsed.data as any);

      // Audit log the setting change
      try {
        const { toMongoObjectId } = await import("./documents.routes");
        await AuditEvent.create({
          userId: toMongoObjectId(req.user?.id),
          userEmail: req.user?.email,
          action: "settings_update",
          resourceType: "FacilitySettings",
          resourceId: "active",
          details: parsed.data,
        });
      } catch (auditErr) {
        console.warn("[Settings] Non-fatal audit log warning:", sanitizeError(auditErr));
      }

      return res.json({
        success: true,
        data: {
          ...updated,
          supportedModels: SUPPORTED_MODELS,
          modelCapabilities: MODEL_CAPABILITIES,
          currentModelCapabilities: getModelCapabilities(updated.selectedModel),
        },
      });
    } catch (err: any) {
      console.error("[Settings] Mongo persist failed:", sanitizeError(err));
      return res.status(500).json({
        success: false,
        error: {
          code: "PERSISTENCE_FAILED",
          message: "Failed to persist application settings to database.",
        },
      });
    }
  }
);
