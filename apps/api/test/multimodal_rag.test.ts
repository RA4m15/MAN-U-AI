import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { app } from "../src/app";
import { env } from "../src/config/env";
import { connectDatabase, isConnectedToMongo } from "../src/config/database";
import { seedDatabase } from "../src/config/seed";
import { Readable } from "stream";
import { geminiService } from "../src/services/gemini.service";
import { ragService, streamToBuffer, detectSupportedImageMimeType } from "../src/services/rag.service";
import { storageService } from "../src/services/storage.service";
import {
  DocumentModel,
  DocumentChunk,
  DocumentFigure,
  DocumentPermission,
  User,
} from "../src/models";

const MINIMAL_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxD/2Q==",
  "base64"
);

describe("Task 4: Production-Ready Multimodal RAG and Figure-Aware Answers Suite", () => {
  let engineerToken: string;
  let viewerToken: string;
  const engineerUser = {
    id: "6ad8e4010000000000000001",
    email: "lead.engineer@industrial-rag.com",
    role: "engineer",
  };
  const viewerUser = {
    id: "6ad8e4020000000000000002",
    email: "contractor.viewer@plant.io",
    role: "viewer",
  };

  let authorizedDocId: mongoose.Types.ObjectId;
  let restrictedDocId: mongoose.Types.ObjectId;
  let authorizedChunkId: string;
  let figCouplingId: string;
  let figIrrelevantId: string;
  let figRestrictedId: string;

  const couplingEmbedding = new Array(768).fill(0);
  couplingEmbedding[0] = 1;

  const lubricantEmbedding = new Array(768).fill(0);
  lubricantEmbedding[1] = 1;

  const restrictedEmbedding = new Array(768).fill(0);
  restrictedEmbedding[2] = 1;

  beforeAll(async () => {
    await connectDatabase();
    await seedDatabase();

    if (isConnectedToMongo) {
      await User.deleteMany({ email: { $in: [engineerUser.email, viewerUser.email] } });
      await User.create([
        {
          _id: new mongoose.Types.ObjectId(engineerUser.id),
          name: "Lead Engineer",
          email: engineerUser.email,
          passwordHash: "mockHashedPassword123",
          role: engineerUser.role,
          isActive: true,
        },
        {
          _id: new mongoose.Types.ObjectId(viewerUser.id),
          name: "Contractor Viewer",
          email: viewerUser.email,
          passwordHash: "mockHashedPassword123",
          role: viewerUser.role,
          isActive: true,
        },
      ]);
      await DocumentModel.deleteMany({ title: { $regex: /SP-400X|BFP-400|Proprietary Plant Turbine/i } });
      await DocumentChunk.deleteMany({ documentTitle: { $regex: /SP-400X|BFP-400|Proprietary Plant Turbine/i } });
      await DocumentFigure.deleteMany({ documentTitle: { $regex: /SP-400X|BFP-400|Proprietary Plant Turbine/i } });
    }

    engineerToken = jwt.sign(
      { id: engineerUser.id, email: engineerUser.email, role: engineerUser.role },
      env.JWT_SECRET,
      { expiresIn: "2h" }
    );
    viewerToken = jwt.sign(
      { id: viewerUser.id, email: viewerUser.email, role: viewerUser.role },
      env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    // 1. Authorized Technical Document (accessible strictly by engineerUser)
    authorizedDocId = new mongoose.Types.ObjectId();
    await DocumentModel.create({
      _id: authorizedDocId,
      title: "Centrifugal Slurry Pump Model SP-400X Rebuild Manual",
      revision: "Rev 2.0",
      filename: "sp400x_rebuild.pdf",
      storagePath: "sp400x_rebuild.pdf",
      storageProvider: "local",
      mimeType: "application/pdf",
      sizeBytes: 4096,
      status: "indexed",
      uploadedById: new mongoose.Types.ObjectId(engineerUser.id),
    });

    // Explicit read permission strictly for engineerUser to prevent leaking to other test suites
    await DocumentPermission.create({
      documentId: authorizedDocId,
      userId: new mongoose.Types.ObjectId(engineerUser.id),
      canRead: true,
      canWrite: true,
    });

    // Chunk on Page 10 discussing dial indicator and coupling alignment (Figure 3.1)
    const chk1 = await DocumentChunk.create({
      documentId: authorizedDocId,
      documentTitle: "Centrifugal Slurry Pump Model SP-400X Rebuild Manual",
      revision: "Rev 2.0",
      page: 10,
      section: "Section 3: SP-400X Flexible Coupling Dial Indicator Alignment",
      text: "Coupling shaft alignment procedure on SP-400X requires rim-and-face dial indicator measurement per Figure 3.1. Maximum allowable radial angular misalignment is 0.05 mm. Tighten anchor bolts to 85 N·m in cross pattern. Warning: Follow lockout tagout (LOTO) procedures on 480V supply prior to removing coupling guard.",
      embedding: couplingEmbedding,
      figureIds: ["Figure 3.1"],
    });
    authorizedChunkId = chk1._id.toString();

    // Chunk on Page 20 discussing routine lubricant schedule (no figures)
    await DocumentChunk.create({
      documentId: authorizedDocId,
      documentTitle: "Centrifugal Slurry Pump Model SP-400X Rebuild Manual",
      revision: "Rev 2.0",
      page: 20,
      section: "Section 8: Lubrication Specifications",
      text: "Use ISO VG 46 synthetic turbine oil for SP-400X. Drain and flush bearing reservoir every 4000 operational hours or semi-annually. Check sight glass daily.",
      embedding: lubricantEmbedding,
      figureIds: [],
    });

    // Genuine Relevant Figure on Page 10 (Flexible Coupling Schematic)
    const savedFigAsset = await storageService.saveFile("fig_3_1_sp400x.jpg", MINIMAL_JPEG);
    const fig1 = await DocumentFigure.create({
      documentId: authorizedDocId,
      documentTitle: "Centrifugal Slurry Pump Model SP-400X Rebuild Manual",
      revision: "Rev 2.0",
      page: 10,
      figureId: "Figure 3.1",
      title: "SP-400X Flexible Coupling Rim-and-Face Dial Indicator Setup",
      caption: "Figure 3.1: Dial Indicator Bracket and Angular Alignment Setup",
      storagePath: savedFigAsset.storagePath,
      storageProvider: "local",
      mimeType: "image/jpeg",
      sizeBytes: savedFigAsset.sizeBytes,
      dimensions: { width: 640, height: 480 },
      status: "extracted",
      associatedChunkIds: [authorizedChunkId],
    });
    figCouplingId = fig1._id.toString();

    // Irrelevant Figure on Page 50 of the same document (Electrical Conduit Diagram - unrelated to coupling)
    const savedFigIrrelevant = await storageService.saveFile("fig_irrelevant_sp400x.jpg", MINIMAL_JPEG);
    const fig2 = await DocumentFigure.create({
      documentId: authorizedDocId,
      documentTitle: "Centrifugal Slurry Pump Model SP-400X Rebuild Manual",
      revision: "Rev 2.0",
      page: 50,
      figureId: "Figure 9.4",
      title: "Terminal Junction Box Wiring Schematics",
      caption: "Figure 9.4: 3-Phase Auxiliary Junction Box Wiring",
      storagePath: savedFigIrrelevant.storagePath,
      storageProvider: "local",
      mimeType: "image/jpeg",
      sizeBytes: savedFigIrrelevant.sizeBytes,
      dimensions: { width: 400, height: 300 },
      status: "extracted",
      associatedChunkIds: [],
    });
    figIrrelevantId = fig2._id.toString();

    // 2. Restricted Document (Confidential only - viewer has NO permission)
    restrictedDocId = new mongoose.Types.ObjectId();
    await DocumentModel.create({
      _id: restrictedDocId,
      title: "Proprietary Plant Turbine Assembly Blueprints [RESTRICTED]",
      revision: "Rev 9.9",
      filename: "restricted_turbine.pdf",
      storagePath: "restricted_turbine.pdf",
      storageProvider: "local",
      mimeType: "application/pdf",
      sizeBytes: 8192,
      status: "indexed",
      uploadedById: new mongoose.Types.ObjectId(),
    });

    await DocumentChunk.create({
      documentId: restrictedDocId,
      documentTitle: "Proprietary Plant Turbine Assembly Blueprints [RESTRICTED]",
      revision: "Rev 9.9",
      page: 3,
      section: "Confidential Rotor Blade Geometry",
      text: "Confidential turbine rotor blade pitch angle is 28.5 degrees. Secret proprietary assembly drawing in Figure Confidential-1.",
      embedding: new Array(768).fill(0.08),
      figureIds: ["Figure Confidential-1"],
    });

    const savedFigRestricted = await storageService.saveFile("fig_confidential.jpg", MINIMAL_JPEG);
    const fig3 = await DocumentFigure.create({
      documentId: restrictedDocId,
      documentTitle: "Proprietary Plant Turbine Assembly Blueprints [RESTRICTED]",
      revision: "Rev 9.9",
      page: 3,
      figureId: "Figure Confidential-1",
      title: "Proprietary Blade Geometry Drawing",
      caption: "Classified turbine design",
      storagePath: savedFigRestricted.storagePath,
      storageProvider: "local",
      mimeType: "image/jpeg",
      sizeBytes: savedFigRestricted.sizeBytes,
      dimensions: { width: 800, height: 600 },
      status: "extracted",
      associatedChunkIds: [],
    });
    figRestrictedId = fig3._id.toString();
  });

  afterAll(async () => {
    if (isConnectedToMongo) {
      await DocumentModel.deleteMany({ _id: { $in: [authorizedDocId, restrictedDocId] } });
      await DocumentChunk.deleteMany({ documentId: { $in: [authorizedDocId, restrictedDocId] } });
      await DocumentFigure.deleteMany({ documentId: { $in: [authorizedDocId, restrictedDocId] } });
      await DocumentPermission.deleteMany({ documentId: { $in: [authorizedDocId, restrictedDocId] } });
      await User.deleteMany({ email: { $in: [engineerUser.email, viewerUser.email] } });
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. Multimodal Retrieval & Evidence Association ─────────────────────────
  it("Requirement 1: Relevant figures are selected, associated with correct evidence chunks, and passed to LLM", async () => {
    let capturedOptions: any = null;
    let capturedPrompt = "";

    vi.spyOn(geminiService, "generateEmbedding").mockResolvedValue(couplingEmbedding);
    vi.spyOn(geminiService, "generateAnswer").mockImplementation(async (prompt: string, options?: any) => {
      capturedPrompt = prompt;
      capturedOptions = options;
      return "Direct Visual Observation from [Figure 3.1]: The dial indicator bracket is clamped to the pump hub. Procedural Guidance from Manual Text: Maximum allowable radial angular misalignment is 0.05 mm.";
    });

    const res = await ragService.answerQuestion(
      "How do I set up the dial indicator for SP-400X coupling alignment according to the schematic diagram?",
      engineerUser
    );

    // 1. Verify answer and citations
    expect(res.answer).toBeDefined();
    expect(res.citations.length).toBeGreaterThan(0);

    // 2. Verify Figure 3.1 was attached to the citation for Page 10 of SP-400X
    const page10Cite = res.citations.find((c) => c.documentId === authorizedDocId.toString() && c.page === 10);
    expect(page10Cite).toBeDefined();
    expect(page10Cite?.figures).toBeDefined();
    expect(page10Cite?.figures?.length).toBe(1);
    expect(page10Cite?.figures?.[0].figureId).toBe("Figure 3.1");
    expect(page10Cite?.figures?.[0].title).toBe("SP-400X Flexible Coupling Rim-and-Face Dial Indicator Setup");
    expect(page10Cite?.figures?.[0].dimensions?.width).toBe(640);

    // 3. Verify visualParts passed to generateAnswer
    expect(capturedOptions?.images).toBeDefined();
    expect(capturedOptions.images.length).toBe(1);
    expect(capturedOptions.images[0].figureId).toBe("Figure 3.1");
    expect(Buffer.isBuffer(capturedOptions.images[0].data)).toBe(true);
    expect(capturedOptions.images[0].mimeType).toBe("image/jpeg");

    // 4. Verify prompt contains authentic figure metadata
    expect(capturedPrompt).toContain("ATTACHED TECHNICAL FIGURES & SCHEMATICS");
    expect(capturedPrompt).toContain("Figure ID: \"Figure 3.1\"");
    expect(capturedPrompt).toContain("SP-400X Flexible Coupling Rim-and-Face Dial Indicator Setup");
    expect(capturedPrompt).toContain("640x480 px");
  });

  // ── 2. Irrelevant Figures Excluded ─────────────────────────────────────────
  it("Requirement 2: Irrelevant figures on different pages/topics are not attached to answers or citations", async () => {
    let capturedOptions: any = null;

    vi.spyOn(geminiService, "generateEmbedding").mockResolvedValue(couplingEmbedding);
    vi.spyOn(geminiService, "generateAnswer").mockImplementation(async (prompt: string, options?: any) => {
      capturedOptions = options;
      return "Coupling alignment instructions per manual.";
    });

    const res = await ragService.answerQuestion(
      "How do I align the SP-400X coupling?",
      engineerUser
    );

    // Figure 9.4 is on Page 50 (electrical conduit), completely irrelevant to coupling on Page 10
    const sp400xCitations = res.citations.filter((c) => c.documentId === authorizedDocId.toString());
    const allFiguresInCitations = sp400xCitations.flatMap((c) => c.figures || []);
    const irrelevantFig = allFiguresInCitations.find((f) => f.figureId === "Figure 9.4");
    expect(irrelevantFig).toBeUndefined();

    // Verify it was not passed in multimodal images either
    if (capturedOptions?.images) {
      const hasIrrelevantImage = capturedOptions.images.some((img: any) => img.figureId === "Figure 9.4");
      expect(hasIrrelevantImage).toBe(false);
    }
  });

  // ── 3. Authorization & Permissions Strictly Enforced ──────────────────────
  it("Requirement 3: Unauthorized documents and their figures cannot leak into retrieval or citations", async () => {
    vi.spyOn(geminiService, "generateEmbedding").mockResolvedValue(restrictedEmbedding);
    vi.spyOn(geminiService, "generateAnswer").mockResolvedValue("General documentation answer.");

    // Viewer user has NO access to restricted turbine document
    const res = await ragService.answerQuestion(
      "What is the confidential rotor blade pitch angle and blade geometry diagram?",
      viewerUser
    );

    // Citations must NEVER contain restricted document
    const restrictedCite = res.citations.find((c) => c.documentId === restrictedDocId.toString());
    expect(restrictedCite).toBeUndefined();

    // Citations must NEVER contain restricted figure
    const allFigures = res.citations.flatMap((c) => c.figures || []);
    const restrictedFig = allFigures.find((f) => f.figureId === "Figure Confidential-1");
    expect(restrictedFig).toBeUndefined();
  });

  // ── 4. Genuine Figure Metadata & Dimensions ────────────────────────────────
  it("Requirement 4: Figure metadata and source references in citations point to genuine DB records", async () => {
    vi.spyOn(geminiService, "generateEmbedding").mockResolvedValue(couplingEmbedding);
    vi.spyOn(geminiService, "generateAnswer").mockResolvedValue("Alignment guidance.");

    const res = await ragService.answerQuestion(
      "SP-400X dial indicator setup diagram",
      engineerUser
    );

    const citeWithFigure = res.citations.find(
      (c) => c.documentId === authorizedDocId.toString() && c.figures && c.figures.length > 0
    );
    expect(citeWithFigure).toBeDefined();

    const fig = citeWithFigure!.figures![0];
    expect(fig.id).toBe(figCouplingId);
    expect(fig.documentId).toBe(authorizedDocId.toString());
    expect(fig.documentTitle).toBe("Centrifugal Slurry Pump Model SP-400X Rebuild Manual");
    expect(fig.page).toBe(10);
    expect(fig.figureId).toBe("Figure 3.1");
    expect(fig.status).toBe("extracted");
    expect(fig.dimensions).toEqual({ width: 640, height: 480 });
    expect(fig.storageProvider).toBe("local");
  });

  // ── 5. Safe Fallback on Image Stream / Storage Failure ─────────────────────
  it("Requirement 5: Image storage/streaming failure falls back safely without crashing or dropping text RAG", async () => {
    let capturedOptions: any = null;

    vi.spyOn(geminiService, "generateEmbedding").mockResolvedValue(couplingEmbedding);
    vi.spyOn(geminiService, "generateAnswer").mockImplementation(async (prompt: string, options?: any) => {
      capturedOptions = options;
      return "Based on manual text on Page 10, align dial indicator to 0.05 mm.";
    });

    // Mock storageService.getFileStream to simulate missing file / disk error
    vi.spyOn(storageService, "getFileStream").mockRejectedValue(new Error("EIO: i/o error on sector 8841"));

    const res = await ragService.answerQuestion(
      "Show me SP-400X coupling dial indicator schematic",
      engineerUser
    );

    // Pipeline should succeed gracefully without throwing
    expect(res.answer).toBeDefined();
    expect(res.citations.length).toBeGreaterThan(0);

    // Images payload to LLM was safely omitted because stream failed
    expect(capturedOptions?.images).toBeUndefined();

    // Authentic figure citation is still preserved so user can see source reference
    const page10Cite = res.citations.find(
      (c) => c.documentId === authorizedDocId.toString() && c.page === 10
    );
    expect(page10Cite?.figures?.[0].figureId).toBe("Figure 3.1");
  });

  // ── 6. Text-Only RAG Unaffected When No Figures Available ─────────────────
  it("Requirement 6: Text-only questions without figures continue to work without visual overhead", async () => {
    let capturedOptions: any = null;
    let capturedPrompt = "";

    vi.spyOn(geminiService, "generateEmbedding").mockResolvedValue(lubricantEmbedding);
    vi.spyOn(geminiService, "generateAnswer").mockImplementation(async (prompt: string, options?: any) => {
      capturedPrompt = prompt;
      capturedOptions = options;
      return "Use ISO VG 46 synthetic turbine oil. Drain every 4000 operational hours.";
    });

    const res = await ragService.answerQuestion(
      "What type of lubricant is specified for SP-400X bearing reservoir?",
      engineerUser
    );

    expect(res.answer).toBeDefined();
    expect(capturedOptions?.images).toBeUndefined();
    expect(capturedPrompt).not.toContain("ATTACHED TECHNICAL FIGURES & SCHEMATICS");

    // Citations exist for the lubrication section, but have no figures attached
    expect(res.citations.length).toBeGreaterThan(0);
    const cite = res.citations.find((c) => c.documentId === authorizedDocId.toString() && c.page === 20);
    expect(cite).toBeDefined();
    expect(cite?.figures).toBeUndefined();
  });

  // ── 7. Offline / Fallback Mode Does Not Fabricate Visual Claims ────────────
  it("Requirement 7: Deterministic fallback reports figure references honestly and forbids fabricated visual findings", async () => {
    vi.spyOn(geminiService, "generateEmbedding").mockResolvedValue(couplingEmbedding);
    // Simulate LLM service unavailability to trigger deterministic fallback
    vi.spyOn(geminiService, "generateAnswer").mockRejectedValue(new Error("Gemini API connection timeout (504 Gateway)"));

    const res = await ragService.answerQuestion(
      "Show me the SP-400X coupling alignment diagram",
      engineerUser
    );

    expect(res.answer).toContain("[NOTICE: AI Generative Service Unavailable — Grounded Documentation Mode]");
    // Must honestly state visual generative analysis is unavailable
    expect(res.answer).toContain("Associated Technical Figures (Manual Page Reference)");
    expect(res.answer).toContain("Figure 3.1");
    expect(res.answer).toContain("Generative visual analysis unavailable in offline fallback mode");
    // Citations are preserved
    expect(res.citations.length).toBeGreaterThan(0);
    const cite = res.citations.find((c) => c.documentId === authorizedDocId.toString());
    expect(cite?.figures?.[0].figureId).toBe("Figure 3.1");
  });

  // ── 8. Strict Multimodal Grounding Directives in Prompt ────────────────────
  it("Requirement 8: Prompt mandates strict visual grounding, distinguishing direct visual observations from manual text", async () => {
    let capturedPrompt = "";

    vi.spyOn(geminiService, "generateEmbedding").mockResolvedValue(couplingEmbedding);
    vi.spyOn(geminiService, "generateAnswer").mockImplementation(async (prompt: string) => {
      capturedPrompt = prompt;
      return "Grounding response.";
    });

    await ragService.answerQuestion(
      "Explain the SP-400X dial indicator setup diagram",
      engineerUser
    );

    // Verify Rule 6 in prompt
    expect(capturedPrompt).toContain("6. Multimodal & Figure-Aware Grounding (Strict Rules):");
    expect(capturedPrompt).toContain("Ground visual observations ONLY in what is directly legible and visible in the attached figures.");
    expect(capturedPrompt).toContain("Direct Visual Observation from [Figure ID]");
    expect(capturedPrompt).toContain("Procedural Guidance from Manual Text");
    expect(capturedPrompt).toContain("ZERO FABRICATION: NEVER hallucinate, guess, or invent component labels, terminal/pin numbers, wire colors");
    expect(capturedPrompt).toContain("If an image is unreadable, blurry, or lacks a specific requested detail, explicitly state that the detail is not legible");
  });

  // ── 9. Safety & Interlocks Preserved in Multimodal Troubleshooting ──────────
  it("Requirement 9: Preserves critical safety severity warnings and LOTO mandates when figures are present", async () => {
    vi.spyOn(geminiService, "generateEmbedding").mockResolvedValue(couplingEmbedding);
    vi.spyOn(geminiService, "generateAnswer").mockResolvedValue("Safety first. Perform LOTO.");

    // Query mentions 480V energy isolation and coupling guard removal
    const res = await ragService.answerQuestion(
      "How do I remove the coupling guard and inspect the alignment dial indicator on the 480V motor for SP-400X?",
      engineerUser
    );

    // High voltage and LOTO trigger critical warning
    expect(res.warningLevel).toBe("critical");
    expect(res.citations.length).toBeGreaterThan(0);
    const cite = res.citations.find((c) => c.documentId === authorizedDocId.toString());
    expect(cite?.figures).toBeDefined();
  });

  // ── 10. Document Figure Image Endpoint Authorization & Streaming ───────────
  it("Requirement 10: Figure image streaming endpoint enforces authorization and valid extracted status", async () => {
    // 10a. 401 when unauthorized
    const unauthRes = await request(app).get(
      `/api/v1/documents/${authorizedDocId}/figures/${figCouplingId}/image`
    );
    expect(unauthRes.status).toBe(401);

    // 10b. 403 when user is not authorized for document
    const forbiddenRes = await request(app)
      .get(`/api/v1/documents/${restrictedDocId}/figures/${figRestrictedId}/image`)
      .set("Authorization", `Bearer ${viewerToken}`);
    expect(forbiddenRes.status).toBe(403);

    // 10c. 200 with proper Content-Type when authorized engineer accesses genuine extracted figure
    const successRes = await request(app)
      .get(`/api/v1/documents/${authorizedDocId}/figures/${figCouplingId}/image`)
      .set("Authorization", `Bearer ${engineerToken}`);
    expect(successRes.status).toBe(200);
    expect(successRes.headers["content-type"]).toContain("image/jpeg");
    expect(successRes.body).toBeInstanceOf(Buffer);
    expect(successRes.body.length).toBeGreaterThan(0);
  });

  // ── 11. Incremental streamToBuffer Resource Cleanup ─────────────────────────
  it("Requirement 11: streamToBuffer enforces maxBytes incrementally and destroys stream on breach", async () => {
    let destroyed = false;
    let chunksEmitted = 0;

    const mockStream = new Readable({
      read() {
        chunksEmitted++;
        // Emit 1MB chunks
        this.push(Buffer.alloc(1024 * 1024, 0xaa));
      },
      destroy(err, callback) {
        destroyed = true;
        callback(err);
      },
    });

    // 2MB limit: Should fail on 3rd chunk without reading infinitely
    await expect(streamToBuffer(mockStream, 2 * 1024 * 1024)).rejects.toThrow(
      /maximum buffer size limit/i
    );

    expect(destroyed).toBe(true);
    // Verified reading was aborted promptly
    expect(chunksEmitted).toBeLessThanOrEqual(5);
  });

  // ── 12. MIME Type Validation via Magic Bytes ────────────────────────────────
  it("Requirement 12: detectSupportedImageMimeType validates JPEG, PNG, and WebP magic bytes and rejects invalid payloads", () => {
    // Valid JPEG (0xFF 0xD8 0xFF ...)
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    expect(detectSupportedImageMimeType(jpegBuffer, "image/jpeg")).toBe("image/jpeg");
    expect(detectSupportedImageMimeType(jpegBuffer, "image/jpg")).toBe("image/jpeg");

    // Valid PNG (0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A ...)
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    expect(detectSupportedImageMimeType(pngBuffer, "image/png")).toBe("image/png");

    // Valid WebP (RIFF....WEBP)
    const webpBuffer = Buffer.concat([
      Buffer.from("RIFF", "ascii"),
      Buffer.alloc(4),
      Buffer.from("WEBP", "ascii"),
    ]);
    expect(detectSupportedImageMimeType(webpBuffer, "image/webp")).toBe("image/webp");

    // Rejection on invalid / corrupt / executable payloads
    const exeBuffer = Buffer.from("MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff", "latin1");
    expect(detectSupportedImageMimeType(exeBuffer, "image/jpeg")).toBeNull();

    const textBuffer = Buffer.from("Hello world, this is just plain text");
    expect(detectSupportedImageMimeType(textBuffer, "image/png")).toBeNull();

    // Too short
    expect(detectSupportedImageMimeType(Buffer.from([0xff, 0xd8]))).toBeNull();
  });

  // ── 13. Oversized Image Falls Back to Text RAG Without Fabricating Figures ───
  it("Requirement 13: Oversized (>5MB) image stream safely falls back to text-only RAG without crashing or fabricating visual claims", async () => {
    let capturedOptions: any = null;
    let capturedPrompt = "";

    vi.spyOn(geminiService, "generateEmbedding").mockResolvedValue(couplingEmbedding);
    vi.spyOn(geminiService, "generateAnswer").mockImplementation(async (prompt: string, options?: any) => {
      capturedPrompt = prompt;
      capturedOptions = options;
      return "Based strictly on manual text excerpts, maximum allowable radial misalignment is 0.05 mm.";
    });

    // Mock storageService.getFileStream to emit an oversized stream (>5MB)
    const oversizedStream = new Readable({
      read() {
        // Emit 2MB per read -> will exceed 5MB by chunk 3
        this.push(Buffer.alloc(2 * 1024 * 1024, 0xaa));
      },
    });
    vi.spyOn(storageService, "getFileStream").mockResolvedValue(oversizedStream as any);

    const res = await ragService.answerQuestion(
      "How do I set up dial indicator for SP-400X coupling alignment per the diagram?",
      engineerUser
    );

    // Text RAG succeeds without crashing
    expect(res.answer).toBeDefined();
    expect(res.citations.length).toBeGreaterThan(0);

    // LLM visual input was NOT provided with the oversized image
    expect(capturedOptions?.images).toBeUndefined();

    // Prompt did NOT claim figure images were attached
    expect(capturedPrompt).not.toContain("ATTACHED TECHNICAL FIGURES & SCHEMATICS");
    expect(capturedPrompt).toContain("6. Figure Mentions in Text (No Figures Attached):");
    expect(capturedPrompt).toContain("No figure or schematic images are attached to this query.");
    expect(capturedPrompt).toContain("Do NOT claim to have visually examined or observed any figure or diagram.");
  });

  // ── 14. Corrupt / Invalid MIME Image Rejection ──────────────────────────────
  it("Requirement 14: Corrupted or unsupported image file is rejected from LLM input and falls back to text-only RAG", async () => {
    let capturedOptions: any = null;
    let capturedPrompt = "";

    vi.spyOn(geminiService, "generateEmbedding").mockResolvedValue(couplingEmbedding);
    vi.spyOn(geminiService, "generateAnswer").mockImplementation(async (prompt: string, options?: any) => {
      capturedPrompt = prompt;
      capturedOptions = options;
      return "Based on manual text.";
    });

    // Mock storageService.getFileStream to return corrupt bytes (not JPEG/PNG/WebP)
    const corruptBuffer = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><circle/></svg>");
    const corruptStream = Readable.from([corruptBuffer]);
    vi.spyOn(storageService, "getFileStream").mockResolvedValue(corruptStream as any);

    const res = await ragService.answerQuestion(
      "Show me SP-400X dial indicator schematic diagram",
      engineerUser
    );

    expect(res.answer).toBeDefined();
    expect(capturedOptions?.images).toBeUndefined();
    expect(capturedPrompt).not.toContain("ATTACHED TECHNICAL FIGURES & SCHEMATICS");
    expect(capturedPrompt).toContain("6. Figure Mentions in Text (No Figures Attached):");
  });
});
