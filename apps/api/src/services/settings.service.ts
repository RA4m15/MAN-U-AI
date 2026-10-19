import { FacilitySettings, IFacilitySettings } from "../models";
import { isConnectedToMongo } from "../config/database";
import { env } from "../config/env";

export const SUPPORTED_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.6-flash",
  "gemini-4-argon",
] as const;

export type SupportedModel = (typeof SUPPORTED_MODELS)[number];

export interface ModelCapabilities {
  supportsTemperature: boolean;
  supportsTopP: boolean;
  supportsGenerationTopK: boolean;
}

export const MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
  "gemini-3.8-flash": {
    supportsTemperature: false,
    supportsTopP: false,
    supportsGenerationTopK: false,
  },
  "gemini-3.6-flash": {
    supportsTemperature: false,
    supportsTopP: false,
    supportsGenerationTopK: false,
  },
  "gemini-4-argon": {
    supportsTemperature: false,
    supportsTopP: false,
    supportsGenerationTopK: false,
  },
  // Legacy / reference models for capability verification
  "gemini-1.5-pro": {
    supportsTemperature: true,
    supportsTopP: true,
    supportsGenerationTopK: true,
  },
  "gemini-1.5-flash": {
    supportsTemperature: true,
    supportsTopP: true,
    supportsGenerationTopK: true,
  },
};

export function getModelCapabilities(model: string): ModelCapabilities {
  if (model in MODEL_CAPABILITIES) {
    return MODEL_CAPABILITIES[model];
  }
  return {
    supportsTemperature: false,
    supportsTopP: false,
    supportsGenerationTopK: false,
  };
}

export interface FacilitySettingsData {
  facilityName: string;
  timezone: string;
  selectedModel: SupportedModel;
  temperature: number;
  topK: number;
  similarityThreshold: number;
  updatedAt?: string | null;
}

export const DEFAULT_SETTINGS: FacilitySettingsData = {
  facilityName: "MAN-U-AI Heavy Operations Facility Alpha",
  timezone: "UTC",
  selectedModel: (SUPPORTED_MODELS.includes(env.GEMINI_MODEL as any)
    ? env.GEMINI_MODEL
    : "gemini-3.6-flash") as SupportedModel,
  temperature: 0.2,
  topK: 5,
  similarityThreshold: 0.5,
};

export class SettingsService {
  private cache: FacilitySettingsData | null = null;

  /**
   * Resets local process cache. Used for simulating application restarts in tests.
   */
  clearCache(): void {
    this.cache = null;
  }

  /**
   * Authoritative retrieval of active settings.
   * If cache is populated, returns cached settings.
   * If not, asynchronously queries MongoDB.
   * If no document exists in MongoDB, initializes and persists default settings.
   * Throws an error if MongoDB is disconnected or if the query fails.
   */
  async getEffectiveSettings(): Promise<FacilitySettingsData> {
    if (this.cache) {
      return { ...this.cache };
    }

    if (!isConnectedToMongo) {
      throw new Error("Database disconnected. Cannot retrieve persistent facility settings.");
    }

    const doc = await FacilitySettings.findOne().sort({ updatedAt: -1 });
    if (doc) {
      const sanitizedModel: SupportedModel = (SUPPORTED_MODELS as readonly string[]).includes(doc.selectedModel)
        ? (doc.selectedModel as SupportedModel)
        : DEFAULT_SETTINGS.selectedModel;

      this.cache = {
        facilityName: doc.facilityName || DEFAULT_SETTINGS.facilityName,
        timezone: doc.timezone || DEFAULT_SETTINGS.timezone,
        selectedModel: sanitizedModel,
        temperature: typeof doc.temperature === "number" ? doc.temperature : DEFAULT_SETTINGS.temperature,
        topK: typeof doc.topK === "number" ? doc.topK : DEFAULT_SETTINGS.topK,
        similarityThreshold:
          typeof doc.similarityThreshold === "number" ? doc.similarityThreshold : DEFAULT_SETTINGS.similarityThreshold,
        updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : null,
      };
      return { ...this.cache };
    }

    // No settings document in database, but MongoDB is connected: initialize defaults into MongoDB
    try {
      const created = await FacilitySettings.create({
        ...DEFAULT_SETTINGS,
      });
      this.cache = {
        facilityName: created.facilityName,
        timezone: created.timezone,
        selectedModel: created.selectedModel as SupportedModel,
        temperature: created.temperature,
        topK: created.topK,
        similarityThreshold: created.similarityThreshold,
        updatedAt: created.updatedAt ? created.updatedAt.toISOString() : null,
      };
      return { ...this.cache };
    } catch {
      // If concurrent insert or collision occurred, re-query
      const retry = await FacilitySettings.findOne().sort({ updatedAt: -1 });
      if (retry) {
        this.cache = {
          facilityName: retry.facilityName,
          timezone: retry.timezone,
          selectedModel: ((SUPPORTED_MODELS as readonly string[]).includes(retry.selectedModel)
            ? retry.selectedModel
            : DEFAULT_SETTINGS.selectedModel) as SupportedModel,
          temperature: retry.temperature,
          topK: retry.topK,
          similarityThreshold: retry.similarityThreshold,
          updatedAt: retry.updatedAt ? retry.updatedAt.toISOString() : null,
        };
        return { ...this.cache };
      }
      throw new Error("Failed to initialize or retrieve persistent facility settings from database.");
    }
  }

  /**
   * Updates settings with database-first persistence.
   * Updates local cache ONLY after MongoDB successfully confirms the write.
   */
  async updateSettings(updates: Partial<FacilitySettingsData>): Promise<FacilitySettingsData> {
    if (!isConnectedToMongo) {
      throw new Error("Database disconnected. Cannot persist facility settings.");
    }

    if (updates.selectedModel && !(SUPPORTED_MODELS as readonly string[]).includes(updates.selectedModel)) {
      throw new Error(`Unsupported model '${updates.selectedModel}'. Must be one of: ${SUPPORTED_MODELS.join(", ")}`);
    }

    if (updates.timezone) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: updates.timezone });
      } catch {
        throw new Error(`Invalid time zone identifier '${updates.timezone}'. Must be a valid IANA time zone.`);
      }
    }

    const existing = await FacilitySettings.findOne().sort({ updatedAt: -1 });
    let doc: IFacilitySettings;

    if (existing) {
      existing.facilityName = updates.facilityName ?? existing.facilityName;
      existing.timezone = updates.timezone ?? existing.timezone;
      existing.selectedModel = updates.selectedModel ?? existing.selectedModel;
      existing.temperature = updates.temperature ?? existing.temperature;
      existing.topK = updates.topK ?? existing.topK;
      existing.similarityThreshold = updates.similarityThreshold ?? existing.similarityThreshold;
      doc = await existing.save();
    } else {
      doc = await FacilitySettings.create({
        ...DEFAULT_SETTINGS,
        ...updates,
      });
    }

    // Only update cache after MongoDB write completes
    this.cache = {
      facilityName: doc.facilityName,
      timezone: doc.timezone,
      selectedModel: doc.selectedModel as SupportedModel,
      temperature: doc.temperature,
      topK: doc.topK,
      similarityThreshold: doc.similarityThreshold,
      updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : null,
    };

    return { ...this.cache };
  }
}

export const settingsService = new SettingsService();
