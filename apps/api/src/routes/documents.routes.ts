import mongoose from "mongoose";
import { Router, Request, Response } from "express";
import multer from "multer";
import { DocumentModel, DocumentChunk, DocumentPermission, ProcessingJob, AuditEvent } from "../models";

import { storageService } from "../services/storage.service";
import { pdfService, isValidPdfSignature } from "../services/pdf.service";
import { geminiService } from "../services/gemini.service";
import { vectorService } from "../services/vector.service";
import { isConnectedToMongo } from "../config/database";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middlewares/auth";
import { uploadLimiter } from "../middlewares/rateLimiters";
import { emitDocumentProgress, emitDocumentStatus, emitAuditEvent } from "../index";
import { sanitizeError } from "./settings.routes";
import { extractStructuredErrorInfo, logStructuredError } from "../utils/errorReporting";
import { env } from "../config/env";

export const documentsRouter: Router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowed = ["application/pdf", "image/png", "image/jpeg", "image/tiff", "application/octet-stream"];
    if (allowed.includes(file.mimetype) || file.originalname.endsWith(".pdf")) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type. Only PDF and high-res technical diagrams are accepted."));
    }
  },
});

import crypto from "crypto";

export function toMongoObjectId(idStr: string | undefined): mongoose.Types.ObjectId {
  if (!idStr) return new mongoose.Types.ObjectId();
  if (mongoose.Types.ObjectId.isValid(idStr) && idStr.length === 24) {
    return new mongoose.Types.ObjectId(idStr);
  }
  const hex = crypto.createHash("md5").update(idStr).digest("hex").slice(0, 24);
  return new mongoose.Types.ObjectId(hex);
}

// Authorization helper for document access
export async function isUserAuthorizedForDocument(
  userId: string | undefined,
  role: string | undefined,
  docId: string
): Promise<{ authorized: boolean; doc?: any }> {
  // Fail closed immediately if MongoDB is disconnected
  if (!isConnectedToMongo) {
    return { authorized: false, doc: null };
  }
  if (!mongoose.Types.ObjectId.isValid(docId)) {
    return { authorized: false, doc: null };
  }

  try {
    const doc = await DocumentModel.findById(docId);
    if (!doc) {
      return { authorized: false, doc: null };
    }

    if (role === "admin") {
      return { authorized: true, doc };
    }

    const userOid = toMongoObjectId(userId);
    if (doc.uploadedById && (doc.uploadedById.toString() === userId || doc.uploadedById.toString() === userOid.toString())) {
      return { authorized: true, doc };
    }

    const permission = await DocumentPermission.findOne({
      documentId: doc._id,
      $or: [{ userId: userOid }, ...(role ? [{ role }] : [])],
      canRead: true,
    });

    if (permission) {
      return { authorized: true, doc };
    }

    return { authorized: false, doc };
  } catch (err) {
    console.error("[Documents] Database error checking document authorization (failing closed):", err);
    return { authorized: false };
  }
}

// GET /documents - List all documents permitted for current user
documentsRouter.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!isConnectedToMongo) {
    return res.status(503).json({
      success: false,
      error: { code: "SERVICE_UNAVAILABLE", message: "Database connection unavailable for document listing" },
    });
  }

  try {
    let query: any = {};
    if (req.user?.role !== "admin") {
      const userId = req.user?.id;
      const userOid = toMongoObjectId(userId);
      const orConditions: any[] = [{ userId: userOid }];
      if (req.user?.role) {
        orConditions.push({ role: req.user.role });
      }

      const permittedDocs = await DocumentPermission.find({
        $or: orConditions,
        canRead: true,
      }).select("documentId");

      const permittedDocIds = permittedDocs.map((p) => p.documentId);
      query = {
        $or: [
          { uploadedById: userOid },
          { _id: { $in: permittedDocIds } },
        ],
      };
    }

    const docs = await DocumentModel.find(query).sort({ createdAt: -1 }).limit(100);
    return res.json({
      success: true,
      data: docs.map((d) => ({
        id: d._id.toString(),
        title: d.title,
        revision: d.revision,
        filename: d.filename,
        sizeBytes: d.sizeBytes,
        status: d.status,
        pageCount: d.pageCount,
        tags: d.tags,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[Documents] DB fetch error:", err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to retrieve documents from database" },
    });
  }
});

