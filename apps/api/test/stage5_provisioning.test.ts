import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { EventEmitter } from "events";
import { PassThrough } from "stream";
import { app } from "../src/app";
import { User } from "../src/models";
import { provisionUser } from "../src/services/provision.service";
import { isConnectedToMongo, connectDatabase } from "../src/config/database";
import {
  parseAndSanitizeMongoTarget,
  promptMaskedPassword,
  parseArgs,
  sanitizeMongoMessage,
  provisionUserCli,
} from "../src/scripts/provision-user";

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
          "cli.hardened@plant.io",
        ],
      },
    });
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await connectDatabase();
    }
    await User.deleteMany({
      email: {
        $in: [
          "test.operator@plant.io",
          "test.engineer@plant.io",
          "test.viewer@plant.io",
          "existing.user@plant.io",
          "cli.hardened@plant.io",
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
    const originalPassword = "InitialPassword123!";
    const originalHash = await bcrypt.hash(originalPassword, 10);
    await User.create({
      name: "Existing Person",
      email: "existing.user@plant.io",
      passwordHash: originalHash,
      role: "engineer",
      orgId: "default-plant-org",
    });

    await expect(
      provisionUser({
        email: "existing.user@plant.io",
        name: "Malicious Overwrite",
        role: "admin",
        password: "NewOverwrittenPassword999!",
        confirm: true,
      })
    ).rejects.toThrow(/already exists.*Existing accounts and passwords cannot be overwritten/);

    const checkUser = await User.findOne({ email: "existing.user@plant.io" });
    expect(checkUser).not.toBeNull();
    expect(checkUser!.role).toBe("engineer");
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

  // ── 3. Stage 5.2.1 Hardened CLI & Security Tests ──────────────────────────

  describe("Hardened CLI Target Validation & Password Masking", () => {
    it("parseAndSanitizeMongoTarget correctly parses remote cluster targets and excludes credentials", () => {
      const uri = "mongodb+srv://admin_user:SuperSecretPassword123!@cluster0.abcde.mongodb.net/manuai_prod?retryWrites=true";
      const target = parseAndSanitizeMongoTarget(uri);

      expect(target.host).toBe("cluster0.abcde.mongodb.net");
      expect(target.database).toBe("manuai_prod");
      expect(target.isLocal).toBe(false);
      // Ensure credentials are NOT present in parsed host/db
      expect(target.host).not.toContain("admin_user");
      expect(target.host).not.toContain("SuperSecretPassword123!");
    });

    it("parseAndSanitizeMongoTarget detects localhost and 127.0.0.1 targets", () => {
      const targetLocal = parseAndSanitizeMongoTarget("mongodb://localhost:27017/manuai");
      expect(targetLocal.host).toBe("localhost:27017");
      expect(targetLocal.isLocal).toBe(true);

      const targetIp = parseAndSanitizeMongoTarget("mongodb://127.0.0.1:27017/testdb");
      expect(targetIp.isLocal).toBe(true);
    });

    it("parseAndSanitizeMongoTarget throws when URI is missing or empty", () => {
      expect(() => parseAndSanitizeMongoTarget("")).toThrow(/Target database URI is required/);
    });

    it("promptMaskedPassword masks interactive input with asterisks and restores terminal raw mode", async () => {
      const mockInput = new EventEmitter() as any;
      mockInput.isTTY = true;
      let rawModeState = false;
      mockInput.setRawMode = vi.fn((mode: boolean) => {
        rawModeState = mode;
      });
      mockInput.resume = vi.fn();

      let outputBuffer = "";
      const mockOutput = {
        write: vi.fn((chunk: string) => {
          outputBuffer += chunk;
        }),
      } as any;

      const promise = promptMaskedPassword("Enter password: ", mockInput, mockOutput);

      // Verify prompt was written and rawMode was enabled
      expect(mockOutput.write).toHaveBeenCalledWith("Enter password: ");
      expect(mockInput.setRawMode).toHaveBeenCalledWith(true);
      expect(rawModeState).toBe(true);

      // Simulate user typing 'p', 'a', 's', backspace, 's', enter
      mockInput.emit("data", Buffer.from("p"));
      mockInput.emit("data", Buffer.from("a"));
      mockInput.emit("data", Buffer.from("s"));
      mockInput.emit("data", Buffer.from("\u0008")); // backspace
      mockInput.emit("data", Buffer.from("s"));
      mockInput.emit("data", Buffer.from("\r")); // enter

      const result = await promise;
      expect(result).toBe("pas");
      // Verify rawMode restored to false
      expect(mockInput.setRawMode).toHaveBeenCalledWith(false);
      expect(rawModeState).toBe(false);
      // Verify asterisks were written
      expect(outputBuffer).toContain("***\b \b*");
    });

    it("provisionUserCli rejects plaintext --password command-line argument", async () => {
      await expect(
        provisionUserCli({
          args: {
            email: "cli.hardened@plant.io",
            password: "InsecureCliPassword123!",
            confirm: true,
          },
        })
      ).rejects.toThrow(/--password command-line argument is disabled for security/);
    });

    it("provisionUserCli fails closed when database URI is missing", async () => {
      await expect(
        provisionUserCli({
          args: {
            email: "cli.hardened@plant.io",
            confirm: true,
          },
          envVars: {}, // No TARGET_MONGODB_URI or MONGODB_URI
        })
      ).rejects.toThrow(/Target database URI is required/);
    });

    it("provisionUserCli refuses localhost database target by default without --allow-local", async () => {
      await expect(
        provisionUserCli({
          args: {
            email: "cli.hardened@plant.io",
            uri: "mongodb://127.0.0.1:27017/manuai_test",
            confirm: true,
          },
        })
      ).rejects.toThrow(/Local database provisioning is refused by default.*pass --allow-local/);
    });

    it("provisionUserCli rejects database mismatch when --target-db confirmation differs", async () => {
      await expect(
        provisionUserCli({
          args: {
            email: "cli.hardened@plant.io",
            uri: "mongodb://127.0.0.1:27017/manuai_test",
            "allow-local": true,
            "target-db": "manuai_production", // mismatch with 'manuai_test'
            confirm: true,
          },
          envVars: {
            PROVISION_PASSWORD: "SecurePassword123!",
          },
        })
      ).rejects.toThrow(/Target database mismatch: URI specifies database "manuai_test" but --target-db confirmation required "manuai_production"/);
    });

    it("provisionUserCli requires explicit --confirm flag", async () => {
      await expect(
        provisionUserCli({
          args: {
            email: "cli.hardened@plant.io",
            uri: "mongodb://127.0.0.1:27017/manuai_test",
            "allow-local": true,
            confirm: false,
          },
          envVars: {
            PROVISION_PASSWORD: "SecurePassword123!",
          },
        })
      ).rejects.toThrow(/Confirmation required\. Pass --confirm/);
    });

    it("provisionUserCli successfully provisions account with verified target and --allow-local", async () => {
      const outputStream = new PassThrough();
      let outputText = "";
      outputStream.on("data", (chunk) => {
        outputText += chunk.toString();
      });

      const result = await provisionUserCli({
        args: {
          email: "cli.hardened@plant.io",
          name: "Hardened Operator",
          role: "engineer",
          uri: "mongodb://127.0.0.1:27017/manuai_test",
          "allow-local": true,
          "target-db": "manuai_test",
          confirm: true,
        },
        envVars: {
          PROVISION_PASSWORD: "HardenedPassword123!",
        },
        output: outputStream,
      });

      expect(result.id).toBeDefined();
      expect(result.email).toBe("cli.hardened@plant.io");
      expect(result.role).toBe("engineer");

      // Verify output displayed sanitized host and database
      expect(outputText).toContain("[Provision] Target Host:     127.0.0.1:27017");
      expect(outputText).toContain("[Provision] Target Database: manuai_test");
      expect(outputText).toContain("[Provision] Operator Email:  cli.hardened@plant.io");
      expect(outputText).toContain("[Provision] Account provisioned successfully!");

      // Verify second attempt on existing account throws and refuses overwrite
      await expect(
        provisionUserCli({
          args: {
            email: "cli.hardened@plant.io",
            uri: "mongodb://127.0.0.1:27017/manuai_test",
            "allow-local": true,
            confirm: true,
          },
          envVars: {
            PROVISION_PASSWORD: "NewDifferentPassword456!",
          },
          output: outputStream,
        })
      ).rejects.toThrow(/already exists.*Existing accounts and passwords cannot be overwritten/);
    });
  });
});
