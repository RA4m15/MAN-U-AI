import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { RegisterSchema, LoginSchema } from "@man-u-ai/shared";
import { User } from "../models";
import { env } from "../config/env";
import { isConnectedToMongo } from "../config/database";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth";

export const authRouter: Router = Router();

authRouter.post("/register", async (req: Request, res: Response) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid registration payload", details: parsed.error.issues },
    });
  }

  const { name, email, password, role } = parsed.data;

  try {
    if (isConnectedToMongo) {
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(409).json({
          success: false,
          error: { code: "USER_EXISTS", message: "A user with this email address is already registered" },
        });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await User.create({ name, email, passwordHash, role });

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
    }

    // In-memory fallback
    const token = jwt.sign({ id: "usr-local-reg", email, name, role }, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as any,
    });
    return res.status(201).json({
      success: true,
      data: {
        token,
        user: { id: "usr-local-reg", name, email, role, createdAt: new Date().toISOString() },
      },
    });
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Registration failed", details: String(err) },
    });
  }
});

authRouter.post("/login", async (req: Request, res: Response) => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid credentials format" },
    });
  }

  const { email, password } = parsed.data;

  try {
    if (isConnectedToMongo) {
      const user = await User.findOne({ email });
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
    }

    // In-memory fallback
    const token = jwt.sign(
      { id: "usr-demo-01", email, name: email.split("@")[0], role: "engineer" },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any }
    );
    return res.json({
      success: true,
      data: {
        token,
        user: {
          id: "usr-demo-01",
          name: email.split("@")[0],
          email,
          role: "engineer",
          createdAt: new Date().toISOString(),
        },
      },
    });
  } catch (err: unknown) {
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Authentication service error", details: String(err) },
    });
  }
});

authRouter.get("/me", requireAuth, (req: AuthenticatedRequest, res: Response) => {
  return res.json({
    success: true,
    data: req.user,
  });
});
