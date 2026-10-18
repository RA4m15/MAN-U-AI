import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../src/app";

describe("API Health & Public Endpoints", () => {
  it("GET /health returns healthy status and service version", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
    expect(res.body.service).toBe("MAN-U-AI API Server");
    expect(res.body.version).toBe("1.0.0");
  });

  it("GET /api/v1/health returns matching healthy status", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
  });
});

import jwt from "jsonwebtoken";
import { env } from "../src/config/env";

describe("Authentication & RBAC Protection", () => {
  it("rejects unauthenticated requests to protected route /api/v1/documents", async () => {
    const res = await request(app).get("/api/v1/documents");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("accepts valid JWT token and returns documents list", async () => {
    const token = jwt.sign(
      { id: "test-user-id", email: "alex.mercer@plant.io", name: "Alex Mercer", role: "engineer" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const res = await request(app)
      .get("/api/v1/documents")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

