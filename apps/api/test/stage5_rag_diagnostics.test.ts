import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { app } from "../src/app";
import { env } from "../src/config/env";
import { connectDatabase } from "../src/config/database";
import { geminiService } from "../src/services/gemini.service";
import { ragService } from "../src/services/rag.service";
import { vectorService } from "../src/services/vector.service";
import { DocumentModel, DocumentChunk, User, DocumentPermission } from "../src/models";

describe("Stage 5.5b: Multimodal RAG Pipeline Diagnostics & Model Failover", () => {
  let engineerToken: string;
  const engineerUser = {
    id: "usr-eng-55555555555555555555",
    email: "lead.engineer@plant.io",
    role: "engineer",
  };

  beforeAll(async () => {
    await connectDatabase();
    engineerToken = jwt.sign(
      { id: engineerUser.id, email: engineerUser.email, role: engineerUser.role },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("1. Model failover: when primary model fails with 429, fails over to next supported model and succeeds", async () => {
    const originalAi = (geminiService as any).ai;
    let callCount = 0;
    const attemptedModels: string[] = [];

    (geminiService as any).ai = {
      models: {
        generateContent: vi.fn().mockImplementation(async (payload: any) => {
          callCount++;
          attemptedModels.push(payload.model);
          if (payload.model === "gemini-3.8-flash") {
            const err: any = new Error("You exceeded your current quota, please check your plan and billing");
            err.status = 429;
            throw err;
          }
          return { text: "Lathe machine components include the bed, headstock, tailstock, and carriage." };
        }),
      },
    };

    try {
      const answer = await geminiService.generateAnswer("What are the components of lathe machine?", {
        model: "gemini-3.8-flash",
      });

      expect(answer).toContain("Lathe machine components include the bed");
      expect(attemptedModels[0]).toBe("gemini-3.8-flash");
      expect(attemptedModels).toContain("gemini-3.6-flash");
      expect(callCount).toBeGreaterThanOrEqual(2);
      expect(geminiService.getLastProvider()).toBe("live-gemini");
    } finally {
      (geminiService as any).ai = originalAi;
    }
  });

  it("2. When all candidate models fail in production, throws LLM_PROVIDER_ERROR (503)", async () => {
    const originalAi = (geminiService as any).ai;
    const originalNodeEnv = env.NODE_ENV;
    (env as any).NODE_ENV = "production";

    (geminiService as any).ai = {
      models: {
        generateContent: vi.fn().mockRejectedValue(new Error("Resource has been exhausted (e.g. check quota)")),
      },
    };

    try {
      await expect(
        geminiService.generateAnswer("Explain lathe tailstock alignment")
      ).rejects.toThrow("AI generation service is currently unavailable");
    } finally {
      (geminiService as any).ai = originalAi;
      (env as any).NODE_ENV = originalNodeEnv;
    }
  });

  it("3. POST /api/v1/chat returns structured error with correlation ID and stage on model failure", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const originalNodeEnv = env.NODE_ENV;
    (env as any).NODE_ENV = "production";

    vi.spyOn(vectorService, "searchSimilar").mockResolvedValueOnce([
      {
        chunk: {
          id: "chk-lathe",
          documentId: new mongoose.Types.ObjectId().toString(),
          documentTitle: "Lathe Manual",
          revision: "v1.0",
          page: 1,
          section: "Overview",
          text: "Lathe bed and headstock assembly.",
        },
        score: 0.9,
      },
    ]);
    const generateSpy = vi.spyOn(geminiService, "generateAnswer").mockImplementation(async () => {
      const err: any = new Error("All candidate Gemini models exhausted (upstream quota limit)");
      err.code = "LLM_PROVIDER_ERROR";
      err.httpStatus = 503;
      err.stage = "model_generation";
      throw err;
    });

    try {
      const res = await request(app)
        .post("/api/v1/chat")
        .set("Authorization", `Bearer ${engineerToken}`)
        .send({
          message: "What are the components of lathe machine?",
        });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("LLM_PROVIDER_ERROR");
      expect(res.body.error.message).toBe("Error running multimodal RAG pipeline");
      expect(res.body.error.stage).toBe("model_generation");
      expect(res.body.error.requestId).toBeDefined();
      expect(res.body.error.details).not.toContain("[object Object]");
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      (env as any).NODE_ENV = originalNodeEnv;
    }
  });

  it("4. POST /api/v1/chat handles empty retrieval results safely with grounded caution message", async () => {
    const searchSpy = vi.spyOn(vectorService, "searchSimilar").mockResolvedValueOnce([]);

    const res = await request(app)
      .post("/api/v1/chat")
      .set("Authorization", `Bearer ${engineerToken}`)
      .send({
        message: "What is the warp drive antimatter core temperature?",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.answer).toContain("I could not locate sufficient verified documentation");
    expect(res.body.data.citations).toEqual([]);
    expect(res.body.data.confidenceScore).toBe(0.1);
  });

  it("5. Vector search accurately queries chunks using string document IDs converted to ObjectIds", async () => {
    const dummyId = new mongoose.Types.ObjectId();
    const findSpy = vi.spyOn(DocumentChunk, "find").mockReturnValueOnce({
      limit: vi.fn().mockReturnValueOnce({
        lean: vi.fn().mockResolvedValueOnce([
          {
            _id: new mongoose.Types.ObjectId(),
            documentId: dummyId,
            documentTitle: "Lathe Machine Standard Operation",
            revision: "Rev 2.0",
            page: 4,
            section: "Headstock Transmission",
            text: "The headstock houses the main spindle, chuck, and speed selector gear train.",
            embedding: new Array(768).fill(0.036),
          },
        ]),
      }),
    } as any);

    const queryEmbedding = new Array(768).fill(0.036);
    const results = await vectorService.searchSimilar(
      queryEmbedding,
      "lathe spindle chuck",
      5,
      0.3,
      [dummyId.toString()]
    );

    expect(findSpy).toHaveBeenCalled();
    const filterUsed = findSpy.mock.calls[0][0];
    expect(filterUsed.documentId.$in[0]).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(results.length).toBe(1);
    expect(results[0].chunk.documentTitle).toBe("Lathe Machine Standard Operation");
    expect(results[0].chunk.page).toBe(4);
  });

  it("6. Multimodal OCR transcribes PDF with automatic candidate model failover", async () => {
    const originalAi = (geminiService as any).ai;
    let ocrCallCount = 0;

    (geminiService as any).ai = {
      models: {
        generateContent: vi.fn().mockImplementation(async (payload: any) => {
          ocrCallCount++;
          if (payload.model === "gemini-3.8-flash") {
            throw new Error("Quota exceeded for model gemini-3.8-flash");
          }
          return { text: "--- PAGE 1 ---\nLathe Machine Overhaul Standard" };
        }),
      },
    };

    try {
      const dummyBuffer = Buffer.from("%PDF-1.7 dummy pdf stream for ocr test");
      const transcribed = await geminiService.transcribePdfWithOcr(dummyBuffer, "gemini-3.8-flash");

      expect(transcribed).toContain("Lathe Machine Overhaul Standard");
      expect(ocrCallCount).toBeGreaterThanOrEqual(2);
    } finally {
      (geminiService as any).ai = originalAi;
    }
  });

  it("7. POST /api/v1/chat rejects empty or whitespace messages with 400 BAD_REQUEST", async () => {
    const res = await request(app)
      .post("/api/v1/chat")
      .set("Authorization", `Bearer ${engineerToken}`)
      .send({
        message: "    ",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("BAD_REQUEST");
  });

  it("8. Successful question answering returns grounded citations strictly from retrieved chunks", async () => {
    const dummyDocId = new mongoose.Types.ObjectId().toString();
    const fakeChunk = {
      chunk: {
        id: "chk-lathe-01",
        documentId: dummyDocId,
        documentTitle: "Engine Lathe Maintenance Manual",
        revision: "Rev 3.0",
        page: 7,
        section: "Main Components & Assemblies",
        text: "The main components of the engine lathe include the bed, headstock, tailstock, carriage, and lead screw.",
      },
      score: 0.92,
    };

    vi.spyOn(geminiService, "generateEmbedding").mockResolvedValueOnce(new Array(768).fill(0.01));
    vi.spyOn(vectorService, "searchSimilar").mockResolvedValueOnce([fakeChunk]);
    vi.spyOn(geminiService, "generateAnswer").mockResolvedValueOnce(
      "The main components of the lathe machine are the bed, headstock, tailstock, carriage, and lead screw per Page 7 of the manual."
    );

    const res = await request(app)
      .post("/api/v1/chat")
      .set("Authorization", `Bearer ${engineerToken}`)
      .send({
        message: "What are the components of lathe machine?",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.answer).toContain("main components of the lathe machine are the bed");
    expect(res.body.data.citations.length).toBe(1);
    expect(res.body.data.citations[0].documentTitle).toBe("Engine Lathe Maintenance Manual");
    expect(res.body.data.citations[0].page).toBe(7);
    expect(res.body.data.citations[0].section).toBe("Main Components & Assemblies");
  });
});
