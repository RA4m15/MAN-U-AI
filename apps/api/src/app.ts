import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import path from "path";
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
import { glossaryRouter } from "./routes/glossary.routes";
import { ticketRouter } from "./routes/tickets.routes";
import { diagramRouter } from "./routes/diagrams.routes";
import { taskRouter } from "./routes/tasks.routes";
import { flowchartsRouter } from "./routes/flowcharts.routes";

export const app = express();

// Enable trust proxy for Render reverse proxy and accurate IP detection
app.set("trust proxy", 1);

// Request correlation ID tracking
app.use((req: Request, res: Response, next: NextFunction) => {
  const reqId = (req.headers["x-request-id"] as string) || `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  (req as any).id = reqId;
  res.setHeader("X-Request-Id", reqId);
  next();
});

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
    contentSecurityPolicy: false,
  })
);

export const DEFAULT_PRODUCTION_ORIGINS = [
  "https://admin.sharprad-x.tech",
  "https://manager.sharprad-x.tech",
];

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;

  const configuredOrigins = env.CORS_ORIGIN
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  if (env.NODE_ENV !== "production") {
    if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
      return true;
    }
    const devOrigins = [
      ...configuredOrigins,
      ...DEFAULT_PRODUCTION_ORIGINS,
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4000",
      "http://127.0.0.1:4000",
      "http://localhost:8080",
      "http://127.0.0.1:8080",
    ];
    return devOrigins.includes(origin) || devOrigins.includes("*");
  }

  const explicitOrigins = new Set([
    ...DEFAULT_PRODUCTION_ORIGINS,
    ...configuredOrigins.filter((o) => o !== "*"),
  ]);
  return explicitOrigins.has(origin);
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

// Serve SimReady and diagram assets as static files
app.use("/static/diagrams", (req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=86400");
  next();
}, express.static(path.join(__dirname, "..", "public", "diagrams")));

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

// Root Gateway Handler & Auto-Navigation
app.get("/", (req: Request, res: Response) => {
  const isHtml = req.accepts(["html", "json"]) === "html";
  if (isHtml) {
    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MAN-U-AI Operational Gateway</title>
  <meta http-equiv="refresh" content="1;url=http://localhost:5173/">
  <style>
    body { background: #0f1011; color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 32px; max-width: 520px; width: 100%; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .badge { display: inline-block; background: #0057ff22; color: #0057ff; font-weight: 700; font-size: 11px; padding: 4px 10px; border-radius: 999px; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 12px; border: 1px solid #0057ff44; }
    h1 { font-size: 22px; font-weight: 700; margin: 0 0 8px; color: #ffffff; }
    p { color: #a1a1aa; font-size: 14px; line-height: 1.5; margin: 0 0 24px; }
    .btn { display: block; margin: 10px 0; padding: 14px 20px; background: #0057ff; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; transition: background 0.15s; }
    .btn:hover { background: #0046cc; }
    .btn-secondary { background: #27272a; color: #ffffff; border: 1px solid #3f3f46; }
    .btn-secondary:hover { background: #3f3f46; }
    .hint { font-size: 12px; color: #71717a; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">MAN-U-AI Core Gateway</div>
    <h1>Industrial Copilot Active</h1>
    <p>You have reached the backend API service (Port 4000). Redirecting you to the Web Interface...</p>
    <a href="http://localhost:5173/" class="btn">Open Web Operations Console (Port 5173)</a>
    <a href="http://localhost:8080/" class="btn btn-secondary">Open Shop-Floor Mobile Web App (Port 8080)</a>
    <a href="http://localhost:5173/manager/login" class="btn btn-secondary">Open Plant Manager Portal</a>
    <div class="hint">Auto-redirecting in 1 second... If redirect does not occur, click above.</div>
  </div>
</body>
</html>`);
  }
  return res.json({
    success: true,
    data: {
      name: "MAN-U-AI Industrial Backend API",
      status: "operational",
      version: "1.0.0",
      endpoints: {
        health: "/health",
        apiV1: "/api/v1",
        webConsole: "http://localhost:5173",
        mobilePanel: "http://localhost:8080",
      },
    },
  });
});

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
apiV1.use("/glossary", glossaryRouter);
apiV1.use("/tickets", ticketRouter);
apiV1.use("/diagrams", diagramRouter);
apiV1.use("/tasks", taskRouter);
apiV1.use("/flowcharts", flowchartsRouter);

app.use("/api/v1", apiV1);
app.use("/api", apiV1);

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
