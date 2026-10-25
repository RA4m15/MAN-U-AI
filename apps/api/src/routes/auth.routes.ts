import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { RegisterSchema, LoginSchema, UserRole } from "@man-u-ai/shared";
import { User } from "../models";
import { env } from "../config/env";
import { isConnectedToMongo } from "../config/database";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth";
import { authLimiter } from "../middlewares/rateLimiters";

export const authRouter: Router = Router();

authRouter.post("/register", authLimiter, async (req: Request, res: Response) => {
  const isProduction = process.env.NODE_ENV === "production" || env.NODE_ENV === "production";

  const isPublicRegistrationEnabled =
    process.env.ENABLE_PUBLIC_REGISTRATION === "true" ||
    env.ENABLE_PUBLIC_REGISTRATION === "true";

  // In production, public registration is restricted unless explicitly enabled
  if (isProduction && !isPublicRegistrationEnabled) {
    return res.status(403).json({
      success: false,
      error: {
        code: "REGISTRATION_RESTRICTED",
        message: "Public self-registration is disabled in production. Accounts must be provisioned by an administrator.",
      },
    });
  }

  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid registration payload", details: parsed.error.issues },
    });
  }

  const { name, email, password, role } = parsed.data;

  // Unauthenticated registration requests must NEVER be permitted to grant administrator role
  if (role === "admin") {
    return res.status(403).json({
      success: false,
      error: {
        code: "ROLE_UNAUTHORIZED",
        message: "Administrator accounts cannot be self-registered. Administrator privileges require authorized internal provisioning.",
      },
    });
  }

  if (!isConnectedToMongo) {
    return res.status(503).json({
      success: false,
      error: { code: "SERVICE_UNAVAILABLE", message: "Database connection unavailable for registration" },
    });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({
      $or: [{ email: normalizedEmail }, { email: email.trim() }],
    }).maxTimeMS(8000).exec();
    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: "USER_EXISTS", message: "A user with this email address is already registered" },
      });
    }

    // Assign fixed server-controlled least-privileged non-admin role permitted for user-facing chat
    const assignedRole: UserRole = "viewer";
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: assignedRole,
    });

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, name: user.name, role: user.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any }
    );

    return res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt.toISOString(),
        },
      },
    });
  } catch (err: unknown) {
    const isTimeout =
      (err instanceof Error && (err.message === "AUTH_QUERY_TIMEOUT" || (err as any).name === "MongoServerError" && (err as any).codeName === "MaxTimeMSExpired")) ||
      String(err).includes("buffering timed out") ||
      String(err).includes("timed out");

    if (isTimeout) {
      console.error("[Auth] Database operation timed out during registration");
      return res.status(504).json({
        success: false,
        error: {
          code: "AUTH_TIMEOUT",
          message: "Registration service timed out waiting for database. Please try again.",
        },
      });
    }

    console.error("[Auth] Registration failure:", err instanceof Error ? err.message : "Internal error");
    return res.status(500).json({
      success: false,
      error: {
        code: "SERVER_ERROR",
        message: isProduction ? "Registration could not be completed." : "Registration failed",
      },
    });
  }
});

authRouter.post("/login", authLimiter, async (req: Request, res: Response) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid credentials format" },
    });
  }

  const { email, password } = parsed.data;

  if (!isConnectedToMongo) {
    return res.status(503).json({
      success: false,
      error: { code: "SERVICE_UNAVAILABLE", message: "Database connection unavailable for authentication" },
    });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const userPromise = User.findOne({
      $or: [{ email: normalizedEmail }, { email: email.trim() }],
    }).maxTimeMS(8000).exec();
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("AUTH_QUERY_TIMEOUT")), 10000)
    );

    const user = await Promise.race([userPromise, timeoutPromise]);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
      });
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" },
      });
    }

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email, name: user.name, role: user.role },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any }
    );

    return res.json({
      success: true,
      data: {
        token,
        user: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt.toISOString(),
        },
      },
    });
  } catch (err: unknown) {
    const isTimeout =
      (err instanceof Error && (err.message === "AUTH_QUERY_TIMEOUT" || (err as any).name === "MongoServerError" && (err as any).codeName === "MaxTimeMSExpired")) ||
      String(err).includes("buffering timed out") ||
      String(err).includes("timed out");

    if (isTimeout) {
      console.error("[Auth] Database operation timed out during login");
      return res.status(504).json({
        success: false,
        error: {
          code: "AUTH_TIMEOUT",
          message: "Authentication service timed out waiting for database verification. Please try again.",
        },
      });
    }

    console.error("[Auth] Login failure:", err instanceof Error ? err.message : "Internal error");
    return res.status(500).json({
      success: false,
      error: {
        code: "SERVER_ERROR",
        message: env.NODE_ENV === "production" ? "Authentication service error occurred." : "Authentication service error",
      },
    });
  }
});

authRouter.get("/me", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  return res.json({
    success: true,
    data: req.user,
  });
});
