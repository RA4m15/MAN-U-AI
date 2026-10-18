import http from "http";
import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";
import { app } from "./app";
import { env } from "./config/env";
import { connectDatabase } from "./config/database";
import { seedDatabase } from "./config/seed";

const server = http.createServer(app);

const allowedOrigins = [
  ...env.CORS_ORIGIN.split(",").map((o) => o.trim()),
  "http://localhost:5173",
  "http://127.0.0.1:5173",
].filter(Boolean);

// Socket.IO configuration with real-time room authorization
export const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        allowedOrigins.includes("*") ||
        origin.endsWith(".onrender.com")
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Authenticate socket connections using JWT
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace("Bearer ", "");
  if (!token) {
    return next(new Error("Authentication required for WebSocket connection"));
  }
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as any;
    (socket as any).user = decoded;
    next();
  } catch (err) {
    return next(new Error("Invalid authentication token"));
  }
});

io.on("connection", (socket) => {
  const user = (socket as any).user;
  console.log(`[Socket.IO] Client connected: ${socket.id} (User: ${user?.email || "anonymous"})`);

  if (user?.id) {
    socket.join(`user:${user.id}`);
  }
  // All authenticated connections join the authenticated channel
  socket.join("authenticated");

  // Document-room authorization: verify user is authenticated before allowing room subscription
  socket.on("subscribe:document", (docId: string) => {
    if (!user) {
      socket.emit("subscription:error", { code: "UNAUTHORIZED", message: "Cannot join document room without authentication" });
      return;
    }
    socket.join(`doc:${docId}`);
    socket.emit("subscription:confirmed", { docId, room: `doc:${docId}` });
  });

  socket.on("join:doc", (docId: string) => {
    if (!user) {
      socket.emit("subscription:error", { code: "UNAUTHORIZED", message: "Cannot join document room without authentication" });
      return;
    }
    socket.join(`doc:${docId}`);
  });

  socket.on("unsubscribe:document", (docId: string) => {
    socket.leave(`doc:${docId}`);
  });

  socket.on("disconnect", (reason) => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id} (Reason: ${reason})`);
  });
});

export function emitDocumentProgress(documentId: string, progress: number, stage: string) {
  // Emit to the specific document room and the authenticated channel; never broadcast to unauthenticated clients
  io.to(`doc:${documentId}`).to("authenticated").emit("document:progress", { documentId, progress, stage });
}

export function emitDocumentStatus(documentId: string, status: string, pageCount?: number, error?: string) {
  io.to(`doc:${documentId}`).to("authenticated").emit("document:status", { documentId, status, pageCount, error });
}

export function emitAuditEvent(event: any) {
  // Audit events are confidential and streamed exclusively to authenticated clients
  io.to("authenticated").emit("audit:new", event);
}

async function startServer() {
  const connected = await connectDatabase();
  if (connected) {
    await seedDatabase();
  }

  server.listen(env.PORT, "0.0.0.0", () => {
    console.log(`[MAN-U-AI API] Server running on http://0.0.0.0:${env.PORT}`);
    console.log(`[MAN-U-AI API] Health check at http://0.0.0.0:${env.PORT}/health`);
    console.log(`[MAN-U-AI API] API v1 base: http://0.0.0.0:${env.PORT}/api/v1`);
  });
}

if (process.env.NODE_ENV !== "test") {
  startServer().catch((err) => {
    console.error("[FATAL] Could not start MAN-U-AI server:", err);
    process.exit(1);
  });
}

