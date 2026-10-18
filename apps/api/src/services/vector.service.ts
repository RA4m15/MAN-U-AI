import { DocumentChunk, IDocumentChunk } from "../models";
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

const CHUNK_TEXT_1 = "Mechanical seal replacement on Slurry Pump Model SP-400 requires complete casing depressurization. Tighten four M12 gland retaining nuts in cross-diagonal sequence to 45 N·m. Maximum permissible shaft runout is 0.05 mm. Use FG-2 silicone lubricant for Viton O-rings.";
const CHUNK_TEXT_2 = "Lockout Tagout (LOTO) procedure per OSHA 1910.147. Before servicing hydraulic press HP-400 or centrifugal pump systems, technician must close manual ball valve V-101, apply padlocks, and vent accumulator manifold pressure until zero reading is verified on calibrated test gauge.";
const CHUNK_TEXT_3 = "Fault Code E-0247 indicates hydraulic or pneumatic valve stiction or differential pressure exceeding 1.2 bar across the coalescing separator filter. Inspect scavenging line orifice and verify lubricant level before restarting compressor.";

// In-memory cache for fast search when MongoDB Vector Search is not deployed or during tests
const inMemoryChunks: Array<{
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
    text: CHUNK_TEXT_1,
    embedding: generateDeterministicEmbedding(CHUNK_TEXT_1),
  },
  {
    id: "chk-02",
    documentId: "doc-02",
    documentTitle: "Standard Operating Procedure: Hydraulic Lockout Tagout (LOTO)",
    revision: "Rev 8.0",
    page: 12,
    section: "3.1 Lockout Tagout Verification",
    text: CHUNK_TEXT_2,
    embedding: generateDeterministicEmbedding(CHUNK_TEXT_2),
  },
  {
    id: "chk-03",
    documentId: "doc-03",
    documentTitle: "Rotary Screw Air Compressor Operator Guide",
    revision: "Rev 2.3",
    page: 44,
    section: "Fault Code E-0247 & Discharge High Temp",
    text: CHUNK_TEXT_3,
    embedding: generateDeterministicEmbedding(CHUNK_TEXT_3),
  },
];

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
    const chunkId = chunk.id || `chk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    inMemoryChunks.push({ ...chunk, id: chunkId });

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
      }
    }
  }

  /**
   * Retrieves top-K semantically similar chunks with keyword-hybrid scoring.
   */
  async searchSimilar(
    queryEmbedding: number[],
    queryKeywords: string,
    topK = 5,
    minSimilarity = 0.5,
    filterDocIds?: string[]
  ): Promise<ScoredChunk[]> {
    let candidateChunks = inMemoryChunks;

    // When connected to MongoDB, pull persisted chunks directly from DocumentChunk collection
    if (isConnectedToMongo) {
      try {
        const mongoChunks = await DocumentChunk.find().limit(500).lean();
        if (mongoChunks.length > 0) {
          const mappedMongoChunks = mongoChunks.map((c) => ({
            id: c._id.toString(),
            documentId: c.documentId.toString(),
            documentTitle: c.documentTitle,
            revision: c.revision,
            page: c.page,
            section: c.section,
            text: c.text,
            embedding: c.embedding,
          }));

          // Merge MongoDB chunks with in-memory seed chunks, prioritizing persisted MongoDB chunks
          const seen = new Set<string>();
          candidateChunks = [];
          for (const chunk of [...mappedMongoChunks, ...inMemoryChunks]) {
            const key = `${chunk.documentTitle}:${chunk.page}:${chunk.text.slice(0, 40)}`;
            if (!seen.has(key)) {
              seen.add(key);
              candidateChunks.push(chunk);
            }
          }
        }
      } catch (err) {
        console.warn("[VectorService] MongoDB chunk lookup failed, using local in-memory pool:", err);
      }
    }

    if (filterDocIds && filterDocIds.length > 0) {
      candidateChunks = candidateChunks.filter((c) => filterDocIds.includes(c.documentId));
    }

    // Compute hybrid score: Combines Cosine Vector Similarity with Exact Technical Keyword Overlap
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
      // High-precision industrial hybrid score: exact technical matches guarantee high relevance.
      // If query has zero keyword overlap with manual content, scale down to prevent hallucinations.
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

  private computeCosineSimilarity(a: number[], b: number[]): number {
    if (!a.length || !b.length || a.length !== b.length) {
      return 0.75; // Default safe fallback
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
