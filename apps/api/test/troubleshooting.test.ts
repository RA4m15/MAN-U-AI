import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { app } from "../src/app";
import { env } from "../src/config/env";
import { connectDatabase } from "../src/config/database";
import { seedDatabase } from "../src/config/seed";
import { geminiService } from "../src/services/gemini.service";
import { ragService } from "../src/services/rag.service";
import { vectorService } from "../src/services/vector.service";
import { Equipment, Conversation, Message, DocumentModel, DocumentChunk, DocumentFigure } from "../src/models";
import { toMongoObjectId } from "../src/routes/documents.routes";

describe("Task 3: Evidence-Grounded Interactive Troubleshooting Suite", () => {
  let engineerToken: string;
  const engineerUser = {
    id: "usr-eng-troubleshoot-001",
    email: "lead.tech@plant.io",
    role: "engineer",
  };

  let testEquipmentId: string;
  let testDocId: mongoose.Types.ObjectId;

  beforeAll(async () => {
    await connectDatabase();
    await seedDatabase();

    engineerToken = jwt.sign(
      { id: engineerUser.id, email: engineerUser.email, role: engineerUser.role },
      env.JWT_SECRET,
      { expiresIn: "2h" }
    );

    // Create a known test equipment record
    const eq = await Equipment.create({
      name: "Centrifugal Slurry Pump P-102",
      type: "Centrifugal Pump",
      model: "SP-400X",
      manufacturer: "Warman Reliability Systems",
      serialNumber: "SN-WARMAN-9921",
      location: "Process Bay 4",
      documentIds: [],
    });
    testEquipmentId = eq._id.toString();

    // Create a test manual document with known chunks
    testDocId = new mongoose.Types.ObjectId();
    await DocumentModel.create({
      _id: testDocId,
      title: "Model SP-400X Slurry Pump Technical SOP",
      revision: "Rev 3.0",
      filename: "sp400x_sop.pdf",
      storagePath: "sp400x_sop.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
      status: "indexed",
      uploadedById: new mongoose.Types.ObjectId(),
    });

    await DocumentChunk.create({
      documentId: testDocId,
      documentTitle: "Model SP-400X Slurry Pump Technical SOP",
      revision: "Rev 3.0",
      page: 12,
      section: "Section 5: Vibration and Bearing Diagnostics",
      text: "Excessive axial vibration (> 6.0 mm/s RMS) accompanied by elevated bearing housing temperature (> 80°C) indicates potential thrust bearing degradation. Step 1: Check bearing housing surface temperature using a calibrated non-contact infrared thermometer and inspect lubricant level in the sight glass. Acceptable operating temperature is 60°C to 75°C. Warning: Do not defeat or bypass temperature interlocks.",
      embedding: new Array(768).fill(0.02),
    });

    await DocumentChunk.create({
      documentId: testDocId,
      documentTitle: "Model SP-400X Slurry Pump Technical SOP",
      revision: "Rev 3.0",
      page: 14,
      section: "Section 6: Mechanical Seal and Shaft Tolerances",
      text: "If bearing housing temperature exceeds 80°C and metallic particulates are present in oil sample: Step 2: Perform Lockout/Tagout (LOTO) energy isolation of main drive motor P-102-M. Depressurize casing. Inspect shaft axial runout using dial indicator. Maximum permissible axial runout is 0.05 mm. Tighten four M12 gland retaining nuts in cross-diagonal sequence to 45 N·m.",
      embedding: new Array(768).fill(0.03),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. Equipment and Symptom Context Reaches Diagnostic Flow ───────────────
  it("Requirement 1: Passes equipment identity and symptom context into the diagnostic prompt and vector retrieval", async () => {
    let capturedPrompt = "";
    vi.spyOn(geminiService, "generateAnswer").mockImplementation(async (prompt: string) => {
      capturedPrompt = prompt;
      return "Based on Model SP-400X SOP (Page 12), please perform Step 1: Measure bearing housing surface temperature with an infrared thermometer and inspect lubricant level in the sight glass. Report your temperature reading.";
    });

    const res = await request(app)
      .post("/api/v1/chat")
      .set("Authorization", `Bearer ${engineerToken}`)
      .send({
        message: "The pump is vibrating heavily and the bearing housing feels extremely hot to the touch.",
        equipmentId: testEquipmentId,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify equipment context was incorporated into the prompt
    expect(capturedPrompt).toContain("ACTIVE EQUIPMENT IDENTITY & DIAGNOSTIC CONTEXT");
    expect(capturedPrompt).toContain("Centrifugal Slurry Pump P-102");
    expect(capturedPrompt).toContain("SP-400X");
    expect(capturedPrompt).toContain("Warman Reliability Systems");
    expect(capturedPrompt).toContain("Process Bay 4");

    // Verify technician inquiry was passed
    expect(capturedPrompt).toContain("The pump is vibrating heavily and the bearing housing feels extremely hot");

    // Verify instructions mandate single-step guidance and zero fabrication
    expect(capturedPrompt).toContain("Interactive Sequential Guidance (One Step at a Time)");
    expect(capturedPrompt).toContain("Grounding & Zero Fabrication");
    expect(capturedPrompt).toContain("Safety & Interlocks First");

    // Verify response answer
    expect(res.body.data.answer).toContain("Step 1");
    expect(res.body.data.citations.length).toBeGreaterThan(0);
  });

  // ── 2. Sequential Step-by-Step Guidance ─────────────────────────────────────
  it("Requirement 2: Proposes one actionable diagnostic check and prompts the user for the observation before proceeding", async () => {
    vi.spyOn(geminiService, "generateAnswer").mockResolvedValueOnce(
      "### Step 1: Non-Invasive Bearing Housing Inspection\n\nAccording to **Model SP-400X Slurry Pump Technical SOP** (Page 12, Section 5):\n\n1. Measure the bearing housing surface temperature using a calibrated non-contact infrared thermometer.\n2. Observe the oil level and clarity through the sight glass.\n\n**Expected Normal:** 60°C to 75°C with clean, translucent amber lubricant.\n**Abnormal Condition:** > 80°C or darkened lubricant with visible particulates.\n\n*Please report back your temperature reading and oil clarity before we proceed to internal mechanical inspection.*"
    );

    const res = await request(app)
      .post("/api/v1/chat")
      .set("Authorization", `Bearer ${engineerToken}`)
      .send({
        message: "What should I check first for abnormal pump vibration and heat?",
        equipmentId: testEquipmentId,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.answer).toContain("Step 1");
    expect(res.body.data.answer).toContain("Please report back your temperature reading");
    expect(res.body.data.answer).not.toContain("Step 2");
    expect(res.body.data.citations.length).toBeGreaterThan(0);
  });

  // ── 3. Multi-Turn Session Continuity & Result Adaptation ──────────────────
  it("Requirement 3: Carries forward previously supplied symptoms and confirmed check results to advance to the next step", async () => {
    // 1. Create a conversation in MongoDB
    const conv = await Conversation.create({
      userId: toMongoObjectId(engineerUser.id),
      title: "SP-400X Vibration Diagnostic Session",
      equipmentId: new mongoose.Types.ObjectId(testEquipmentId),
    });
    const convId = conv._id.toString();

    // 2. Turn 1: Technician reports symptom
    await Message.create({
      conversationId: conv._id,
      role: "user",
      content: "Centrifugal pump P-102 is exhibiting heavy axial vibration and bearing overheating.",
    });

    // 3. Turn 1 Assistant response recommending Step 1
    await Message.create({
      conversationId: conv._id,
      role: "assistant",
      content: "Step 1: Check bearing housing surface temperature and sight glass oil clarity. Please report the temperature and oil appearance.",
      citations: [{
        documentId: testDocId.toString(),
        documentTitle: "Model SP-400X Slurry Pump Technical SOP",
        revision: "Rev 3.0",
        page: 12,
        section: "Section 5",
        excerpt: "Excessive axial vibration (> 6.0 mm/s RMS) accompanied by elevated bearing housing temperature...",
      }],
    });

    // 4. Turn 2: Technician provides confirmed result
    let turn2Prompt = "";
    vi.spyOn(geminiService, "generateAnswer").mockImplementation(async (prompt: string) => {
      turn2Prompt = prompt;
      return "### Step 2: Electrical Isolation & Shaft Runout Inspection\n\nGiven that your bearing temperature is 88°C (exceeding the 80°C limit) and brass flakes are present:\n\n**Safety Mandatory:** Perform Lockout/Tagout (LOTO) energy isolation on drive motor P-102-M. Depressurize the pump casing completely.\n\nPer Model SP-400X SOP (Page 14, Section 6), measure the shaft axial runout using a dial indicator. The maximum permissible runout is 0.05 mm.\n\n*Please confirm LOTO isolation and report the dial indicator runout measurement.*";
    });

    const res = await request(app)
      .post("/api/v1/chat")
      .set("Authorization", `Bearer ${engineerToken}`)
      .send({
        conversationId: convId,
        message: "Step 1 completed: Housing temperature measured at 88°C and sight glass oil is dark with visible brass flakes.",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify session history was loaded and incorporated
    expect(turn2Prompt).toContain("DIAGNOSTIC SESSION HISTORY (PREVIOUS CHECKS & OBSERVATIONS)");
    expect(turn2Prompt).toContain("exhibiting heavy axial vibration and bearing overheating");
    expect(turn2Prompt).toContain("Step 1: Check bearing housing surface temperature");
    expect(turn2Prompt).toContain("Housing temperature measured at 88°C and sight glass oil is dark with visible brass flakes");

    // Verify response advanced to Step 2 with LOTO safety
    expect(res.body.data.answer).toContain("Step 2");
    expect(res.body.data.answer).toContain("Lockout/Tagout (LOTO)");
    expect(res.body.data.answer).toContain("0.05 mm");

    // Verify conversation was updated with new messages
    const msgs = await Message.find({ conversationId: conv._id });
    expect(msgs.length).toBe(4); // User1, Asst1, User2, Asst2
  });

  // ── 4. Genuine Citations Without Hallucination ─────────────────────────────
  it("Requirement 4: Returns genuine source citations matching retrieved passages without fabricating metadata", async () => {
    vi.spyOn(geminiService, "generateAnswer").mockResolvedValueOnce(
      "Tighten the four M12 gland retaining nuts to 45 N·m per verified technical manual specifications."
    );

    const res = await request(app)
      .post("/api/v1/chat")
      .set("Authorization", `Bearer ${engineerToken}`)
      .send({
        message: "What is the gland retaining nut torque specification for the SP-400X pump?",
        equipmentId: testEquipmentId,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.citations).toBeDefined();
    expect(res.body.data.citations.length).toBeGreaterThan(0);

    const citation = res.body.data.citations[0];
    expect(citation.documentTitle).toBeDefined();
    expect(citation.page).toBeGreaterThanOrEqual(1);
    expect(citation.excerpt).toBeDefined();
    expect(citation.excerpt.length).toBeGreaterThan(10);
    expect(res.body.data.citations.some((c: any) => c.documentTitle.includes("Pump"))).toBe(true);
  });

  // ── 5. Insufficient Evidence Produces Clarification or Abstention ───────────
  it("Requirement 5: Rejects unsupported symptoms or unknown machines with honest limitation and targeted clarification", async () => {
    // Search vector service returns 0 chunks for unknown machine
    vi.spyOn(vectorService, "searchSimilar").mockResolvedValueOnce([]);

    const res = await request(app)
      .post("/api/v1/chat")
      .set("Authorization", `Bearer ${engineerToken}`)
      .send({
        message: "How do I recalibrate the antimatter injector frequency on Sub-Warp Generator X-99?",
      });

    expect(res.status).toBe(200);
    expect(res.body.data.answer).toContain("could not locate sufficient verified documentation");
    expect(res.body.data.citations).toEqual([]);
    expect(res.body.data.confidenceScore).toBeLessThan(0.5);
  });

  // ── 6. Safety Warnings & Interlock Bypass Prohibition ──────────────────────
  it("Requirement 6: Flags critical safety severity when hazardous procedures, stored energy, or interlocks are mentioned", async () => {
    vi.spyOn(geminiService, "generateAnswer").mockResolvedValueOnce(
      "Warning: Perform Lockout/Tagout (LOTO) energy isolation before opening the breaker cubicle."
    );

    const res = await request(app)
      .post("/api/v1/chat")
      .set("Authorization", `Bearer ${engineerToken}`)
      .send({
        message: "How do I perform LOTO energy isolation before high voltage motor disassembly?",
      });

    expect(res.status).toBe(200);
    expect(res.body.data.warningLevel).toBe("critical");
  }, 10000);

  // ── 7. Conversation Automatically Retains Equipment Target ────────────────
  it("Requirement 7: Conversation preserves equipmentId across turns without client needing to re-send it", async () => {
    // Start conversation with equipmentId
    const createRes = await request(app)
      .post("/api/v1/conversations")
      .set("Authorization", `Bearer ${engineerToken}`)
      .send({
        title: "Session With Linked Equipment",
        equipmentId: testEquipmentId,
      });

    expect(createRes.status).toBe(201);
    const convId = createRes.body.data.id;
    expect(createRes.body.data.equipmentId).toBe(testEquipmentId);

    // Turn 1: Client sends message with conversationId only (no equipmentId in body)
    let capturedPrompt = "";
    vi.spyOn(geminiService, "generateAnswer").mockImplementation(async (prompt: string) => {
      capturedPrompt = prompt;
      return "Step 1: Check oil sight glass on Centrifugal Slurry Pump P-102.";
    });

    const res = await request(app)
      .post("/api/v1/chat")
      .set("Authorization", `Bearer ${engineerToken}`)
      .send({
        conversationId: convId,
        message: "What is the recommended lubrication interval?",
      });

    expect(res.status).toBe(200);
    // Equipment context was automatically resolved from Conversation in database
    expect(capturedPrompt).toContain("Centrifugal Slurry Pump P-102");
    expect(capturedPrompt).toContain("SP-400X");
  });

  // ── 8. Non-Equipment RAG Inquiries Function Intact ──────────────────────────
  it("Requirement 8: Standard RAG queries without equipment context continue to function seamlessly", async () => {
    vi.spyOn(geminiService, "generateAnswer").mockResolvedValueOnce(
      "Mechanical seal rebuild procedures require clean environment and proper torque specifications."
    );

    const res = await request(app)
      .post("/api/v1/chat")
      .set("Authorization", `Bearer ${engineerToken}`)
      .send({
        message: "What are general precautions for mechanical seal maintenance?",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.answer).toBeDefined();
    expect(res.body.data.citations).toBeDefined();
  });

  // ── 9. Equipment Switching During Active Conversation Rejects Mismatch ──────
  it("Requirement 9: Rejects sending a different equipmentId into an existing equipment-bound conversation", async () => {
    // Create a second equipment record
    const eq2 = await Equipment.create({
      name: "Screw Air Compressor C-201",
      type: "Air Compressor",
      model: "AC-500",
      manufacturer: "Atlas Comp",
    });

    // Conversation bound to testEquipmentId
    const conv = await Conversation.create({
      userId: toMongoObjectId(engineerUser.id),
      title: "Pump Diagnostic",
      equipmentId: new mongoose.Types.ObjectId(testEquipmentId),
    });

    // Attempt to send a message to this conversation with eq2._id
    const res = await request(app)
      .post("/api/v1/chat")
      .set("Authorization", `Bearer ${engineerToken}`)
      .send({
        conversationId: conv._id.toString(),
        equipmentId: eq2._id.toString(),
        message: "Check the compressor oil pressure",
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("EQUIPMENT_MISMATCH");
    expect(res.body.error.message).toContain("Equipment ID does not match");
  });

  // ── 10. Validates Equipment ID and Enforces Authorization ─────────────────
  it("Requirement 10: Validates equipment IDs on conversation creation and rejects invalid formats or non-existent IDs", async () => {
    // 10a. Invalid format
    const invalidRes = await request(app)
      .post("/api/v1/conversations")
      .set("Authorization", `Bearer ${engineerToken}`)
      .send({
        title: "Invalid Eq Conv",
        equipmentId: "not-a-valid-mongo-oid",
      });
    expect(invalidRes.status).toBe(400);
    expect(invalidRes.body.error.code).toBe("INVALID_EQUIPMENT_ID");

    // 10b. Non-existent equipment ID
    const randomOid = new mongoose.Types.ObjectId().toString();
    const missingRes = await request(app)
      .post("/api/v1/conversations")
      .set("Authorization", `Bearer ${engineerToken}`)
      .send({
        title: "Missing Eq Conv",
        equipmentId: randomOid,
      });
    expect(missingRes.status).toBe(404);
    expect(missingRes.body.error.code).toBe("EQUIPMENT_NOT_FOUND");

    // 10c. Unauthorized access to another user's conversation
    const otherUserConv = await Conversation.create({
      userId: new mongoose.Types.ObjectId(), // different user
      title: "Private User Conv",
      equipmentId: new mongoose.Types.ObjectId(testEquipmentId),
    });

    const unauthChatRes = await request(app)
      .post("/api/v1/chat")
      .set("Authorization", `Bearer ${engineerToken}`)
      .send({
        conversationId: otherUserConv._id.toString(),
        message: "Can I access this conversation?",
      });
    expect(unauthChatRes.status).toBe(403);
    expect(unauthChatRes.body.error.code).toBe("FORBIDDEN");

    const unauthGetRes = await request(app)
      .get(`/api/v1/conversations/${otherUserConv._id.toString()}`)
      .set("Authorization", `Bearer ${engineerToken}`);
    expect(unauthGetRes.status).toBe(403);
    expect(unauthGetRes.body.error.code).toBe("FORBIDDEN");
  });

  // ── 11. Hazard Mentions in Prior Dialogue Elevate Safety Severity ─────────
  it("Requirement 11: Safety warnings are triggered when hazardous procedures or stored energy appear in prior dialogue", async () => {
    const conv = await Conversation.create({
      userId: toMongoObjectId(engineerUser.id),
      title: "Follow-up Safety Session",
      equipmentId: new mongoose.Types.ObjectId(testEquipmentId),
    });

    // Prior message mentioned high-voltage and hydraulic bleed hazard
    await Message.create({
      conversationId: conv._id,
      role: "user",
      content: "We detected high pressure hydraulic bleed leaks and high voltage electrical noise near the drive assembly.",
    });
    await Message.create({
      conversationId: conv._id,
      role: "assistant",
      content: "Do not touch the assembly until isolated.",
    });

    // Follow-up message has harmless wording, but prior dialogue contains critical safety context
    vi.spyOn(geminiService, "generateAnswer").mockResolvedValueOnce(
      "Confirm the isolation tag is signed off before physical inspection."
    );

    const res = await request(app)
      .post("/api/v1/chat")
      .set("Authorization", `Bearer ${engineerToken}`)
      .send({
        conversationId: conv._id.toString(),
        message: "Where is the sight glass located?",
      });

    expect(res.status).toBe(200);
    // Prior dialogue had high pressure hydraulic bleed and high voltage
    expect(res.body.data.warningLevel).toBe("critical");
  });

  // ── 12. Strictly Refuses Interlock Bypass and Labels Fallback Hypotheses ───
  it("Requirement 12: Forbids bypassing safety interlocks and strictly labels offline fallback as unconfirmed preliminary hypothesis", async () => {
    // Force generative failure to trigger deterministic fallback
    vi.spyOn(geminiService, "generateAnswer").mockRejectedValueOnce(
      new Error("Simulated upstream AI outage")
    );

    const res = await request(app)
      .post("/api/v1/chat")
      .set("Authorization", `Bearer ${engineerToken}`)
      .send({
        message: "Can we bypass the temperature interlock to keep production running?",
        equipmentId: testEquipmentId,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.warningLevel).toBe("critical");
    const answer = res.body.data.answer;
    // Strictly forbids bypassing interlocks
    expect(answer).toContain("CRITICAL SAFETY VIOLATION PREVENTED");
    expect(answer).toMatch(/NEVER.*be bypassed/i);
    // Explicitly distinguishes preliminary hypothesis from confirmed diagnosis
    expect(answer).toContain("Diagnostic Hypothesis (Preliminary — Unconfirmed)");
    expect(answer).toContain("Action Required");
  });

  // ── 13. Equipment Authorization & Zero Disclosure to Unauthenticated Callers ──
  it("Requirement 13: Strictly rejects unauthenticated requests preventing equipment metadata disclosure", async () => {
    // 13a. Unauthenticated GET /equipment/:id
    const eqRes = await request(app).get(`/api/v1/equipment/${testEquipmentId}`);
    expect(eqRes.status).toBe(401);

    // 13b. Unauthenticated POST /conversations with equipmentId
    const convRes = await request(app).post("/api/v1/conversations").send({
      title: "Unauthenticated Session",
      equipmentId: testEquipmentId,
    });
    expect(convRes.status).toBe(401);

    // 13c. Unauthenticated POST /chat with equipmentId
    const chatRes = await request(app).post("/api/v1/chat").send({
      message: "Expose pump details",
      equipmentId: testEquipmentId,
    });
    expect(chatRes.status).toBe(401);

    // 13d. Unauthenticated GET /conversations/:id
    const getConvRes = await request(app).get(`/api/v1/conversations/${new mongoose.Types.ObjectId().toString()}`);
    expect(getConvRes.status).toBe(401);
  });

  // ── 14. Citation Integrity & Cross-Document Permission Isolation ───────────
  it("Requirement 14: Restricts citations strictly to authorized chunks and excludes restricted documents", async () => {
    // Create an unauthorized restricted document owned by another user with no permissions granted
    const restrictedDocId = new mongoose.Types.ObjectId();
    const otherUserId = new mongoose.Types.ObjectId();
    await DocumentModel.create({
      _id: restrictedDocId,
      title: "Confidential Competitor Slurry Pump Teardown",
      revision: "Rev X",
      filename: "confidential_teardown.pdf",
      storagePath: "confidential_teardown.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2048,
      status: "indexed",
      uploadedById: otherUserId,
    });

    await DocumentChunk.create({
      documentId: restrictedDocId,
      documentTitle: "Confidential Competitor Slurry Pump Teardown",
      revision: "Rev X",
      page: 99,
      section: "Secret Tolerances",
      text: "Secret axial vibration threshold is 0.001 mm under proprietary isolation.",
      embedding: new Array(768).fill(0.02),
    });

    vi.spyOn(geminiService, "generateAnswer").mockResolvedValueOnce(
      "Tighten gland retaining nuts to 45 N·m per verified SOP."
    );

    const res = await request(app)
      .post("/api/v1/chat")
      .set("Authorization", `Bearer ${engineerToken}`)
      .send({
        message: "What is the gland retaining nut torque specification for the SP-400X pump?",
        equipmentId: testEquipmentId,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.citations).toBeDefined();
    // Engineer has NO access to restrictedDocId
    const restrictedMatches = res.body.data.citations.filter(
      (c: any) => c.documentId === restrictedDocId.toString()
    );
    expect(restrictedMatches.length).toBe(0);

    // All citations returned must be authorized documents and never the restricted document
    expect(res.body.data.citations.length).toBeGreaterThan(0);
    for (const c of res.body.data.citations) {
      expect(c.documentId).not.toBe(restrictedDocId.toString());
      expect(c.documentTitle).not.toBe("Confidential Competitor Slurry Pump Teardown");
    }
  });
});
