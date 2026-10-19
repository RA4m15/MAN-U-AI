import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env";
import { SUPPORTED_MODELS, getModelCapabilities } from "./settings.service";

export interface GenerationOptions {
  model?: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  systemInstruction?: string;
}

/**
 * Builds runtime generation configuration for the active Gemini model.
 * Modern Gemini models (gemini-3.8-flash, gemini-3.6-flash, gemini-4-argon) enforce
 * strict deterministic reasoning and reject/ignore sampling parameters
 * (temperature, top_p, generation top_k). For these models, sampling parameters are omitted entirely.
 */
export function buildModelGenerationConfig(
  targetModel: string,
  options?: GenerationOptions
): Record<string, any> | undefined {
  const config: Record<string, any> = {};

  if (options?.systemInstruction) {
    config.systemInstruction = options.systemInstruction;
  }

  const capabilities = getModelCapabilities(targetModel);

  if (capabilities.supportsTemperature && typeof options?.temperature === "number") {
    config.temperature = options.temperature;
  }
  if (capabilities.supportsTopP && typeof options?.topP === "number") {
    config.topP = options.topP;
  }
  if (capabilities.supportsGenerationTopK && typeof options?.topK === "number") {
    config.topK = options.topK;
  }

  return Object.keys(config).length > 0 ? config : undefined;
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

export interface QuotaFailureInfo {
  isQuotaExhausted: boolean;
  isZeroQuota: boolean;
  isModelUnavailable: boolean;
  isProviderOutage: boolean;
  retryDelaySeconds?: number;
  safeMessage: string;
  category: "quota_exhausted" | "zero_quota" | "model_unavailable" | "provider_outage" | "unknown";
}

export function analyzeProviderError(err: unknown): QuotaFailureInfo {
  if (!err) {
    return {
      isQuotaExhausted: false,
      isZeroQuota: false,
      isModelUnavailable: false,
      isProviderOutage: false,
      safeMessage: "An unexpected error occurred during AI generation. Please try again later.",
      category: "unknown",
    };
  }

  const rawMessage = err instanceof Error ? err.message : String(err);
  let status = (err as any)?.status || (err as any)?.httpStatus || (err as any)?.statusCode || 500;

  let errorObj: any = null;
  if (typeof (err as any)?.error === "object" && (err as any)?.error !== null) {
    errorObj = (err as any).error;
  } else {
    const jsonMatch = rawMessage.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        errorObj = parsed?.error || parsed;
      } catch {
        // Not valid JSON
      }
    }
  }

  if (errorObj?.code && typeof errorObj.code === "number") {
    status = errorObj.code;
  }

  // Check for limit: 0 or zero quota violations (model has no free tier allocation)
  const isZeroQuota =
    /limit:\s*0/i.test(rawMessage) ||
    errorObj?.message?.includes("limit: 0") ||
    (Array.isArray(errorObj?.details) &&
      errorObj.details.some((d: any) =>
        Array.isArray(d.violations) && d.violations.some((v: any) => v.quotaValue === "0" || v.quotaValue === 0)
      ));

  // Extract retry delay if provided by Google API
  let retryDelaySeconds: number | undefined;
  if (Array.isArray(errorObj?.details)) {
    const retryInfo = errorObj.details.find((d: any) => d["@type"]?.includes("RetryInfo") || d.retryDelay);
    if (retryInfo?.retryDelay) {
      const match = String(retryInfo.retryDelay).match(/^([0-9]+(?:\.[0-9]+)?)s?$/);
      if (match) {
        retryDelaySeconds = Math.round(parseFloat(match[1]));
      }
    }
  }

  // Check for 429 / Quota Exhaustion
  const isQuotaExhausted =
    status === 429 ||
    errorObj?.status === "RESOURCE_EXHAUSTED" ||
    /RESOURCE_EXHAUSTED|quota exceeded|exceeded your current quota|rate limit/i.test(rawMessage);

  // Check for Model Unavailable / Access Denied
  const isModelUnavailable =
    isZeroQuota ||
    status === 404 ||
    status === 403 ||
    /is not supported|is no longer available|model not found|permission denied|access denied/i.test(rawMessage);

  // Check for Provider Outage / High Demand (503)
  const isProviderOutage =
    status === 503 ||
    /high demand|Spikes in demand|overloaded|service unavailable|temporarily unavailable/i.test(rawMessage);

  let category: QuotaFailureInfo["category"] = "unknown";
  let safeMessage = "An unexpected error occurred during AI generation. Please try again later.";

  if (isZeroQuota) {
    category = "zero_quota";
    safeMessage = "The requested AI model is currently unavailable or not accessible with the current project credentials. Please verify model configuration.";
  } else if (isQuotaExhausted) {
    category = "quota_exhausted";
    safeMessage = "AI generation is temporarily unavailable because the configured model quota has been reached. Check the Gemini API project's quota and billing settings, or try again later.";
  } else if (isModelUnavailable) {
    category = "model_unavailable";
    safeMessage = "The requested AI model is currently unavailable or not accessible with the current project credentials. Please verify model configuration.";
  } else if (isProviderOutage) {
    category = "provider_outage";
    safeMessage = "The AI generation service is temporarily unavailable due to high upstream demand. Please try again shortly.";
  }

  return {
    isQuotaExhausted,
    isZeroQuota,
    isModelUnavailable,
    isProviderOutage,
    retryDelaySeconds,
    safeMessage,
    category,
  };
}

