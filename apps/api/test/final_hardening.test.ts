import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { app, isAllowedOrigin } from "../src/app";
import { env } from "../src/config/env";
import { connectDatabase, isConnectedToMongo } from "../src/config/database";
import { User, Conversation, Message, DocumentModel, DocumentChunk, AuditEvent } from "../src/models";
import { seedDatabase } from "../src/config/seed";
import { isUserAuthorizedForDocument, toMongoObjectId } from "../src/routes/documents.routes";
import { pdfService, isValidPdfSignature } from "../src/services/pdf.service";
import { GeminiService } from "../src/services/gemini.service";
import { ragService } from "../src/services/rag.service";
import { storageService } from "../src/services/storage.service";

describe("PHASE 4 — Final Production Hardening & Verification Suite", () => {
  let adminToken: string;
  let userAToken: string;
  let userBToken: string;
  let userAId: string;
  let userBId: string;
  let userAConvId: string;
  let docAId: string;

  beforeAll(async () => {
    await connectDatabase();

    userAId = "usr-hardening-a-1111";
    userBId = "usr-hardening-b-2222";

    userAToken = jwt.sign(
      { id: userAId, email: "hardening.a@plant.io", name: "Hardening User A", role: "engineer" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    userBToken = jwt.sign(
      { id: userBId, email: "hardening.b@plant.io", name: "Hardening User B", role: "viewer" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    adminToken = jwt.sign(
      { id: "usr-admin-root", email: "admin@plant.io", name: "Elena Rostova", role: "admin" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    if (isConnectedToMongo) {
      // Create conversation belonging to User A
      const conv = await Conversation.create({
        userId: toMongoObjectId(userAId),
        title: "Confidential Calibration Thread",
        summary: "Private discussion regarding high pressure tolerances",
      });
      userAConvId = conv._id.toString();

      await Message.create({
        conversationId: conv._id,
        role: "user",
        content: "What is the secret casing torque?",
        warningLevel: "none",
        confidenceScore: 1.0,
      });

      // Create a private indexed document for User A
      const doc = await DocumentModel.create({
        title: "Proprietary Submersible Seal Blueprint",
        revision: "Rev 1.0",
        filename: "seal_blueprint.pdf",
        storagePath: "seal_blueprint.pdf",
        mimeType: "application/pdf",
        sizeBytes: 2048,
        status: "indexed",
        pageCount: 1,
        uploadedById: toMongoObjectId(userAId),
      });
      docAId = doc._id.toString();

      await DocumentChunk.create({
        documentId: doc._id,
        documentTitle: doc.title,
        revision: doc.revision,
        page: 1,
        section: "O-Ring Compression",
        text: "Special O-Ring compression tolerance for Submersible Seal is 0.012 mm.",
        embedding: new Array(768).fill(0.01),
        tokenCount: 15,
      });
    }
  });

  afterAll(async () => {
    if (isConnectedToMongo) {
      if (userAConvId) {
        await Conversation.findByIdAndDelete(userAConvId);
        await Message.deleteMany({ conversationId: userAConvId });
      }
      if (docAId) {
        await DocumentModel.findByIdAndDelete(docAId);
        await DocumentChunk.deleteMany({ documentId: docAId });
      }
    }
  });

  // 1. Unauthenticated administrator-role registration rejection
  it("Requirement 1: Rejects unauthenticated administrator role registration", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Hacker Admin",
        email: `hacker-${Date.now()}@test.com`,
        password: "Password123!",
        role: "admin",
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("ROLE_UNAUTHORIZED");
  });

  it("Requirement 1b: Rejects self-registration in production mode when not explicitly enabled", async () => {
    const prevEnv = env.NODE_ENV;
    const prevEnable = process.env.ENABLE_PUBLIC_REGISTRATION;
    try {
      (env as any).NODE_ENV = "production";
      delete process.env.ENABLE_PUBLIC_REGISTRATION;

      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Prod User",
          email: `prod-user-${Date.now()}@test.com`,
          password: "Password123!",
          role: "viewer",
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("REGISTRATION_RESTRICTED");
    } finally {
      (env as any).NODE_ENV = prevEnv;
      if (prevEnable) process.env.ENABLE_PUBLIC_REGISTRATION = prevEnable;
    }
  });

  // 2. Seed-account password stability across restarts
  it("Requirement 2: Server seed process never resets existing account passwords", async (ctx) => {
    if (!isConnectedToMongo) {
      ctx.skip();
      return;
    }

    const email = "stability.check@plant.io";
    await User.deleteOne({ email });

    const passwordHash = await bcrypt.hash("InitialPassword123!", 10);
    await User.create({
      name: "Stability User",
      email,
      passwordHash,
      role: "engineer",
      orgId: "plant-alpha",
    });

    // Run seedDatabase
    process.env.INITIAL_SEED_PASSWORD = "ChangedPassword999!";
    await seedDatabase();

    const userAfter = await User.findOne({ email });
    expect(userAfter).not.toBeNull();
    const isOriginalValid = await bcrypt.compare("InitialPassword123!", userAfter!.passwordHash);
    const isSeedOverwritten = await bcrypt.compare("ChangedPassword999!", userAfter!.passwordHash);

    expect(isOriginalValid).toBe(true);
    expect(isSeedOverwritten).toBe(false);

    await User.deleteOne({ email });
  });

  // 3. Conversation ownership and message privacy
  it("Requirement 3: Verifies conversation ownership before returning messages", async (ctx) => {
    if (!isConnectedToMongo || !userAConvId) {
      ctx.skip();
      return;
    }

    // User B attempts to access User A's conversation messages
    const resForbidden = await request(app)
      .get(`/api/v1/conversations/${userAConvId}/messages`)
      .set("Authorization", `Bearer ${userBToken}`);

    expect(resForbidden.status).toBe(403);
    expect(resForbidden.body.success).toBe(false);
    expect(resForbidden.body.error.code).toBe("FORBIDDEN");

    // Owner (User A) is authorized
    const resOwner = await request(app)
      .get(`/api/v1/conversations/${userAConvId}/messages`)
      .set("Authorization", `Bearer ${userAToken}`);

    expect(resOwner.status).toBe(200);
    expect(resOwner.body.success).toBe(true);
    expect(Array.isArray(resOwner.body.data)).toBe(true);

    // Admin is authorized to inspect conversation
    const resAdmin = await request(app)
      .get(`/api/v1/conversations/${userAConvId}/messages`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(resAdmin.status).toBe(200);
    expect(resAdmin.body.success).toBe(true);
  });

  // 4. CORS wildcard rejection
  it("Requirement 4: Strictly rejects wildcard '*' origins in production", () => {
    const prevEnv = env.NODE_ENV;
    try {
      (env as any).NODE_ENV = "production";
      expect(isAllowedOrigin("*")).toBe(false);
      expect(isAllowedOrigin("http://malicious-site.com")).toBe(false);
    } finally {
      (env as any).NODE_ENV = prevEnv;
    }
  });

  // 5. User list endpoint restricted to administrators
  it("Requirement 5: Restricts GET /users to administrators only", async () => {
    const resViewer = await request(app)
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${userBToken}`);

    expect(resViewer.status).toBe(403);

    const resAdmin = await request(app)
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(resAdmin.status).toBe(200);
    expect(resAdmin.body.success).toBe(true);
  });

  // 6. Malformed PDF rejection & magic bytes validation
  it("Requirement 6: Validates %PDF- signature and rejects malformed files", async () => {
    // Valid signature helper
    const validPdfBuffer = Buffer.from("%PDF-1.7\nSample content");
    expect(isValidPdfSignature(validPdfBuffer)).toBe(true);

    const fakePdfBuffer = Buffer.from("NOT_A_PDF_HEADER_12345");
    expect(isValidPdfSignature(fakePdfBuffer)).toBe(false);

    // Direct PDF service extraction rejection
    await expect(pdfService.extractAndChunk(fakePdfBuffer, "Fake Doc")).rejects.toThrow(
      "Invalid PDF signature"
    );

    // Upload endpoint rejects malformed PDF with 400
    const uploadRes = await request(app)
      .post("/api/v1/documents/upload")
      .set("Authorization", `Bearer ${adminToken}`)
      .attach("file", fakePdfBuffer, "fake_doc.pdf");

    expect(uploadRes.status).toBe(400);
    expect(uploadRes.body.error.code).toBe("INVALID_FILE_SIGNATURE");
  });

  // 7. Scanned-PDF OCR requirement & no placeholder chunks
  it("Requirement 7: Prevents indexing placeholder chunks on failed or scanned documents", async () => {
    // Corrupted PDF that starts with %PDF- but has invalid internal structure
    const brokenPdf = Buffer.from("%PDF-1.4\nCorrupted structure that cannot parse");

    // In non-production or production, if OCR cannot read text, it must throw an explicit error rather than injecting placeholder chunks
    await expect(pdfService.extractAndChunk(brokenPdf, "Broken Doc")).rejects.toThrow();
  });

  // 8. Gemini embedding failure without deterministic production fallback
  it("Requirement 8: Never uses deterministic fallback embeddings in production", async () => {
    const prevEnv = env.NODE_ENV;
    const prevKey = env.GEMINI_API_KEY;

    try {
      (env as any).NODE_ENV = "production";
      (env as any).GEMINI_API_KEY = ""; // simulate missing key or failed connection
      const gemini = new GeminiService();

      await expect(gemini.generateEmbedding("Test industrial query")).rejects.toThrow(
        /prohibited in production|failed in production/i
      );
    } finally {
      (env as any).NODE_ENV = prevEnv;
      (env as any).GEMINI_API_KEY = prevKey;
    }
  });

  // 9. Authorized retrieval and citation isolation
  it("Requirement 9: Cross-user isolation in RAG retrieval", async (ctx) => {
    if (!isConnectedToMongo || !docAId) {
      ctx.skip();
      return;
    }

    // User B queries regarding User A's private blueprint
    const resB = await ragService.answerQuestion(
      "What is the O-Ring compression tolerance for Submersible Seal?",
      { id: userBId, role: "viewer" }
    );

    // User B must NOT receive citations from User A's document
    const userBCitations = resB.citations.filter((c) => c.documentId === docAId);
    expect(userBCitations.length).toBe(0);

    // User A querying the same question DOES receive citations from their own document
    const resA = await ragService.answerQuestion(
      "What is the O-Ring compression tolerance for Submersible Seal?",
      { id: userAId, role: "engineer" }
    );
    const userACitations = resA.citations.filter((c) => c.documentId === docAId);
    expect(userACitations.length).toBeGreaterThan(0);
    expect(userACitations[0].documentTitle).toBe("Proprietary Submersible Seal Blueprint");
  }, 25000);

  // 9b. Non-indexed documents (processing, failed) cannot supply answer evidence or citations
  it("Requirement 9b: Non-indexed documents (processing, failed) cannot supply chunks or citations", async (ctx) => {
    if (!isConnectedToMongo) {
      ctx.skip();
      return;
    }

    // Create a document with status "processing"
    const processingDoc = await DocumentModel.create({
      title: "Draft Processing Turbine Manual",
      revision: "Rev 0.1",
      filename: "draft_turbine.pdf",
      storagePath: "draft_turbine.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      status: "processing",
      pageCount: 1,
      uploadedById: toMongoObjectId(userAId),
    });

    const chunk = await DocumentChunk.create({
      documentId: processingDoc._id,
      documentTitle: processingDoc.title,
      revision: processingDoc.revision,
      page: 1,
      section: "Turbine Clearance",
      text: "Turbine clearance limit for Draft Turbine is strictly 0.088 mm under hot test.",
      embedding: new Array(768).fill(0.01),
      tokenCount: 16,
    });

    try {
      // 1. Admin query should NOT retrieve chunks from processing document
      const adminRes = await ragService.answerQuestion(
        "What is the turbine clearance limit for Draft Turbine?",
        { id: "usr-admin-root", role: "admin" }
      );
      const adminMatches = adminRes.citations.filter((c) => c.documentId === processingDoc._id.toString());
      expect(adminMatches.length).toBe(0);

      // 2. Owner (User A) query should NOT retrieve chunks from processing document
      const ownerRes = await ragService.answerQuestion(
        "What is the turbine clearance limit for Draft Turbine?",
        { id: userAId, role: "engineer" }
      );
      const ownerMatches = ownerRes.citations.filter((c) => c.documentId === processingDoc._id.toString());
      expect(ownerMatches.length).toBe(0);

      // 3. Change status to "failed"
      processingDoc.status = "failed";
      await processingDoc.save();

      const failedRes = await ragService.answerQuestion(
        "What is the turbine clearance limit for Draft Turbine?",
        { id: userAId, role: "engineer" }
      );
      const failedMatches = failedRes.citations.filter((c) => c.documentId === processingDoc._id.toString());
      expect(failedMatches.length).toBe(0);

      // 4. Change status to "indexed" -> now it CAN supply citations
      processingDoc.status = "indexed";
      await processingDoc.save();

      const indexedRes = await ragService.answerQuestion(
        "What is the turbine clearance limit for Draft Turbine?",
        { id: userAId, role: "engineer" }
      );
      const indexedMatches = indexedRes.citations.filter((c) => c.documentId === processingDoc._id.toString());
      expect(indexedMatches.length).toBeGreaterThan(0);
      expect(indexedMatches[0].documentTitle).toBe("Draft Processing Turbine Manual");
    } finally {
      await DocumentModel.findByIdAndDelete(processingDoc._id);
      await DocumentChunk.findByIdAndDelete(chunk._id);
    }
  }, 25000);

  // 10. Operational summaries generated from actual records, not manufactured
  it("Requirement 10: Operational summaries generate from authentic records and label AI synthesis", async () => {
    const res = await request(app)
      .post("/api/v1/summaries/generate")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ timeRange: "last_24h" });

    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summary).toContain("AI-Assisted Operational Synthesis");
    expect(res.body.data.summary).not.toContain("Line 1 & Line 3 Mechanical Operations - Shift Handover");
  });

  // 11. Production startup aborts when required MongoDB connection fails
  it("Requirement 11: Production startup aborts when required MongoDB connection fails", async () => {
    const prevEnv = env.NODE_ENV;
    const dbModule = await import("../src/config/database");
    const connectSpy = vi.spyOn(dbModule, "connectDatabase").mockResolvedValueOnce(false);

    try {
      (env as any).NODE_ENV = "production";
      const { startServer } = await import("../src/index");
      await expect(startServer()).rejects.toThrow("Production startup aborted");
    } finally {
      (env as any).NODE_ENV = prevEnv;
      connectSpy.mockRestore();
    }
  });

  // 11b. Production failure where connectDatabase() rejects on real connection error
  it("Requirement 11b: connectDatabase rejects in production when connection fails", async () => {
    const prevEnv = env.NODE_ENV;
    const mongooseSpy = vi.spyOn(mongoose, "connect").mockRejectedValueOnce(new Error("Simulated network timeout"));

    try {
      (env as any).NODE_ENV = "production";
      await expect(connectDatabase("mongodb://invalid-cluster.invalid:27017/manuai")).rejects.toThrow(
        /Production database connection failed/
      );
    } finally {
      (env as any).NODE_ENV = prevEnv;
      mongooseSpy.mockRestore();
    }
  });

  // 11c. Idempotent Mongoose connection lifecycle handlers update connection state
  it("Requirement 11c: Mongoose connection lifecycle handlers update state on disconnect and reconnect idempotently", async () => {
    const { setupMongooseListeners, isConnectedToMongo: prevConnected } = await import("../src/config/database");

    // Test idempotency: calling setupMongooseListeners repeatedly does not duplicate listeners
    const listenerCountBefore = mongoose.connection.listenerCount("disconnected");
    setupMongooseListeners();
    setupMongooseListeners();
    const listenerCountAfter = mongoose.connection.listenerCount("disconnected");
    expect(listenerCountAfter).toBe(listenerCountBefore);

    // Test disconnected event updates isConnectedToMongo to false
    mongoose.connection.emit("disconnected");
    const { isConnectedToMongo: disconnectedState } = await import("../src/config/database");
    expect(disconnectedState).toBe(false);

    // Test reconnected event updates isConnectedToMongo to true
    mongoose.connection.emit("reconnected");
    const { isConnectedToMongo: reconnectedState } = await import("../src/config/database");
    expect(reconnectedState).toBe(true);

    // Restore original state
    const { setIsConnectedToMongo } = await import("../src/config/database");
    setIsConnectedToMongo(prevConnected);
  });

  // 12. Disconnected database fails closed on GET /documents
  it("Requirement 12: GET /documents fails closed with 503 when database is disconnected", async () => {
    const { setIsConnectedToMongo, isConnectedToMongo: prevConnected } = await import("../src/config/database");
    try {
      setIsConnectedToMongo(false);
      const res = await request(app)
        .get("/api/v1/documents")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("SERVICE_UNAVAILABLE");
    } finally {
      setIsConnectedToMongo(prevConnected);
    }
  });

  // 13a. File storage succeeds but DocumentModel.create() fails -> file cleaned up, no doc created
  it("Requirement 13a: Failed upload persistence cleans up orphaned stored file and returns 503", async () => {
    const validPdfBuffer = Buffer.from("%PDF-1.7\nSample technical manual content for upload failure test 13a");
    const createSpy = vi.spyOn(DocumentModel, "create").mockRejectedValueOnce(new Error("Simulated MongoDB write failure"));
    const deleteSpy = vi.spyOn(storageService, "deleteFile");

    try {
      const res = await request(app)
        .post("/api/v1/documents/upload")
        .set("Authorization", `Bearer ${adminToken}`)
        .attach("file", validPdfBuffer, "fail_upload_test_13a.pdf");

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("DATABASE_PERSISTENCE_FAILED");
      expect(deleteSpy).toHaveBeenCalled();

      // Verify no document record exists in database
      const doc = await DocumentModel.findOne({ filename: "fail_upload_test_13a.pdf" });
      expect(doc).toBeNull();
    } finally {
      createSpy.mockRestore();
      deleteSpy.mockRestore();
    }
  });

  // 13b. DocumentModel.create() succeeds but AuditEvent.create() fails -> document and file preserved
  it("Requirement 13b: Audit logging failure after document creation preserves document and file", async () => {
    const validPdfBuffer = Buffer.from("%PDF-1.7\nSample technical manual content for upload failure test 13b");
    const auditSpy = vi.spyOn(AuditEvent, "create").mockRejectedValueOnce(new Error("Simulated audit write failure"));
    const deleteSpy = vi.spyOn(storageService, "deleteFile");

    let createdDocId: string | null = null;
    try {
      const res = await request(app)
        .post("/api/v1/documents/upload")
        .set("Authorization", `Bearer ${adminToken}`)
        .attach("file", validPdfBuffer, "audit_fail_test_13b.pdf");

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      createdDocId = res.body.data.id;

      // Verify file was NOT deleted
      expect(deleteSpy).not.toHaveBeenCalled();

      // Verify document record exists in database
      const doc = await DocumentModel.findOne({ filename: "audit_fail_test_13b.pdf" });
      expect(doc).not.toBeNull();
      expect(["processing", "failed"]).toContain(doc?.status);
    } finally {
      auditSpy.mockRestore();
      deleteSpy.mockRestore();
      if (createdDocId) {
        await DocumentModel.findByIdAndDelete(createdDocId);
      }
    }
  });

  // 13c. Socket audit event emission fails after metadata persistence -> document and file preserved
  it("Requirement 13c: Socket audit event emission failure after creation preserves document and file", async () => {
    const validPdfBuffer = Buffer.from("%PDF-1.7\nSample technical manual content for upload failure test 13c");
    const socketModule = await import("../src/index");
    const emitSpy = vi.spyOn(socketModule.io, "to").mockImplementationOnce(() => {
      throw new Error("Simulated socket emission error");
    });
    const deleteSpy = vi.spyOn(storageService, "deleteFile");

    let createdDocId: string | null = null;
    try {
      const res = await request(app)
        .post("/api/v1/documents/upload")
        .set("Authorization", `Bearer ${adminToken}`)
        .attach("file", validPdfBuffer, "socket_fail_test_13c.pdf");

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      createdDocId = res.body.data.id;

      // Verify file was NOT deleted
      expect(deleteSpy).not.toHaveBeenCalled();

      // Verify document record exists in database
      const doc = await DocumentModel.findOne({ filename: "socket_fail_test_13c.pdf" });
      expect(doc).not.toBeNull();
    } finally {
      emitSpy.mockRestore();
      deleteSpy.mockRestore();
      if (createdDocId) {
        await DocumentModel.findByIdAndDelete(createdDocId);
      }
    }
  });
});
