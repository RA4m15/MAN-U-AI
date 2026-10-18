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
   * Main RAG execution pipeline with document-level authorization.
   */
  async answerQuestion(
    query: string,
    userContext: { id: string; role?: string } | string,
    conversationId?: string,
    equipmentId?: string
  ): Promise<RagResponse> {
    const userIdStr = typeof userContext === "object" ? userContext.id : userContext;
    const userRole = typeof userContext === "object" ? userContext.role : undefined;

    // 1. Determine permitted document IDs for this user
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
      } catch (err) {
        console.warn("[RagService] Could not resolve permitted document IDs:", err);
        permittedDocIds = [];
      }
    } else {
      // In disconnected mode: production strictly fails closed ([]), dev/test allows in-memory fixture lookup
      permittedDocIds = env.NODE_ENV === "production" ? [] : undefined;
    }

    // 2. Generate query embedding
    const queryEmbedding = await geminiService.generateEmbedding(query);

    // Load active persistent / runtime settings
    const { getActiveRuntimeSettings } = await import("../routes/settings.routes");
    const activeSettings = getActiveRuntimeSettings();

    // 3. Retrieve relevant chunks via hybrid search (filtered to authorized documents)
    const retrieved = await vectorService.searchSimilar(
      queryEmbedding,
      query,
      activeSettings.topK,
      activeSettings.similarityThreshold,
      permittedDocIds
    );

    // 4. Check for insufficient evidence
    if (retrieved.length === 0) {
      return {
        answer:
          "I could not locate sufficient verified documentation in your authorized knowledge index to answer this inquiry safely. Please upload the relevant equipment manual or check with a certified plant supervisor.",
        citations: [],
        warningLevel: "none",
        confidenceScore: 0.1,
      };
    }

    // 5. Determine safety severity level based on query keywords
    const lowerQuery = query.toLowerCase();
    const isCritical =
      lowerQuery.includes("loto") ||
      lowerQuery.includes("lockout") ||
      lowerQuery.includes("high voltage") ||
      lowerQuery.includes("ammonia") ||
      lowerQuery.includes("hydraulic bleed");

    const warningLevel = isCritical ? "critical" : "caution";

    // 6. Construct grounded system prompt
    const evidenceBlocks = retrieved
      .map(
        (r, i) =>
          `[EVIDENCE ${i + 1}] Source: "${r.chunk.documentTitle}" (Rev: ${r.chunk.revision}), Page ${r.chunk.page}, Section: "${r.chunk.section || "General"}"\nContent: "${r.chunk.text}"`
      )
      .join("\n\n");

    const prompt = `You are MAN-U-AI, an expert Industrial Reliability Engineering AI Copilot.
You answer questions regarding equipment manuals, SOPs, fault codes, schematics, and maintenance procedures.

IMPORTANT SAFETY INSTRUCTIONS:
1. All facts and procedures MUST be grounded in the retrieved evidence below.
2. Structure technical answers with:
   - Required Safety Precautions & LOTO verification (if applicable)
   - Step-by-Step Numbered Technical Procedures
   - Verifiable Specifications (Torques, Tolerances, Lubricants)
3. Never fabricate page numbers, document titles, or torque specifications.
4. Highlight warnings prominently.

RETRIEVED DOCUMENT EVIDENCE:
${evidenceBlocks}

USER QUESTION:
${query}

Respond in clean GitHub Markdown:`;

    // 7. Generate answer
    let answer: string;
    try {
      answer = await geminiService.generateAnswer(prompt, {
        model: activeSettings.selectedModel,
        temperature: activeSettings.temperature,
        systemInstruction: "You are an industrial maintenance AI assistant. Ground all claims in the provided documentation.",
      });
    } catch (err: unknown) {
      if (env.NODE_ENV === "production") {
        throw err;
      }
      answer = `[NOTICE: AI Generative Service Unavailable — Grounded Documentation Mode]

Live generative synthesis could not be completed. The following verified excerpts were retrieved from authorized plant documentation:

${retrieved.map((r, i) => `[${i + 1}] **${r.chunk.documentTitle}** (Page ${r.chunk.page}, ${r.chunk.section || "General"}):\n> ${r.chunk.text}`).join("\n\n")}`;
    }

    // 7. Extract verifiable citations strictly from the retrieved pool
    const citations: CitationDTO[] = retrieved.map((r, i) => ({
      id: `cite-${r.chunk.id}-${i}`,
      documentId: r.chunk.documentId,
      documentTitle: r.chunk.documentTitle,
      revision: r.chunk.revision,
      page: r.chunk.page,
      section: r.chunk.section,
      excerpt: r.chunk.text.slice(0, 220) + (r.chunk.text.length > 220 ? "..." : ""),
    }));


    // 8. Persist audit trail if MongoDB is connected
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
