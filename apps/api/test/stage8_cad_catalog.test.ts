import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import { connectDatabase } from "../src/config/database";
import { seedDatabase } from "../src/config/seed";
import { env } from "../src/config/env";

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
});
