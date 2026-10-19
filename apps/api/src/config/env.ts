import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { z } from "zod";

// Canonical root .env locator for development and compiled execution
function findCanonicalRootEnvPath(): string {
  let curr = __dirname;
  while (curr && curr !== path.dirname(curr)) {
    const workspaceMarker = path.join(curr, "pnpm-workspace.yaml");
    const gitMarker = path.join(curr, ".git");
    if (fs.existsSync(workspaceMarker) || fs.existsSync(gitMarker)) {
      return path.join(curr, ".env");
    }
    curr = path.dirname(curr);
  }
  return path.resolve(process.cwd(), ".env");
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

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  JWT_SECRET: z.string().default("manuai-industrial-secure-jwt-secret-key-2025"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  REFRESH_TOKEN_SECRET: z.string().default("manuai-refresh-secret-key-2025"),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default("30d"),
  MONGODB_URI: z.string().default("mongodb://localhost:27017/manuai"),
  VECTOR_STORE: z.enum(["mongodb", "chromadb", "pinecone", "memory"]).default("mongodb"),
  STORAGE_PROVIDER: z.enum(["local", "cloudinary", "s3", "gcs"]).default("local"),
  STORAGE_LOCAL_PATH: z.string().default("./uploads"),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(""),
  CLOUDINARY_API_KEY: z.string().optional().default(""),
  CLOUDINARY_API_SECRET: z.string().optional().default(""),
  CLOUDINARY_URL: z.string().optional().default(""),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL: z.string().default("gemini-3.6-flash"),
  GEMINI_EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
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
      data.JWT_SECRET === "manuai-industrial-secure-jwt-secret-key-2025" ||
      data.JWT_SECRET.length < 32
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["JWT_SECRET"],
        message: "Production environment requires a strong, non-default JWT_SECRET (minimum 32 characters).",
      });
    }
    if (
      data.REFRESH_TOKEN_SECRET === "manuai-refresh-secret-key-2025" ||
      data.REFRESH_TOKEN_SECRET.length < 32
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

export const env = envSchema.parse(process.env);

