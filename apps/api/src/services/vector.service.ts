import { DocumentChunk, DocumentModel, IDocumentChunk } from "../models";
import { isConnectedToMongo } from "../config/database";
import { env } from "../config/env";
import { generateDeterministicEmbedding } from "./gemini.service";

export interface ScoredChunk {
  chunk: {
    id: string;
    documentId: string;
    documentTitle: string;
    revision: string;
    page: number;
    section?: string;
    text: string;
  };
  score: number;
}

// Development & testing fixture (Strictly prohibited in production mode)
export const DEMO_CHUNKS_FIXTURE: Array<{
  id: string;
  documentId: string;
  documentTitle: string;
  revision: string;
  page: number;
  section?: string;
  text: string;
  embedding: number[];
}> = [
  {
    id: "chk-01",
    documentId: "doc-01",
    documentTitle: "Centrifugal Slurry Pump Maintenance & Rebuild Manual",
    revision: "Rev 4.1",
    page: 16,
    section: "4.2 Mechanical Seal Rebuild & Dual Cartridge Alignment",
    text: "Mechanical seal replacement on Slurry Pump Model SP-400 requires complete casing depressurization. Tighten four M12 gland retaining nuts in cross-diagonal sequence to 45 N·m. Maximum permissible shaft runout is 0.05 mm. Use FG-2 silicone lubricant for Viton O-rings.",
    embedding: generateDeterministicEmbedding("Mechanical seal replacement on Slurry Pump Model SP-400 requires complete casing depressurization. Tighten four M12 gland retaining nuts in cross-diagonal sequence to 45 N·m. Maximum permissible shaft runout is 0.05 mm. Use FG-2 silicone lubricant for Viton O-rings."),
  },
  {
    id: "chk-02",
    documentId: "doc-02",
    documentTitle: "Standard Operating Procedure: Hydraulic Lockout Tagout (LOTO)",
    revision: "Rev 8.0",
    page: 12,
    section: "3.1 Lockout Tagout Verification",
    text: "Lockout Tagout (LOTO) procedure per OSHA 1910.147. Before servicing hydraulic press HP-400 or centrifugal pump systems, technician must close manual ball valve V-101, apply padlocks, and vent accumulator manifold pressure until zero reading is verified on calibrated test gauge.",
    embedding: generateDeterministicEmbedding("Lockout Tagout (LOTO) procedure per OSHA 1910.147. Before servicing hydraulic press HP-400 or centrifugal pump systems, technician must close manual ball valve V-101, apply padlocks, and vent accumulator manifold pressure until zero reading is verified on calibrated test gauge."),
  },
  {
    id: "chk-03",
    documentId: "doc-03",
    documentTitle: "Rotary Screw Air Compressor Operator Guide",
    revision: "Rev 2.3",
    page: 44,
    section: "Fault Code E-0247 & Discharge High Temp",
    text: "Fault Code E-0247 indicates hydraulic or pneumatic valve stiction or differential pressure exceeding 1.2 bar across the coalescing separator filter. Inspect scavenging line orifice and verify lubricant level before restarting compressor.",
    embedding: generateDeterministicEmbedding("Fault Code E-0247 indicates hydraulic or pneumatic valve stiction or differential pressure exceeding 1.2 bar across the coalescing separator filter. Inspect scavenging line orifice and verify lubricant level before restarting compressor."),
  },
];

// Ephemeral in-memory store for runtime/testing
let ephemeralMemoryChunks: Array<{
  id: string;
  documentId: string;
  documentTitle: string;
  revision: string;
  page: number;
  section?: string;
  text: string;
  embedding: number[];
}> = [];

/**
 * Vector Retrieval Architecture Notice:
 * -------------------------------------------------------------
 * This service implements MongoDB candidate chunk retrieval combined with
 * in-process application-side cosine similarity and keyword boosting,
 * rather than native Atlas Vector Search ($vectorSearch).
 *
 * Rationale & Operational Characteristics:
 * - Compatible with standard MongoDB collections without requiring Atlas Vector Search index provisioning on free M0 tiers.
 * - Chunks are queried from the MongoDB DocumentChunk collection filtered by user-permitted document IDs.
 * - Candidate evaluation is capped at CANDIDATE_CHUNK_LIMIT (500 chunks).
 * - Exact cosine similarity over 768-dimensional embeddings and keyword relevance are evaluated application-side.
 */
export const CANDIDATE_CHUNK_LIMIT = 500;