export class ModelQuotaTracker {
  private quotaState = new Map<
    string,
    {
      exhaustedUntil: number;
      hasZeroQuota: boolean;
      lastCategory: string;
      lastFailureTime: number;
    }
  >();

  recordFailure(model: string, err: unknown): QuotaFailureInfo {
    const analysis = analyzeProviderError(err);
    const now = Date.now();
    let cooldownMs = 60_000; // default 1 min

    if (analysis.isZeroQuota) {
      // Models with zero quota on active tier stay disabled
      cooldownMs = 24 * 60 * 60 * 1000;
    } else if (analysis.retryDelaySeconds && analysis.retryDelaySeconds > 0) {
      cooldownMs = Math.min(analysis.retryDelaySeconds * 1000, 24 * 60 * 60 * 1000);
    } else if (analysis.isQuotaExhausted) {
      cooldownMs = 10 * 60 * 1000;
    } else if (analysis.isProviderOutage) {
      cooldownMs = 30 * 1000;
    }

    this.quotaState.set(model, {
      exhaustedUntil: now + cooldownMs,
      hasZeroQuota: analysis.isZeroQuota,
      lastCategory: analysis.category,
      lastFailureTime: now,
    });

    return analysis;
  }

  recordSuccess(model: string): void {
    this.quotaState.delete(model);
  }

  isAvailable(model: string): boolean {
    const state = this.quotaState.get(model);
    if (!state) return true;
    if (state.hasZeroQuota) return false;
    return Date.now() >= state.exhaustedUntil;
  }

  getCooldownRemaining(model: string): number {
    const state = this.quotaState.get(model);
    if (!state) return 0;
    const remaining = state.exhaustedUntil - Date.now();
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
  }

  clear(): void {
    this.quotaState.clear();
  }
}

