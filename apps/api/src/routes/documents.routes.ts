import mongoose from "mongoose";
import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { DocumentModel, DocumentChunk, DocumentPermission, AuditEvent, DocumentFigure } from "../models";

import { storageService } from "../services/storage.service";
import { pdfService, isValidPdfSignature } from "../services/pdf.service";
import { geminiService } from "../services/gemini.service";
import { vectorService } from "../services/vector.service";
import { visualService } from "../services/visual.service";
import { isConnectedToMongo } from "../config/database";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middlewares/auth";
import { uploadLimiter } from "../middlewares/rateLimiters";
import { emitDocumentProgress, emitDocumentStatus, emitAuditEvent } from "../index";
import { sanitizeError } from "./settings.routes";
import { extractStructuredErrorInfo, logStructuredError } from "../utils/errorReporting";
import { env } from "../config/env";
import { UploadDocumentSchema } from "@man-u-ai/shared";

export const documentsRouter: Router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const isPdfMime = file.mimetype === "application/pdf" || file.mimetype === "application/x-pdf";
    const hasPdfExt = file.originalname.toLowerCase().endsWith(".pdf");
    if (isPdfMime || hasPdfExt) {
      cb(null, true);
    } else {
      const err = new Error("Only PDF documents are supported for ingestion. Unsupported file type provided.");
      (err as any).code = "UNSUPPORTED_FILE_TYPE";
      cb(err);
    }
  },
});

const uploadMiddleware = (req: Request, res: Response, next: NextFunction) => {
  upload.single("file")(req, res, (err: any) => {
    if (err) {
      if (err.code === "UNSUPPORTED_FILE_TYPE" || err.message?.includes("Unsupported file type") || err.message?.includes("Only PDF")) {
        return res.status(400).json({
          success: false,
          error: {
            code: "UNSUPPORTED_FILE_TYPE",
            message: "Only PDF documents are supported for ingestion. Unsupported file type provided.",
          },
        });
      }
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          success: false,
          error: {
            code: "FILE_TOO_LARGE",
            message: "File exceeds the 50MB upload limit.",
          },
        });
      }
      return res.status(400).json({
        success: false,
        error: {
          code: "UPLOAD_ERROR",
          message: err.message || "Failed to parse upload request.",
        },
      });
    }
    next();
  });
};

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
        processingError: d.processingError,
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
      processingError: doc.processingError,
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

  const chunks = await DocumentChunk.find({ documentId: id }).sort({ page: 1 }).limit(500);
  return res.json({
    success: true,
    data: chunks.map((c) => ({
      id: c._id.toString(),
      page: c.page,
      section: c.section,
      text: c.text,
      tokenCount: c.tokenCount,
      figureIds: (c as any).figureIds || [],
    })),
  });
});

// GET /documents/:id/figures - Get all extracted figures and tables for this document (authorized only)
documentsRouter.get("/:id/figures", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
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
      error: { code: "FORBIDDEN", message: "Access to document figures denied" },
    });
  }

  const page = req.query.page ? parseInt(String(req.query.page), 10) : undefined;
  const query: any = { documentId: doc._id };
  if (page && !isNaN(page)) {
    query.page = page;
  }

  const figures = await DocumentFigure.find(query).sort({ page: 1, figureId: 1 });
  return res.json({
    success: true,
    data: figures.map((f) => ({
      id: f._id.toString(),
      documentId: f.documentId.toString(),
      documentTitle: f.documentTitle,
      revision: f.revision,
      page: f.page,
      figureId: f.figureId,
      title: f.title,
      caption: f.caption,
      storagePath: f.storagePath,
      storageProvider: f.storageProvider,
      mimeType: f.mimeType,
      sizeBytes: f.sizeBytes,
      dimensions: f.dimensions,
      status: f.status,
      processingError: f.processingError,
      associatedChunkIds: f.associatedChunkIds || [],
      createdAt: f.createdAt?.toISOString(),
    })),
  });
});

