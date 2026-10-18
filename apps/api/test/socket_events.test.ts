import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import { io as Client, Socket } from "socket.io-client";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import { env } from "../src/config/env";
import { emitDocumentProgress, emitDocumentStatus, emitAuditEvent, io as serverSocket } from "../src/index";

describe("Socket.IO Real-time Events & Authorization (Requirement 7)", () => {
  let httpServer: http.Server;
  let serverPort: number;
  let validToken: string;

  beforeAll(async () => {
    validToken = jwt.sign(
      { id: "usr-socket-test", email: "alex.mercer@plant.io", name: "Alex Mercer", role: "engineer" },
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

  it("receives document:progress events with real percentage and stage description", async () => {
    const socket: Socket = Client(`http://localhost:${serverPort}`, {
      auth: { token: validToken },
      transports: ["websocket"],
    });

    await new Promise<void>((resolve) => {
      socket.on("connect", () => {
        socket.emit("join:doc", "doc-test-101");

        socket.on("document:progress", (data: any) => {
          if (data.documentId === "doc-test-101") {
            expect(data.progress).toBe(60);
            expect(data.stage).toBe("Generating vector embeddings...");
            socket.disconnect();
            resolve();
          }
        });

        // Trigger real server event
        setTimeout(() => {
          emitDocumentProgress("doc-test-101", 60, "Generating vector embeddings...");
        }, 50);
      });
    });
  });

  it("receives audit:new broadcast event when persistent operational actions occur", async () => {
    const socket: Socket = Client(`http://localhost:${serverPort}`, {
      auth: { token: validToken },
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
});
