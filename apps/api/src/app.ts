import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import { authRouter } from "./routes/auth.routes";
import { documentsRouter } from "./routes/documents.routes";
import { chatRouter } from "./routes/chat.routes";
import { conversationsRouter } from "./routes/conversations.routes";
import { equipmentRouter } from "./routes/equipment.routes";
import { analyticsRouter } from "./routes/analytics.routes";
import { usersRouter } from "./routes/users.routes";
import { feedbackRouter } from "./routes/feedback.routes";
import { healthRouter } from "./routes/health.routes";

export const app = express();

// Security and compression middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Allow local development scripts & assets
  })
);
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;

  const configuredOrigins = env.CORS_ORIGIN
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  if (env.NODE_ENV !== "production") {
    const devOrigins = [
      ...configuredOrigins,
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4000",
      "http://127.0.0.1:4000",
    ];
    return devOrigins.includes(origin) || devOrigins.includes("*");
  }

  // In production, strictly enforce the configured allowlist
  return configuredOrigins.includes(origin) || configuredOrigins.includes("*");
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
  })
);
app.use(compression());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Rate limiting
const limiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/", limiter);

// Root Health check
app.use("/health", healthRouter);

// Versioned API v1 Router
const apiV1 = express.Router();
apiV1.use("/health", healthRouter);
apiV1.use("/auth", authRouter);
apiV1.use("/users", usersRouter);
apiV1.use("/documents", documentsRouter);
apiV1.use("/chat", chatRouter);
apiV1.use("/conversations", conversationsRouter);
apiV1.use("/equipment", equipmentRouter);
apiV1.use("/", analyticsRouter);
apiV1.use("/feedback", feedbackRouter);

app.use("/api/v1", apiV1);

// 404 Handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: `The requested endpoint ${req.method} ${req.originalUrl} does not exist`,
    },
  });
});

// Centralized error handler
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  const message = err instanceof Error ? err.message : "Internal server error";

  if (message.startsWith("CORS origin not allowed")) {
    return res.status(403).json({
      success: false,
      error: {
        code: "CORS_FORBIDDEN",
        message,
      },
    });
  }

  console.error("[API Error Handler]:", err);
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message,
    },
  });
});
