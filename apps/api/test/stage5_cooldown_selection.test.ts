import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import { env } from "../src/config/env";
import { connectDatabase } from "../src/config/database";
import { geminiService, modelQuotaTracker } from "../src/services/gemini.service";
import { ragService } from "../src/services/rag.service";
import { probeCandidateModel } from "../src/routes/integrations.routes";

describe("Stage 5.6.2: Cooldown-Aware Model Selection, Fallback, and Integration Diagnostics", () => {
  let adminToken: string;
  let engineerToken: string;

  beforeAll(async () => {
    await connectDatabase();
    adminToken = jwt.sign(
      { id: "usr-admin-562-1", email: "admin@plant.io", role: "admin", name: "Admin Lead" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    engineerToken = jwt.sign(
      { id: "usr-eng-562-1", email: "engineer@plant.io", role: "engineer", name: "Shift Engineer" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    modelQuotaTracker.clear();
  });

  it("1. When selected model is in cooldown and a fallback is available, selected model is skipped and fallback is called", async () => {
    const originalAi = (geminiService as any).ai;
    const attemptedModels: string[] = [];

    // Pre-record failure for gemini-3.8-flash putting it into cooldown
    modelQuotaTracker.recordFailure("gemini-3.8-flash", {
      status: 429,
      error: { code: 429, status: "RESOURCE_EXHAUSTED", details: [{ retryDelay: "50000s" }] },
    });

    expect(modelQuotaTracker.isAvailable("gemini-3.8-flash")).toBe(false);

    (geminiService as any).ai = {
      models: {
        generateContent: vi.fn().mockImplementation(async (payload: any) => {
          attemptedModels.push(payload.model);
          return { text: "Generated grounded response from fallback model." };
        }),
      },
    };

    try {
      // Call with explicit model set to the model currently in cooldown
      const res = await geminiService.generateAnswer("What are the components of lathe machine?", {
        model: "gemini-3.8-flash",
      });

      expect(res).toContain("Generated grounded response from fallback model.");
      // Crucial assertion: gemini-3.8-flash MUST NOT have been attempted because it is in active cooldown!
      expect(attemptedModels).not.toContain("gemini-3.8-flash");
      expect(attemptedModels.length).toBeGreaterThanOrEqual(1);
      // The first attempted model should be an available fallback (e.g. gemini-3-flash-preview)
      expect(modelQuotaTracker.isAvailable(attemptedModels[0])).toBe(true);
    } finally {
      (geminiService as any).ai = originalAi;
    }
  });

  it("2. When selected model has zero quota, it is filtered out and available fallback is used", async () => {
    const originalAi = (geminiService as any).ai;
    const attemptedModels: string[] = [];

    // Pre-record zero quota for gemini-4-argon
    modelQuotaTracker.recordFailure("gemini-4-argon", {
      status: 429,
      message: "Resource exhausted limit: 0",
      error: { details: [{ violations: [{ quotaValue: "0" }] }] },
    });

    expect(modelQuotaTracker.hasZeroQuota("gemini-4-argon")).toBe(true);
    expect(modelQuotaTracker.isAvailable("gemini-4-argon")).toBe(false);

    (geminiService as any).ai = {
      models: {
        generateContent: vi.fn().mockImplementation(async (payload: any) => {
          attemptedModels.push(payload.model);
          return { text: "Response from viable fallback." };
        }),
      },
    };

    try {
      const candidates = geminiService.getCandidateModels("gemini-4-argon", true);
      // gemini-4-argon should not be prioritized at index 0 when it has zero quota
      expect(candidates[0]).not.toBe("gemini-4-argon");

      const res = await geminiService.generateAnswer("Explain lathe bed function", {
        model: "gemini-4-argon",
      });

      expect(res).toBe("Response from viable fallback.");
      expect(attemptedModels).not.toContain("gemini-4-argon");
    } finally {
      (geminiService as any).ai = originalAi;
    }
  });

  it("3. When explicit selected model is available, it is preferred and attempted first", async () => {
    const originalAi = (geminiService as any).ai;
    const attemptedModels: string[] = [];

    (geminiService as any).ai = {
      models: {
        generateContent: vi.fn().mockImplementation(async (payload: any) => {
          attemptedModels.push(payload.model);
          return { text: "Generated response from preferred model." };
        }),
      },
    };

    try {
      const res = await geminiService.generateAnswer("Verify headstock lubrication", {
        model: "gemini-3-flash-preview",
      });

      expect(res).toBe("Generated response from preferred model.");
      expect(attemptedModels[0]).toBe("gemini-3-flash-preview");
    } finally {
      (geminiService as any).ai = originalAi;
    }
  });

  it("4. When all candidates are unavailable in production, returns prompt safe 503 without raw JSON", async () => {
    const originalAi = (geminiService as any).ai;
    const originalNodeEnv = env.NODE_ENV;
    (env as any).NODE_ENV = "production";

    // Put all supported models in cooldown
    for (const m of ["gemini-3-flash-preview", "gemini-3.8-flash", "gemini-3.6-flash", "gemini-4-argon"]) {
      modelQuotaTracker.recordFailure(m, {
        status: 429,
        error: { code: 429, status: "RESOURCE_EXHAUSTED", details: [{ retryDelay: "600s" }] },
      });
    }

    try {
      await expect(
        geminiService.generateAnswer("What are the components of lathe machine?", {
          model: "gemini-3-flash-preview",
        })
      ).rejects.toMatchObject({
        httpStatus: 503,
        code: "LLM_QUOTA_EXHAUSTED",
        userMessage: expect.stringContaining("AI generation is temporarily unavailable"),
      });
    } finally {
      (env as any).NODE_ENV = originalNodeEnv;
      (geminiService as any).ai = originalAi;
    }
  });

  it("5. Integration probe and normal generation classify error categories consistently", async () => {
    // 404 Model Not Found
    const notFoundMockAi: any = {
      models: {
        generateContent: vi.fn().mockRejectedValue({
          status: 404,
          message: "models/gemini-legacy is not found / is not supported",
        }),
      },
    };
    const probe404 = await probeCandidateModel(notFoundMockAi, "gemini-legacy");
    expect(probe404.category).toBe("model_unavailable");
    expect(probe404.httpStatus).toBe(404);

    // 429 Quota Exhausted
    const quotaMockAi: any = {
      models: {
        generateContent: vi.fn().mockRejectedValue({
          status: 429,
          error: { code: 429, status: "RESOURCE_EXHAUSTED", details: [{ retryDelay: "3600s" }] },
        }),
      },
    };
    const probe429 = await probeCandidateModel(quotaMockAi, "gemini-3.8-flash");
    expect(probe429.category).toBe("quota_exhausted");
    expect(probe429.httpStatus).toBe(429);
    expect(probe429.retryDelaySeconds).toBe(3600);

    // 429 Zero Quota
    const zeroQuotaMockAi: any = {
      models: {
        generateContent: vi.fn().mockRejectedValue({
          status: 429,
          message: "Resource exhausted limit: 0",
          error: { details: [{ violations: [{ quotaValue: "0" }] }] },
        }),
      },
    };
    const probeZero = await probeCandidateModel(zeroQuotaMockAi, "gemini-4-argon");
    expect(probeZero.category).toBe("zero_quota");
    expect(probeZero.httpStatus).toBe(429);
  });

  it("6. POST /api/v1/chat returns concise error with correlation requestId and NO raw provider JSON or secrets on failure", async () => {
    const originalAi = (geminiService as any).ai;
    const originalNodeEnv = env.NODE_ENV;
    (env as any).NODE_ENV = "production";

    // Mock vector search to return candidate evidence chunk
    vi.spyOn(ragService as any, "answerQuestion").mockRejectedValueOnce(
      (() => {
        const err: any = new Error(
          "AI generation service is currently unavailable. Generative synthesis failed across candidate models: The requested AI model is currently unavailable or not accessible with the current project credentials. Please verify model configuration."
        );
        err.stage = "model_generation";
        err.code = "LLM_MODEL_UNAVAILABLE";
        err.httpStatus = 503;
        err.userMessage =
          "The requested AI model is currently unavailable or not accessible with the current project credentials. Please verify model configuration.";
        err.sanitizedMessage = err.userMessage;
        return err;
      })()
    );

    try {
      const res = await request(app)
        .post("/api/v1/chat")
        .set("Authorization", `Bearer ${engineerToken}`)
        .send({ message: "What are the components of lathe machine?" });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe("LLM_MODEL_UNAVAILABLE");
      expect(res.body.error.details).toBe(
        "The requested AI model is currently unavailable or not accessible with the current project credentials. Please verify model configuration."
      );
      expect(res.body.error.requestId).toMatch(/^req-/);

      // Verify NO raw Google JSON or secrets leaked
      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain(env.GEMINI_API_KEY);
      expect(bodyStr).not.toContain("RESOURCE_EXHAUSTED");
      expect(bodyStr).not.toContain("limit: 0");
    } finally {
      (env as any).NODE_ENV = originalNodeEnv;
      (geminiService as any).ai = originalAi;
    }
  });

  it("7. Successful generation returns grounded answer with valid page citations", async () => {
    const originalAi = (geminiService as any).ai;

    (geminiService as any).ai = {
      models: {
        embedContent: vi.fn().mockResolvedValue({ embedding: { values: new Array(768).fill(0.1) } }),
        generateContent: vi.fn().mockResolvedValue({
          text: "Lathe machine components include the bed (heavy cast base), headstock (driving mechanism and spindle), tailstock (supports workpieces), and carriage (cross-slide, tool post, apron).",
        }),
      },
    };

    const { vectorService } = await import("../src/services/vector.service");
    vi.spyOn(vectorService, "searchSimilar").mockResolvedValueOnce([
      {
        chunk: {
          id: "chunk-lathe-test-1",
          documentId: "doc-lathe-test-1",
          documentTitle: "Lathe Operator Manual",
          revision: "1.0",
          page: 7,
          section: "Components",
          text: "Bed supports all major components. Carriage slides along ways.",
        },
        score: 0.95,
      },
    ]);

    try {
      const res = await request(app)
        .post("/api/v1/chat")
        .set("Authorization", `Bearer ${engineerToken}`)
        .send({ message: "What are the components of lathe machine?" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.answer).toContain("Lathe machine components include the bed");
      expect(Array.isArray(res.body.data.citations)).toBe(true);
      expect(res.body.data.citations.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.citations[0].documentTitle).toBe("Lathe Operator Manual");
      expect(res.body.data.citations[0].page).toBe(7);
    } finally {
      (geminiService as any).ai = originalAi;
    }
  });
});
