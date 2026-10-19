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
import { settingsRouter } from "./routes/settings.routes";
import { integrationsRouter } from "./routes/integrations.routes";

export const app = express();

// Enable trust proxy for Render reverse proxy and accurate IP detection
app.set("trust proxy", 1);

// Response timing diagnostic header
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const originalWriteHead = res.writeHead;
  res.writeHead = function (...args: any[]) {
    if (!res.headersSent) {
      res.setHeader("X-Response-Time", `${Date.now() - start}ms`);
    }
    return (originalWriteHead as any).apply(this, args);
  };
  next();
});

// Server-side request timeout guard (25 seconds)
app.use((req: Request, res: Response, next: NextFunction) => {
  // Allow test overrides if specified
  const timeoutMs = Number(process.env.TEST_REQUEST_TIMEOUT_MS) || 25_000;
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({
        success: false,
        error: {
          code: "REQUEST_TIMEOUT",
          message: "The request exceeded the server response deadline. Please retry.",
        },
      });
    }
  }, timeoutMs);

  res.on("finish", () => clearTimeout(timer));
  res.on("close", () => clearTimeout(timer));
  next();
});

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

  // In production, strictly reject wildcard "*" and match only exact explicit origins
  const explicitOrigins = configuredOrigins.filter((o) => o !== "*");
  return explicitOrigins.includes(origin);
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
apiV1.use("/settings", settingsRouter);
apiV1.use("/integrations", integrationsRouter);

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
  const isProduction = env.NODE_ENV === "production";
  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: isProduction ? "An internal server error occurred" : message,
    },
  });
});
