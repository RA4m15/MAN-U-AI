import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { app } from "../src/app";
import { env } from "../src/config/env";
import { pdfService } from "../src/services/pdf.service";
import { DocumentModel, DocumentChunk } from "../src/models";
import { connectDatabase, isConnectedToMongo } from "../src/config/database";

const engineerToken = jwt.sign(
  { id: "usr-eng-e2e", email: "alex.mercer@plant.io", name: "Alex Mercer", role: "engineer" },
  env.JWT_SECRET,
  { expiresIn: "1h" }
);

describe("Genuine Document-to-Answer & Private Persistence Test (Requirement 3, 5, 6)", () => {
  const pdfPath = path.resolve(__dirname, "../test_authorized_manual.pdf");
  let uploadedDocId: string;

  beforeAll(async () => {
    expect(fs.existsSync(pdfPath)).toBe(true);
    await connectDatabase();
  });

  afterAll(async () => {
    if (uploadedDocId && isConnectedToMongo) {
      await DocumentModel.findByIdAndDelete(uploadedDocId);
      await DocumentChunk.deleteMany({ documentId: uploadedDocId });
    }
  });

  it("Step 1: Extracts real text and 3 distinct pages from genuine binary PDF", async () => {
    const pdfBuffer = fs.readFileSync(pdfPath);
    const extraction = await pdfService.extractAndChunk(pdfBuffer, "Heavy Duty Slurry Pump Overhaul");

    expect(extraction.pageCount).toBe(3);
    expect(extraction.requiresOcr).toBe(false);
    expect(extraction.totalText).toContain("52 N·m");
    expect(extraction.totalText).toContain("0.04 mm");
    expect(extraction.chunks.length).toBeGreaterThanOrEqual(1);

    console.log("[E2E PDF Test] Extracted page count:", extraction.pageCount);
    console.log("[E2E PDF Test] Total text sample:", extraction.totalText.slice(0, 150) + "...");
  });

  it("Step 2: Uploads authorized PDF to /api/v1/documents/upload and saves privately", async () => {
    const res = await request(app)
      .post("/api/v1/documents/upload")
      .set("Authorization", `Bearer ${engineerToken}`)
      .attach("file", pdfPath)
      .field("title", "Heavy Duty Slurry Pump Overhaul Standard")
      .field("revision", "Rev 5.2")
      .field("tags", "Pumps,Overhaul,Torque Specs,Shaft Seals");

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();

    uploadedDocId = res.body.data.id;
    console.log("[E2E PDF Test] Document uploaded with ID:", uploadedDocId);

    // Wait for asynchronous ingestion and indexing pipeline to complete
    let attempts = 0;
    while (attempts < 30) {
      const statusRes = await request(app)
        .get(`/api/v1/documents/${uploadedDocId}/status`)
        .set("Authorization", `Bearer ${engineerToken}`);
      if (statusRes.body?.data?.status === "indexed") break;
      await new Promise((r) => setTimeout(r, 200));
      attempts++;
    }
  }, 15000);

  it("Step 3: Verifies indexed chunks and metadata in database", async () => {
    const statusRes = await request(app)
      .get(`/api/v1/documents/${uploadedDocId}/status`)
      .set("Authorization", `Bearer ${engineerToken}`);

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.success).toBe(true);

    const chunksRes = await request(app)
      .get(`/api/v1/documents/${uploadedDocId}/chunks`)
      .set("Authorization", `Bearer ${engineerToken}`);

    expect(chunksRes.status).toBe(200);
    expect(chunksRes.body.success).toBe(true);
    expect(Array.isArray(chunksRes.body.data)).toBe(true);
    expect(chunksRes.body.data.length).toBeGreaterThan(0);

    const overhaulChunk = chunksRes.body.data.find(
      (c: any) => c.text.includes("52 N·m") || c.text.includes("0.04 mm")
    );
    expect(overhaulChunk).toBeDefined();
    expect(overhaulChunk.page).toBe(2);
    expect(overhaulChunk.text).toContain("four M12 gland retaining studs must be torqued to exactly 52 N·m");
    console.log("[E2E PDF Test] Indexed passage verified on Page", overhaulChunk.page);
    console.log("  Passage:", overhaulChunk.text.slice(0, 140) + "...");
  });

  it("Step 4: Executes grounded RAG retrieval and citation matching for authorized PDF", async () => {
    // Query 1: Gland retaining studs & runout on Page 2
    const res = await request(app)
      .post("/api/v1/chat")
      .set("Authorization", `Bearer ${engineerToken}`)
      .send({
        message: "What is the gland stud torque rating and permissible shaft runout in the Slurry Pump Overhaul Standard?",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.answer).toBeDefined();

    const citations = res.body.data.citations;
    expect(citations.length).toBeGreaterThan(0);

    const matchingCite = citations.find(
      (c: any) =>
        c.excerpt.toLowerCase().includes("52 n·m") ||
        c.excerpt.includes("0.04 mm") ||
        c.documentTitle.includes("Overhaul")
    );
    expect(matchingCite).toBeDefined();
    expect(matchingCite.page).toBe(2);
    expect(matchingCite.documentTitle).toContain("Overhaul");

    console.log("[E2E PDF Test] Verified Page 2 Citation Match in Answer:");
    console.log("  - Source Document:", matchingCite.documentTitle);
    console.log("  - Cited Page:", matchingCite.page);
    console.log("  - Citation Excerpt:", matchingCite.excerpt);

    // Query 2: Isolation protocol on Page 1
    const resIsolation = await request(app)
      .post("/api/v1/chat")
      .set("Authorization", `Bearer ${engineerToken}`)
      .send({
        message: "What is the general safety and mechanical isolation protocol for uncoupling the casing?",
      });

    expect(resIsolation.status).toBe(200);
    console.log("[E2E PDF Test] Isolation Query Citations:", resIsolation.body.data.citations);
    const citeIsolation = resIsolation.body.data.citations.find(
      (c: any) => c.excerpt.includes("MCB-104") || c.excerpt.includes("0 kPa") || c.page === 1
    );
    expect(citeIsolation).toBeDefined();
    expect(citeIsolation.page).toBe(1);
    console.log("[E2E PDF Test] Verified Page 1 Isolation Citation Match:");
    console.log("  - Source Document:", citeIsolation.documentTitle);
    console.log("  - Cited Page:", citeIsolation.page);
    console.log("  - Citation Excerpt:", citeIsolation.excerpt);
  }, 60000);

  it("Step 5 (Requirement 5): Unsupported out-of-scope question returns insufficient-evidence protocol", async () => {
    const res = await request(app)
      .post("/api/v1/chat")
      .set("Authorization", `Bearer ${engineerToken}`)
      .send({
        message: "What is the warp drive antimatter core injection temperature for the starship Enterprise?",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.citations.length).toBe(0);

    const answer = res.body.data.answer.toLowerCase();
    expect(
      answer.includes("could not locate") ||
        answer.includes("insufficient") ||
        answer.includes("not found")
    ).toBe(true);
  });

  it("Step 6 (Requirement 6): Unauthenticated users cannot download private file contents", async () => {
    const res = await request(app).get(`/api/v1/documents/${uploadedDocId}/file`);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("Step 7 (Requirement 6): Authorized users stream genuine original PDF binary from private storage", async () => {
    const res = await request(app)
      .get(`/api/v1/documents/${uploadedDocId}/file`)
      .set("Authorization", `Bearer ${engineerToken}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("pdf");
    expect(res.body.length).toBeGreaterThan(100);
  });
});
