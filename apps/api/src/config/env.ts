import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { z } from "zod";

import os from "os";

// Canonical root .env locator for development and compiled execution
function findCanonicalRootEnvPath(): string {
  const homeDir = path.resolve(os.homedir());
  let curr = path.resolve(__dirname);
  let gitFallbackPath: string | null = null;

  while (curr && curr !== path.dirname(curr)) {
    const workspaceMarker = path.join(curr, "pnpm-workspace.yaml");
    if (fs.existsSync(workspaceMarker)) {
      return path.join(curr, ".env");
    }

    if (!gitFallbackPath && curr !== homeDir) {
      const gitMarker = path.join(curr, ".git");
      if (fs.existsSync(gitMarker)) {
        gitFallbackPath = path.join(curr, ".env");
      }
    }

    if (curr === homeDir) {
      break;
    }

    curr = path.dirname(curr);
  }

  return gitFallbackPath || path.resolve(process.cwd(), ".env");
}

export const CANONICAL_ENV_PATH = findCanonicalRootEnvPath();

if (fs.existsSync(CANONICAL_ENV_PATH)) {
  dotenv.config({ path: CANONICAL_ENV_PATH });
  if (process.env.NODE_ENV !== "test") {
    console.log(`[Config] Normalized environment loaded from: ${CANONICAL_ENV_PATH}`);
  }
} else if (process.env.NODE_ENV !== "test") {
  console.log(`[Config] Relying on system/container environment variables (no local .env at: ${CANONICAL_ENV_PATH})`);
}

import crypto from "crypto";

export const KNOWN_PREDICTABLE_SECRETS = new Set([
  "manuai-industrial-secure-jwt-secret-key-2025",
  "manuai-refresh-secret-key-2025",
  "secret",
  "changeme",
  "12345678901234567890123456789012",
  "default_secret_for_development_purposes_only",
]);

// Ephemeral secrets generated once per process lifecycle for development when unset
let devEphemeralJwtSecret: string | null = null;
let devEphemeralRefreshSecret: string | null = null;

export function resolveJwtSecret(rawVal: string | undefined, nodeEnv: string): string {
  if (rawVal && rawVal.trim().length > 0) {
    return rawVal.trim();
  }
  if (nodeEnv === "test") {
    // Isolated deterministic secret strictly for unit/integration tests
    return "test-isolated-deterministic-jwt-secret-min32chars";
  }
  if (nodeEnv === "development") {
    if (!devEphemeralJwtSecret) {
      devEphemeralJwtSecret = crypto.randomBytes(32).toString("hex");
      console.warn("[Security] JWT_SECRET is unset in development. Generated secure process-ephemeral secret. Set JWT_SECRET in .env to persist user sessions across server restarts.");
    }
    return devEphemeralJwtSecret;
  }
  return "";
}

export function resolveRefreshSecret(rawVal: string | undefined, nodeEnv: string): string {
  if (rawVal && rawVal.trim().length > 0) {
    return rawVal.trim();
  }
  if (nodeEnv === "test") {
    // Isolated deterministic secret strictly for unit/integration tests
    return "test-isolated-deterministic-refresh-secret-min32chars";
  }
  if (nodeEnv === "development") {
    if (!devEphemeralRefreshSecret) {
      devEphemeralRefreshSecret = crypto.randomBytes(32).toString("hex");
      console.warn("[Security] REFRESH_TOKEN_SECRET is unset in development. Generated secure process-ephemeral secret. Set REFRESH_TOKEN_SECRET in .env to persist user sessions across server restarts.");
    }
    return devEphemeralRefreshSecret;
  }
  return "";
}

