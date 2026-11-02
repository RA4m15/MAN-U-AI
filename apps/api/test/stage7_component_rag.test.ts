import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import { connectDatabase } from "../src/config/database";
import { seedDatabase } from "../src/config/seed";
import { env } from "../src/config/env";
import { machineComponentService } from "../src/services/component.service";
import { ragService } from "../src/services/rag.service";

const testToken = jwt.sign(
  { id: "test-user-id", email: "alex.mercer@plant.io", name: "Alex Mercer", role: "engineer" },
  env.JWT_SECRET,
  { expiresIn: "1h" }
);

describe("Stage 7 — AI Component-Aware RAG Integration", () => {
  beforeAll(async () => {
    await connectDatabase();
    await seedDatabase();
  });

  describe("Part 1: Machine & Component Ownership Validation", () => {
    it("validates known machine manifests and resolves component metadata", async () => {
      const ownership = await machineComponentService.validateComponentOwnership(
        "slurry_pump_9",
        "ceramic_seal_04"
      );
      expect(ownership.valid).toBe(true);
      expect(ownership.machine?.name).toBe("Industrial Slurry Pump P-102");
      expect(ownership.component?.partId).toBe("ceramic_seal_04");
      expect(ownership.component?.name).toBe("Ceramic Mechanical Seal");
    });

    it("resolves components by case-insensitive alias", async () => {
      const component = await machineComponentService.resolveComponent(
        "machine_001",
        "shaft bearing"
      );
      expect(component).not.toBeNull();
      expect(component?.partId).toBe("bearing_assembly_01");
      expect(component?.name).toBe("Bearing Assembly");
    });

    it("rejects non-existent machine IDs with MACHINE_NOT_FOUND", async () => {
      const ownership = await machineComponentService.validateComponentOwnership(
        "phantom_pump_9999",
        "ceramic_seal_04"
      );
      expect(ownership.valid).toBe(false);
      expect(ownership.machine).toBeUndefined();
      expect(ownership.error).toContain("phantom_pump_9999");
    });

    it("rejects mismatched component IDs that do not belong to the machine", async () => {
      const ownership = await machineComponentService.validateComponentOwnership(
        "slurry_pump_9",
        "foreign_jet_turbine_99"
      );
      expect(ownership.valid).toBe(false);
      expect(ownership.machine).toBeDefined();
      expect(ownership.error).toContain("does not belong");
    });

    it("allows machine-level queries when no component is selected", async () => {
      const ownership = await machineComponentService.validateComponentOwnership("machine_001");
      expect(ownership.valid).toBe(true);
      expect(ownership.machine?.name).toBe("Industrial Slurry Pump P-102");
      expect(ownership.component).toBeUndefined();
    });
  });

  describe("Part 2: POST /api/v1/chat Component-Aware Route Validation", () => {
    it("returns 404 INVALID_MACHINE_ID when given an unverified machine ID", async () => {
      const res = await request(app)
        .post("/api/v1/chat")
        .set("Authorization", `Bearer ${testToken}`)
        .send({
          message: "What is the operating temperature?",
          machineContext: {
            machineId: "invalid_machine_xyz",
            selectedPartId: "part_1",
          },
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("INVALID_MACHINE_ID");
    });

    it("returns 400 INVALID_COMPONENT_ID when given a component not belonging to the machine", async () => {
      const res = await request(app)
        .post("/api/v1/chat")
        .set("Authorization", `Bearer ${testToken}`)
        .send({
          message: "How do I lubricate this?",
          machineContext: {
            machineId: "machine_001",
            selectedPartId: "fake_nonexistent_part",
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("INVALID_COMPONENT_ID");
      expect(res.body.error.message).toContain("fake_nonexistent_part");
    });

    it("accepts valid machine and component, returning authoritative machine context", async () => {
      const res = await request(app)
        .post("/api/v1/chat")
        .set("Authorization", `Bearer ${testToken}`)
        .send({
          message: "What is the recommended lubrication and operating temperature for this component?",
          machineContext: {
            machineId: "machine_001",
            selectedPartId: "bearing_assembly_01",
            currentExplosionStep: 2,
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.machineContext).toBeDefined();
      expect(res.body.data.machineContext.machineId).toBe("machine_001");
      expect(res.body.data.machineContext.machineName).toBe("Industrial Slurry Pump P-102");
      expect(res.body.data.machineContext.selectedPartId).toBe("bearing_assembly_01");
      expect(res.body.data.machineContext.selectedPartName).toBe("Bearing Assembly");
      expect(res.body.data.machineContext.parentAssemblyId).toBe("rotor_assembly");
    }, 35000);
  });

  describe("Part 3: Component-Aware RAG Retrieval, Boosting & Scenario D Refusal", () => {
    it("Scenario D: Refuses to fix and emits ticket suggestion when component lacks documentation", async () => {
      // Register a dynamic test component with no documentation in the vector DB
      machineComponentService.registerMachineManifest("slurry_pump_9", {
        name: "Industrial Slurry Pump P-102",
        components: [
          {
            partId: "undocumented_sensor_99",
            name: "Undocumented Laser Optical Sensor",
            description: "High-precision laser alignment sensor with no manual uploaded.",
            parentAssemblyId: "auxiliary_assembly",
            documentReferences: ["non_existent_doc_id"],
          },
        ],
      });

      const res = await request(app)
        .post("/api/v1/chat")
        .set("Authorization", `Bearer ${testToken}`)
        .send({
          message: "What is the calibration frequency for this optical sensor?",
          machineContext: {
            machineId: "slurry_pump_9",
            selectedPartId: "undocumented_sensor_99",
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.workerAnswer.status).toBe("cannot_verify");
      expect(res.body.data.answer).toContain("Undocumented Laser Optical Sensor");
      expect(res.body.data.suggestedTicket).toBeDefined();
      expect(res.body.data.suggestedTicket.reason).toContain("Undocumented Laser Optical Sensor");
    }, 35000);

    it("allows switching components across sequential interactions without state leakage", async () => {
      // 1. Question about bearing assembly
      const res1 = await request(app)
        .post("/api/v1/chat")
        .set("Authorization", `Bearer ${testToken}`)
        .send({
          message: "What is the maximum temperature limit?",
          machineContext: {
            machineId: "machine_001",
            selectedPartId: "bearing_assembly_01",
            currentExplosionStep: 1,
          },
        });

      expect(res1.status).toBe(200);
      expect(res1.body.data.machineContext.selectedPartId).toBe("bearing_assembly_01");

      // 2. Question about mechanical seal
      const res2 = await request(app)
        .post("/api/v1/chat")
        .set("Authorization", `Bearer ${testToken}`)
        .send({
          message: "What is the tightening torque sequence?",
          machineContext: {
            machineId: "machine_001",
            selectedPartId: "mechanical_seal_02",
            currentExplosionStep: 2,
          },
        });

      expect(res2.status).toBe(200);
      expect(res2.body.data.machineContext.selectedPartId).toBe("mechanical_seal_02");
      expect(res2.body.data.machineContext.selectedPartName).toBe("Mechanical Seal Cartridge");
    }, 45000);

    it("clearing component context allows general machine-wide inquiries", async () => {
      const res = await request(app)
        .post("/api/v1/chat")
        .set("Authorization", `Bearer ${testToken}`)
        .send({
          message: "What are the primary safety shutdown procedures for this pump?",
          machineContext: {
            machineId: "machine_001",
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.machineContext.machineId).toBe("machine_001");
      expect(res.body.data.machineContext.selectedPartId).toBeUndefined();
    }, 35000);
  });
});

