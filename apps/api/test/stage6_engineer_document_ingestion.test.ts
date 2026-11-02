import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { PassThrough } from "stream";
import { app } from "../src/app";
import { connectDatabase, isConnectedToMongo } from "../src/config/database";
import { User, DocumentModel, AuditEvent } from "../src/models";
import { promoteUser } from "../src/services/provision.service";
import { promoteUserCli } from "../src/scripts/promote-user";

describe("Stage 6: Real Production Engineer Provisioning & Document Ingestion Suite", () => {
  const targetEmail = "engineer@plant.io";
  const rawPassword = "EngineerPassword123!";
  let passwordHashBefore: string;
  let viewerToken: string;
  let engineerToken: string;

  const validPdfBuffer = Buffer.from(
    "%PDF-1.4\n1 0 obj\n<< /Title (Turbine Operating Manual) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"
  );

  beforeAll(async () => {
    await connectDatabase();

    // Clean up test data for target account
    await User.deleteMany({ email: targetEmail });
    await DocumentModel.deleteMany({ title: "Turbine Operating Manual" });
    await AuditEvent.deleteMany({ "details.targetEmail": targetEmail });

    // 1. Initial State: Simulate exact production state where engineer@plant.io exists as a Viewer
    passwordHashBefore = await bcrypt.hash(rawPassword, 10);
    await User.collection.insertOne({
      name: "Alex Mercer",
      email: targetEmail,
      passwordHash: passwordHashBefore,
      role: "operator", // Starts as OPERATOR
      orgId: "plant-alpha",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  });

  afterAll(async () => {
    if (!isConnectedToMongo) return;
    await User.deleteMany({ email: targetEmail });
    await DocumentModel.deleteMany({ title: "Turbine Operating Manual" });
    await AuditEvent.deleteMany({ "details.targetEmail": targetEmail });
  });

  it("1. Existing account authenticates as Viewer before provisioning", async () => {
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: targetEmail, password: rawPassword });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.user.role).toBe("operator");

    viewerToken = loginRes.body.data.token;
    expect(viewerToken).toBeDefined();

    // Verify /auth/me reflects viewer role
    const meRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${viewerToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.role).toBe("operator");
  });

  it("2. Viewer account is strictly forbidden from uploading technical documents (HTTP 403)", async () => {
    const uploadRes = await request(app)
      .post("/api/v1/documents/upload")
      .set("Authorization", `Bearer ${viewerToken}`)
      .attach("file", validPdfBuffer, "turbine_sop.pdf")
      .field("title", "Turbine Operating Manual");

    expect(uploadRes.status).toBe(403);
    expect(uploadRes.body.success).toBe(false);
    expect(uploadRes.body.error.code).toBe("FORBIDDEN");
  });

  it("3. Unauthenticated requests are rejected with HTTP 401", async () => {
    const uploadRes = await request(app)
      .post("/api/v1/documents/upload")
      .attach("file", validPdfBuffer, "turbine_sop.pdf");

    expect(uploadRes.status).toBe(401);
    expect(uploadRes.body.success).toBe(false);
  });

  it("4. Promotion without explicit operator confirmation fails safely closed", async () => {
    await expect(
      promoteUser({
        email: targetEmail,
        role: "engineer",
        confirm: false as any,
      })
    ).rejects.toThrow(/confirmation/i);

    // Verify user role is unchanged in database
    const user = await User.findOne({ email: targetEmail });
    expect(user?.role).toBe("operator");
  });

  it("5. CLI promote-user rejects invalid arguments and enforces confirmation", async () => {
    const output = new PassThrough();

    // Missing email
    await expect(
      promoteUserCli({
        args: { role: "engineer" },
        output,
      })
    ).rejects.toThrow(/--email=<email> is required/i);

    // Missing role
    await expect(
      promoteUserCli({
        args: { email: targetEmail },
        output,
      })
    ).rejects.toThrow(/--role=<role> is required/i);

    // Invalid role
    await expect(
      promoteUserCli({
        args: { email: targetEmail, role: "superadmin" },
        output,
      })
    ).rejects.toThrow(/invalid role/i);

    // Missing target-db
    await expect(
      promoteUserCli({
        args: {
          email: targetEmail,
          role: "engineer",
          uri: "mongodb://localhost:27017/manuai_test",
          "allow-local": true,
          confirm: true,
        },
        output,
      })
    ).rejects.toThrow(/--target-db=<database-name> confirmation is required/i);

    // Missing confirm
    await expect(
      promoteUserCli({
        args: {
          email: targetEmail,
          role: "engineer",
          "target-db": "manuai_test",
          uri: "mongodb://localhost:27017/manuai_test",
          "allow-local": true,
        },
        output,
      })
    ).rejects.toThrow(/pass --confirm to authorize/i);
  });

  it("6. Authorized promotion updates role to Engineer, strictly preserving password intact", async () => {
    let capturedOutput = "";
    const output = new PassThrough();
    output.on("data", (chunk) => {
      capturedOutput += chunk.toString();
    });

    const result = await promoteUserCli({
      args: {
        email: targetEmail,
        role: "engineer",
        "target-db": "manuai_test",
        uri: "mongodb://localhost:27017/manuai_test",
        "allow-local": true,
        confirm: true,
      },
      output,
    });

    expect(result.email).toBe(targetEmail);
    expect(result.previousRole).toBe("operator");
    expect(result.role).toBe("engineer");
    expect(result.alreadySet).toBe(false);

    // Reconnect to test database since CLI disconnected on completion
    await connectDatabase();

    // Check database record directly
    const userInDb = await User.findOne({ email: targetEmail });
    expect(userInDb).toBeDefined();
    expect(userInDb?.role).toBe("engineer");

    // Critical security check: password hash must remain completely unchanged
    expect(userInDb?.passwordHash).toBe(passwordHashBefore);
    const passwordStillValid = await bcrypt.compare(rawPassword, userInDb!.passwordHash);
    expect(passwordStillValid).toBe(true);

    // Output inspection: confirms before and after role are printed without secrets
    expect(capturedOutput).toContain("Target Account:  engineer@plant.io");
    expect(capturedOutput).toContain("Previous Role: operator");
    expect(capturedOutput).toContain("Current Role:  engineer");
    expect(capturedOutput).not.toContain(rawPassword);

    // Audit log verification
    const auditRecord = await AuditEvent.findOne({
      action: "role_change",
      "details.targetEmail": targetEmail,
    });
    expect(auditRecord).toBeDefined();
    expect(auditRecord?.details.previousRole).toBe("operator");
    expect(auditRecord?.details.newRole).toBe("engineer");
  });

  it("7. Repeated promotion is idempotent and causes no redundant mutations", async () => {
    const result = await promoteUser({
      email: targetEmail,
      role: "engineer",
      confirm: true,
    });

    expect(result.role).toBe("engineer");
    expect(result.previousRole).toBe("engineer");
    expect(result.alreadySet).toBe(true);
  });

  it("8. Fresh login for provisioned Engineer returns Engineer role and valid JWT", async () => {
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: targetEmail, password: rawPassword });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.data.user.role).toBe("engineer");

    engineerToken = loginRes.body.data.token;
    expect(engineerToken).toBeDefined();

    const meRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${engineerToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.data.role).toBe("engineer");
  });

  it("9. Old Viewer session token is resolved against database role by auth middleware", async () => {
    // When MongoDB is connected, requireAuth queries the live DB user
    const meResWithOldToken = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${viewerToken}`);

    expect(meResWithOldToken.status).toBe(200);
    expect(meResWithOldToken.body.data.role).toBe("engineer");
  });

  it("10. Provisioned Engineer successfully uploads valid PDF document (HTTP 202 processing)", async () => {
    const uploadRes = await request(app)
      .post("/api/v1/documents/upload")
      .set("Authorization", `Bearer ${engineerToken}`)
      .attach("file", validPdfBuffer, "turbine_sop.pdf")
      .field("title", "Turbine Operating Manual")
      .field("revision", "Rev 2.1");

    expect(uploadRes.status).toBe(202);
    expect(uploadRes.body.success).toBe(true);
    expect(uploadRes.body.data.status).toBe("processing");
    expect(uploadRes.body.data.title).toBe("Turbine Operating Manual");

    const createdDocId = uploadRes.body.data.id;
    expect(createdDocId).toBeDefined();

    // Check persistence in MongoDB
    const docInDb = await DocumentModel.findById(createdDocId);
    expect(docInDb).toBeDefined();
    expect(docInDb?.title).toBe("Turbine Operating Manual");
    expect(docInDb?.revision).toBe("Rev 2.1");
    expect(docInDb?.filename).toBe("turbine_sop.pdf");
  });

  it("11. Rejects invalid and unsupported files (non-PDF or corrupted signature)", async () => {
    // Unsupported extension
    const badExtRes = await request(app)
      .post("/api/v1/documents/upload")
      .set("Authorization", `Bearer ${engineerToken}`)
      .attach("file", Buffer.from("CAD file data"), "drawing.dwg");

    expect(badExtRes.status).toBe(400);
    expect(badExtRes.body.error.code).toBe("UNSUPPORTED_FILE_TYPE");

    // Invalid PDF magic signature
    const fakePdfRes = await request(app)
      .post("/api/v1/documents/upload")
      .set("Authorization", `Bearer ${engineerToken}`)
      .attach("file", Buffer.from("NOT_A_REAL_PDF_HEADER"), "fake.pdf");

    expect(fakePdfRes.status).toBe(400);
    expect(fakePdfRes.body.error.code).toBe("INVALID_FILE_SIGNATURE");
  });
});
