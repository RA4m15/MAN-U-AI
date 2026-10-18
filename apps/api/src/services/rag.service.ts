import mongoose from "mongoose";
import { geminiService } from "./gemini.service";
import { vectorService, ScoredChunk } from "./vector.service";
import { Message, Conversation, AuditEvent } from "../models";

import { isConnectedToMongo } from "../config/database";
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
   * Main RAG execution pipeline.
   */
  async answerQuestion(
    query: string,
    userId: string,
    conversationId?: string,
    equipmentId?: string
  ): Promise<RagResponse> {
    // 1. Generate query embedding
    const queryEmbedding = await geminiService.generateEmbedding(query);

    // 2. Retrieve relevant chunks via hybrid search (minimum similarity 0.40 to filter out unrelated queries)
    const retrieved = await vectorService.searchSimilar(queryEmbedding, query, 5, 0.40);

    // 3. Check for insufficient evidence
    if (retrieved.length === 0) {
      return {
        answer:
          "I could not locate sufficient verified documentation in the current knowledge index to answer this inquiry safely. Please upload the relevant equipment manual or check with a certified plant supervisor.",
        citations: [],
        warningLevel: "none",
        confidenceScore: 0.1,
      };
    }

    // 4. Determine safety severity level based on query keywords
    const lowerQuery = query.toLowerCase();
    const isCritical =
      lowerQuery.includes("loto") ||
      lowerQuery.includes("lockout") ||
      lowerQuery.includes("high voltage") ||
      lowerQuery.includes("ammonia") ||
      lowerQuery.includes("hydraulic bleed");

    const warningLevel = isCritical ? "critical" : "caution";

    // 5. Construct grounded system prompt
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

    // 6. Generate answer
    const answer = await geminiService.generateAnswer(prompt, {
      temperature: 0.2,
      systemInstruction: "You are an industrial maintenance AI assistant. Ground all claims in the provided documentation.",
    });

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
          userId: (userId && mongoose.Types.ObjectId.isValid(userId)) ? userId : undefined,
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
