import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "../config/env";

export interface GenerationOptions {
  temperature?: number;
  systemInstruction?: string;
}

export function generateDeterministicEmbedding(text: string, dimensions = 768): number[] {
  const vector: number[] = new Array(dimensions).fill(0);
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const index = (charCode * 31 + i) % dimensions;
    vector[index] += Math.sin(charCode);
  }
  // Normalize to unit vector
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
}

function safeErrorMsg(err: unknown): string {
  if (!err) return "Unknown error";
  const msg = err instanceof Error ? err.message : String(err);
  return msg.replace(/(?:key|apiKey)=[a-zA-Z0-9_\-]+/gi, "key=[REDACTED]");
}

export class GeminiService {
  private client: GoogleGenerativeAI | null = null;
  private lastProvider: "live-gemini" | "deterministic-fallback" = "deterministic-fallback";

  constructor() {
    if (env.GEMINI_API_KEY && env.GEMINI_API_KEY.length > 5) {
      this.client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    }
  }

  getLastProvider(): "live-gemini" | "deterministic-fallback" {
    return this.lastProvider;
  }

  isLiveClientConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Generates a 768-dimensional embedding vector for text chunk.
   * In production mode, failures throw an explicit error to prevent mixing
   * deterministic fallback embeddings with real vector space embeddings.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (this.client) {
      try {
        const model = this.client.getGenerativeModel({ model: env.GEMINI_EMBEDDING_MODEL });
        const result = await model.embedContent({
          content: { role: "user", parts: [{ text }] },
          outputDimensionality: 768,
        } as any);
        if (result.embedding?.values && result.embedding.values.length === 768) {
          this.lastProvider = "live-gemini";
          return result.embedding.values;
        }
      } catch (err) {
        const msg = safeErrorMsg(err);
        console.warn("[GeminiService] Remote embedding failure:", msg);
        if (env.NODE_ENV === "production") {
          throw new Error(`Live Gemini embedding generation failed in production: ${msg}`);
        }
      }
    }

    if (env.NODE_ENV === "production") {
      throw new Error(
        "Production environment requires a configured and operational live Gemini embedding client. Deterministic fallback embeddings are prohibited in production."
      );
    }

    // Offline deterministic fallback is confined strictly to development/test environments
    this.lastProvider = "deterministic-fallback";
    return generateDeterministicEmbedding(text, 768);
  }

  /**
   * Generates response text from multimodal context or prompt.
   */
  async generateAnswer(prompt: string, options?: GenerationOptions): Promise<string> {
    if (this.client) {
      try {
        const model = this.client.getGenerativeModel({
          model: env.GEMINI_MODEL,
          generationConfig: {
            temperature: options?.temperature ?? 0.2,
          },
          systemInstruction: options?.systemInstruction,
        });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        if (text && text.trim().length > 0) {
          this.lastProvider = "live-gemini";
          return text;
        }
      } catch (err) {
        console.warn("[GeminiService] Live Gemini API notice (falling back):", safeErrorMsg(err));
      }
    }

    if (env.NODE_ENV === "production") {
      this.lastProvider = "deterministic-fallback";
      throw new Error("AI generation service is currently unavailable. Generative synthesis failed or API key is not configured.");
    }

    this.lastProvider = "deterministic-fallback";
    return this.generateGroundedFallback(prompt);
  }

  private generateGroundedFallback(prompt: string): string {
    return `### [NOTICE: AI Generative Service Unavailable — Offline Documentation Mode]

Live AI synthesis is currently unavailable in this environment.

To ensure plant safety and procedural compliance:
- Do not rely on unverified generative steps.
- Inspect the verified citation excerpts attached to this response for authorized specifications, torques, and tolerances.
- Consult the physical manufacturer manual or a certified plant reliability engineer.`;
  }
}

export const geminiService = new GeminiService();
