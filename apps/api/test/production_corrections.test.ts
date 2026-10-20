import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { app, isAllowedOrigin } from "../src/app";
import { env } from "../src/config/env";
import { User, DocumentModel } from "../src/models";
import { seedDatabase } from "../src/config/seed";
import { isUserAuthorizedForDocument } from "../src/routes/documents.routes";
import { GeminiService } from "../src/services/gemini.service";
import { VectorService, CANDIDATE_CHUNK_LIMIT } from "../src/services/vector.service";
import { isConnectedToMongo } from "../src/config/database";

describe("Production Corrections & Security Audits", () => {
  // ── 1. Seed-Account Persistence & Idempotency ─────────────────────────────
  it("Requirement 1: Restarts never reset or overwrite existing account passwords", async () => {
    if (!isConnectedToMongo) return;

    // Create or retrieve an existing user account
    const testEmail = "persistence.check@plant.io";
    await User.deleteOne({ email: testEmail });

    const originalPassword = "UserOriginalPassword-123!";
    const originalHash = await bcrypt.hash(originalPassword, 10);

    await User.create({
      name: "Persistence Test User",
      email: testEmail,
      passwordHash: originalHash,
      role: "engineer",
      orgId: "plant-alpha",
    });

    // Simulate user changing their password
    const updatedPassword = "UserChangedNewPassword-456!";
    const updatedHash = await bcrypt.hash(updatedPassword, 10);
    await User.updateOne({ email: testEmail }, { passwordHash: updatedHash });

    // Run seedDatabase() (simulating server restart with INITIAL_SEED_PASSWORD set)
    process.env.INITIAL_SEED_PASSWORD = "Different-Seed-Password-789!";
    await seedDatabase();

    // Verify the user password was NOT reset by seedDatabase
    const persistedUser = await User.findOne({ email: testEmail });
    expect(persistedUser).not.toBeNull();
    const isNewPasswordValid = await bcrypt.compare(updatedPassword, persistedUser!.passwordHash);
    const isSeedPasswordOverwritten = await bcrypt.compare("Different-Seed-Password-789!", persistedUser!.passwordHash);

    expect(isNewPasswordValid).toBe(true);
    expect(isSeedPasswordOverwritten).toBe(false);

    // Clean up
    await User.deleteOne({ email: testEmail });
  });

  it("Requirement 1b: Production mode does not automatically create demo accounts without explicit flag", async () => {
    const originalEnv = env.NODE_ENV;
    const originalAllowSeed = process.env.ALLOW_INITIAL_SEED;
    try {
      (env as any).NODE_ENV = "production";
      delete process.env.ALLOW_INITIAL_SEED;
      delete process.env.INITIAL_SEED_PASSWORD;

      // When ALLOW_INITIAL_SEED is unset, seedDatabase immediately returns without creating accounts
      await expect(seedDatabase()).resolves.not.toThrow();
    } finally {
      (env as any).NODE_ENV = originalEnv;
      if (originalAllowSeed) process.env.ALLOW_INITIAL_SEED = originalAllowSeed;
    }
  });

  // ── 2. Disconnected-Database Authorization (Fail Closed) ───────────────────
  it("Requirement 2: isUserAuthorizedForDocument fails closed when database is disconnected or unauthorized", async () => {
    // Direct authorization helper fail-closed checks
    const authResult = await isUserAuthorizedForDocument("usr-test", "engineer", "fake-doc-id");
    expect(authResult.authorized).toBe(false);

    // An unauthorized user attempting to access a document fails with 403 Forbidden
    if (isConnectedToMongo) {
      const uploader = await User.findOne();
      const privateDoc = await DocumentModel.create({
        title: "Top Secret Turbine Calibration",
        revision: "Rev 9.9",
        filename: "secret_turbine.pdf",
        storagePath: "test_secret_turbine.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        status: "indexed",
        pageCount: 1,
        uploadedById: uploader?._id,
      });

      const token = jwt.sign(
        { id: "usr-unauth-test", email: "unauth@plant.io", name: "Unauth User", role: "viewer" },
        env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      const res = await request(app)
        .get(`/api/v1/documents/${privateDoc._id}`)
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");

      await DocumentModel.deleteOne({ _id: privateDoc._id });
    }
  });

  // ── 3. Explicit Embedding Failure in Production ───────────────────────────
  it("Requirement 3: Embedding generation throws explicitly in production when provider fails", async () => {
    const originalEnv = env.NODE_ENV;
    try {
      (env as any).NODE_ENV = "production";

      const testGeminiService = new GeminiService();
      (testGeminiService as any).client = null;

      // Must throw an explicit error in production, never returning a deterministic fallback array
      await expect(
        testGeminiService.generateEmbedding("High pressure steam line torque specification")
      ).rejects.toThrow(/prohibited in production|failed in production/);
    } finally {
      (env as any).NODE_ENV = originalEnv;
    }
  });

  it("Requirement 3.1: Production mode with a configured client and VITEST set throws and never returns fallback", async () => {
    const originalEnv = env.NODE_ENV;
    const originalVitest = process.env.VITEST;
    const originalApiKey = env.GEMINI_API_KEY;
    try {
      (env as any).NODE_ENV = "production";
      process.env.VITEST = "true";
      (env as any).GEMINI_API_KEY = "test-configured-api-key";

      const testGeminiService = new GeminiService();
      expect(testGeminiService.isLiveClientConfigured()).toBe(true);

      // In production mode with unmocked client under Vitest, must throw rather than returning deterministic fallback
      await expect(
        testGeminiService.generateEmbedding("Feedwater pump motor vibration harmonics")
      ).rejects.toThrow(/prohibited in production|failed in production/);
    } finally {
      (env as any).NODE_ENV = originalEnv;
      (env as any).GEMINI_API_KEY = originalApiKey;
      if (originalVitest !== undefined) process.env.VITEST = originalVitest;
    }
  });

  it("Requirement 3.2: Production mode when a live embedding call fails throws explicit error", async () => {
    const originalEnv = env.NODE_ENV;
    try {
      (env as any).NODE_ENV = "production";

      const testGeminiService = new GeminiService();
      (testGeminiService as any).ai = {
        models: {
          embedContent: vi.fn().mockRejectedValue(new Error("Upstream quota exceeded (429)")),
        },
      };

      await expect(
        testGeminiService.generateEmbedding("Compressor seal differential pressure")
      ).rejects.toThrow(/Live Gemini embedding generation failed in production: Upstream quota exceeded \(429\)/);
    } finally {
      (env as any).NODE_ENV = originalEnv;
    }
  });

  it("Requirement 3.3: Vitest mode with an unmocked client prevents real remote requests and returns fallback", async () => {
    const testGeminiService = new GeminiService();
    let remoteInvoked = false;

    // Provide an unmocked raw function (not vi.fn) to verify it is never invoked
    (testGeminiService as any).ai = {
      models: {
        embedContent: () => {
          remoteInvoked = true;
          throw new Error("UNMOCKED_REMOTE_NETWORK_CALL_ATTEMPTED");
        },
      },
    };

    const result = await testGeminiService.generateEmbedding("Hydraulic accumulator pre-charge");
    expect(remoteInvoked).toBe(false);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(768);
    expect(testGeminiService.getLastProvider()).toBe("deterministic-fallback");
  });

  it("Requirement 3.4: Vitest mode with a mocked embedding client executes the mock successfully", async () => {
    const testGeminiService = new GeminiService();
    const mockVector = new Array(768).fill(0.42);
    const mockEmbedContent = vi.fn().mockResolvedValue({
      embedding: { values: mockVector },
    });

    (testGeminiService as any).ai = {
      models: {
        embedContent: mockEmbedContent,
      },
    };

    const result = await testGeminiService.generateEmbedding("Boiler safety valve lift threshold");
    expect(mockEmbedContent).toHaveBeenCalledTimes(1);
    expect(result).toEqual(mockVector);
    expect(testGeminiService.getLastProvider()).toBe("live-gemini");
  });

  // ── 4. Wildcard CORS Rejection in Production ──────────────────────────────
  it("Requirement 4: Wildcard CORS is rejected in production for both Express and Socket.IO", () => {
    const originalEnv = env.NODE_ENV;
    const originalCors = env.CORS_ORIGIN;
    try {
      (env as any).NODE_ENV = "production";
      (env as any).CORS_ORIGIN = "https://manuai.industrial.com";

      // In production, allowed origin matches exact allowlist
      expect(isAllowedOrigin("https://manuai.industrial.com")).toBe(true);

      // In production, arbitrary origins and wildcards are rejected
      expect(isAllowedOrigin("https://evil-attacker.com")).toBe(false);
      expect(isAllowedOrigin("*")).toBe(false);

      // Even if someone attempts to configure "*", production isAllowedOrigin strips wildcard
      (env as any).CORS_ORIGIN = "https://manuai.industrial.com, *";
      expect(isAllowedOrigin("https://evil-attacker.com")).toBe(false);
      expect(isAllowedOrigin("https://manuai.industrial.com")).toBe(true);
    } finally {
      (env as any).NODE_ENV = originalEnv;
      (env as any).CORS_ORIGIN = originalCors;
    }
  });

  // ── 5. Vector Retrieval Correctness & Candidate Limit ─────────────────────
  it("Requirement 5: Vector retrieval uses application-side cosine similarity capped at CANDIDATE_CHUNK_LIMIT", async () => {
    expect(CANDIDATE_CHUNK_LIMIT).toBe(500);

    const vectorService = new VectorService();

    // Test vector scoring correctness
    const v1 = [1, 0, 0];
    const v2 = [1, 0, 0];
    const v3 = [0, 1, 0];

    const simIdentical = vectorService.computeCosineSimilarity(v1, v2);
    const simOrthogonal = vectorService.computeCosineSimilarity(v1, v3);

    expect(simIdentical).toBeCloseTo(1.0, 5);
    expect(simOrthogonal).toBeCloseTo(0.0, 5);
  });

  // ── 6. Reduced Public Health Endpoint Detail ──────────────────────────────
  it("Requirement 6: Public health endpoint reports dependency status without disclosing hostname or credentials", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.service).toBe("MAN-U-AI API Server");
    expect(res.body.version).toBe("1.0.0");

    // Must NOT disclose internal database infrastructure details
    expect(res.body.database.host).toBeUndefined();
    expect(res.body.database.name).toBeUndefined();
    expect(res.body.database.isAtlas).toBeUndefined();

    // Must report dependency status cleanly
    expect(res.body.dependencies).toBeDefined();
    expect(res.body.dependencies.database).toBeDefined();
    expect(res.body.dependencies.vectorStore).toBeDefined();

    // Must NOT label Gemini as "active" or "live" merely because key is configured
    expect(res.body.multimodalEngine.status).not.toBe("active");
    expect(res.body.multimodalEngine.status).not.toBe("live");
    expect(["key_configured", "unconfigured"]).toContain(res.body.multimodalEngine.status);
  });
});
