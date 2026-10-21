import mongoose from "mongoose";
import { geminiService, VisualInputPart } from "./gemini.service";
import { vectorService, ScoredChunk } from "./vector.service";
import { AuditEvent } from "../models";

import { isConnectedToMongo } from "../config/database";
import { env } from "../config/env";
import type { CitationDTO } from "@man-u-ai/shared";

/**
 * Detects whether buffer corresponds to a supported image format (JPEG, PNG, WebP)
 * and verifies it against the declared MIME type. Returns normalized MIME type or null if invalid/unsupported.
 */
export function detectSupportedImageMimeType(buffer: Buffer, declaredMime?: string): string | null {
  if (!buffer || buffer.length < 12) return null;

  let detected: "image/jpeg" | "image/png" | "image/webp" | null = null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    detected = "image/jpeg";
  } else if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    detected = "image/png";
  } else if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    detected = "image/webp";
  }

  if (!detected) {
    return null;
  }

  // If a declared MIME type exists, verify compatibility
  if (declaredMime) {
    const norm = declaredMime.toLowerCase().trim();
    const isJpeg = (norm === "image/jpeg" || norm === "image/jpg") && detected === "image/jpeg";
    const isPng = norm === "image/png" && detected === "image/png";
    const isWebp = norm === "image/webp" && detected === "image/webp";
    if (!isJpeg && !isPng && !isWebp) {
      console.warn(
        `[RAG Pipeline] Declared figure MIME '${declaredMime}' does not match detected format '${detected}'. Using detected format.`
      );
    }
  }

  return detected;
}

/**
 * Reads a readable stream incrementally into a Buffer, enforcing a strict maximum size limit (default 5 MB).
 * Destroys the stream immediately if limit is exceeded to free underlying file/socket handles.
 */
