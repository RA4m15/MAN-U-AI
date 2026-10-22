import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import os from "os";
import { EventEmitter } from "events";
import { PassThrough } from "stream";
import { app } from "../src/app";
import { User } from "../src/models";
import { provisionUser } from "../src/services/provision.service";
import { isConnectedToMongo, connectDatabase } from "../src/config/database";
import {
  parseAndSanitizeMongoTarget,
  cleanMongoUri,
  promptMaskedPassword,
  parseArgs,
  sanitizeMongoMessage,
  provisionUserCli,
  findCanonicalRootEnvPath,
  loadCanonicalRootEnv,
  getProvisionUser,
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
          "cli.recovered@plant.io",
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
          "cli.recovered@plant.io",
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

  // ── 3. Stage 5.2.1 & 5.2.2 Hardened CLI & Security Tests ──────────────────

  describe("Hardened CLI Target Validation, Role Enforcement & Password Masking", () => {
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

    it("parseAndSanitizeMongoTarget normalizes uppercase and IPv4/IPv6 loopback variants", () => {
      // Uppercase LOCALHOST
      const targetUpper = parseAndSanitizeMongoTarget("mongodb://LOCALHOST:27017/manuai");
      expect(targetUpper.isLocal).toBe(true);

      // Mixed-case LocalHost
      const targetMixed = parseAndSanitizeMongoTarget("mongodb://LocalHost:27017/manuai");
      expect(targetMixed.isLocal).toBe(true);

      // Standard IPv4 loopback
      const targetIp1 = parseAndSanitizeMongoTarget("mongodb://127.0.0.1:27017/testdb");
      expect(targetIp1.isLocal).toBe(true);

      // IPv4 loopback subnet variants (127.0.1.1, 127.255.255.254)
      const targetIp2 = parseAndSanitizeMongoTarget("mongodb://127.0.1.1:27017/testdb");
      expect(targetIp2.isLocal).toBe(true);
      const targetIp3 = parseAndSanitizeMongoTarget("mongodb://127.255.255.254:27017/testdb");
      expect(targetIp3.isLocal).toBe(true);

      // 0.0.0.0 loopback
      const targetZero = parseAndSanitizeMongoTarget("mongodb://0.0.0.0:27017/testdb");
      expect(targetZero.isLocal).toBe(true);

      // IPv6 loopback variants [::1] and ::1
      const targetIpv6Bracket = parseAndSanitizeMongoTarget("mongodb://[::1]:27017/testdb");
      expect(targetIpv6Bracket.isLocal).toBe(true);
      const targetIpv6Plain = parseAndSanitizeMongoTarget("mongodb://::1/testdb");
      expect(targetIpv6Plain.isLocal).toBe(true);

      // Remote Atlas host should not be local
      const targetRemote = parseAndSanitizeMongoTarget("mongodb+srv://cluster0.abcde.mongodb.net/manuai");
      expect(targetRemote.isLocal).toBe(false);
    });

    it("parseAndSanitizeMongoTarget throws when URI is missing or empty", () => {
      expect(() => parseAndSanitizeMongoTarget("")).toThrow(/Target database URI is required/);
      expect(() => parseAndSanitizeMongoTarget("   ")).toThrow(/Target database URI is empty/);
    });

    it("parseAndSanitizeMongoTarget rejects invalid schemes and control character glitched inputs like ^V", () => {
      // Literal ^V string
      expect(() => parseAndSanitizeMongoTarget("^V")).toThrow(/Unsupported MongoDB URI scheme/);
      // Raw control character \x16 (Synchronous Idle / Ctrl+V)
      expect(() => parseAndSanitizeMongoTarget("\x16")).toThrow(/Target database URI is empty/);
      // HTTPS instead of mongodb
      expect(() => parseAndSanitizeMongoTarget("https://cluster0.abcde.mongodb.net/manuai")).toThrow(/Unsupported MongoDB URI scheme/);
    });

    it("parseAndSanitizeMongoTarget strips wrapping quotes and leading/trailing control characters", () => {
      // Wrapped in double quotes
      const doubleQuoted = parseAndSanitizeMongoTarget('"mongodb+srv://cluster0.abcde.mongodb.net/manuai"');
      expect(doubleQuoted.host).toBe("cluster0.abcde.mongodb.net");
      expect(doubleQuoted.database).toBe("manuai");

      // Wrapped in single quotes
      const singleQuoted = parseAndSanitizeMongoTarget("'mongodb+srv://cluster0.abcde.mongodb.net/manuai'");
      expect(singleQuoted.host).toBe("cluster0.abcde.mongodb.net");
      expect(singleQuoted.database).toBe("manuai");

      // Leading control characters with valid URI
      const ctrlCharUri = parseAndSanitizeMongoTarget("\x16mongodb+srv://cluster0.abcde.mongodb.net/manuai\r\n");
      expect(ctrlCharUri.host).toBe("cluster0.abcde.mongodb.net");
      expect(ctrlCharUri.database).toBe("manuai");
    });

    it("cleanMongoUri strips quotes, whitespace, and control characters", () => {
      expect(cleanMongoUri('  "mongodb+srv://cluster.mongodb.net/manuai"  ')).toBe("mongodb+srv://cluster.mongodb.net/manuai");
      expect(cleanMongoUri("  'mongodb+srv://cluster.mongodb.net/manuai'  ")).toBe("mongodb+srv://cluster.mongodb.net/manuai");
      expect(cleanMongoUri("\x16\x00mongodb+srv://cluster.mongodb.net/manuai\r\n")).toBe("mongodb+srv://cluster.mongodb.net/manuai");
      expect(cleanMongoUri("")).toBe("");
    });

    it("parseAndSanitizeMongoTarget rejects accidental PowerShell command text from clipboard", () => {
      expect(() =>
        parseAndSanitizeMongoTarget("$env:TARGET_MONGODB_URI = (Get-Clipboard -Raw).Trim()")
      ).toThrow(/Unsupported MongoDB URI scheme/);

      expect(() =>
        parseAndSanitizeMongoTarget('$env:TARGET_MONGODB_URI = Read-Host "Paste your NEW MongoDB Atlas URI"')
      ).toThrow(/Unsupported MongoDB URI scheme/);

      expect(() =>
        parseAndSanitizeMongoTarget('Write-Host "Valid MongoDB scheme:" ($u -match \'^mongodb(\\+srv)?://\')')
      ).toThrow(/Unsupported MongoDB URI scheme/);
    });

    it("parseAndSanitizeMongoTarget rejects malformed hostnames and whitespace in database", () => {
      // Missing host
      expect(() => parseAndSanitizeMongoTarget("mongodb+srv:///manuai")).toThrow(/Hostname is invalid or missing/);
      // Spaces in host
      expect(() => parseAndSanitizeMongoTarget("mongodb+srv://cluster .mongodb.net/manuai")).toThrow(/Hostname is invalid or missing/);
      // Extra unescaped @ in password/host
      expect(() => parseAndSanitizeMongoTarget("mongodb+srv://user:pass@word@cluster.mongodb.net/manuai")).toThrow(/Hostname is invalid or missing/);
      // Whitespace in database name
      expect(() => parseAndSanitizeMongoTarget("mongodb+srv://cluster.mongodb.net/man uai")).toThrow(/Database name contains invalid whitespace/);
    });

    it("parseAndSanitizeMongoTarget correctly handles query parameters and percent-encoded credentials", () => {
      const targetWithParams = parseAndSanitizeMongoTarget(
        "mongodb+srv://admin%40plant.io:Secret%21Pass%402026@cluster0.abcde.mongodb.net/manuai?retryWrites=true&w=majority"
      );
      expect(targetWithParams.host).toBe("cluster0.abcde.mongodb.net");
      expect(targetWithParams.database).toBe("manuai");
      expect(targetWithParams.isLocal).toBe(false);

      // Multi-host replica set with query params
      const multiHostTarget = parseAndSanitizeMongoTarget(
        "mongodb://operator:pass@mongo-1.corp.net:27017,mongo-2.corp.net:27017/manuai?replicaSet=rs0"
      );
      expect(multiHostTarget.host).toBe("mongo-1.corp.net:27017,mongo-2.corp.net:27017");
      expect(multiHostTarget.database).toBe("manuai");
      expect(multiHostTarget.isLocal).toBe(false);
    });

    it("sanitizeMongoMessage redacts sensitive credentials from messages and connection strings", () => {
      const rawError = "Error: Authentication failed for mongodb+srv://db_admin:P%40ssw0rd99!@cluster0.90gymzr.mongodb.net/manuai?retryWrites=true";
      const sanitized = sanitizeMongoMessage(rawError);
      expect(sanitized).toBe("Error: Authentication failed for mongodb+srv://[REDACTED]@cluster0.90gymzr.mongodb.net/manuai?retryWrites=true");
      expect(sanitized).not.toContain("db_admin");
      expect(sanitized).not.toContain("P%40ssw0rd99!");
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

    it("promptMaskedPassword rejects and fails closed when input stream is non-TTY", async () => {
      const nonTtyInput = new PassThrough();
      const mockOutput = { write: vi.fn() } as any;

      await expect(
        promptMaskedPassword("Enter password: ", nonTtyInput, mockOutput)
      ).rejects.toThrow(/Interactive password masking requires a TTY terminal.*PROVISION_PASSWORD/);
    });

    it("provisionUserCli fails closed in non-interactive mode when PROVISION_PASSWORD is not set", async () => {
      const nonTtyInput = new PassThrough();

      await expect(
        provisionUserCli({
          args: {
            email: "cli.hardened@plant.io",
            role: "admin",
            uri: "mongodb://127.0.0.1:27017/manuai_test",
            "allow-local": true,
            "target-db": "manuai_test",
            confirm: true,
          },
          envVars: {}, // No PROVISION_PASSWORD
          input: nonTtyInput,
        })
      ).rejects.toThrow(/Non-interactive terminal detected without secure password input.*PROVISION_PASSWORD/);
    });

    it("provisionUserCli requires explicitly supplied --role", async () => {
      await expect(
        provisionUserCli({
          args: {
            email: "cli.hardened@plant.io",
            // missing role!
            uri: "mongodb://127.0.0.1:27017/manuai_test",
            "allow-local": true,
            "target-db": "manuai_test",
            confirm: true,
          },
          envVars: {
            PROVISION_PASSWORD: "SecurePassword123!",
          },
        })
      ).rejects.toThrow(/Error: --role=<role> is required\. Allowed roles are: admin, engineer, viewer/);
    });

    it("provisionUserCli rejects invalid --role values", async () => {
      await expect(
        provisionUserCli({
          args: {
            email: "cli.hardened@plant.io",
            role: "superadmin", // Invalid
            uri: "mongodb://127.0.0.1:27017/manuai_test",
            "allow-local": true,
            "target-db": "manuai_test",
            confirm: true,
          },
          envVars: {
            PROVISION_PASSWORD: "SecurePassword123!",
          },
        })
      ).rejects.toThrow(/Error: Invalid role "superadmin"\. Allowed roles are: admin, engineer, viewer/);
    });

    it("provisionUserCli rejects plaintext --password command-line argument", async () => {
      await expect(
        provisionUserCli({
          args: {
            email: "cli.hardened@plant.io",
            role: "admin",
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
            role: "admin",
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
            role: "admin",
            uri: "mongodb://127.0.0.1:27017/manuai_test",
            confirm: true,
          },
        })
      ).rejects.toThrow(/Local database provisioning is refused by default.*pass --allow-local/);
    });

    it("provisionUserCli requires explicit --target-db confirmation flag", async () => {
      await expect(
        provisionUserCli({
          args: {
            email: "cli.hardened@plant.io",
            role: "admin",
            uri: "mongodb://127.0.0.1:27017/manuai_test",
            "allow-local": true,
            // missing --target-db!
            confirm: true,
          },
          envVars: {
            PROVISION_PASSWORD: "SecurePassword123!",
          },
        })
      ).rejects.toThrow(/Explicit --target-db=<database-name> confirmation is required before any writes/);
    });

    it("provisionUserCli rejects database mismatch when --target-db confirmation differs", async () => {
      await expect(
        provisionUserCli({
          args: {
            email: "cli.hardened@plant.io",
            role: "admin",
            uri: "mongodb://127.0.0.1:27017/manuai_test",
            "allow-local": true,
            "target-db": "manuai_production", // mismatch with 'manuai_test'
            confirm: true,
          },
          envVars: {
            PROVISION_PASSWORD: "SecurePassword123!",
          },
        })
      ).rejects.toThrow(/Target database mismatch: URI specifies database "manuai_test" but --target-db confirmation specified "manuai_production"/);
    });

    it("provisionUserCli requires explicit --confirm flag", async () => {
      await expect(
        provisionUserCli({
          args: {
            email: "cli.hardened@plant.io",
            role: "admin",
            uri: "mongodb://127.0.0.1:27017/manuai_test",
            "allow-local": true,
            "target-db": "manuai_test",
            confirm: false,
          },
          envVars: {
            PROVISION_PASSWORD: "SecurePassword123!",
          },
        })
      ).rejects.toThrow(/Confirmation required\. Pass --confirm/);
    });

    it("provisionUserCli successfully provisions account with all safety checks satisfied", async () => {
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
      expect(outputText).toContain("[Provision] Operator Role:   engineer");
      expect(outputText).toContain("[Provision] Account provisioned successfully!");

      // Verify second attempt on existing account throws and refuses overwrite
      await expect(
        provisionUserCli({
          args: {
            email: "cli.hardened@plant.io",
            role: "admin",
            uri: "mongodb://127.0.0.1:27017/manuai_test",
            "allow-local": true,
            "target-db": "manuai_test",
            confirm: true,
          },
          envVars: {
            PROVISION_PASSWORD: "NewDifferentPassword456!",
          },
          output: outputStream,
        })
      ).rejects.toThrow(/already exists.*Existing accounts and passwords cannot be overwritten/);
    });

    it("provisionUserCli fails closed in non-interactive mode when TARGET_MONGODB_URI contains accidental PowerShell command", async () => {
      await expect(
        provisionUserCli({
          args: {
            email: "cli.hardened@plant.io",
            role: "admin",
            confirm: true,
          },
          envVars: {
            TARGET_MONGODB_URI: "$env:TARGET_MONGODB_URI = (Get-Clipboard -Raw).Trim()",
            PROVISION_PASSWORD: "HardenedPassword123!",
          },
        })
      ).rejects.toThrow(/Remove-Item Env:\\TARGET_MONGODB_URI/);
    });

    it("provisionUserCli fails closed when target database is not 'manuai' for production workflow", async () => {
      await expect(
        provisionUserCli({
          args: {
            email: "cli.hardened@plant.io",
            role: "admin",
            confirm: true,
            "target-db": "wrong_db",
          },
          envVars: {
            TARGET_MONGODB_URI: "mongodb+srv://cluster0.abcde.mongodb.net/wrong_db",
            PROVISION_PASSWORD: "HardenedPassword123!",
          },
        })
      ).rejects.toThrow(/requires database "manuai"/);
    });

    it("provisionUserCli recovers interactively when TARGET_MONGODB_URI is initially invalid in interactive TTY", async () => {
      const mockInput = new EventEmitter() as any;
      mockInput.isTTY = true;
      mockInput.setRawMode = vi.fn();
      mockInput.resume = vi.fn();

      const outputStream = new PassThrough();
      let outputText = "";
      outputStream.on("data", (chunk) => {
        const text = chunk.toString();
        outputText += text;
        if (text.includes("Enter target MongoDB URI (masked): ")) {
          // Send valid local test URI through masked input
          mockInput.emit("data", Buffer.from("mongodb://127.0.0.1:27017/manuai_test\r"));
        }
      });

      const result = await provisionUserCli({
        args: {
          email: "cli.recovered@plant.io",
          name: "Recovered Operator",
          role: "viewer",
          "allow-local": true,
          "target-db": "manuai_test",
          confirm: true,
        },
        envVars: {
          TARGET_MONGODB_URI: "$env:TARGET_MONGODB_URI = Read-Host", // Stale command text in env
          PROVISION_PASSWORD: "RecoveredPassword123!",
        },
        input: mockInput,
        output: outputStream,
      });

      expect(result.id).toBeDefined();
      expect(result.email).toBe("cli.recovered@plant.io");
      expect(outputText).toContain("[Provision Warning] Database URI from environment is invalid");
      expect(outputText).toContain("Remove-Item Env:\\TARGET_MONGODB_URI");
      expect(outputText).toContain("[Provision] Target Host:     127.0.0.1:27017");
      expect(outputText).toContain("[Provision] Target Database: manuai_test");
      expect(outputText).toContain("[Provision] Account provisioned successfully!");
    });
  });

  describe("Canonical Root .env Resolution & Precedence (findCanonicalRootEnvPath & loadCanonicalRootEnv)", () => {
    let testTempDir: string;
    const trackedDirs: string[] = [];

    beforeEach(() => {
      testTempDir = fs.mkdtempSync(path.join(os.tmpdir(), "manuai-env-test-"));
      trackedDirs.push(testTempDir);
    });

    afterEach(() => {
      if (testTempDir && fs.existsSync(testTempDir)) {
        try {
          fs.rmSync(testTempDir, { recursive: true, force: true });
        } catch {
          // Non-fatal cleanup
        }
      }
    });

    afterAll(() => {
      for (const dir of trackedDirs) {
        if (fs.existsSync(dir)) {
          try {
            fs.rmSync(dir, { recursive: true, force: true });
          } catch {
            // Non-fatal cleanup
          }
        }
      }
    });

    it("Scenario A: Only repository-root .env exists — correctly selects root .env", () => {
      // Mock repository root with pnpm-workspace.yaml marker and root .env
      const rootDir = path.join(testTempDir, "repo-root");
      const nestedScriptDir = path.join(rootDir, "apps", "api", "src", "scripts");
      fs.mkdirSync(nestedScriptDir, { recursive: true });

      fs.writeFileSync(path.join(rootDir, "pnpm-workspace.yaml"), "packages:\n  - 'apps/*'\n");
      const rootEnvPath = path.join(rootDir, ".env");
      fs.writeFileSync(rootEnvPath, "MONGODB_URI=mongodb+srv://root-user:secret@cluster0.mongodb.net/manuai\n");

      const selectedPath = findCanonicalRootEnvPath(nestedScriptDir);
      expect(selectedPath).toBe(rootEnvPath);
      expect(fs.existsSync(selectedPath)).toBe(true);
    });

    it("Scenario B: Both repository-root and apps/api/.env exist — enforces canonical root precedence", () => {
      const rootDir = path.join(testTempDir, "repo-precedence");
      const apiDir = path.join(rootDir, "apps", "api");
      const nestedScriptDir = path.join(apiDir, "src", "scripts");
      fs.mkdirSync(nestedScriptDir, { recursive: true });

      // Root marked by .git and root .env
      fs.mkdirSync(path.join(rootDir, ".git"));
      const rootEnvPath = path.join(rootDir, ".env");
      fs.writeFileSync(rootEnvPath, "MONGODB_URI=mongodb+srv://canonical-root@cluster0.mongodb.net/manuai\n");

      // Accidental or local .env inside apps/api/
      const subpackageEnvPath = path.join(apiDir, ".env");
      fs.writeFileSync(subpackageEnvPath, "MONGODB_URI=mongodb://localhost:27017/accidental_db\n");

      // Script executing from apps/api/src/scripts must NOT stop at apps/api/.env
      // It must strictly ascend to the workspace root marker
      const selectedPath = findCanonicalRootEnvPath(nestedScriptDir);
      expect(selectedPath).toBe(rootEnvPath);
      expect(selectedPath).not.toBe(subpackageEnvPath);
    });

    it("Scenario C: No .env exists — returns canonical root path and reports non-existent", () => {
      const rootDir = path.join(testTempDir, "repo-no-env");
      const nestedScriptDir = path.join(rootDir, "apps", "api", "src", "scripts");
      fs.mkdirSync(nestedScriptDir, { recursive: true });

      fs.writeFileSync(path.join(rootDir, "pnpm-workspace.yaml"), "packages:\n  - 'apps/*'\n");

      const selectedPath = findCanonicalRootEnvPath(nestedScriptDir);
      expect(selectedPath).toBe(path.join(rootDir, ".env"));
      // Verified that no .env file exists to load
      expect(fs.existsSync(selectedPath)).toBe(false);
    });

    it("Scenario D: Root has marker but no root .env, while apps/api/.env exists — subfolder .env is NOT selected", () => {
      const rootDir = path.join(testTempDir, "repo-root-no-env");
      const apiDir = path.join(rootDir, "apps", "api");
      const nestedScriptDir = path.join(apiDir, "src", "scripts");
      fs.mkdirSync(nestedScriptDir, { recursive: true });
      fs.writeFileSync(path.join(rootDir, "pnpm-workspace.yaml"), "packages:\n  - 'apps/*'\n");

      const subpackageEnvPath = path.join(apiDir, ".env");
      fs.writeFileSync(subpackageEnvPath, "MONGODB_URI=mongodb://localhost:27017/accidental_subpackage_db\n");

      const selectedPath = findCanonicalRootEnvPath(nestedScriptDir);
      expect(selectedPath).toBe(path.join(rootDir, ".env"));
      expect(selectedPath).not.toBe(subpackageEnvPath);
      expect(fs.existsSync(selectedPath)).toBe(false);

      const result = loadCanonicalRootEnv(nestedScriptDir);
      expect(result.loaded).toBe(false);
      expect(result.path).toBe(path.join(rootDir, ".env"));
    });

    it("Scenario E: Preserves runtime environment variables when root .env is absent and does not load subfolder .env", () => {
      const originalCustomVar = process.env.MANUAI_TEST_RUNTIME_VAR;
      try {
        process.env.MANUAI_TEST_RUNTIME_VAR = "supplied-by-container-runtime";

        const rootDir = path.join(testTempDir, "repo-runtime-preserve");
        const apiDir = path.join(rootDir, "apps", "api");
        const nestedScriptDir = path.join(apiDir, "src", "scripts");
        fs.mkdirSync(nestedScriptDir, { recursive: true });
        fs.writeFileSync(path.join(rootDir, "pnpm-workspace.yaml"), "packages:\n  - 'apps/*'\n");

        // Subpackage .env attempts to define the same variable or another variable
        const subpackageEnvPath = path.join(apiDir, ".env");
        fs.writeFileSync(
          subpackageEnvPath,
          "MANUAI_TEST_RUNTIME_VAR=overwritten-by-subpackage\nMANUAI_SUBFOLDER_LEAK=should_not_exist\n"
        );

        const result = loadCanonicalRootEnv(nestedScriptDir);
        expect(result.loaded).toBe(false);
        // Runtime value is preserved
        expect(process.env.MANUAI_TEST_RUNTIME_VAR).toBe("supplied-by-container-runtime");
        // Subfolder variable was NOT loaded
        expect(process.env.MANUAI_SUBFOLDER_LEAK).toBeUndefined();
      } finally {
        if (originalCustomVar !== undefined) {
          process.env.MANUAI_TEST_RUNTIME_VAR = originalCustomVar;
        } else {
          delete process.env.MANUAI_TEST_RUNTIME_VAR;
        }
        delete process.env.MANUAI_SUBFOLDER_LEAK;
      }
    });

    it("Scenario F: No workspace marker exists — returns null, ignores cwd/local .env, retains runtime env, and fails closed", async () => {
      const originalCwd = process.cwd();
      const originalUri = process.env.MANUAI_TEST_RUNTIME_URI;
      const originalTargetUri = process.env.TARGET_MONGODB_URI;

      try {
        const isolatedDir = path.join(testTempDir, "repo-isolated-no-marker");
        const nestedScriptDir = path.join(isolatedDir, "apps", "api", "src", "scripts");
        fs.mkdirSync(nestedScriptDir, { recursive: true });

        // Place an accidental .env directly in isolatedDir and change process.cwd() to it
        // This strictly proves that even when an arbitrary process.cwd()/.env exists, it is NOT loaded
        const unintendedCwdEnv = path.join(isolatedDir, ".env");
        fs.writeFileSync(
          unintendedCwdEnv,
          "TARGET_MONGODB_URI=mongodb://localhost:27017/accidental_cwd_db\nMANUAI_UNINTENDED_CWD_LEAK=should_not_load\n"
        );

        process.chdir(isolatedDir);
        expect(process.cwd()).toBe(isolatedDir);
        expect(fs.existsSync(path.resolve(process.cwd(), ".env"))).toBe(true);

        delete process.env.MANUAI_UNINTENDED_CWD_LEAK;

        // 1. findCanonicalRootEnvPath returns null when no marker is found anywhere in ancestor tree
        const selectedPath = findCanonicalRootEnvPath(nestedScriptDir);
        expect(selectedPath).toBeNull();

        // 2. loadCanonicalRootEnv returns { loaded: false, path: null } and does NOT load process.cwd()/.env
        const result = loadCanonicalRootEnv(nestedScriptDir);
        expect(result.loaded).toBe(false);
        expect(result.path).toBeNull();
        expect(process.env.MANUAI_UNINTENDED_CWD_LEAK).toBeUndefined();

        // 3. Runtime environment variables are preserved if present
        process.env.MANUAI_TEST_RUNTIME_URI = "mongodb+srv://runtime-supplied:pass@cluster0.mongodb.net/manuai";
        loadCanonicalRootEnv(nestedScriptDir);
        expect(process.env.MANUAI_TEST_RUNTIME_URI).toBe("mongodb+srv://runtime-supplied:pass@cluster0.mongodb.net/manuai");

        // 4. In non-interactive mode without runtime URI, CLI fails closed
        await expect(
          provisionUserCli({
            args: { email: "cli@plant.io", role: "viewer" },
            envVars: {},
          })
        ).rejects.toThrow("Target database URI is required");
      } finally {
        process.chdir(originalCwd);
        if (originalUri !== undefined) {
          process.env.MANUAI_TEST_RUNTIME_URI = originalUri;
        } else {
          delete process.env.MANUAI_TEST_RUNTIME_URI;
        }
        if (originalTargetUri !== undefined) {
          process.env.TARGET_MONGODB_URI = originalTargetUri;
        } else {
          delete process.env.TARGET_MONGODB_URI;
        }
        delete process.env.MANUAI_UNINTENDED_CWD_LEAK;
      }
    });

    it("Scenario G: Script startup call establishes environment before provision.service initializes", async () => {
      const testEnvVarKey = "BOOTSTRAP_STARTUP_VERIFIED_VAR";
      const testEnvVarVal = "established_by_startup_call";
      const originalEnvVal = process.env[testEnvVarKey];
      let fsSpy: any = null;

      try {
        // 1. Reset module cache and install a test-only mock for environment loader dependencies
        vi.resetModules();
        delete process.env[testEnvVarKey];

        let dotenvConfigCallCount = 0;
        let dotenvConfigArgs: any = null;

        // 2. Make mocked dotenv.config() synchronously establish unique test variable when canonical root .env is loaded
        const mockConfig = vi.fn((opts?: any) => {
          dotenvConfigCallCount++;
          dotenvConfigArgs = opts;
          process.env[testEnvVarKey] = testEnvVarVal;
          return { parsed: { [testEnvVarKey]: testEnvVarVal } };
        });

        vi.doMock("dotenv", () => ({
          default: { config: mockConfig },
          config: mockConfig,
        }));

        // 3. Ensure canonical root .env is recognized as present in clean CI checkouts where .env is gitignored
        const canonicalEnvPath = findCanonicalRootEnvPath();
        const originalExistsSync = fs.existsSync.bind(fs);
        fsSpy = vi.spyOn(fs, "existsSync").mockImplementation((targetPath: fs.PathLike) => {
          const resolvedTarget = path.resolve(String(targetPath));
          if (canonicalEnvPath && resolvedTarget === path.resolve(canonicalEnvPath)) {
            return true;
          }
          return originalExistsSync(targetPath);
        });

        // 4. Mock provision.service so its module factory captures that variable at the instant the service initializes
        let serviceInitCount = 0;
        let capturedVarAtServiceInit: string | undefined = undefined;

        vi.doMock("../src/services/provision.service", () => {
          serviceInitCount++;
          capturedVarAtServiceInit = process.env[testEnvVarKey];
          return {
            provisionUser: vi.fn().mockResolvedValue({ id: "mock-user-id", email: "operator@plant.io" }),
          };
        });

        // 5. Import provision-user.ts (its top-level startup call executes immediately)
        // Note: We do NOT manually call loadCanonicalRootEnv() in this test!
        const { getProvisionUser } = await import("../src/scripts/provision-user");

        // The script's startup loadCanonicalRootEnv() MUST have executed dotenv.config()
        expect(dotenvConfigCallCount).toBeGreaterThan(0);
        expect(dotenvConfigArgs).not.toBeNull();
        expect(dotenvConfigArgs?.path).toMatch(/\.env$/);
        expect(process.env[testEnvVarKey]).toBe(testEnvVarVal);

        // However, provision.service must NOT have initialized yet (deferred loading)
        expect(serviceInitCount).toBe(0);
        expect(capturedVarAtServiceInit).toBeUndefined();

        // Now call getProvisionUser(), triggering deferred dynamic import
        const provisionFn = await getProvisionUser();
        expect(typeof provisionFn).toBe("function");

        // 6. Assert that the variable was established before the mocked service initialized
        expect(serviceInitCount).toBe(1);
        expect(capturedVarAtServiceInit).toBe(testEnvVarVal);
      } finally {
        if (fsSpy) {
          fsSpy.mockRestore();
        }

        // 7. Restore original environment variable value if it existed, otherwise delete it
        if (originalEnvVal !== undefined) {
          process.env[testEnvVarKey] = originalEnvVal;
        } else {
          delete process.env[testEnvVarKey];
        }

        // Restore all mocks and module cache even if an assertion failed
        vi.doUnmock("../src/services/provision.service");
        vi.doUnmock("dotenv");
        vi.restoreAllMocks();
        vi.resetModules();
      }
    });

    it("Real Environment: Resolves to the genuine repository-root .env from the current project", () => {
      // 1. Genuine project resolution contract: discovers workspace root without assuming untracked .env exists in git
      const resolved = findCanonicalRootEnvPath();
      expect(resolved).not.toBeNull();
      expect(resolved!.endsWith(".env")).toBe(true);

      // Confirmed it points to the workspace root containing pnpm-workspace.yaml
      const resolvedDir = path.dirname(resolved!);
      expect(fs.existsSync(path.join(resolvedDir, "pnpm-workspace.yaml"))).toBe(true);
      expect(resolved).toBe(path.join(resolvedDir, ".env"));

      // 2. Controlled fixture: verifies path-resolution and file existence contract independently of local untracked files
      const fixtureRootDir = path.join(testTempDir, "controlled-root-env-fixture");
      const fixtureScriptDir = path.join(fixtureRootDir, "apps", "api", "src", "scripts");
      fs.mkdirSync(fixtureScriptDir, { recursive: true });
      fs.writeFileSync(path.join(fixtureRootDir, "pnpm-workspace.yaml"), "packages:\n  - 'apps/*'\n");
      const fixtureEnvPath = path.join(fixtureRootDir, ".env");
      fs.writeFileSync(fixtureEnvPath, "FIXTURE_KEY=fixture_value\n");

      const fixtureResolved = findCanonicalRootEnvPath(fixtureScriptDir);
      expect(fixtureResolved).toBe(fixtureEnvPath);
      expect(fs.existsSync(fixtureResolved!)).toBe(true);
    });
  });
});
