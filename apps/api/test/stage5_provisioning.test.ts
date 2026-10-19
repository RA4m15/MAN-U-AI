import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { app } from "../src/app";
import { User } from "../src/models";
import { provisionUser } from "../src/services/provision.service";
import { isConnectedToMongo, connectDatabase } from "../src/config/database";

describe("Stage 5.2 — Operator Account Provisioning & Auth Security", () => {
  beforeEach(async () => {
    if (!isConnectedToMongo) {
      await connectDatabase();
    }
    // Clean up test-specific accounts
    await User.deleteMany({
      email: {
        $in: [
          "test.operator@plant.io",
          "test.engineer@plant.io",
          "test.viewer@plant.io",
          "existing.user@plant.io",
        ],
      },
    });
  });

  afterAll(async () => {
    await User.deleteMany({
      email: {
        $in: [
          "test.operator@plant.io",
          "test.engineer@plant.io",
          "test.viewer@plant.io",
          "existing.user@plant.io",
        ],
      },
    });
  });

  // ── 1. Provisioning Service Tests ──────────────────────────────────────────

  it("provisions a new admin operator account with bcrypt hash and confirmed flag", async () => {
    const rawPassword = "SuperSecurePassword123!";
    const result = await provisionUser({
      email: "test.operator@plant.io",
      name: "Test Administrator",
      role: "admin",
      password: rawPassword,
      confirm: true,
    });

    expect(result.id).toBeDefined();
    expect(result.email).toBe("test.operator@plant.io");
    expect(result.name).toBe("Test Administrator");
    expect(result.role).toBe("admin");

    // Verify stored user in database
    const savedUser = await User.findOne({ email: "test.operator@plant.io" });
    expect(savedUser).not.toBeNull();
    expect(savedUser!.email).toBe("test.operator@plant.io");
    expect(savedUser!.role).toBe("admin");

    // Verify password is encrypted with bcrypt
    expect(savedUser!.passwordHash).not.toBe(rawPassword);
    const isMatch = await bcrypt.compare(rawPassword, savedUser!.passwordHash);
    expect(isMatch).toBe(true);

    // Verify raw password never leaks in returned object
    expect((result as any).password).toBeUndefined();
    expect((result as any).passwordHash).toBeUndefined();
  });

  it("provisions accounts with allowed roles (engineer, viewer)", async () => {
    const engResult = await provisionUser({
      email: "test.engineer@plant.io",
      role: "engineer",
      password: "EngPassword123!",
      confirm: true,
    });
    expect(engResult.role).toBe("engineer");

    const viewerResult = await provisionUser({
      email: "test.viewer@plant.io",
      role: "viewer",
      password: "ViewerPassword123!",
      confirm: true,
    });
    expect(viewerResult.role).toBe("viewer");
  });

  it("rejects invalid roles with a descriptive error", async () => {
    await expect(
      provisionUser({
        email: "test.operator@plant.io",
        role: "superadmin" as any,
        password: "ValidPassword123!",
        confirm: true,
      })
    ).rejects.toThrow(/Invalid role\. Allowed roles are: admin, engineer, viewer/);
  });

  it("rejects provisioning when confirmation flag is false or omitted", async () => {
    await expect(
      provisionUser({
        email: "test.operator@plant.io",
        role: "admin",
        password: "ValidPassword123!",
        confirm: false as any,
      })
    ).rejects.toThrow(/Explicit confirmation required/);
  });

  it("rejects passwords shorter than 8 characters", async () => {
    await expect(
      provisionUser({
        email: "test.operator@plant.io",
        role: "admin",
        password: "short",
        confirm: true,
      })
    ).rejects.toThrow(/Password must be at least 8 characters long/);
  });

  it("rejects invalid email formats", async () => {
    await expect(
      provisionUser({
        email: "not-an-email",
        role: "admin",
        password: "ValidPassword123!",
        confirm: true,
      })
    ).rejects.toThrow(/Invalid email format/);
  });

  it("strictly protects existing accounts and refuses password overwrite", async () => {
    // Create an existing account with an established password
    const originalPassword = "InitialPassword123!";
    const originalHash = await bcrypt.hash(originalPassword, 10);
    await User.create({
      name: "Existing Person",
      email: "existing.user@plant.io",
      passwordHash: originalHash,
      role: "engineer",
      orgId: "default-plant-org",
    });

    // Attempt to provision over existing account with a new password
    await expect(
      provisionUser({
        email: "existing.user@plant.io",
        name: "Malicious Overwrite",
        role: "admin",
        password: "NewOverwrittenPassword999!",
        confirm: true,
      })
    ).rejects.toThrow(/already exists.*Existing accounts and passwords cannot be overwritten/);

    // Verify existing password was NOT modified
    const checkUser = await User.findOne({ email: "existing.user@plant.io" });
    expect(checkUser).not.toBeNull();
    expect(checkUser!.role).toBe("engineer"); // Unchanged
    const isOriginalMatch = await bcrypt.compare(originalPassword, checkUser!.passwordHash);
    expect(isOriginalMatch).toBe(true);
    const isNewMatch = await bcrypt.compare("NewOverwrittenPassword999!", checkUser!.passwordHash);
    expect(isNewMatch).toBe(false);
  });

  // ── 2. Production Registration & Login Security Endpoint Tests ─────────────

  it("enforces registration restriction in production mode", async () => {
    const originalEnv = process.env.NODE_ENV;
    const originalReg = process.env.ENABLE_PUBLIC_REGISTRATION;

    try {
      process.env.NODE_ENV = "production";
      delete process.env.ENABLE_PUBLIC_REGISTRATION;

      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Attacker",
          email: "attacker@plant.io",
          password: "AttackerPassword123!",
          role: "engineer",
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("REGISTRATION_RESTRICTED");
      expect(res.body.error.message).toContain("Public self-registration is disabled in production");
    } finally {
      process.env.NODE_ENV = originalEnv;
      if (originalReg) process.env.ENABLE_PUBLIC_REGISTRATION = originalReg;
    }
  });

  it("returns 401 INVALID_CREDENTIALS for failed login attempts without user enumeration", async () => {
    // Non-existent user
    const res1 = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "nonexistent.operator@plant.io",
        password: "AnyPassword123!",
      });

    expect(res1.status).toBe(401);
    expect(res1.body.success).toBe(false);
    expect(res1.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(res1.body.error.message).toBe("Invalid email or password");

    // Existing user with wrong password
    await provisionUser({
      email: "test.operator@plant.io",
      role: "admin",
      password: "CorrectPassword123!",
      confirm: true,
    });

    const res2 = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "test.operator@plant.io",
        password: "WrongPassword999!",
      });

    expect(res2.status).toBe(401);
    expect(res2.body.success).toBe(false);
    expect(res2.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(res2.body.error.message).toBe("Invalid email or password");

    // Existing user with correct password succeeds
    const res3 = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "test.operator@plant.io",
        password: "CorrectPassword123!",
      });

    expect(res3.status).toBe(200);
    expect(res3.body.success).toBe(true);
    expect(res3.body.data.token).toBeDefined();
    expect(res3.body.data.user.email).toBe("test.operator@plant.io");
    expect(res3.body.data.user.role).toBe("admin");
  });
});
