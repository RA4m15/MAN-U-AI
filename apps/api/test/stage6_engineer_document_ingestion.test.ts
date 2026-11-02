import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { app } from "../src/app";
import { env } from "../src/config/env";
import { connectDatabase, isConnectedToMongo } from "../src/config/database";
import { User, DocumentModel } from "../src/models";

describe("Stage 6: Engineer Document Ingestion & Role Resolution Regression Suite", () => {
  let engineerToken: string;
  let adminToken: string;
  let viewerToken: string;
  let engineerUserId: string;
  let viewerUserId: string;

  const validPdfBuffer = Buffer.from(
    "%PDF-1.4\n1 0 obj\n<< /Title (Hydraulic System Operation Manual) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
  );

  beforeAll(async () => {
    await connectDatabase();

    // Clean up test accounts
    await User.deleteMany({
      email: {
        $in: [
          "test.engineer.ingest@plant.io",
          "test.admin.ingest@plant.io",
          "test.viewer.ingest@plant.io",
        ],
      },
    });

    const passwordHash = await bcrypt.hash("SecurePass123!", 10);

    const engUser = await User.create({
      name: "Alex Mercer (Test Engineer)",
      email: "test.engineer.ingest@plant.io",
      passwordHash,
      role: "engineer",
      orgId: "plant-alpha",
      isActive: true,
    });
    engineerUserId = engUser._id.toString();

    const admUser = await User.create({
      name: "Elena Rostova (Test Admin)",
      email: "test.admin.ingest@plant.io",
      passwordHash,
      role: "admin",
      orgId: "plant-alpha",
      isActive: true,
    });

    const viewUser = await User.create({
      name: "Sam Taylor (Test Operator)",
      email: "test.viewer.ingest@plant.io",
      passwordHash,
      role: "viewer",
      orgId: "plant-alpha",
      isActive: true,
    });
    viewerUserId = viewUser._id.toString();

    // Sign authoritative JWTs matching the created database accounts
    engineerToken = jwt.sign(
      { id: engineerUserId, email: engUser.email, name: engUser.name, role: engUser.role },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    adminToken = jwt.sign(
      { id: admUser._id.toString(), email: admUser.email, name: admUser.name, role: admUser.role },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    viewerToken = jwt.sign(
      { id: viewerUserId, email: viewUser.email, name: viewUser.name, role: viewUser.role },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );
  });

  afterAll(async () => {
    if (!isConnectedToMongo) return;
    await User.deleteMany({
      email: {
        $in: [
          "test.engineer.ingest@plant.io",
          "test.admin.ingest@plant.io",
          "test.viewer.ingest@plant.io",
        ],
      },
    });
    await DocumentModel.deleteMany({
      title: { $in: ["Test Hydraulic System Manual", "Admin Plant Overview SOP"] },
    });
  });

  describe("Authentication & Role Resolution", () => {
    it("correctly resolves authenticated Engineer role through login and JWT", async () => {
      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "test.engineer.ingest@plant.io", password: "SecurePass123!" });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.data.user.role).toBe("engineer");
      expect(loginRes.body.data.token).toBeDefined();

      const decoded = jwt.verify(loginRes.body.data.token, env.JWT_SECRET) as any;
      expect(decoded.role).toBe("engineer");
      expect(decoded.email).toBe("test.engineer.ingest@plant.io");
    });

    it("confirms /auth/me returns backend-verified Engineer role", async () => {
      const res = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${engineerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe("engineer");
      expect(res.body.data.email).toBe("test.engineer.ingest@plant.io");
    });

    it("rejects client attempts to elevate privileges via tampered role claims", async () => {
      // Craft a forged JWT claiming admin role with the viewer's ID
      const forgedToken = jwt.sign(
        { id: viewerUserId, email: "test.viewer.ingest@plant.io", role: "admin" },
        env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      // Backend requireAuth and requireRole validate against the MongoDB user document, which is 'viewer'
      const res = await request(app)
        .post("/api/v1/documents/upload")
        .set("Authorization", `Bearer ${forgedToken}`)
        .attach("file", validPdfBuffer, "sample.pdf");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("rejects expired or malformed authentication tokens with HTTP 401", async () => {
      const expiredToken = jwt.sign(
        { id: engineerUserId, email: "test.engineer.ingest@plant.io", role: "engineer" },
        env.JWT_SECRET,
        { expiresIn: "-1s" }
      );

      const res = await request(app)
        .get("/api/v1/documents")
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("TOKEN_INVALID");
    });
  });

  describe("Document Ingestion Authorization & File Validation", () => {
    it("denies unauthenticated document upload attempts with HTTP 401", async () => {
      const res = await request(app)
        .post("/api/v1/documents/upload")
        .attach("file", validPdfBuffer, "sample.pdf");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("strictly denies Viewer accounts from uploading documents with HTTP 403", async () => {
      const res = await request(app)
        .post("/api/v1/documents/upload")
        .set("Authorization", `Bearer ${viewerToken}`)
        .attach("file", validPdfBuffer, "viewer_attempt.pdf");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("rejects unsupported file formats (e.g. .txt, .exe, .docx) with HTTP 400 UNSUPPORTED_FILE_TYPE", async () => {
      const textBuffer = Buffer.from("Plain text content, not a PDF manual");

      const res = await request(app)
        .post("/api/v1/documents/upload")
        .set("Authorization", `Bearer ${engineerToken}`)
        .attach("file", textBuffer, "manual.txt");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNSUPPORTED_FILE_TYPE");
    });

    it("rejects files with invalid PDF magic signature (%PDF-) with HTTP 400 INVALID_FILE_SIGNATURE", async () => {
      // Fake extension .pdf but content does not start with %PDF-
      const invalidBuffer = Buffer.from("THIS IS NOT A VALID PDF SIGNATURE CONTENT");

      const res = await request(app)
        .post("/api/v1/documents/upload")
        .set("Authorization", `Bearer ${engineerToken}`)
        .attach("file", invalidBuffer, "corrupt_document.pdf");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("INVALID_FILE_SIGNATURE");
    });

    it("allows authorized Engineer to upload a valid technical PDF and returns HTTP 202 processing status", async () => {
      const res = await request(app)
        .post("/api/v1/documents/upload")
        .set("Authorization", `Bearer ${engineerToken}`)
        .field("title", "Test Hydraulic System Manual")
        .field("revision", "Rev 2.0")
        .attach("file", validPdfBuffer, "hydraulic_manual.pdf");

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe("Test Hydraulic System Manual");
      expect(res.body.data.revision).toBe("Rev 2.0");
      expect(res.body.data.status).toBe("processing");
      expect(res.body.data.id).toBeDefined();

      const createdDocId = res.body.data.id;

      // Verify persistence in MongoDB
      const docInDb = await DocumentModel.findById(createdDocId);
      expect(docInDb).not.toBeNull();
      expect(docInDb!.title).toBe("Test Hydraulic System Manual");
      expect(docInDb!.filename).toBe("hydraulic_manual.pdf");
      expect(docInDb!.uploadedById.toString()).toBe(engineerUserId);

      // Verify the uploaded document appears in GET /api/v1/documents for the engineer
      const listRes = await request(app)
        .get("/api/v1/documents")
        .set("Authorization", `Bearer ${engineerToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);
      const foundDoc = listRes.body.data.find((d: any) => d.id === createdDocId);
      expect(foundDoc).toBeDefined();
      expect(foundDoc.title).toBe("Test Hydraulic System Manual");
    });

    it("allows Administrator to upload facility documents successfully", async () => {
      const res = await request(app)
        .post("/api/v1/documents/upload")
        .set("Authorization", `Bearer ${adminToken}`)
        .field("title", "Admin Plant Overview SOP")
        .field("revision", "Rev 1.0")
        .attach("file", validPdfBuffer, "plant_overview.pdf");

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe("Admin Plant Overview SOP");
    });
  });
});
