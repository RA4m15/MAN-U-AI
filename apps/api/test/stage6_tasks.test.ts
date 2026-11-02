import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { app } from "../src/app";
import { connectDatabase } from "../src/config/database";
import { env } from "../src/config/env";
import { User } from "../src/models";

describe("Stage 6: Manager Shift Task Dispatch & Engineer Retrieval", () => {
  const runId = Date.now();
  let managerToken: string;
  let engineerToken: string;
  let operatorToken: string;
  let managerId: string;
  let engineerId: string;
  let operatorId: string;

  beforeAll(async () => {
    try {
      await connectDatabase();
    } catch {
      // Allow fallback if offline
    }

    managerId = new mongoose.Types.ObjectId().toString();
    engineerId = new mongoose.Types.ObjectId().toString();
    operatorId = new mongoose.Types.ObjectId().toString();

    await User.deleteMany({ email: { $regex: /.*-(?:manager|engineer|operator)-.*@plant\.io/ } });

    await User.create([
      {
        _id: new mongoose.Types.ObjectId(managerId),
        name: "Ops Manager",
        email: `manager-${runId}@plant.io`,
        passwordHash: "mockedHash123!",
        role: "manager",
      },
      {
        _id: new mongoose.Types.ObjectId(engineerId),
        name: "Lead Engineer",
        email: `engineer-${runId}@plant.io`,
        passwordHash: "mockedHash123!",
        role: "engineer",
      },
      {
        _id: new mongoose.Types.ObjectId(operatorId),
        name: "Readonly Operator",
        email: `operator-${runId}@plant.io`,
        passwordHash: "mockedHash123!",
        role: "operator",
      },
    ]);

    managerToken = jwt.sign(
      { id: managerId, email: `manager-${runId}@plant.io`, name: "Ops Manager", role: "manager" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    engineerToken = jwt.sign(
      { id: engineerId, email: `engineer-${runId}@plant.io`, name: "Lead Engineer", role: "engineer" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    operatorToken = jwt.sign(
      { id: operatorId, email: `operator-${runId}@plant.io`, name: "Readonly Operator", role: "operator" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );
  });

  afterAll(async () => {
    await User.deleteMany({ _id: { $in: [managerId, engineerId, operatorId] } });
  });

  let createdTaskId: string;

  it("rejects unauthorized task creation without auth or with operator role", async () => {
    // 1. No token
    const resNoAuth = await request(app)
      .post("/api/v1/tasks")
      .send({ title: "Check Pressure Gauges", description: "Verify line 2" });
    expect(resNoAuth.status).toBe(401);

    // 2. Viewer role
    const resOperator = await request(app)
      .post("/api/v1/tasks")
      .set("Authorization", `Bearer ${operatorToken}`)
      .send({ title: "Check Pressure Gauges", description: "Verify line 2" });
    expect(resOperator.status).toBe(403);
  });

  it("allows Manager to dispatch a new task with equipment and priority", async () => {
    const res = await request(app)
      .post("/api/v1/tasks")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        title: "Inspect Compressor Valve C-04",
        description: "Examine intake seal for micro-fissures and log decibel reading.",
        priority: "high",
        equipmentId: "EQ-COMP-001",
        equipmentName: "Centrifugal Gas Compressor #4",
        shift: "Morning",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.title).toBe("Inspect Compressor Valve C-04");
    expect(res.body.data.priority).toBe("high");
    expect(res.body.data.status).toBe("pending");
    expect(res.body.data.equipmentId).toBe("EQ-COMP-001");
    createdTaskId = res.body.data.id;
  });

  it("allows Engineer to list all active tasks", async () => {
    const res = await request(app)
      .get("/api/v1/tasks")
      .set("Authorization", `Bearer ${engineerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    const found = res.body.data.find((t: any) => t.id === createdTaskId);
    expect(found).toBeDefined();
    expect(found.title).toBe("Inspect Compressor Valve C-04");
  });

  it("allows Engineer to update task status to in_progress and completed with notes", async () => {
    // Step 1: Start task
    const resProgress = await request(app)
      .patch(`/api/v1/tasks/${createdTaskId}`)
      .set("Authorization", `Bearer ${engineerToken}`)
      .send({ status: "in_progress" });

    expect(resProgress.status).toBe(200);
    expect(resProgress.body.data.status).toBe("in_progress");

    // Step 2: Complete task with notes
    const resComplete = await request(app)
      .patch(`/api/v1/tasks/${createdTaskId}`)
      .set("Authorization", `Bearer ${engineerToken}`)
      .send({
        status: "completed",
        completionNotes: "Seal replaced and pressure verified at 4.2 bar.",
      });

    expect(resComplete.status).toBe(200);
    expect(resComplete.body.data.status).toBe("completed");
    expect(resComplete.body.data.completionNotes).toContain("Seal replaced");
    expect(resComplete.body.data.completedAt).toBeDefined();
  });

  it("allows Manager to delete a task", async () => {
    const res = await request(app)
      .delete(`/api/v1/tasks/${createdTaskId}`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.deleted).toBe(true);

    // Verify it's gone
    const resCheck = await request(app)
      .get(`/api/v1/tasks/${createdTaskId}`)
      .set("Authorization", `Bearer ${engineerToken}`);
    expect(resCheck.status).toBe(404);
  });
});

