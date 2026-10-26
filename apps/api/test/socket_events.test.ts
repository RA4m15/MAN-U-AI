import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import { io as Client, Socket } from "socket.io-client";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import { env } from "../src/config/env";
import { emitDocumentProgress, emitDocumentStatus, emitAuditEvent, io as serverSocket } from "../src/index";

import { connectDatabase, isConnectedToMongo } from "../src/config/database";
import { User, DocumentModel } from "../src/models";
import { toMongoObjectId } from "../src/routes/documents.routes";

describe("Socket.IO Real-time Events & Authorization (Requirement 7)", () => {
  let httpServer: http.Server;
  let serverPort: number;
  let validToken: string;
  let adminToken: string;

  beforeAll(async () => {
    await connectDatabase();

    const testUsers = [
      { id: "usr-admin-test", name: "Plant Administrator", email: "admin@plant.io", role: "admin" },
      { id: "usr-socket-test", name: "Alex Mercer", email: "alex.mercer@plant.io", role: "engineer" },
      { id: "usr-uploader-private-42", name: "Uploader 42", email: "uploader42@plant.io", role: "engineer" },
      { id: "usr-stranger-99", name: "Stranger", email: "stranger@plant.io", role: "viewer" },
      { id: "usr-status-owner-88", name: "Owner 88", email: "owner88@plant.io", role: "engineer" },
      { id: "usr-outsider-00", name: "Outsider", email: "outsider@plant.io", role: "viewer" },
    ];

    for (const u of testUsers) {
      await User.findByIdAndUpdate(
        toMongoObjectId(u.id),
        { name: u.name, email: u.email, passwordHash: "dummy", role: u.role, isActive: true },
        { upsert: true }
      );
    }

    const docOid = toMongoObjectId("doc-test-101");
    await DocumentModel.findByIdAndUpdate(
      docOid,
      { title: "Test Doc 101", revision: "Rev 1.0", filename: "test.pdf", storagePath: "uploads/test.pdf", mimeType: "application/pdf", status: "indexed" },
      { upsert: true }
    );

    validToken = jwt.sign(
      { id: "usr-socket-test", email: "alex.mercer@plant.io", name: "Alex Mercer", role: "engineer" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    adminToken = jwt.sign(
      { id: "usr-admin-test", email: "admin@plant.io", name: "Plant Administrator", role: "admin" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Start a dedicated test HTTP server on random free port
    httpServer = http.createServer(app);
    serverSocket.attach(httpServer);
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        serverPort = typeof addr === "object" && addr ? addr.port : 4100;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await User.deleteMany({ _id: { $in: [toMongoObjectId("usr-admin-test"), toMongoObjectId("usr-socket-test")] } });
    await DocumentModel.deleteOne({ _id: toMongoObjectId("doc-test-101") });
  });

  it("permits authenticated Socket.IO connection with valid JWT", async () => {
    const socket: Socket = Client(`http://localhost:${serverPort}`, {
      auth: { token: validToken },
      transports: ["websocket"],
      reconnection: false,
    });

    await new Promise<void>((resolve, reject) => {
      socket.on("connect", () => {
        expect(socket.connected).toBe(true);
        socket.disconnect();
        resolve();
      });
      socket.on("connect_error", (err) => {
        socket.disconnect();
        reject(err);
      });
    });
  });

  it("rejects unauthenticated Socket.IO connection attempt (missing token)", async () => {
    const socket: Socket = Client(`http://localhost:${serverPort}`, {
      transports: ["websocket"],
      reconnection: false,
    });

    await new Promise<void>((resolve) => {
      socket.on("connect", () => {
        socket.disconnect();
        throw new Error("Unauthenticated socket should not have connected");
      });
      socket.on("connect_error", (err) => {
        expect(err.message).toContain("Authentication required");
        socket.disconnect();
        resolve();
      });
    });
  });

  it("rejects Socket.IO connection attempt with forged/invalid token", async () => {
    const socket: Socket = Client(`http://localhost:${serverPort}`, {
      auth: { token: "forged.jwt.token" },
      transports: ["websocket"],
      reconnection: false,
    });

    await new Promise<void>((resolve) => {
      socket.on("connect", () => {
        socket.disconnect();
        throw new Error("Socket with forged token should not have connected");
      });
      socket.on("connect_error", (err) => {
        expect(err.message).toContain("Invalid authentication token");
        socket.disconnect();
        resolve();
      });
    });
  });

  it("prevents unauthorized engineer client from subscribing to unpermitted document room", async () => {
    const socket: Socket = Client(`http://localhost:${serverPort}`, {
      auth: { token: validToken },
      transports: ["websocket"],
    });

    await new Promise<void>((resolve) => {
      socket.on("connect", () => {
        socket.emit("subscribe:document", "doc-unauthorized-999");
        socket.on("subscription:error", (err: any) => {
          expect(err.code).toBe("FORBIDDEN");
          expect(err.message).toContain("not authorized");
          socket.disconnect();
          resolve();
        });
      });
    });
  });

  it("receives document:progress events with real percentage and stage description for authorized administrator", async () => {
    const socket: Socket = Client(`http://localhost:${serverPort}`, {
      auth: { token: adminToken },
      transports: ["websocket"],
    });

    await new Promise<void>((resolve) => {
      socket.on("connect", () => {
        socket.emit("subscribe:document", "doc-test-101");

        socket.on("subscription:confirmed", () => {
          // Trigger server event after room join confirmation
          emitDocumentProgress("doc-test-101", 60, "Generating vector embeddings...");
        });

        socket.on("document:progress", (data: any) => {
          if (data.documentId === "doc-test-101") {
            expect(data.progress).toBe(60);
            expect(data.stage).toBe("Generating vector embeddings...");
            socket.disconnect();
            resolve();
          }
        });
      });
    });
  });

  it("receives audit:new broadcast event strictly for administrators", async () => {
    const socket: Socket = Client(`http://localhost:${serverPort}`, {
      auth: { token: adminToken },
      transports: ["websocket"],
    });

    await new Promise<void>((resolve) => {
      socket.on("connect", () => {
        socket.on("audit:new", (event: any) => {
          expect(event.action).toBe("rag_query");
          expect(event.actorName).toBe("Alex Mercer");
          socket.disconnect();
          resolve();
        });

        setTimeout(() => {
          emitAuditEvent({
            id: "aud-socket-test",
            action: "rag_query",
            actorName: "Alex Mercer",
            timestamp: new Date().toISOString(),
          });
        }, 50);
      });
    });
  });

  // ── Uploader Progress Delivery & Target Isolation Tests ─────────────────────
  it("delivers progress updates to authorized document-room members", async () => {
    const socket: Socket = Client(`http://localhost:${serverPort}`, {
      auth: { token: adminToken },
      transports: ["websocket"],
    });

    await new Promise<void>((resolve) => {
      socket.on("connect", () => {
        const testDocId = "doc-room-member-test";
        socket.emit("subscribe:document", testDocId);

        socket.on("subscription:confirmed", () => {
          emitDocumentProgress(testDocId, 50, "Extracting text", "some-other-uploader");
        });

        socket.on("document:progress", (data: any) => {
          if (data.documentId === testDocId) {
            expect(data.progress).toBe(50);
            expect(data.stage).toBe("Extracting text");
            socket.disconnect();
            resolve();
          }
        });
      });
    });
  });

  it("delivers progress updates to the uploader through their private user room without explicit room subscription", async () => {
    const uploaderId = "usr-uploader-private-42";
    const uploaderToken = jwt.sign(
      { id: uploaderId, email: "uploader42@plant.io", name: "Uploader 42", role: "engineer" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const socket: Socket = Client(`http://localhost:${serverPort}`, {
      auth: { token: uploaderToken },
      transports: ["websocket"],
    });

    await new Promise<void>((resolve) => {
      socket.on("connect", () => {
        const targetDocId = "doc-unsubscribed-by-uploader-99";

        // Listen for progress on the private user room (not in doc room)
        socket.on("document:progress", (data: any) => {
          if (data.documentId === targetDocId) {
            expect(data.progress).toBe(75);
            expect(data.stage).toBe("Vectorizing chunks");
            socket.disconnect();
            resolve();
          }
        });

        setTimeout(() => {
          emitDocumentProgress(targetDocId, 75, "Vectorizing chunks", uploaderId);
        }, 50);
      });
    });
  });

  it("does not deliver private document progress to unauthorized third-party users", async () => {
    const strangerToken = jwt.sign(
      { id: "usr-stranger-99", email: "stranger@plant.io", name: "Stranger", role: "viewer" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const socket: Socket = Client(`http://localhost:${serverPort}`, {
      auth: { token: strangerToken },
      transports: ["websocket"],
    });

    let receivedLeakedProgress = false;

    await new Promise<void>((resolve) => {
      socket.on("connect", () => {
        const secretDocId = "doc-secret-private-123";

        socket.on("document:progress", (data: any) => {
          if (data.documentId === secretDocId) {
            receivedLeakedProgress = true;
          }
        });

        // Emit to secret doc room and specific uploader (not the stranger)
        emitDocumentProgress(secretDocId, 90, "Finalizing", "usr-legitimate-owner");

        setTimeout(() => {
          expect(receivedLeakedProgress).toBe(false);
          socket.disconnect();
          resolve();
        }, 150);
      });
    });
  });

  it("delivers status events to document-room members and uploader room while isolating unauthorized users", async () => {
    const ownerId = "usr-status-owner-88";
    const ownerToken = jwt.sign(
      { id: ownerId, email: "owner88@plant.io", name: "Owner 88", role: "engineer" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const outsiderToken = jwt.sign(
      { id: "usr-outsider-00", email: "outsider@plant.io", name: "Outsider", role: "viewer" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const ownerSocket: Socket = Client(`http://localhost:${serverPort}`, {
      auth: { token: ownerToken },
      transports: ["websocket"],
    });

    const outsiderSocket: Socket = Client(`http://localhost:${serverPort}`, {
      auth: { token: outsiderToken },
      transports: ["websocket"],
    });

    let ownerReceivedStatus = false;
    let outsiderReceivedStatus = false;
    const testDocId = "doc-status-broadcast-test";

    await new Promise<void>((resolve) => {
      let connectedCount = 0;
      const onBothConnected = () => {
        connectedCount++;
        if (connectedCount === 2) {
          ownerSocket.on("document:status", (data: any) => {
            if (data.documentId === testDocId) {
              expect(data.status).toBe("indexed");
              expect(data.pageCount).toBe(42);
              ownerReceivedStatus = true;
            }
          });

          outsiderSocket.on("document:status", (data: any) => {
            if (data.documentId === testDocId) {
              outsiderReceivedStatus = true;
            }
          });

          emitDocumentStatus(testDocId, "indexed", 42, undefined, ownerId);

          setTimeout(() => {
            expect(ownerReceivedStatus).toBe(true);
            expect(outsiderReceivedStatus).toBe(false);
            ownerSocket.disconnect();
            outsiderSocket.disconnect();
            resolve();
          }, 150);
        }
      };

      ownerSocket.on("connect", onBothConnected);
      outsiderSocket.on("connect", onBothConnected);
    });
  });
});
