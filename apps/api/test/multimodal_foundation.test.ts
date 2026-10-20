import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { app } from "../src/app";
import { env } from "../src/config/env";
import { connectDatabase, isConnectedToMongo } from "../src/config/database";
import { DocumentModel, DocumentChunk, DocumentFigure, DocumentPermission } from "../src/models";
import { pdfService } from "../src/services/pdf.service";
import { visualService, encodeRawToPng, VISUAL_PROCESSING_LIMITS } from "../src/services/visual.service";
import { ragService } from "../src/services/rag.service";
import { geminiService } from "../src/services/gemini.service";
import { storageService } from "../src/services/storage.service";

// Valid 1x1 base64 JPEG with valid SOI and EOI markers
const MINIMAL_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxD/2Q==",
  "base64"
);

// Function to construct a valid test PDF with or without embedded images and captions
function buildSyntheticPdf(options: {
  pageCount?: number;
  includeFigure?: boolean;
  corruptStream?: boolean;
  figureCaption?: string;
  hugeImage?: boolean;
}): Buffer {
  const pageCount = options.pageCount || 1;
  const includeFigure = options.includeFigure ?? false;

  let streamData = MINIMAL_JPEG;
  if (options.corruptStream) {
    streamData = Buffer.from("NOT_A_VALID_JPEG_STREAM");
  } else if (options.hugeImage) {
    streamData = Buffer.alloc(11 * 1024 * 1024, 0xff); // 11MB exceeds 10MB limit
  }

  const objects: Buffer[] = [];
  objects.push(Buffer.from("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"));

  const kidRefs: string[] = [];
  for (let p = 1; p <= pageCount; p++) {
    kidRefs.push(`${2 + p} 0 R`);
  }
  objects.push(Buffer.from(`2 0 obj\n<< /Type /Pages /Kids [${kidRefs.join(" ")}] /Count ${pageCount} >>\nendobj\n`));

  let nextObjId = 2 + pageCount + 1;
  const imageObjId = nextObjId++;

  for (let p = 1; p <= pageCount; p++) {
    const pageObjId = 2 + p;
    const hasFigOnThisPage = includeFigure && p === 1;

    const captionText = options.figureCaption || "Figure 1: Slurry Pump Mechanical Seal Housing Assembly";
    const textContent = `Standard Maintenance Procedure Page ${p}.\n${hasFigOnThisPage ? captionText + "\n" : ""}Tighten M12 gland retaining nuts to 45 N*m.\n`;

    const contentObjId = nextObjId++;
    objects.push(
      Buffer.from(
        `${contentObjId} 0 obj\n<< /Length ${textContent.length} >>\nstream\n${textContent}\nendstream\nendobj\n`
      )
    );

    const xobjectDict = hasFigOnThisPage ? `/XObject << /Img1 ${imageObjId} 0 R >>` : "";
    objects.push(
      Buffer.from(
        `${pageObjId} 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << ${xobjectDict} >> /Contents ${contentObjId} 0 R >>\nendobj\n`
      )
    );
  }

  if (includeFigure) {
    const filter = options.corruptStream ? "/DCTDecode" : "/DCTDecode";
    objects.push(
      Buffer.concat([
        Buffer.from(
          `${imageObjId} 0 obj\n<< /Type /XObject /Subtype /Image /Width 120 /Height 120 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter ${filter} /Length ${streamData.length} >>\nstream\n`
        ),
        streamData,
        Buffer.from("\nendstream\nendobj\n"),
      ])
    );
  }

  const header = Buffer.from("%PDF-1.4\n");
  const body = Buffer.concat(objects);
  const trailer = Buffer.from(`xref\n0 ${nextObjId}\ntrailer\n<< /Size ${nextObjId} /Root 1 0 R >>\n%%EOF\n`);

  return Buffer.concat([header, body, trailer]);
}

const adminToken = jwt.sign(
  { id: "usr-multimodal-admin", email: "admin@plant.io", name: "Elena Rostova", role: "admin" },
  env.JWT_SECRET,
  { expiresIn: "1h" }
);

const engineerToken = jwt.sign(
  { id: "usr-multimodal-eng", email: "alex.mercer@plant.io", name: "Alex Mercer", role: "engineer" },
  env.JWT_SECRET,
  { expiresIn: "1h" }
);