// GET /documents/:id - Get single document details (authorized only)
documentsRouter.get("/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const { authorized, doc } = await isUserAuthorizedForDocument(req.user?.id, req.user?.role, id);
  if (!doc) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Document not found" },
    });
  }
  if (!authorized) {
    return res.status(403).json({
      success: false,
      error: { code: "FORBIDDEN", message: "Access to document denied" },
    });
  }

  return res.json({
    success: true,
    data: {
      id: doc._id.toString(),
      title: doc.title,
      revision: doc.revision,
      filename: doc.filename,
      sizeBytes: doc.sizeBytes,
      status: doc.status,
      pageCount: doc.pageCount,
      tags: doc.tags,
      equipment: doc.equipmentId,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    },
  });
});

// GET /documents/:id/chunks - Get all indexed chunks for this document (authorized only)
documentsRouter.get("/:id/chunks", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const { authorized, doc } = await isUserAuthorizedForDocument(req.user?.id, req.user?.role, id);
  if (!doc) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Document not found" },
    });
  }
  if (!authorized) {
    return res.status(403).json({
      success: false,
      error: { code: "FORBIDDEN", message: "Access to document chunks denied" },
    });
  }

  const chunks = await DocumentChunk.find({ documentId: id }).sort({ page: 1 });
  return res.json({
    success: true,
    data: chunks.map((c) => ({
      id: c._id.toString(),
      page: c.page,
      section: c.section,
      text: c.text,
      tokenCount: c.tokenCount,
    })),
  });
});

