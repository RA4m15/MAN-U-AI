import { describe, it, expect, beforeAll, afterAll } from "vitest";
import mongoose from "mongoose";
import { connectDatabase, isConnectedToMongo } from "../src/config/database";
import { DocumentChunk, DocumentModel, User } from "../src/models";
import { VectorService } from "../src/services/vector.service";
import { generateDeterministicEmbedding } from "../src/services/gemini.service";

describe("Persistent MongoDB Atlas-Compatible Vector Retrieval (Requirement 1)", () => {
  let testDocId: mongoose.Types.ObjectId;
  const testText = "Emergency high pressure relief valve PRV-901 setpoint calibration: Set pressure is 350 bar ± 2%. Inspect rupture disc membrane for hairline fatigue cracks.";

  beforeAll(async () => {
    await connectDatabase();
    expect(isConnectedToMongo).toBe(true);

    // Create a parent test document
    let user = await User.findOne();
    if (!user) {
      user = await User.create({
        name: "Test Engineer",
        email: `test-${Date.now()}@plant.io`,
        passwordHash: "hash123",
        role: "engineer",
        orgId: "test-org",
      });
    }

    const doc = await DocumentModel.create({
      title: "High Pressure Hydraulic Calibration Guide",
      revision: "Rev 3.0",
      filename: "prv_calibration.pdf",
      storagePath: "prv_calibration.pdf",
      mimeType: "application/pdf",
      sizeBytes: 154000,
      status: "indexed",
      pageCount: 15,
      uploadedById: user._id,
    });
    testDocId = doc._id;
  });

  afterAll(async () => {
    if (testDocId) {
      await DocumentModel.findByIdAndDelete(testDocId);
      await DocumentChunk.deleteMany({ documentId: testDocId });
    }
  });

  it("indexes chunk into MongoDB collection with required compound indexes", async () => {
    const vectorService = new VectorService();
    const embedding = generateDeterministicEmbedding(testText);

    await vectorService.indexChunk({
      documentId: testDocId.toString(),
      documentTitle: "High Pressure Hydraulic Calibration Guide",
      revision: "Rev 3.0",
      page: 9,
      section: "5.2 PRV Setpoint Calibration",
      text: testText,
      embedding,
    });

    // Verify chunk in MongoDB
    const chunkInDb = await DocumentChunk.findOne({ documentId: testDocId });
    expect(chunkInDb).toBeDefined();
    expect(chunkInDb?.page).toBe(9);
    expect(chunkInDb?.text).toContain("PRV-901");
    expect(chunkInDb?.embedding.length).toBeGreaterThan(0);

    // Verify indexes exist on DocumentChunk
    const indexes = await DocumentChunk.collection.indexes();
    const indexNames = indexes.map((idx) => Object.keys(idx.key).join("_"));
    console.log("[Vector Test] Verified DocumentChunk indexes:", indexNames);

    // Verify text or compound indexes exist
    expect(indexes.some((idx) => idx.key.documentId !== undefined && idx.key.page !== undefined)).toBe(true);
  });

  it("simulates a server restart and confirms chunks persist and remain searchable from MongoDB", async () => {
    // Fresh VectorService instance with zero in-memory knowledge of this chunk
    const restartedVectorService = new VectorService();
    const queryEmbedding = generateDeterministicEmbedding("PRV-901 relief valve pressure setpoint");

    const results = await restartedVectorService.searchSimilar(
      queryEmbedding,
      "What is the PRV-901 setpoint pressure calibration?",
      5,
      0.40
    );

    expect(results.length).toBeGreaterThan(0);
    const matched = results.find((r) => r.chunk.documentId === testDocId.toString());
    expect(matched).toBeDefined();
    expect(matched?.chunk.page).toBe(9);
    expect(matched?.chunk.text).toContain("350 bar");
    expect(matched?.score).toBeGreaterThan(0.60);

    console.log("[Vector Test] Persistent retrieval after restart verified successfully:");
    console.log("  - Document:", matched?.chunk.documentTitle);
    console.log("  - Page:", matched?.chunk.page);
    console.log("  - Score:", matched?.score);
    console.log("  - Matched Text:", matched?.chunk.text);
  });
});
