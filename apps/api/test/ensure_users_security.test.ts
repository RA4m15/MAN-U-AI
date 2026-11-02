import { describe, it, expect, beforeEach, afterEach } from "vitest";
import bcrypt from "bcryptjs";
import { ensureUsers, isLocalDatabaseUri } from "../src/scripts/ensure-users";
import { User } from "../src/models";
import {
  isConnectedToMongo,
  connectDatabase,
  assertSafeTestDatabase,
} from "../src/config/database";

describe("Ensure-Users Script Production Security & Safeguards", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalMongoUri = process.env.MONGODB_URI;
  const originalAllowRemote = process.env.ALLOW_REMOTE_DEV_SEED;
  const originalSeedPassword = process.env.INITIAL_SEED_PASSWORD;

  // Use isolated test database URI supplied by CI, or fallback to local test database
  const testDatabaseUri =
    process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/manuai_test";

  // Validate that the test database URI strictly satisfies test database safety policies
  assertSafeTestDatabase(testDatabaseUri);

  const testEmails = [
    "admin@plant.io",
    "alex.mercer@plant.io",
    "operator@plant.io",
    "admin@gmail.com",
    "manager@gmail.com",
  ];

  beforeEach(async () => {
    // Explicitly configure test fixture to use isolated, safe local test database and dev seed password
    process.env.MONGODB_URI = testDatabaseUri;
    process.env.INITIAL_SEED_PASSWORD = "TestDevSeedPassword123!";

    if (!isConnectedToMongo) {
      await connectDatabase(testDatabaseUri);
    }
    await User.deleteMany({ email: { $in: testEmails } });
  });

  afterEach(async () => {
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }

    if (originalMongoUri !== undefined) {
      process.env.MONGODB_URI = originalMongoUri;
    } else {
      delete process.env.MONGODB_URI;
    }

    if (originalAllowRemote !== undefined) {
      process.env.ALLOW_REMOTE_DEV_SEED = originalAllowRemote;
    } else {
      delete process.env.ALLOW_REMOTE_DEV_SEED;
    }

    if (originalSeedPassword !== undefined) {
      process.env.INITIAL_SEED_PASSWORD = originalSeedPassword;
    } else {
      delete process.env.INITIAL_SEED_PASSWORD;
    }

    if (isConnectedToMongo) {
      await User.deleteMany({ email: { $in: testEmails } });
    }
  });

  describe("isLocalDatabaseUri", () => {
    it("identifies localhost and loopback IPv4/IPv6 connections as local", () => {
      // Localhost
      expect(isLocalDatabaseUri("mongodb://localhost:27017/manuai")).toBe(true);
      // IPv4 loopback
      expect(isLocalDatabaseUri("mongodb://127.0.0.1:27017/manuai")).toBe(true);
      expect(isLocalDatabaseUri("mongodb://127.0.0.2:27017/manuai")).toBe(true);
      // IPv6 loopback
      expect(isLocalDatabaseUri("mongodb://[::1]:27017/manuai")).toBe(true);
      // Comma-separated replica set with all loopback hosts
      expect(
        isLocalDatabaseUri("mongodb://127.0.0.1:27017,localhost:27018,127.0.0.2:27019/manuai")
      ).toBe(true);
    });

    it("rejects remote database even when password contains 'localhost'", () => {
      expect(
        isLocalDatabaseUri("mongodb://admin:localhost@db.production.com:27017/manuai")
      ).toBe(false);
      expect(
        isLocalDatabaseUri("mongodb://admin:pass_localhost_99@remote.internal:27017/manuai")
      ).toBe(false);
    });

    it("rejects remote database even when username contains 'localhost'", () => {
      expect(
        isLocalDatabaseUri("mongodb://localhost:secret@10.0.0.5:27017/manuai")
      ).toBe(false);
      expect(
        isLocalDatabaseUri("mongodb://localhost_user:secret@remote.internal:27017/manuai")
      ).toBe(false);
    });

    it("rejects MongoDB Atlas clusters (both SRV and standard protocol)", () => {
      expect(
        isLocalDatabaseUri("mongodb+srv://admin:secret@manuai-cluster.mongodb.net/production")
      ).toBe(false);
      expect(
        isLocalDatabaseUri("mongodb://admin:secret@manuai-cluster.mongodb.net:27017/production")
      ).toBe(false);
    });

    it("rejects remote IP addresses and domain hosts", () => {
      expect(isLocalDatabaseUri("mongodb://10.0.0.5:27017/production")).toBe(false);
      expect(isLocalDatabaseUri("mongodb://192.168.1.100:27017/production")).toBe(false);
      expect(isLocalDatabaseUri("mongodb://db.plant.corp:27017/production")).toBe(false);
    });

    it("rejects multiple-host replica URI containing one or more remote hosts", () => {
      expect(
        isLocalDatabaseUri("mongodb://127.0.0.1:27017,10.0.0.5:27017/manuai")
      ).toBe(false);
      expect(
        isLocalDatabaseUri("mongodb://localhost:27017,remote.server.com:27017/manuai")
      ).toBe(false);
    });

    it("rejects malformed, empty, or non-mongodb URIs", () => {
      expect(isLocalDatabaseUri("not-a-mongo-uri")).toBe(false);
      expect(isLocalDatabaseUri("http://localhost:27017/manuai")).toBe(false);
      expect(isLocalDatabaseUri("")).toBe(false);
      expect(isLocalDatabaseUri(null as any)).toBe(false);
      expect(isLocalDatabaseUri(undefined as any)).toBe(false);
    });

    it("never treats IPv6 unspecified address :: or IPv4 0.0.0.0 as loopback", () => {
      expect(isLocalDatabaseUri("mongodb://[::]:27017/manuai")).toBe(false);
      expect(isLocalDatabaseUri("mongodb://0.0.0.0:27017/manuai")).toBe(false);
    });
  });

  describe("Production Execution Guard", () => {
    it("strictly blocks execution when NODE_ENV is production", async () => {
      process.env.NODE_ENV = "production";

      await expect(ensureUsers()).rejects.toThrowError(
        /\[Security Policy Violation\] ensure-users cannot be executed in production/i
      );
    });
  });

  describe("Remote Target Accidental Execution Guard", () => {
    it("blocks execution against remote cloud cluster targets without explicit override", async () => {
      process.env.NODE_ENV = "development";
      process.env.MONGODB_URI = "mongodb+srv://admin:pass@production-cluster.mongodb.net/manuai";
      delete process.env.ALLOW_REMOTE_DEV_SEED;

      await expect(ensureUsers()).rejects.toThrowError(
        /\[Security Policy Violation\] Execution blocked against remote database target/i
      );
    });
  });

  describe("Initial Seed Password Requirement", () => {
    it("fails with clear error when INITIAL_SEED_PASSWORD is missing and creates no users", async () => {
      process.env.NODE_ENV = "development";
      delete process.env.INITIAL_SEED_PASSWORD;

      await expect(ensureUsers()).rejects.toThrowError(
        /\[Security Policy Violation\] INITIAL_SEED_PASSWORD environment variable is required/i
      );

      const users = await User.find({ email: { $in: testEmails } });
      expect(users).toHaveLength(0);
    });

    it("fails with clear error when INITIAL_SEED_PASSWORD is empty or whitespace and creates no users", async () => {
      process.env.NODE_ENV = "development";
      process.env.INITIAL_SEED_PASSWORD = "   ";

      await expect(ensureUsers()).rejects.toThrowError(
        /\[Security Policy Violation\] INITIAL_SEED_PASSWORD environment variable is required/i
      );

      const users = await User.find({ email: { $in: testEmails } });
      expect(users).toHaveLength(0);
    });
  });

  describe("Account Preservation & Absence of Fixed Privileged Accounts", () => {
    it("does not create or define unsafe hardcoded accounts (admin@gmail.com, manager@gmail.com)", async () => {
      process.env.NODE_ENV = "development";
      process.env.INITIAL_SEED_PASSWORD = "TestDevSeedPassword123!";

      const result = await ensureUsers();
      expect(result.created).not.toContain("admin@gmail.com");
      expect(result.created).not.toContain("manager@gmail.com");
      expect(result.preserved).not.toContain("admin@gmail.com");
      expect(result.preserved).not.toContain("manager@gmail.com");

      // Verify they do not exist in the database from ensureUsers
      const adminGmail = await User.findOne({ email: "admin@gmail.com" });
      const managerGmail = await User.findOne({ email: "manager@gmail.com" });
      expect(adminGmail).toBeNull();
      expect(managerGmail).toBeNull();
    });

    it("never silently overwrites an existing user's password or promotes their role", async () => {
      process.env.NODE_ENV = "development";
      process.env.INITIAL_SEED_PASSWORD = "TestDevSeedPassword123!";

      const testEmail = "admin@plant.io";
      const customPassword = "CustomOperatorPassword-999!";
      const customHash = await bcrypt.hash(customPassword, 10);

      // Create an existing user with specific password and viewer role
      await User.create({
        name: "Existing Person",
        email: testEmail,
        passwordHash: customHash,
        role: "operator",
        orgId: "plant-alpha",
        isActive: true,
      });

      // Run ensureUsers
      const result = await ensureUsers();
      expect(result.preserved).toContain(testEmail);

      // Verify the password and role were NOT changed or reset
      const userAfter = await User.findOne({ email: testEmail });
      expect(userAfter).not.toBeNull();
      const isPasswordPreserved = await bcrypt.compare(customPassword, userAfter!.passwordHash);
      expect(isPasswordPreserved).toBe(true);
      expect(userAfter!.role).toBe("operator"); // Not promoted to admin!
    });
  });
});
