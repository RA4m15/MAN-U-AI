import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { app } from "../src/app";
import { User } from "../src/models";
import { connectDatabase } from "../src/config/database";

describe("Stage 5.5 — User Registration & Privilege Escalation Defense", () => {
  beforeAll(async () => {
    await connectDatabase();
  });

  afterAll(async () => {
    // Clean up test-created registration accounts
    await User.deleteMany({ email: /test-reg-.*@plant\.io/ });
  });

  it("1. Successfully creates a new user account and returns valid session token and safe profile", async () => {
    const testEmail = `test-reg-success-${Date.now()}@plant.io`;
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Test Operator",
        email: testEmail,
        password: "ValidPassword123!",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(typeof res.body.data.token).toBe("string");
    expect(res.body.data.user).toBeDefined();
    expect(res.body.data.user.name).toBe("Test Operator");
    expect(res.body.data.user.email).toBe(testEmail.toLowerCase());
    expect(res.body.data.user.role).toBe("viewer");
    expect(res.body.data.user.passwordHash).toBeUndefined();
    expect(res.body.data.user.password).toBeUndefined();

    // Verify database record has hashed password and never plaintext
    const dbUser = await User.findOne({ email: testEmail.toLowerCase() });
    expect(dbUser).not.toBeNull();
    expect(dbUser!.passwordHash).toBeDefined();
    expect(dbUser!.passwordHash).not.toBe("ValidPassword123!");
    expect(dbUser!.passwordHash.startsWith("$2")).toBe(true);

    const isMatch = await bcrypt.compare("ValidPassword123!", dbUser!.passwordHash);
    expect(isMatch).toBe(true);
  });

  it("2. Rejects duplicate registration with 409 USER_EXISTS (case-insensitive)", async () => {
    const testEmail = `test-reg-dup-${Date.now()}@plant.io`;
    // Initial registration
    const firstRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "First User",
        email: testEmail.toLowerCase(),
        password: "ValidPassword123!",
      });
    expect(firstRes.status).toBe(201);

    // Duplicate registration attempt with mixed casing
    const dupRes = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Second User",
        email: testEmail.toUpperCase(),
        password: "DifferentPassword123!",
      });

    expect(dupRes.status).toBe(409);
    expect(dupRes.body.success).toBe(false);
    expect(dupRes.body.error.code).toBe("USER_EXISTS");
  });

  it("3. Rejects invalid registration inputs with 400 VALIDATION_ERROR", async () => {
    // Missing required fields
    const resEmpty = await request(app)
      .post("/api/v1/auth/register")
      .send({});
    expect(resEmpty.status).toBe(400);
    expect(resEmpty.body.error.code).toBe("VALIDATION_ERROR");

    // Invalid email format
    const resBadEmail = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Bad Email",
        email: "not-an-email",
        password: "ValidPassword123!",
      });
    expect(resBadEmail.status).toBe(400);
    expect(resBadEmail.body.error.code).toBe("VALIDATION_ERROR");

    // Password too short (< 8 chars)
    const resShortPass = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Short Pass",
        email: `test-reg-short-${Date.now()}@plant.io`,
        password: "123",
      });
    expect(resShortPass.status).toBe(400);
    expect(resShortPass.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("4. Prevents privilege escalation: rejects attempts to register as administrator with 403 ROLE_UNAUTHORIZED", async () => {
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Escalation Attacker",
        email: `test-reg-admin-${Date.now()}@plant.io`,
        password: "AttackerPassword123!",
        role: "admin",
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("ROLE_UNAUTHORIZED");
    expect(res.body.error.message).toContain("Administrator accounts cannot be self-registered");
  });

  it("5. Assigns fixed least-privileged viewer role regardless of non-admin role in request", async () => {
    const testEmail = `test-reg-roleoverride-${Date.now()}@plant.io`;
    const res = await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Engineer Want-to-be",
        email: testEmail,
        password: "ValidPassword123!",
        role: "engineer",
      });

    expect(res.status).toBe(201);
    // Public self-registration assigns the least-privileged viewer role
    expect(res.body.data.user.role).toBe("viewer");

    const dbUser = await User.findOne({ email: testEmail });
    expect(dbUser!.role).toBe("viewer");
  });

  it("6. Allows the newly registered user to authenticate via /api/v1/auth/login", async () => {
    const testEmail = `test-reg-login-${Date.now()}@plant.io`;
    await request(app)
      .post("/api/v1/auth/register")
      .send({
        name: "Loggable User",
        email: testEmail,
        password: "LoginPassword123!",
      });

    // Login with exact email
    const loginRes = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: testEmail,
        password: "LoginPassword123!",
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.token).toBeDefined();
    expect(loginRes.body.data.user.role).toBe("viewer");
  });

  it("7. In production mode with ENABLE_PUBLIC_REGISTRATION disabled, blocks registration with 403 REGISTRATION_RESTRICTED", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalReg = process.env.ENABLE_PUBLIC_REGISTRATION;
    try {
      process.env.NODE_ENV = "production";
      process.env.ENABLE_PUBLIC_REGISTRATION = "false";

      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Prod User",
          email: `prod-restricted-${Date.now()}@plant.io`,
          password: "SecurePassword123!",
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("REGISTRATION_RESTRICTED");
      expect(res.body.error.message).toContain("Public self-registration is disabled in production");
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      process.env.ENABLE_PUBLIC_REGISTRATION = originalReg;
    }
  });

  it("8. In production mode with ENABLE_PUBLIC_REGISTRATION enabled, permits registration and assigns viewer role", async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const originalReg = process.env.ENABLE_PUBLIC_REGISTRATION;
    try {
      process.env.NODE_ENV = "production";
      process.env.ENABLE_PUBLIC_REGISTRATION = "true";

      const testEmail = `prod-allowed-${Date.now()}@plant.io`;
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({
          name: "Prod Allowed User",
          email: testEmail,
          password: "SecurePassword123!",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe("viewer");
      expect(res.body.data.token).toBeDefined();
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      process.env.ENABLE_PUBLIC_REGISTRATION = originalReg;
    }
  });
});
