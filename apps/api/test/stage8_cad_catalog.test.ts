import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import { connectDatabase } from "../src/config/database";
import { seedDatabase } from "../src/config/seed";
import { env } from "../src/config/env";
import { isExplodedViewIntent } from "../src/routes/chat.routes";

const adminToken = jwt.sign(
  { id: "admin-user-id", email: "sarah.admin@plant.io", name: "Sarah Admin", role: "admin" },
  env.JWT_SECRET,
  { expiresIn: "1h" }
);

const managerToken = jwt.sign(
  { id: "manager-user-id", email: "mike.mgr@plant.io", name: "Mike Manager", role: "manager" },
  env.JWT_SECRET,
  { expiresIn: "1h" }
);

const engineerToken = jwt.sign(
  { id: "eng-user-id", email: "alex.mercer@plant.io", name: "Alex Mercer", role: "engineer" },
  env.JWT_SECRET,
  { expiresIn: "1h" }
);

describe("Stage 8 — Machine Catalog & CAD Lifecycle Management Suite", () => {
  beforeAll(async () => {
    await connectDatabase();
    await seedDatabase();
  });

  describe("Part 1: Equipment Catalog Listing & Metadata", () => {
    it("returns equipment list containing catalog machines with referenceImage and cadModel metadata", async () => {
      const res = await request(app)
        .get("/api/v1/equipment")
        .set("Authorization", `Bearer ${engineerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const items = res.body.data;
      expect(items.length).toBeGreaterThan(0);
    });

    it("verifies GET /api/v1/equipment/:id/cad returns 404 CAD_MODEL_PENDING for pending models", async () => {
      const res = await request(app)
        .get("/api/v1/equipment/machine_turbomachinery/cad")
        .set("Authorization", `Bearer ${engineerToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("CAD_MODEL_PENDING");
    });
  });

  describe("Part 2: CAD File Upload RBAC & Validation", () => {
    it("rejects unauthorized users from uploading CAD models", async () => {
      const res = await request(app)
        .post("/api/v1/equipment/machine_001/cad")
        .attach("file", Buffer.from("STEP-10303-21; HEADER;"), "model.step");

      expect(res.status).toBe(401);
    });

    it("rejects engineer role from uploading CAD models (requires admin or manager)", async () => {
      const res = await request(app)
        .post("/api/v1/equipment/machine_001/cad")
        .set("Authorization", `Bearer ${engineerToken}`)
        .attach("file", Buffer.from("STEP-10303-21; HEADER;"), "model.step");

      expect(res.status).toBe(403);
    });

    it("rejects invalid non-CAD file extensions (e.g. .exe, .pdf, .txt)", async () => {
      const res = await request(app)
        .post("/api/v1/equipment/machine_001/cad")
        .set("Authorization", `Bearer ${adminToken}`)
        .attach("file", Buffer.from("malicious executable content"), "payload.exe");

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_CAD_FORMAT");
    });

    it("allows manager to upload a valid STEP CAD model", async () => {
      const stepContent = "ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('Sample CAD Model'),'2;1');\nENDSEC;\nEND-ISO-10303-21;";
      const res = await request(app)
        .post("/api/v1/equipment/machine_001/cad")
        .set("Authorization", `Bearer ${managerToken}`)
        .attach("file", Buffer.from(stepContent), "machine_001_assembly.step");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.cadModel).toBeDefined();
      expect(res.body.data.cadModel.available).toBe(true);
      expect(res.body.data.cadModel.format).toBe("step");
    });

    it("allows engineer to retrieve the newly uploaded CAD model metadata", async () => {
      const res = await request(app)
        .get("/api/v1/equipment/machine_001/cad?metadata=true")
        .set("Authorization", `Bearer ${engineerToken}`)
        .set("Accept", "application/json");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.available).toBe(true);
      expect(res.body.data.format).toBe("step");
    });
  });

  describe("Part 3: CAD Deletion & Revocation", () => {
    it("rejects engineer from deleting CAD model", async () => {
      const res = await request(app)
        .delete("/api/v1/equipment/machine_001/cad")
        .set("Authorization", `Bearer ${engineerToken}`);

      expect(res.status).toBe(403);
    });

    it("allows admin to revoke/delete CAD model", async () => {
      const res = await request(app)
        .delete("/api/v1/equipment/machine_001/cad")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.cadModel.available).toBe(false);
    });
  });
  describe("Part 4: AI Chat Intent Handling & Exploded-View Structured Response", () => {
    it("correctly identifies exploded-view intents while rejecting maintenance spec questions", () => {
      // Must match
      expect(isExplodedViewIntent("Show me the exploded view")).toBe(true);
      expect(isExplodedViewIntent("Open the 3D model")).toBe(true);
      expect(isExplodedViewIntent("Show the internal structure")).toBe(true);
      expect(isExplodedViewIntent("Let me inspect this machine")).toBe(true);
      expect(isExplodedViewIntent("Show machine components")).toBe(true);
      expect(isExplodedViewIntent("Open machine assembly")).toBe(true);
      expect(isExplodedViewIntent("Exploded view of the slurry pump")).toBe(true);
      expect(isExplodedViewIntent("Load 3D CAD viewer for this pump")).toBe(true);

      // Must NOT match ordinary maintenance queries
      expect(isExplodedViewIntent("What is the bearing lubrication spec?")).toBe(false);
      expect(isExplodedViewIntent("What is the bearing clearance?")).toBe(false);
      expect(isExplodedViewIntent("What torque is required for the casing bolts?")).toBe(false);
      expect(isExplodedViewIntent("Why is bearing temperature high?")).toBe(false);
      expect(isExplodedViewIntent("How to replace the mechanical seal?")).toBe(false);
    });

    it("returns structured exploded_view response when user asks to show exploded view for available CAD machine", async () => {
      const res = await request(app)
        .post("/api/v1/chat")
        .set("Authorization", `Bearer ${engineerToken}`)
        .send({
          message: "Show me the exploded view",
          machineContext: {
            machineId: "machine_001",
            machineName: "Industrial Slurry Pump P-102",
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.messageType).toBe("exploded_view");
      expect(res.body.data.explodedView).toBeDefined();
      expect(res.body.data.explodedView.machineId).toBe("machine_001");
      expect(res.body.data.explodedView.isCadPending).toBe(false);
      expect(res.body.data.explodedView.modelUrl).toContain("slurry_pump_p102.step");
      expect(res.body.data.explodedView.totalSteps).toBe(4);
    });

    it("returns honest pending response when user asks for 3D model of pending CAD machine", async () => {
      const res = await request(app)
        .post("/api/v1/chat")
        .set("Authorization", `Bearer ${engineerToken}`)
        .send({
          message: "Open the 3D model for this machine",
          machineContext: {
            machineId: "machine_002",
            machineName: "CAT Generator Set",
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.messageType).toBe("exploded_view");
      expect(res.body.data.explodedView).toBeDefined();
      expect(res.body.data.explodedView.isCadPending).toBe(true);
      expect(res.body.data.explodedView.modelUrl).toBe("");
      expect(res.body.data.explodedView.referenceImage).toBeDefined();
      expect(res.body.data.answer).toContain("CAD model pending");
    });

    it("routes ordinary maintenance question to standard RAG pipeline without triggering exploded view", async () => {
      const res = await request(app)
        .post("/api/v1/chat")
        .set("Authorization", `Bearer ${engineerToken}`)
        .send({
          message: "What is the bearing lubrication spec?",
          machineContext: {
            machineId: "machine_001",
            selectedPartId: "bearing_assembly_01",
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Must NOT be exploded view
      expect(res.body.data.messageType).not.toBe("exploded_view");
      expect(res.body.data.explodedView).toBeUndefined();
      expect(res.body.data.answer).toBeDefined();
    });
  });
});