export async function streamToBuffer(stream: NodeJS.ReadableStream, maxBytes = 5 * 1024 * 1024): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  try {
    for await (const chunk of stream) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buf.length;
      if (totalBytes > maxBytes) {
        if (typeof (stream as any).destroy === "function") {
          (stream as any).destroy();
        }
        throw new Error(`Figure file exceeded maximum buffer size limit of ${maxBytes} bytes`);
      }
      chunks.push(buf);
    }
  } catch (err) {
    if (typeof (stream as any).destroy === "function" && !(stream as any).destroyed) {
      try {
        (stream as any).destroy();
      } catch {
        // ignore destroy errors
      }
    }
    throw err;
  }
  return Buffer.concat(chunks);
}

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

    // 6b. Stage: Multimodal Figure Retrieval & Relevance Association
    let relevantFigures: any[] = [];
    let visualParts: VisualInputPart[] = [];
    const figureCitationMap = new Map<string, any[]>();

    if (isConnectedToMongo && retrieved.length > 0) {
      try {
        const { DocumentFigure } = await import("../models");
        const { storageService } = await import("./storage.service");

        const docOids = retrieved.map((r) =>
          mongoose.Types.ObjectId.isValid(r.chunk.documentId) && r.chunk.documentId.length === 24
            ? new mongoose.Types.ObjectId(r.chunk.documentId)
            : r.chunk.documentId
        );

        let allowedDocFilter: any = { $in: docOids };
        if (permittedDocIds !== undefined) {
          const allowedDocOids = permittedDocIds
            .filter((id) => docOids.some((d) => d.toString() === id))
            .map((id) => (mongoose.Types.ObjectId.isValid(id) && id.length === 24 ? new mongoose.Types.ObjectId(id) : id));
          allowedDocFilter = { $in: allowedDocOids };
        }

        const pages = Array.from(new Set(retrieved.map((r) => r.chunk.page)));

        const candidateFigures = await DocumentFigure.find({
          documentId: allowedDocFilter,
          page: { $in: pages },
          status: "extracted",
        });

        console.log(
          `[RAG Pipeline] [Request ID: ${reqId}] [Stage: multimodal_retrieval] Found ${candidateFigures.length} candidate figures across ${pages.length} retrieved pages`
        );

        const scoredFigures: Array<{ fig: any; score: number; matchedChunkId?: string }> = [];
        const queryTerms = query.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
        const visualIntentRegex = /\b(diagram|figure|schematic|drawing|exploded|wiring|layout|parts|assembly|illustration|connector|pinout|circuit|chart|view|image|photo)\b/i;
        const hasVisualIntent = visualIntentRegex.test(query);

        for (const fig of candidateFigures) {
          let score = 0;
          let matchedChunkId: string | undefined = undefined;

          // Check query keyword overlap with figure title/caption/figureId
          const figText = `${fig.figureId} ${fig.title || ""} ${fig.caption || ""}`.toLowerCase();
          let queryKeywordMatches = 0;
          for (const term of queryTerms) {
            if (figText.includes(term)) {
              queryKeywordMatches++;
            }
          }

          for (const r of retrieved) {
            if (r.chunk.documentId !== fig.documentId.toString()) continue;

            const isTopChunk = r.chunk.id === retrieved[0]?.chunk.id;

            // Direct chunk association
            if (fig.associatedChunkIds && fig.associatedChunkIds.includes(r.chunk.id)) {
              score += isTopChunk ? 10 : 5;
              matchedChunkId = r.chunk.id;
            }
            if (r.chunk.figureIds && (r.chunk.figureIds.includes(fig.figureId) || r.chunk.figureIds.includes(fig._id.toString()))) {
              score += isTopChunk ? 10 : 5;
              matchedChunkId = r.chunk.id;
            }

            // Direct textual mention of figureId in chunk text or section
            const escapedFigId = fig.figureId.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
            const figMentionRegex = new RegExp(`\\b${escapedFigId}\\b`, "i");
            if (figMentionRegex.test(r.chunk.text) || (r.chunk.section && figMentionRegex.test(r.chunk.section))) {
              score += isTopChunk ? 8 : 4;
              matchedChunkId = r.chunk.id;
            }

            // Same page as retrieved chunk
            if (r.chunk.page === fig.page) {
              score += isTopChunk ? 3 : 1;
              if (!matchedChunkId) matchedChunkId = r.chunk.id;
            }
          }

          if (queryKeywordMatches > 0) {
            score += queryKeywordMatches * 4;
          }

          if (hasVisualIntent && score > 0) {
            score += 5;
          }

          // Strict relevance filter: must meet minimum relevance threshold and have topical link
          if (score >= 8 && (queryKeywordMatches > 0 || hasVisualIntent || matchedChunkId === retrieved[0]?.chunk.id)) {
            scoredFigures.push({ fig, score, matchedChunkId });
          }
        }

        // Prioritize figures belonging to the primary top-retrieved document, then by relevance score
        const primaryDocId = retrieved[0]?.chunk.documentId;
        scoredFigures.sort((a, b) => {
          const aIsPrimary = a.fig.documentId.toString() === primaryDocId ? 1 : 0;
          const bIsPrimary = b.fig.documentId.toString() === primaryDocId ? 1 : 0;
          if (aIsPrimary !== bIsPrimary) return bIsPrimary - aIsPrimary;
          return b.score - a.score;
        });

        // Populate citations for all genuine scored figures meeting relevance threshold
        for (const item of scoredFigures) {
          const fig = item.fig;
          if (!fig.storagePath) continue;

          const figureDto = {
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
          };

          const pageKey = `${fig.documentId.toString()}_${fig.page}`;
          const pageList = figureCitationMap.get(pageKey) || [];
          if (!pageList.some((f) => f.id === figureDto.id)) {
            pageList.push(figureDto);
            figureCitationMap.set(pageKey, pageList);
          }

          if (item.matchedChunkId) {
            const chunkList = figureCitationMap.get(item.matchedChunkId) || [];
            if (!chunkList.some((f) => f.id === figureDto.id)) {
              chunkList.push(figureDto);
              figureCitationMap.set(item.matchedChunkId, chunkList);
            }
          }
        }

        // Bounded selection: limit to top figures for multimodal AI visual input (prioritizing primary document)
        // A figure is selected for visual LLM input ONLY IF:
        // 1. The user explicitly inquired about a diagram/figure/schematic (hasVisualIntent), OR
        // 2. The primary top-scoring evidence chunk directly references/associates with this figure.
        const selected = scoredFigures
          .filter(
            (s) =>
              (!primaryDocId || s.fig.documentId.toString() === primaryDocId) &&
              (hasVisualIntent || s.matchedChunkId === retrieved[0]?.chunk.id)
          )
          .slice(0, 2);

        for (const item of selected) {
          const fig = item.fig;
          if (!fig.storagePath) continue;

          try {
            const stream = await storageService.getFileStream(fig.storagePath, fig.storageProvider);
            const imageBuffer = await streamToBuffer(stream, 5 * 1024 * 1024);
            const verifiedMime = detectSupportedImageMimeType(imageBuffer, fig.mimeType);

            if (!verifiedMime) {
              console.warn(
                `[RAG Pipeline] Skipping figure ${fig.figureId}: unsupported or invalid image format.`
              );
              continue;
            }

            visualParts.push({
              data: imageBuffer,
              mimeType: verifiedMime,
              figureId: fig.figureId,
              title: fig.title,
            });

            // Only attach figure to prompt context if the image loaded and validated successfully
            relevantFigures.push(fig);
          } catch (loadErr) {
            console.warn(`[RAG Pipeline] Failed to load image asset for figure ${fig.figureId} (${fig.storagePath}):`, loadErr);
          }
        }

        console.log(
          `[RAG Pipeline] [Request ID: ${reqId}] [Stage: multimodal_retrieval] Attached ${visualParts.length} verified figure image(s) for visual AI comprehension`
        );
      } catch (figErr) {
        console.warn(`[RAG Pipeline] [Request ID: ${reqId}] Multimodal figure retrieval error:`, figErr);
      }
    }

    // 7. Construct grounded system prompt for interactive troubleshooting
    const evidenceBlocks = retrieved
      .map(
        (r, i) =>
          `[EVIDENCE ${i + 1}] Source: "${r.chunk.documentTitle}" (Rev: ${r.chunk.revision}), Page ${r.chunk.page}, Section: "${r.chunk.section || "General"}"\nContent: "${r.chunk.text}"`
      )
      .join("\n\n");

    let figureSection = "";
    if (relevantFigures.length > 0) {
      figureSection =
        `\nATTACHED TECHNICAL FIGURES & SCHEMATICS:\n` +
        relevantFigures
          .map(
            (f, idx) =>
              `[FIGURE ${idx + 1}] Source: "${f.documentTitle}" (Rev: ${f.revision}), Page ${f.page}, Figure ID: "${f.figureId}", Title: "${f.title || "Untitled"}"\nCaption: "${f.caption || "None"}"\nDimensions: ${f.dimensions?.width || "?"}x${f.dimensions?.height || "?"} px, Format: ${f.mimeType || "image/jpeg"}`
          )
          .join("\n\n") +
        `\n`;
    }

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
${figureSection}
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

