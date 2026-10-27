import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { app } from "../src/app";
import { connectDatabase } from "../src/config/database";
import { env } from "../src/config/env";
import { User, Equipment, DocumentModel } from "../src/models";

describe("Manager / Operator Role RBAC & Access Boundaries", () => {
  const runId = Date.now();
  let adminId: string;
  let adminToken: string;
  let managerId: string;
  let managerToken: string;
  let viewerId: string;
  let viewerToken: string;
  const createdEquipmentIds: string[] = [];
  const createdDocIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    await connectDatabase();

    // 1. Admin account
    adminId = new mongoose.Types.ObjectId().toString();
    createdUserIds.push(adminId);
    await User.create({
      _id: adminId,
      name: "Plant Admin Test",
      email: `admin-${runId}@plant.io`,
      passwordHash: "mockedHashForTestOnly123!",
      role: "admin",
    });
    adminToken = jwt.sign(
      { id: adminId, email: `admin-${runId}@plant.io`, name: "Plant Admin Test", role: "admin" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 2. Manager account
    managerId = new mongoose.Types.ObjectId().toString();
    createdUserIds.push(managerId);
    await User.create({
      _id: managerId,
      name: "Plant Operations Manager",
      email: `manager-${runId}@plant.io`,
      passwordHash: "mockedHashForTestOnly123!",
      role: "manager",
    });
    managerToken = jwt.sign(
      { id: managerId, email: `manager-${runId}@plant.io`, name: "Plant Operations Manager", role: "manager" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // 3. Viewer account
    viewerId = new mongoose.Types.ObjectId().toString();
    createdUserIds.push(viewerId);
    await User.create({
      _id: viewerId,
      name: "Guest Sandbox Viewer",
      email: `viewer-${runId}@plant.io`,
      passwordHash: "mockedHashForTestOnly123!",
      role: "viewer",
    });
    viewerToken = jwt.sign(
      { id: viewerId, email: `viewer-${runId}@plant.io`, name: "Guest Sandbox Viewer", role: "viewer" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );
  });

  afterAll(async () => {
    try {
      if (createdUserIds.length > 0) {
        await User.deleteMany({ _id: { $in: createdUserIds } });
      }
      if (createdEquipmentIds.length > 0) {
        await Equipment.deleteMany({ _id: { $in: createdEquipmentIds } });
      }
      if (createdDocIds.length > 0) {
        await DocumentModel.deleteMany({ _id: { $in: createdDocIds } });
      }
    } catch {}
  });

  // ── 1. Admin Authorized Operations ──────────────────────────────────────────

  it("permits admin to list all users (GET /api/v1/users)", async () => {
    const res = await request(app)
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("permits admin to promote an account to manager (PATCH /api/v1/users/:id/role)", async () => {
    const targetUserId = new mongoose.Types.ObjectId().toString();
    createdUserIds.push(targetUserId);
    await User.create({
      _id: targetUserId,
      name: "Candidate Operator",
      email: `candidate-${runId}@plant.io`,
      passwordHash: "hash123",
      role: "viewer",
    });

    const res = await request(app)
      .patch(`/api/v1/users/${targetUserId}/role`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: "manager" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.role).toBe("manager");

    const updatedUser = await User.findById(targetUserId);
    expect(updatedUser?.role).toBe("manager");
  });

  // ── 2. Manager Permitted Operational Capabilities ────────────────────────────

  it("permits manager to view equipment list (GET /api/v1/equipment)", async () => {
    const res = await request(app)
      .get("/api/v1/equipment")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("permits manager to create equipment records (POST /api/v1/equipment)", async () => {
    const serial = `MGR-SN-${runId}`;
    const name = `Manager Centrifugal Pump ${runId}`;

    const res = await request(app)
      .post("/api/v1/equipment")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        name,
        type: "PUMP",
        location: "Sector B-7",
        serialNumber: serial,
        manufacturer: "Industrial Flow Corp",
        model: "IFC-400",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe(name);
    expect(res.body.data.serialNumber).toBe(serial);
    if (res.body.data.id) {
      createdEquipmentIds.push(res.body.data.id);
    }
  });

  it("permits manager to access operational summaries (GET /api/v1/summaries)", async () => {
    const res = await request(app)
      .get("/api/v1/summaries")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it("permits manager to upload industrial SOP documents (POST /api/v1/documents/upload)", async () => {
    const res = await request(app)
      .post("/api/v1/documents/upload")
      .set("Authorization", `Bearer ${managerToken}`)
      .attach(
        "file",
        Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"),
        "manager_sop_doc.pdf"
      );

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    createdDocIds.push(res.body.data.id);
  });

  // ── 3. Manager Restricted Administrative Boundaries ──────────────────────────

  it("rejects manager from accessing administrative audit log (GET /api/v1/audit)", async () => {
    const res = await request(app)
      .get("/api/v1/audit")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects manager from listing users (GET /api/v1/users)", async () => {
    const res = await request(app)
      .get("/api/v1/users")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects manager from provisioning users (POST /api/v1/users)", async () => {
    const res = await request(app)
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({
        name: "Rogue User",
        email: `rogue-${runId}@plant.io`,
        password: "ValidPassword123!",
        role: "admin",
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects manager from escalating user roles (PATCH /api/v1/users/:id/role)", async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${managerId}/role`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ role: "admin" });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects manager from modifying system settings (PUT /api/v1/settings)", async () => {
    const res = await request(app)
      .put("/api/v1/settings")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ facilityName: "Compromised Facility" });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects manager from testing integrations (POST /api/v1/integrations/:id/test)", async () => {
    const res = await request(app)
      .post("/api/v1/integrations/mongodb/test")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects manager from viewing admin health diagnostics (GET /api/v1/health/diagnostics)", async () => {
    const res = await request(app)
      .get("/api/v1/health/diagnostics")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  // ── 4. Viewer Blocked from Write & Operational Actions ────────────────────────

  it("rejects viewer from uploading documents (POST /api/v1/documents/upload)", async () => {
    const res = await request(app)
      .post("/api/v1/documents/upload")
      .set("Authorization", `Bearer ${viewerToken}`)
      .attach(
        "file",
        Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"),
        "viewer_upload_attempt.pdf"
      );

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects viewer from creating equipment (POST /api/v1/equipment)", async () => {
    const res = await request(app)
      .post("/api/v1/equipment")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        name: "Viewer Equipment Attempt",
        type: "PUMP",
        location: "Restricted",
        serialNumber: `VIEWER-${runId}`,
        manufacturer: "Unauthorized Corp",
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("rejects viewer from accessing operational summaries (GET /api/v1/summaries)", async () => {
    const res = await request(app)
      .get("/api/v1/summaries")
      .set("Authorization", `Bearer ${viewerToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  // ── 5. Public Registration Defense ──────────────────────────────────────────

  it("rejects public registration attempting to self-assign admin role", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Hacker Admin Attempt",
        email: `hack-admin-${runId}@plant.io`,
        password: "ValidPassword123!",
        role: "admin",
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("ROLE_UNAUTHORIZED");
  });

  it("enforces permitted viewer role when public registrant supplies manager role field", async () => {
    const email = `hack-manager-${runId}@plant.io`;
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Hacker Manager Attempt",
        email,
        password: "ValidPassword123!",
        role: "manager",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    // The server enforces the permitted role (viewer) regardless of client-supplied role
    expect(res.body.data.user.role).toBe("viewer");
    if (res.body.data.user.id) {
      createdUserIds.push(res.body.data.user.id);
    }

    const createdUser = await User.findOne({ email });
    expect(createdUser?.role).toBe("viewer");
  });

  it("registers public user as viewer when no privileged role is requested", async () => {
    const email = `public-user-${runId}@plant.io`;
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Legit Public Registrant",
        email,
        password: "ValidPassword123!",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe("viewer");
    if (res.body.data.user.id) {
      createdUserIds.push(res.body.data.user.id);
    }

    const createdUser = await User.findOne({ email });
    expect(createdUser?.role).toBe("viewer");
  });
});
