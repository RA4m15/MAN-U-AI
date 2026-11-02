import { Router, Request, Response } from "express";
import multer from "multer";
import mongoose from "mongoose";
import { requireAuth, requireRole } from "../middlewares/auth";
import { MediaModel } from "../models";
import { storageService } from "../services/storage.service";
import {
  ingestMediaEvidence,
  MEDIA_LIMITS,
} from "../services/media.service";
import type { MediaDTO, UserRole } from "@man-u-ai/shared";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MEDIA_LIMITS.MAX_VIDEO_SIZE_BYTES, // 100MB ceiling
  },
});

export const mediaRouter = Router();

function toMediaDTO(doc: any): MediaDTO {
  return {
    id: doc._id.toString(),
    title: doc.title,
    description: doc.description,
    mediaType: doc.mediaType,
    originalFilename: doc.originalFilename,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    durationSeconds: doc.durationSeconds,
    equipmentId: doc.equipmentId ? doc.equipmentId.toString() : undefined,
    uploadedById: doc.uploadedById.toString(),
    status: doc.status,
    processingError: doc.processingError,
    technicalFindings: doc.technicalFindings,
    extractedText: doc.extractedText,
    tags: doc.tags || [],
    createdAt: doc.createdAt ? doc.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : new Date().toISOString(),
  };
}

/**
 * POST /api/v1/media/ingest
 * Ingests machine evidence (photos and videos) with real multimodal inspection & vector indexing.
 */
mediaRouter.post(
  "/ingest",
  requireAuth,
  requireRole(["admin", "manager", "engineer", "operator"]),
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: {
            code: "FILE_REQUIRED",
            message: "No media file uploaded. An image or video file is required.",
          },
        });
      }

      const { title, description, equipmentId, tags } = req.body;
      if (!title || typeof title !== "string" || title.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: "TITLE_REQUIRED",
            message: "Media title is required.",
          },
        });
      }

      // Parse tags if provided as JSON string or comma-separated string
      let parsedTags: string[] = [];
      if (typeof tags === "string") {
        try {
          const parsed = JSON.parse(tags);
          if (Array.isArray(parsed)) parsedTags = parsed;
        } catch {
          parsedTags = tags.split(",").map((t) => t.trim()).filter(Boolean);
        }
      } else if (Array.isArray(tags)) {
        parsedTags = tags.map(String);
      }

      const user = (req as any).user;
      const userRole = user.role as UserRole;
      const userId = user.id;

      const mediaRecord = await ingestMediaEvidence({
        buffer: req.file.buffer,
        originalFilename: req.file.originalname,
        mimeType: req.file.mimetype,
        title: title.trim(),
        description: description ? String(description).trim() : "",
        equipmentId: equipmentId ? String(equipmentId).trim() : undefined,
        tags: parsedTags,
        userId,
        userRole,
      });

      return res.status(201).json({
        success: true,
        data: toMediaDTO(mediaRecord),
      });
    } catch (err: any) {
      const statusCode = err?.statusCode || 500;
      const code = err?.code || "MEDIA_INGESTION_FAILED";
      const message = err?.message || "Failed to ingest media evidence.";

      return res.status(statusCode).json({
        success: false,
        error: { code, message },
      });
    }
  }
);

/**
 * GET /api/v1/media
 * Lists captured machine media evidence.
 */
mediaRouter.get(
  "/",
  requireAuth,
  requireRole(["admin", "manager", "engineer", "operator"]),
  async (req: Request, res: Response) => {
    try {
      const { equipmentId, mediaType } = req.query;
      const query: Record<string, any> = {};

      if (equipmentId && typeof equipmentId === "string" && mongoose.Types.ObjectId.isValid(equipmentId)) {
        query.equipmentId = new mongoose.Types.ObjectId(equipmentId);
      }
      if (mediaType && (mediaType === "image" || mediaType === "video")) {
        query.mediaType = mediaType;
      }

      const records = await MediaModel.find(query).sort({ createdAt: -1 }).limit(100);
      return res.json({
        success: true,
        data: records.map(toMediaDTO),
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: { code: "FETCH_FAILED", message: err.message },
      });
    }
  }
);

/**
 * GET /api/v1/media/:id
 * Fetches metadata and processing findings for a specific media item.
 */
mediaRouter.get(
  "/:id",
  requireAuth,
  requireRole(["admin", "manager", "engineer", "operator"]),
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          error: { code: "INVALID_ID", message: "Invalid media ID format." },
        });
      }

      const record = await MediaModel.findById(id);
      if (!record) {
        return res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Media evidence record not found." },
        });
      }

      return res.json({
        success: true,
        data: toMediaDTO(record),
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: { code: "FETCH_FAILED", message: err.message },
      });
    }
  }
);

/**
 * GET /api/v1/media/:id/file
 * Securely streams the stored image or video file.
 */
mediaRouter.get(
  "/:id/file",
  requireAuth,
  requireRole(["admin", "manager", "engineer", "operator"]),
  async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          error: { code: "INVALID_ID", message: "Invalid media ID format." },
        });
      }

      const record = await MediaModel.findById(id);
      if (!record) {
        return res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Media evidence record not found." },
        });
      }

      res.setHeader("Content-Type", record.mimeType);
      res.setHeader("Content-Length", record.sizeBytes);
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${encodeURIComponent(record.originalFilename)}"`
      );

      const stream = await storageService.getFileStream(record.storagePath, record.storageProvider);
      (stream as any).pipe(res);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: { code: "STREAM_FAILED", message: err.message },
      });
    }
  }
);

