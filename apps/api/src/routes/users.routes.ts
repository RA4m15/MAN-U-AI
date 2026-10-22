import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { User, AuditEvent } from "../models";
import { isConnectedToMongo } from "../config/database";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middlewares/auth";
import { RegisterSchema } from "@man-u-ai/shared";

export const usersRouter: Router = Router();

// GET /users - List users (Admin only)
usersRouter.get("/", requireAuth, requireRole(["admin"]), async (req: AuthenticatedRequest, res: Response) => {
  if (!isConnectedToMongo) {
    return res.status(503).json({
      success: false,
      error: { code: "SERVICE_UNAVAILABLE", message: "Database connection unavailable" },
    });
  }

  try {
    const users = await User.find().sort({ createdAt: -1 });
    return res.json({
      success: true,
      data: users.map((u) => ({
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        role: u.role,
        status: "active",
        createdAt: u.createdAt.toISOString(),
        lastLogin: u.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[Users] Find error:", err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to query personnel registry" },
    });
  }
});

// POST /users - Create new user (Admin only)
usersRouter.post("/", requireAuth, requireRole(["admin"]), async (req: AuthenticatedRequest, res: Response) => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    const sanitizedIssues = parsed.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid user details", details: sanitizedIssues },
    });
  }

  const { name, email, password, role } = parsed.data;

  if (!password || typeof password !== "string" || password.trim().length < 8) {
    return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Password is required and must be at least 8 characters" },
    });
  }

  if (isConnectedToMongo) {
    try {
      const existing = await User.findOne({ email });
      if (existing) {
        return res.status(409).json({ success: false, error: { code: "EXISTS", message: "User email already exists" } });
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await User.create({ name, email, passwordHash, role });

      await AuditEvent.create({
        userId: req.user?.id,
        userEmail: req.user?.email,
        action: "user_create",
        resourceType: "User",
        resourceId: user._id.toString(),
        details: { name, email, role },
      });

      return res.status(201).json({
        success: true,
        data: {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          status: "active",
          createdAt: user.createdAt.toISOString(),
        },
      });
    } catch (err) {
      console.warn("[Users] Create error:", err);
    }
  }

  return res.status(500).json({ success: false, error: { code: "DB_ERROR", message: "Could not persist user" } });
});

// PATCH /users/:id/role - Update user role (Admin only)
usersRouter.patch("/:id/role", requireAuth, requireRole(["admin"]), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!["admin", "engineer", "viewer"].includes(role)) {
    return res.status(400).json({ success: false, error: { code: "BAD_ROLE", message: "Invalid role specified" } });
  }

  if (isConnectedToMongo) {
    try {
      const user = await User.findByIdAndUpdate(id, { role }, { new: true });
      if (user) {
        await AuditEvent.create({
          userId: req.user?.id,
          userEmail: req.user?.email,
          action: "role_change",
          resourceType: "User",
          resourceId: id,
          details: { targetEmail: user.email, newRole: role },
        });

        return res.json({ success: true, data: { id: user._id.toString(), role: user.role } });
      }
    } catch (err) {
      console.warn("[Users] Role update error:", err);
    }
  }

  return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "User not found" } });
});

// DELETE /users/:id - Remove user (Admin only)
usersRouter.delete("/:id", requireAuth, requireRole(["admin"]), async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  if (isConnectedToMongo) {
    try {
      await User.findByIdAndDelete(id);
      return res.json({ success: true, data: { message: "User deactivated successfully" } });
    } catch (err) {
      console.warn("[Users] Delete error:", err);
    }
  }
  return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "User not found" } });
});
