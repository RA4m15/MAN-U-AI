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
import { isConnectedToMongo } from "./config/database";

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

    // The user who uploaded the document has access
    if (doc.uploadedById && doc.uploadedById.toString() === userId) {
      return true;
    }

    // Check explicit permissions
    const permission = await DocumentPermission.findOne({
      documentId: doc._id,
      $or: [{ userId }, { role }],
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

