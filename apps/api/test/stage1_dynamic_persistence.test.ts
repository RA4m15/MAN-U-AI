import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { app } from "../src/app";
import { env } from "../src/config/env";
import { connectDatabase, isConnectedToMongo, setIsConnectedToMongo } from "../src/config/database";
import { Equipment, Feedback } from "../src/models";
import { toMongoObjectId } from "../src/routes/documents.routes";

describe("Stage 1 — Removal of Synthetic Uploads & False-Success API Responses", () => {
  let adminToken: string;
  let engineerToken: string;
  let engineerId: string;
  let adminId: string;

  beforeAll(async () => {
    await connectDatabase();

    adminId = "usr-admin-stage1-root";
    engineerId = "usr-engineer-stage1-1";

    adminToken = jwt.sign(
      { id: adminId, email: "admin.stage1@plant.io", name: "Admin Stage1", role: "admin" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    engineerToken = jwt.sign(
      { id: engineerId, email: "engineer.stage1@plant.io", name: "Engineer Stage1", role: "engineer" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );
  });

  afterAll(async () => {
    if (isConnectedToMongo) {
      await Equipment.deleteMany({ name: /Stage 1/ });
      await Feedback.deleteMany({ comment: /Stage 1/ });
    }
  });

  // ── 1. Document Upload without File is Rejected (Synthetic PDF fallback removed) ──
  it("Requirement 1: Upload without a file attachment is rejected with 400 NO_FILE", async () => {
    const res = await request(app)
      .post("/api/v1/documents/upload")
      .set("Authorization", `Bearer ${engineerToken}`)
      .field("title", "Missing File Manual")
      .field("revision", "Rev 1.0");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("NO_FILE");
  });

  // ── 2. Invalid PDF Files are Rejected ─────────────────────────────────────────
  it("Requirement 2: Non-PDF or corrupted signature file upload is rejected with 400 INVALID_FILE_SIGNATURE", async () => {
    const fakeTextFile = Buffer.from("NOT_A_VALID_PDF_HEADER_JUST_PLAIN_TEXT");

    const res = await request(app)
      .post("/api/v1/documents/upload")
      .set("Authorization", `Bearer ${engineerToken}`)
      .field("title", "Corrupt Manual")
      .attach("file", fakeTextFile, "corrupt_manual.pdf");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("INVALID_FILE_SIGNATURE");
  });

  // ── 3. Equipment Listing returns 503 when Disconnected ─────────────────────────
  it("Requirement 3: Equipment listing returns HTTP 503 when MongoDB is disconnected", async () => {
    const prevConnected = isConnectedToMongo;
    setIsConnectedToMongo(false);

    try {
      const res = await request(app)
        .get("/api/v1/equipment")
        .set("Authorization", `Bearer ${engineerToken}`);

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("SERVICE_UNAVAILABLE");
    } finally {
      setIsConnectedToMongo(prevConnected);
    }
  });

  // ── 4. Equipment Listing returns 500 when Query Fails (not empty success) ─────
  it("Requirement 4: Equipment listing returns HTTP 500 error rather than empty success when DB query fails", async () => {
    const findSpy = vi.spyOn(Equipment, "find").mockReturnValue({
      sort: vi.fn().mockRejectedValue(new Error("Simulated query execution failure")),
    } as any);

    try {
      const res = await request(app)
        .get("/api/v1/equipment")
        .set("Authorization", `Bearer ${engineerToken}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("SERVER_ERROR");
    } finally {
      findSpy.mockRestore();
    }
  });

  // ── 5. Equipment Creation returns 503 when Disconnected ───────────────────────
  it("Requirement 5: Equipment creation returns HTTP 503 when MongoDB is disconnected", async () => {
    const prevConnected = isConnectedToMongo;
    setIsConnectedToMongo(false);

    try {
      const res = await request(app)
        .post("/api/v1/equipment")
        .set("Authorization", `Bearer ${engineerToken}`)
        .send({
          name: "Stage 1 Disconnected Pump",
          type: "Centrifugal Pump",
          model: "P-100",
          manufacturer: "Flowserve",
        });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("SERVICE_UNAVAILABLE");
    } finally {
      setIsConnectedToMongo(prevConnected);
    }
  });

  // ── 6. Equipment Creation: 500 on Write Failure & 201 only on Real Persist ─────
  it("Requirement 6: Equipment creation returns 500 if DB write fails, and 201 only after genuine persistence", async () => {
    // Part A: Simulated write failure
    const createSpy = vi.spyOn(Equipment, "create").mockRejectedValueOnce(new Error("Simulated DB write failure"));

    try {
      const failRes = await request(app)
        .post("/api/v1/equipment")
        .set("Authorization", `Bearer ${engineerToken}`)
        .send({
          name: "Stage 1 Failing Unit",
          type: "Heat Exchanger",
          model: "HX-50",
          manufacturer: "Alfa Laval",
        });

      expect(failRes.status).toBe(500);
      expect(failRes.body.success).toBe(false);
      expect(failRes.body.error.code).toBe("DATABASE_WRITE_FAILED");
    } finally {
      createSpy.mockRestore();
    }

    // Part B: Real persistent creation
    const successRes = await request(app)
      .post("/api/v1/equipment")
      .set("Authorization", `Bearer ${engineerToken}`)
      .send({
        name: "Stage 1 Verified Centrifugal Pump",
        type: "Slurry Pump",
        model: "SP-99",
        manufacturer: "Warman",
        location: "Cell 4",
      });

    expect(successRes.status).toBe(201);
    expect(successRes.body.success).toBe(true);
    const createdId = successRes.body.data.id;
    expect(createdId).toBeDefined();
    // Verify it is a valid 24-character hex Mongo ObjectId, not a fake eq-${Date.now()}
    expect(mongoose.Types.ObjectId.isValid(createdId)).toBe(true);
    expect(createdId.startsWith("eq-")).toBe(false);

    // Verify record genuinely exists in MongoDB
    const persisted = await Equipment.findById(createdId);
    expect(persisted).not.toBeNull();
    expect(persisted?.name).toBe("Stage 1 Verified Centrifugal Pump");

    // Clean up
    await Equipment.findByIdAndDelete(createdId);
  });

  // ── 7. Equipment Deletion Fail-Closed Verification ───────────────────────────
  it("Requirement 7: Equipment deletion returns 503 on disconnection, 404 for missing records, and 500 on error", async () => {
    const randomValidId = new mongoose.Types.ObjectId().toString();

    // Part A: Disconnected -> 503
    const prevConnected = isConnectedToMongo;
    setIsConnectedToMongo(false);
    try {
      const disconnRes = await request(app)
        .delete(`/api/v1/equipment/${randomValidId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(disconnRes.status).toBe(503);
      expect(disconnRes.body.error.code).toBe("SERVICE_UNAVAILABLE");
    } finally {
      setIsConnectedToMongo(prevConnected);
    }

    // Part B: Missing record -> 404
    const notFoundRes = await request(app)
      .delete(`/api/v1/equipment/${randomValidId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(notFoundRes.status).toBe(404);
    expect(notFoundRes.body.error.code).toBe("NOT_FOUND");

    // Part C: Simulated deletion error -> 500
    const deleteSpy = vi.spyOn(Equipment, "findByIdAndDelete").mockRejectedValueOnce(new Error("Simulated delete crash"));
    try {
      const errRes = await request(app)
        .delete(`/api/v1/equipment/${randomValidId}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect(errRes.status).toBe(500);
      expect(errRes.body.error.code).toBe("SERVER_ERROR");
    } finally {
      deleteSpy.mockRestore();
    }
  });

  // ── 8. Feedback returns 503 when Disconnected & 500 on Create Failure ─────────
  it("Requirement 8: Feedback returns 503 when disconnected and 500 when Feedback.create fails", async () => {
    const fakeMsgId = new mongoose.Types.ObjectId().toString();

    // Part A: Disconnected -> 503
    const prevConnected = isConnectedToMongo;
    setIsConnectedToMongo(false);
    try {
      const disconnRes = await request(app)
        .post("/api/v1/feedback")
        .set("Authorization", `Bearer ${engineerToken}`)
        .send({
          messageId: fakeMsgId,
          rating: "up",
          comment: "Stage 1 Disconnected Feedback",
        });

      expect(disconnRes.status).toBe(503);
      expect(disconnRes.body.error.code).toBe("SERVICE_UNAVAILABLE");
    } finally {
      setIsConnectedToMongo(prevConnected);
    }

    // Part B: Simulated write failure -> 500
    const createSpy = vi.spyOn(Feedback, "create").mockRejectedValueOnce(new Error("Simulated feedback write error"));
    try {
      const failRes = await request(app)
        .post("/api/v1/feedback")
        .set("Authorization", `Bearer ${engineerToken}`)
        .send({
          messageId: fakeMsgId,
          rating: "down",
          comment: "Stage 1 Write Failure Feedback",
        });

      expect(failRes.status).toBe(500);
      expect(failRes.body.success).toBe(false);
      expect(failRes.body.error.code).toBe("DATABASE_WRITE_FAILED");
    } finally {
      createSpy.mockRestore();
    }
  });

  // ── 9. Feedback returns 201 only after Real Persistence and Uses Auth User ID ──
  it("Requirement 9: Feedback returns 201 only after persistence and uses verified authenticated user ID", async () => {
    const fakeMsgId = new mongoose.Types.ObjectId().toString();

    const res = await request(app)
      .post("/api/v1/feedback")
      .set("Authorization", `Bearer ${engineerToken}`)
      .send({
        messageId: fakeMsgId,
        rating: "up",
        comment: "Stage 1 Verified Authenticated Feedback",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const feedbackId = res.body.data.id;
    expect(feedbackId).toBeDefined();

    // Verify genuinely persisted in MongoDB
    const persisted = await Feedback.findById(feedbackId);
    expect(persisted).not.toBeNull();
    expect(persisted?.rating).toBe("up");
    expect(persisted?.comment).toBe("Stage 1 Verified Authenticated Feedback");

    // Verify userId strictly matches authenticated user's ID and is NEVER "usr-demo-01"
    const expectedUserOid = toMongoObjectId(engineerId);
    expect(persisted?.userId.toString()).toBe(expectedUserOid.toString());
    expect(persisted?.userId.toString()).not.toBe("usr-demo-01");

    // Clean up
    await Feedback.findByIdAndDelete(feedbackId);
  });
});