export function buildEnvSchema(envSource: Record<string, any> = process.env) {
  const currentEnv = envSource.NODE_ENV || "development";
  return z.object({
    NODE_ENV: z.enum(["development", "production", "test"]).default(currentEnv as any),
    PORT: z.coerce.number().default(4000),
    CORS_ORIGIN: z.string().default("http://localhost:5173"),
    JWT_SECRET: z.string().optional().default(""),
    JWT_EXPIRES_IN: z.string().default("7d"),
    REFRESH_TOKEN_SECRET: z.string().optional().default(""),
    REFRESH_TOKEN_EXPIRES_IN: z.string().default("30d"),
    MONGODB_URI: z.string().default("mongodb://localhost:27017/manuai"),
    VECTOR_STORE: z.enum(["mongodb", "chromadb", "pinecone", "memory"]).default("mongodb"),
    STORAGE_PROVIDER: z.enum(["local", "cloudinary", "s3", "gcs"]).default("local"),
    STORAGE_LOCAL_PATH: z.string().default("./uploads"),
    CLOUDINARY_CLOUD_NAME: z.string().optional().default(""),
    CLOUDINARY_API_KEY: z.string().optional().default(""),
    CLOUDINARY_API_SECRET: z.string().optional().default(""),
    CLOUDINARY_URL: z.string().optional().default(""),
    GEMINI_API_KEY: z
      .string()
      .optional()
      .default(currentEnv === "test" ? "test-placeholder-gemini-key" : ""),
    GEMINI_MODEL: z.string().default("gemini-3.8-flash"),
    GEMINI_FALLBACK_MODELS: z.string().default("gemini-3.6-flash,gemini-3.8-flash"),
    GEMINI_EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
    ENABLE_PUBLIC_REGISTRATION: z.string().default("false"),
  }).transform((data) => {
    return {
      ...data,
      JWT_SECRET: resolveJwtSecret(data.JWT_SECRET, data.NODE_ENV),
      REFRESH_TOKEN_SECRET: resolveRefreshSecret(data.REFRESH_TOKEN_SECRET, data.NODE_ENV),
    };
  }).superRefine((data, ctx) => {
    if (data.NODE_ENV === "production") {
      if (data.STORAGE_PROVIDER === "cloudinary") {
        const hasDirectCreds = Boolean(data.CLOUDINARY_CLOUD_NAME && data.CLOUDINARY_API_KEY && data.CLOUDINARY_API_SECRET);
        const hasUrl = Boolean(data.CLOUDINARY_URL);
        if (!hasDirectCreds && !hasUrl) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["STORAGE_PROVIDER"],
            message: "Production environment requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET (or CLOUDINARY_URL) when STORAGE_PROVIDER=cloudinary.",
          });
        }
      }
      if (
        !data.JWT_SECRET ||
        data.JWT_SECRET.length < 32 ||
        KNOWN_PREDICTABLE_SECRETS.has(data.JWT_SECRET)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["JWT_SECRET"],
          message: "Production environment requires a strong, non-default JWT_SECRET (minimum 32 characters).",
        });
      }
      if (
        !data.REFRESH_TOKEN_SECRET ||
        data.REFRESH_TOKEN_SECRET.length < 32 ||
        KNOWN_PREDICTABLE_SECRETS.has(data.REFRESH_TOKEN_SECRET)
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["REFRESH_TOKEN_SECRET"],
          message: "Production environment requires a strong, non-default REFRESH_TOKEN_SECRET (minimum 32 characters).",
        });
      }
      if (
        !data.MONGODB_URI ||
        data.MONGODB_URI === "mongodb://localhost:27017/manuai" ||
        data.MONGODB_URI.includes("localhost") ||
        data.MONGODB_URI.includes("127.0.0.1")
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["MONGODB_URI"],
          message: "Production environment requires a remote MONGODB_URI (e.g. MongoDB Atlas) and cannot use localhost.",
        });
      }
      if (data.VECTOR_STORE === "memory") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["VECTOR_STORE"],
          message: "Production environment cannot use 'memory' for VECTOR_STORE; must use persistent storage (e.g. 'mongodb').",
        });
      }
      if (
        !data.CORS_ORIGIN ||
        data.CORS_ORIGIN === "*" ||
        data.CORS_ORIGIN.split(",").some((o) => o.trim() === "*")
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["CORS_ORIGIN"],
          message: "Production environment requires an explicit frontend origin allowlist and strictly forbids wildcard '*'.",
        });
      }
    }
  });
}

export function parseEnvironment(envSource: Record<string, any> = process.env) {
  return buildEnvSchema(envSource).parse(envSource);
}

export const env = parseEnvironment(process.env);

