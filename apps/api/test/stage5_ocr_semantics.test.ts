import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import mongoose from "mongoose";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import { env } from "../src/config/env";
import { connectDatabase, isConnectedToMongo, setIsConnectedToMongo } from "../src/config/database";
import { DocumentModel, DocumentChunk } from "../src/models";
import { pdfService, isValidPdfSignature } from "../src/services/pdf.service";
import { geminiService } from "../src/services/gemini.service";
import { storageService } from "../src/services/storage.service";
import * as socketEvents from "../src/index";
import { processDocumentAsync } from "../src/routes/documents.routes";

// Mock pdf-parse so we can precisely control parser behavior across test scenarios
let mockParseBehavior: {
  numpages: number;
  text: string;
  shouldThrow?: boolean;
} = {
  numpages: 1,
  text: "Default digital text with enough length to simulate a normal manual with multiple sentences.",
};

vi.mock("pdf-parse", () => {
  return {
    default: vi.fn(async () => {
      if (mockParseBehavior.shouldThrow) {
        throw new Error("Corrupted or unreadable PDF stream structure");
      }
      return {
        numpages: mockParseBehavior.numpages,
        text: mockParseBehavior.text,
      };
    }),
  };
});

describe("Stage 5 — OCR Outcome Semantics & Ingestion Gating Suite", () => {
  let engineerToken: string;
  let engineerId: string;
  const validDummyPdf = Buffer.from(
    "%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< >>\n%%EOF"
  );

  beforeAll(async () => {
    await connectDatabase();

    engineerId = "usr-eng-ocr-test";
    engineerToken = jwt.sign(
      { id: engineerId, email: "engineer.ocr@plant.io", name: "Engineer OCR", role: "engineer" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );
  });

  afterAll(async () => {
    if (isConnectedToMongo) {
      await DocumentModel.deleteMany({ title: /OCR Semantics Test/ });
    }
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    mockParseBehavior = {
      numpages: 1,
      text: "Default digital text with enough length to simulate a normal manual with multiple sentences.",
      shouldThrow: false,
    };
  });

  // Outcome 1: Normal digital text successfully extracted
  it("Outcome 1: Distinguishes normal digital text successfully extracted", async () => {
    mockParseBehavior = {
      numpages: 2,
      text: "--- PAGE 1 ---\nCentrifugal Pump Maintenance Manual. Inspect impeller wear rings and ensure seal face alignment.\n\n--- PAGE 2 ---\nTorque specifications: M16 casing bolts to 110 Nm in cross-pattern.",
    };

    const result = await pdfService.extractAndChunk(validDummyPdf, "Pump Manual");

    expect(result.outcome).toBe("digital_text_extracted");
    expect(result.requiresOcr).toBe(false);
    expect(result.ocrPerformed).toBe(false);
    expect(result.pageCount).toBe(2);
    expect(result.chunks.length).toBeGreaterThanOrEqual(1);
    expect(result.totalText).toContain("Centrifugal Pump Maintenance");
  });

  // Outcome 2: OCR successfully performed and genuine text returned
  it("Outcome 2: Distinguishes successful OCR and ensures requiresOcr is false", async () => {
    // Low-text PDF (empty or whitespace only)
    mockParseBehavior = {
      numpages: 1,
      text: "   ",
    };

    vi.spyOn(geminiService, "isLiveClientConfigured").mockReturnValue(true);
    vi.spyOn(geminiService, "transcribePdfWithOcr").mockResolvedValue(
      "--- PAGE 1 ---\nSCANNED BLUEPRINT 402: Emergency shutoff valve actuator lever replacement procedure. Verify zero hydraulic line pressure."
    );

    const result = await pdfService.extractAndChunk(validDummyPdf, "Scanned Blueprint 402");

    expect(result.outcome).toBe("ocr_success");
    // CRITICAL: Do not leave requiresOcr: true after successful OCR
    expect(result.requiresOcr).toBe(false);
    expect(result.ocrPerformed).toBe(true);
    expect(result.totalText).toContain("Emergency shutoff valve actuator");
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0].text).toContain("Emergency shutoff valve actuator");
  });

  // Outcome 3a: OCR required but failed with error
  it("Outcome 3a: Distinguishes OCR required but failed with transcription error", async () => {
    mockParseBehavior = {
      numpages: 1,
      text: "",
    };

    vi.spyOn(geminiService, "isLiveClientConfigured").mockReturnValue(true);
    vi.spyOn(geminiService, "transcribePdfWithOcr").mockRejectedValue(
      new Error("Gemini multimodal transcription quota exceeded or timeout")
    );

    const result = await pdfService.extractAndChunk(validDummyPdf, "Failed OCR Manual");

    expect(result.outcome).toBe("ocr_required_unresolved");
    expect(result.requiresOcr).toBe(true);
    expect(result.ocrPerformed).toBe(true);
    expect(result.chunks).toEqual([]);
    expect(result.ocrError).toContain("Gemini multimodal transcription quota exceeded");
  });

  // Outcome 3b: OCR required but unavailable (multimodal client unconfigured)
  it("Outcome 3b: Distinguishes OCR required but unavailable in current environment", async () => {
    mockParseBehavior = {
      numpages: 1,
      text: "  short  ",
    };

    vi.spyOn(geminiService, "isLiveClientConfigured").mockReturnValue(false);

    const result = await pdfService.extractAndChunk(validDummyPdf, "Unavailable OCR Manual");

    expect(result.outcome).toBe("ocr_required_unresolved");
    expect(result.requiresOcr).toBe(true);
    expect(result.ocrPerformed).toBe(false);
    expect(result.chunks).toEqual([]);
    expect(result.ocrError).toContain("not configured");
  });

  // Outcome 3c: OCR performed but returned unreadable or empty text (< 30 characters)
  it("Outcome 3c: Distinguishes OCR that returned unreadable or insufficient text", async () => {
    mockParseBehavior = {
      numpages: 1,
      text: "",
    };

    vi.spyOn(geminiService, "isLiveClientConfigured").mockReturnValue(true);
    // Returns unreadable artifacts or empty text
    vi.spyOn(geminiService, "transcribePdfWithOcr").mockResolvedValue("??? ### ... ");

    const result = await pdfService.extractAndChunk(validDummyPdf, "Garbled Scan Manual");

    expect(result.outcome).toBe("ocr_required_unresolved");
    expect(result.requiresOcr).toBe(true);
    expect(result.ocrPerformed).toBe(true);
    expect(result.chunks).toEqual([]);
    expect(result.ocrError).toContain("empty or unreadable");
  });

  // Outcome 4: PDF extraction failed for another reason (invalid signature or corrupt structure)
  it("Outcome 4: Distinguishes extraction failed for non-OCR reasons", async () => {
    const invalidSignatureBuffer = Buffer.from("NOT_A_VALID_PDF_HEADER_12345678901234567890123456789012345678901234567890");

    // extractSafe returns outcome: "extraction_failed"
    const safeResult = await pdfService.extractSafe(invalidSignatureBuffer, "Invalid Signature Doc");
    expect(safeResult.outcome).toBe("extraction_failed");
    expect(safeResult.requiresOcr).toBe(false);
    expect(safeResult.ocrPerformed).toBe(false);
    expect(safeResult.error).toContain("Invalid PDF signature");

    // extractAndChunk with throwOnError=false returns outcome: "extraction_failed"
    const resultNoThrow = await pdfService.extractAndChunk(invalidSignatureBuffer, "Invalid Signature Doc", { throwOnError: false });
    expect(resultNoThrow.outcome).toBe("extraction_failed");

    // extractAndChunk default throws for backward compatibility
    await expect(pdfService.extractAndChunk(invalidSignatureBuffer, "Invalid Signature Doc")).rejects.toThrow("Invalid PDF signature");
  });

  it("Outcome 4b: Distinguishes corrupt internal PDF structure as extraction_failed", async () => {
    mockParseBehavior = {
      numpages: 1,
      text: "",
      shouldThrow: true,
    };

    const safeResult = await pdfService.extractSafe(validDummyDummyBuffer(), "Corrupted Doc");
    expect(safeResult.outcome).toBe("extraction_failed");
    expect(safeResult.error).toContain("Corrupted or unreadable PDF stream");
  });

  // End-to-end Ingestion Gating: When OCR unresolved, persist needs_ocr and do not generate embeddings
  it("Ingestion Gating: Persists needs_ocr and generates ZERO embeddings when OCR unresolved", async () => {
    mockParseBehavior = {
      numpages: 1,
      text: " ", // low text triggers OCR
    };

    // OCR fails
    vi.spyOn(geminiService, "isLiveClientConfigured").mockReturnValue(true);
    vi.spyOn(geminiService, "transcribePdfWithOcr").mockRejectedValue(new Error("OCR engine unavailable"));
    const embeddingSpy = vi.spyOn(geminiService, "generateEmbedding");
    vi.spyOn(storageService, "saveFile").mockResolvedValueOnce({
      storagePath: "/mock/ocr_fail.pdf",
      sizeBytes: validDummyPdf.length,
      storageProvider: "local",
    });

    const res = await request(app)
      .post("/api/v1/documents/upload")
      .set("Authorization", `Bearer ${engineerToken}`)
      .attach("file", validDummyPdf, "ocr_unresolved.pdf")
      .field("title", "OCR Semantics Test Unresolved")
      .field("revision", "Rev A");

    expect(res.status).toBe(202);
    const docId = res.body.data.id;

    // Poll until processing completes and document reaches terminal status
    let attempts = 0;
    let finalStatus = "";
    while (attempts < 30) {
      await new Promise((r) => setTimeout(r, 100));
      const statusRes = await request(app)
        .get(`/api/v1/documents/${docId}/status`)
        .set("Authorization", `Bearer ${engineerToken}`);
      finalStatus = statusRes.body?.data?.status;
      if (finalStatus === "needs_ocr" || finalStatus === "failed" || finalStatus === "indexed") {
        break;
      }
      attempts++;
    }

    expect(finalStatus).toBe("needs_ocr");

    // Invariant: No embeddings were generated
    expect(embeddingSpy).not.toHaveBeenCalled();

    // Invariant: No chunks were indexed in database
    if (isConnectedToMongo) {
      const chunkCount = await DocumentChunk.countDocuments({ documentId: docId });
      expect(chunkCount).toBe(0);
    }
  });

  // End-to-end Ingestion Gating: When OCR succeeds, persist indexed and generate embeddings
  it("Ingestion Gating: Indexes chunks and sets status indexed when OCR succeeds with genuine text", async () => {
    mockParseBehavior = {
      numpages: 1,
      text: " ", // low text triggers OCR
    };

    // OCR succeeds
    vi.spyOn(geminiService, "isLiveClientConfigured").mockReturnValue(true);
    vi.spyOn(geminiService, "transcribePdfWithOcr").mockResolvedValue(
      "--- PAGE 1 ---\nGENUINE OCR TEXT: Section 4.1 Oil Lubrication Interval. Replace turbine oil every 4000 operational hours."
    );
    const embeddingSpy = vi.spyOn(geminiService, "generateEmbedding").mockResolvedValue(new Array(768).fill(0.01));
    vi.spyOn(storageService, "saveFile").mockResolvedValueOnce({
      storagePath: "/mock/ocr_success.pdf",
      sizeBytes: validDummyPdf.length,
      storageProvider: "local",
    });

    const res = await request(app)
      .post("/api/v1/documents/upload")
      .set("Authorization", `Bearer ${engineerToken}`)
      .attach("file", validDummyPdf, "ocr_success.pdf")
      .field("title", "OCR Semantics Test Success")
      .field("revision", "Rev B");

    expect(res.status).toBe(202);
    const docId = res.body.data.id;

    let attempts = 0;
    let finalStatus = "";
    while (attempts < 30) {
      await new Promise((r) => setTimeout(r, 100));
      const statusRes = await request(app)
        .get(`/api/v1/documents/${docId}/status`)
        .set("Authorization", `Bearer ${engineerToken}`);
      finalStatus = statusRes.body?.data?.status;
      if (finalStatus === "indexed" || finalStatus === "needs_ocr" || finalStatus === "failed") {
        break;
      }
      attempts++;
    }

    expect(finalStatus).toBe("indexed");

    // Invariant: Embeddings were generated for genuine OCR text
    expect(embeddingSpy).toHaveBeenCalled();

    // Invariant: Chunks were persisted in database
    if (isConnectedToMongo) {
      const chunkCount = await DocumentChunk.countDocuments({ documentId: docId });
      expect(chunkCount).toBeGreaterThanOrEqual(1);

      const chunk = await DocumentChunk.findOne({ documentId: docId });
      expect(chunk?.text).toContain("Oil Lubrication Interval");
    }
  });

  // Missing Case 1: Unsupported image type rejection
  it("Requirement 4 & 5: Rejects PNG, JPG, and non-PDF uploads with UNSUPPORTED_FILE_TYPE", async () => {
    const pngBuffer = Buffer.from("\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01");
    const extractSpy = vi.spyOn(pdfService, "extractAndChunk");

    const pngRes = await request(app)
      .post("/api/v1/documents/upload")
      .set("Authorization", `Bearer ${engineerToken}`)
      .attach("file", pngBuffer, "schematic.png")
      .field("title", "Wiring Schematic PNG");

    expect(pngRes.status).toBe(400);
    expect(pngRes.body.success).toBe(false);
    expect(pngRes.body.error.code).toBe("UNSUPPORTED_FILE_TYPE");
    expect(pngRes.body.error.message).toContain("Only PDF documents are supported");

    // JPEG upload attempt
    const jpgBuffer = Buffer.from("\xFF\xD8\xFF\xE0\x00\x10JFIF");
    const jpgRes = await request(app)
      .post("/api/v1/documents/upload")
      .set("Authorization", `Bearer ${engineerToken}`)
      .attach("file", jpgBuffer, "bearing.jpg")
      .field("title", "Bearing Photo JPG");

    expect(jpgRes.status).toBe(400);
    expect(jpgRes.body.error.code).toBe("UNSUPPORTED_FILE_TYPE");

    // Invariant: Non-PDF files must never reach PDF parsing
    expect(extractSpy).not.toHaveBeenCalled();
  });

  // Missing Case 2: Persisted processing error visible through the document status, detail, and list APIs
  it("Requirement 2 & 5: Persisted processing error is visible in document status, detail, and list APIs", async () => {
    mockParseBehavior = {
      numpages: 1,
      text: " ", // low text
    };

    vi.spyOn(geminiService, "isLiveClientConfigured").mockReturnValue(true);
    vi.spyOn(geminiService, "transcribePdfWithOcr").mockRejectedValue(
      new Error("Gemini OCR upstream model server error: internal fault")
    );
    vi.spyOn(storageService, "saveFile").mockResolvedValueOnce({
      storagePath: "/mock/status_error_test.pdf",
      sizeBytes: validDummyPdf.length,
      storageProvider: "local",
    });

    const uploadRes = await request(app)
      .post("/api/v1/documents/upload")
      .set("Authorization", `Bearer ${engineerToken}`)
      .attach("file", validDummyPdf, "status_error_test.pdf")
      .field("title", "OCR Semantics Test Error Exposure");

    expect(uploadRes.status).toBe(202);
    const docId = uploadRes.body.data.id;

    // Poll until status reaches needs_ocr
    let finalStatus = "";
    let finalError = "";
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const statusRes = await request(app)
        .get(`/api/v1/documents/${docId}/status`)
        .set("Authorization", `Bearer ${engineerToken}`);
      finalStatus = statusRes.body?.data?.status;
      finalError = statusRes.body?.data?.processingError;
      if (finalStatus === "needs_ocr") break;
    }

    expect(finalStatus).toBe("needs_ocr");
    expect(finalError).toBeDefined();
    expect(finalError).toContain("Gemini OCR upstream model server error");
    expect(finalError).not.toContain("password");
    expect(finalError).not.toContain("stack");

    // Also verify detail API GET /documents/:id surfaces processingError
    const detailRes = await request(app)
      .get(`/api/v1/documents/${docId}`)
      .set("Authorization", `Bearer ${engineerToken}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.status).toBe("needs_ocr");
    expect(detailRes.body.data.processingError).toContain("Gemini OCR upstream model server error");

    // Also verify list API GET /documents surfaces processingError
    const listRes = await request(app)
      .get("/api/v1/documents")
      .set("Authorization", `Bearer ${engineerToken}`);
    expect(listRes.status).toBe(200);
    const found = listRes.body.data.find((d: any) => d.id === docId);
    expect(found).toBeDefined();
    expect(found.processingError).toContain("Gemini OCR upstream model server error");
  });

  // Missing Case 3: Partial vector-index failure cleans up all chunks and sets status failed
  it("Requirement 3 & 5: Partial chunk index failure cleans up existing chunks and marks status failed", async () => {
    mockParseBehavior = {
      numpages: 2,
      text: "--- PAGE 1 ---\nChunk 1 text: Boiler steam valve initial pressure check and gauge inspection.\n\n--- PAGE 2 ---\nChunk 2 text: Boiler steam valve replacement seals and torque tightness.",
    };

    let callCount = 0;
    vi.spyOn(geminiService, "generateEmbedding").mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return new Array(768).fill(0.01);
      }
      throw new Error("Simulated failure generating embedding on chunk 2");
    });
    vi.spyOn(storageService, "saveFile").mockResolvedValueOnce({
      storagePath: "/mock/partial_fail.pdf",
      sizeBytes: validDummyPdf.length,
      storageProvider: "local",
    });

    const res = await request(app)
      .post("/api/v1/documents/upload")
      .set("Authorization", `Bearer ${engineerToken}`)
      .attach("file", validDummyPdf, "partial_fail.pdf")
      .field("title", "OCR Semantics Test Partial Fail");

    expect(res.status).toBe(202);
    const docId = res.body.data.id;

    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const statusRes = await request(app)
        .get(`/api/v1/documents/${docId}/status`)
        .set("Authorization", `Bearer ${engineerToken}`);
      if (statusRes.body?.data?.status === "failed") break;
    }

    const finalStatusRes = await request(app)
      .get(`/api/v1/documents/${docId}/status`)
      .set("Authorization", `Bearer ${engineerToken}`);

    expect(finalStatusRes.body.data.status).toBe("failed");
    expect(finalStatusRes.body.data.processingError).toContain("Simulated failure generating embedding on chunk 2");

    // Invariant: All chunks must be cleaned up; no orphaned chunks remain
    if (isConnectedToMongo) {
      const remainingChunks = await DocumentChunk.countDocuments({ documentId: docId });
      expect(remainingChunks).toBe(0);
    }
  });

  // Missing Case 4: Failure to persist final indexed status does NOT falsely emit indexed
  it("Requirement 3 & 5: Failure to persist final indexed status never falsely reports success", async () => {
    mockParseBehavior = {
      numpages: 1,
      text: "Valid content for testing DB final update error path.",
    };

    vi.spyOn(geminiService, "generateEmbedding").mockResolvedValue(new Array(768).fill(0.01));
    vi.spyOn(storageService, "saveFile").mockResolvedValueOnce({
      storagePath: "/mock/db_final_fail.pdf",
      sizeBytes: validDummyPdf.length,
      storageProvider: "local",
    });

    // Mock DocumentModel.findByIdAndUpdate to fail on the final update when status is set to indexed
    const origFindByIdAndUpdate = DocumentModel.findByIdAndUpdate.bind(DocumentModel);
    vi.spyOn(DocumentModel, "findByIdAndUpdate").mockImplementation(async function (
      this: any,
      id: any,
      update: any,
      options: any
    ) {
      if (update?.status === "indexed") {
        throw new Error("Simulated database timeout on persisting indexed status");
      }
      return origFindByIdAndUpdate(id, update, options);
    });

    const res = await request(app)
      .post("/api/v1/documents/upload")
      .set("Authorization", `Bearer ${engineerToken}`)
      .attach("file", validDummyPdf, "db_final_fail.pdf")
      .field("title", "OCR Semantics Test Final DB Fail");

    expect(res.status).toBe(202);
    const docId = res.body.data.id;

    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const statusRes = await request(app)
        .get(`/api/v1/documents/${docId}/status`)
        .set("Authorization", `Bearer ${engineerToken}`);
      if (statusRes.body?.data?.status === "failed") break;
    }

    const finalStatusRes = await request(app)
      .get(`/api/v1/documents/${docId}/status`)
      .set("Authorization", `Bearer ${engineerToken}`);

    // Invariant: Status must NEVER be indexed when final persistence failed
    expect(finalStatusRes.body.data.status).not.toBe("indexed");
    expect(finalStatusRes.body.data.status).toBe("failed");
    expect(finalStatusRes.body.data.processingError).toContain("Simulated database timeout on persisting indexed status");

    // Invariant: Cleanup removes any chunks
    if (isConnectedToMongo) {
      const chunkCount = await DocumentChunk.countDocuments({ documentId: docId });
      expect(chunkCount).toBe(0);
    }
  });

  // Missing Case 5: Correct page metadata for digital-text PDF chunks
  it("Requirement 5: Digital-text PDF produces chunks with correct 1-indexed page metadata", async () => {
    mockParseBehavior = {
      numpages: 3,
      text: "--- PAGE 1 ---\nSection 1.0 Safety Isolation: De-energize all motor control centers.\n\n--- PAGE 2 ---\nSection 2.0 Coupling Disassembly: Remove guard and loosen bolts.\n\n--- PAGE 3 ---\nSection 3.0 Re-assembly: Apply 95 Nm torque to coupling bolts.",
    };

    const result = await pdfService.extractAndChunk(validDummyPdf, "Multi-page Equipment Guide");

    expect(result.outcome).toBe("digital_text_extracted");
    expect(result.pageCount).toBe(3);
    expect(result.chunks.length).toBe(3);

    // Verify 1-indexed page metadata matches each section
    expect(result.chunks[0].page).toBe(1);
    expect(result.chunks[0].text).toContain("Safety Isolation");
    expect(result.chunks[1].page).toBe(2);
    expect(result.chunks[1].text).toContain("Coupling Disassembly");
    expect(result.chunks[2].page).toBe(3);
    expect(result.chunks[2].text).toContain("Re-assembly");
  });

  // Missing Case 6: Existing successful PDF ingestion and authorization behavior
  it("Requirement 5: Enforces authorization on document chunk retrieval and deletion", async () => {
    mockParseBehavior = {
      numpages: 1,
      text: "Authorized Manual Content for testing RBAC protections.",
    };

    vi.spyOn(geminiService, "generateEmbedding").mockResolvedValue(new Array(768).fill(0.01));
    vi.spyOn(storageService, "saveFile").mockResolvedValueOnce({
      storagePath: "/mock/auth_test.pdf",
      sizeBytes: validDummyPdf.length,
      storageProvider: "local",
    });

    const res = await request(app)
      .post("/api/v1/documents/upload")
      .set("Authorization", `Bearer ${engineerToken}`)
      .attach("file", validDummyPdf, "auth_test.pdf")
      .field("title", "OCR Semantics Test RBAC");

    expect(res.status).toBe(202);
    const docId = res.body.data.id;

    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const statusRes = await request(app)
        .get(`/api/v1/documents/${docId}/status`)
        .set("Authorization", `Bearer ${engineerToken}`);
      if (statusRes.body?.data?.status === "indexed") break;
    }

    // Authorized user can read chunks
    const authorizedChunksRes = await request(app)
      .get(`/api/v1/documents/${docId}/chunks`)
      .set("Authorization", `Bearer ${engineerToken}`);
    expect(authorizedChunksRes.status).toBe(200);
    expect(authorizedChunksRes.body.success).toBe(true);

    // Unauthenticated request is rejected
    const unauthChunksRes = await request(app).get(`/api/v1/documents/${docId}/chunks`);
    expect(unauthChunksRes.status).toBe(401);

    // Viewer role without permission cannot delete document
    const viewerToken = jwt.sign(
      { id: "usr-viewer-unauthorized", email: "viewer@plant.io", name: "Viewer", role: "viewer" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    const deleteRes = await request(app)
      .delete(`/api/v1/documents/${docId}`)
      .set("Authorization", `Bearer ${viewerToken}`);
    expect(deleteRes.status).toBe(403);
  });

  // Task 1 Final Invariant 1: isConnectedToMongo === false cannot result in an indexed event
  it("Task 1 Invariant: isConnectedToMongo === false cannot result in an indexed event", async () => {
    mockParseBehavior = {
      numpages: 1,
      text: "Normal text content ready for indexing.",
    };

    const statusSpy = vi.spyOn(socketEvents, "emitDocumentStatus");
    const progressSpy = vi.spyOn(socketEvents, "emitDocumentProgress");

    // Simulate database disconnected
    setIsConnectedToMongo(false);

    const disconnectedDocId = new mongoose.Types.ObjectId().toString();
    try {
      await processDocumentAsync(disconnectedDocId, "Disconnected Doc", "Rev 1", validDummyPdf);

      // Invariant: Never emit indexed status event when database is disconnected
      const indexedCalls = statusSpy.mock.calls.filter((call) => call[1] === "indexed");
      expect(indexedCalls.length).toBe(0);

      // Invariant: Never emit 100% progress event when database is disconnected
      const hundredProgressCalls = progressSpy.mock.calls.filter((call) => call[1] === 100);
      expect(hundredProgressCalls.length).toBe(0);

      // Invariant: Emits failed status event with safe error
      const failedCalls = statusSpy.mock.calls.filter((call) => call[1] === "failed");
      expect(failedCalls.length).toBeGreaterThanOrEqual(1);
      expect(failedCalls[0][3]).toContain("Database unavailable");
    } finally {
      setIsConnectedToMongo(true);
    }
  });

  // Task 1 Final Invariant 2: Missing or failed final document status update cannot result in an indexed event
  it("Task 1 Invariant: Missing or failed final document status update cannot result in an indexed event", async () => {
    mockParseBehavior = {
      numpages: 1,
      text: "Valid content for testing missing document during final update.",
    };

    vi.spyOn(geminiService, "generateEmbedding").mockResolvedValue(new Array(768).fill(0.01));
    const statusSpy = vi.spyOn(socketEvents, "emitDocumentStatus");

    // Simulate findByIdAndUpdate returning null on the final indexed update (document was removed or missing)
    const origFindByIdAndUpdate = DocumentModel.findByIdAndUpdate.bind(DocumentModel);
    vi.spyOn(DocumentModel, "findByIdAndUpdate").mockImplementation(async function (
      this: any,
      id: any,
      update: any,
      options: any
    ) {
      if (update?.status === "indexed") {
        return null as any; // Document not found
      }
      return origFindByIdAndUpdate(id, update, options);
    });

    const missingDocId = new mongoose.Types.ObjectId().toString();
    await processDocumentAsync(missingDocId, "Missing Doc Test", "Rev 1", validDummyPdf);

    // Invariant: Indexed status event must NEVER be emitted
    const indexedCalls = statusSpy.mock.calls.filter((call) => call[1] === "indexed");
    expect(indexedCalls.length).toBe(0);

    // Invariant: Emits failed status event
    const failedCalls = statusSpy.mock.calls.filter((call) => call[1] === "failed");
    expect(failedCalls.length).toBeGreaterThanOrEqual(1);
    expect(failedCalls[0][3]).toContain("Failed to locate document");
  });

  // Task 1 Final Invariant 3: Pre-cleanup failure aborts re-indexing and does not generate new embeddings
  it("Task 1 Invariant: Pre-cleanup failure aborts re-indexing and does not generate new embeddings", async () => {
    mockParseBehavior = {
      numpages: 1,
      text: "Content to test pre-cleanup failure abort path.",
    };

    // Pre-cleanup deleteMany throws an error
    vi.spyOn(DocumentChunk, "deleteMany").mockRejectedValueOnce(
      new Error("Lock conflict on chunk deletion during pre-cleanup")
    );
    const embeddingSpy = vi.spyOn(geminiService, "generateEmbedding");
    const statusSpy = vi.spyOn(socketEvents, "emitDocumentStatus");

    const precleanupDocId = new mongoose.Types.ObjectId().toString();
    await processDocumentAsync(precleanupDocId, "Precleanup Fail Doc", "Rev 1", validDummyPdf);

    // Invariant: Ingestion aborted before any embeddings were generated
    expect(embeddingSpy).not.toHaveBeenCalled();

    // Invariant: Never emitted indexed event
    const indexedCalls = statusSpy.mock.calls.filter((call) => call[1] === "indexed");
    expect(indexedCalls.length).toBe(0);

    // Invariant: Emits failed status event with safe pre-cleanup error
    const failedCalls = statusSpy.mock.calls.filter((call) => call[1] === "failed");
    expect(failedCalls.length).toBeGreaterThanOrEqual(1);
    expect(failedCalls[0][3]).toContain("Failed to clear existing chunks before indexing");
  });
});

function validDummyDummyBuffer(): Buffer {
  return Buffer.from(
    "%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< >>\n%%EOF"
  );
}
