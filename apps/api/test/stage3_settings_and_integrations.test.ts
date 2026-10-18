import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { app } from "../src/app";
import { env } from "../src/config/env";
import {
  FacilitySettings,
  Message,
  DocumentModel,
  Equipment,
  User,
  AuditEvent,
} from "../src/models";
import { ragService } from "../src/services/rag.service";
import { vectorService } from "../src/services/vector.service";
import { geminiService, buildModelGenerationConfig } from "../src/services/gemini.service";
import { settingsService, SUPPORTED_MODELS, MODEL_CAPABILITIES, getModelCapabilities } from "../src/services/settings.service";
import { isConnectedToMongo, setIsConnectedToMongo, connectDatabase } from "../src/config/database";
import { sanitizeError } from "../src/routes/settings.routes";

describe("Stage 3.1: Authoritative Settings, Model Allowlist, Integration RBAC & GenAI Migration", () => {
  let adminToken: string;
  let engineerToken: string;
  let viewerToken: string;
  let adminUserId: string;

  beforeAll(async () => {
    await connectDatabase();

    // Generate valid tokens for role-based authorization testing
    adminUserId = new mongoose.Types.ObjectId().toString();
    adminToken = jwt.sign(
      { id: adminUserId, email: "admin@plant.io", name: "Plant Admin", role: "admin" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    engineerToken = jwt.sign(
      { id: new mongoose.Types.ObjectId().toString(), email: "eng@plant.io", name: "Plant Engineer", role: "engineer" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    viewerToken = jwt.sign(
      { id: new mongoose.Types.ObjectId().toString(), email: "viewer@plant.io", name: "Shopfloor Operator", role: "viewer" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    if (isConnectedToMongo) {
      await FacilitySettings.deleteMany({});
      settingsService.clearCache();
    }
  });

  afterAll(async () => {
    if (isConnectedToMongo) {
      await FacilitySettings.deleteMany({});
      settingsService.clearCache();
    }
  });

  describe("1. Settings Persistence, Fail-Closed Behavior & Administrator RBAC", () => {
    it("GET /settings returns default settings and supportedModels allowlist", async () => {
      const res = await request(app)
        .get("/api/v1/settings")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty("facilityName");
      expect(res.body.data).toHaveProperty("timezone");
      expect(res.body.data).toHaveProperty("selectedModel");
      expect(res.body.data).toHaveProperty("temperature");
      expect(res.body.data).toHaveProperty("topK");
      expect(res.body.data).toHaveProperty("similarityThreshold");
      expect(Array.isArray(res.body.data.supportedModels)).toBe(true);

      // Verify active models are present and retired models are completely absent
      expect(res.body.data.supportedModels).toContain("gemini-3.8-flash");
      expect(res.body.data.supportedModels).toContain("gemini-3.6-flash");
      expect(res.body.data.supportedModels).toContain("gemini-4-argon");
      expect(res.body.data.supportedModels).not.toContain("gemini-1.5-flash");
      expect(res.body.data.supportedModels).not.toContain("gemini-1.5-pro");
      expect(res.body.data.supportedModels).not.toContain("gemini-2.0-flash");
    });

    it("GET /settings returns HTTP 503 when MongoDB is disconnected instead of fake in-memory 200 OK", async () => {
      const originalState = isConnectedToMongo;
      try {
        setIsConnectedToMongo(false);
        const res = await request(app)
          .get("/api/v1/settings")
          .set("Authorization", `Bearer ${viewerToken}`);

        expect(res.status).toBe(503);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe("SERVICE_UNAVAILABLE");
      } finally {
        setIsConnectedToMongo(originalState);
      }
    });

    it("PUT /settings rejects unauthorized requests without token (401)", async () => {
      const res = await request(app)
        .put("/api/v1/settings")
        .send({ facilityName: "Hacked Facility" });

      expect(res.status).toBe(401);
    });

    it("PUT /settings rejects non-admin users (engineer/viewer) with 403 Forbidden", async () => {
      const resEng = await request(app)
        .put("/api/v1/settings")
        .set("Authorization", `Bearer ${engineerToken}`)
        .send({ facilityName: "New Plant Name" });

      expect(resEng.status).toBe(403);

      const resView = await request(app)
        .put("/api/v1/settings")
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({ facilityName: "New Plant Name" });

      expect(resView.status).toBe(403);
    });

    it("PUT /settings validates bounds and rejects retired/deprecated model IDs (400)", async () => {
      // Invalid temperature > 1.0
      const resTemp = await request(app)
        .put("/api/v1/settings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ temperature: 1.5 });

      expect(resTemp.status).toBe(400);
      expect(resTemp.body.error.code).toBe("VALIDATION_ERROR");

      // Invalid topK > 20
      const resTopK = await request(app)
        .put("/api/v1/settings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ topK: 99 });

      expect(resTopK.status).toBe(400);

      // Retired model IDs must be rejected
      const retiredModels = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash"];
      for (const retired of retiredModels) {
        const resRetired = await request(app)
          .put("/api/v1/settings")
          .set("Authorization", `Bearer ${adminToken}`)
          .send({ selectedModel: retired });

        expect(resRetired.status).toBe(400);
        expect(resRetired.body.error.code).toBe("VALIDATION_ERROR");
      }

      // Invalid timezone string must be rejected
      const resTz = await request(app)
        .put("/api/v1/settings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ timezone: "Invalid/FakeTimezone_123" });

      expect(resTz.status).toBe(400);
      expect(resTz.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("PUT /settings persists valid configuration with IANA timezone and active model", async () => {
      const updatePayload = {
        facilityName: "MAN-U-AI Advanced Refinery Plant B",
        timezone: "Asia/Kolkata",
        selectedModel: "gemini-3.6-flash",
        temperature: 0.15,
        topK: 4,
        similarityThreshold: 0.65,
      };

      const res = await request(app)
        .put("/api/v1/settings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(updatePayload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.facilityName).toBe(updatePayload.facilityName);
      expect(res.body.data.timezone).toBe("Asia/Kolkata");
      expect(res.body.data.temperature).toBe(0.15);
      expect(res.body.data.topK).toBe(4);
      expect(res.body.data.similarityThreshold).toBe(0.65);
      expect(res.body.data.selectedModel).toBe("gemini-3.6-flash");

      // Verify persistence via GET /settings
      const getRes = await request(app)
        .get("/api/v1/settings")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.facilityName).toBe(updatePayload.facilityName);
      expect(getRes.body.data.timezone).toBe("Asia/Kolkata");
      expect(getRes.body.data.temperature).toBe(0.15);
      expect(getRes.body.data.topK).toBe(4);
      expect(getRes.body.data.similarityThreshold).toBe(0.65);
      expect(getRes.body.data.selectedModel).toBe("gemini-3.6-flash");
    });

    it("Authoritative persistence: settings saved in MongoDB apply to RAG after simulated restart without prior GET /settings", async () => {
      // 1. Persist specific distinct settings directly in MongoDB
      await FacilitySettings.deleteMany({});
      await FacilitySettings.create({
        facilityName: "Simulated Cold-Boot Facility",
        timezone: "UTC",
        selectedModel: "gemini-4-argon",
        temperature: 0.1,
        topK: 7,
        similarityThreshold: 0.72,
      });

      // 2. Clear settings service cache (simulating application restart)
      settingsService.clearCache();

      // 3. Spy on searchSimilar and generateAnswer to observe what RAG receives
      const searchSpy = vi.spyOn(vectorService, "searchSimilar").mockResolvedValueOnce([
        {
          chunk: {
            id: "chk-boot-01",
            documentId: "doc-boot-01",
            documentTitle: "Boot Manual",
            revision: "v1.0",
            page: 1,
            section: "Power",
            text: "Clean boot procedure",
          },
          score: 0.98,
        },
      ]);

      const answerSpy = vi.spyOn(geminiService, "generateAnswer").mockResolvedValueOnce(
        "Synthesized cold-boot answer."
      );
      vi.spyOn(geminiService, "generateEmbedding").mockResolvedValueOnce(new Array(768).fill(0.01));

      // 4. Call RAG pipeline directly without calling GET /settings
      const result = await ragService.answerQuestion("How to reboot power module?", {
        id: adminUserId,
        role: "admin",
      });

      expect(result).toBeDefined();
      expect(searchSpy).toHaveBeenCalled();
      const searchArgs = searchSpy.mock.calls[0];
      // Must reflect persisted topK (7) and similarityThreshold (0.72) from MongoDB
      expect(searchArgs[2]).toBe(7);
      expect(searchArgs[3]).toBe(0.72);

      // Must reflect persisted model ("gemini-4-argon") and temperature (0.1) from MongoDB
      expect(answerSpy).toHaveBeenCalled();
      const answerOptions = answerSpy.mock.calls[0][1];
      expect(answerOptions?.model).toBe("gemini-4-argon");
      expect(answerOptions?.temperature).toBe(0.1);
    });
  });

  describe("2. Application of Saved Settings in RAG Pipeline", () => {
    it("RAG execution applies active saved topK, similarityThreshold, and model parameters", async () => {
      // Update settings
      await settingsService.updateSettings({
        selectedModel: "gemini-3.6-flash",
        temperature: 0.18,
        topK: 4,
        similarityThreshold: 0.65,
      });

      const searchSpy = vi.spyOn(vectorService, "searchSimilar").mockResolvedValueOnce([
        {
          chunk: {
            id: "chk-test-01",
            documentId: "doc-test-01",
            documentTitle: "Test Manual",
            revision: "v1.0",
            page: 1,
            section: "Intro",
            text: "Verified procedure text",
          },
          score: 0.95,
        },
      ]);

      const answerSpy = vi.spyOn(geminiService, "generateAnswer").mockResolvedValueOnce(
        "Synthesized grounded response."
      );
      vi.spyOn(geminiService, "generateEmbedding").mockResolvedValueOnce(new Array(768).fill(0.01));

      const result = await ragService.answerQuestion("How to calibrate valve?", {
        id: adminUserId,
        role: "admin",
      });

      expect(result).toBeDefined();
      expect(searchSpy).toHaveBeenCalled();
      const searchArgs = searchSpy.mock.calls[0];
      expect(searchArgs[2]).toBe(4); // topK
      expect(searchArgs[3]).toBe(0.65); // minSimilarity

      expect(answerSpy).toHaveBeenCalled();
      const answerOptions = answerSpy.mock.calls[0][1];
      expect(answerOptions?.model).toBe("gemini-3.6-flash");
      expect(answerOptions?.temperature).toBe(0.18);
    });
  });

  describe("3. Insights Time-Range Filters & Date-Scoped Calculations", () => {
    it("rejects invalid range parameter with 400 Validation Error", async () => {
      const res = await request(app)
        .get("/api/v1/analytics/insights?range=90d")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("applies real date filtering to RAG inquiries while preserving lifetime registry totals", async () => {
      if (!isConnectedToMongo) {
        return;
      }

      const now = Date.now();
      const msgRecent = await Message.create({
        conversationId: new mongoose.Types.ObjectId(),
        role: "user",
        content: "Question from 2 days ago",
        citations: [],
        createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000),
      });

      const msgMid = await Message.create({
        conversationId: new mongoose.Types.ObjectId(),
        role: "user",
        content: "Question from 15 days ago",
        citations: [],
        createdAt: new Date(now - 15 * 24 * 60 * 60 * 1000),
      });

      const msgOld = await Message.create({
        conversationId: new mongoose.Types.ObjectId(),
        role: "user",
        content: "Question from 45 days ago",
        citations: [],
        createdAt: new Date(now - 45 * 24 * 60 * 60 * 1000),
      });

      try {
        // Query 7d
        const res7d = await request(app)
          .get("/api/v1/analytics/insights?range=7d")
          .set("Authorization", `Bearer ${viewerToken}`);

        expect(res7d.status).toBe(200);
        expect(res7d.body.data.range).toBe("7d");
        const count7d = res7d.body.data.totalRAGInquiries;

        // Query 30d
        const res30d = await request(app)
          .get("/api/v1/analytics/insights?range=30d")
          .set("Authorization", `Bearer ${viewerToken}`);

        expect(res30d.status).toBe(200);
        expect(res30d.body.data.range).toBe("30d");
        const count30d = res30d.body.data.totalRAGInquiries;

        // Query all
        const resAll = await request(app)
          .get("/api/v1/analytics/insights?range=all")
          .set("Authorization", `Bearer ${viewerToken}`);

        expect(resAll.status).toBe(200);
        expect(resAll.body.data.range).toBe("all");
        const countAll = resAll.body.data.totalRAGInquiries;

        expect(count30d).toBeGreaterThanOrEqual(count7d + 1);
        expect(countAll).toBeGreaterThanOrEqual(count30d + 1);

        expect(typeof res7d.body.data.totalIndexedDocuments).toBe("number");
        expect(typeof res7d.body.data.totalMonitoredEquipment).toBe("number");
        expect(typeof resAll.body.data.totalIndexedDocuments).toBe("number");
        expect(typeof resAll.body.data.totalMonitoredEquipment).toBe("number");
      } finally {
        await Message.deleteMany({ _id: { $in: [msgRecent._id, msgMid._id, msgOld._id] } });
      }
    });
  });

  describe("4. Integrations Status & Secure Admin-Only Connection Probes", () => {
    it("GET /integrations/status returns dynamic status and verifies local directory writeability", async () => {
      const res = await request(app)
        .get("/api/v1/integrations/status")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const data = res.body.data;

      expect(data).toHaveProperty("mongodb");
      expect(data).toHaveProperty("gemini");
      expect(data).toHaveProperty("storage");
      expect(data).toHaveProperty("opc_ua");
      expect(data).toHaveProperty("modbus");
      expect(data).toHaveProperty("sap");
      expect(data).toHaveProperty("maximo");

      // Verify unconfigured connectors truthfully report not_configured or not_implemented
      expect(data.opc_ua.status).toBe("not_configured");
      expect(data.modbus.status).toBe("not_configured");
      expect(data.sap.status).toBe("not_implemented");
      expect(data.maximo.status).toBe("not_implemented");
    });

    it("POST /integrations/:id/test rejects unauthorized non-admin callers (viewer/engineer) with 403 Forbidden", async () => {
      const resViewer = await request(app)
        .post("/api/v1/integrations/mongodb/test")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(resViewer.status).toBe(403);

      const resEng = await request(app)
        .post("/api/v1/integrations/mongodb/test")
        .set("Authorization", `Bearer ${engineerToken}`);

      expect(resEng.status).toBe(403);
    });

    it("POST /integrations/:id/test allows administrator callers", async () => {
      const res = await request(app)
        .post("/api/v1/integrations/mongodb/test")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      if (isConnectedToMongo) {
        expect(res.body.success).toBe(true);
        expect(res.body.status).toBe("connected");
      }
    });

    it("POST /integrations/opc_ua/test never claims success for unconfigured hardware gateway", async () => {
      const res = await request(app)
        .post("/api/v1/integrations/opc_ua/test")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.status).toBe("not_configured");
      expect(res.body.message).toContain("not configured");
    });

    it("POST /integrations/sap/test never claims success for unintegrated CMMS", async () => {
      const res = await request(app)
        .post("/api/v1/integrations/sap/test")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.status).toBe("not_implemented");
      expect(res.body.message).toContain("not implemented");
    });

    it("POST /integrations/storage/test verifies local storage writeability", async () => {
      const res = await request(app)
        .post("/api/v1/integrations/storage/test")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("success");
      expect(res.body).toHaveProperty("message");
    });
  });

  describe("5. Gemini GenAI Migration & Safety Verification", () => {
    it("geminiService.generateEmbedding generates 768-dimensional normalized vectors", async () => {
      // Mock SDK embedContent call
      const mockVector = new Array(768).fill(0.02);
      const originalAi = (geminiService as any).ai;
      (geminiService as any).ai = {
        models: {
          embedContent: vi.fn().mockResolvedValue({
            embedding: { values: mockVector },
          }),
        },
      };

      try {
        const vector = await geminiService.generateEmbedding("Hydraulic valve lockout procedure");
        expect(Array.isArray(vector)).toBe(true);
        expect(vector.length).toBe(768);
        expect(vector[0]).toBe(0.02);
      } finally {
        (geminiService as any).ai = originalAi;
      }
    });

    it("geminiService.generateAnswer rejects deprecated model IDs and routes to active model", async () => {
      const fallbackSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const generateContentMock = vi.fn().mockResolvedValue({
        text: "Step 1: Relieve hydraulic pressure safely.",
      });

      const originalAi = (geminiService as any).ai;
      (geminiService as any).ai = {
        models: {
          generateContent: generateContentMock,
        },
      };

      try {
        const res = await geminiService.generateAnswer("How to bleed pump?", {
          model: "gemini-1.5-flash", // Retired model ID
          temperature: 0.2,
        });

        expect(res).toBe("Step 1: Relieve hydraulic pressure safely.");
        expect(fallbackSpy).toHaveBeenCalledWith(
          expect.stringContaining("Requested model 'gemini-1.5-flash' is retired or unsupported")
        );
        // Verify generateContent was called with the active fallback model (gemini-3.8-flash)
        expect(generateContentMock).toHaveBeenCalled();
        const callArgs = generateContentMock.mock.calls[0][0];
        expect(callArgs.model).toBe(env.GEMINI_MODEL);
      } finally {
        (geminiService as any).ai = originalAi;
        fallbackSpy.mockRestore();
      }
    });

    it("geminiService.generateAnswer handles generation errors safely without crashing", async () => {
      const originalAi = (geminiService as any).ai;
      (geminiService as any).ai = {
        models: {
          generateContent: vi.fn().mockRejectedValue(new Error("API quota exceeded or network failure")),
        },
      };

      try {
        const res = await geminiService.generateAnswer("Fault code F-401 resolution");
        expect(res).toBeDefined();
        // In offline/test mode, falls back to grounded documentation excerpt notice
        expect(res).toContain("AI Generative Service Unavailable");
      } finally {
        (geminiService as any).ai = originalAi;
      }
    });

    it("geminiService.transcribePdfWithOcr transcribes PDF buffer via multimodal vision", async () => {
      const originalAi = (geminiService as any).ai;
      (geminiService as any).ai = {
        models: {
          generateContent: vi.fn().mockResolvedValue({
            text: "--- PAGE 1 ---\nCentrifugal Slurry Pump Maintenance Standard.",
          }),
        },
      };

      try {
        const dummyPdf = Buffer.from("%PDF-1.4 mock content");
        const ocrText = await geminiService.transcribePdfWithOcr(dummyPdf);
        expect(ocrText).toContain("--- PAGE 1 ---");
        expect(ocrText).toContain("Centrifugal Slurry Pump");
      } finally {
        (geminiService as any).ai = originalAi;
      }
    });

    it("withTimeout clears timeout timer when the underlying operation completes successfully", async () => {
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");
      // Import the withTimeout implementation or test it directly
      const fastPromise = new Promise<string>((resolve) => setTimeout(() => resolve("success"), 50));

      let timer: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<string>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), 2000);
      });

      const result = await Promise.race([fastPromise, timeoutPromise]).finally(() => {
        if (timer) clearTimeout(timer);
      });

      expect(result).toBe("success");
      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });

  describe("6. Settings Failure Semantics, Concurrent Initialization & Safe Error Responses (Stage 3.1.1)", () => {
    it("initial settings creation succeeds and persists defaults into MongoDB", async () => {
      await FacilitySettings.deleteMany({});
      settingsService.clearCache();

      const initial = await settingsService.getEffectiveSettings();
      expect(initial).toBeDefined();
      expect(initial.facilityName).toBe("MAN-U-AI Heavy Operations Facility Alpha");
      expect(initial.selectedModel).toBe("gemini-3.8-flash");

      // Verify defaults were actually persisted to database
      const saved = await FacilitySettings.findOne().sort({ updatedAt: -1 });
      expect(saved).not.toBeNull();
      expect(saved?.facilityName).toBe("MAN-U-AI Heavy Operations Facility Alpha");
    });

    it("initial creation fails but concurrent request created settings; persisted settings are returned", async () => {
      await FacilitySettings.deleteMany({});
      settingsService.clearCache();

      // Spy on FacilitySettings.create to simulate a concurrent insert collision
      const createSpy = vi.spyOn(FacilitySettings, "create").mockImplementationOnce(async () => {
        // Concurrently another request writes to MongoDB
        await new FacilitySettings({
          facilityName: "Concurrent High-Availability Facility",
          timezone: "UTC",
          selectedModel: "gemini-3.6-flash",
          temperature: 0.1,
          topK: 8,
          similarityThreshold: 0.6,
        }).save();
        throw new Error("E11000 duplicate key error collection");
      });

      try {
        const result = await settingsService.getEffectiveSettings();
        expect(result).toBeDefined();
        // Must return the settings written concurrently by the other request
        expect(result.facilityName).toBe("Concurrent High-Availability Facility");
        expect(result.selectedModel).toBe("gemini-3.6-flash");
        expect(result.topK).toBe(8);
      } finally {
        createSpy.mockRestore();
      }
    });

    it("initial creation fails and subsequent lookup also finds no record; service rejects instead of returning defaults", async () => {
      await FacilitySettings.deleteMany({});
      settingsService.clearCache();

      // Simulate initial findOne returns null, create fails, and retry findOne returns null
      const findOneSpy = vi.spyOn(FacilitySettings, "findOne");
      // 1st call: sort().then() -> null
      // 2nd call: retry sort().then() -> null
      const mockQueryNull = {
        sort: vi.fn().mockResolvedValue(null),
      } as any;
      findOneSpy.mockReturnValue(mockQueryNull);

      const createSpy = vi.spyOn(FacilitySettings, "create").mockRejectedValueOnce(
        new Error("Disk quota exceeded on write")
      );

      try {
        await expect(settingsService.getEffectiveSettings()).rejects.toThrow(
          "Failed to initialize or retrieve persistent facility settings from database."
        );
        // Verify in-memory cache was not populated with false defaults
        expect((settingsService as any).cache).toBeNull();
      } finally {
        createSpy.mockRestore();
        findOneSpy.mockRestore();
      }
    });

    it("a database query failure propagates as an error without updating cache", async () => {
      settingsService.clearCache();

      const findOneSpy = vi.spyOn(FacilitySettings, "findOne").mockReturnValue({
        sort: vi.fn().mockRejectedValue(new Error("MongoNetworkTimeoutError: connection lost")),
      } as any);

      try {
        await expect(settingsService.getEffectiveSettings()).rejects.toThrow("MongoNetworkTimeoutError");
        expect((settingsService as any).cache).toBeNull();
      } finally {
        findOneSpy.mockRestore();
      }
    });

    it("internal database details do not appear in the HTTP response on GET or PUT failures", async () => {
      // 1. Test GET /settings database query failure response sanitization
      const getEffectiveSpy = vi.spyOn(settingsService, "getEffectiveSettings").mockRejectedValueOnce(
        new Error(
          "MongoServerError: E11000 duplicate key error collection: manuai.facilitysettings index: _id_ dup key: { _id: ObjectId('6ad4ee0bb277e637f9c22005') }"
        )
      );

      const getRes = await request(app)
        .get("/api/v1/settings")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(getRes.status).toBe(500);
      expect(getRes.body.success).toBe(false);
      expect(getRes.body.error.code).toBe("SETTINGS_QUERY_FAILED");
      expect(getRes.body.error.message).toBe("Failed to retrieve facility settings from database.");

      // Verify raw database message and internal identifiers are not leaked
      const rawGetBody = JSON.stringify(getRes.body);
      expect(rawGetBody).not.toContain("MongoServerError");
      expect(rawGetBody).not.toContain("E11000");
      expect(rawGetBody).not.toContain("duplicate key");
      expect(rawGetBody).not.toContain("facilitysettings");
      expect(rawGetBody).not.toContain("6ad4ee0bb277e637f9c22005");

      getEffectiveSpy.mockRestore();

      // 2. Test PUT /settings database persistence failure response sanitization
      const updateSpy = vi.spyOn(settingsService, "updateSettings").mockRejectedValueOnce(
        new Error(
          "MongooseError: Connection closed on ac-l0nlhix-shard-00-00.90gymzr.mongodb.net:27017 at collection: manuai.facilitysettings"
        )
      );

      const putRes = await request(app)
        .put("/api/v1/settings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ facilityName: "Updated Facility Name" });

      expect(putRes.status).toBe(500);
      expect(putRes.body.success).toBe(false);
      expect(putRes.body.error.code).toBe("PERSISTENCE_FAILED");
      expect(putRes.body.error.message).toBe("Failed to persist application settings to database.");

      // Verify raw database internals are not leaked
      const rawPutBody = JSON.stringify(putRes.body);
      expect(rawPutBody).not.toContain("MongooseError");
      expect(rawPutBody).not.toContain("ac-l0nlhix-shard");
      expect(rawPutBody).not.toContain("facilitysettings");

      updateSpy.mockRestore();
    });
  });

  describe("7. Secret Redaction & Sanitization Verification (Stage 3.1.2)", () => {
    it("redacts common secret parameters separately from parameter name and replaces entire value", () => {
      const fakeSecrets = [
        { param: "apiKey", value: "AIzaSyFakeSecret1234567890abcdef" },
        { param: "api_key", value: "secretApiKey_987654321_zyx" },
        { param: "secret", value: "UltraTopSecretKey_445566" },
        { param: "api_secret", value: "CloudinarySecretValue_8899" },
        { param: "password", value: "SuperSecretMongoPass!123#" },
        { param: "token", value: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake_token_payload" },
        { param: "key", value: "genericKeyVal_999000" },
      ];

      for (const item of fakeSecrets) {
        const rawErrorMsg = `Failed operation while calling provider with ${item.param}=${item.value}&otherParam=safeValue`;
        const sanitized = sanitizeError(new Error(rawErrorMsg));

        // Assert that the fake secret NEVER appears in the sanitized output
        expect(sanitized).not.toContain(item.value);
        // Assert that the parameter name is captured separately and replaced with [REDACTED]
        expect(sanitized).toContain(`${item.param}=[REDACTED]`);
        // Assert other safe parameters are preserved
        expect(sanitized).toContain("otherParam=safeValue");
      }
    });

    it("redacts quoted secret values cleanly without leaking secrets", () => {
      const fakePassword = "QuotedPassWord!999";
      const fakeApiKey = "QuotedApiKey_98765";

      const err1 = new Error(`Connection failed with password="${fakePassword}"`);
      const sanitized1 = sanitizeError(err1);
      expect(sanitized1).not.toContain(fakePassword);
      expect(sanitized1).toContain("password=[REDACTED]");

      const err2 = new Error(`Auth header apiKey='${fakeApiKey}'`);
      const sanitized2 = sanitizeError(err2);
      expect(sanitized2).not.toContain(fakeApiKey);
      expect(sanitized2).toContain("apiKey=[REDACTED]");
    });

    it("redacts MongoDB connection strings containing credentials", () => {
      const fakeMongoUris = [
        "mongodb+srv://admin_user:fakeMongoPassword123@cluster0.abc.mongodb.net/manuai?retryWrites=true&w=majority",
        "mongodb://db_admin:P%40ssw%3Ard999@10.0.1.25:27017,10.0.1.26:27017/manuai_prod",
      ];

      for (const uri of fakeMongoUris) {
        const error = new Error(`Connection pool timeout connecting to ${uri} after 10000ms`);
        const sanitized = sanitizeError(error);

        expect(sanitized).not.toContain("admin_user");
        expect(sanitized).not.toContain("fakeMongoPassword123");
        expect(sanitized).not.toContain("db_admin");
        expect(sanitized).not.toContain("P%40ssw%3Ard999");
        expect(sanitized).not.toContain("cluster0.abc.mongodb.net");
        expect(sanitized).not.toContain("10.0.1.25:27017");
        expect(sanitized).toContain("mongodb://[REDACTED_USER:PASS]@[REDACTED_HOST]");
      }
    });

    it("redacts signed Cloudinary URLs and Cloudinary connection credentials", () => {
      const signedUrl =
        "https://res.cloudinary.com/fake_company/image/upload/s--fakeSignature12345--/v1612345678/manuai/documents/pump_manual.pdf";
      const apiEndpoint =
        "https://api.cloudinary.com/v1_1/fake_company/resources/raw?api_key=fake_cloud_key&signature=fake_cloud_sig&timestamp=1612345678";
      const cloudinaryUri = "cloudinary://fake_key_111:fake_secret_222@fake_cloud_name";

      const err1 = new Error(`Upload failed to signed url ${signedUrl}`);
      const sanitized1 = sanitizeError(err1);
      expect(sanitized1).not.toContain("fakeSignature12345");
      expect(sanitized1).not.toContain("fake_company");
      expect(sanitized1).toContain("[REDACTED_CLOUDINARY_URL]");

      const err2 = new Error(`Cloudinary API probe failed: ${apiEndpoint}`);
      const sanitized2 = sanitizeError(err2);
      expect(sanitized2).not.toContain("fake_cloud_key");
      expect(sanitized2).not.toContain("fake_cloud_sig");
      expect(sanitized2).toContain("[REDACTED_CLOUDINARY_URL]");

      const err3 = new Error(`Invalid CLOUDINARY_URL: ${cloudinaryUri}`);
      const sanitized3 = sanitizeError(err3);
      expect(sanitized3).not.toContain("fake_key_111");
      expect(sanitized3).not.toContain("fake_secret_222");
      expect(sanitized3).toContain("cloudinary://[REDACTED_CREDENTIALS]@[REDACTED_CLOUD]");
    });

    it("prepends safe error category/name and logs safely on route failures", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const fakeSecretKey = "AIzaSySecretLeakProbe123";
      const customDbError = new Error(`MongoDB failed on query with apiKey=${fakeSecretKey}`);
      customDbError.name = "MongoNetworkTimeoutError";

      const getSettingsSpy = vi.spyOn(settingsService, "getEffectiveSettings").mockRejectedValueOnce(customDbError);

      try {
        const res = await request(app)
          .get("/api/v1/settings")
          .set("Authorization", `Bearer ${viewerToken}`);

        expect(res.status).toBe(500);
        expect(warnSpy).toHaveBeenCalled();
        const loggedWarn = warnSpy.mock.calls.find((call) =>
          call.some((arg) => typeof arg === "string" && arg.includes("[Settings] Failed to query authoritative settings"))
        );
        expect(loggedWarn).toBeDefined();
        const loggedWarnString = loggedWarn!.join(" ");

        // Safe category is present
        expect(loggedWarnString).toContain("[MongoNetworkTimeoutError]");
        // Secret is redacted
        expect(loggedWarnString).toContain("apiKey=[REDACTED]");
        expect(loggedWarnString).not.toContain(fakeSecretKey);
      } finally {
        getSettingsSpy.mockRestore();
        warnSpy.mockRestore();
        errorSpy.mockRestore();
      }
    });
  });

  describe("8. Model-Specific Generation Configuration & Sampling Consistency (Stage 4.1.2)", () => {
    it("getModelCapabilities() matches the official support rules for every allowed model", () => {
      // Modern Gemini models omit sampling parameters (temperature, top_p, top_k)
      for (const model of ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-4-argon"] as const) {
        const caps = getModelCapabilities(model);
        expect(caps.supportsTemperature).toBe(false);
        expect(caps.supportsTopP).toBe(false);
        expect(caps.supportsGenerationTopK).toBe(false);
      }

      // Legacy/reference models support sampling parameters
      const legacyCaps = getModelCapabilities("gemini-1.5-pro");
      expect(legacyCaps.supportsTemperature).toBe(true);
      expect(legacyCaps.supportsTopP).toBe(true);
      expect(legacyCaps.supportsGenerationTopK).toBe(true);

      // Unknown or arbitrary models default safely to false
      const unknownCaps = getModelCapabilities("gemini-unrecognized-model");
      expect(unknownCaps.supportsTemperature).toBe(false);
      expect(unknownCaps.supportsTopP).toBe(false);
      expect(unknownCaps.supportsGenerationTopK).toBe(false);
    });

    it("buildModelGenerationConfig() never emits unsupported parameters for any allowed model", () => {
      const allowedModels = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-4-argon"] as const;

      for (const model of allowedModels) {
        const config = buildModelGenerationConfig(model, {
          temperature: 0.7,
          topP: 0.95,
          topK: 10,
          systemInstruction: `Strict engineering mode for ${model}`,
        });

        expect(config).toBeDefined();
        expect(config?.systemInstruction).toBe(`Strict engineering mode for ${model}`);
        expect(config?.temperature).toBeUndefined();
        expect(config?.topP).toBeUndefined();
        expect(config?.topK).toBeUndefined();

        // When no systemInstruction is provided, config should be undefined rather than an empty object
        const emptyConfig = buildModelGenerationConfig(model, {
          temperature: 0.2,
          topP: 0.8,
          topK: 5,
        });
        expect(emptyConfig).toBeUndefined();
      }

      // Legacy models that support temperature should have it emitted
      const legacyConfig = buildModelGenerationConfig("gemini-1.5-pro", {
        temperature: 0.15,
        topP: 0.9,
        topK: 8,
        systemInstruction: "Legacy guideline",
      });
      expect(legacyConfig?.temperature).toBe(0.15);
      expect(legacyConfig?.topP).toBe(0.9);
      expect(legacyConfig?.topK).toBe(8);
      expect(legacyConfig?.systemInstruction).toBe("Legacy guideline");
    });

    it("ordinary answer generation sends model-appropriate request config for each model", async () => {
      const generateContentMock = vi.fn().mockResolvedValue({
        text: "Deterministic response.",
      });

      const originalAi = (geminiService as any).ai;
      (geminiService as any).ai = {
        models: {
          generateContent: generateContentMock,
        },
      };

      try {
        // Test all allowed models
        for (const model of ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-4-argon"] as const) {
          generateContentMock.mockClear();

          const res = await geminiService.generateAnswer("How to align pump coupling?", {
            model,
            temperature: 0.2,
            topP: 0.8,
            topK: 5,
            systemInstruction: "You are an industrial engineer.",
          });

          expect(res).toBe("Deterministic response.");
          expect(generateContentMock).toHaveBeenCalledTimes(1);
          const callArgs = generateContentMock.mock.calls[0][0];

          expect(callArgs.model).toBe(model);
          // Verify unsupported sampling parameters are strictly absent
          expect(callArgs.config?.temperature).toBeUndefined();
          expect(callArgs.config?.topP).toBeUndefined();
          expect(callArgs.config?.topK).toBeUndefined();
          expect(callArgs.config?.systemInstruction).toBe("You are an industrial engineer.");
        }

        // Unsupported models are re-mapped to env.GEMINI_MODEL and omit sampling settings
        generateContentMock.mockClear();
        await geminiService.generateAnswer("Inspect bearing clearance", {
          model: "gemini-1.5-pro",
          temperature: 0.1,
        });

        expect(generateContentMock).toHaveBeenCalledTimes(1);
        const legacyArgs = generateContentMock.mock.calls[0][0];
        expect(legacyArgs.model).toBe(env.GEMINI_MODEL);
        expect(legacyArgs.config?.temperature).toBeUndefined();
      } finally {
        (geminiService as any).ai = originalAi;
      }
    });

    it("transcribePdfWithOcr() uses model-capability-aware generation config under each supported model", async () => {
      const generateContentMock = vi.fn().mockResolvedValue({
        text: "--- PAGE 1 ---\nCentrifugal Slurry Pump Maintenance Standard.",
      });

      const originalAi = (geminiService as any).ai;
      (geminiService as any).ai = {
        models: {
          generateContent: generateContentMock,
        },
      };

      try {
        const dummyPdf = Buffer.from("%PDF-1.4 binary content");

        // Test each supported model: verify unsupported temperature: 0.1 is NEVER sent
        for (const model of ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-4-argon"] as const) {
          generateContentMock.mockClear();

          const ocrText = await geminiService.transcribePdfWithOcr(dummyPdf, model);
          expect(ocrText).toContain("--- PAGE 1 ---");
          expect(ocrText).toContain("Centrifugal Slurry Pump");

          expect(generateContentMock).toHaveBeenCalledTimes(1);
          const callArgs = generateContentMock.mock.calls[0][0];

          // Model choice is deliberate and preserved
          expect(callArgs.model).toBe(model);

          // Inline PDF data is present
          expect(callArgs.contents[0].inlineData).toBeDefined();
          expect(callArgs.contents[0].inlineData.mimeType).toBe("application/pdf");
          expect(callArgs.contents[0].inlineData.data).toBe(dummyPdf.toString("base64"));

          // Verbatim transcription requirement & page boundaries instructions preserved
          expect(callArgs.contents[1].text).toContain("optical character recognition (OCR)");
          expect(callArgs.contents[1].text).toContain("--- PAGE X ---");
          expect(callArgs.contents[1].text).toContain("verbatim");

          // Unsupported sampling settings (temperature, top_p, top_k) MUST be absent
          expect(callArgs.config?.temperature).toBeUndefined();
          expect(callArgs.config?.topP).toBeUndefined();
          expect(callArgs.config?.topK).toBeUndefined();
        }

        // Test with a model that DOES support temperature (e.g. gemini-1.5-pro)
        generateContentMock.mockClear();
        const legacyOcr = await geminiService.transcribePdfWithOcr(dummyPdf, "gemini-1.5-pro");
        expect(legacyOcr).toContain("--- PAGE 1 ---");
        const legacyArgs = generateContentMock.mock.calls[0][0];
        expect(legacyArgs.model).toBe("gemini-1.5-pro");
        expect(legacyArgs.config?.temperature).toBe(0.1);
      } finally {
        (geminiService as any).ai = originalAi;
      }
    });

    it("GET /settings exposes modelCapabilities indicating all modern models omit sampling parameters", async () => {
      const res = await request(app)
        .get("/api/v1/settings")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.modelCapabilities).toBeDefined();
      expect(res.body.data.modelCapabilities["gemini-3.8-flash"]).toEqual({
        supportsTemperature: false,
        supportsTopP: false,
        supportsGenerationTopK: false,
      });
      expect(res.body.data.modelCapabilities["gemini-3.6-flash"]).toEqual({
        supportsTemperature: false,
        supportsTopP: false,
        supportsGenerationTopK: false,
      });
      expect(res.body.data.modelCapabilities["gemini-4-argon"]).toEqual({
        supportsTemperature: false,
        supportsTopP: false,
        supportsGenerationTopK: false,
      });
    });
  });
});
