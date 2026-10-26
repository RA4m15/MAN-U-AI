import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import http from "http";
import { io as Client, Socket } from "socket.io-client";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import { env, parseEnvironment, resolveJwtSecret, resolveRefreshSecret, KNOWN_PREDICTABLE_SECRETS } from "../src/config/env";
import { connectDatabase, isConnectedToMongo, setIsConnectedToMongo } from "../src/config/database";
import { User, DocumentModel, DocumentPermission, SummaryModel, AuditEvent } from "../src/models";
import { toMongoObjectId } from "../src/routes/documents.routes";
import { io as serverSocket, syncUserSocketState } from "../src/index";
import { PDF_PROCESSING_LIMITS, pdfService } from "../src/services/pdf.service";
import { VISUAL_PROCESSING_LIMITS, visualService } from "../src/services/visual.service";

describe("MAN-U-AI Task 19.9.20 — Security Audit Findings Remediation & Regression Tests", () => {
  let httpServer: http.Server;
  let serverPort: number;

  const adminOid = toMongoObjectId("usr-sec-admin");
  const engineerOid = toMongoObjectId("usr-sec-engineer");
  const viewerOid = toMongoObjectId("usr-sec-viewer");
  const inactiveOid = toMongoObjectId("usr-sec-inactive");
  const demotedOid = toMongoObjectId("usr-sec-demoted");
  const testDocOid = toMongoObjectId("doc-sec-test-doc");

  let adminToken: string;
  let engineerToken: string;
  let viewerToken: string;
  let inactiveToken: string;
  let demotedTokenWithOldAdminClaim: string;

  beforeAll(async () => {
    await connectDatabase();

    // Seed test users
    await User.findByIdAndUpdate(
      adminOid,
      { name: "Security Admin", email: "sec.admin@plant.io", passwordHash: "dummy", role: "admin", isActive: true },
      { upsert: true }
    );
    await User.findByIdAndUpdate(
      engineerOid,
      { name: "Security Engineer", email: "sec.engineer@plant.io", passwordHash: "dummy", role: "engineer", isActive: true },
      { upsert: true }
    );
    await User.findByIdAndUpdate(
      viewerOid,
      { name: "Security Viewer", email: "sec.viewer@plant.io", passwordHash: "dummy", role: "viewer", isActive: true },
      { upsert: true }
    );
    await User.findByIdAndUpdate(
      inactiveOid,
      { name: "Inactive User", email: "sec.inactive@plant.io", passwordHash: "dummy", role: "engineer", isActive: false },
      { upsert: true }
    );
    // User in DB is viewer, but old token will claim admin
    await User.findByIdAndUpdate(
      demotedOid,
      { name: "Demoted User", email: "sec.demoted@plant.io", passwordHash: "dummy", role: "viewer", isActive: true },
      { upsert: true }
    );

    // Seed test document
    await DocumentModel.findByIdAndUpdate(
      testDocOid,
      {
        title: "Security Test Manual",
        revision: "Rev 2.0",
        filename: "sec_test.pdf",
        storagePath: "uploads/sec_test.pdf",
        mimeType: "application/pdf",
        status: "indexed",
        uploadedById: engineerOid,
      },
      { upsert: true }
    );

    adminToken = jwt.sign({ id: adminOid.toString(), email: "sec.admin@plant.io", role: "admin" }, env.JWT_SECRET, { expiresIn: "1h" });
    engineerToken = jwt.sign({ id: engineerOid.toString(), email: "sec.engineer@plant.io", role: "engineer" }, env.JWT_SECRET, { expiresIn: "1h" });
    viewerToken = jwt.sign({ id: viewerOid.toString(), email: "sec.viewer@plant.io", role: "viewer" }, env.JWT_SECRET, { expiresIn: "1h" });
    inactiveToken = jwt.sign({ id: inactiveOid.toString(), email: "sec.inactive@plant.io", role: "engineer" }, env.JWT_SECRET, { expiresIn: "1h" });
    // Stale token claiming admin for a demoted user
    demotedTokenWithOldAdminClaim = jwt.sign({ id: demotedOid.toString(), email: "sec.demoted@plant.io", role: "admin" }, env.JWT_SECRET, { expiresIn: "1h" });

    // Start dedicated HTTP server for socket tests
    httpServer = http.createServer(app);
    serverSocket.attach(httpServer);
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        serverPort = typeof addr === "object" && addr ? addr.port : 4101;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await User.deleteMany({ _id: { $in: [adminOid, engineerOid, viewerOid, inactiveOid, demotedOid] } });
    await DocumentModel.deleteOne({ _id: testDocOid });
    await DocumentPermission.deleteMany({ documentId: testDocOid });
    setIsConnectedToMongo(true);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Phase 2: WebSocket Authorization Tests
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Phase 2 — WebSocket Authorization Hardening", () => {
    it("rejects socket connection for deleted user not present in MongoDB", async () => {
      const deletedUserToken = jwt.sign(
        { id: toMongoObjectId("usr-nonexistent-99").toString(), email: "ghost@plant.io", role: "engineer" },
        env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      const socket: Socket = Client(`http://localhost:${serverPort}`, {
        auth: { token: deletedUserToken },
        transports: ["websocket"],
        reconnection: false,
      });

      await new Promise<void>((resolve) => {
        socket.on("connect_error", (err) => {
          expect(err.message).toMatch(/inactive or no longer exists/i);
          socket.disconnect();
          resolve();
        });
      });
    });

    it("rejects socket connection for inactive user (isActive: false)", async () => {
      const socket: Socket = Client(`http://localhost:${serverPort}`, {
        auth: { token: inactiveToken },
        transports: ["websocket"],
        reconnection: false,
      });

      await new Promise<void>((resolve) => {
        socket.on("connect_error", (err) => {
          expect(err.message).toMatch(/inactive or no longer exists/i);
          socket.disconnect();
          resolve();
        });
      });
    });

    it("does not grant admin membership in role:admin solely because an old JWT claims admin", async () => {
      // demotedTokenWithOldAdminClaim has role: 'admin' in JWT, but MongoDB record has role: 'viewer'
      const socket: Socket = Client(`http://localhost:${serverPort}`, {
        auth: { token: demotedTokenWithOldAdminClaim },
        transports: ["websocket"],
        reconnection: false,
      });

      let receivedAudit = false;
      await new Promise<void>((resolve) => {
        socket.on("connect", () => {
          socket.on("audit:new", () => {
            receivedAudit = true;
          });

          // Emit to role:admin room only
          serverSocket.to("role:admin").emit("audit:new", { test: true });

          setTimeout(() => {
            expect(receivedAudit).toBe(false);
            socket.disconnect();
            resolve();
          }, 150);
        });
      });
    });

    it("revokes privileged admin room access when user is demoted via syncUserSocketState", async () => {
      const socket: Socket = Client(`http://localhost:${serverPort}`, {
        auth: { token: adminToken },
        transports: ["websocket"],
        reconnection: false,
      });

      await new Promise<void>((resolve) => {
        socket.on("connect", async () => {
          let roleUpdatedEventFired = false;
          socket.on("auth:updated", (data: any) => {
            if (data.role === "viewer") {
              roleUpdatedEventFired = true;
            }
          });

          // Demote the user
          await syncUserSocketState(adminOid.toString(), "viewer");

          setTimeout(() => {
            expect(roleUpdatedEventFired).toBe(true);

            let auditReceivedAfterDemotion = false;
            socket.on("audit:new", () => {
              auditReceivedAfterDemotion = true;
            });

            serverSocket.to("role:admin").emit("audit:new", { event: "admin-broadcast" });

            setTimeout(async () => {
              expect(auditReceivedAfterDemotion).toBe(false);
              // Restore admin role for subsequent tests
              await syncUserSocketState(adminOid.toString(), "admin");
              socket.disconnect();
              resolve();
            }, 100);
          }, 100);
        });
      });
    });

    it("disconnects socket and emits auth:revoked when user is deleted via syncUserSocketState", async () => {
      const tempUserOid = toMongoObjectId("usr-temp-to-delete");
      await User.findByIdAndUpdate(
        tempUserOid,
        { name: "Temp User", email: "temp@plant.io", passwordHash: "dummy", role: "engineer", isActive: true },
        { upsert: true }
      );
      const tempToken = jwt.sign({ id: tempUserOid.toString(), email: "temp@plant.io", role: "engineer" }, env.JWT_SECRET, { expiresIn: "1h" });

      const socket: Socket = Client(`http://localhost:${serverPort}`, {
        auth: { token: tempToken },
        transports: ["websocket"],
        reconnection: false,
      });

      await new Promise<void>((resolve) => {
        socket.on("connect", async () => {
          let revokedReceived = false;
          socket.on("auth:revoked", (data: any) => {
            revokedReceived = true;
          });
          socket.on("disconnect", () => {
            expect(revokedReceived).toBe(true);
            resolve();
          });

          // Trigger deletion/revocation
          await syncUserSocketState(tempUserOid.toString(), null);
        });
      });

      await User.deleteOne({ _id: tempUserOid });
    });

    it("fails closed when authorization storage is unavailable (disconnected database)", async () => {
      const socket: Socket = Client(`http://localhost:${serverPort}`, {
        auth: { token: adminToken },
        transports: ["websocket"],
        reconnection: false,
      });

      await new Promise<void>((resolve) => {
        socket.on("connect", () => {
          // Simulate database connection drop
          setIsConnectedToMongo(false);

          socket.emit("subscribe:document", testDocOid.toString());
          socket.on("subscription:error", (err: any) => {
            expect(err.code).toBe("FORBIDDEN");
            expect(err.message).toMatch(/not authorized/i);
            // Restore database status
            setIsConnectedToMongo(true);
            socket.disconnect();
            resolve();
          });
        });
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Phase 3: Analytics, Summaries, and Audit RBAC & Input Validation
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Phase 3 — Analytics & Audit Route RBAC and Schema Validation", () => {
    it("rejects viewers from accessing GET /api/v1/summaries with 403 Forbidden", async () => {
      const res = await request(app)
        .get("/api/v1/summaries")
        .set("Authorization", `Bearer ${viewerToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("allows engineers and admins to access GET /api/v1/summaries", async () => {
      const resEng = await request(app)
        .get("/api/v1/summaries")
        .set("Authorization", `Bearer ${engineerToken}`);
      expect(resEng.status).toBe(200);
      expect(resEng.body.success).toBe(true);

      const resAdmin = await request(app)
        .get("/api/v1/summaries")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(resAdmin.status).toBe(200);
      expect(resAdmin.body.success).toBe(true);
    });

    it("rejects viewers from POST /api/v1/summaries/generate with 403 Forbidden", async () => {
      const res = await request(app)
        .post("/api/v1/summaries/generate")
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({ summaryType: "shift_handoff" });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("validates summaryType enum and focusArea bounds on POST /api/v1/summaries/generate", async () => {
      const invalidTypeRes = await request(app)
        .post("/api/v1/summaries/generate")
        .set("Authorization", `Bearer ${engineerToken}`)
        .send({ summaryType: "malicious_unsupported_type" });
      expect(invalidTypeRes.status).toBe(400);
      expect(invalidTypeRes.body.error.code).toBe("VALIDATION_ERROR");

      const longFocusRes = await request(app)
        .post("/api/v1/summaries/generate")
        .set("Authorization", `Bearer ${engineerToken}`)
        .send({ summaryType: "shift_handoff", focusArea: "a".repeat(150) });
      expect(longFocusRes.status).toBe(400);
      expect(longFocusRes.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects viewers from GET /api/v1/audit with 403 Forbidden", async () => {
      const resViewer = await request(app)
        .get("/api/v1/audit")
        .set("Authorization", `Bearer ${viewerToken}`);
      expect(resViewer.status).toBe(403);
      expect(resViewer.body.error.code).toBe("FORBIDDEN");

      const resEng = await request(app)
        .get("/api/v1/audit")
        .set("Authorization", `Bearer ${engineerToken}`);
      expect(resEng.status).toBe(200);
      expect(resEng.body.success).toBe(true);
    });

    it("allows administrators to access GET /api/v1/audit and sanitizes action query filter", async () => {
      const resAdmin = await request(app)
        .get("/api/v1/audit")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(resAdmin.status).toBe(200);
      expect(resAdmin.body.success).toBe(true);
      expect(Array.isArray(resAdmin.body.data)).toBe(true);

      // Rejects query injection / invalid characters in action query
      const badQueryRes = await request(app)
        .get("/api/v1/audit?action=%7B%24gt%3A%22%22%7D")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(badQueryRes.status).toBe(400);
      expect(badQueryRes.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Phase 4: Environment & Safe Secret Handling Tests
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Phase 4 — Environment & Secret Handling", () => {
    it("fails production validation when JWT_SECRET or REFRESH_TOKEN_SECRET use known predictable defaults", () => {
      expect(() => {
        parseEnvironment({
          NODE_ENV: "production",
          JWT_SECRET: "manuai-industrial-secure-jwt-secret-key-2025",
          REFRESH_TOKEN_SECRET: "strong-custom-production-refresh-token-secret-minimum-32chars",
          MONGODB_URI: "mongodb+srv://user:pass@cluster0.mongodb.net/manuai",
          VECTOR_STORE: "mongodb",
          CORS_ORIGIN: "https://manuai.production.app",
        });
      }).toThrow(/Production environment requires a strong, non-default JWT_SECRET/i);

      expect(() => {
        parseEnvironment({
          NODE_ENV: "production",
          JWT_SECRET: "strong-custom-production-jwt-token-secret-minimum-32chars",
          REFRESH_TOKEN_SECRET: "manuai-refresh-secret-key-2025",
          MONGODB_URI: "mongodb+srv://user:pass@cluster0.mongodb.net/manuai",
          VECTOR_STORE: "mongodb",
          CORS_ORIGIN: "https://manuai.production.app",
        });
      }).toThrow(/Production environment requires a strong, non-default REFRESH_TOKEN_SECRET/i);
    });

    it("fails production validation when secret is shorter than 32 characters", () => {
      expect(() => {
        parseEnvironment({
          NODE_ENV: "production",
          JWT_SECRET: "short-secret-123",
          REFRESH_TOKEN_SECRET: "strong-custom-production-refresh-token-secret-minimum-32chars",
          MONGODB_URI: "mongodb+srv://user:pass@cluster0.mongodb.net/manuai",
          VECTOR_STORE: "mongodb",
          CORS_ORIGIN: "https://manuai.production.app",
        });
      }).toThrow(/minimum 32 characters/i);
    });

    it("generates process-ephemeral 64-char hex secret in development when unset", () => {
      const devJwt = resolveJwtSecret("", "development");
      expect(devJwt).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(devJwt)).toBe(true);

      const devRefresh = resolveRefreshSecret("", "development");
      expect(devRefresh).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(devRefresh)).toBe(true);
    });

    it("returns deterministic isolated test secrets in test environment", () => {
      const testJwt = resolveJwtSecret("", "test");
      expect(testJwt).toBe("test-isolated-deterministic-jwt-secret-min32chars");

      const testRefresh = resolveRefreshSecret("", "test");
      expect(testRefresh).toBe("test-isolated-deterministic-refresh-secret-min32chars");
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Phase 5: Public Health Diagnostics & Figure Metadata Minimization
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Phase 5 — Minimizing Public Diagnostics and Figure Metadata", () => {
    it("public GET /api/v1/health, /health/ready, and /api/v1/health/ready do not leak database diagnostics, multimodalEngine, or dependencies", async () => {
      for (const endpoint of ["/health", "/health/ready", "/api/v1/health", "/api/v1/health/ready"]) {
        const res = await request(app).get(endpoint);
        expect(res.status).toBe(200);

        // Verify only minimal operational information is exposed
        expect(res.body.status).toBe("healthy");
        expect(res.body.ready).toBe(true);
        expect(res.body.service).toBe("MAN-U-AI API Server");
        expect(res.body.version).toBe("1.0.0");
        expect(res.body.timestamp).toBeDefined();

        // Strictly verify internal diagnostics, engines, dependencies, and environment are omitted
        expect(res.body.database).toBeUndefined();
        expect(res.body.multimodalEngine).toBeUndefined();
        expect(res.body.dependencies).toBeUndefined();
        expect(res.body.environment).toBeUndefined();
        expect(res.body.clusterHost).toBeUndefined();
        expect(res.body.targetDatabase).toBeUndefined();
        expect(res.body.errorReason).toBeUndefined();
      }
    });

    it("public GET /health/ready and /api/v1/health/ready fail with 503 when degraded without exposing internal diagnostics", async () => {
      const { setIsAppInitialized, setIsConnectedToMongo } = await import("../src/config/database");
      setIsConnectedToMongo(false);
      setIsAppInitialized(false);

      try {
        for (const endpoint of ["/health/ready", "/api/v1/health/ready"]) {
          const res = await request(app).get(endpoint);
          expect(res.status).toBe(503);
          expect(res.body.status).toBe("unhealthy");
          expect(res.body.ready).toBe(false);
          expect(res.body.error).toBe("Required dependencies are unavailable");

          // Verify absence of internal diagnostics on failure response
          expect(res.body.database).toBeUndefined();
          expect(res.body.multimodalEngine).toBeUndefined();
          expect(res.body.dependencies).toBeUndefined();
        }
      } finally {
        setIsConnectedToMongo(true);
        setIsAppInitialized(true);
      }
    });

    it("protected GET /api/v1/health/diagnostics requires admin authentication and returns full diagnostics", async () => {
      const unauthRes = await request(app).get("/api/v1/health/diagnostics");
      expect(unauthRes.status).toBe(401);

      const viewerRes = await request(app)
        .get("/api/v1/health/diagnostics")
        .set("Authorization", `Bearer ${viewerToken}`);
      expect(viewerRes.status).toBe(403);

      const adminRes = await request(app)
        .get("/api/v1/health/diagnostics")
        .set("Authorization", `Bearer ${adminToken}`);
      expect(adminRes.status).toBe(200);
      expect(adminRes.body.database?.diagnostics).toBeDefined();
      expect(adminRes.body.dependencies).toBeDefined();
      expect(adminRes.body.multimodalEngine).toBeDefined();
    });

    it("GET /api/v1/documents/:id/figures does not expose storagePath, storageProvider, or processingError", async () => {
      const res = await request(app)
        .get(`/api/v1/documents/${testDocOid}/figures`)
        .set("Authorization", `Bearer ${engineerToken}`);
      expect(res.status).toBe(200);

      // Any returned figure item must not include internal storage path or internals
      for (const fig of res.body.data) {
        expect(fig.storagePath).toBeUndefined();
        expect(fig.storageProvider).toBeUndefined();
        expect(fig.processingError).toBeUndefined();
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // Phase 6: PDF Resource Usage & Decompression Limits
  // ─────────────────────────────────────────────────────────────────────────────
  describe("Phase 6 — PDF and Visual Extraction Resource Bounds", () => {
    it("rejects PDFs exceeding defensible page count limit", async () => {
      const mockPdfBuffer = Buffer.from(
        "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
        "2 0 obj\n<< /Type /Pages /Kids [] /Count 250 >>\nendobj\n" +
        "trailer\n<< /Root 1 0 R >>\n%%EOF"
      );

      await expect(pdfService.extractSafe(mockPdfBuffer, "Giant Doc")).resolves.toMatchObject({
        outcome: "extraction_failed",
      });
    });

    it("enforces MAX_IMAGE_DIMENSION and MAX_DECOMPRESSED_IMAGE_BYTES constants", () => {
      expect(VISUAL_PROCESSING_LIMITS.MAX_IMAGE_DIMENSION).toBe(8192);
      expect(VISUAL_PROCESSING_LIMITS.MAX_DECOMPRESSED_IMAGE_BYTES).toBe(25 * 1024 * 1024);
      expect(PDF_PROCESSING_LIMITS.MAX_PAGE_COUNT).toBe(200);
      expect(PDF_PROCESSING_LIMITS.EXTRACTION_TIMEOUT_MS).toBe(45000);
    });

    it("safely handles malformed PDF signature without throwing uncaught exceptions", async () => {
      const invalidBuffer = Buffer.from("NOT_A_REAL_PDF_HEADER_1234567890");
      const result = await pdfService.extractSafe(invalidBuffer, "Bad PDF");
      expect(result.outcome).toBe("extraction_failed");
      expect(result.error).toMatch(/Invalid PDF signature/i);
    });
  });
});
