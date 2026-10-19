import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import { env } from "../src/config/env";
import { connectDatabase, isConnectedToMongo } from "../src/config/database";
import { DocumentModel, DocumentChunk } from "../src/models";
import { pdfService, isValidPdfSignature } from "../src/services/pdf.service";
import { geminiService } from "../src/services/gemini.service";
import { storageService } from "../src/services/storage.service";

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
});

function validDummyDummyBuffer(): Buffer {
  return Buffer.from(
    "%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< >>\n%%EOF"
  );
}
