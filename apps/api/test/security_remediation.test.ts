import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { app } from "../src/app";
import { env } from "../src/config/env";
import { User, AuditEvent } from "../src/models";
import {
  connectDatabase,
  isConnectedToMongo,
  setIsConnectedToMongo,
  validateTestDatabaseSafety,
  assertSafeTestDatabase,
} from "../src/config/database";

describe("Security Remediation & Authorization Regression Suite (Task 9)", () => {
  let adminUser: any;
  let adminToken: string;

  beforeAll(async () => {
    await connectDatabase();

    // Ensure clean state for test accounts
    if (isConnectedToMongo) {
      await User.deleteMany({ email: { $in: ["admin.sec9@plant.io", "engineer.sec9@plant.io", "created.sec9@plant.io"] } });
      const passwordHash = await bcrypt.hash("Sec9AdminPass123!", 10);
      adminUser = await User.create({
        name: "Security Admin",
        email: "admin.sec9@plant.io",
        passwordHash,
        role: "admin",
      });
      adminToken = jwt.sign(
        { id: adminUser._id.toString(), email: adminUser.email, name: adminUser.name, role: "admin" },
        env.JWT_SECRET,
        { expiresIn: "1h" }
      );
    }
  });

  afterAll(async () => {
    if (isConnectedToMongo) {
      await User.deleteMany({
        email: { $in: ["admin.sec9@plant.io", "engineer.sec9@plant.io", "created.sec9@plant.io", "temp.del@plant.io"] },
      });
    }
  });

  // ── 1. JWT Authentication & Inactive / Deleted User Invalidation ─────────────
  describe("1. JWT Authentication — Authoritative User & Role Verification", () => {
    it("rejects an otherwise valid JWT with 401 when the user record has been deleted from MongoDB", async () => {
      // 1. Create temporary active user
      const passwordHash = await bcrypt.hash("ActivePass123!", 10);
      const tempUser = await User.create({
        name: "Temporary Engineer",
        email: "temp.del@plant.io",
        passwordHash,
        role: "engineer",
      });

      const tempToken = jwt.sign(
        { id: tempUser._id.toString(), email: tempUser.email, name: tempUser.name, role: "engineer" },
        env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      // 2. While user exists in database, request succeeds
      const beforeDeleteRes = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${tempToken}`);

      expect(beforeDeleteRes.status).toBe(200);
      expect(beforeDeleteRes.body.data.id).toBe(tempUser._id.toString());
      expect(beforeDeleteRes.body.data.email).toBe("temp.del@plant.io");

      // 3. Delete the user from MongoDB
      await User.findByIdAndDelete(tempUser._id);

      // 4. Verify request with same valid token is now immediately rejected with 401
      const afterDeleteRes = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${tempToken}`);

      expect(afterDeleteRes.status).toBe(401);
      expect(afterDeleteRes.body.success).toBe(false);
      expect(afterDeleteRes.body.error.code).toBe("USER_NOT_FOUND");
      expect(afterDeleteRes.body.error.message).toContain("no longer exists");
    });

    it("enforces authoritative database role over tampered token role claim", async () => {
      // Create user with engineer role in database
      const passwordHash = await bcrypt.hash("EngPass123!", 10);
      const engUser = await User.create({
        name: "Honest Engineer",
        email: "engineer.sec9@plant.io",
        passwordHash,
        role: "engineer",
      });

      // User possesses a signed JWT claiming 'admin' role
      const tamperedRoleToken = jwt.sign(
        { id: engUser._id.toString(), email: engUser.email, name: engUser.name, role: "admin" },
        env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      // When accessing /auth/me, req.user role reflects authoritative DB role ('engineer')
      const meRes = await request(app)
        .get("/api/v1/auth/me")
        .set("Authorization", `Bearer ${tamperedRoleToken}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.data.role).toBe("engineer");

      // When attempting an admin-only endpoint (GET /users), access is denied with 403
      const adminRes = await request(app)
        .get("/api/v1/users")
        .set("Authorization", `Bearer ${tamperedRoleToken}`);

      expect(adminRes.status).toBe(403);
      expect(adminRes.body.error.code).toBe("FORBIDDEN");

      await User.findByIdAndDelete(engUser._id);
    });

    it("fails closed with 503 when a database query error occurs and does not silently authenticate", async () => {
      const validOid = new mongoose.Types.ObjectId().toString();
      const testToken = jwt.sign(
        { id: validOid, email: "queryerr@plant.io", role: "engineer" },
        env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      // Simulate database driver failure
      const findSpy = vi.spyOn(User, "findById").mockImplementationOnce(() => {
        throw new Error("Simulated database timeout or connection pool exhaustion");
      });

      try {
        const res = await request(app)
          .get("/api/v1/auth/me")
          .set("Authorization", `Bearer ${testToken}`);

        expect(res.status).toBe(503);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe("SERVICE_UNAVAILABLE");
      } finally {
        findSpy.mockRestore();
      }
    });

    it("rejects with 503 in production mode when database is disconnected even if ALLOW_OFFLINE_AUTH is true", async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalConnected = isConnectedToMongo;
      const originalOfflineFlag = process.env.ALLOW_OFFLINE_AUTH;

      try {
        process.env.NODE_ENV = "production";
        setIsConnectedToMongo(false);
        process.env.ALLOW_OFFLINE_AUTH = "true";

        const token = jwt.sign(
          { id: "test-prod-offline-id", email: "prod.offline@plant.io", role: "admin" },
          env.JWT_SECRET,
          { expiresIn: "1h" }
        );

        const res = await request(app)
          .get("/api/v1/auth/me")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(503);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe("SERVICE_UNAVAILABLE");
        expect(res.body.error.message).toContain("disconnected");
      } finally {
        process.env.NODE_ENV = originalEnv;
        setIsConnectedToMongo(originalConnected);
        process.env.ALLOW_OFFLINE_AUTH = originalOfflineFlag;
      }
    });

    it("rejects with 503 in production mode when database is disconnected and ALLOW_OFFLINE_AUTH is unset", async () => {
      const originalEnv = process.env.NODE_ENV;
      const originalConnected = isConnectedToMongo;
      const originalOfflineFlag = process.env.ALLOW_OFFLINE_AUTH;

      try {
        process.env.NODE_ENV = "production";
        setIsConnectedToMongo(false);
        delete process.env.ALLOW_OFFLINE_AUTH;

        const token = jwt.sign(
          { id: "test-prod-offline-id-2", email: "prod.offline2@plant.io", role: "engineer" },
          env.JWT_SECRET,
          { expiresIn: "1h" }
        );

        const res = await request(app)
          .get("/api/v1/auth/me")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(503);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe("SERVICE_UNAVAILABLE");
      } finally {
        process.env.NODE_ENV = originalEnv;
        setIsConnectedToMongo(originalConnected);
        process.env.ALLOW_OFFLINE_AUTH = originalOfflineFlag;
      }
    });

    it("rejects with 503 when database is disconnected and offline auth is explicitly disabled in non-production", async () => {
      const originalConnected = isConnectedToMongo;
      const originalOfflineFlag = process.env.ALLOW_OFFLINE_AUTH;

      try {
        setIsConnectedToMongo(false);
        process.env.ALLOW_OFFLINE_AUTH = "false";

        const token = jwt.sign(
          { id: "test-user-offline", email: "off@plant.io", role: "engineer" },
          env.JWT_SECRET,
          { expiresIn: "1h" }
        );

        const res = await request(app)
          .get("/api/v1/auth/me")
          .set("Authorization", `Bearer ${token}`);

        expect(res.status).toBe(503);
        expect(res.body.error.code).toBe("SERVICE_UNAVAILABLE");
      } finally {
        setIsConnectedToMongo(originalConnected);
        process.env.ALLOW_OFFLINE_AUTH = originalOfflineFlag;
      }
    });

    it("defaults missing or invalid role claims to least-privileged 'viewer' in offline fallback path", async () => {
      const originalConnected = isConnectedToMongo;
      const originalOfflineFlag = process.env.ALLOW_OFFLINE_AUTH;

      try {
        setIsConnectedToMongo(false);
        process.env.ALLOW_OFFLINE_AUTH = "true";

        // Token with invalid role claim
        const invalidRoleToken = jwt.sign(
          { id: "off-user-1", email: "off1@plant.io", role: "superadmin_fake" },
          env.JWT_SECRET,
          { expiresIn: "1h" }
        );

        const res1 = await request(app)
          .get("/api/v1/auth/me")
          .set("Authorization", `Bearer ${invalidRoleToken}`);

        expect(res1.status).toBe(200);
        expect(res1.body.data.role).toBe("viewer");

        // Token with missing role claim
        const missingRoleToken = jwt.sign(
          { id: "off-user-2", email: "off2@plant.io" },
          env.JWT_SECRET,
          { expiresIn: "1h" }
        );

        const res2 = await request(app)
          .get("/api/v1/auth/me")
          .set("Authorization", `Bearer ${missingRoleToken}`);

        expect(res2.status).toBe(200);
        expect(res2.body.data.role).toBe("viewer");
      } finally {
        setIsConnectedToMongo(originalConnected);
        process.env.ALLOW_OFFLINE_AUTH = originalOfflineFlag;
      }
    });
  });

  // ── 2. User Creation — Password Enforcement & Hardcoded Fallback Removal ─────
  describe("2. User Creation — Hardcoded Fallback Removal & Password Policy", () => {
    it("rejects user creation with 400 when password is missing or empty", async () => {
      // Missing password property
      const resMissing = await request(app)
        .post("/api/v1/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "No Password User",
          email: "nopass@plant.io",
          role: "engineer",
        });

      expect(resMissing.status).toBe(400);
      expect(resMissing.body.success).toBe(false);
      expect(resMissing.body.error.code).toBe("VALIDATION_ERROR");
      expect(JSON.stringify(resMissing.body.error)).not.toContain("Industry2025!");

      // Empty string password
      const resEmpty = await request(app)
        .post("/api/v1/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Empty Password User",
          email: "emptypass@plant.io",
          password: "",
          role: "engineer",
        });

      expect(resEmpty.status).toBe(400);
      expect(resEmpty.body.success).toBe(false);
      expect(resEmpty.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects user creation with 400 when password violates length requirements (< 8 chars)", async () => {
      const resShort = await request(app)
        .post("/api/v1/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Short Pass User",
          email: "shortpass@plant.io",
          password: "short",
          role: "viewer",
        });

      expect(resShort.status).toBe(400);
      expect(resShort.body.success).toBe(false);
      expect(resShort.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("successfully creates a user with an explicit valid password and verifies login authentication", async () => {
      const explicitPassword = "PlantEngineer2026!Secure";
      const userPayload = {
        name: "Verified Operator",
        email: "created.sec9@plant.io",
        password: explicitPassword,
        role: "engineer",
      };

      // 1. Admin creates user with explicit password
      const createRes = await request(app)
        .post("/api/v1/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(userPayload);

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      expect(createRes.body.data.email).toBe("created.sec9@plant.io");
      expect(createRes.body.data.role).toBe("engineer");

      // 2. Verify login succeeds with the explicit password
      const loginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "created.sec9@plant.io",
          password: explicitPassword,
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);
      expect(loginRes.body.data.token).toBeDefined();

      // 3. Verify login FAILS when attempting the old hardcoded fallback password
      const fallbackLoginRes = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "created.sec9@plant.io",
          password: "Industry2025!",
        });

      expect(fallbackLoginRes.status).toBe(401);
      expect(fallbackLoginRes.body.error.code).toBe("INVALID_CREDENTIALS");
    });
  });

  describe("Test Database Isolation & Safety Policy", () => {
    it("accepts safe local loopback test database URIs (localhost, 127.0.0.1, IPv6 loopback [::1])", () => {
      const validUris = [
        "mongodb://localhost:27017/manuai_test",
        "mongodb://127.0.0.1:27017/manuai_test",
        "mongodb://[::1]:27017/manuai_test",
        "mongodb://localhost:27017/manuai_test?replicaSet=rs0",
        "mongodb://127.0.0.1:27017,127.0.0.1:27018/manuai_test",
        "mongodb://user:pass@127.0.0.1:27017/manuai_test",
        "mongodb://user%40corp:p%40ss@localhost:27017/manuai_test?authSource=admin",
      ];

      for (const uri of validUris) {
        const res = validateTestDatabaseSafety(uri);
        expect(res.safe).toBe(true);
        expect(() => assertSafeTestDatabase(uri)).not.toThrow();
      }
    });

    it("rejects 0.0.0.0 and host.docker.internal by default as non-loopback destinations", () => {
      const unsafeUris = [
        "mongodb://0.0.0.0:27017/manuai_test",
        "mongodb://host.docker.internal:27017/manuai_test",
      ];

      for (const uri of unsafeUris) {
        const res = validateTestDatabaseSafety(uri);
        expect(res.safe).toBe(false);
        expect(res.reason).toMatch(/remote MongoDB host/i);
        expect(() => assertSafeTestDatabase(uri)).toThrow(/remote MongoDB host/i);
      }
    });

    it("permits host.docker.internal only when explicitly opted in via TEST_MONGODB_ALLOWED_HOSTS or allowRemote", () => {
      const dockerUri = "mongodb://host.docker.internal:27017/manuai_test";

      // 1. Rejected by default
      expect(validateTestDatabaseSafety(dockerUri).safe).toBe(false);

      // 2. Allowed via options.allowRemote
      expect(validateTestDatabaseSafety(dockerUri, { allowRemote: true }).safe).toBe(true);

      // 3. Allowed via TEST_MONGODB_ALLOWED_HOSTS
      const origAllowed = process.env.TEST_MONGODB_ALLOWED_HOSTS;
      try {
        process.env.TEST_MONGODB_ALLOWED_HOSTS = "host.docker.internal";
        expect(validateTestDatabaseSafety(dockerUri).safe).toBe(true);
        expect(() => assertSafeTestDatabase(dockerUri)).not.toThrow();
      } finally {
        if (origAllowed !== undefined) {
          process.env.TEST_MONGODB_ALLOWED_HOSTS = origAllowed;
        } else {
          delete process.env.TEST_MONGODB_ALLOWED_HOSTS;
        }
      }
    });

    it("rejects live Atlas database URIs under all circumstances in test mode", () => {
      const atlasUris = [
        "mongodb+srv://admin:secret@cluster0.abcde.mongodb.net/manuai_test?retryWrites=true&w=majority",
        "mongodb://admin:secret@cluster0.abcde.mongodb.net:27017/manuai_test",
        "mongodb+srv://test.mongodb.net/manuai_test",
        "mongodb://localhost:27017,cluster0.abcde.mongodb.net:27017/manuai_test",
      ];

      for (const uri of atlasUris) {
        const res = validateTestDatabaseSafety(uri);
        expect(res.safe).toBe(false);
        expect(res.reason).toMatch(/Atlas/i);
        expect(() => assertSafeTestDatabase(uri)).toThrow(/Atlas database/i);
      }

      // Even if remote test db opt-in is enabled, Atlas MUST remain rejected
      const resWithOptIn = validateTestDatabaseSafety(
        "mongodb+srv://cluster0.abcde.mongodb.net/manuai_test",
        { allowRemote: true }
      );
      expect(resWithOptIn.safe).toBe(false);
      expect(resWithOptIn.reason).toMatch(/Atlas/i);
    });

    it("rejects remote non-Atlas MongoDB URIs by default in test mode", () => {
      const remoteUris = [
        "mongodb://192.168.1.100:27017/manuai_test",
        "mongodb://db.external-plant.io:27017/manuai_test",
        "mongodb://prod-db.internal:27017/manuai_test",
        "mongodb://10.0.1.5:27017,10.0.1.6:27017/manuai_test",
        "mongodb://localhost:27017,192.168.1.50:27017/manuai_test",
      ];

      for (const uri of remoteUris) {
        const res = validateTestDatabaseSafety(uri);
        expect(res.safe).toBe(false);
        expect(res.reason).toMatch(/remote MongoDB host/i);
        expect(() => assertSafeTestDatabase(uri)).toThrow(/remote MongoDB host/i);
      }
    });

    it("allows remote non-Atlas test database only with explicit opt-in", () => {
      const remoteUri = "mongodb://remote-test-db.internal:27017/manuai_test";

      // 1. Without opt-in -> rejected
      expect(validateTestDatabaseSafety(remoteUri).safe).toBe(false);

      // 2. With options.allowRemote = true -> accepted
      expect(validateTestDatabaseSafety(remoteUri, { allowRemote: true }).safe).toBe(true);

      // 3. With ALLOW_REMOTE_TEST_DB=true environment variable
      const origOptIn = process.env.ALLOW_REMOTE_TEST_DB;
      try {
        process.env.ALLOW_REMOTE_TEST_DB = "true";
        expect(validateTestDatabaseSafety(remoteUri).safe).toBe(true);
        expect(() => assertSafeTestDatabase(remoteUri)).not.toThrow();
      } finally {
        if (origOptIn !== undefined) {
          process.env.ALLOW_REMOTE_TEST_DB = origOptIn;
        } else {
          delete process.env.ALLOW_REMOTE_TEST_DB;
        }
      }

      // 4. With TEST_MONGODB_ALLOWED_HOSTS environment variable
      const origAllowedHosts = process.env.TEST_MONGODB_ALLOWED_HOSTS;
      try {
        process.env.TEST_MONGODB_ALLOWED_HOSTS = "remote-test-db.internal,other-host";
        expect(validateTestDatabaseSafety(remoteUri).safe).toBe(true);
      } finally {
        if (origAllowedHosts !== undefined) {
          process.env.TEST_MONGODB_ALLOWED_HOSTS = origAllowedHosts;
        } else {
          delete process.env.TEST_MONGODB_ALLOWED_HOSTS;
        }
      }
    });

    it("rejects test URIs targeting production or prohibited databases even when host is local", () => {
      const prohibitedUris = [
        "mongodb://localhost:27017/manuai", // canonical production db
        "mongodb://localhost:27017/production",
        "mongodb://127.0.0.1:27017/manuai_prod",
        "mongodb://127.0.0.1:27017/admin",
        "mongodb://localhost:27017/", // missing database name
        "mongodb://localhost:27017", // missing database path
        "mongodb://localhost:27017?authSource=admin", // query only, no database
        "mongodb://localhost:27017/prod_facility", // prod_ prefix
        "mongodb://localhost:27017/facility_production", // _production suffix
      ];

      for (const uri of prohibitedUris) {
        const res = validateTestDatabaseSafety(uri);
        expect(res.safe).toBe(false);
        expect(() => assertSafeTestDatabase(uri)).toThrow(/prohibited|specify an explicit target database/i);
      }
    });

    it("enforces test database safety policy even when env.NODE_ENV or process.env.NODE_ENV has a conflicting configuration value", async () => {
      const prevEnvNodeEnv = env.NODE_ENV;
      const prevProcessNodeEnv = process.env.NODE_ENV;

      try {
        // Mismatch scenario: process.env.NODE_ENV is "test", but env.NODE_ENV is set to "production"
        process.env.NODE_ENV = "test";
        (env as any).NODE_ENV = "production";

        // Must still reject Atlas live cluster
        const atlasUri = "mongodb+srv://cluster0.abcde.mongodb.net/manuai_test";
        expect(validateTestDatabaseSafety(atlasUri).safe).toBe(false);
        expect(() => assertSafeTestDatabase(atlasUri)).toThrow(/Atlas database/i);

        // Must still reject remote non-Atlas host without opt-in
        const remoteUri = "mongodb://remote-db.plant.internal:27017/manuai_test";
        expect(validateTestDatabaseSafety(remoteUri).safe).toBe(false);
        expect(() => assertSafeTestDatabase(remoteUri)).toThrow(/remote MongoDB host/i);

        // In connectDatabase, calling with an unsafe URI when process.env.NODE_ENV === 'test'
        // must fail closed with Database Safety Violation, NOT bypass the guard
        await expect(connectDatabase("mongodb://remote-db.plant.internal:27017/manuai_test")).rejects.toThrow(
          /\[Database Safety Violation\]/
        );
      } finally {
        (env as any).NODE_ENV = prevEnvNodeEnv;
        process.env.NODE_ENV = prevProcessNodeEnv;
      }
    });

    it("resists URI parser bypass attempts (mixed-case schemes, unbracketed IPv6, special characters in credentials)", () => {
      // 1. Mixed case scheme should normalize and accept safe local host
      const mixedCaseUri = "MongoDB://localhost:27017/manuai_test";
      expect(validateTestDatabaseSafety(mixedCaseUri).safe).toBe(true);

      // 2. Malformed scheme should be rejected
      const httpUri = "http://localhost:27017/manuai_test";
      expect(validateTestDatabaseSafety(httpUri).safe).toBe(false);

      // 3. Unbracketed IPv6 loopback (::1) should be recognized as loopback
      const ipv6Unbracketed = "mongodb://::1:27017/manuai_test";
      expect(validateTestDatabaseSafety(ipv6Unbracketed).safe).toBe(true);

      // 4. Multiple @ symbols in password should not confuse host extraction
      const complexAuthUri = "mongodb://app_user:p%40ss%40word@127.0.0.1:27017/manuai_test";
      const res = validateTestDatabaseSafety(complexAuthUri);
      expect(res.safe).toBe(true);
      expect(res.components.hosts).toEqual(["127.0.0.1"]);
      expect(res.components.database).toBe("manuai_test");
    });
  });
});
