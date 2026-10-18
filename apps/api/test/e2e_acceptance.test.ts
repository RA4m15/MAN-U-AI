import { describe, it, expect } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import { env } from "../src/config/env";
import { vectorService } from "../src/services/vector.service";
import { ragService } from "../src/services/rag.service";

const adminToken = jwt.sign(
  { id: "usr-admin-test", email: "admin@plant.io", name: "Elena Rostova", role: "admin" },
  env.JWT_SECRET,
  { expiresIn: "1h" }
);

const engineerToken = jwt.sign(
  { id: "usr-eng-test", email: "alex.mercer@plant.io", name: "Alex Mercer", role: "engineer" },
  env.JWT_SECRET,
  { expiresIn: "1h" }
);

const viewerToken = jwt.sign(
  { id: "usr-view-test", email: "operator@plant.io", name: "Shop Operator", role: "viewer" },
  env.JWT_SECRET,
  { expiresIn: "1h" }
);

describe("Acceptance Test Suite — Industrial End-to-End Verification", () => {
  // TEST 5 — Authentication & Protected Endpoints
  describe("TEST 5: Strict JWT Authentication", () => {
    it("rejects unauthenticated requests without Bearer token", async () => {
      const res = await request(app).get("/api/v1/documents");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
    });

    it("rejects fake demo tokens and forged JWTs", async () => {
      const res = await request(app)
        .get("/api/v1/documents")
        .set("Authorization", "Bearer forged.invalid.token");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("accepts authentic signed JWT for authorized personnel", async () => {
      const res = await request(app)
        .get("/api/v1/documents")
        .set("Authorization", `Bearer ${engineerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // TEST 6 — RBAC Document & Equipment Authorization
  describe("TEST 6: Role-Based Authorization Enforcement", () => {
    it("allows engineers and admins to create equipment records", async () => {
      const res = await request(app)
        .post("/api/v1/equipment")
        .set("Authorization", `Bearer ${engineerToken}`)
        .send({
          name: "Boiler Feed Pump BFP-01",
          type: "Centrifugal Pump",
          model: "KSB HGC-4",
          manufacturer: "KSB",
          location: "Boiler Room 2",
        });

      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
    });

    it("prevents read-only viewers from creating equipment records", async () => {
      const res = await request(app)
        .post("/api/v1/equipment")
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({
          name: "Unauthorized Asset",
          type: "Pump",
          model: "X-100",
          manufacturer: "OEM",
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("prevents non-admins from altering RBAC user roles", async () => {
      const res = await request(app)
        .patch("/api/v1/users/usr-eng-test/role")
        .set("Authorization", `Bearer ${engineerToken}`)
        .send({ role: "admin" });

      expect(res.status).toBe(403);
    });

    it("permits admins to access user management endpoints", async () => {
      const res = await request(app)
        .get("/api/v1/users")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // TEST 2 — Supported Technical Inquiries & Grounded Citations
  describe("TEST 2: Supported Question Grounding & Accurate Page Citations", () => {
    it("answers supported query with verified citations to actual source page", async () => {
      const res = await request(app)
        .post("/api/v1/chat")
        .set("Authorization", `Bearer ${engineerToken}`)
        .send({
          message: "What is the mechanical seal bolt torque rating for Slurry Pump P-102?",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.answer).toBeDefined();

      // Ensure citations are verified passages from real document
      const citations = res.body.data.citations;
      expect(citations.length).toBeGreaterThan(0);
      expect(citations[0].page).toBe(16);
      expect(citations[0].documentTitle).toContain("Pump");
      expect(citations[0].excerpt.toLowerCase()).toContain("45 n·m");
    }, 25000);
  });

  // TEST 3 — Unsupported Question Handling
  describe("TEST 3: Unsupported Question Honesty & Hallucination Prevention", () => {
    it("returns insufficient-evidence acknowledgement for out-of-scope question", async () => {
      const res = await request(app)
        .post("/api/v1/chat")
        .set("Authorization", `Bearer ${engineerToken}`)
        .send({
          message: "What is the orbital flight trajectory for SpaceX Falcon Heavy payload fairing separation?",
        });

      console.log("TEST 3 RESULT:", JSON.stringify(res.body.data));
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const answerLower = res.body.data.answer.toLowerCase();
      const admitsUncertainty =
        answerLower.includes("could not locate") ||
        answerLower.includes("not found") ||
        answerLower.includes("insufficient") ||
        answerLower.includes("does not contain") ||
        answerLower.includes("unsupported") ||
        answerLower.includes("no relevant") ||
        answerLower.includes("not available");

      expect(admitsUncertainty).toBe(true);
      expect(res.body.data.citations.length).toBe(0);
    });
  });



  // TEST 9 — Failure Handling & Graceful Degradation
  describe("TEST 9: Failure Handling & Validation Errors", () => {
    it("rejects malformed chat queries with 400 Bad Request", async () => {
      const res = await request(app)
        .post("/api/v1/chat")
        .set("Authorization", `Bearer ${engineerToken}`)
        .send({ message: "" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("returns 404 for nonexistent document file streaming", async () => {
      const res = await request(app)
        .get("/api/v1/documents/non-existent-doc-id/file")
        .set("Authorization", `Bearer ${engineerToken}`);

      expect(res.status).toBe(404);
    });
  });
});
