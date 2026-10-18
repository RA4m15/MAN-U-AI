import mongoose from "mongoose";
import { Router, Request, Response } from "express";
import multer from "multer";
import { DocumentModel, DocumentChunk, ProcessingJob, AuditEvent } from "../models";

import { storageService } from "../services/storage.service";
import { pdfService } from "../services/pdf.service";
import { geminiService } from "../services/gemini.service";
import { vectorService } from "../services/vector.service";
import { isConnectedToMongo } from "../config/database";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middlewares/auth";
import { emitDocumentProgress, emitDocumentStatus, emitAuditEvent } from "../index";

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

// GET /documents - List all documents permitted for current user
documentsRouter.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (isConnectedToMongo) {
    try {
      const docs = await DocumentModel.find().sort({ createdAt: -1 }).limit(100);
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
      console.warn("[Documents] DB fetch error:", err);
    }
  }

  return res.json({
    success: true,
    data: [],
  });
});

// GET /documents/:id - Get single document details
documentsRouter.get("/:id", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  if (isConnectedToMongo) {
    try {
      const doc = await DocumentModel.findById(id).populate("equipmentId");
      if (doc) {
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
      }
    } catch (err) {
      console.warn("[Documents] Find error:", err);
    }
  }

  return res.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: "Document not found" },
  });
});

// GET /documents/:id/chunks - Get all indexed chunks for this document
documentsRouter.get("/:id/chunks", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  if (isConnectedToMongo) {
    try {
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
    } catch (err) {
      console.warn("[Documents] Chunks fetch error:", err);
    }
  }

  return res.json({ success: true, data: [] });
});

// GET /documents/:id/file - Stream raw document PDF
documentsRouter.get("/:id/file", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  if (isConnectedToMongo) {
    try {
      const doc = await DocumentModel.findById(id);
      if (doc && doc.storagePath) {
        res.setHeader("Content-Type", doc.mimeType || "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="${doc.filename}"`);
        const stream = storageService.getFileStream(doc.storagePath);
        return stream.pipe(res);
      }
    } catch (err) {
      console.warn("[Documents] File streaming error:", err);
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

    const title = req.body.title || req.file.originalname.replace(/\.[^/.]+$/, "");
    const revision = req.body.revision || "Rev 1.0";
    const tags = req.body.tags
      ? typeof req.body.tags === "string"
        ? req.body.tags.split(",").map((t: string) => t.trim())
        : req.body.tags
      : [];
    const equipmentId = req.body.equipmentId || undefined;

    try {
      // 1. Save privately in storage service
      const { storagePath, sizeBytes } = await storageService.saveFile(req.file.originalname, req.file.buffer);

      let docId = `doc-${Date.now()}`;
      if (isConnectedToMongo) {
        const createdDoc = await DocumentModel.create({
          title,
          revision,
          filename: req.file.originalname,
          storagePath,
          mimeType: req.file.mimetype,
          sizeBytes,
          status: "processing",
          tags,
          equipmentId,
          uploadedById: (req.user?.id && mongoose.Types.ObjectId.isValid(req.user.id))
            ? (req.user.id as any)
            : new mongoose.Types.ObjectId(),
        });
        docId = createdDoc._id.toString();

        await AuditEvent.create({
          userId: (req.user?.id && mongoose.Types.ObjectId.isValid(req.user.id))
            ? (req.user.id as any)
            : undefined,
          userEmail: req.user?.email,
          action: "doc_upload",
          resourceType: "Document",
          resourceId: docId,
          details: { title, revision, sizeBytes },
        });


        emitAuditEvent({
          id: `aud-${Date.now()}`,
          action: "doc_upload",
          actorName: req.user?.name || "User",
          description: `Uploaded document: "${title}" (${revision})`,
          timestamp: new Date().toISOString(),
        });
      }

      // Notify clients that ingestion has started
      emitDocumentProgress(docId, 10, "Extracting text and structural metadata...");

      // 2. Trigger asynchronous background ingestion pipeline
      processDocumentAsync(docId, title, revision, req.file.buffer).catch((err) =>
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
      return res.status(500).json({
        success: false,
        error: { code: "UPLOAD_FAILED", message: "Failed to store or process document", details: String(err) },
      });
    }
  }
);

// DELETE /documents/:id - Delete document and vector index chunks
documentsRouter.delete(
  "/:id",
  requireAuth,
  requireRole(["admin", "engineer"]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    if (isConnectedToMongo) {
      try {
        const doc = await DocumentModel.findById(id);
        if (doc) {
          try {
            await storageService.deleteFile(doc.storagePath);
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

// GET /documents/:id/status
documentsRouter.get("/:id/status", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  if (isConnectedToMongo) {
    const doc = await DocumentModel.findById(id);
    if (doc) {
      return res.json({
        success: true,
        data: {
          id: doc._id.toString(),
          status: doc.status,
          pageCount: doc.pageCount,
        },
      });
    }
  }

  return res.json({
    success: true,
    data: { id, status: "indexed", pageCount: 24 },
  });
});

async function processDocumentAsync(docId: string, title: string, revision: string, buffer: Buffer) {
  try {
    emitDocumentProgress(docId, 30, "Extracting text and tables via PDF parser...");
    const extraction = await pdfService.extractAndChunk(buffer, title);

    emitDocumentProgress(docId, 60, `Generating vector embeddings for ${extraction.chunks.length} chunks...`);

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
      emitDocumentProgress(docId, progress, `Indexing chunk ${chunkIndex} of ${extraction.chunks.length}...`);
    }

    if (isConnectedToMongo) {
      await DocumentModel.findByIdAndUpdate(docId, {
        status: "indexed",
        pageCount: extraction.pageCount,
      });
    }

    emitDocumentProgress(docId, 100, "Indexing completed successfully");
    emitDocumentStatus(docId, "indexed", extraction.pageCount);
    console.log(`[Ingestion Complete] ${title} indexed with ${extraction.chunks.length} chunks.`);
  } catch (err: any) {
    console.error(`[Ingestion Failed for ${docId}]:`, err);
    if (isConnectedToMongo) {
      await DocumentModel.findByIdAndUpdate(docId, { status: "failed" });
    }
    emitDocumentStatus(docId, "failed", 0, err?.message || "Ingestion pipeline failure");
  }
}
