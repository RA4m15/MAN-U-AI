import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import { env } from "../src/config/env";
import { connectDatabase } from "../src/config/database";
import { modelQuotaTracker } from "../src/services/gemini.service";
import { probeCandidateModel } from "../src/routes/integrations.routes";

let mockGenerateContentImpl: (payload: any) => Promise<any>;

vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: class MockGoogleGenAI {
      models = {
        generateContent: (payload: any) => {
          if (mockGenerateContentImpl) {
            return mockGenerateContentImpl(payload);
          }
          return Promise.resolve({ text: "pong" });
        },
      };
    },
  };
});

describe("Stage 5.6.1: Candidate Model Integration Probe & Quota Validation", () => {
  let adminToken: string;
  let engineerToken: string;

  beforeAll(async () => {
    await connectDatabase();
    adminToken = jwt.sign(
      { id: "usr-admin-probe-1", email: "admin@plant.io", role: "admin", name: "Admin User" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    engineerToken = jwt.sign(
      { id: "usr-eng-probe-1", email: "engineer@plant.io", role: "engineer", name: "Engineer User" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    modelQuotaTracker.clear();
  });

  it("1. POST /api/v1/integrations/gemini/test rejects non-admin callers with 403 Forbidden", async () => {
    const res = await request(app)
      .post("/api/v1/integrations/gemini/test")
      .set("Authorization", `Bearer ${engineerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error?.code).toBe("FORBIDDEN");
  });

  it("2. POST /api/v1/integrations/gemini/test probes candidate models and reports sanitized categories without secrets", async () => {
    mockGenerateContentImpl = async (payload: any) => {
      if (payload.model === "gemini-3.8-flash" || payload.model === "gemini-3.6-flash") {
        const err: any = new Error("Resource exhausted: You exceeded your current quota limit: 20");
        err.status = 429;
        err.error = { code: 429, status: "RESOURCE_EXHAUSTED", details: [{ retryDelay: "50000s" }] };
        throw err;
      }
      if (payload.model === "gemini-4-argon") {
        const err: any = new Error("Resource exhausted limit: 0");
        err.status = 429;
        err.error = { code: 429, details: [{ violations: [{ quotaValue: "0" }] }] };
        throw err;
      }
      if (payload.model === "gemini-3-flash-preview") {
        return { text: "pong" };
      }
      const err: any = new Error("Model not found");
      err.status = 404;
      throw err;
    };

    const res = await request(app)
      .post("/api/v1/integrations/gemini/test")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        models: ["gemini-3.8-flash", "gemini-3-flash-preview", "gemini-4-argon"],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.results)).toBe(true);
    expect(res.body.results.length).toBe(3);

    // Verify sanitized structure
    const flashPreview = res.body.results.find((r: any) => r.model === "gemini-3-flash-preview");
    expect(flashPreview).toBeDefined();
    expect(flashPreview.category).toBe("success");
    expect(flashPreview.httpStatus).toBe(200);
    expect(flashPreview.supported).toBe(true);

    const argon = res.body.results.find((r: any) => r.model === "gemini-4-argon");
    expect(argon).toBeDefined();
    expect(argon.category).toBe("zero_quota");
    expect(argon.httpStatus).toBe(429);

    // Ensure no raw secrets in response
    const rawBody = JSON.stringify(res.body);
    expect(rawBody).not.toContain(env.GEMINI_API_KEY);
    expect(rawBody).not.toContain("Bearer ");
  });

  it("3. probeCandidateModel classifies error status codes accurately", async () => {
    const mockAi: any = {
      models: {
        generateContent: vi.fn().mockRejectedValue({
          status: 403,
          message: "The caller does not have permission / permission denied",
        }),
      },
    };

    const res = await probeCandidateModel(mockAi, "gemini-3-flash-preview");
    expect(res.category).toBe("access_denied");
    expect(res.httpStatus).toBe(403);
    expect(res.supported).toBe(true);
  });

  it("4. POST /api/v1/integrations/gemini/test handles missing or null models gracefully by probing default pool", async () => {
    mockGenerateContentImpl = async () => ({ text: "pong" });

    // 4a. models explicitly null
    const nullRes = await request(app)
      .post("/api/v1/integrations/gemini/test")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ models: null });

    expect(nullRes.status).toBe(200);
    expect(nullRes.body.success).toBe(true);
    expect(Array.isArray(nullRes.body.results)).toBe(true);
    expect(nullRes.body.results.length).toBeGreaterThan(0);

    // 4b. models omitted entirely (empty body)
    const emptyBodyRes = await request(app)
      .post("/api/v1/integrations/gemini/test")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});

    expect(emptyBodyRes.status).toBe(200);
    expect(emptyBodyRes.body.success).toBe(true);
    expect(Array.isArray(emptyBodyRes.body.results)).toBe(true);
    expect(emptyBodyRes.body.results.length).toBeGreaterThan(0);
  });
});
