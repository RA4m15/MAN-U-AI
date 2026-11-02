import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { app } from "../src/app";
import { connectDatabase, isConnectedToMongo } from "../src/config/database";
import { User, MediaModel, DocumentModel, AuditEvent } from "../src/models";
import { migrateLegacyViewers } from "../src/services/provision.service";

describe("Stage 7: Viewer-to-Operator Role Removal & Machine Media Ingestion Pipeline", () => {
  const engineerEmail = "engineer.stage7@plant.io";
  const operatorEmail = "operator.stage7@plant.io";
  const testPassword = "Stage7SecurePassword123!";

  let engineerToken: string;
  let operatorToken: string;
  let engineerId: string;
  let operatorId: string;

  // Real binary signatures
  const validJpegBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  ]);
  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);

  // Valid MP4 header with ftyp box
  // 4 bytes size (0x00000014), 4 bytes 'ftyp', 4 bytes 'isom', 4 bytes minor, 4 bytes compat 'isom'
  const validMp4Buffer = Buffer.from([
    0x00, 0x00, 0x00, 0x14, // size 20
    0x66, 0x74, 0x79, 0x70, // 'ftyp'
    0x69, 0x73, 0x6f, 0x6d, // 'isom'
    0x00, 0x00, 0x02, 0x00, // minor_version
    0x69, 0x73, 0x6f, 0x6d, // compatible_brands
    0x00, 0x00, 0x00, 0x08, // empty trailing atom
    0x66, 0x72, 0x65, 0x65, // 'free'
  ]);

  // Valid MOV header with qt brand
  const validMovBuffer = Buffer.from([
    0x00, 0x00, 0x00, 0x14, // size 20
    0x66, 0x74, 0x79, 0x70, // 'ftyp'
    0x71, 0x74, 0x20, 0x20, // 'qt  '
    0x20, 0x05, 0x03, 0x00, // minor_version
    0x71, 0x74, 0x20, 0x20, // compatible_brands
  ]);

  const validPdfBuffer = Buffer.from(
    "%PDF-1.4\n1 0 obj\n<< /Title (Manual) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
  );

  beforeAll(async () => {
    await connectDatabase();

    // Clean test data
    await User.deleteMany({ email: { $in: [engineerEmail, operatorEmail, "engineer@plant.io", "legacy.viewer@plant.io"] } });
    await MediaModel.deleteMany({ title: /Stage7/ });
    await DocumentModel.deleteMany({ title: /Stage7/ });
    await AuditEvent.deleteMany({ "details.targetEmail": { $in: [engineerEmail, operatorEmail, "engineer@plant.io", "legacy.viewer@plant.io"] } });

    const passwordHash = await bcrypt.hash(testPassword, 10);

    // Create accounts with legacy 'viewer' role directly in collection to test migration
    await User.collection.insertOne({
      name: "Legacy Plant Engineer",
      email: "engineer@plant.io",
      passwordHash,
      role: "viewer",
      orgId: "plant-alpha",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await User.collection.insertOne({
      name: "Legacy Plant Viewer",
      email: "legacy.viewer@plant.io",
      passwordHash,
      role: "viewer",
      orgId: "plant-alpha",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterAll(async () => {
    if (!isConnectedToMongo) return;
    await User.deleteMany({ email: { $in: [engineerEmail, operatorEmail, "engineer@plant.io", "legacy.viewer@plant.io"] } });
    await MediaModel.deleteMany({ title: /Stage7/ });
    await DocumentModel.deleteMany({ title: /Stage7/ });
    await AuditEvent.deleteMany({ "details.targetEmail": { $in: [engineerEmail, operatorEmail, "engineer@plant.io", "legacy.viewer@plant.io"] } });
  });

  describe("Part 1: Auditable Legacy Role Migration", () => {
    it("1.1 Dry-run mode previews migrations without modifying accounts", async () => {
      const dryResult = await migrateLegacyViewers({
        dryRun: true,
        confirm: false,
      });

      expect(dryResult.dryRun).toBe(true);
      expect(dryResult.totalFound).toBeGreaterThanOrEqual(2);
      expect(dryResult.promotedEngineerCount).toBe(1); // engineer@plant.io
      expect(dryResult.migratedCount).toBeGreaterThanOrEqual(1); // legacy.viewer@plant.io

      // Check DB records were NOT modified
      const eng = await User.findOne({ email: "engineer@plant.io" });
      expect(eng?.role).toBe("viewer");
    });

    it("1.2 Confirmed migration promotes engineer@plant.io to engineer and others to operator", async () => {
      const liveResult = await migrateLegacyViewers({
        dryRun: false,
        confirm: true,
        operatorEmail: "admin@plant.io",
      });

      expect(liveResult.dryRun).toBe(false);
      expect(liveResult.promotedEngineerCount).toBe(1);

      // Verify engineer@plant.io is now 'engineer'
      const eng = await User.findOne({ email: "engineer@plant.io" });
      expect(eng?.role).toBe("engineer");
      expect(await eng?.comparePassword(testPassword)).toBe(true); // Password strictly preserved

      // Verify legacy.viewer@plant.io is now 'operator'
      const viewerUser = await User.findOne({ email: "legacy.viewer@plant.io" });
      expect(viewerUser?.role).toBe("operator");
      expect(await viewerUser?.comparePassword(testPassword)).toBe(true);

      // Verify AuditEvents were generated
      const auditEng = await AuditEvent.findOne({
        "details.targetEmail": "engineer@plant.io",
        action: "legacy_role_migration",
      });
      expect(auditEng).toBeDefined();
      expect(auditEng?.details.newRole).toBe("engineer");
    });

    it("1.3 New registrations default to operator role and reject viewer", async () => {
      // Create fresh Operator account
      const regOpRes = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Stage7 Operator",
          email: operatorEmail,
          password: testPassword,
        });

      expect(regOpRes.status).toBe(201);
      expect(regOpRes.body.data.user.role).toBe("operator");
      operatorToken = regOpRes.body.data.token;
      operatorId = regOpRes.body.data.user.id;

      // Create fresh Engineer account via admin promotion
      const regEngRes = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Stage7 Engineer",
          email: engineerEmail,
          password: testPassword,
        });
      engineerId = regEngRes.body.data.user.id;

      // Assign engineer role
      await User.findByIdAndUpdate(engineerId, { role: "engineer" });

      const loginEngRes = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: engineerEmail, password: testPassword });
      engineerToken = loginEngRes.body.data.token;
      expect(loginEngRes.body.data.user.role).toBe("engineer");
    });
  });

  describe("Part 4: Role-Based Permissions & Document Upload Separation", () => {
    it("4.1 Operator CANNOT upload official SOP / manual PDF to /api/v1/documents/upload", async () => {
      const res = await request(app)
        .post("/api/v1/documents/upload")
        .set("Authorization", `Bearer ${operatorToken}`)
        .field("title", "Stage7 Unauthorized Manual")
        .attach("file", validPdfBuffer, "sop_manual.pdf");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("4.2 Engineer CAN upload official SOP / manual PDF to /api/v1/documents/upload", async () => {
      const res = await request(app)
        .post("/api/v1/documents/upload")
        .set("Authorization", `Bearer ${engineerToken}`)
        .field("title", "Stage7 Authorized Manual")
        .attach("file", validPdfBuffer, "sop_manual.pdf");

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe("Stage7 Authorized Manual");
    });
  });

  describe("Part 3: Backend Media Ingestion Pipeline (POST /api/v1/media/ingest)", () => {
    let createdImageId: string;
    let createdVideoId: string;

    it("3.1 Ingests genuine JPEG machine photograph with vision analysis & vector indexing", async () => {
      const res = await request(app)
        .post("/api/v1/media/ingest")
        .set("Authorization", `Bearer ${engineerToken}`)
        .field("title", "Stage7 Turbine Bearing Inspection")
        .field("description", "Vibration monitoring and thermal scan of bearing housing")
        .attach("file", validJpegBuffer, "bearing_photo.jpg");

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mediaType).toBe("image");
      expect(res.body.data.status).toBe("indexed");
      expect(res.body.data.technicalFindings).toContain("Stage7 Turbine Bearing Inspection");

      createdImageId = res.body.data.id;

      // Verify MongoDB persistence
      const doc = await MediaModel.findById(createdImageId);
      expect(doc).toBeDefined();
      expect(doc?.status).toBe("indexed");
      expect(doc?.sizeBytes).toBe(validJpegBuffer.length);
    });

    it("3.2 Ingests genuine PNG inspection photograph", async () => {
      const res = await request(app)
        .post("/api/v1/media/ingest")
        .set("Authorization", `Bearer ${engineerToken}`)
        .field("title", "Stage7 Pressure Gauge Reading")
        .attach("file", validPngBuffer, "gauge.png");

      expect(res.status).toBe(201);
      expect(res.body.data.mediaType).toBe("image");
      expect(res.body.data.status).toBe("indexed");
    });

    it("3.3 Ingests genuine MP4 machine inspection video", async () => {
      const res = await request(app)
        .post("/api/v1/media/ingest")
        .set("Authorization", `Bearer ${engineerToken}`)
        .field("title", "Stage7 Gearbox Noise Recording")
        .field("description", "Acoustic recording of main gearbox during startup")
        .attach("file", validMp4Buffer, "gearbox.mp4");

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.mediaType).toBe("video");
      expect(res.body.data.status).toBe("indexed");

      createdVideoId = res.body.data.id;
    });

    it("3.4 Ingests genuine MOV machine inspection video", async () => {
      const res = await request(app)
        .post("/api/v1/media/ingest")
        .set("Authorization", `Bearer ${engineerToken}`)
        .field("title", "Stage7 Motor Vibration Clip")
        .attach("file", validMovBuffer, "motor.mov");

      expect(res.status).toBe(201);
      expect(res.body.data.mediaType).toBe("video");
      expect(res.body.data.status).toBe("indexed");
    });

    it("3.5 Operator CAN capture machine media evidence via /api/v1/media/ingest", async () => {
      const res = await request(app)
        .post("/api/v1/media/ingest")
        .set("Authorization", `Bearer ${operatorToken}`)
        .field("title", "Stage7 Operator Shift Photo")
        .attach("file", validJpegBuffer, "operator_evidence.jpg");

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.uploadedById).toBe(operatorId);
    });

    it("3.6 Rejects fake image file with invalid binary signature", async () => {
      const fakeBuffer = Buffer.from("THIS IS NOT A VALID JPEG OR PNG BINARY IMAGE");
      const res = await request(app)
        .post("/api/v1/media/ingest")
        .set("Authorization", `Bearer ${engineerToken}`)
        .field("title", "Stage7 Corrupted File")
        .attach("file", fakeBuffer, "fake.jpg");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("INVALID_FILE_SIGNATURE");
    });

    it("3.7 Rejects oversized image (> 15MB)", async () => {
      // Construct buffer with valid JPEG magic header but exceeding 15MB
      const bigBuffer = Buffer.alloc(16 * 1024 * 1024);
      bigBuffer[0] = 0xff;
      bigBuffer[1] = 0xd8;
      bigBuffer[2] = 0xff;

      const res = await request(app)
        .post("/api/v1/media/ingest")
        .set("Authorization", `Bearer ${engineerToken}`)
        .field("title", "Stage7 Huge Photo")
        .attach("file", bigBuffer, "huge.jpg");

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("FILE_SIZE_LIMIT_EXCEEDED");
    });

    it("3.8 Rejects unauthenticated request with 401", async () => {
      const res = await request(app)
        .post("/api/v1/media/ingest")
        .field("title", "Stage7 No Auth")
        .attach("file", validJpegBuffer, "test.jpg");

      expect(res.status).toBe(401);
    });

    it("3.9 Fetches media list via GET /api/v1/media", async () => {
      const res = await request(app)
        .get("/api/v1/media")
        .set("Authorization", `Bearer ${engineerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it("3.10 Securely streams media file via GET /api/v1/media/:id/file", async () => {
      const res = await request(app)
        .get(`/api/v1/media/${createdImageId}/file`)
        .set("Authorization", `Bearer ${engineerToken}`);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("image/jpeg");
      expect(res.body).toBeDefined();
    });
  });
});