${relevantFigures.length > 0 ? `6. Multimodal & Figure-Aware Grounding (Strict Rules):
   - You have been provided with authentic extracted figure images/schematics matching the retrieved manual pages.
   - Ground visual observations ONLY in what is directly legible and visible in the attached figures.
   - When referencing a figure, always cite its exact Figure ID, Document, and Page number (e.g. "[Figure 1 on Page 16 of SP-400 Manual]").
   - Distinguish visible observations from interpretations:
     * Label direct visual readings as "Direct Visual Observation from [Figure ID]".
     * Label deductions or procedural steps as "Procedural Guidance from Manual Text".
   - ZERO FABRICATION: NEVER hallucinate, guess, or invent component labels, terminal/pin numbers, wire colors, arrow directions, valve positions, or dimensions that are illegible or not present in the figure.
   - If an image is unreadable, blurry, or lacks a specific requested detail, explicitly state that the detail is not legible in the figure and rely strictly on the manual text or ask for clarification.` : `6. Figure Mentions in Text (No Figures Attached):
   - No figure or schematic images are attached to this query.
   - If manual excerpts mention figures or schematics, refer to them strictly as textual manual references. Do NOT claim to have visually examined or observed any figure or diagram.`}

Respond in clean, professional GitHub Markdown:`;

    // 8. Stage: Generative Answer Synthesis
    let answer: string;
    try {
      console.log(
        `[RAG Pipeline] [Request ID: ${reqId}] [Stage: model_generation] Requesting generation with model '${activeSettings.selectedModel}' (evidence chunks: ${retrieved.length}, images: ${visualParts.length})`
      );
      answer = await geminiService.generateAnswer(prompt, {
        model: activeSettings.selectedModel,
        temperature: activeSettings.temperature,
        systemInstruction: "You are an industrial maintenance AI assistant. Ground all claims in the provided documentation.",
        images: visualParts.length > 0 ? visualParts : undefined,
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

      let figureNotice = "";
      if (relevantFigures.length > 0) {
        figureNotice =
          `\n#### Associated Technical Figures (Manual Page Reference):\n` +
          relevantFigures
            .map(
              (fig) =>
                `- **${fig.figureId}** (Page ${fig.page}): ${fig.title || fig.caption || "Technical diagram"} [Document: ${fig.documentTitle}]`
            )
            .join("\n") +
          `\n*(Generative visual analysis unavailable in offline fallback mode. Please inspect the manual figure directly.)*\n`;
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
${figureNotice}
#### Verified Documentation Excerpts:
${retrieved.map((r, i) => `[${i + 1}] **${r.chunk.documentTitle}** (Page ${r.chunk.page}, ${r.chunk.section || "General"}):\n> ${r.chunk.text}`).join("\n\n")}`;
    }

    // 9. Extract verifiable citations strictly from the retrieved pool, attaching genuine visual figures when available
    const citations: CitationDTO[] = retrieved.map((r, i) => {
      const pageKey = `${r.chunk.documentId}_${r.chunk.page}`;
      const matchingFigures =
        figureCitationMap.get(r.chunk.id) ||
        figureCitationMap.get(pageKey);

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