// GET /documents/:id/figures/:figureId/image - Stream genuine figure image (authorized only)
documentsRouter.get("/:id/figures/:figureId/image", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const figureParam = String(req.params.figureId);
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
      error: { code: "FORBIDDEN", message: "Access to document figure image denied" },
    });
  }

  const figureOid = toMongoObjectId(figureParam);
  const figure = await DocumentFigure.findOne({
    documentId: doc._id,
    $or: [{ _id: figureOid }, { figureId: figureParam }],
  });

  if (!figure || figure.status !== "extracted" || !figure.storagePath) {
    return res.status(404).json({
      success: false,
      error: {
        code: "FIGURE_NOT_FOUND",
        message: "Visual figure image not found or processing incomplete",
      },
    });
  }

  try {
    const stream = await storageService.getFileStream(figure.storagePath, figure.storageProvider);
    res.setHeader("Content-Type", figure.mimeType || "image/jpeg");
    if (figure.sizeBytes) {
      res.setHeader("Content-Length", figure.sizeBytes);
    }
    return stream.pipe(res);
  } catch (streamErr: any) {
    console.error(`[Figures] Error streaming figure image ${figureParam}:`, streamErr);
    return res.status(404).json({
      success: false,
      error: {
        code: "FIGURE_IMAGE_UNAVAILABLE",
        message: "Figure image file is missing or unavailable in storage",
      },
    });
  }
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
  uploadMiddleware,
  async (req: AuthenticatedRequest, res: Response) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: "NO_FILE", message: "No document file was provided" },
      });
    }

    const isPdfMime = req.file.mimetype === "application/pdf" || req.file.mimetype === "application/x-pdf";
    const hasPdfExt = req.file.originalname.toLowerCase().endsWith(".pdf");
    if (!isPdfMime && !hasPdfExt) {
      return res.status(400).json({
        success: false,
        error: {
          code: "UNSUPPORTED_FILE_TYPE",
          message: "Only PDF documents are supported for ingestion. Unsupported file type provided.",
        },
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
    let rawTags = req.body.tags;
    if (typeof rawTags === "string") {
      rawTags = rawTags.split(",").map((t: string) => t.trim()).filter(Boolean);
    } else if (!Array.isArray(rawTags)) {
      rawTags = [];
    }
    const equipmentId = req.body.equipmentId || undefined;

    const validationResult = UploadDocumentSchema.safeParse({
      title,
      revision,
      tags: rawTags,
      equipmentId: equipmentId || undefined,
    });
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid document upload metadata",
          details: validationResult.error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        },
      });
    }

    const validatedData = validationResult.data;

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
          title: validatedData.title,
          revision: validatedData.revision,
          filename: req.file.originalname,
          storagePath: storageResult.storagePath,
          storageProvider: storageResult.storageProvider,
          mimeType: req.file.mimetype,
          sizeBytes: storageResult.sizeBytes,
          status: "processing",
          tags: validatedData.tags,
          equipmentId: validatedData.equipmentId,
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

          const storageWarnings: string[] = [];

          // 1. Delete original PDF file
          if (doc.storagePath) {
            try {
              await storageService.deleteFile(doc.storagePath, doc.storageProvider);
            } catch (e: any) {
              const warnMsg = `Failed to delete document PDF (${doc.storagePath}): ${e?.message || e}`;
              console.warn("[Documents] File cleanup warning:", warnMsg);
              storageWarnings.push(warnMsg);
            }
          }

          // 2. Delete all associated DocumentFigure storage files and database records
          try {
            const figures = await DocumentFigure.find({ documentId: doc._id });
            for (const fig of figures) {
              if (fig.storagePath) {
                try {
                  await storageService.deleteFile(fig.storagePath, fig.storageProvider);
                } catch (figErr: any) {
                  const warnMsg = `Failed to delete figure image asset (${fig.figureId} @ ${fig.storagePath}): ${figErr?.message || figErr}`;
                  console.warn("[Documents]", warnMsg);
                  storageWarnings.push(warnMsg);
                }
              }
            }
            await DocumentFigure.deleteMany({ documentId: doc._id });
          } catch (figDbErr: any) {
            console.warn("[Documents] Failed to purge DocumentFigure records:", figDbErr);
            storageWarnings.push(`Failed to purge figure metadata records: ${figDbErr?.message || figDbErr}`);
          }

          await vectorService.deleteDocumentChunks(id);
          await DocumentModel.findByIdAndDelete(id);

          try {
            await AuditEvent.create({
              userId: toMongoObjectId(req.user?.id),
              userEmail: req.user?.email,
              action: "doc_delete",
              resourceType: "Document",
              resourceId: id,
              details: {
                title: doc.title,
                storageWarnings: storageWarnings.length > 0 ? storageWarnings : undefined,
              },
            });
          } catch (auditErr) {
            console.warn("[Documents] Non-fatal audit log failure on delete:", auditErr);
          }

          if (storageWarnings.length > 0) {
            return res.json({
              success: true,
              data: {
                message: "Document deleted with storage cleanup warnings",
                storageWarnings,
              },
            });
          }

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
      processingError: doc.processingError,
    },
  });
});

