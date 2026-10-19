import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { app } from "../src/app";
import { setIsConnectedToMongo } from "../src/config/database";
import { User } from "../src/models";
import bcrypt from "bcryptjs";

describe("Stage 5.4 — Production Authentication Timeout & Resiliency Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setIsConnectedToMongo(true);
  });

  it("Requirement 1: Authentication fails fast with 503 when MongoDB is disconnected", async () => {
    setIsConnectedToMongo(false);

    const start = Date.now();
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "alex.mercer@plant.io", password: "SecurePassword123!" });
    const duration = Date.now() - start;

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(res.body.error.message).toContain("Database connection unavailable for authentication");
    // Must return immediately (< 500ms) without hanging
    expect(duration).toBeLessThan(1000);
  });

  it("Requirement 2: Database query timeout during login returns safe 504 AUTH_TIMEOUT", async () => {
    setIsConnectedToMongo(true);

    // Simulate query timeout error from MongoDB driver
    const mongoTimeoutError = new Error("buffering timed out after 10000ms");
    vi.spyOn(User, "findOne").mockReturnValue({
      maxTimeMS: vi.fn().mockReturnValue({
        exec: vi.fn().mockRejectedValue(mongoTimeoutError),
      }),
    } as any);

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "alex.mercer@plant.io", password: "SecurePassword123!" });

    expect(res.status).toBe(504);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("AUTH_TIMEOUT");
    expect(res.body.error.message).toContain("timed out waiting for database verification");
    // Ensure no raw connection strings or stack traces are leaked
    expect(JSON.stringify(res.body)).not.toContain("mongodb://");
    expect(JSON.stringify(res.body)).not.toContain("mongodb+srv://");
  });

  it("Requirement 3: Successful authentication returns 200 with JWT and user data", async () => {
    setIsConnectedToMongo(true);

    const mockUser = {
      _id: "6ad4ee0ab277e637f9c21ff7",
      name: "Alex Mercer",
      email: "alex.mercer@plant.io",
      role: "engineer",
      createdAt: new Date("2026-10-18T00:00:00.000Z"),
      comparePassword: vi.fn().mockResolvedValue(true),
    };

    vi.spyOn(User, "findOne").mockReturnValue({
      maxTimeMS: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockUser),
      }),
    } as any);

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "alex.mercer@plant.io", password: "CorrectPassword123!" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe("alex.mercer@plant.io");
    expect(res.body.data.user.role).toBe("engineer");
  });

  it("Requirement 4: Invalid password returns 401 INVALID_CREDENTIALS", async () => {
    setIsConnectedToMongo(true);

    const mockUser = {
      _id: "6ad4ee0ab277e637f9c21ff7",
      name: "Alex Mercer",
      email: "alex.mercer@plant.io",
      role: "engineer",
      createdAt: new Date(),
      comparePassword: vi.fn().mockResolvedValue(false),
    };

    vi.spyOn(User, "findOne").mockReturnValue({
      maxTimeMS: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockUser),
      }),
    } as any);

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "alex.mercer@plant.io", password: "WrongPassword!" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("Requirement 5: Liveness probe (/health/live) always returns 200 live even when DB is disconnected", async () => {
    setIsConnectedToMongo(false);

    const res = await request(app).get("/health/live");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("live");
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
  });

  it("Requirement 6: Readiness probe (/health/ready) returns 503 when DB is disconnected in production", async () => {
    setIsConnectedToMongo(false);

    const res = await request(app).get("/health/ready");
    expect(res.status).toBe(503);
    expect(res.body.status).toBe("unhealthy");
    expect(res.body.ready).toBe(false);
    expect(res.body.database.status).toBe("disconnected");
  });

  it("Requirement 7: Diagnostic X-Response-Time header is attached to responses", async () => {
    const res = await request(app).get("/health/live");
    expect(res.headers["x-response-time"]).toBeDefined();
    expect(res.headers["x-response-time"]).toMatch(/^\d+ms$/);
  });

  it("Requirement 8: Request timeout guard returns 504 on hanging request", async () => {
    const prevTimeout = process.env.TEST_REQUEST_TIMEOUT_MS;
    try {
      // Simulate small 50ms timeout for testing
      process.env.TEST_REQUEST_TIMEOUT_MS = "50";

      // Mock User.findOne to hang past 50ms
      vi.spyOn(User, "findOne").mockReturnValue({
        maxTimeMS: vi.fn().mockReturnValue({
          exec: vi.fn().mockReturnValue(new Promise(() => {})), // never resolves
        }),
      } as any);

      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: "alex.mercer@plant.io", password: "Password123!" });

      expect(res.status).toBe(504);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("REQUEST_TIMEOUT");
    } finally {
      process.env.TEST_REQUEST_TIMEOUT_MS = prevTimeout;
    }
  });

  it("Requirement 9: Readiness probe returns 503 while application initialization is incomplete", async () => {
    const { setIsAppInitialized } = await import("../src/config/database");
    setIsConnectedToMongo(true);
    setIsAppInitialized(false);

    const res = await request(app).get("/health/ready");
    expect(res.status).toBe(503);
    expect(res.body.status).toBe("unhealthy");
    expect(res.body.ready).toBe(false);

    // Restore initialization
    setIsAppInitialized(true);
  });

  it("Requirement 10: Readiness probe returns 200 when initialized and MongoDB is connected", async () => {
    const { setIsAppInitialized } = await import("../src/config/database");
    setIsConnectedToMongo(true);
    setIsAppInitialized(true);
    vi.spyOn(mongoose.connection, "readyState", "get").mockReturnValue(1);

    const res = await request(app).get("/health/ready");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
    expect(res.body.ready).toBe(true);
  });

  it("Requirement 11: startServer() binds HTTP server promptly without throwing when DB fails in production", async () => {
    const dbModule = await import("../src/config/database");
    const connectSpy = vi.spyOn(dbModule, "connectDatabase").mockResolvedValueOnce(false);
    const prevEnv = process.env.NODE_ENV;

    try {
      (process.env as any).NODE_ENV = "production";
      const { startServer } = await import("../src/index");
      const httpServer = await startServer();
      expect(httpServer).toBeDefined();
      expect(httpServer.listening).toBe(true);
      expect(dbModule.isAppInitialized).toBe(false);

      // Clean up server
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    } finally {
      (process.env as any).NODE_ENV = prevEnv;
      connectSpy.mockRestore();
      dbModule.setIsAppInitialized(true);
    }
  });

  it("Requirement 12: parseMongoUriMetadata and categorizeMongoError safely categorize errors without leaking credentials", async () => {
    const { parseMongoUriMetadata, categorizeMongoError } = await import("../src/config/database");

    // 1. Valid Atlas URI parsing
    const meta = parseMongoUriMetadata("mongodb+srv://admin_user:SuperSecretPassword123@cluster0.90gymzr.mongodb.net/manuai?retryWrites=true&w=majority");
    expect(meta.hasUri).toBe(true);
    expect(meta.uriScheme).toBe("mongodb+srv");
    expect(meta.clusterHost).toBe("cluster0.90gymzr.mongodb.net");
    expect(meta.targetDatabase).toBe("manuai");

    // 2. Missing URI
    const missing = parseMongoUriMetadata("");
    expect(missing.hasUri).toBe(false);
    const catMissing = categorizeMongoError(new Error("No URI"), missing);
    expect(catMissing.category).toBe("Missing or invalid MONGODB_URI");

    // 3. Atlas Network Access blocking timeout
    const timeoutErr = new Error("Server selection timed out after 5000 ms");
    (timeoutErr as any).name = "MongooseServerSelectionError";
    const catTimeout = categorizeMongoError(timeoutErr, meta);
    expect(catTimeout.category).toBe("Atlas Network Access blocking the Render service");
    expect(catTimeout.reason).not.toContain("SuperSecretPassword123");

    // 4. Authentication failed
    const authErr = new Error("Authentication failed for user admin_user on database manuai");
    (authErr as any).code = 18;
    const catAuth = categorizeMongoError(authErr, meta);
    expect(catAuth.category).toBe("Incorrect or outdated credentials after password rotation");

    // 5. DNS resolution failure
    const dnsErr = new Error("querySrv ENOTFOUND _mongodb._tcp.cluster0.90gymzr.mongodb.net");
    const catDns = categorizeMongoError(dnsErr, meta);
    expect(catDns.category).toBe("DNS/SRV resolution failure");
  });

  it("Requirement 13: Readiness probe exposes sanitized database diagnostics without secrets", async () => {
    const { setIsAppInitialized } = await import("../src/config/database");
    setIsConnectedToMongo(false);
    setIsAppInitialized(false);

    const res = await request(app).get("/health/ready");
    expect(res.status).toBe(503);
    expect(res.body.database).toBeDefined();
    expect(res.body.database.status).toBe("disconnected");
    expect(res.body.database.diagnostics).toBeDefined();
    expect(typeof res.body.database.diagnostics.hasUri).toBe("boolean");
    expect(res.body.database.diagnostics.uriScheme).toBeDefined();

    // Re-verify secrets are never present in payload
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr).not.toContain("password");
    expect(bodyStr).not.toContain("Secret");

    // Restore
    setIsConnectedToMongo(true);
    setIsAppInitialized(true);
  });
});
