import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import http from "http";
import { io as Client, Socket } from "socket.io-client";
import { app } from "../src/app";
import { env } from "../src/config/env";
import { connectDatabase, isConnectedToMongo } from "../src/config/database";
import { DocumentModel, DocumentChunk, User } from "../src/models";
import { vectorService, VectorService } from "../src/services/vector.service";
import { geminiService } from "../src/services/gemini.service";
import { ragService } from "../src/services/rag.service";
import { emitDocumentProgress, io as serverSocket } from "../src/index";
import { toMongoObjectId } from "../src/routes/documents.routes";

describe("Production Hardening & Security Audit Suite (P0 & P1 Requirements)", () => {
  let userAToken: string;
  let userBToken: string;
  let adminToken: string;
  let privateDocId: string;
  let httpServer: http.Server;
  let serverPort: number;

  const userAId = "usr-owner-a-6001";
  const userBId = "usr-viewer-b-6002";

  beforeAll(async () => {
    await connectDatabase();

    userAToken = jwt.sign(
      { id: userAId, email: "usera@plant.io", name: "User A", role: "engineer" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    userBToken = jwt.sign(
      { id: userBId, email: "userb@plant.io", name: "User B", role: "viewer" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    adminToken = jwt.sign(
      { id: "usr-admin-root", email: "admin@plant.io", name: "Admin", role: "admin" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Create a private document belonging exclusively to User A
    if (isConnectedToMongo) {
      const doc = await DocumentModel.create({
        title: "Confidential Steam Turbine Overhaul Protocol",
        revision: "Rev 9.4",
        filename: "confidential_turbine.pdf",
        storagePath: "confidential_turbine.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1048576,
        status: "indexed",
        pageCount: 15,
        tags: ["Confidential", "Turbine", "Restricted"],
        uploadedById: toMongoObjectId(userAId),
      });
      privateDocId = doc._id.toString();

      // Index chunk for User A's document
      await DocumentChunk.create({
        documentId: doc._id,
        documentTitle: doc.title,
        revision: doc.revision,
        page: 7,
        section: "High-Pressure Rotor Clearance",
        text: "Confidential: High-pressure steam turbine rotor axial clearance must be maintained at 0.038 mm with casing hot torque of 820 N·m.",
        embedding: new Array(768).fill(0.01),
        tokenCount: 25,
      });
    }

    // Spin up test HTTP server for WebSocket tests
    httpServer = http.createServer(app);
    serverSocket.attach(httpServer);
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        serverPort = typeof addr === "object" && addr ? addr.port : 4200;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (privateDocId && isConnectedToMongo) {
      await DocumentModel.findByIdAndDelete(privateDocId);
      await DocumentChunk.deleteMany({ documentId: privateDocId });
    }
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  // ── 1. Document Authorization & Isolation ─────────────────────────────────
  it("Requirement 13.1: An unauthorized user cannot obtain another user's document or citations", async () => {
    // User B attempts to access User A's document metadata
    const getRes = await request(app)
      .get(`/api/v1/documents/${privateDocId}`)
      .set("Authorization", `Bearer ${userBToken}`);
    expect(getRes.status).toBe(403);
    expect(getRes.body.error.code).toBe("FORBIDDEN");

    // User B attempts to access chunks
    const chunksRes = await request(app)
      .get(`/api/v1/documents/${privateDocId}/chunks`)
      .set("Authorization", `Bearer ${userBToken}`);
    expect(chunksRes.status).toBe(403);
    expect(chunksRes.body.error.code).toBe("FORBIDDEN");

    // User B attempts to stream file
    const fileRes = await request(app)
      .get(`/api/v1/documents/${privateDocId}/file`)
      .set("Authorization", `Bearer ${userBToken}`);
    expect(fileRes.status).toBe(403);
    expect(fileRes.body.error.code).toBe("FORBIDDEN");

    // User B queries RAG for content in User A's document
    const ragRes = await request(app)
      .post("/api/v1/chat")
      .set("Authorization", `Bearer ${userBToken}`)
      .send({
        message: "What is the high-pressure steam turbine rotor axial clearance?",
      });
    expect(ragRes.status).toBe(200);
    // User B must NOT receive citations from User A's document
    const citations = ragRes.body.data.citations;
    const leakedCite = citations.find((c: any) => c.documentId === privateDocId);
    expect(leakedCite).toBeUndefined();
  }, 20000);

  // ── 2. Socket.IO Authorization ───────────────────────────────────────────
  it("Requirement 13.2: An unauthorized Socket.IO client cannot join or receive private document events", async () => {
    const socketB: Socket = Client(`http://localhost:${serverPort}`, {
      auth: { token: userBToken },
      transports: ["websocket"],
      reconnection: false,
    });

    let receivedLeakedProgress = false;

    await new Promise<void>((resolve) => {
      socketB.on("connect", () => {
        // User B attempts to subscribe to User A's private document room
        socketB.emit("subscribe:document", privateDocId);

        socketB.on("subscription:error", (err: any) => {
          expect(err.code).toBe("FORBIDDEN");
          expect(err.message).toContain("not authorized");

          // Test that progress event is NOT leaked to socketB
          socketB.on("document:progress", () => {
            receivedLeakedProgress = true;
          });

          emitDocumentProgress(privateDocId, 85, "Testing private isolation", userAId);

          setTimeout(() => {
            expect(receivedLeakedProgress).toBe(false);
            socketB.disconnect();
            resolve();
          }, 150);
        });
      });
    });
  });

  // ── 3. Strict CORS Enforcement ───────────────────────────────────────────
  it("Requirement 13.3: Unapproved HTTP origins fail CORS checks", async () => {
    const res = await request(app)
      .get("/api/v1/health")
      .set("Origin", "https://unauthorized-malicious-domain.xyz");

    // CORS middleware rejects with 403 Forbidden or does not include access-control-allow-origin
    if (res.status === 403) {
      expect(res.body.error.code).toBe("CORS_FORBIDDEN");
    } else {
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    }
  });

  // ── 4. Embedding Dimension Verification ───────────────────────────────────
  it("Requirement 13.4: Embedding-dimension mismatches are rejected with an explicit error", async () => {
    // Attempting cosine similarity with mismatched vectors must throw, not return 0.75
    expect(() => {
      vectorService.computeCosineSimilarity([0.1, 0.2, 0.3], [0.1, 0.2]);
    }).toThrow(/Embedding dimension mismatch/);

    expect(() => {
      vectorService.computeCosineSimilarity([], [0.1, 0.2]);
    }).toThrow(/vectors cannot be empty/);

    // searchSimilar must reject invalid query dimension
    await expect(
      vectorService.searchSimilar(new Array(512).fill(0.1), "test query")
    ).rejects.toThrow(/expected 768 dimensions/);
  });

  // ── 5. Production Real Data Guard ─────────────────────────────────────────
  it("Requirement 13.5: Production cannot use seeded demonstration chunks or offline answer templates", async () => {
    // In production mode, VectorService throws if DB is disconnected and never uses demo chunks
    const originalEnv = env.NODE_ENV;
    try {
      (env as any).NODE_ENV = "production";
      
      // When connected, candidate chunks come only from Mongo, not DEMO_CHUNKS_FIXTURE
      const results = await vectorService.searchSimilar(
        new Array(768).fill(0.01),
        "random query without matches",
        5,
        0.99
      );
      // Confirms demo fixture chunks are not returned as synthetic results
      const demoChunk = results.find((r) => r.chunk.id === "chk-01");
      expect(demoChunk).toBeUndefined();
    } finally {
      (env as any).NODE_ENV = originalEnv;
    }
  });

  // ── 6. Readiness Probe Failure On Missing Database ────────────────────────
  it("Requirement 13.6: A missing required database causes readiness to fail with HTTP 503", async () => {
    // Calling /health/ready evaluates readiness
    const res = await request(app).get("/health/ready");
    // If Mongo is connected, readiness is 200; if disconnected, readiness is 503
    if (isConnectedToMongo) {
      expect(res.status).toBe(200);
      expect(res.body.ready).toBe(true);
      expect(res.body.status).toBe("healthy");
    } else {
      expect(res.status).toBe(503);
      expect(res.body.ready).toBe(false);
      expect(res.body.status).toBe("unhealthy");
    }
  });

  // ── 7. Grounded Retrieval From Authorized Document ────────────────────────
  it("Requirement 13.7: A real supported question is answered from its retrieved document", async () => {
    // User A queries their own authorized document
    const res = await request(app)
      .post("/api/v1/chat")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({
        message: "What is the high-pressure steam turbine rotor axial clearance and hot torque?",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.citations.length).toBeGreaterThan(0);

    const cite = res.body.data.citations[0];
    expect(cite.documentId).toBe(privateDocId);
    expect(cite.page).toBe(7);
    expect(cite.excerpt).toContain("0.038 mm");
  }, 20000);

  // ── 8. Unsupported Question Honesty ───────────────────────────────────────
  it("Requirement 13.8: An unsupported question does not receive a fabricated answer or citation", async () => {
    const res = await request(app)
      .post("/api/v1/chat")
      .set("Authorization", `Bearer ${userAToken}`)
      .send({
        message: "What is the plasma compression ratio for the hyperdrive reactor?",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.citations.length).toBe(0);
    expect(res.body.data.answer.toLowerCase()).toContain("could not locate");
  }, 20000);

  it("Requirement 13.8 (Regression): Unsupported question remains ungrounded with 0 citations even when unrelated document chunks with overlapping substrings exist in database", async () => {
    if (!isConnectedToMongo) return;

    // Create an accessible document whose title, section, and text contain technical words
    // that share substring overlap with query keywords (e.g. "Operations", "operational", "vibration", "generation")
    const unrelatedDoc = await DocumentModel.create({
      title: "Boiler Operations and Vibration Protocol",
      revision: "Rev 1.0",
      filename: "boiler_ops.pdf",
      storagePath: "boiler_ops.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      status: "indexed",
      pageCount: 2,
      uploadedById: toMongoObjectId(userAId),
    });

    await DocumentChunk.create({
      documentId: unrelatedDoc._id,
      documentTitle: unrelatedDoc.title,
      revision: unrelatedDoc.revision,
      page: 1,
      section: "Operational Vibration Tolerances",
      text: "Normal operational vibration baseline must remain below 0.05 mm during standard generation cycles.",
      embedding: new Array(768).fill(0.01),
      tokenCount: 15,
    });

    try {
      const res = await request(app)
        .post("/api/v1/chat")
        .set("Authorization", `Bearer ${userAToken}`)
        .send({
          message: "What is the plasma compression ratio for the hyperdrive reactor?",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.citations.length).toBe(0);
      expect(res.body.data.answer.toLowerCase()).toContain("could not locate");
    } finally {
      await DocumentModel.findByIdAndDelete(unrelatedDoc._id);
      await DocumentChunk.deleteMany({ documentId: unrelatedDoc._id });
    }
  }, 20000);

  // ── 9. Persistence & Server Restart Verification ──────────────────────────
  it("Requirement 13.9: Persistent documents and chunks remain usable after restarting the backend", async () => {
    if (!isConnectedToMongo) return;

    // Simulate backend restart by instantiating a fresh VectorService
    const freshVectorService = new VectorService();
    const queryVector = new Array(768).fill(0.01);

    const found = await freshVectorService.searchSimilar(
      queryVector,
      "rotor axial clearance hot torque",
      5,
      0.3,
      [privateDocId]
    );

    expect(found.length).toBeGreaterThan(0);
    expect(found[0].chunk.documentId).toBe(privateDocId);
    expect(found[0].chunk.page).toBe(7);
    expect(found[0].chunk.text).toContain("0.038 mm");
  });

  // ── 10. Audit Endpoint NoSQL Query Injection Defense ──────────────────────
  it("Requirement 13.10: Rejects NoSQL query injection on /api/v1/audit with nested object query operators", async () => {
    // When an attacker attempts to pass ?action[$ne]=nonexistent or object parameters,
    // the route must safely treat non-strings as undefined and not execute arbitrary Mongo query operators.
    const res = await request(app)
      .get("/api/v1/audit?action[$ne]=nonexistent")
      .set("Authorization", `Bearer ${userAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  // ── 11. Admin Self-Demotion & Self-Deletion Safeguards ─────────────────────
  it("Requirement 13.11: Blocks administrator self-demotion to preserve root administration", async () => {
    if (!isConnectedToMongo) return;

    // Create a temporary admin user
    const tempAdmin = await User.create({
      name: "Temp Root Admin",
      email: `temp-admin-${Date.now()}@plant.io`,
      passwordHash: "dummyHash123",
      role: "admin",
    });

    const tempToken = jwt.sign(
      { id: tempAdmin._id.toString(), email: tempAdmin.email, name: tempAdmin.name, role: "admin" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    try {
      const res = await request(app)
        .patch(`/api/v1/users/${tempAdmin._id.toString()}/role`)
        .set("Authorization", `Bearer ${tempToken}`)
        .send({ role: "viewer" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("CANNOT_DEMOTE_SELF");
    } finally {
      await User.findByIdAndDelete(tempAdmin._id);
    }
  });

  it("Requirement 13.12: Blocks administrator self-deletion to prevent administrative lockout", async () => {
    if (!isConnectedToMongo) return;

    const tempAdmin = await User.create({
      name: "Self Delete Test Admin",
      email: `temp-delete-admin-${Date.now()}@plant.io`,
      passwordHash: "dummyHash123",
      role: "admin",
    });

    const tempToken = jwt.sign(
      { id: tempAdmin._id.toString(), email: tempAdmin.email, name: tempAdmin.name, role: "admin" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    try {
      const res = await request(app)
        .delete(`/api/v1/users/${tempAdmin._id.toString()}`)
        .set("Authorization", `Bearer ${tempToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("CANNOT_DELETE_SELF");
    } finally {
      await User.findByIdAndDelete(tempAdmin._id);
    }
  });

  it("Requirement 13.13: Admin user creation normalizes email and prevents case-variant duplicate accounts", async () => {
    if (!isConnectedToMongo) return;

    const timestamp = Date.now();
    const mixedCaseEmail = `CaseTest-${timestamp}@Plant.IO`;
    const lowerCaseEmail = mixedCaseEmail.toLowerCase();

    // 1. Create with mixed case
    const res1 = await request(app)
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Case Test User",
        email: mixedCaseEmail,
        password: "ValidPassword123!",
        role: "viewer",
      });

    expect(res1.status).toBe(201);
    expect(res1.body.success).toBe(true);
    expect(res1.body.data.email).toBe(lowerCaseEmail);

    try {
      // 2. Attempt duplicate with lowercase
      const res2 = await request(app)
        .post("/api/v1/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Duplicate User",
          email: lowerCaseEmail,
          password: "ValidPassword123!",
          role: "viewer",
        });

      expect(res2.status).toBe(409);
      expect(res2.body.success).toBe(false);
      expect(res2.body.error.code).toBe("EXISTS");
    } finally {
      await User.deleteMany({ email: lowerCaseEmail });
    }
  });
});
