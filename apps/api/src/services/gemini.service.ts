import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env";
import { SUPPORTED_MODELS } from "./settings.service";

export interface GenerationOptions {
  model?: string;
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
  private ai: GoogleGenAI | null = null;
  public client: any = null;
  private lastProvider: "live-gemini" | "deterministic-fallback" = "deterministic-fallback";

  constructor() {
    if (env.GEMINI_API_KEY && env.GEMINI_API_KEY.length > 5) {
      this.ai = new GoogleGenAI({
        apiKey: env.GEMINI_API_KEY,
        httpOptions: { timeout: 10000 },
      });
      this.client = this.ai;
    }
  }

  getLastProvider(): "live-gemini" | "deterministic-fallback" {
    return this.lastProvider;
  }

  isLiveClientConfigured(): boolean {
    return this.ai !== null && this.client !== null;
  }

  /**
   * Generates a 768-dimensional embedding vector for text chunk.
   * In production mode, failures throw an explicit error to prevent mixing
   * deterministic fallback embeddings with real vector space embeddings.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (this.isLiveClientConfigured() && this.ai) {
      try {
        const response = await this.ai.models.embedContent({
          model: env.GEMINI_EMBEDDING_MODEL,
          contents: text,
          config: {
            outputDimensionality: 768,
          },
        });
        const values = (response as any).embedding?.values || (response as any).embeddings?.[0]?.values;
        if (Array.isArray(values) && values.length === 768) {
          this.lastProvider = "live-gemini";
          return values;
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
   * Model selection is validated against the active allowlist. Retired/deprecated models
   * are rejected or replaced with the configured production model.
   */
  async generateAnswer(prompt: string, options?: GenerationOptions): Promise<string> {
    let targetModel = options?.model || env.GEMINI_MODEL;
    // Reject retired/deprecated models or models not on the server allowlist
    if (!(SUPPORTED_MODELS as readonly string[]).includes(targetModel)) {
      console.warn(
        `[GeminiService] Requested model '${targetModel}' is retired or unsupported; using '${env.GEMINI_MODEL}'`
      );
      targetModel = env.GEMINI_MODEL;
    }

    if (this.isLiveClientConfigured()) {
      try {
        const response = await this.ai!.models.generateContent({
          model: targetModel,
          contents: prompt,
          config: {
            temperature: options?.temperature ?? 0.2,
            systemInstruction: options?.systemInstruction,
          },
        });

        const text = response.text;
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

  /**
   * Transcribes scanned PDF documents using Gemini multimodal vision OCR.
   */
  async transcribePdfWithOcr(pdfBuffer: Buffer): Promise<string> {
    if (!this.isLiveClientConfigured() || !this.ai) {
      throw new Error("Optical character recognition (OCR) unavailable: Gemini multimodal client is not configured.");
    }

    try {
      const base64Data = pdfBuffer.toString("base64");
      const response = await this.ai.models.generateContent({
        model: env.GEMINI_MODEL,
        contents: [
          {
            inlineData: {
              data: base64Data,
              mimeType: "application/pdf",
            },
          },
          {
            text: "Perform optical character recognition (OCR) on this scanned industrial document. Transcribe the text verbatim, preserving page numbers in the format '--- PAGE X ---' and technical headings. Do not summarize or invent text.",
          },
        ],
        config: {
          temperature: 0.1,
        },
      });

      const text = response.text;
      if (!text || text.trim().length === 0) {
        throw new Error("OCR returned empty text.");
      }
      return text;
    } catch (err) {
      throw new Error(`Multimodal OCR extraction failed: ${safeErrorMsg(err)}`);
    }
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