const viewerToken = jwt.sign(
  { id: "usr-multimodal-viewer", email: "viewer@plant.io", name: "Operator", role: "viewer" },
  env.JWT_SECRET,
  { expiresIn: "1h" }
);

describe("Task 2: Multimodal Document Understanding Foundation Suite", () => {
  const createdDocIds: string[] = [];

  beforeAll(async () => {
    await connectDatabase();
  });

  afterAll(async () => {
    if (isConnectedToMongo) {
      for (const id of createdDocIds) {
        try {
          const doc = await DocumentModel.findById(id);
          if (doc && doc.storagePath) {
            await storageService.deleteFile(doc.storagePath, doc.storageProvider);
          }
          const figs = await DocumentFigure.find({ documentId: id });
          for (const fig of figs) {
            if (fig.storagePath) {
              await storageService.deleteFile(fig.storagePath, fig.storageProvider);
            }
          }
          await DocumentModel.findByIdAndDelete(id);
          await DocumentChunk.deleteMany({ documentId: id });
          await DocumentFigure.deleteMany({ documentId: id });
          await DocumentPermission.deleteMany({ documentId: id });
        } catch {
          // cleanup
        }
      }
    }
  });

  // ── 1. PDF Text Extraction Remains Functional ─────────────────────────────
  it("Requirement 1: PDF text extraction remains functional on valid documents", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const samplePath = path.resolve(__dirname, "../test_authorized_manual.pdf");
    expect(fs.existsSync(samplePath)).toBe(true);

    const pdfBuffer = fs.readFileSync(samplePath);
    const extraction = await pdfService.extractAndChunk(pdfBuffer, "Heavy Duty Slurry Pump Standard");

    expect(extraction.outcome).toBe("digital_text_extracted");
    expect(extraction.pageCount).toBe(3);
    expect(extraction.requiresOcr).toBe(false);
    expect(extraction.chunks.length).toBeGreaterThanOrEqual(1);
    expect(extraction.totalText).toContain("52 N·m");
  });

  // ── 2. Document with No Extractable Figures Does Not Receive Fabricated Figures
  it("Requirement 2: A document with no extractable figures does not receive fabricated figures", async () => {
    const pdfNoFigures = buildSyntheticPdf({ pageCount: 2, includeFigure: false });
    const figures = visualService.extractFiguresFromPdf(pdfNoFigures, 2);

    expect(figures).toEqual([]);
    expect(figures.length).toBe(0);
  });

  // ── 3. Page and Figure Metadata Stored with Stable References ─────────────
  it("Requirement 3: A PDF with figures produces valid visual references and stores them with stable document references", async () => {
    const pdfWithFig = buildSyntheticPdf({
      pageCount: 2,
      includeFigure: true,
      figureCaption: "Figure 4.2: Mechanical Seal Cartridge Alignment Schematic",
    });

    const pageTextMap = new Map<number, string>();
    pageTextMap.set(1, "Figure 4.2: Mechanical Seal Cartridge Alignment Schematic\nTighten gland nuts in diagonal sequence.");

    const extracted = visualService.extractFiguresFromPdf(pdfWithFig, 2, pageTextMap);
    expect(extracted.length).toBe(1);
    expect(extracted[0].status).toBe("extracted");
    expect(extracted[0].page).toBe(1);
    expect(extracted[0].figureId).toBe("Figure 4.2");
    expect(extracted[0].title).toBe("Mechanical Seal Cartridge Alignment Schematic");
    expect(extracted[0].caption).toContain("Figure 4.2");
    expect(extracted[0].buffer).toBeDefined();
    expect(extracted[0].mimeType).toBe("image/jpeg");
    expect(extracted[0].width).toBe(120);
    expect(extracted[0].height).toBe(120);

    // Save and verify persistence with stable document ID
    const testDocId = new mongoose.Types.ObjectId();
    const savedImg = await storageService.saveFile(`test_fig_${testDocId}.jpg`, extracted[0].buffer!);

    const figRecord = await DocumentFigure.create({
      documentId: testDocId,
      documentTitle: "Slurry Pump Manual",
      revision: "v2.0",
      page: extracted[0].page,
      figureId: extracted[0].figureId,
      title: extracted[0].title,
      caption: extracted[0].caption,
      storagePath: savedImg.storagePath,
      storageProvider: savedImg.storageProvider,
      mimeType: extracted[0].mimeType,
      sizeBytes: savedImg.sizeBytes,
      dimensions: { width: extracted[0].width!, height: extracted[0].height! },
      status: "extracted",
      associatedChunkIds: ["chk-mock-01"],
    });

    createdDocIds.push(testDocId.toString());

    expect(figRecord._id).toBeDefined();
    expect(figRecord.documentId.toString()).toBe(testDocId.toString());
    expect(figRecord.status).toBe("extracted");
    expect(figRecord.storagePath).toBe(savedImg.storagePath);
  });

  // ── 4. Image-Processing Failures Are Reported Accurately ───────────────────
  it("Requirement 4: Image-processing failures are reported accurately and never marked complete", async () => {
    const pdfCorrupted = buildSyntheticPdf({ pageCount: 1, includeFigure: true, corruptStream: true });
    // DCT with invalid stream data or unknown filter
    const extracted = visualService.extractFiguresFromPdf(pdfCorrupted, 1);

    // Should contain a failed figure item or fail honestly
    if (extracted.length > 0) {
      expect(extracted[0].status).toBe("failed");
      expect(extracted[0].processingError).toBeDefined();
    }
  });

  // ── 5. Page and Image Processing Limits Are Enforced ──────────────────────
  it("Requirement 5: Page and image processing limits are strictly enforced", () => {
    expect(VISUAL_PROCESSING_LIMITS.MAX_PAGES_TO_PROCESS).toBe(50);
    expect(VISUAL_PROCESSING_LIMITS.MAX_FIGURES_PER_DOC).toBe(20);
    expect(VISUAL_PROCESSING_LIMITS.MAX_FIGURES_PER_PAGE).toBe(5);
    expect(VISUAL_PROCESSING_LIMITS.MAX_IMAGE_SIZE_BYTES).toBe(10 * 1024 * 1024);
    expect(VISUAL_PROCESSING_LIMITS.MIN_IMAGE_DIMENSION).toBe(30);

    // Test huge image rejection
    const hugePdf = buildSyntheticPdf({ pageCount: 1, includeFigure: true, hugeImage: true });
    const extracted = visualService.extractFiguresFromPdf(hugePdf, 1);
    expect(extracted.length).toBe(1);
    expect(extracted[0].status).toBe("failed");
    expect(extracted[0].processingError).toMatch(/exceeds size limit/);
  });

  // ── 6. Unauthorized Users Cannot Retrieve Visual Evidence ─────────────────
  it("Requirement 6: Unauthorized users cannot retrieve visual evidence from inaccessible documents", async () => {
    const privateDocOid = new mongoose.Types.ObjectId();
    createdDocIds.push(privateDocOid.toString());

    // Create private document owned by admin
    await DocumentModel.create({
      _id: privateDocOid,
      title: "Confidential Reactor Schematic",
      revision: "v1.0",
      filename: "confidential_reactor.pdf",
      storagePath: "confidential_reactor.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      status: "indexed",
      pageCount: 1,
      uploadedById: new mongoose.Types.ObjectId(),
    });

    // Create figure for private document
    const testFig = await DocumentFigure.create({
      documentId: privateDocOid,
      documentTitle: "Confidential Reactor Schematic",
      revision: "v1.0",
      page: 1,
      figureId: "Figure 1",
      title: "Core Isolation Valve",
      storagePath: "mock_fig.jpg",
      mimeType: "image/jpeg",
      status: "extracted",
      associatedChunkIds: [],
    });

    // 1. Unauthenticated request rejected with 401
    const unauthRes = await request(app).get(`/api/v1/documents/${privateDocOid}/figures`);
    expect(unauthRes.status).toBe(401);

    // 2. Unauthorized viewer rejected with 403
    const forbiddenRes = await request(app)
      .get(`/api/v1/documents/${privateDocOid}/figures`)
      .set("Authorization", `Bearer ${viewerToken}`);
    expect(forbiddenRes.status).toBe(403);
    expect(forbiddenRes.body.success).toBe(false);
    expect(forbiddenRes.body.error.code).toBe("FORBIDDEN");

    // 3. Unauthorized image streaming rejected with 403
    const streamForbiddenRes = await request(app)
      .get(`/api/v1/documents/${privateDocOid}/figures/${testFig._id}/image`)
      .set("Authorization", `Bearer ${viewerToken}`);
    expect(streamForbiddenRes.status).toBe(403);
    expect(streamForbiddenRes.body.success).toBe(false);

    // 4. Authorized admin permitted to retrieve figures
    const adminRes = await request(app)
      .get(`/api/v1/documents/${privateDocOid}/figures`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(adminRes.status).toBe(200);
    expect(adminRes.body.success).toBe(true);
    expect(adminRes.body.data.length).toBe(1);
    expect(adminRes.body.data[0].figureId).toBe("Figure 1");
  });

  // ── 7. Multimodal Retrieval Foundation in RAG Citations ───────────────────
  it("Requirement 7: Multimodal RAG retrieval attaches genuine visual figures to source citations without breaking text RAG", async () => {
    const publicDocOid = new mongoose.Types.ObjectId();
    createdDocIds.push(publicDocOid.toString());

    const doc = await DocumentModel.create({
      _id: publicDocOid,
      title: "Boiler Feed Pump Operations Standard",
      revision: "Rev 3.0",
      filename: "bfp_operations.pdf",
      storagePath: "bfp_operations.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2048,
      status: "indexed",
      pageCount: 8,
      uploadedById: new mongoose.Types.ObjectId(),
    });

    // Grant engineer permission
    await DocumentPermission.create({
      documentId: publicDocOid,
      role: "engineer",
      canRead: true,
      canWrite: false,
    });

    // Create a real chunk on page 4
    await DocumentChunk.create({
      documentId: publicDocOid,
      documentTitle: doc.title,
      revision: doc.revision,
      page: 4,
      section: "Shaft Coupling Alignment",
      text: "Shaft coupling dial indicator radial runout must not exceed 0.03 mm on Boiler Feed Pump BFP-01.",
      embedding: new Array(768).fill(0.05),
      tokenCount: 22,
      figureIds: ["Figure 4.1"],
    });

    // Create a genuine extracted figure on page 4
    await DocumentFigure.create({
      documentId: publicDocOid,
      documentTitle: doc.title,
      revision: doc.revision,
      page: 4,
      figureId: "Figure 4.1",
      title: "Dial Indicator Setup & Coupling Tolerances",
      caption: "Figure 4.1: Dial Indicator Setup & Coupling Tolerances",
      storagePath: "mock_dial_indicator.jpg",
      mimeType: "image/jpeg",
      status: "extracted",
      dimensions: { width: 300, height: 200 },
      associatedChunkIds: [],
    });

    // Mock external AI services for unit testing
    vi.spyOn(geminiService, "generateEmbedding").mockResolvedValue(new Array(768).fill(0.05));
    vi.spyOn(geminiService, "generateAnswer").mockResolvedValue({
      answer: "Shaft coupling dial indicator radial runout must not exceed 0.03 mm on Boiler Feed Pump BFP-01.",
      citations: [],
    });

    // Query RAG pipeline as engineer
    const ragResult = await ragService.answerQuestion(
      "What is the shaft coupling dial indicator runout for Boiler Feed Pump?",
      { id: "usr-multimodal-eng", role: "engineer" }
    );

    expect(ragResult.answer).toBeDefined();
    expect(ragResult.citations.length).toBeGreaterThan(0);

    // Verify citation references source page and includes genuine visual evidence
    const matchingCitation = ragResult.citations.find((c) => c.documentId === publicDocOid.toString());
    expect(matchingCitation).toBeDefined();
    expect(matchingCitation?.page).toBe(4);
    expect(matchingCitation?.figures).toBeDefined();
    expect(matchingCitation?.figures?.length).toBe(1);
    expect(matchingCitation?.figures?.[0].figureId).toBe("Figure 4.1");
    expect(matchingCitation?.figures?.[0].dimensions?.width).toBe(300);
  });

  // ── 8. Minimal PNG Encoding Correctness ───────────────────────────────────
  it("Requirement 8: Encodes raw decompressed Flate image data into standard valid PNG binary", () => {
    const rawRgb = Buffer.alloc(40 * 40 * 3, 128); // 40x40 gray-ish RGB
    const pngBuf = encodeRawToPng(40, 40, rawRgb, "DeviceRGB");

    // Standard PNG signature: 89 50 4E 47 0D 0A 1A 0A
    expect(pngBuf.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(pngBuf.length).toBeGreaterThan(50);
    expect(pngBuf.toString("ascii")).toContain("IHDR");
    expect(pngBuf.toString("ascii")).toContain("IEND");
  });
});
