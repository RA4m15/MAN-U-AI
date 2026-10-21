import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import { env } from "../src/config/env";
import { connectDatabase } from "../src/config/database";
import { geminiService, modelQuotaTracker, analyzeProviderError } from "../src/services/gemini.service";
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
    for (const m of ["gemini-3-flash-preview", "gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-4-argon"]) {
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

  it("8. Regression: probeCandidateModel returns supported=true for gemini-3.5-flash-lite", async () => {
    const mockAi: any = {
      models: {
        generateContent: vi.fn().mockResolvedValue({ text: "health-probe-response" }),
      },
    };

    const result = await probeCandidateModel(mockAi, "gemini-3.5-flash-lite");
    expect(result.model).toBe("gemini-3.5-flash-lite");
    expect(result.supported).toBe(true);
    expect(result.category).toBe("success");
    expect(result.httpStatus).toBe(200);
  });

  it("9. Regression: Settings validation and persistence accepts gemini-3.5-flash-lite", async () => {
    const res = await request(app)
      .get("/api/v1/settings")
      .set("Authorization", `Bearer ${engineerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.supportedModels).toContain("gemini-3.5-flash-lite");
    expect(res.body.data.modelCapabilities["gemini-3.5-flash-lite"]).toEqual({
      supportsTemperature: false,
      supportsTopP: false,
      supportsGenerationTopK: false,
    });

    const updateRes = await request(app)
      .put("/api/v1/settings")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ selectedModel: "gemini-3.5-flash-lite" });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.success).toBe(true);
    expect(updateRes.body.data.selectedModel).toBe("gemini-3.5-flash-lite");
  });

  it("10. Regression: Candidate failover ordering includes gemini-3.5-flash-lite", () => {
    const candidates = geminiService.getCandidateModels("gemini-3.8-flash");
    expect(candidates).toContain("gemini-3.5-flash-lite");
  });

  it("11. Bounded retry on 503: Transient 503 on first try succeeds on retry without entering cooldown", async () => {
    const originalAi = (geminiService as any).ai;
    let callCount = 0;

    (geminiService as any).ai = {
      models: {
        generateContent: vi.fn().mockImplementation(async (payload: any) => {
          callCount++;
          if (callCount === 1) {
            const err: any = new Error("The service is temporarily overloaded. Please try again shortly.");
            err.status = 503;
            throw err;
          }
          return { text: "Success on transient 503 retry." };
        }),
      },
    };

    try {
      const res = await geminiService.generateAnswer("Check hydraulic pressure", {
        model: "gemini-3.5-flash-lite",
      });

      expect(res).toBe("Success on transient 503 retry.");
      expect(callCount).toBe(2);
      // Ensure the model did NOT enter cooldown
      expect(modelQuotaTracker.isAvailable("gemini-3.5-flash-lite")).toBe(true);
      expect(modelQuotaTracker.getStatus("gemini-3.5-flash-lite").inCooldown).toBe(false);
    } finally {
      (geminiService as any).ai = originalAi;
    }
  });

  it("12. Bounded retry on 503: Two consecutive 503 failures trigger cooldown and fail over to next candidate", async () => {
    const originalAi = (geminiService as any).ai;
    const callsPerModel: Record<string, number> = {};

    (geminiService as any).ai = {
      models: {
        generateContent: vi.fn().mockImplementation(async (payload: any) => {
          callsPerModel[payload.model] = (callsPerModel[payload.model] || 0) + 1;
          if (payload.model === "gemini-3-flash-preview") {
            const err: any = new Error("503 Service Unavailable");
            err.status = 503;
            throw err;
          }
          return { text: `Success from fallback model ${payload.model}` };
        }),
      },
    };

    try {
      const res = await geminiService.generateAnswer("Verify lubrication levels", {
        model: "gemini-3-flash-preview",
      });

      expect(res).toContain("Success from fallback model");
      // gemini-3-flash-preview was called twice (1 initial + 1 bounded retry)
      expect(callsPerModel["gemini-3-flash-preview"]).toBe(2);
      // gemini-3-flash-preview must now be in cooldown
      expect(modelQuotaTracker.isAvailable("gemini-3-flash-preview")).toBe(false);
      expect(modelQuotaTracker.getStatus("gemini-3-flash-preview").inCooldown).toBe(true);
      expect(modelQuotaTracker.getStatus("gemini-3-flash-preview").lastCategory).toBe("provider_outage");
    } finally {
      (geminiService as any).ai = originalAi;
    }
  });

  it("13. Fast-fail on 429: HTTP 429 quota exhaustion is never retried and fails over immediately", async () => {
    const originalAi = (geminiService as any).ai;
    const callsPerModel: Record<string, number> = {};

    (geminiService as any).ai = {
      models: {
        generateContent: vi.fn().mockImplementation(async (payload: any) => {
          callsPerModel[payload.model] = (callsPerModel[payload.model] || 0) + 1;
          if (payload.model === "gemini-3.8-flash") {
            const err: any = new Error("Resource exhausted: quota exceeded");
            err.status = 429;
            err.error = { code: 429, status: "RESOURCE_EXHAUSTED" };
            throw err;
          }
          return { text: `Success from fallback ${payload.model}` };
        }),
      },
    };

    try {
      const res = await geminiService.generateAnswer("Check emergency stop switch", {
        model: "gemini-3.8-flash",
      });

      expect(res).toContain("Success from fallback");
      // gemini-3.8-flash MUST only be called once: NEVER retried!
      expect(callsPerModel["gemini-3.8-flash"]).toBe(1);
      // Must be in active cooldown
      expect(modelQuotaTracker.isAvailable("gemini-3.8-flash")).toBe(false);
      expect(modelQuotaTracker.getStatus("gemini-3.8-flash").lastCategory).toBe("quota_exhausted");
    } finally {
      (geminiService as any).ai = originalAi;
    }
  });

  it("14. Provider retry-delay exceeding budget (>1s) skips retry and moves to next candidate", async () => {
    const originalAi = (geminiService as any).ai;
    const callsPerModel: Record<string, number> = {};

    (geminiService as any).ai = {
      models: {
        generateContent: vi.fn().mockImplementation(async (payload: any) => {
          callsPerModel[payload.model] = (callsPerModel[payload.model] || 0) + 1;
          if (payload.model === "gemini-3.6-flash") {
            const err: any = new Error("Service Unavailable");
            err.status = 503;
            err.error = {
              code: 503,
              details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "30s" }],
            };
            throw err;
          }
          return { text: `Success from next candidate ${payload.model}` };
        }),
      },
    };

    try {
      const res = await geminiService.generateAnswer("Check spindle alignment", {
        model: "gemini-3.6-flash",
      });

      expect(res).toContain("Success from next candidate");
      // Explicit retry delay of 30s exceeded bounded retry budget: called exactly ONCE without retry!
      expect(callsPerModel["gemini-3.6-flash"]).toBe(1);
      expect(modelQuotaTracker.isAvailable("gemini-3.6-flash")).toBe(false);
    } finally {
      (geminiService as any).ai = originalAi;
    }
  });

  it("15. Fractional provider retry-delay precision: '1.2s' is preserved and skips retry (> 1s budget)", async () => {
    // 1. Direct unit verification of analyzeProviderError parsing precision
    const parsed = analyzeProviderError({
      status: 503,
      error: {
        code: 503,
        details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "1.2s" }],
      },
    });
    expect(parsed.retryDelaySeconds).toBe(1.2);

    // 2. Runtime execution verification: 1.2s exceeds the 1s bounded budget, skipping retry
    const originalAi = (geminiService as any).ai;
    const callsPerModel: Record<string, number> = {};

    (geminiService as any).ai = {
      models: {
        generateContent: vi.fn().mockImplementation(async (payload: any) => {
          callsPerModel[payload.model] = (callsPerModel[payload.model] || 0) + 1;
          if (payload.model === "gemini-3.5-flash-lite") {
            const err: any = new Error("The service is temporarily overloaded.");
            err.status = 503;
            err.error = {
              code: 503,
              details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "1.2s" }],
            };
            throw err;
          }
          return { text: `Success from candidate ${payload.model}` };
        }),
      },
    };

    try {
      const res = await geminiService.generateAnswer("Verify pressure sensor calibration", {
        model: "gemini-3.5-flash-lite",
      });

      expect(res).toContain("Success from candidate");
      // Explicit fractional retry delay of 1.2s > 1s bounded budget: called only ONCE without retry!
      expect(callsPerModel["gemini-3.5-flash-lite"]).toBe(1);
      // Cooldown must be applied based on 1.2s (1200ms)
      expect(modelQuotaTracker.isAvailable("gemini-3.5-flash-lite")).toBe(false);
      const status = modelQuotaTracker.getStatus("gemini-3.5-flash-lite");
      expect(status.inCooldown).toBe(true);
      expect(status.remainingSeconds).toBeGreaterThanOrEqual(1);
      expect(status.remainingSeconds).toBeLessThanOrEqual(2);
    } finally {
      (geminiService as any).ai = originalAi;
    }
  });

  it("16. Model-unavailable 403 error containing 'temporarily unavailable' is NEVER retried", async () => {
    const originalAi = (geminiService as any).ai;
    const callsPerModel: Record<string, number> = {};

    (geminiService as any).ai = {
      models: {
        generateContent: vi.fn().mockImplementation(async (payload: any) => {
          callsPerModel[payload.model] = (callsPerModel[payload.model] || 0) + 1;
          if (payload.model === "gemini-3.8-flash") {
            // 403 Forbidden with text containing "temporarily unavailable"
            const err: any = new Error("The service is temporarily unavailable: permission denied for model gemini-3.8-flash");
            err.status = 403;
            throw err;
          }
          return { text: `Success from fallback ${payload.model}` };
        }),
      },
    };

    try {
      const res = await geminiService.generateAnswer("Check emergency hydraulic shutoff", {
        model: "gemini-3.8-flash",
      });

      expect(res).toContain("Success from fallback");
      // Must be called exactly ONCE: NOT retried despite "temporarily unavailable" phrasing!
      expect(callsPerModel["gemini-3.8-flash"]).toBe(1);
      expect(modelQuotaTracker.isAvailable("gemini-3.8-flash")).toBe(false);
      expect(modelQuotaTracker.getStatus("gemini-3.8-flash").lastCategory).toBe("model_unavailable");
    } finally {
      (geminiService as any).ai = originalAi;
    }
  });

  it("17. Model-unavailable 404 error containing 'service unavailable' is NEVER retried", async () => {
    const originalAi = (geminiService as any).ai;
    const callsPerModel: Record<string, number> = {};

    (geminiService as any).ai = {
      models: {
        generateContent: vi.fn().mockImplementation(async (payload: any) => {
          callsPerModel[payload.model] = (callsPerModel[payload.model] || 0) + 1;
          if (payload.model === "gemini-3.6-flash") {
            // 404 Not Found with text containing "service unavailable"
            const err: any = new Error("models/gemini-3.6-flash is not found or service unavailable");
            err.status = 404;
            throw err;
          }
          return { text: `Success from fallback ${payload.model}` };
        }),
      },
    };

    try {
      const res = await geminiService.generateAnswer("Check valve position", {
        model: "gemini-3.6-flash",
      });

      expect(res).toContain("Success from fallback");
      // Must be called exactly ONCE: NOT retried!
      expect(callsPerModel["gemini-3.6-flash"]).toBe(1);
      expect(modelQuotaTracker.isAvailable("gemini-3.6-flash")).toBe(false);
      expect(modelQuotaTracker.getStatus("gemini-3.6-flash").lastCategory).toBe("model_unavailable");
    } finally {
      (geminiService as any).ai = originalAi;
    }
  });
});
