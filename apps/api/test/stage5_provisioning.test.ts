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
  cleanMongoUri,
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
});
