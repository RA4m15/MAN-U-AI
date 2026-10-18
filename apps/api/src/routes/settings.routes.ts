import { Router, Request, Response } from "express";
import { z } from "zod";
import { FacilitySettings, AuditEvent } from "../models";
import { isConnectedToMongo } from "../config/database";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middlewares/auth";
import { env } from "../config/env";

export const settingsRouter: Router = Router();

export const SUPPORTED_MODELS = [
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-2.0-flash",
  ...(env.GEMINI_MODEL && !["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"].includes(env.GEMINI_MODEL)
    ? [env.GEMINI_MODEL]
    : []),
];

export const DEFAULT_SETTINGS = {
  facilityName: "MAN-U-AI Heavy Operations Facility Alpha",
  timezone: "UTC+05:30 (IST)",
  selectedModel: env.GEMINI_MODEL || "gemini-3.8-flash",
  temperature: 0.2,
  topK: 5,
  similarityThreshold: 0.5,
};

let inMemorySettings = { ...DEFAULT_SETTINGS };

export function getActiveRuntimeSettings() {
  return inMemorySettings;
}

export function setActiveRuntimeSettings(s: typeof DEFAULT_SETTINGS) {
  inMemorySettings = { ...s };
}

const UpdateSettingsZodSchema = z.object({
  facilityName: z.string().min(1, "Facility name cannot be empty").max(120, "Facility name too long").optional(),
  timezone: z.string().min(1, "Timezone cannot be empty").max(80, "Timezone too long").optional(),
  selectedModel: z.string().refine((val) => SUPPORTED_MODELS.includes(val), {
    message: `Model must be one of the supported models: ${SUPPORTED_MODELS.join(", ")}`,
  }).optional(),
  temperature: z.number().min(0.0, "Temperature minimum is 0.0").max(1.0, "Temperature maximum is 1.0").optional(),
  topK: z.number().int("Top-K must be an integer").min(1, "Top-K minimum is 1").max(20, "Top-K maximum is 20").optional(),
  similarityThreshold: z.number().min(0.1, "Similarity threshold minimum is 0.1").max(0.99, "Similarity threshold maximum is 0.99").optional(),
});

// GET /settings - Retrieve current facility and AI configuration
settingsRouter.get("/", requireAuth, async (req: Request, res: Response) => {
  if (isConnectedToMongo) {
    try {
      const doc = await FacilitySettings.findOne().sort({ updatedAt: -1 });
      if (doc) {
        inMemorySettings = {
          facilityName: doc.facilityName,
          timezone: doc.timezone,
          selectedModel: doc.selectedModel,
          temperature: doc.temperature,
          topK: doc.topK,
          similarityThreshold: doc.similarityThreshold,
        };
        return res.json({
          success: true,
          data: {
            facilityName: doc.facilityName,
            timezone: doc.timezone,
            selectedModel: doc.selectedModel,
            temperature: doc.temperature,
            topK: doc.topK,
            similarityThreshold: doc.similarityThreshold,
            updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : null,
            supportedModels: SUPPORTED_MODELS,
          },
        });
      }
    } catch (err) {
      console.warn("[Settings] Error loading persistent settings from MongoDB:", err);
    }
  }

  return res.json({
    success: true,
    data: {
      ...inMemorySettings,
      updatedAt: null,
      supportedModels: SUPPORTED_MODELS,
    },
  });
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
          message: "Database connection unavailable for persisting settings changes",
        },
      });
    }

    try {
      const updateData: any = { ...parsed.data };
      if (req.user?.id) {
        const { toMongoObjectId } = await import("./documents.routes");
        const userOid = toMongoObjectId(req.user.id);
        if (userOid) {
          updateData.updatedBy = userOid;
        }
      }

      const updated = await FacilitySettings.findOneAndUpdate(
        {},
        { $set: updateData },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Update in-memory runtime cache
      inMemorySettings = {
        facilityName: updated.facilityName,
        timezone: updated.timezone,
        selectedModel: updated.selectedModel,
        temperature: updated.temperature,
        topK: updated.topK,
        similarityThreshold: updated.similarityThreshold,
      };

      // Audit log the setting change
      try {
        const { toMongoObjectId } = await import("./documents.routes");
        await AuditEvent.create({
          userId: toMongoObjectId(req.user?.id),
          userEmail: req.user?.email,
          action: "settings_update",
          resourceType: "FacilitySettings",
          resourceId: updated._id.toString(),
          details: parsed.data,
        });
      } catch (auditErr) {
        console.warn("[Settings] Failed to log audit event:", auditErr);
      }

      return res.json({
        success: true,
        data: {
          facilityName: updated.facilityName,
          timezone: updated.timezone,
          selectedModel: updated.selectedModel,
          temperature: updated.temperature,
          topK: updated.topK,
          similarityThreshold: updated.similarityThreshold,
          updatedAt: updated.updatedAt ? updated.updatedAt.toISOString() : new Date().toISOString(),
          supportedModels: SUPPORTED_MODELS,
        },
      });
    } catch (err) {
      console.error("[Settings] Mongo persist failed:", err);
      return res.status(500).json({
        success: false,
        error: {
          code: "PERSISTENCE_FAILED",
          message: "Failed to persist application settings to database",
        },
      });
    }
  }
);
