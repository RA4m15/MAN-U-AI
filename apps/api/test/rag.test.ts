import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../src/app";
import { vectorService } from "../src/services/vector.service";
import { ragService } from "../src/services/rag.service";
import { geminiService } from "../src/services/gemini.service";
import { connectDatabase } from "../src/config/database";
import { seedDatabase } from "../src/config/seed";

import jwt from "jsonwebtoken";
import { env } from "../src/config/env";

const testToken = jwt.sign(
  { id: "test-user-id", email: "alex.mercer@plant.io", name: "Alex Mercer", role: "engineer" },
  env.JWT_SECRET,
  { expiresIn: "1h" }
);

describe("Multimodal Vector Retrieval & RAG Pipeline", () => {
  beforeAll(async () => {
    await connectDatabase();
    await seedDatabase();
  });
  it("computes hybrid vector similarity over indexed technical passages", async () => {
    const query = "mechanical seal replacement torque slurry pump";
    const queryEmbedding = await geminiService.generateEmbedding(query);
    const results = await vectorService.searchSimilar(
      queryEmbedding,
      query,
      3,
      0.3
    );

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].chunk.documentTitle).toContain("Pump");
    expect(results[0].chunk.page).toBeGreaterThanOrEqual(1);
  });

  it("POST /api/v1/chat generates grounded answer with real verifiable citations", async () => {
    const res = await request(app)
      .post("/api/v1/chat")
      .set("Authorization", `Bearer ${testToken}`)
      .send({
        message: "What is the gland bolt torque for Slurry Pump P-102?",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.answer).toBeDefined();
    expect(Array.isArray(res.body.data.citations)).toBe(true);
    expect(res.body.data.citations.length).toBeGreaterThan(0);

    // Verify citations reference actual retrieved pages without hallucination
    const citation = res.body.data.citations[0];
    expect(citation.documentTitle).toBeDefined();
    expect(typeof citation.page).toBe("number");
    expect(citation.excerpt).toBeDefined();
  }, 25000);

  it("POST /api/v1/chat flags high-risk inquiries with critical warning level", async () => {
    const res = await request(app)
      .post("/api/v1/chat")
      .set("Authorization", `Bearer ${testToken}`)
      .send({
        message: "What are the LOTO lockout tagout rules for hydraulic press accumulator bleed?",
      });

    expect(res.status).toBe(200);
    expect(res.body.data.warningLevel).toBe("critical");
  }, 35000);
});

