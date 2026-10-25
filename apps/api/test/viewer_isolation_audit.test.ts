import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { app } from "../src/app";
import { env } from "../src/config/env";
import {
  connectDatabase,
  isConnectedToMongo,
  setIsConnectedToMongo,
  validateTestDatabaseSafety,
} from "../src/config/database";
import {
  User,
  DocumentModel,
  DocumentChunk,
  DocumentFigure,
  DocumentPermission,
  Conversation,
  Message,
  Equipment,
} from "../src/models";
import { vectorService } from "../src/services/vector.service";
import { ragService } from "../src/services/rag.service";
import { storageService } from "../src/services/storage.service";
import { isUserAuthorizedForDocument } from "../src/routes/documents.routes";

const TEST_DB_URI = "mongodb://localhost:27017/manuai_dev";

describe("MAN-U-AI Task 19.9.10 & 19.9.11 — Viewer Authorization, RAG Isolation, and Direct Figure-Image Verification", () => {
  const cleanupIds = {
    users: [] as string[],
    documents: [] as string[],
    chunks: [] as string[],
    figures: [] as string[],
    permissions: [] as string[],
    conversations: [] as string[],
  };
  const cleanupStorageFiles: string[] = [];

  const runTimestamp = Date.now();
  let viewerEmail: string;
  let viewerPass: string;
  let viewerId: string;
  let viewerToken: string;

  let ownerUser: any;
  let allowedDoc: any;
  let allowedChunk: any;
  let allowedFigure: any;
  let allowedFigureWithRealFile: any;
  let missingFileFigure: any;
  let restrictedDoc: any;
  let restrictedChunk: any;
  let restrictedFigure: any;
  let permDocId: string;

  let otherConv: any;
  let otherMsg: any;

  // 1x1 transparent PNG buffer for verified image streaming
  const samplePngBuffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  );

  beforeAll(async () => {
    // Assert target database safety
    const safety = validateTestDatabaseSafety(TEST_DB_URI);
    expect(safety.safe).toBe(true);

    if (mongoose.connection.readyState !== 1 || mongoose.connection.name !== "manuai_dev") {
      await connectDatabase(TEST_DB_URI);
    }
  });

  afterAll(async () => {
    // Specific storage file cleanup
    for (const fpath of cleanupStorageFiles) {
      try {
        await storageService.deleteFile(fpath, "local");
      } catch (err) {
        // Safe ignore if already cleaned
      }
    }

    // Specific DB record cleanup
    for (const uid of cleanupIds.users) {
      await User.findByIdAndDelete(uid);
    }
    for (const did of cleanupIds.documents) {
      await DocumentModel.findByIdAndDelete(did);
    }
    for (const cid of cleanupIds.chunks) {
      await DocumentChunk.findByIdAndDelete(cid);
    }
    for (const fid of cleanupIds.figures) {
      await DocumentFigure.findByIdAndDelete(fid);
    }
    for (const pid of cleanupIds.permissions) {
      await DocumentPermission.findByIdAndDelete(pid);
    }
    for (const cid of cleanupIds.conversations) {
      await Conversation.findByIdAndDelete(cid);
      await Message.deleteMany({ conversationId: cid });
    }

    const remainingUsers = await User.countDocuments({ _id: { $in: cleanupIds.users } });
    const remainingDocs = await DocumentModel.countDocuments({ _id: { $in: cleanupIds.documents } });
    const remainingChunks = await DocumentChunk.countDocuments({ _id: { $in: cleanupIds.chunks } });
    const remainingFigs = await DocumentFigure.countDocuments({ _id: { $in: cleanupIds.figures } });
    const remainingPerms = await DocumentPermission.countDocuments({ _id: { $in: cleanupIds.permissions } });
    const remainingConvs = await Conversation.countDocuments({ _id: { $in: cleanupIds.conversations } });

    expect(remainingUsers).toBe(0);
    expect(remainingDocs).toBe(0);
    expect(remainingChunks).toBe(0);
    expect(remainingFigs).toBe(0);
    expect(remainingPerms).toBe(0);
    expect(remainingConvs).toBe(0);
  });

  it("1. Create disposable viewer test account in isolated database via public registration", async () => {
    viewerEmail = `viewer-audit-${runTimestamp}@plant.io`;
    viewerPass = `AuditPass_${runTimestamp}!`;

    const regRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Audit Disposable Viewer",
        email: viewerEmail,
        password: viewerPass,
      });

    expect(regRes.status).toBe(201);
    expect(regRes.body.success).toBe(true);
    expect(regRes.body.data.user.role).toBe("viewer");
    expect(regRes.body.data.user.passwordHash).toBeUndefined();
    expect(regRes.body.data.user.password).toBeUndefined();
    expect(regRes.body.data.token).toBeDefined();

    viewerId = regRes.body.data.user.id;
    viewerToken = regRes.body.data.token;
    cleanupIds.users.push(viewerId);
  });

  it("2. Verify viewer login, /api/v1/auth/me, equipment access, conversation creation, and /api/v1/chat", async () => {
    // 2a. Login
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: viewerEmail,
        password: viewerPass,
      });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.user.role).toBe("viewer");
    viewerToken = loginRes.body.data.token;

    // 2b. /auth/me
    const meRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${viewerToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.data.role).toBe("viewer");

    // 2c. Equipment access
    const eqRes = await request(app)
      .get("/api/v1/equipment")
      .set("Authorization", `Bearer ${viewerToken}`);
    expect(eqRes.status).toBe(200);
    expect(Array.isArray(eqRes.body.data)).toBe(true);

    // 2d. Conversation creation
    const convRes = await request(app)
      .post("/api/v1/conversations")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ title: `Audit Conversation ${runTimestamp}` });
    expect(convRes.status).toBe(201);
    expect(convRes.body.data.id).toBeDefined();
    cleanupIds.conversations.push(convRes.body.data.id);

    // 2e. /api/v1/chat
    const chatRes = await request(app)
      .post("/api/v1/chat")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        message: "Confirm status and available plant documentation.",
        conversationId: convRes.body.data.id,
      });
    expect(chatRes.status).toBe(200);
    expect(chatRes.body.success).toBe(true);
    expect(typeof chatRes.body.data.answer).toBe("string");
  });

  it("3. Create isolated document fixtures (one permitted candidate, one restricted to different user/facility)", async () => {
    const ownerPasswordHash = await bcrypt.hash(`OwnerPass_${runTimestamp}!`, 10);
    ownerUser = await User.create({
      name: "Plant Facility Engineer",
      email: `engineer-owner-${runTimestamp}@plant.io`,
      passwordHash: ownerPasswordHash,
      role: "engineer",
    });
    cleanupIds.users.push(ownerUser._id.toString());

    // Permitted candidate document fixture
    allowedDoc = await DocumentModel.create({
      title: `Authorized Cooling Tower Manual ${runTimestamp}`,
      revision: "Rev 1.0",
      filename: `authorized_cooling_${runTimestamp}.pdf`,
      storagePath: `authorized_cooling_${runTimestamp}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 1024,
      status: "indexed",
      pageCount: 3,
      tags: ["Cooling", "Authorized"],
      uploadedById: ownerUser._id,
    });
    cleanupIds.documents.push(allowedDoc._id.toString());

    allowedChunk = await DocumentChunk.create({
      documentId: allowedDoc._id,
      documentTitle: allowedDoc.title,
      revision: allowedDoc.revision,
      page: 2,
      section: "Cooling Tower Normal Operating Pressure",
      text: "Authorized Evidence: Cooling tower secondary circuit pressure must be maintained between 2.4 bar and 2.8 bar.",
      embedding: new Array(768).fill(0.015),
      tokenCount: 22,
    });
    cleanupIds.chunks.push(allowedChunk._id.toString());

    // Save genuine local file for authorized streaming test
    const savedAllowedFile = await storageService.saveFile(`allowed_fig_${runTimestamp}.png`, samplePngBuffer);
    cleanupStorageFiles.push(savedAllowedFile.storagePath);

    allowedFigureWithRealFile = await DocumentFigure.create({
      documentId: allowedDoc._id,
      documentTitle: allowedDoc.title,
      figureId: `fig-allowed-real-${runTimestamp}`,
      page: 2,
      caption: "Authorized Cooling Loop Schematic (Genuine Image)",
      figureType: "diagram",
      status: "extracted",
      storagePath: savedAllowedFile.storagePath,
      storageProvider: "local",
      mimeType: "image/png",
      sizeBytes: samplePngBuffer.length,
    });
    cleanupIds.figures.push(allowedFigureWithRealFile._id.toString());

    // Create a figure with a missing storage file to verify safe failure handling
    missingFileFigure = await DocumentFigure.create({
      documentId: allowedDoc._id,
      documentTitle: allowedDoc.title,
      figureId: `fig-allowed-missing-${runTimestamp}`,
      page: 3,
      caption: "Missing Figure File",
      figureType: "diagram",
      status: "extracted",
      storagePath: `non_existent_file_${runTimestamp}.jpg`,
      storageProvider: "local",
      mimeType: "image/jpeg",
      sizeBytes: 1024,
    });
    cleanupIds.figures.push(missingFileFigure._id.toString());

    // Restricted document fixture (facility gas turbine)
    restrictedDoc = await DocumentModel.create({
      title: `Confidential Gas Turbine Overhaul Protocol ${runTimestamp}`,
      revision: "Rev 9.9",
      filename: `confidential_turbine_${runTimestamp}.pdf`,
      storagePath: `confidential_turbine_${runTimestamp}.pdf`,
      mimeType: "application/pdf",
      sizeBytes: 2048,
      status: "indexed",
      pageCount: 12,
      tags: ["Confidential", "Restricted", "Turbine"],
      uploadedById: ownerUser._id,
    });
    cleanupIds.documents.push(restrictedDoc._id.toString());

    restrictedChunk = await DocumentChunk.create({
      documentId: restrictedDoc._id,
      documentTitle: restrictedDoc.title,
      revision: restrictedDoc.revision,
      page: 5,
      section: "Confidential Rotor Axial Tolerances",
      text: "Restricted Evidence: Gas turbine confidential rotor axial clearance must not exceed 0.045 mm under full thermal expansion.",
      embedding: new Array(768).fill(0.015),
      tokenCount: 24,
    });
    cleanupIds.chunks.push(restrictedChunk._id.toString());

    // Save genuine local file for restricted figure
    const savedRestrictedFile = await storageService.saveFile(`restricted_fig_${runTimestamp}.png`, samplePngBuffer);
    cleanupStorageFiles.push(savedRestrictedFile.storagePath);

    restrictedFigure = await DocumentFigure.create({
      documentId: restrictedDoc._id,
      documentTitle: restrictedDoc.title,
      figureId: `fig-restricted-${runTimestamp}`,
      page: 5,
      caption: "Confidential Rotor Assembly Diagram",
      figureType: "diagram",
      status: "extracted",
      storagePath: savedRestrictedFile.storagePath,
      storageProvider: "local",
      mimeType: "image/png",
      sizeBytes: samplePngBuffer.length,
    });
    cleanupIds.figures.push(restrictedFigure._id.toString());

    expect(allowedDoc._id).toBeDefined();
    expect(restrictedDoc._id).toBeDefined();
  });

  it("4. Verify viewer with no document permissions cannot retrieve restricted chunks, metadata, figures, file, or citations", async () => {
    // 4a. Direct metadata access
    const metaRes = await request(app)
      .get(`/api/v1/documents/${restrictedDoc._id}`)
      .set("Authorization", `Bearer ${viewerToken}`);
    expect(metaRes.status).toBe(403);
    expect(metaRes.body.error.code).toBe("FORBIDDEN");

    // 4b. Direct chunks access
    const chunksRes = await request(app)
      .get(`/api/v1/documents/${restrictedDoc._id}/chunks`)
      .set("Authorization", `Bearer ${viewerToken}`);
    expect(chunksRes.status).toBe(403);
    expect(chunksRes.body.error.code).toBe("FORBIDDEN");

    // 4c. Direct figures metadata list access
    const figuresRes = await request(app)
      .get(`/api/v1/documents/${restrictedDoc._id}/figures`)
      .set("Authorization", `Bearer ${viewerToken}`);
    expect(figuresRes.status).toBe(403);
    expect(figuresRes.body.error.code).toBe("FORBIDDEN");

    // 4d. Direct file access
    const fileRes = await request(app)
      .get(`/api/v1/documents/${restrictedDoc._id}/file`)
      .set("Authorization", `Bearer ${viewerToken}`);
    expect(fileRes.status).toBe(403);
    expect(fileRes.body.error.code).toBe("FORBIDDEN");

    // 4e. RAG query for restricted content
    const ragRes = await request(app)
      .post("/api/v1/chat")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        message: "What is the confidential gas turbine rotor axial clearance under full thermal expansion?",
      });
    expect(ragRes.status).toBe(200);
    const leakedCitation = (ragRes.body.data.citations || []).find((c: any) => c.documentId === restrictedDoc._id.toString());
    expect(leakedCitation).toBeUndefined();
    expect(ragRes.body.data.answer.toLowerCase()).toContain("could not locate");
    expect(ragRes.body.data.answer).not.toContain("0.045 mm");
  });

  // ── Task 19.9.11: Direct Figure-Image Authorization & IDOR Defense ───────
  describe("Task 19.9.11 — Direct Figure-Image Endpoint Authorization & Safety", () => {
    it("11.1: Denies unpermitted viewer access to figure image endpoint with 403 FORBIDDEN and zero image bytes", async () => {
      // Viewer requests restricted document's figure image by figureId
      const resByFigureId = await request(app)
        .get(`/api/v1/documents/${restrictedDoc._id}/figures/${restrictedFigure.figureId}/image`)
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(resByFigureId.status).toBe(403);
      expect(resByFigureId.body.success).toBe(false);
      expect(resByFigureId.body.error.code).toBe("FORBIDDEN");
      expect(resByFigureId.body.error.message).toContain("Access to document figure image denied");
      expect(resByFigureId.headers["content-type"]).toContain("application/json");
      expect(resByFigureId.headers["content-type"]).not.toContain("image/");

      // Viewer requests restricted document's figure image by Mongo ObjectId
      const resByObjectId = await request(app)
        .get(`/api/v1/documents/${restrictedDoc._id}/figures/${restrictedFigure._id}/image`)
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(resByObjectId.status).toBe(403);
      expect(resByObjectId.body.error.code).toBe("FORBIDDEN");
      expect(resByObjectId.headers["content-type"]).not.toContain("image/");

      // Also confirm unauthenticated request is rejected with 401
      const unauthRes = await request(app)
        .get(`/api/v1/documents/${restrictedDoc._id}/figures/${restrictedFigure.figureId}/image`);
      expect(unauthRes.status).toBe(401);
      expect(unauthRes.body.error.code).toBe("UNAUTHORIZED");
    });

    it("11.2: Streams genuine figure image with 200 OK and valid image content-type for explicitly permitted document", async () => {
      // Grant explicit permission to allowedDoc for viewer
      const permDoc = await DocumentPermission.create({
        documentId: allowedDoc._id,
        userId: new mongoose.Types.ObjectId(viewerId),
        canRead: true,
        canWrite: false,
      });
      permDocId = permDoc._id.toString();
      cleanupIds.permissions.push(permDocId);

      // 1. Retrieve by string figureId (e.g. fig-allowed-real-...)
      const resByFigureId = await request(app)
        .get(`/api/v1/documents/${allowedDoc._id}/figures/${allowedFigureWithRealFile.figureId}/image`)
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(resByFigureId.status).toBe(200);
      expect(resByFigureId.headers["content-type"]).toBe("image/png");
      expect(resByFigureId.headers["content-length"]).toBe(String(samplePngBuffer.length));
      expect(resByFigureId.body).toBeInstanceOf(Buffer);
      expect(resByFigureId.body.equals(samplePngBuffer)).toBe(true);

      // 2. Retrieve by MongoDB ObjectId
      const resByObjectId = await request(app)
        .get(`/api/v1/documents/${allowedDoc._id}/figures/${allowedFigureWithRealFile._id}/image`)
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(resByObjectId.status).toBe(200);
      expect(resByObjectId.headers["content-type"]).toBe("image/png");
      expect(resByObjectId.body.equals(samplePngBuffer)).toBe(true);
    });

    it("11.3: Rejects cross-document ID substitution (requesting restricted figure under permitted document URL) with 404 FIGURE_NOT_FOUND", async () => {
      // IDOR attack: Viewer has permission to allowedDoc._id, but passes restrictedFigure.figureId in the URL
      const idorResByFigureId = await request(app)
        .get(`/api/v1/documents/${allowedDoc._id}/figures/${restrictedFigure.figureId}/image`)
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(idorResByFigureId.status).toBe(404);
      expect(idorResByFigureId.body.success).toBe(false);
      expect(idorResByFigureId.body.error.code).toBe("FIGURE_NOT_FOUND");
      expect(idorResByFigureId.body.error.message).toContain("Visual figure image not found");
      expect(idorResByFigureId.headers["content-type"]).not.toContain("image/");

      // IDOR attack: Viewer passes restrictedFigure._id in the URL under allowedDoc._id
      const idorResByObjectId = await request(app)
        .get(`/api/v1/documents/${allowedDoc._id}/figures/${restrictedFigure._id}/image`)
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(idorResByObjectId.status).toBe(404);
      expect(idorResByObjectId.body.error.code).toBe("FIGURE_NOT_FOUND");
    });

    it("11.4: Missing figure file in storage returns safe 404 FIGURE_IMAGE_UNAVAILABLE without exposing filesystem paths", async () => {
      // Document is authorized, figure record exists in MongoDB, but underlying image file is missing
      const res = await request(app)
        .get(`/api/v1/documents/${allowedDoc._id}/figures/${missingFileFigure.figureId}/image`)
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FIGURE_IMAGE_UNAVAILABLE");
      expect(res.body.error.message).toBe("Figure image file is missing or unavailable in storage");

      // Verify no sensitive internal information leaked
      const rawBody = JSON.stringify(res.body);
      expect(rawBody).not.toContain("uploads");
      expect(rawBody).not.toContain("C:\\");
      expect(rawBody).not.toContain("/uploads/");
      expect(rawBody).not.toContain("storagePath");
      expect(rawBody).not.toContain("Error:");
    });

    it("11.5: Non-existent figure ID and invalid document ID return safe 404 without leaking internal errors", async () => {
      // 1. Non-existent figure ID under valid permitted document
      const fakeFigRes = await request(app)
        .get(`/api/v1/documents/${allowedDoc._id}/figures/fig-non-existent-9999/image`)
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(fakeFigRes.status).toBe(404);
      expect(fakeFigRes.body.error.code).toBe("FIGURE_NOT_FOUND");
      expect(fakeFigRes.body.error.message).toContain("Visual figure image not found");

      // 2. Non-existent document ObjectId
      const nonExistentDocId = new mongoose.Types.ObjectId().toString();
      const nonExistentDocRes = await request(app)
        .get(`/api/v1/documents/${nonExistentDocId}/figures/${allowedFigureWithRealFile.figureId}/image`)
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(nonExistentDocRes.status).toBe(404);
      expect(nonExistentDocRes.body.error.code).toBe("NOT_FOUND");
      expect(nonExistentDocRes.body.error.message).toBe("Document not found");

      // 3. Malformed document ID string
      const malformedDocRes = await request(app)
        .get(`/api/v1/documents/invalid-doc-id-123/figures/${allowedFigureWithRealFile.figureId}/image`)
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(malformedDocRes.status).toBe(404);
      expect(malformedDocRes.body.error.code).toBe("NOT_FOUND");
      expect(malformedDocRes.body.error.message).toBe("Document not found");
    });
  });

  it("5. Grant explicit permission to allowed fixture and verify retrieval returns only permitted evidence", async () => {
    // Metadata access succeeds for allowed doc
    const metaRes = await request(app)
      .get(`/api/v1/documents/${allowedDoc._id}`)
      .set("Authorization", `Bearer ${viewerToken}`);
    expect(metaRes.status).toBe(200);
    expect(metaRes.body.data.title).toBe(allowedDoc.title);

    // Chunks access succeeds for allowed doc
    const chunksRes = await request(app)
      .get(`/api/v1/documents/${allowedDoc._id}/chunks`)
      .set("Authorization", `Bearer ${viewerToken}`);
    expect(chunksRes.status).toBe(200);
    expect(chunksRes.body.data.length).toBeGreaterThan(0);

    // Query RAG for permitted evidence
    const ragRes = await request(app)
      .post("/api/v1/chat")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        message: "What is the cooling tower secondary circuit operating pressure?",
      });
    expect(ragRes.status).toBe(200);
    const citations = ragRes.body.data.citations || [];
    const hasAllowed = citations.some((c: any) => c.documentId === allowedDoc._id.toString());
    const hasRestricted = citations.some((c: any) => c.documentId === restrictedDoc._id.toString());

    expect(hasAllowed).toBe(true);
    expect(hasRestricted).toBe(false);
  });

  it("6. Attempt cross-user conversation/message access and direct-ID access to restricted document", async () => {
    otherConv = await Conversation.create({
      userId: ownerUser._id,
      title: `Engineer Private Conversation ${runTimestamp}`,
    });
    cleanupIds.conversations.push(otherConv._id.toString());

    otherMsg = await Message.create({
      conversationId: otherConv._id,
      role: "user",
      content: "Confidential engineer plant log.",
    });

    // Cross-user conversation details access
    const convRes = await request(app)
      .get(`/api/v1/conversations/${otherConv._id}`)
      .set("Authorization", `Bearer ${viewerToken}`);
    expect(convRes.status).toBe(403);
    expect(convRes.body.error.code).toBe("FORBIDDEN");

    // Cross-user message list access
    const msgRes = await request(app)
      .get(`/api/v1/conversations/${otherConv._id}/messages`)
      .set("Authorization", `Bearer ${viewerToken}`);
    expect(msgRes.status).toBe(403);
    expect(msgRes.body.error.code).toBe("FORBIDDEN");

    // Cross-user chat hijack attempt
    const chatHijackRes = await request(app)
      .post("/api/v1/chat")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        message: "Unauthorized injection into foreign conversation",
        conversationId: otherConv._id.toString(),
      });
    expect(chatHijackRes.status).toBe(403);
    expect(chatHijackRes.body.error.code).toBe("FORBIDDEN");

    // Direct-ID access to restricted document
    const directDocRes = await request(app)
      .get(`/api/v1/documents/${restrictedDoc._id}`)
      .set("Authorization", `Bearer ${viewerToken}`);
    expect(directDocRes.status).toBe(403);
    expect(directDocRes.body.error.code).toBe("FORBIDDEN");
  });

  it("7. Test that a viewer cannot upload documents or acquire engineer/admin privileges through modified requests", async () => {
    // 7a. Document upload attempt by viewer
    const uploadRes = await request(app)
      .post("/api/v1/documents/upload")
      .set("Authorization", `Bearer ${viewerToken}`)
      .attach("file", Buffer.from("%PDF-1.4 dummy pdf"), "viewer_upload.pdf");
    expect(uploadRes.status).toBe(403);
    expect(uploadRes.body.error.code).toBe("FORBIDDEN");

    // 7b. Self role escalation via PATCH /users/:id/role
    const patchRoleRes = await request(app)
      .patch(`/api/v1/users/${viewerId}/role`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ role: "admin" });
    expect(patchRoleRes.status).toBe(403);
    expect(patchRoleRes.body.error.code).toBe("FORBIDDEN");

    // 7c. Create admin user via POST /users
    const postUserRes = await request(app)
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        name: "Attacker User",
        email: `attacker-${runTimestamp}@plant.io`,
        password: "ValidPassword123!",
        role: "admin",
      });
    expect(postUserRes.status).toBe(403);
    expect(postUserRes.body.error.code).toBe("FORBIDDEN");

    // 7d. Tampered JWT with forged role: "admin" claim
    const tamperedToken = jwt.sign(
      { id: viewerId, email: viewerEmail, name: "Tampered Viewer", role: "admin" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    const meTamperedRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${tamperedToken}`);
    expect(meTamperedRes.status).toBe(200);
    // Must reflect authoritative DB role 'viewer', NOT token claim 'admin'
    expect(meTamperedRes.body.data.role).toBe("viewer");

    const usersTamperedRes = await request(app)
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${tamperedToken}`);
    expect(usersTamperedRes.status).toBe(403);
    expect(usersTamperedRes.body.error.code).toBe("FORBIDDEN");
  });

  it("8. Verify unavailable permission store or disconnected RAG service fails closed in production-mode logic", async () => {
    // 8a. isUserAuthorizedForDocument fails closed when isConnectedToMongo is false
    const origConnected = isConnectedToMongo;
    try {
      setIsConnectedToMongo(false);
      const authResult = await isUserAuthorizedForDocument(viewerId, "viewer", allowedDoc._id.toString());
      expect(authResult.authorized).toBe(false);
      expect(authResult.doc).toBeNull();
    } finally {
      setIsConnectedToMongo(origConnected);
    }

    // 8b. VectorService throws in production when DB disconnected
    const origEnvNode = env.NODE_ENV;
    try {
      (env as any).NODE_ENV = "production";
      setIsConnectedToMongo(false);
      await expect(
        vectorService.searchSimilar(new Array(768).fill(0.01), "test", 5, 0.5)
      ).rejects.toThrow(/disconnected|unavailable/i);
    } finally {
      (env as any).NODE_ENV = origEnvNode;
      setIsConnectedToMongo(origConnected);
    }

    // 8c. RAG service in production mode with disconnected embedding provider fails closed with error
    try {
      (env as any).NODE_ENV = "production";
      await expect(
        ragService.answerQuestion("test query", { id: viewerId, role: "viewer" })
      ).rejects.toThrow(/operational live Gemini|prohibited in production/i);
    } finally {
      (env as any).NODE_ENV = origEnvNode;
    }

    // 8d. vectorService.searchSimilar with filterDocIds = [] returns empty array
    const emptyDocsRes = await vectorService.searchSimilar(
      new Array(768).fill(0.01),
      "test query",
      5,
      0.5,
      []
    );
    expect(emptyDocsRes).toEqual([]);
  });

  it("9. Clean up only the specific test records created for this run (verified via afterAll)", async () => {
    // Verified via afterAll hook: zero remaining records for created IDs, collection-wide deletions strictly avoided
    expect(cleanupIds.users.length).toBeGreaterThan(0);
    expect(cleanupIds.documents.length).toBeGreaterThan(0);
    expect(cleanupIds.chunks.length).toBeGreaterThan(0);
    expect(cleanupIds.figures.length).toBeGreaterThan(0);
    expect(cleanupIds.permissions.length).toBeGreaterThan(0);
    expect(cleanupIds.conversations.length).toBeGreaterThan(0);
    expect(cleanupStorageFiles.length).toBeGreaterThan(0);
  });
});