export const modelQuotaTracker = new ModelQuotaTracker();

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
   * Builds ordered list of candidate models for generation.
   * When prioritizeTarget is true (e.g. caller passed explicit model), target model is always first.
   * Otherwise, currently available models are prioritized over models in cooldown.
   */
  getCandidateModels(targetModel: string, prioritizeTarget = false): string[] {
    const candidates: string[] = [targetModel];

    for (const m of SUPPORTED_MODELS) {
      if (!candidates.includes(m)) {
        candidates.push(m);
      }
    }

    if (env.GEMINI_FALLBACK_MODELS) {
      const configuredFallbacks = env.GEMINI_FALLBACK_MODELS.split(",")
        .map((m) => m.trim())
        .filter((m) => m.length > 0 && !candidates.includes(m));
      candidates.push(...configuredFallbacks);
    }

    // Filter out models known to have permanent zero quota on the free tier (like gemini-4-argon)
    const filtered = candidates.filter((m) => {
      const state = (modelQuotaTracker as any).quotaState?.get(m);
      return !state?.hasZeroQuota || m === targetModel;
    });

    const activeList = filtered.length > 0 ? filtered : candidates;

    if (prioritizeTarget) {
      const remainingAvailable = activeList.filter((m) => m !== targetModel && modelQuotaTracker.isAvailable(m));
      const remainingCooldown = activeList.filter((m) => m !== targetModel && !modelQuotaTracker.isAvailable(m));
      return [targetModel, ...remainingAvailable, ...remainingCooldown];
    }

    // Prioritize models that are not in cooldown
    const available = activeList.filter((m) => modelQuotaTracker.isAvailable(m));
    const inCooldown = activeList.filter((m) => !modelQuotaTracker.isAvailable(m));

    return [...available, ...inCooldown];
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
   * Model selection is validated against the active allowlist.
   * Applies quota-aware candidate model failover and circuit-breaking.
   */
  async generateAnswer(prompt: string, options?: GenerationOptions): Promise<string> {
    const isExplicitModel = Boolean(options?.model);
    let targetModel = options?.model || env.GEMINI_MODEL;
    // Reject retired/deprecated models or models not on the server allowlist
    if (!(SUPPORTED_MODELS as readonly string[]).includes(targetModel)) {
      console.warn(
        `[GeminiService] Requested model '${targetModel}' is retired or unsupported; using '${env.GEMINI_MODEL}'`
      );
      targetModel = env.GEMINI_MODEL;
    }

    if (this.isLiveClientConfigured()) {
      const candidateModels = this.getCandidateModels(targetModel, isExplicitModel);

      // Check if all candidates are currently in quota cooldown; if in production, fail immediately without long sleep
      const anyAvailable = candidateModels.some((m) => modelQuotaTracker.isAvailable(m));
      if (!anyAvailable && candidateModels.length > 0 && env.NODE_ENV === "production") {
        const cooldownRemaining = Math.max(...candidateModels.map((m) => modelQuotaTracker.getCooldownRemaining(m)));
        const safeMsg =
          "AI generation is temporarily unavailable because the configured model quota has been reached. Check the Gemini API project's quota and billing settings, or try again later.";

        console.warn(
          `[GeminiService] All candidate models in quota cooldown. Short-circuiting request. Cooldown: ${cooldownRemaining}s`
        );

        this.lastProvider = "deterministic-fallback";
        const customErr = new Error(
          `AI generation service is currently unavailable. Generative synthesis failed across candidate models: ${safeMsg}`
        );
        (customErr as any).code = "LLM_QUOTA_EXHAUSTED";
        (customErr as any).httpStatus = 503;
        (customErr as any).userMessage = safeMsg;
        (customErr as any).sanitizedMessage = safeMsg;
        (customErr as any).retryAfterSeconds =
          cooldownRemaining > 0 && cooldownRemaining <= 300 ? cooldownRemaining : undefined;
        throw customErr;
      }

      let lastError: unknown = null;
      let lastAnalysis: QuotaFailureInfo | null = null;
      const attemptedModels: string[] = [];

      for (const candidateModel of candidateModels) {
        // Skip models in cooldown if we have other available candidate options, unless explicitly requested
        if (!modelQuotaTracker.isAvailable(candidateModel) && anyAvailable) {
          if (!isExplicitModel || candidateModel !== targetModel) {
            console.log(`[GeminiService] Skipping model '${candidateModel}' (in cooldown or zero quota)`);
            continue;
          }
        }

        attemptedModels.push(candidateModel);
        try {
          const generationConfig = buildModelGenerationConfig(candidateModel, options);
          const payload: Record<string, any> = {
            model: candidateModel,
            contents: prompt,
          };
          if (generationConfig) {
            payload.config = generationConfig;
          }

          const response = await (this.ai!.models.generateContent as any)(payload);

          const text = response.text;
          if (text && text.trim().length > 0) {
            modelQuotaTracker.recordSuccess(candidateModel);
            this.lastProvider = "live-gemini";
            return text;
          }
        } catch (err) {
          lastError = err;
          lastAnalysis = modelQuotaTracker.recordFailure(candidateModel, err);
          console.warn(
            `[GeminiService] Model '${candidateModel}' failed (${lastAnalysis.category}): ${lastAnalysis.safeMessage}. Trying next candidate model...`
          );
        }
      }

      if (lastError) {
        console.warn(
          `[GeminiService] All candidate Gemini models exhausted (attempted: ${attemptedModels.join(", ")}):`,
          safeErrorMsg(lastError)
        );
      }

      const safeUserMessage =
        lastAnalysis?.safeMessage ||
        "AI generation is temporarily unavailable because the configured model quota has been reached. Check the Gemini API project's quota and billing settings, or try again later.";

      const failureCode =
        lastAnalysis?.category === "quota_exhausted"
          ? "LLM_QUOTA_EXHAUSTED"
          : lastAnalysis?.category === "zero_quota" || lastAnalysis?.category === "model_unavailable"
          ? "LLM_MODEL_UNAVAILABLE"
          : lastAnalysis?.category === "provider_outage"
          ? "LLM_PROVIDER_UNAVAILABLE"
          : "LLM_PROVIDER_ERROR";

      if (env.NODE_ENV === "production") {
        this.lastProvider = "deterministic-fallback";
        const customErr = new Error(
          `AI generation service is currently unavailable. Generative synthesis failed across candidate models: ${safeUserMessage}`
        );
        (customErr as any).code = failureCode;
        (customErr as any).httpStatus = 503;
        (customErr as any).userMessage = safeUserMessage;
        (customErr as any).sanitizedMessage = safeUserMessage;
        (customErr as any).originalError = lastError;
        (customErr as any).retryAfterSeconds =
          lastAnalysis?.retryDelaySeconds && lastAnalysis.retryDelaySeconds <= 300
            ? lastAnalysis.retryDelaySeconds
            : undefined;
        throw customErr;
      }
    }

    if (env.NODE_ENV === "production") {
      this.lastProvider = "deterministic-fallback";
      const customErr = new Error(
        "AI generation service is currently unavailable. Generative synthesis failed or API key is not configured."
      );
      (customErr as any).code = "LLM_PROVIDER_ERROR";
      (customErr as any).httpStatus = 503;
      throw customErr;
    }

    this.lastProvider = "deterministic-fallback";
    return this.generateGroundedFallback(prompt);
  }

  /**
   * Transcribes scanned PDF documents using Gemini multimodal vision OCR.
   * Model generation settings strictly respect model capabilities.
   * Supports candidate model failover if the primary model encounters rate limits or errors.
   */
  async transcribePdfWithOcr(pdfBuffer: Buffer, modelOverride?: string): Promise<string> {
    if (!this.isLiveClientConfigured() || !this.ai) {
      throw new Error("Optical character recognition (OCR) unavailable: Gemini multimodal client is not configured.");
    }

    const isExplicitModel = Boolean(modelOverride);
    const primaryModel = modelOverride || env.GEMINI_MODEL;
    const candidateModels = this.getCandidateModels(primaryModel, isExplicitModel);
    const anyAvailable = candidateModels.some((m) => modelQuotaTracker.isAvailable(m));

    let lastOcrErr: unknown = null;
    let lastAnalysis: QuotaFailureInfo | null = null;
    const base64Data = pdfBuffer.toString("base64");

    for (const targetModel of candidateModels) {
      if (!modelQuotaTracker.isAvailable(targetModel) && anyAvailable) {
        if (!isExplicitModel || targetModel !== primaryModel) {
          continue;
        }
      }

      try {
        const generationConfig = buildModelGenerationConfig(targetModel, {
          temperature: 0.1,
        });

        const payload: Record<string, any> = {
          model: targetModel,
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
        };

        if (generationConfig) {
          payload.config = generationConfig;
        }

        const response = await (this.ai.models.generateContent as any)(payload);

        const text = response.text;
        if (text && text.trim().length > 0) {
          modelQuotaTracker.recordSuccess(targetModel);
          return text;
        }
      } catch (err) {
        lastOcrErr = err;
        lastAnalysis = modelQuotaTracker.recordFailure(targetModel, err);
        console.warn(`[GeminiService] OCR attempt with model '${targetModel}' failed: ${safeErrorMsg(err)}`);
      }
    }

    const safeMsg = lastAnalysis?.safeMessage || "Multimodal OCR extraction failed across candidate models.";
    const ocrErr = new Error(`Multimodal OCR extraction failed across candidate models: ${safeMsg}`);
    (ocrErr as any).code = "LLM_PROVIDER_ERROR";
    (ocrErr as any).httpStatus = 503;
    throw ocrErr;
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
