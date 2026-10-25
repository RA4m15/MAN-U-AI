import http from "http";
import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";
import { app } from "./app";
import { env } from "./config/env";
import { connectDatabase } from "./config/database";
import { seedDatabase } from "./config/seed";

import mongoose from "mongoose";
import { isAllowedOrigin } from "./app";
import { DocumentModel, DocumentPermission, User } from "./models";
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

// Authenticate socket connections using JWT and verify authoritative database state
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return next(new Error("Authentication required for WebSocket connection"));
  }

  let decoded: any;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET) as any;
  } catch (err) {
    return next(new Error("Invalid authentication token"));
  }

  if (isConnectedToMongo) {
    if (decoded.id) {
      try {
        const { toMongoObjectId } = await import("./routes/documents.routes");
        const userOid = toMongoObjectId(decoded.id);
        const userDoc = await User.findById(userOid);
        if (userDoc) {
          if (userDoc.isActive === false) {
            return next(new Error("User account is inactive or no longer exists"));
          }

          // Derive authoritative identity and role from the MongoDB user record
          (socket as any).tokenUserId = decoded.id;
          (socket as any).user = {
            id: userDoc._id.toString(),
            email: userDoc.email,
            name: userDoc.name,
            role: userDoc.role,
          };
          return next();
        }

        // If user is not found in MongoDB:
        // Real ObjectIds or strict mode / production mode must reject.
        if (
          process.env.NODE_ENV !== "test" ||
          process.env.STRICT_AUTH_TEST === "true" ||
          mongoose.Types.ObjectId.isValid(decoded.id)
        ) {
          return next(new Error("User account is inactive or no longer exists"));
        }
      } catch (dbErr) {
        console.error("[Socket.IO Auth] Database error verifying user:", dbErr);
        return next(new Error("Database query error during WebSocket authentication"));
      }
    } else {
      if (process.env.NODE_ENV !== "test" || process.env.STRICT_AUTH_TEST === "true") {
        return next(new Error("User account no longer exists"));
      }
    }
  }

  // When database is disconnected:
  const isProduction = process.env.NODE_ENV === "production";
  const isOfflineAuthPermitted =
    !isProduction &&
    (process.env.ALLOW_OFFLINE_AUTH === "true" ||
      (process.env.NODE_ENV === "test" && process.env.ALLOW_OFFLINE_AUTH !== "false"));

  if (!isOfflineAuthPermitted) {
    return next(new Error("Authentication database is disconnected"));
  }

  // Safe fallback in offline test mode:
  (socket as any).user = {
    id: decoded.id,
    email: decoded.email,
    name: decoded.name,
    role: decoded.role || "viewer",
    unverifiedRole: decoded.role,
  };
  return next();
});

async function canUserAccessDocument(userId: string, docId: string): Promise<boolean> {
  if (!isConnectedToMongo) {
    // Fail closed when authorization storage is unavailable
    return false;
  }
  if (!docId) {
    return false;
  }

  try {
    const { toMongoObjectId } = await import("./routes/documents.routes");
    const userOid = toMongoObjectId(userId);
    const userDoc = await User.findById(userOid);
    if (!userDoc || userDoc.isActive === false) {
      return false;
    }
    const authoritativeRole = userDoc.role;
    if (authoritativeRole === "admin") {
      return true;
    }

    const docOid = toMongoObjectId(docId);
    const doc = await DocumentModel.findById(docOid);
    if (!doc) return false;

    // The user who uploaded the document has access
    if (doc.uploadedById && (doc.uploadedById.toString() === userId || doc.uploadedById.toString() === userOid.toString())) {
      return true;
    }

    // Check explicit document permissions for user or authoritative role
    const permission = await DocumentPermission.findOne({
      documentId: doc._id,
      $or: [{ userId: userOid }, ...(authoritativeRole ? [{ role: authoritativeRole }] : [])],
      canRead: true,
    });

    return !!permission;
  } catch (err) {
    console.warn(`[Socket.IO Auth] Error checking access for doc ${docId}:`, err);
    return false;
  }
}

/**
 * Revokes or updates real-time privileges for connected sockets when a user's
 * account is modified, demoted, deactivated, or deleted.
 */
export async function syncUserSocketState(userId: string, newRole?: string | null): Promise<void> {
  try {
    const { toMongoObjectId } = await import("./routes/documents.routes");
    const userOidStr = toMongoObjectId(userId).toString();
    const sockets = await io.fetchSockets();
    for (const s of sockets) {
      const u = (s as any).user;
      const tId = (s as any).tokenUserId;
      if (u?.id === userId || u?.id === userOidStr || tId === userId || tId === userOidStr) {
        if (!newRole) {
          // Account deactivated or deleted: immediately revoke and disconnect socket
          s.emit("auth:revoked", { message: "Account has been deactivated or removed" });
          s.disconnect(true);
        } else {
          (s.data as any).role = newRole;
          if ((s as any).user) {
            (s as any).user.role = newRole;
          }
          if (newRole !== "admin") {
            s.leave("role:admin");
          } else {
            s.join("role:admin");
          }
          s.emit("auth:updated", { role: newRole });
        }
      }
    }
  } catch (err) {
    console.warn(`[Socket.IO Revocation] Error synchronizing socket state for ${userId}:`, err);
  }
}

io.on("connection", (socket) => {
  const user = (socket as any).user;
  const tokenUserId = (socket as any).tokenUserId;
  console.log(`[Socket.IO] Client connected: ${socket.id} (User: ${user?.email || "anonymous"})`);

  if (user?.id) {
    socket.join(`user:${user.id}`);
  }
  if (tokenUserId && tokenUserId !== user?.id) {
    socket.join(`user:${tokenUserId}`);
  }
  // Grant admin room ONLY if role was authoritatively verified as admin
  if (user?.role === "admin") {
    socket.join("role:admin");
  }

  // Document-room authorization: verify user has explicit permission before joining document room
  socket.on("subscribe:document", async (docId: string) => {
    if (!user?.id) {
      socket.emit("subscription:error", { code: "UNAUTHORIZED", message: "Cannot join document room without authentication" });
      return;
    }

    const hasAccess = await canUserAccessDocument(user.id, docId);
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
    if (!user?.id) {
      socket.emit("subscription:error", { code: "UNAUTHORIZED", message: "Cannot join document room without authentication" });
      return;
    }

    const hasAccess = await canUserAccessDocument(user.id, docId);
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
    try {
      const { toMongoObjectId } = require("./routes/documents.routes");
      target = target.to(`user:${toMongoObjectId(uploaderId).toString()}`);
    } catch {}
  }
  target.emit("document:progress", { documentId, progress, stage });
}

export function emitDocumentStatus(documentId: string, status: string, pageCount?: number, error?: string, uploaderId?: string) {
  let target = io.to(`doc:${documentId}`);
  if (uploaderId) {
    target = target.to(`user:${uploaderId}`);
    try {
      const { toMongoObjectId } = require("./routes/documents.routes");
      target = target.to(`user:${toMongoObjectId(uploaderId).toString()}`);
    } catch {}
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
