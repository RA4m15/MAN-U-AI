import mongoose from "mongoose";
import { geminiService } from "./gemini.service";
import { vectorService, ScoredChunk } from "./vector.service";
import { Message, Conversation, AuditEvent } from "../models";

import { isConnectedToMongo } from "../config/database";
import { env } from "../config/env";
import type { CitationDTO } from "@man-u-ai/shared";

export interface RagResponse {
  answer: string;
  citations: CitationDTO[];
  warningLevel: "none" | "caution" | "critical";
  confidenceScore: number;
  provider?: "live-gemini" | "deterministic-fallback";
}

export class RagService {
  /**
   * Main RAG execution pipeline with document-level authorization and structured stage logging.
   */
  async answerQuestion(
    query: string,
    userContext: { id: string; role?: string } | string,
    conversationId?: string,
    equipmentId?: string,
    requestId?: string
  ): Promise<RagResponse> {
    const reqId = requestId || `rag-${Date.now()}`;
    const userIdStr = typeof userContext === "object" ? userContext.id : userContext;
    const userRole = typeof userContext === "object" ? userContext.role : undefined;

    // 1. Stage: Authorization & Permitted Document IDs
    let permittedDocIds: string[] | undefined = undefined;

    if (isConnectedToMongo) {
      try {
        const { DocumentModel, DocumentPermission, User } = await import("../models");

        let resolvedRole = userRole;
        if (!resolvedRole && userIdStr && mongoose.Types.ObjectId.isValid(userIdStr)) {
          const u = await User.findById(userIdStr);
          resolvedRole = u?.role || "viewer";
        }

        if (resolvedRole === "admin") {
          const indexedDocs = await DocumentModel.find({ status: "indexed" }).select("_id");
          permittedDocIds = indexedDocs.map((d) => d._id.toString());
        } else {
          const { toMongoObjectId } = await import("../routes/documents.routes");
          const userOid = toMongoObjectId(userIdStr);

          const explicitPermissions = await DocumentPermission.find({
            $or: [
              { userId: userOid },
              ...(resolvedRole ? [{ role: resolvedRole }] : []),
            ],
            canRead: true,
          }).select("documentId");

          const explicitDocIds = explicitPermissions.map((p) => p.documentId);

          const accessibleDocs = await DocumentModel.find({
            status: "indexed",
            $or: [
              { uploadedById: userOid },
              { _id: { $in: explicitDocIds } },
            ],
          }).select("_id");

          permittedDocIds = accessibleDocs.map((d) => d._id.toString());
        }
        console.log(
          `[RAG Pipeline] [Request ID: ${reqId}] [Stage: authorization] Resolved ${permittedDocIds.length} authorized document IDs for role '${resolvedRole || "viewer"}'`
        );
      } catch (err) {
        console.warn(`[RAG Pipeline] [Request ID: ${reqId}] [Stage: authorization] Could not resolve permitted document IDs:`, err);
        permittedDocIds = [];
      }
    } else {
      // In disconnected mode: production strictly fails closed ([]), dev/test allows in-memory fixture lookup
      permittedDocIds = env.NODE_ENV === "production" ? [] : undefined;
      console.log(
        `[RAG Pipeline] [Request ID: ${reqId}] [Stage: authorization] Database disconnected; operating with ${permittedDocIds ? "strict zero-access fail-closed" : "dev memory fixtures"}`
      );
    }

    // 2. Stage: Equipment Context & Session History Resolution
    let equipmentContext: {
      id: string;
      name: string;
      type: string;
      model?: string;
      manufacturer?: string;
      serialNumber?: string;
      location?: string;
      documentIds?: string[];
    } | undefined;

    if (isConnectedToMongo && equipmentId && mongoose.Types.ObjectId.isValid(equipmentId)) {
      try {
        const { Equipment } = await import("../models");
        const eq = await Equipment.findById(equipmentId);
        if (eq) {
          equipmentContext = {
            id: eq._id.toString(),
            name: eq.name,
            type: eq.type,
            model: eq.model,
            manufacturer: eq.manufacturer,
            serialNumber: eq.serialNumber,
            location: eq.location,
            documentIds: (eq.documentIds || []).map((d: any) => d.toString()),
          };
          console.log(
            `[RAG Pipeline] [Request ID: ${reqId}] [Stage: equipment_context] Loaded equipment context: ${eq.name} (${eq.model || "Unknown Model"})`
          );
        }
      } catch (eqErr) {
        console.warn(`[RAG Pipeline] [Request ID: ${reqId}] Could not load equipment context:`, eqErr);
      }
    }

    let sessionHistory: Array<{ role: "user" | "assistant"; content: string }> = [];
    if (isConnectedToMongo && conversationId && mongoose.Types.ObjectId.isValid(conversationId)) {
      try {
        const { Message } = await import("../models");
        const pastMsgs = await Message.find({ conversationId }).sort({ createdAt: 1 }).limit(10);
        sessionHistory = pastMsgs.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));
        console.log(
          `[RAG Pipeline] [Request ID: ${reqId}] [Stage: session_context] Loaded ${sessionHistory.length} previous messages for conversation ${conversationId}`
        );
      } catch (histErr) {
        console.warn(`[RAG Pipeline] [Request ID: ${reqId}] Could not load session history:`, histErr);
      }
    }

    // 3. Stage: Query Augmentation & Embedding Generation
    let searchQuery = query;
    if (equipmentContext) {
      const lowerQuery = query.toLowerCase();
      const hasName = lowerQuery.includes(equipmentContext.name.toLowerCase());
      const hasModel = equipmentContext.model && lowerQuery.includes(equipmentContext.model.toLowerCase());
      if (!hasName && !hasModel) {
        searchQuery = `${equipmentContext.name} ${equipmentContext.model || ""} ${query}`.trim();
      }
    }

    let queryEmbedding: number[];
    try {
      console.log(`[RAG Pipeline] [Request ID: ${reqId}] [Stage: query_embedding] Generating query embedding via ${env.GEMINI_EMBEDDING_MODEL}`);
      queryEmbedding = await geminiService.generateEmbedding(searchQuery);
    } catch (embErr) {
      (embErr as any).stage = "query_embedding";
      throw embErr;
    }

    // Load authoritative persistent settings (retrieved from MongoDB on startup/restart)
    const { settingsService } = await import("./settings.service");
    const activeSettings = await settingsService.getEffectiveSettings();

    // 4. Stage: Vector & Keyword Hybrid Retrieval
    let retrieved: ScoredChunk[];
    try {
      retrieved = await vectorService.searchSimilar(
        queryEmbedding,
        searchQuery,
        activeSettings.topK,
        activeSettings.similarityThreshold,
        permittedDocIds
      );
      console.log(
        `[RAG Pipeline] [Request ID: ${reqId}] [Stage: vector_retrieval] Retrieved ${retrieved.length} chunks (top score: ${retrieved[0]?.score?.toFixed(3) || "none"}, threshold: ${activeSettings.similarityThreshold})`
      );
    } catch (retErr) {
      (retErr as any).stage = "vector_retrieval";
      throw retErr;
    }

    // 5. Stage: Insufficient Evidence Check
    if (retrieved.length === 0) {
      console.log(`[RAG Pipeline] [Request ID: ${reqId}] [Stage: evidence_evaluation] Retrieval returned 0 chunks; returning grounded insufficient evidence response`);
      const limitationMessage = equipmentContext
        ? `I could not locate sufficient verified documentation in your authorized knowledge index for **${equipmentContext.name}**${equipmentContext.model ? ` (${equipmentContext.model})` : ""} regarding your reported symptom or inquiry. Please verify the equipment model and symptom details, or upload the relevant manufacturer technical manual or SOP to proceed safely.`
        : "I could not locate sufficient verified documentation in your authorized knowledge index to answer this inquiry safely. Please upload the relevant equipment manual or check with a certified plant supervisor.";

      return {
        answer: limitationMessage,
        citations: [],
        warningLevel: "none",
        confidenceScore: 0.1,
        provider: geminiService.getLastProvider(),
      };
    }

    // 6. Determine safety severity level based on query, session history, and retrieved instructions
    const lowerQuery = query.toLowerCase();
    const historyText = sessionHistory.map((m) => m.content.toLowerCase()).join(" ");
    const retrievedText = retrieved.map((r) => r.chunk.text.toLowerCase()).join(" ");
    const combinedSafetyContext = `${lowerQuery} ${historyText} ${retrievedText}`;

    const isBypassRequested =
      lowerQuery.includes("bypass") ||
      lowerQuery.includes("defeat") ||
      lowerQuery.includes("override") ||
      lowerQuery.includes("jump out") ||
      lowerQuery.includes("disable safety") ||
      lowerQuery.includes("bridge interlock") ||
      historyText.includes("bypass") ||
      historyText.includes("defeat");

    const isCritical =
      isBypassRequested ||
      combinedSafetyContext.includes("loto") ||
      combinedSafetyContext.includes("lockout") ||
      combinedSafetyContext.includes("tagout") ||
      combinedSafetyContext.includes("de-energiz") ||
      combinedSafetyContext.includes("isolation") ||
      combinedSafetyContext.includes("isolate") ||
      combinedSafetyContext.includes("high voltage") ||
      combinedSafetyContext.includes("480v") ||
      combinedSafetyContext.includes("arc flash") ||
      combinedSafetyContext.includes("electrical shock") ||
      combinedSafetyContext.includes("live circuit") ||
      combinedSafetyContext.includes("energized") ||
      combinedSafetyContext.includes("ammonia") ||
      combinedSafetyContext.includes("chlorine") ||
      combinedSafetyContext.includes("acid") ||
      combinedSafetyContext.includes("toxic") ||
      combinedSafetyContext.includes("hydraulic bleed") ||
      combinedSafetyContext.includes("high pressure") ||
      combinedSafetyContext.includes("pressurized") ||
      combinedSafetyContext.includes("stored energy") ||
      combinedSafetyContext.includes("spring loaded") ||
      combinedSafetyContext.includes("accumulator") ||
      combinedSafetyContext.includes("interlock") ||
      combinedSafetyContext.includes("safety switch") ||
      combinedSafetyContext.includes("guard") ||
      combinedSafetyContext.includes("pinch point") ||
      combinedSafetyContext.includes("rotating assembly") ||
      combinedSafetyContext.includes("confined space");

    const warningLevel = isCritical ? "critical" : "caution";

    // 7. Construct grounded system prompt for interactive troubleshooting
    const evidenceBlocks = retrieved
      .map(
        (r, i) =>
          `[EVIDENCE ${i + 1}] Source: "${r.chunk.documentTitle}" (Rev: ${r.chunk.revision}), Page ${r.chunk.page}, Section: "${r.chunk.section || "General"}"\nContent: "${r.chunk.text}"`
      )
      .join("\n\n");

    let equipmentSection = "";
    if (equipmentContext) {
      equipmentSection = `\nACTIVE EQUIPMENT IDENTITY & DIAGNOSTIC CONTEXT:\n- Equipment Name: ${equipmentContext.name}\n- Machine Type: ${equipmentContext.type}\n- Model: ${equipmentContext.model || "Not specified"}\n- Manufacturer: ${equipmentContext.manufacturer || "Not specified"}\n- Serial Number: ${equipmentContext.serialNumber || "Not recorded"}\n- Location: ${equipmentContext.location || "Not recorded"}\n`;
    }

    let historySection = "";
    if (sessionHistory.length > 0) {
      historySection =
        `\nDIAGNOSTIC SESSION HISTORY (PREVIOUS CHECKS & OBSERVATIONS):\n` +
        sessionHistory
          .map((m) => `${m.role === "user" ? "TECHNICIAN" : "COPILOT"}: ${m.content}`)
          .join("\n\n") +
        `\n`;
    }

    const prompt = `You are MAN-U-AI, an expert Industrial Reliability Engineering AI Copilot assisting technicians with evidence-grounded interactive troubleshooting.
${equipmentSection}${historySection}
RETRIEVED DOCUMENT EVIDENCE:
${evidenceBlocks}

TECHNICIAN'S CURRENT INPUT:
${query}

MANDATORY RULES FOR EVIDENCE-GROUNDED INTERACTIVE TROUBLESHOOTING:
1. Grounding & Zero Fabrication:
   - Ground all diagnostic instructions, technical parameters, tolerances, torques, and fault codes strictly in the RETRIEVED DOCUMENT EVIDENCE above.
   - NEVER fabricate manual instructions, torque ratings, wire numbers, or diagnostic findings.
   - You may ONLY cite source documents and page numbers that actually exist in the RETRIEVED DOCUMENT EVIDENCE above. Never invent external standards or document citations.

2. Interactive Sequential Guidance (One Step at a Time):
   - Do NOT output an entire multi-step repair procedure at once.
   - Present ONE actionable diagnostic check, inspection, or measurement at a time.
   - State clearly:
     a) What specific action to take.
     b) Exactly what to observe, measure, or listen for (including acceptable vs abnormal criteria).
     c) Prompt the technician to perform this check and report back the observation before choosing the next step.
   - Wait for the user's result before advancing to subsequent steps.

3. Session Context & Completed Checks:
   - Carry forward all symptoms, completed checks, and test results from the DIAGNOSTIC SESSION HISTORY above.
   - Do NOT ask the technician to repeat checks they have already completed.
   - Do NOT mark a step as completed until the user confirms its result.

4. Safety & Interlocks First:
   - Surface relevant source-backed warnings and Lockout/Tagout (LOTO) energy isolation requirements BEFORE any potentially hazardous procedure.
   - NEVER instruct users to bypass safety interlocks, defeat guards, bridge limit switches, or operate machinery in an unsafe state.
   - If the technician mentions or requests bypassing an interlock or safety guard, STRICTLY REFUSE and mandate qualified isolation procedures.
   - Prioritize safe, non-invasive checks (visual inspection, error code display, surface temperature, vibration listening, pressure gauges) before recommending invasive teardown.

5. Handling Uncertainty & Distinguishing Hypotheses:
   - Clearly distinguish between confirmed facts (directly documented in the manual) and diagnostic hypotheses.
   - Label preliminary root causes as "Diagnostic Hypothesis (Unconfirmed — Requires Verification)". Never declare an unverified hypothesis as a confirmed diagnosis.
   - If retrieval does not provide sufficient evidence to pinpoint the issue or verify a safe procedure:
     a) Explicitly state the documentation limitation.
     b) Ask a targeted clarification (e.g. asking for equipment model, nameplate rating, or specific fault code) rather than guessing.
     c) If documentation is silent on a hazardous repair, abstain from guessing and recommend consulting an authorized OEM specialist.

Respond in clean, professional GitHub Markdown:`;

    // 8. Stage: Generative Answer Synthesis
    let answer: string;
    try {
      console.log(
        `[RAG Pipeline] [Request ID: ${reqId}] [Stage: model_generation] Requesting generation with model '${activeSettings.selectedModel}' (evidence chunks: ${retrieved.length})`
      );
      answer = await geminiService.generateAnswer(prompt, {
        model: activeSettings.selectedModel,
        temperature: activeSettings.temperature,
        systemInstruction: "You are an industrial maintenance AI assistant. Ground all claims in the provided documentation.",
      });
      console.log(
        `[RAG Pipeline] [Request ID: ${reqId}] [Stage: model_generation] Model provider called successfully (provider: ${geminiService.getLastProvider()})`
      );
    } catch (err: unknown) {
      (err as any).stage = "model_generation";
      if (env.NODE_ENV === "production") {
        throw err;
      }
      const firstChunk = retrieved[0]?.chunk;
      let safetyHeader = "";
      if (isBypassRequested) {
        safetyHeader = `> ⛔ **CRITICAL SAFETY VIOLATION PREVENTED:**\n> Safety interlocks, limit switches, and physical guards must **NEVER** be bypassed, bridged, or defeated. All inspections must follow authorized Lockout/Tagout (LOTO) isolation protocols with zero-energy verification.\n\n`;
      } else if (isCritical) {
        safetyHeader = `> ⚠️ **CRITICAL SAFETY MANDATE:** Ensure equipment is properly isolated and verified at zero energy state before undertaking physical inspections.\n\n`;
      }

      answer = `[NOTICE: AI Generative Service Unavailable — Grounded Documentation Mode]

${safetyHeader}### Grounded Technical Diagnostic Guidance
${equipmentContext ? `**Equipment:** ${equipmentContext.name}${equipmentContext.model ? ` (${equipmentContext.model})` : ""}\n` : ""}
**Diagnostic Hypothesis (Preliminary — Unconfirmed):**
The following preliminary hypothesis is derived directly from authorized technical documentation. This hypothesis is unconfirmed until physical observations are verified.

**Recommended Non-Invasive Diagnostic Step:**
Based on verified documentation from **${firstChunk?.documentTitle}** (Page ${firstChunk?.page}, Section: ${firstChunk?.section || "General"}):

> ${firstChunk?.text}

**Action Required:**
Please perform the check described above and observe the specified condition. **Do not perform any invasive teardown until the preliminary check is completed and confirmed.**

*Report your observation back to the assistant to determine the subsequent diagnostic step.*

#### Verified Documentation Excerpts:
${retrieved.map((r, i) => `[${i + 1}] **${r.chunk.documentTitle}** (Page ${r.chunk.page}, ${r.chunk.section || "General"}):\n> ${r.chunk.text}`).join("\n\n")}`;
    }

    // 9. Extract verifiable citations strictly from the retrieved pool, attaching genuine visual figures when available
    const figureMap = new Map<string, any[]>();
    if (isConnectedToMongo) {
      try {
        const { DocumentFigure } = await import("../models");
        const docOids = retrieved.map((r) =>
          mongoose.Types.ObjectId.isValid(r.chunk.documentId) && r.chunk.documentId.length === 24
            ? new mongoose.Types.ObjectId(r.chunk.documentId)
            : r.chunk.documentId
        );
        const pages = retrieved.map((r) => r.chunk.page);

        const figures = await DocumentFigure.find({
          documentId: { $in: docOids },
          page: { $in: pages },
          status: "extracted",
        });

        for (const fig of figures) {
          const key = `${fig.documentId.toString()}_${fig.page}`;
          const existing = figureMap.get(key) || [];
          existing.push({
            id: fig._id.toString(),
            documentId: fig.documentId.toString(),
            documentTitle: fig.documentTitle,
            revision: fig.revision,
            page: fig.page,
            figureId: fig.figureId,
            title: fig.title,
            caption: fig.caption,
            storagePath: fig.storagePath,
            storageProvider: fig.storageProvider,
            mimeType: fig.mimeType,
            sizeBytes: fig.sizeBytes,
            dimensions: fig.dimensions,
            status: fig.status,
            associatedChunkIds: fig.associatedChunkIds || [],
            createdAt: fig.createdAt?.toISOString(),
          });
          figureMap.set(key, existing);
        }
      } catch (figErr) {
        console.warn("[RagService] Could not lookup figures for citations:", figErr);
      }
    }

    const citations: CitationDTO[] = retrieved.map((r, i) => {
      const key = `${r.chunk.documentId}_${r.chunk.page}`;
      const matchingFigures = figureMap.get(key);
      return {
        id: `cite-${r.chunk.id}-${i}`,
        documentId: r.chunk.documentId,
        documentTitle: r.chunk.documentTitle,
        revision: r.chunk.revision,
        page: r.chunk.page,
        section: r.chunk.section,
        excerpt: r.chunk.text.slice(0, 220) + (r.chunk.text.length > 220 ? "..." : ""),
        ...(matchingFigures && matchingFigures.length > 0 ? { figures: matchingFigures } : {}),
      };
    });

    // 10. Persist audit trail if MongoDB is connected
    if (isConnectedToMongo) {
      try {
        await AuditEvent.create({
          userId: (userIdStr && mongoose.Types.ObjectId.isValid(userIdStr)) ? userIdStr : undefined,
          action: "rag_query",
          resourceType: "Conversation",
          resourceId: (conversationId && mongoose.Types.ObjectId.isValid(conversationId)) ? conversationId : undefined,
          details: {
            query,
            warningLevel,
            citationsCount: citations.length,
            equipmentId: equipmentContext?.id,
          },
        });
      } catch (err) {
        console.warn("[RagService] Could not log audit event to MongoDB:", err);
      }
    }

    return {
      answer,
      citations,
      warningLevel,
      confidenceScore: retrieved[0]?.score || 0.85,
      provider: geminiService.getLastProvider(),
    };
  }
}

export const ragService = new RagService();
