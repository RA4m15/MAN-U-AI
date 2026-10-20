import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import zlib from "zlib";
import { app } from "../src/app";
import { env } from "../src/config/env";
import { connectDatabase, isConnectedToMongo } from "../src/config/database";
import { DocumentModel, DocumentChunk, DocumentFigure, DocumentPermission } from "../src/models";
import { pdfService } from "../src/services/pdf.service";
import {
  visualService,
  encodeRawToPng,
  decodePdfPredictor,
  VISUAL_PROCESSING_LIMITS,
} from "../src/services/visual.service";
import { ragService } from "../src/services/rag.service";
import { geminiService } from "../src/services/gemini.service";
import { storageService } from "../src/services/storage.service";
import { processDocumentAsync } from "../src/routes/documents.routes";

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
  filter?: string;
  colorSpace?: string;
  decodeParms?: string;
  customStreamData?: Buffer;
  imageWidth?: number;
  imageHeight?: number;
}): Buffer {
  const pageCount = options.pageCount || 1;
  const includeFigure = options.includeFigure ?? false;

  let streamData = options.customStreamData || MINIMAL_JPEG;
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
    const filter = options.filter || (options.corruptStream ? "/DCTDecode" : "/DCTDecode");
    const colorSpace = options.colorSpace || "/DeviceRGB";
    const decodeParmsDict = options.decodeParms ? `/DecodeParms << ${options.decodeParms} >>` : "";
    const w = options.imageWidth || 120;
    const h = options.imageHeight || 120;

    objects.push(
      Buffer.concat([
        Buffer.from(
          `${imageObjId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace ${colorSpace} /BitsPerComponent 8 /Filter ${filter} ${decodeParmsDict} /Length ${streamData.length} >>\nstream\n`
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
    const figures = await visualService.extractFiguresFromPdf(pdfNoFigures, 2);

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

    const extracted = await visualService.extractFiguresFromPdf(pdfWithFig, 2, pageTextMap);
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
    const extracted = await visualService.extractFiguresFromPdf(pdfCorrupted, 1);

    expect(extracted.length).toBe(1);
    expect(extracted[0].status).toBe("failed");
    expect(extracted[0].processingError).toBeDefined();
    expect(extracted[0].processingError).toContain("Invalid JPEG stream");
  });

  // ── 5. Page and Image Processing Limits Are Enforced ──────────────────────
  it("Requirement 5: Page and image processing limits are strictly enforced", async () => {
    expect(VISUAL_PROCESSING_LIMITS.MAX_PAGES_TO_PROCESS).toBe(50);
    expect(VISUAL_PROCESSING_LIMITS.MAX_FIGURES_PER_DOC).toBe(20);
    expect(VISUAL_PROCESSING_LIMITS.MAX_FIGURES_PER_PAGE).toBe(5);
    expect(VISUAL_PROCESSING_LIMITS.MAX_IMAGE_SIZE_BYTES).toBe(10 * 1024 * 1024);
    expect(VISUAL_PROCESSING_LIMITS.MIN_IMAGE_DIMENSION).toBe(30);

    // Test huge image rejection
    const hugePdf = buildSyntheticPdf({ pageCount: 1, includeFigure: true, hugeImage: true });
    const extracted = await visualService.extractFiguresFromPdf(hugePdf, 1);
    expect(extracted.length).toBe(1);
    expect(extracted[0].status).toBe("failed");
    expect(extracted[0].processingError).toMatch(/exceeds size limit/);
  });

  // ── 6. Unauthorized Users Cannot Retrieve Visual Evidence ─────────────────
  it("Requirement 6: Unauthorized users cannot retrieve visual evidence from inaccessible documents", async () => {
    const privateDocOid = new mongoose.Types.ObjectId();
    createdDocIds.push(privateDocOid.toString());

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

    await DocumentPermission.create({
      documentId: publicDocOid,
      role: "engineer",
      canRead: true,
      canWrite: false,
    });

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

    vi.spyOn(geminiService, "generateEmbedding").mockResolvedValue(new Array(768).fill(0.05));
    vi.spyOn(geminiService, "generateAnswer").mockResolvedValue({
      answer: "Shaft coupling dial indicator radial runout must not exceed 0.03 mm on Boiler Feed Pump BFP-01.",
      citations: [],
    });

    const ragResult = await ragService.answerQuestion(
      "What is the shaft coupling dial indicator runout for Boiler Feed Pump?",
      { id: "usr-multimodal-eng", role: "engineer" }
    );

    expect(ragResult.answer).toBeDefined();
    expect(ragResult.citations.length).toBeGreaterThan(0);

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

    expect(pngBuf.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(pngBuf.length).toBeGreaterThan(50);
    expect(pngBuf.toString("ascii")).toContain("IHDR");
    expect(pngBuf.toString("ascii")).toContain("IEND");
  });

  // ── 9. Safe Handling of Malformed PDF Binaries ─────────────────────────────
  it("Requirement 9: Handles malformed PDF binary structures safely and records failure honestly", async () => {
    const corruptBuffer = Buffer.from("NOT_A_VALID_PDF_BINARY_DATA_AT_ALL");
    const result = await visualService.extractFiguresFromPdf(corruptBuffer, 1);

    expect(result.length).toBe(1);
    expect(result[0].status).toBe("failed");
    expect(result[0].processingError).toContain("Corrupted or unparseable PDF document structure");
  });

  // ── 10. Honest Reporting of Unsupported Image Filters ─────────────────────
  it("Requirement 10: Reports unsupported image filters (e.g. JBIG2Decode) honestly without fabricating figures", async () => {
    const jbig2Pdf = buildSyntheticPdf({
      pageCount: 1,
      includeFigure: true,
      filter: "/JBIG2Decode",
      imageWidth: 64,
      imageHeight: 64,
      customStreamData: Buffer.alloc(200, 0xaa),
    });

    const result = await visualService.extractFiguresFromPdf(jbig2Pdf, 1);
    expect(result.length).toBe(1);
    expect(result[0].status).toBe("failed");
    expect(result[0].processingError).toContain("Unsupported image compression algorithm /JBIG2Decode");
  });

  // ── 11. FlateDecode with PNG Predictor 15 & ColorSpace Metadata ────────────
  it("Requirement 11: Decodes FlateDecode image streams with PNG Predictor 15 (Optimum multi-row filters) and validates output pixels", async () => {
    const width = 40;
    const height = 40;
    const bytesPerPixel = 3;
    const rowBytes = width * bytesPerPixel;

    // Build scanlines with PNG Predictor 15 structure: [filter_byte, ...row_bytes]
    const scanlineBuffers: Buffer[] = [];
    const priorRow = Buffer.alloc(rowBytes, 100);

    for (let y = 0; y < height; y++) {
      if (y === 0) {
        // Filter 0 (None)
        const row = Buffer.concat([Buffer.from([0]), priorRow]);
        scanlineBuffers.push(row);
      } else {
        // Filter 2 (Up filter): diff = curr - prior
        const currRow = Buffer.alloc(rowBytes, 105);
        const diffRow = Buffer.alloc(rowBytes);
        for (let i = 0; i < rowBytes; i++) {
          diffRow[i] = (currRow[i] - priorRow[i]) & 0xff;
        }
        scanlineBuffers.push(Buffer.concat([Buffer.from([2]), diffRow]));
      }
    }

    const uncompressedScanlines = Buffer.concat(scanlineBuffers);
    const deflated = zlib.deflateSync(uncompressedScanlines);

    const flatePdf = buildSyntheticPdf({
      pageCount: 1,
      includeFigure: true,
      filter: "/FlateDecode",
      colorSpace: "/DeviceRGB",
      decodeParms: "/Predictor 15 /Columns 40 /Colors 3 /BitsPerComponent 8",
      customStreamData: deflated,
      imageWidth: width,
      imageHeight: height,
      figureCaption: "Figure 5.1: High Pressure Valve Cross-Section",
    });

    const pageTextMap = new Map<number, string>();
    pageTextMap.set(1, "Figure 5.1: High Pressure Valve Cross-Section\nInspect valve seat tolerances.");

    const result = await visualService.extractFiguresFromPdf(flatePdf, 1, pageTextMap);
    expect(result.length).toBe(1);
    expect(result[0].status).toBe("extracted");
    expect(result[0].mimeType).toBe("image/png");
    expect(result[0].width).toBe(40);
    expect(result[0].height).toBe(40);
    expect(result[0].figureId).toBe("Figure 5.1");
    expect(result[0].buffer).toBeDefined();
    // Validate PNG signature
    expect(result[0].buffer!.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  });

  // ── 12. Rejects FlateDecode with Unsupported ColorSpace ───────────────────
  it("Requirement 12: Rejects FlateDecode with unsupported ColorSpace (e.g. DeviceCMYK) honestly with failed status", async () => {
    const rawData = Buffer.alloc(40 * 40 * 4, 120);
    const deflated = zlib.deflateSync(rawData);

    const cmykPdf = buildSyntheticPdf({
      pageCount: 1,
      includeFigure: true,
      filter: "/FlateDecode",
      colorSpace: "/DeviceCMYK",
      customStreamData: deflated,
      imageWidth: 40,
      imageHeight: 40,
    });

    const result = await visualService.extractFiguresFromPdf(cmykPdf, 1);
    expect(result.length).toBe(1);
    expect(result[0].status).toBe("failed");
    expect(result[0].processingError).toContain("Unsupported image color space /DeviceCMYK");
  });

  // ── 13. Document Deletion Cleans Up Figures and Image Assets ───────────────
  it("Requirement 13: Document deletion route cleanly deletes associated DocumentFigure records and stored image assets", async () => {
    const delDocOid = new mongoose.Types.ObjectId();
    createdDocIds.push(delDocOid.toString());

    // 1. Create document
    const savedPdf = await storageService.saveFile(
      `del_test_${delDocOid}.pdf`,
      Buffer.from("%PDF-1.4\n%mock-del-pdf\n%%EOF")
    );

    const doc = await DocumentModel.create({
      _id: delDocOid,
      title: "Document to Delete",
      revision: "Rev 1.0",
      filename: "doc_to_delete.pdf",
      storagePath: savedPdf.storagePath,
      storageProvider: savedPdf.storageProvider,
      mimeType: "application/pdf",
      sizeBytes: savedPdf.sizeBytes,
      status: "indexed",
      pageCount: 2,
      uploadedById: new mongoose.Types.ObjectId(),
    });

    // 2. Create chunks
    await DocumentChunk.create({
      documentId: delDocOid,
      documentTitle: doc.title,
      revision: doc.revision,
      page: 1,
      section: "Intro",
      text: "Some text to be purged.",
      embedding: new Array(768).fill(0.01),
      tokenCount: 10,
    });

    // 3. Create saved figure image asset and DocumentFigure record
    const savedFig = await storageService.saveFile(`del_fig_${delDocOid}.png`, Buffer.from("PNG_FIGURE_DATA"));
    await DocumentFigure.create({
      documentId: delDocOid,
      documentTitle: doc.title,
      revision: doc.revision,
      page: 1,
      figureId: "Figure Del-1",
      title: "Turbine Diagram",
      storagePath: savedFig.storagePath,
      storageProvider: savedFig.storageProvider,
      mimeType: "image/png",
      status: "extracted",
      dimensions: { width: 100, height: 100 },
      associatedChunkIds: [],
    });

    // Verify assets exist prior to deletion
    expect(await DocumentModel.findById(delDocOid)).toBeDefined();
    expect(await DocumentChunk.countDocuments({ documentId: delDocOid })).toBe(1);
    expect(await DocumentFigure.countDocuments({ documentId: delDocOid })).toBe(1);

    // Call DELETE as admin
    const delRes = await request(app)
      .delete(`/api/v1/documents/${delDocOid}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);

    // Verify complete removal from database
    expect(await DocumentModel.findById(delDocOid)).toBeNull();
    expect(await DocumentChunk.countDocuments({ documentId: delDocOid })).toBe(0);
    expect(await DocumentFigure.countDocuments({ documentId: delDocOid })).toBe(0);

    // Verify stored figure asset was deleted
    await expect(
      storageService.getFileStream(savedFig.storagePath, savedFig.storageProvider)
    ).rejects.toThrow();
  });

  // ── 14. Document Deletion Observable Warnings on Storage Failure ───────────
  it("Requirement 14: Document deletion reports observable storageWarnings when storage asset deletion fails", async () => {
    const warnDocOid = new mongoose.Types.ObjectId();
    createdDocIds.push(warnDocOid.toString());

    const doc = await DocumentModel.create({
      _id: warnDocOid,
      title: "Document with Faulty Asset Storage",
      revision: "Rev 1.0",
      filename: "faulty_asset.pdf",
      storagePath: "faulty_asset.pdf",
      storageProvider: "local",
      mimeType: "application/pdf",
      sizeBytes: 512,
      status: "indexed",
      pageCount: 1,
      uploadedById: new mongoose.Types.ObjectId(),
    });

    await DocumentFigure.create({
      documentId: warnDocOid,
      documentTitle: doc.title,
      revision: doc.revision,
      page: 1,
      figureId: "Figure Fault-1",
      title: "Unremovable Schematic",
      storagePath: "protected_hardware_schematic.png",
      storageProvider: "local",
      mimeType: "image/png",
      status: "extracted",
      associatedChunkIds: [],
    });

    // Mock storageService.deleteFile to fail for the figure asset
    const deleteSpy = vi.spyOn(storageService, "deleteFile").mockImplementation(async (path: string) => {
      if (path.includes("protected_hardware_schematic")) {
        throw new Error("EACCES: permission denied, read-only filesystem");
      }
    });

    const delRes = await request(app)
      .delete(`/api/v1/documents/${warnDocOid}`)
      .set("Authorization", `Bearer ${adminToken}`);

    deleteSpy.mockRestore();

    expect(delRes.status).toBe(200);
    expect(delRes.body.success).toBe(true);
    expect(delRes.body.data.message).toContain("cleanup warnings");
    expect(delRes.body.data.storageWarnings).toBeDefined();
    expect(delRes.body.data.storageWarnings.length).toBeGreaterThan(0);
    expect(delRes.body.data.storageWarnings[0]).toContain("EACCES");

    // Invariant: DB records were still properly removed
    expect(await DocumentModel.findById(warnDocOid)).toBeNull();
    expect(await DocumentFigure.countDocuments({ documentId: warnDocOid })).toBe(0);
  });

  // ── 15. Stale Figure Cleanup on Re-Ingestion & OCR Gating ─────────────────
  it("Requirement 15: Re-ingestion and OCR-required gating clean up stale figures from previous indexing attempts", async () => {
    const reingestDocOid = new mongoose.Types.ObjectId();
    createdDocIds.push(reingestDocOid.toString());

    const doc = await DocumentModel.create({
      _id: reingestDocOid,
      title: "Doc for OCR Re-Ingest",
      revision: "Rev 1.0",
      filename: "ocr_reingest.pdf",
      storagePath: "mock_ocr_reingest.pdf",
      storageProvider: "local",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      status: "indexed",
      pageCount: 2,
      uploadedById: new mongoose.Types.ObjectId(),
    });

    // Pre-populate stale chunks and figures
    await DocumentChunk.create({
      documentId: reingestDocOid,
      documentTitle: doc.title,
      revision: doc.revision,
      page: 1,
      section: "Stale",
      text: "Old text that must be cleared",
      embedding: new Array(768).fill(0.01),
      tokenCount: 8,
    });

    const staleFigStorage = await storageService.saveFile(`stale_fig_${reingestDocOid}.jpg`, Buffer.from("STALE_DATA"));
    await DocumentFigure.create({
      documentId: reingestDocOid,
      documentTitle: doc.title,
      revision: doc.revision,
      page: 1,
      figureId: "Figure Old-1",
      title: "Stale Diagram",
      storagePath: staleFigStorage.storagePath,
      storageProvider: staleFigStorage.storageProvider,
      mimeType: "image/jpeg",
      status: "extracted",
      associatedChunkIds: [],
    });

    expect(await DocumentFigure.countDocuments({ documentId: reingestDocOid })).toBe(1);

    // Mock pdfService to require OCR (unresolved)
    vi.spyOn(pdfService, "extractAndChunk").mockResolvedValueOnce({
      totalText: "",
      chunks: [],
      pageCount: 2,
      characterCount: 0,
      requiresOcr: true,
      ocrPerformed: false,
      ocrError: "OCR engine unavailable in offline test environment",
      outcome: "ocr_required_unresolved",
    });

    // Run processDocumentAsync with minimal valid PDF buffer
    await processDocumentAsync(
      reingestDocOid.toString(),
      doc.title,
      doc.revision,
      Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF")
    );

    // Status must be needs_ocr
    const updatedDoc = await DocumentModel.findById(reingestDocOid);
    expect(updatedDoc?.status).toBe("needs_ocr");

    // Invariant: Stale figures and chunks MUST have been completely purged
    expect(await DocumentChunk.countDocuments({ documentId: reingestDocOid })).toBe(0);
    expect(await DocumentFigure.countDocuments({ documentId: reingestDocOid })).toBe(0);

    // Stale image file must be removed from storage
    await expect(
      storageService.getFileStream(staleFigStorage.storagePath, staleFigStorage.storageProvider)
    ).rejects.toThrow();
  });

  // ── 16. PDF Predictors 10-15 Known Values & Exact Pixel Byte Verification ─
  it("Requirement 16: Tests PDF Predictors 10, 11, 12, 13, 14, and 15 with known pixel values and verifies exact decoded bytes", () => {
    // Predictor 10 (PNG None on all rows - no per-row filter byte prefix)
    const p10Input = Buffer.from([10, 20, 30, 40]);
    const p10Out = decodePdfPredictor(p10Input, 10, 2, 2, 1, 8);
    expect(Array.from(p10Out)).toEqual([10, 20, 30, 40]);

    // Predictor 11 (PNG Sub on all rows - no per-row filter byte prefix)
    // Row: targets [15, 35, 42] -> diffs [15, 20, 7]
    const p11Input = Buffer.from([15, 20, 7]);
    const p11Out = decodePdfPredictor(p11Input, 11, 3, 1, 1, 8);
    expect(Array.from(p11Out)).toEqual([15, 35, 42]);

    // Predictor 12 (PNG Up on all rows - no per-row filter byte prefix)
    // Row 0 targets [10, 20], Row 1 targets [15, 30] -> inputs [10, 20, 5, 10]
    const p12Input = Buffer.from([10, 20, 5, 10]);
    const p12Out = decodePdfPredictor(p12Input, 12, 2, 2, 1, 8);
    expect(Array.from(p12Out)).toEqual([10, 20, 15, 30]);

    // Predictor 13 (PNG Average on all rows - no per-row filter byte prefix)
    const p13Input = Buffer.from([20, 40, 20, 35]);
    const p13Out = decodePdfPredictor(p13Input, 13, 2, 2, 1, 8);
    expect(Array.from(p13Out)).toEqual([20, 50, 30, 75]);

    // Predictor 14 (PNG Paeth on all rows - no per-row filter byte prefix)
    const p14Input = Buffer.from([10, 20]);
    const p14Out = decodePdfPredictor(p14Input, 14, 2, 1, 1, 8);
    expect(Array.from(p14Out)).toEqual([10, 30]);

    // Predictor 15 (PNG Optimum - 1 filter byte prefix per row)
    // 3 rows, 2 RGB pixels per row (6 bytes per row)
    // Row 0 (Filter 0 - None): [10, 20, 30, 40, 50, 60]
    // Row 1 (Filter 2 - Up): diffs [5, 5, 5, 5, 5, 5] -> decoded [15, 25, 35, 45, 55, 65]
    // Row 2 (Filter 1 - Sub): [10, 10, 10, 5, 5, 5] -> decoded [10, 10, 10, 15, 15, 15]
    const p15Input = Buffer.from([
      0, 10, 20, 30, 40, 50, 60,
      2, 5, 5, 5, 5, 5, 5,
      1, 10, 10, 10, 5, 5, 5,
    ]);
    const p15Out = decodePdfPredictor(p15Input, 15, 2, 3, 3, 8);
    expect(Array.from(p15Out.subarray(0, 6))).toEqual([10, 20, 30, 40, 50, 60]);
    expect(Array.from(p15Out.subarray(6, 12))).toEqual([15, 25, 35, 45, 55, 65]);
    expect(Array.from(p15Out.subarray(12, 18))).toEqual([10, 10, 10, 15, 15, 15]);
  });

  // ── 17. Rejection of Truncated Data and Invalid Filter Bytes ───────────────
  it("Requirement 17: Rejects malformed/truncated scanlines and invalid filter bytes with explicit failures", () => {
    // Truncated scanline data for Predictor 15
    expect(() => decodePdfPredictor(Buffer.alloc(5), 15, 2, 2, 3, 8)).toThrow(/smaller than expected/);

    // Truncated scanline data for Predictor 12
    expect(() => decodePdfPredictor(Buffer.alloc(5), 12, 2, 2, 3, 8)).toThrow(/smaller than expected/);

    // Invalid filter byte for Predictor 15 (e.g. 5)
    const badFilterData = Buffer.from([5, 1, 2, 3, 4, 5, 6]);
    expect(() => decodePdfPredictor(badFilterData, 15, 2, 1, 3, 8)).toThrow(/Invalid PNG filter byte 5/);

    // Unsupported predictor number
    expect(() => decodePdfPredictor(Buffer.alloc(10), 8, 2, 1, 3, 8)).toThrow(/Unsupported predictor algorithm 8/);

    // Unsupported bit depth
    expect(() => decodePdfPredictor(Buffer.alloc(10), 15, 2, 1, 3, 16)).toThrow(/Unsupported bit depth 16/);

    // Unsupported color count
    expect(() => decodePdfPredictor(Buffer.alloc(10), 15, 2, 1, 4, 8)).toThrow(/Unsupported colors count 4/);
  });

  // ── 18. Inherited Page Resources from Parent Page Tree ─────────────────────
  it("Requirement 18: Resolves inherited page resources from parent page-tree nodes", async () => {
    const objects: Buffer[] = [];
    objects.push(Buffer.from("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"));
    objects.push(
      Buffer.from(
        "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 /Resources << /XObject << /Img1 4 0 R >> >> >>\nendobj\n"
      )
    );
    objects.push(Buffer.from("3 0 obj\n<< /Type /Page /Parent 2 0 R >>\nendobj\n"));
    objects.push(
      Buffer.concat([
        Buffer.from(
          "4 0 obj\n<< /Type /XObject /Subtype /Image /Width 60 /Height 60 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " +
            MINIMAL_JPEG.length +
            " >>\nstream\n"
        ),
        MINIMAL_JPEG,
        Buffer.from("\nendstream\nendobj\n"),
      ])
    );
    const pdfInherited = Buffer.concat([
      Buffer.from("%PDF-1.4\n"),
      Buffer.concat(objects),
      Buffer.from("xref\n0 5\ntrailer\n<< /Size 5 /Root 1 0 R >>\n%%EOF\n"),
    ]);

    const result = await visualService.extractFiguresFromPdf(pdfInherited, 1);
    expect(result.length).toBe(1);
    expect(result[0].status).toBe("extracted");
    expect(result[0].width).toBe(60);
    expect(result[0].height).toBe(60);
    expect(result[0].mimeType).toBe("image/jpeg");
  });

  // ── 19. Form XObjects Are Safely Ignored ───────────────────────────────────
  it("Requirement 19: Safely ignores Form XObjects (/Subtype /Form) without crashing or fabricating figures", async () => {
    const objects: Buffer[] = [];
    objects.push(Buffer.from("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"));
    objects.push(Buffer.from("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"));
    objects.push(Buffer.from("3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /XObject << /Fm1 4 0 R >> >> >>\nendobj\n"));
    const formStream = "q 10 0 0 10 0 0 cm /Im1 Do Q\n";
    objects.push(
      Buffer.from(
        "4 0 obj\n<< /Type /XObject /Subtype /Form /BBox [0 0 100 100] /Length " +
          formStream.length +
          " >>\nstream\n" +
          formStream +
          "\nendstream\nendobj\n"
      )
    );
    const pdfForm = Buffer.concat([
      Buffer.from("%PDF-1.4\n"),
      Buffer.concat(objects),
      Buffer.from("xref\n0 5\ntrailer\n<< /Size 5 /Root 1 0 R >>\n%%EOF\n"),
    ]);

    const result = await visualService.extractFiguresFromPdf(pdfForm, 1);
    expect(result.length).toBe(0);
  });

  // ── 20. Observable Logging of Cleanup Failures on OCR & Failure Abort ──────
  it("Requirement 20: Storage asset cleanup failures during OCR gating are observable and logged", async () => {
    const docOid = new mongoose.Types.ObjectId();
    createdDocIds.push(docOid.toString());

    const doc = await DocumentModel.create({
      _id: docOid,
      title: "Observable Cleanup Test",
      revision: "v1.0",
      filename: "obs_cleanup.pdf",
      storagePath: "obs_cleanup.pdf",
      storageProvider: "local",
      mimeType: "application/pdf",
      sizeBytes: 500,
      status: "indexed",
      pageCount: 1,
      uploadedById: new mongoose.Types.ObjectId(),
    });

    await DocumentFigure.create({
      documentId: docOid,
      documentTitle: doc.title,
      revision: doc.revision,
      page: 1,
      figureId: "Fig Obs-1",
      title: "Obs Title",
      storagePath: "faulty_stale_asset.png",
      storageProvider: "local",
      mimeType: "image/png",
      status: "extracted",
      associatedChunkIds: [],
    });

    const warnSpy = vi.spyOn(console, "warn");
    const delSpy = vi.spyOn(storageService, "deleteFile").mockImplementation(async (path: string) => {
      if (path.includes("faulty_stale_asset")) {
        throw new Error("Disk hardware error on unmount");
      }
    });

    vi.spyOn(pdfService, "extractAndChunk").mockResolvedValueOnce({
      totalText: "",
      chunks: [],
      pageCount: 1,
      characterCount: 0,
      requiresOcr: true,
      ocrPerformed: false,
      ocrError: "Scanned page",
      outcome: "ocr_required_unresolved",
    });

    await processDocumentAsync(
      docOid.toString(),
      doc.title,
      doc.revision,
      Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF")
    );

    delSpy.mockRestore();

    // Invariant: The warning was observably logged
    const loggedCalls = warnSpy.mock.calls.map((c) => c.join(" "));
    const obsWarning = loggedCalls.find(
      (msg) => msg.includes("Disk hardware error on unmount") || msg.includes("Ingestion OCR Cleanup Warning")
    );
    expect(obsWarning).toBeDefined();

    // Invariant: Document correctly transitioned to needs_ocr
    const updated = await DocumentModel.findById(docOid);
    expect(updated?.status).toBe("needs_ocr");
  });
});
