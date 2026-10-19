import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import mongoose from "mongoose";

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

import { app } from "../src/app";
import { DocumentModel, DocumentChunk } from "../src/models";
import { vectorService } from "../src/services/vector.service";
import { geminiService } from "../src/services/gemini.service";
import { pdfService, isValidPdfSignature } from "../src/services/pdf.service";
import { connectDatabase } from "../src/config/database";
import * as socketEvents from "../src/index";
import { processDocumentAsync } from "../src/routes/documents.routes";

describe("Stage 5 — Task 1A: Partial-Index Cleanup & Safe Retrieval Suite", () => {
  const validDummyPdf = Buffer.from(
    "%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< >>\n%%EOF"
  );

  beforeAll(async () => {
    await connectDatabase();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vectorService.clearMemoryChunks();
    mockParseBehavior = {
      numpages: 1,
      text: "Default digital text with enough length to simulate a normal manual with multiple sentences.",
    };
  });

  // Case 1: A genuine text-based PDF produces real chunks with page metadata
  it("Case 1: A genuine text-based PDF produces real chunks with page metadata", async () => {
    mockParseBehavior = {
      numpages: 1,
      text: "Standard Operating Procedure: Heavy Duty Slurry Pump Overhaul. Inspect impeller clearances and tighten bolts to 45 Nm.",
    };

    const extraction = await pdfService.extractAndChunk(validDummyPdf, "Genuine Text Pump Manual");
    expect(extraction.outcome).toBe("digital_text_extracted");
    expect(extraction.chunks.length).toBeGreaterThan(0);
    expect(extraction.chunks[0].page).toBe(1);
    expect(extraction.chunks[0].text).toContain("Heavy Duty Slurry Pump Overhaul");
    expect(extraction.requiresOcr).toBe(false);
  });

  // Case 2: Failed text extraction cannot create synthetic chunks
  it("Case 2: Failed text extraction cannot create synthetic chunks", async () => {
    mockParseBehavior = {
      numpages: 1,
      text: "",
      shouldThrow: true,
    };

    const extraction = await pdfService.extractAndChunk(validDummyPdf, "Corrupt Doc", { throwOnError: false });
    expect(extraction.outcome).toBe("extraction_failed");
    expect(extraction.chunks).toEqual([]);
    expect(extraction.error).toContain("Failed to parse PDF document structure");

    // Verify when processDocumentAsync encounters extraction failure, it never generates synthetic chunks
    const testDocId = new mongoose.Types.ObjectId().toString();
    await processDocumentAsync(testDocId, "Corrupt Doc", "Rev 1.0", validDummyPdf);

    const memChunks = vectorService.getMemoryChunks(testDocId);
    expect(memChunks.length).toBe(0);
    const dbChunks = await DocumentChunk.countDocuments({ documentId: new mongoose.Types.ObjectId(testDocId) });
    expect(dbChunks).toBe(0);
  });

  // Case 3: An OCR-required document is not embedded or indexed without usable extracted text
  it("Case 3: An OCR-required document is not embedded or indexed without usable extracted text", async () => {
    mockParseBehavior = {
      numpages: 1,
      text: " ", // low text triggers OCR
    };

    vi.spyOn(geminiService, "isLiveClientConfigured").mockReturnValue(false);
    const embeddingSpy = vi.spyOn(geminiService, "generateEmbedding");
    const statusSpy = vi.spyOn(socketEvents, "emitDocumentStatus");

    const doc = await DocumentModel.create({
      title: "Scanned Schematics Without OCR",
      filename: "schematics.pdf",
      storagePath: "mock/schematics.pdf",
      fileType: "application/pdf",
      mimeType: "application/pdf",
      uploadedById: new mongoose.Types.ObjectId(),
      sizeBytes: validDummyPdf.length,
      status: "processing",
    });

    try {
      await processDocumentAsync(doc._id.toString(), doc.title, "Rev 1.0", validDummyPdf);

      // Invariant: No embeddings generated
      expect(embeddingSpy).not.toHaveBeenCalled();

      // Invariant: No chunks stored in DB or in-memory cache
      const dbChunks = await DocumentChunk.countDocuments({ documentId: doc._id });
      expect(dbChunks).toBe(0);
      expect(vectorService.getMemoryChunks(doc._id.toString()).length).toBe(0);

      // Invariant: Document status is needs_ocr
      const updated = await DocumentModel.findById(doc._id);
      expect(updated?.status).toBe("needs_ocr");

      // Invariant: Status event is needs_ocr (not indexed)
      const needsOcrCalls = statusSpy.mock.calls.filter((c) => c[1] === "needs_ocr");
      expect(needsOcrCalls.length).toBe(1);
      const indexedCalls = statusSpy.mock.calls.filter((c) => c[1] === "indexed");
      expect(indexedCalls.length).toBe(0);
    } finally {
      await DocumentModel.findByIdAndDelete(doc._id);
    }
  });

  // Case 4: Unsupported file types are rejected
  it("Case 4: Unsupported file types are rejected by PDF signature validation", () => {
    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const jpgHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const txtHeader = Buffer.from("Hello Plain Text");

    expect(isValidPdfSignature(pngHeader)).toBe(false);
    expect(isValidPdfSignature(jpgHeader)).toBe(false);
    expect(isValidPdfSignature(txtHeader)).toBe(false);
    expect(isValidPdfSignature(validDummyPdf)).toBe(true);
  });

  // Case 5: A document becomes indexed only after all required chunks have been persisted
  it("Case 5: A document becomes indexed only after all required chunks have been persisted", async () => {
    const doc = await DocumentModel.create({
      title: "Complete Ingestion Test Manual",
      filename: "complete.pdf",
      storagePath: "mock/complete.pdf",
      fileType: "application/pdf",
      mimeType: "application/pdf",
      uploadedById: new mongoose.Types.ObjectId(),
      sizeBytes: 100,
      status: "processing",
    });

    vi.spyOn(pdfService, "extractAndChunk").mockResolvedValueOnce({
      chunks: [
        { page: 1, text: "Section 1: Valve Isolation Protocol." },
        { page: 2, text: "Section 2: Pressure Relief Valve Testing." },
      ],
      pageCount: 2,
      outcome: "digital_text_extracted",
      requiresOcr: false,
      ocrPerformed: false,
    });
    vi.spyOn(geminiService, "generateEmbedding").mockResolvedValue(new Array(768).fill(0.01));
    const statusSpy = vi.spyOn(socketEvents, "emitDocumentStatus");

    try {
      await processDocumentAsync(doc._id.toString(), doc.title, "Rev 1.0", validDummyPdf);

      const dbChunks = await DocumentChunk.countDocuments({ documentId: doc._id });
      expect(dbChunks).toBe(2);

      const updated = await DocumentModel.findById(doc._id);
      expect(updated?.status).toBe("indexed");

      const indexedCalls = statusSpy.mock.calls.filter((c) => c[1] === "indexed");
      expect(indexedCalls.length).toBe(1);
    } finally {
      await DocumentModel.findByIdAndDelete(doc._id);
      await vectorService.deleteDocumentChunks(doc._id.toString());
    }
  });

  // Case 6: If the second or a later chunk fails to persist, no chunks from that document remain in persistent store or in-memory cache
  it("Case 6: If the second or a later chunk fails to persist, no chunks from that document remain in persistent store or in-memory cache", async () => {
    const doc = await DocumentModel.create({
      title: "Partial Failure Pump Manual",
      filename: "partial.pdf",
      storagePath: "mock/partial.pdf",
      fileType: "application/pdf",
      mimeType: "application/pdf",
      uploadedById: new mongoose.Types.ObjectId(),
      sizeBytes: 100,
      status: "processing",
    });

    vi.spyOn(pdfService, "extractAndChunk").mockResolvedValueOnce({
      chunks: [
        { page: 1, text: "Chunk 1: Primary impeller inspection criteria." },
        { page: 2, text: "Chunk 2: Secondary casing clearance check." },
      ],
      pageCount: 2,
      outcome: "digital_text_extracted",
      requiresOcr: false,
      ocrPerformed: false,
    });

    vi.spyOn(geminiService, "generateEmbedding").mockResolvedValue(new Array(768).fill(0.02));

    // Chunk 1 create succeeds, chunk 2 create fails
    let callCount = 0;
    const origCreate = DocumentChunk.create.bind(DocumentChunk);
    vi.spyOn(DocumentChunk, "create").mockImplementation(async function (this: any, docData: any) {
      callCount++;
      if (callCount === 2) {
        throw new Error("Simulated database write error on chunk 2");
      }
      return origCreate(docData);
    });

    const statusSpy = vi.spyOn(socketEvents, "emitDocumentStatus");

    try {
      await processDocumentAsync(doc._id.toString(), doc.title, "Rev 1.0", validDummyPdf);

      // Invariant: No chunks remaining in persistent MongoDB
      const dbChunks = await DocumentChunk.countDocuments({ documentId: doc._id });
      expect(dbChunks).toBe(0);

      // Invariant: No chunks remaining in in-memory cache
      const memChunks = vectorService.getMemoryChunks(doc._id.toString());
      expect(memChunks.length).toBe(0);

      // Invariant: Status marked failed, never indexed
      const updated = await DocumentModel.findById(doc._id);
      expect(updated?.status).toBe("failed");
      expect(updated?.processingError).toContain("Simulated database write error on chunk 2");

      const indexedCalls = statusSpy.mock.calls.filter((c) => c[1] === "indexed");
      expect(indexedCalls.length).toBe(0);
      const failedCalls = statusSpy.mock.calls.filter((c) => c[1] === "failed");
      expect(failedCalls.length).toBeGreaterThanOrEqual(1);
    } finally {
      await DocumentModel.findByIdAndDelete(doc._id);
      await vectorService.deleteDocumentChunks(doc._id.toString());
    }
  });

  // Case 7: If an individual MongoDB chunk write fails after in-memory cache insertion would previously have occurred, that failed cache entry is removed
  it("Case 7: If an individual MongoDB chunk write fails, failed cache entry is removed from in-memory cache", async () => {
    const testDocId = new mongoose.Types.ObjectId().toString();
    vi.spyOn(DocumentChunk, "create").mockRejectedValueOnce(
      new Error("Immediate MongoDB connection reset on chunk write")
    );

    await expect(
      vectorService.indexChunk({
        documentId: testDocId,
        documentTitle: "Immediate Failure Doc",
        revision: "Rev A",
        page: 1,
        text: "Sample text to test immediate rollback from ephemeral memory",
        embedding: new Array(768).fill(0.01),
      })
    ).rejects.toThrow("Immediate MongoDB connection reset on chunk write");

    // Invariant: The failed entry is NOT retained in in-memory store
    const memChunks = vectorService.getMemoryChunks(testDocId);
    expect(memChunks.length).toBe(0);
  });

  // Case 8: A failed cleanup is surfaced explicitly and does not produce a false success state
  it("Case 8: A failed cleanup is surfaced explicitly and does not produce a false success state", async () => {
    const doc = await DocumentModel.create({
      title: "Failed Cleanup Doc",
      filename: "cleanup_fail.pdf",
      storagePath: "mock/cleanup_fail.pdf",
      fileType: "application/pdf",
      mimeType: "application/pdf",
      uploadedById: new mongoose.Types.ObjectId(),
      sizeBytes: 100,
      status: "processing",
    });

    vi.spyOn(pdfService, "extractAndChunk").mockRejectedValueOnce(
      new Error("PDF extraction crashed unexpectedly")
    );

    // Spy on deleteDocumentChunks to simulate cleanup failure in catch block
    vi.spyOn(vectorService, "deleteDocumentChunks").mockRejectedValueOnce(
      new Error("Disk deadlock during cleanup deleteMany")
    );

    const statusSpy = vi.spyOn(socketEvents, "emitDocumentStatus");

    try {
      await processDocumentAsync(doc._id.toString(), doc.title, "Rev 1.0", validDummyPdf);

      // Invariant: Document status is failed, NOT indexed
      const updated = await DocumentModel.findById(doc._id);
      expect(updated?.status).toBe("failed");
      // Explicitly surfaces the cleanup error
      expect(updated?.processingError).toContain("chunk cleanup encountered an error");

      // Invariant: Never emits indexed
      const indexedCalls = statusSpy.mock.calls.filter((c) => c[1] === "indexed");
      expect(indexedCalls.length).toBe(0);

      // Invariant: Emits failed
      const failedCalls = statusSpy.mock.calls.filter((c) => c[1] === "failed");
      expect(failedCalls.length).toBeGreaterThanOrEqual(1);
      expect(failedCalls[0][3]).toContain("chunk cleanup encountered an error");
    } finally {
      await DocumentModel.findByIdAndDelete(doc._id);
    }
  });

  // Case 9: A document marked failed or needs_ocr cannot supply stale chunks to normal retrieval
  it("Case 9: A document marked failed or needs_ocr cannot supply stale chunks to normal retrieval", async () => {
    const failedDoc = await DocumentModel.create({
      title: "Failed Document Hydraulic System",
      filename: "failed.pdf",
      storagePath: "mock/failed.pdf",
      fileType: "application/pdf",
      mimeType: "application/pdf",
      uploadedById: new mongoose.Types.ObjectId(),
      sizeBytes: 100,
      status: "failed",
    });

    const needsOcrDoc = await DocumentModel.create({
      title: "Needs OCR Document Valve System",
      filename: "needs_ocr.pdf",
      storagePath: "mock/needs_ocr.pdf",
      fileType: "application/pdf",
      mimeType: "application/pdf",
      uploadedById: new mongoose.Types.ObjectId(),
      sizeBytes: 100,
      status: "needs_ocr",
    });

    const queryVector = new Array(768).fill(0.01);

    // Simulate lingering chunk in MongoDB for failed doc
    const failedChunk = await DocumentChunk.create({
      documentId: failedDoc._id,
      documentTitle: failedDoc.title,
      revision: "Rev 1",
      page: 1,
      text: "Stale chunk from failed document regarding Hydraulic System.",
      embedding: queryVector,
      tokenCount: 10,
    });

    // Simulate lingering chunk in MongoDB for needs_ocr doc
    const needsOcrChunk = await DocumentChunk.create({
      documentId: needsOcrDoc._id,
      documentTitle: needsOcrDoc.title,
      revision: "Rev 1",
      page: 1,
      text: "Stale chunk from needs_ocr document regarding Valve System.",
      embedding: queryVector,
      tokenCount: 10,
    });

    try {
      // 1. Query targeting failed document directly
      const failedResults = await vectorService.searchSimilar(
        queryVector,
        "Hydraulic System",
        5,
        0.1,
        [failedDoc._id.toString()]
      );
      expect(failedResults.length).toBe(0);

      // 2. Query targeting needs_ocr document directly
      const needsOcrResults = await vectorService.searchSimilar(
        queryVector,
        "Valve System",
        5,
        0.1,
        [needsOcrDoc._id.toString()]
      );
      expect(needsOcrResults.length).toBe(0);

      // 3. Broad query without filterDocIds should also purge unindexed documents
      const broadResults = await vectorService.searchSimilar(
        queryVector,
        "Hydraulic Valve System",
        10,
        0.1
      );
      const poisonedMatches = broadResults.filter(
        (r) =>
          r.chunk.documentId === failedDoc._id.toString() ||
          r.chunk.documentId === needsOcrDoc._id.toString()
      );
      expect(poisonedMatches.length).toBe(0);
    } finally {
      await DocumentModel.findByIdAndDelete(failedDoc._id);
      await DocumentModel.findByIdAndDelete(needsOcrDoc._id);
      await DocumentChunk.findByIdAndDelete(failedChunk._id);
      await DocumentChunk.findByIdAndDelete(needsOcrChunk._id);
    }
  });

  // Case 10: Successful indexing and retrieval for other documents continue to work
  it("Case 10: Successful indexing and retrieval for other documents continue to work", async () => {
    const validDoc = await DocumentModel.create({
      title: "Turbine Alignment Protocol Manual",
      filename: "turbine.pdf",
      storagePath: "mock/turbine.pdf",
      fileType: "application/pdf",
      mimeType: "application/pdf",
      uploadedById: new mongoose.Types.ObjectId(),
      sizeBytes: 100,
      status: "indexed",
    });

    const queryVector = new Array(768).fill(0.01);
    const validChunk = await DocumentChunk.create({
      documentId: validDoc._id,
      documentTitle: validDoc.title,
      revision: "Rev 2.0",
      page: 5,
      section: "5.1 Radial Alignment",
      text: "Shaft radial alignment tolerance on Turbine Model T-900 must not exceed 0.02 mm.",
      embedding: queryVector,
      tokenCount: 18,
    });

    try {
      const results = await vectorService.searchSimilar(
        queryVector,
        "Turbine Model T-900 alignment tolerance",
        5,
        0.1,
        [validDoc._id.toString()]
      );

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].chunk.documentId).toBe(validDoc._id.toString());
      expect(results[0].chunk.text).toContain("Shaft radial alignment tolerance");
      expect(results[0].chunk.section).toBe("5.1 Radial Alignment");
      expect(results[0].score).toBeGreaterThan(0.5);
    } finally {
      await DocumentModel.findByIdAndDelete(validDoc._id);
      await DocumentChunk.findByIdAndDelete(validChunk._id);
      await vectorService.deleteDocumentChunks(validDoc._id.toString());
    }
  });
});
