import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { app, isAllowedOrigin } from "../src/app";
import { env } from "../src/config/env";
import { connectDatabase, isConnectedToMongo } from "../src/config/database";
import { User, Conversation, Message, DocumentModel, DocumentChunk } from "../src/models";
import { seedDatabase } from "../src/config/seed";
import { isUserAuthorizedForDocument, toMongoObjectId } from "../src/routes/documents.routes";
import { pdfService, isValidPdfSignature } from "../src/services/pdf.service";
import { GeminiService } from "../src/services/gemini.service";
import { ragService } from "../src/services/rag.service";

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
  it("Requirement 2: Server seed process never resets existing account passwords", async () => {
    if (!isConnectedToMongo) return;

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
  it("Requirement 3: Verifies conversation ownership before returning messages", async () => {
    if (!isConnectedToMongo || !userAConvId) return;

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
  it("Requirement 9: Cross-user isolation in RAG retrieval", async () => {
    if (!isConnectedToMongo || !docAId) return;

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
  });

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
});