export async function processDocumentAsync(docId: string, title: string, revision: string, buffer: Buffer, uploaderId?: string) {
  const docOid = toMongoObjectId(docId);
  try {
    // Clear previous error when initiating a new ingestion attempt
    if (isConnectedToMongo) {
      try {
        await DocumentModel.findByIdAndUpdate(docOid, {
          status: "processing",
          $unset: { processingError: 1 },
        });
      } catch (clearErr) {
        console.warn(`[Ingestion] Failed to clear previous processing error for ${docId}:`, clearErr);
      }
    }

    emitDocumentProgress(docId, 30, "Extracting text and tables via PDF parser...", uploaderId);
    const extraction = await pdfService.extractAndChunk(buffer, title);

    if (extraction.outcome === "extraction_failed") {
      throw new Error(extraction.error || "Failed to extract text from PDF document structure.");
    }

    // If OCR is required but has not produced usable text, persist needs_ocr and do not generate embeddings or index anything
    if (extraction.outcome === "ocr_required_unresolved" || extraction.requiresOcr) {
      const actionableOcrError = sanitizeError(
        extraction.ocrError || "Document contains scanned pages requiring optical character recognition (OCR) which is currently unresolved."
      );
      console.warn(
        `[Ingestion Needs OCR] Document ${docId} ("${title}") requires OCR but usable text is unresolved: ${actionableOcrError}`
      );

      // Clean up any existing or partial chunks and figures (in-memory and MongoDB)
      const ocrStorageCleanupErrors: string[] = [];
      try {
        await vectorService.deleteDocumentChunks(docId);
        const staleFigures = await DocumentFigure.find({ documentId: docOid });
        for (const fig of staleFigures) {
          if (fig.storagePath) {
            try {
              await storageService.deleteFile(fig.storagePath, fig.storageProvider);
            } catch (storageErr: any) {
              const warn = `Failed to delete stale figure storage asset (${fig.figureId} @ ${fig.storagePath}): ${storageErr?.message || storageErr}`;
              ocrStorageCleanupErrors.push(warn);
              console.warn(`[Ingestion OCR Cleanup Warning for ${docId}]:`, warn);
            }
          }
        }
        await DocumentFigure.deleteMany({ documentId: docOid });
      } catch (cleanupErr: any) {
        const sanitizedCleanupMsg = sanitizeError(cleanupErr?.message || cleanupErr);
        console.warn(`[Ingestion Cleanup Error for ${docId}]:`, sanitizedCleanupMsg);
        throw new Error(`Document chunk cleanup failed during unresolved OCR handling: ${sanitizedCleanupMsg}`);
      }

      if (ocrStorageCleanupErrors.length > 0) {
        console.warn(
          `[Ingestion OCR Cleanup Observability for ${docId}]: Encountered ${ocrStorageCleanupErrors.length} storage asset deletion failure(s): ${ocrStorageCleanupErrors.join("; ")}`
        );
      }

      // Invariant: needs_ocr status transition is strictly conditional on confirmed persistence in database
      if (!isConnectedToMongo) {
        throw new Error("Database unavailable: cannot persist needs_ocr document status.");
      }

      const updated = await DocumentModel.findByIdAndUpdate(docOid, {
        status: "needs_ocr",
        pageCount: extraction.pageCount,
        processingError: actionableOcrError,
      });
      if (!updated) {
        throw new Error(`Failed to locate document ${docId} to persist needs_ocr status.`);
      }

      // Emit socket status only after persistence is confirmed
      try {
        emitDocumentStatus(
          docId,
          "needs_ocr",
          extraction.pageCount,
          actionableOcrError,
          uploaderId
        );
      } catch (socketErr) {
        console.warn(`[Ingestion Socket Event Error for ${docId}]:`, socketErr);
      }
      return;
    }

    // Invariant: Never mark a document indexed when no genuine non-empty extracted chunks were successfully embedded and persisted
    if (!extraction.chunks || extraction.chunks.length === 0) {
      throw new Error("Document text extraction yielded zero valid structural chunks to index.");
    }

    emitDocumentProgress(docId, 60, `Generating vector embeddings for ${extraction.chunks.length} chunks...`, uploaderId);

    // Required pre-cleanup: ensure existing chunks and figures are purged before re-indexing
    if (!isConnectedToMongo) {
      throw new Error("Database unavailable: cannot verify or clear existing chunk state before indexing.");
    }
    try {
      await vectorService.deleteDocumentChunks(docId);
      const existingFigures = await DocumentFigure.find({ documentId: docOid });
      for (const fig of existingFigures) {
        if (fig.storagePath) {
          try {
            await storageService.deleteFile(fig.storagePath, fig.storageProvider);
          } catch (storageErr: any) {
            console.warn(`[Ingestion Pre-cleanup Warning for ${docId}]: Failed to delete figure asset (${fig.figureId} @ ${fig.storagePath}):`, storageErr);
          }
        }
      }
      await DocumentFigure.deleteMany({ documentId: docOid });
    } catch (cleanupErr: any) {
      throw new Error(`Failed to clear existing chunks before indexing: ${cleanupErr?.message || cleanupErr}`);
    }

    // Bounded multimodal visual figure extraction
    const pageTextMap = new Map<number, string>();
    for (const chunk of extraction.chunks) {
      const existing = pageTextMap.get(chunk.page) || "";
      pageTextMap.set(chunk.page, existing ? `${existing}\n\n${chunk.text}` : chunk.text);
    }

    let extractedFigures: any[] = [];
    try {
      extractedFigures = await visualService.extractFiguresFromPdf(buffer, extraction.pageCount, pageTextMap);
    } catch (visErr) {
      console.warn(`[Ingestion Visual Error for ${docId}]:`, visErr);
    }
    const pageFigureIdsMap = new Map<number, string[]>();

    for (const figItem of extractedFigures) {
      let savedStoragePath: string | undefined;
      let savedProvider: "local" | "cloudinary" | "s3" | "gcs" = "local";

      if (figItem.status === "extracted" && figItem.buffer) {
        try {
          const ext = figItem.mimeType === "image/png" ? "png" : "jpg";
          const safeFigName = `${docId}_fig_p${figItem.page}_${figItem.figureId.replace(/[^a-zA-Z0-9_-]/g, "_")}.${ext}`;
          const saveResult = await storageService.saveFile(safeFigName, figItem.buffer);
          savedStoragePath = saveResult.storagePath;
          savedProvider = saveResult.storageProvider;
        } catch (saveErr: any) {
          figItem.status = "failed";
          figItem.processingError = `Storage write failed for figure ${figItem.figureId}: ${saveErr?.message || String(saveErr)}`;
        }
      }

      try {
        const createdFig = await DocumentFigure.create({
          documentId: docOid,
          documentTitle: title,
          revision,
          page: figItem.page,
          figureId: figItem.figureId,
          title: figItem.title,
          caption: figItem.caption,
          storagePath: savedStoragePath,
          storageProvider: savedProvider,
          mimeType: figItem.mimeType,
          sizeBytes: figItem.sizeBytes,
          dimensions: figItem.width && figItem.height ? { width: figItem.width, height: figItem.height } : undefined,
          status: figItem.status,
          processingError: figItem.processingError,
          associatedChunkIds: [],
        });

        const list = pageFigureIdsMap.get(figItem.page) || [];
        list.push(createdFig._id.toString());
        pageFigureIdsMap.set(figItem.page, list);
      } catch (dbFigErr) {
        console.warn(`[Ingestion] Failed to persist figure metadata for ${figItem.figureId}:`, dbFigErr);
      }
    }

    let chunkIndex = 0;
    for (const chunk of extraction.chunks) {
      const embedding = await geminiService.generateEmbedding(chunk.text);
      const chunkFigureIds = pageFigureIdsMap.get(chunk.page) || [];
      await vectorService.indexChunk({
        documentId: docOid.toString(),
        documentTitle: title,
        revision,
        page: chunk.page,
        section: chunk.section,
        text: chunk.text,
        embedding,
        figureIds: chunkFigureIds,
      });
      chunkIndex++;
      const progress = 60 + Math.floor((chunkIndex / extraction.chunks.length) * 35);
      emitDocumentProgress(docId, progress, `Indexing chunk ${chunkIndex} of ${extraction.chunks.length}...`, uploaderId);
    }

    // Invariant: Final success is strictly conditional on confirmed persistence in database
    if (!isConnectedToMongo) {
      throw new Error("Database unavailable: cannot persist final indexed document status.");
    }

    const updated = await DocumentModel.findByIdAndUpdate(docOid, {
      status: "indexed",
      pageCount: extraction.pageCount,
      $unset: { processingError: 1 },
    });
    if (!updated) {
      throw new Error(`Failed to locate document ${docId} to persist indexed status.`);
    }

    emitDocumentProgress(docId, 100, "Indexing completed successfully", uploaderId);
    emitDocumentStatus(docId, "indexed", extraction.pageCount, undefined, uploaderId);
    console.log(
      `[Ingestion Complete] ${title} indexed with ${extraction.chunks.length} chunks and ${extractedFigures.length} visual figures (OCR: ${extraction.ocrPerformed ? "performed" : "not needed"}).`
    );
  } catch (err: any) {
    console.error(`[Ingestion Failed for ${docId}]:`, err);
    let cleanupError: unknown = null;

    // Independent step 1: Always delete every chunk and figure for this document so partial assets never remain
    const failureStorageCleanupErrors: string[] = [];
    try {
      await vectorService.deleteDocumentChunks(docId);
      const failedFigures = await DocumentFigure.find({ documentId: docOid });
      for (const fig of failedFigures) {
        if (fig.storagePath) {
          try {
            await storageService.deleteFile(fig.storagePath, fig.storageProvider);
          } catch (cleanErr: any) {
            const warn = `Failed to delete figure asset on ingestion abort (${fig.figureId} @ ${fig.storagePath}): ${cleanErr?.message || cleanErr}`;
            failureStorageCleanupErrors.push(warn);
            console.warn(`[Ingestion Failure Cleanup Warning for ${docId}]:`, warn);
          }
        }
      }
      await DocumentFigure.deleteMany({ documentId: docOid });
    } catch (cleanupErr) {
      cleanupError = cleanupErr;
      console.error(`[Ingestion Cleanup Error for ${docId}]:`, cleanupErr);
    }

    if (failureStorageCleanupErrors.length > 0) {
      console.warn(
        `[Ingestion Failure Cleanup Observability for ${docId}]: Encountered ${failureStorageCleanupErrors.length} storage asset deletion failure(s): ${failureStorageCleanupErrors.join("; ")}`
      );
    }

    const safeErrorMessage = sanitizeError(
      cleanupError
        ? `Ingestion failed and chunk cleanup encountered an error: ${err?.message || err}`
        : err?.message || "Document processing and vector indexing pipeline failed."
    );

    // Independent best-effort step 2: Update document status to failed and persist processingError
    try {
      if (isConnectedToMongo) {
        await DocumentModel.findByIdAndUpdate(docOid, {
          status: "failed",
          processingError: safeErrorMessage,
        });
      }
    } catch (statusErr) {
      console.warn(`[Ingestion DB Status Update Error for ${docId}]:`, statusErr);
    }

    // Independent best-effort step 3: Emit failed status event
    try {
      emitDocumentStatus(docId, "failed", 0, safeErrorMessage, uploaderId);
    } catch (socketErr) {
      console.warn(`[Ingestion Socket Event Error for ${docId}]:`, socketErr);
    }
  }
}
