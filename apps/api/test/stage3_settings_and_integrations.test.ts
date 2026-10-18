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
import { geminiService } from "../src/services/gemini.service";
import { isConnectedToMongo, connectDatabase, disconnectDatabase } from "../src/config/database";

describe("Stage 3: Persistent Settings, Analytics Range Filters, and Integrations", () => {
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
    }
  });

  afterAll(async () => {
    if (isConnectedToMongo) {
      await FacilitySettings.deleteMany({});
    }
  });

  describe("1. Settings Persistence & Administrator-Only RBAC", () => {
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
      expect(res.body.data.supportedModels).toContain("gemini-3.8-flash");
      expect(res.body.data.supportedModels).toContain("gemini-1.5-pro");
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

    it("PUT /settings validates bounds and rejects invalid inputs (400)", async () => {
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

      // Unsupported model not in allowlist
      const resModel = await request(app)
        .put("/api/v1/settings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ selectedModel: "gpt-4-turbo-unsupported" });

      expect(resModel.status).toBe(400);
    });

    it("PUT /settings persists valid configuration and updates runtime parameters", async () => {
      const updatePayload = {
        facilityName: "MAN-U-AI Advanced Refinery Plant B",
        timezone: "UTC+00:00 (GMT)",
        selectedModel: "gemini-1.5-pro",
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
      expect(res.body.data.temperature).toBe(0.15);
      expect(res.body.data.topK).toBe(4);
      expect(res.body.data.similarityThreshold).toBe(0.65);
      expect(res.body.data.selectedModel).toBe("gemini-1.5-pro");

      // Verify persistence via GET /settings
      const getRes = await request(app)
        .get("/api/v1/settings")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(getRes.status).toBe(200);
      expect(getRes.body.data.facilityName).toBe(updatePayload.facilityName);
      expect(getRes.body.data.temperature).toBe(0.15);
      expect(getRes.body.data.topK).toBe(4);
      expect(getRes.body.data.similarityThreshold).toBe(0.65);
      expect(getRes.body.data.selectedModel).toBe("gemini-1.5-pro");
    });
  });

  describe("2. Application of Saved Settings in RAG Pipeline", () => {
    it("RAG execution applies active saved topK, similarityThreshold, and model parameters", async () => {
      // Spy on vectorService.searchSimilar and geminiService.generateAnswer
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

      // Call ragService.answerQuestion as admin
      const result = await ragService.answerQuestion("How to calibrate valve?", {
        id: adminUserId,
        role: "admin",
      });

      expect(result).toBeDefined();
      expect(searchSpy).toHaveBeenCalled();
      // Verify searchSimilar received the saved topK (4) and similarityThreshold (0.65)
      const searchArgs = searchSpy.mock.calls[0];
      expect(searchArgs[2]).toBe(4); // topK
      expect(searchArgs[3]).toBe(0.65); // minSimilarity

      // Verify generateAnswer received the saved model ("gemini-1.5-pro") and temperature (0.15)
      expect(answerSpy).toHaveBeenCalled();
      const answerOptions = answerSpy.mock.calls[0][1];
      expect(answerOptions?.model).toBe("gemini-1.5-pro");
      expect(answerOptions?.temperature).toBe(0.15);
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

      // Create test messages with fixed timestamps
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

        // Verify count ordering: 7d <= 30d <= all, and specifically that msgRecent is included in 7d,
        // msgMid in 30d, and msgOld in all
        expect(count30d).toBeGreaterThanOrEqual(count7d + 1);
        expect(countAll).toBeGreaterThanOrEqual(count30d + 1);

        // Registry totals must be non-negative numbers representing current database state
        expect(typeof res7d.body.data.totalIndexedDocuments).toBe("number");
        expect(typeof res7d.body.data.totalMonitoredEquipment).toBe("number");
        expect(typeof resAll.body.data.totalIndexedDocuments).toBe("number");
        expect(typeof resAll.body.data.totalMonitoredEquipment).toBe("number");
      } finally {
        await Message.deleteMany({ _id: { $in: [msgRecent._id, msgMid._id, msgOld._id] } });
      }
    });
  });

  describe("4. Integrations Status & Truthful Connection Probes", () => {
    it("GET /integrations/status returns dynamic status for all supported integrations", async () => {
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

    it("POST /integrations/:id/test rejects unknown integration ID with 404", async () => {
      const res = await request(app)
        .post("/api/v1/integrations/unknown_system/test")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("INVALID_INTEGRATION_ID");
    });

    it("POST /integrations/opc_ua/test never claims success for unconfigured hardware gateway", async () => {
      const res = await request(app)
        .post("/api/v1/integrations/opc_ua/test")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.status).toBe("not_configured");
      expect(res.body.message).toContain("not configured");
    });

    it("POST /integrations/sap/test never claims success for unintegrated CMMS", async () => {
      const res = await request(app)
        .post("/api/v1/integrations/sap/test")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.status).toBe("not_implemented");
      expect(res.body.message).toContain("not implemented");
    });

    it("POST /integrations/mongodb/test verifies active connection via real ping", async () => {
      const res = await request(app)
        .post("/api/v1/integrations/mongodb/test")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      if (isConnectedToMongo) {
        expect(res.body.success).toBe(true);
        expect(res.body.status).toBe("connected");
      } else {
        expect(res.body.success).toBe(false);
        expect(res.body.status).toBe("disconnected");
      }
    });

    it("POST /integrations/storage/test verifies storage adapter accessibility", async () => {
      const res = await request(app)
        .post("/api/v1/integrations/storage/test")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("success");
      expect(res.body).toHaveProperty("message");
    });
  });
});
