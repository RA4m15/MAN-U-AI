import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

// Canonical single root .env for the pnpm monorepo
export const CANONICAL_ENV_PATH = path.resolve(__dirname, "../../../.env");
dotenv.config({ path: CANONICAL_ENV_PATH });

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
  STORAGE_PROVIDER: z.enum(["local", "s3", "gcs"]).default("local"),
  STORAGE_LOCAL_PATH: z.string().default("./uploads"),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_MODEL: z.string().default("gemini-3.8-flash"),
  GEMINI_EMBEDDING_MODEL: z.string().default("gemini-embedding-001"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
}).superRefine((data, ctx) => {
  if (data.NODE_ENV === "production") {
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
  }
});

export const env = envSchema.parse(process.env);

