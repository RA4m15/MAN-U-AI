import http from "http";
import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";
import { app } from "./app";
import { env } from "./config/env";
import { connectDatabase } from "./config/database";
import { seedDatabase } from "./config/seed";

import mongoose from "mongoose";
import { isAllowedOrigin } from "./app";
import { DocumentModel, DocumentPermission } from "./models";
import { isConnectedToMongo, setIsAppInitialized, sanitizeMongoMessage } from "./config/database";

const server = http.createServer(app);

// Socket.IO configuration with hardened CORS policy
export const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS origin not allowed: ${origin}`));
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

async function canUserAccessDocument(userId: string, role: string, docId: string): Promise<boolean> {
  if (role === "admin") return true;
  if (!isConnectedToMongo) {
    return false;
  }
  if (!mongoose.Types.ObjectId.isValid(docId)) {
    return false;
  }

  try {
    const doc = await DocumentModel.findById(docId);
    if (!doc) return false;

    const { toMongoObjectId } = await import("./routes/documents.routes");
    const userOid = toMongoObjectId(userId);

    // The user who uploaded the document has access
    if (doc.uploadedById && (doc.uploadedById.toString() === userId || doc.uploadedById.toString() === userOid.toString())) {
      return true;
    }

    // Check explicit permissions
    const permission = await DocumentPermission.findOne({
      documentId: doc._id,
      $or: [{ userId: userOid }, ...(role ? [{ role }] : [])],
      canRead: true,
    });

    return !!permission;
  } catch (err) {
    console.warn(`[Socket.IO Auth] Error checking access for doc ${docId}:`, err);
    return false;
  }
}

io.on("connection", (socket) => {
  const user = (socket as any).user;
  console.log(`[Socket.IO] Client connected: ${socket.id} (User: ${user?.email || "anonymous"})`);

  if (user?.id) {
    socket.join(`user:${user.id}`);
  }
  if (user?.role === "admin") {
    socket.join("role:admin");
  }

  // Document-room authorization: verify user has explicit permission before joining document room
  socket.on("subscribe:document", async (docId: string) => {
    if (!user) {
      socket.emit("subscription:error", { code: "UNAUTHORIZED", message: "Cannot join document room without authentication" });
      return;
    }

    const hasAccess = await canUserAccessDocument(user.id, user.role, docId);
    if (!hasAccess) {
      socket.emit("subscription:error", {
        code: "FORBIDDEN",
        message: "You are not authorized to subscribe to real-time events for this document",
        docId,
      });
      return;
    }

    socket.join(`doc:${docId}`);
    socket.emit("subscription:confirmed", { docId, room: `doc:${docId}` });
  });

  socket.on("join:doc", async (docId: string) => {
    if (!user) {
      socket.emit("subscription:error", { code: "UNAUTHORIZED", message: "Cannot join document room without authentication" });
      return;
    }

    const hasAccess = await canUserAccessDocument(user.id, user.role, docId);
    if (!hasAccess) {
      socket.emit("subscription:error", {
        code: "FORBIDDEN",
        message: "You are not authorized to join this document room",
        docId,
      });
      return;
    }

    socket.join(`doc:${docId}`);
    socket.emit("subscription:confirmed", { docId, room: `doc:${docId}` });
  });

  socket.on("unsubscribe:document", (docId: string) => {
    socket.leave(`doc:${docId}`);
  });

  socket.on("disconnect", (reason) => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id} (Reason: ${reason})`);
  });
});

export function emitDocumentProgress(documentId: string, progress: number, stage: string, uploaderId?: string) {
  // Emit exclusively to authorized clients in the document room and the uploader's private channel
  let target = io.to(`doc:${documentId}`);
  if (uploaderId) {
    target = target.to(`user:${uploaderId}`);
  }
  target.emit("document:progress", { documentId, progress, stage });
}

export function emitDocumentStatus(documentId: string, status: string, pageCount?: number, error?: string, uploaderId?: string) {
  let target = io.to(`doc:${documentId}`);
  if (uploaderId) {
    target = target.to(`user:${uploaderId}`);
  }
  target.emit("document:status", { documentId, status, pageCount, error });
}

export function emitAuditEvent(event: any) {
  // Audit events are confidential and streamed exclusively to administrators
  io.to("role:admin").emit("audit:new", event);
}

export async function startServer(): Promise<http.Server> {
  // 1. Immediately bind HTTP listener to PORT on 0.0.0.0 so liveness checks,
  // load balancers, and Render reverse proxy succeed promptly without delay.
  const httpServer = await new Promise<http.Server>((resolve, reject) => {
    const s = server.listen(env.PORT, "0.0.0.0", () => {
      console.log(`[MAN-U-AI API] Server running on http://0.0.0.0:${env.PORT}`);
      console.log(`[MAN-U-AI API] Health check at http://0.0.0.0:${env.PORT}/health`);
      console.log(`[MAN-U-AI API] API v1 base: http://0.0.0.0:${env.PORT}/api/v1`);
      resolve(server);
    });
    s.once("error", reject);
  });

  // 2. Establish MongoDB connection with finite timeouts and seed on connection
  try {
    const connected = await connectDatabase();
    if (connected) {
      await seedDatabase();
      setIsAppInitialized(true);
      console.log("[MAN-U-AI API] Application initialization complete.");
    } else {
      setIsAppInitialized(false);
      console.warn("[MAN-U-AI API] MongoDB connection unavailable at startup. Server operating in fail-closed degraded mode.");
    }
  } catch (err: unknown) {
    setIsAppInitialized(false);
    const msg = sanitizeMongoMessage(err instanceof Error ? err.message : String(err));
    console.error(`[MAN-U-AI API] Startup database connection warning: ${msg}`);
  }

  // 3. In non-test environments, if database was unavailable at boot, attempt periodic background reconnection
  if (process.env.NODE_ENV !== "test") {
    const reconnectTimer = setInterval(async () => {
      const { isConnectedToMongo } = await import("./config/database");
      if (isConnectedToMongo) {
        clearInterval(reconnectTimer);
        return;
      }
      try {
        const reconnected = await connectDatabase();
        if (reconnected) {
          await seedDatabase();
          setIsAppInitialized(true);
          console.log("[MAN-U-AI API] Background reconnection to MongoDB succeeded. Application initialized.");
          clearInterval(reconnectTimer);
        }
      } catch (err: unknown) {
        const msg = sanitizeMongoMessage(err instanceof Error ? err.message : String(err));
        console.warn(`[MAN-U-AI API] Background database reconnection notice: ${msg}`);
      }
    }, 15000);
    reconnectTimer.unref?.();
  }

  return httpServer;
}

if (process.env.NODE_ENV !== "test") {
  startServer().catch((err) => {
    console.error("[FATAL] Could not start MAN-U-AI server:", err);
    process.exit(1);
  });
}