export class VectorService {
  /**
   * Adds a document chunk into vector index.
   */
  async indexChunk(chunk: {
    id?: string;
    documentId: string;
    documentTitle: string;
    revision: string;
    page: number;
    section?: string;
    text: string;
    embedding: number[];
  }): Promise<void> {
    if (!chunk.embedding || chunk.embedding.length !== 768) {
      throw new Error(`Invalid embedding dimension: chunk requires 768-dimensional embedding, received ${chunk.embedding?.length || 0}`);
    }

    const chunkId = chunk.id || `chk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    ephemeralMemoryChunks.push({ ...chunk, id: chunkId });

    if (isConnectedToMongo) {
      try {
        await DocumentChunk.create({
          documentId: chunk.documentId,
          documentTitle: chunk.documentTitle,
          revision: chunk.revision,
          page: chunk.page,
          section: chunk.section,
          text: chunk.text,
          embedding: chunk.embedding,
          tokenCount: Math.ceil(chunk.text.length / 4),
        });
      } catch (err) {
        console.warn("[VectorService] Error inserting chunk to MongoDB:", err);
        throw err;
      }
    }
  }

  /**
   * Retrieves top-K semantically similar chunks with keyword-hybrid scoring.
   * Uses MongoDB chunk retrieval with application-side cosine similarity.
   * In production mode, retrieval strictly queries real persisted MongoDB chunks.
   */
  async searchSimilar(
    queryEmbedding: number[],
    queryKeywords: string,
    topK = 5,
    minSimilarity = 0.5,
    filterDocIds?: string[]
  ): Promise<ScoredChunk[]> {
    if (!queryEmbedding || queryEmbedding.length !== 768) {
      throw new Error(`Embedding dimension mismatch: query dimension (${queryEmbedding?.length || 0}) is invalid; expected 768 dimensions`);
    }

    // If an explicit filter array is provided and is empty, user has no permitted documents
    if (filterDocIds !== undefined && filterDocIds.length === 0) {
      return [];
    }

    let candidateChunks: Array<{
      id: string;
      documentId: string;
      documentTitle: string;
      revision: string;
      page: number;
      section?: string;
      text: string;
      embedding: number[];
    }> = [];

    const isProduction = env.NODE_ENV === "production";

    // 1. Fetch real persisted chunks from MongoDB
    if (isConnectedToMongo) {
      try {
        const queryFilter: any = {};
        if (filterDocIds && filterDocIds.length > 0) {
          queryFilter.documentId = { $in: filterDocIds };
        } else if (filterDocIds === undefined) {
          const indexedDocs = await DocumentModel.find({ status: "indexed" }).select("_id").lean();
          const indexedIds = indexedDocs.map((d: any) => d._id.toString());
          queryFilter.documentId = { $in: indexedIds };
        }

        const mongoChunks = await DocumentChunk.find(queryFilter).limit(CANDIDATE_CHUNK_LIMIT).lean();
        if (mongoChunks.length > 0) {
          candidateChunks = mongoChunks.map((c) => ({
            id: c._id.toString(),
            documentId: c.documentId.toString(),
            documentTitle: c.documentTitle,
            revision: c.revision,
            page: c.page,
            section: c.section,
            text: c.text,
            embedding: c.embedding,
          }));
        }
      } catch (err) {
        console.warn("[VectorService] MongoDB chunk lookup failed:", err);
        if (isProduction) {
          throw new Error("Vector database search failure in production environment");
        }
      }
    } else if (isProduction) {
      // In production, if MongoDB is disconnected, fail safely without returning demonstration data
      throw new Error("Production vector search unavailable: MongoDB database is disconnected");
    }

    // In development or test environments ONLY: allow fallback to test fixtures if DB has no chunks
    if (!isProduction && candidateChunks.length === 0) {
      let devPool = [...ephemeralMemoryChunks, ...DEMO_CHUNKS_FIXTURE];
      if (filterDocIds && filterDocIds.length > 0) {
        devPool = devPool.filter((c) => filterDocIds.includes(c.documentId));
      }
      candidateChunks = devPool;
    }

    if (candidateChunks.length === 0) {
      return [];
    }

    // Filter by allowed document IDs if not already applied
    if (filterDocIds && filterDocIds.length > 0) {
      candidateChunks = candidateChunks.filter((c) => filterDocIds.includes(c.documentId));
    }

    // Compute hybrid score: Combines Cosine Vector Similarity with Technical Keyword Overlap
    const stopwords = new Set(["what", "the", "for", "and", "are", "with", "how", "does", "from", "into"]);
    const cleanTokens = queryKeywords
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopwords.has(w));

    const scored: ScoredChunk[] = candidateChunks.map((c) => {
      const cosineSim = this.computeCosineSimilarity(queryEmbedding, c.embedding);

      let keywordMatches = 0;
      const lowerText = (c.text + " " + (c.section || "") + " " + c.documentTitle).toLowerCase();
      for (const kw of cleanTokens) {
        if (lowerText.includes(kw)) {
          keywordMatches++;
        }
      }
      const keywordRatio = cleanTokens.length > 0 ? keywordMatches / cleanTokens.length : 0;
      const hybridScore = keywordMatches > 0
        ? Math.max(cosineSim, 0.45 + keywordRatio * 0.45)
        : cosineSim * 0.5;

      return {
        chunk: {
          id: c.id,
          documentId: c.documentId,
          documentTitle: c.documentTitle,
          revision: c.revision,
          page: c.page,
          section: c.section,
          text: c.text,
        },
        score: hybridScore,
      };
    });

    return scored
      .filter((s) => s.score >= minSimilarity)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  computeCosineSimilarity(a: number[], b: number[]): number {
    if (!a || !b || !a.length || !b.length) {
      throw new Error("Vector dimension error: vectors cannot be empty");
    }

    if (a.length !== b.length) {
      throw new Error(`Embedding dimension mismatch: query dimension (${a.length}) does not match chunk dimension (${b.length})`);
    }

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dot / denominator;
  }
}

export const vectorService = new VectorService();