// GET /documents/:id/file - Stream raw document PDF (authorized only)
documentsRouter.get("/:id/file", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const { authorized, doc } = await isUserAuthorizedForDocument(req.user?.id, req.user?.role, id);
  if (!doc) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "File not found" },
    });
  }
  if (!authorized) {
    return res.status(403).json({
      success: false,
      error: { code: "FORBIDDEN", message: "Access to document file denied" },
    });
  }

  if (doc.storagePath) {
    res.setHeader("Content-Type", doc.mimeType || "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${doc.filename}"`);
    try {
      const stream = await storageService.getFileStream(doc.storagePath, doc.storageProvider);
      (stream as any).on("error", (streamErr: unknown) => {
        console.error(`[Documents] Stream transmission error for document ${id}:`, sanitizeError(streamErr));
        if (!res.headersSent) {
          res.status(502).json({
            success: false,
            error: { code: "STORAGE_STREAM_FAILED", message: "Failed to stream document from storage" },
          });
        } else {
          res.destroy();
        }
      });
      return (stream as any).pipe(res);
    } catch (streamErr: any) {
      console.error(`[Documents] Error streaming document ${id}:`, sanitizeError(streamErr));
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "File not found in storage" },
      });
    }
  }

  return res.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: "File not found in storage" },
  });
});

// POST /documents/upload - Upload and initiate ingestion
documentsRouter.post(
  "/upload",
  uploadLimiter,
  requireAuth,
  requireRole(["admin", "engineer"]),
  upload.single("file"),
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: "NO_FILE", message: "No document file was provided" },
      });
    }

    if (!isValidPdfSignature(req.file.buffer)) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_FILE_SIGNATURE", message: "File does not match a valid PDF file signature (%PDF-)" },
      });
    }

    if (!isConnectedToMongo) {
      return res.status(503).json({
        success: false,
        error: { code: "DATABASE_UNAVAILABLE", message: "Database connection unavailable for document ingestion" },
      });
    }

    const title = req.body.title || req.file.originalname.replace(/\.[^/.]+$/, "");
    const revision = req.body.revision || "Rev 1.0";
    const tags = req.body.tags
      ? typeof req.body.tags === "string"
        ? req.body.tags.split(",").map((t: string) => t.trim())
        : req.body.tags
      : [];
    const equipmentId = req.body.equipmentId || undefined;

    let savedStoragePath: string | null = null;
    let savedStorageProvider: string | undefined = undefined;
    let documentCreated = false;
    try {
      // 1. Save privately in storage service
      const storageResult = await storageService.saveFile(req.file.originalname, req.file.buffer);
      savedStoragePath = storageResult.storagePath;
      savedStorageProvider = storageResult.storageProvider;

      let docId: string;
      try {
        const createdDoc = await DocumentModel.create({
          title,
          revision,
          filename: req.file.originalname,
          storagePath: storageResult.storagePath,
          storageProvider: storageResult.storageProvider,
          mimeType: req.file.mimetype,
          sizeBytes: storageResult.sizeBytes,
          status: "processing",
          tags,
          equipmentId,
          uploadedById: toMongoObjectId(req.user?.id),
        });
        docId = createdDoc._id.toString();
        documentCreated = true;
      } catch (dbErr) {
        // Safe partial-failure cleanup: storage succeeded but DB persistence failed
        const dbInfo = extractStructuredErrorInfo(dbErr, "database_persistence", req);
        logStructuredError(dbInfo, {
          title,
          revision,
          filename: req.file?.originalname,
          sizeBytes: storageResult?.sizeBytes,
          storagePath: savedStoragePath,
        });

        if (savedStoragePath) {
          try {
            await storageService.deleteFile(savedStoragePath, savedStorageProvider);
          } catch (cleanErr) {
            console.warn("[Documents] Failed to delete orphaned file after DB failure:", sanitizeError(cleanErr));
          }
        }
        return res.status(503).json({
          success: false,
          error: {
            code: "DATABASE_PERSISTENCE_FAILED",
            message: "Failed to persist document metadata to database",
            details: dbInfo.sanitizedMessage,
            stage: dbInfo.stage,
            requestId: dbInfo.requestId,
          },
        });
      }

      // Non-blocking audit logging: preserve valid document and file if audit log write fails
      try {
        await AuditEvent.create({
          userId: toMongoObjectId(req.user?.id),
          userEmail: req.user?.email,
          action: "doc_upload",
          resourceType: "Document",
          resourceId: docId,
          details: { title, revision, sizeBytes: storageResult.sizeBytes },
        });
      } catch (auditErr) {
        console.warn("[Documents] Non-fatal audit log failure on upload, preserving document and file:", auditErr);
      }

      // Non-blocking real-time audit event emission to administrators
      try {
        emitAuditEvent({
          id: `aud-${Date.now()}`,
          action: "doc_upload",
          actorName: req.user?.name || "User",
          description: `Uploaded document: "${title}" (${revision})`,
          timestamp: new Date().toISOString(),
        });
      } catch (auditEmitErr) {
        console.warn("[Documents] Non-fatal emitAuditEvent failure on upload:", auditEmitErr);
      }

      const uploaderId = req.user?.id;
      // Notify clients that ingestion has started
      try {
        emitDocumentProgress(docId, 10, "Extracting text and structural metadata...", uploaderId);
      } catch (progErr) {
        console.warn("[Documents] Non-fatal emitDocumentProgress failure on upload:", progErr);
      }

      // 2. Trigger asynchronous background ingestion pipeline
      processDocumentAsync(docId, title, revision, req.file.buffer, uploaderId).catch((err) =>
        console.error(`[Ingestion Error for ${docId}]:`, err)
      );

      return res.status(202).json({
        success: true,
        data: {
          id: docId,
          title,
          revision,
          status: "processing",
          message: "Document uploaded and background ingestion pipeline started",
        },
      });
    } catch (err: unknown) {
      if (savedStoragePath && !documentCreated) {
        try {
          await storageService.deleteFile(savedStoragePath, savedStorageProvider);
        } catch (cleanErr) {
          console.warn("[Documents] Failed to delete orphaned file after general error:", sanitizeError(cleanErr));
        }
      }

      const info = extractStructuredErrorInfo(err, "storage_upload", req);
      logStructuredError(info, {
        filename: req.file?.originalname,
        sizeBytes: req.file?.size,
        mimetype: req.file?.mimetype,
        storageProvider: env.STORAGE_PROVIDER,
      });

      return res.status(info.httpStatus).json({
        success: false,
        error: {
          code: info.errorCode,
          message: "Failed to store or process document",
          details: info.sanitizedMessage,
          stage: info.stage,
          requestId: info.requestId,
        },
      });
    }
  }
);

// DELETE /documents/:id - Delete document and vector index chunks (owner or admin only)
documentsRouter.delete(
  "/:id",
  requireAuth,
  requireRole(["admin", "engineer"]),
  async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params.id);
    if (isConnectedToMongo) {
      try {
        const doc = await DocumentModel.findById(id);
        if (doc) {
          const userOidStr = toMongoObjectId(req.user?.id).toString();
          const docUploaderStr = doc.uploadedById?.toString();
          if (req.user?.role !== "admin" && docUploaderStr !== req.user?.id && docUploaderStr !== userOidStr) {
            return res.status(403).json({
              success: false,
              error: { code: "FORBIDDEN", message: "Only administrators or the document owner may delete this document" },
            });
          }

          try {
            await storageService.deleteFile(doc.storagePath, doc.storageProvider);
          } catch (e) {
            console.warn("[Documents] File cleanup warning:", e);
          }
          await DocumentChunk.deleteMany({ documentId: id });
          await DocumentModel.findByIdAndDelete(id);

          await AuditEvent.create({
            userId: req.user?.id,
            userEmail: req.user?.email,
            action: "doc_delete",
            resourceType: "Document",
            resourceId: id,
            details: { title: doc.title },
          });

          return res.json({ success: true, data: { message: "Document deleted successfully" } });
        }
      } catch (err) {
        console.warn("[Documents] Delete error:", err);
      }
    }

    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Document not found" },
    });
  }
);

// GET /documents/:id/status - Status polling (authorized only)
documentsRouter.get("/:id/status", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const { authorized, doc } = await isUserAuthorizedForDocument(req.user?.id, req.user?.role, id);
  if (!doc) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Document not found" },
    });
  }
  if (!authorized) {
    return res.status(403).json({
      success: false,
      error: { code: "FORBIDDEN", message: "Access to document status denied" },
    });
  }

  return res.json({
    success: true,
    data: {
      id: doc._id.toString(),
      status: doc.status,
      pageCount: doc.pageCount,
    },
  });
});

async function processDocumentAsync(docId: string, title: string, revision: string, buffer: Buffer, uploaderId?: string) {
  try {
    emitDocumentProgress(docId, 30, "Extracting text and tables via PDF parser...", uploaderId);
    const extraction = await pdfService.extractAndChunk(buffer, title);

    emitDocumentProgress(docId, 60, `Generating vector embeddings for ${extraction.chunks.length} chunks...`, uploaderId);

    // Clean existing chunks if re-indexing
    if (isConnectedToMongo) {
      await DocumentChunk.deleteMany({ documentId: docId });
    }

    let chunkIndex = 0;
    for (const chunk of extraction.chunks) {
      const embedding = await geminiService.generateEmbedding(chunk.text);
      await vectorService.indexChunk({
        documentId: docId,
        documentTitle: title,
        revision,
        page: chunk.page,
        section: chunk.section,
        text: chunk.text,
        embedding,
      });
      chunkIndex++;
      const progress = 60 + Math.floor((chunkIndex / extraction.chunks.length) * 35);
      emitDocumentProgress(docId, progress, `Indexing chunk ${chunkIndex} of ${extraction.chunks.length}...`, uploaderId);
    }

    if (isConnectedToMongo) {
      await DocumentModel.findByIdAndUpdate(docId, {
        status: "indexed",
        pageCount: extraction.pageCount,
      });
    }

    emitDocumentProgress(docId, 100, "Indexing completed successfully", uploaderId);
    emitDocumentStatus(docId, "indexed", extraction.pageCount, undefined, uploaderId);
    console.log(`[Ingestion Complete] ${title} indexed with ${extraction.chunks.length} chunks.`);
  } catch (err: any) {
    console.error(`[Ingestion Failed for ${docId}]:`, err);
    if (isConnectedToMongo) {
      await DocumentModel.findByIdAndUpdate(docId, { status: "failed" });
      try {
        await DocumentChunk.deleteMany({ documentId: docId });
      } catch (cleanupErr) {
        console.warn(`[Ingestion Cleanup Error for ${docId}]:`, cleanupErr);
      }
    }
    emitDocumentStatus(docId, "failed", 0, err?.message || "Ingestion pipeline failure", uploaderId);
  }
}
