import mongoose from "mongoose";
import type { Request as ExpressRequest, Response as ExpressResponse, NextFunction as ExpressNext } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { User } from "../models";
import { isConnectedToMongo } from "../config/database";
import type { UserRole } from "@man-u-ai/shared";

export interface AuthenticatedRequest extends ExpressRequest {
  user?: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  };
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: ExpressResponse,
  next: ExpressNext
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Missing or invalid authorization header" },
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as {
      id: string;
      email: string;
      role: UserRole;
      name: string;
    };

    const VALID_ROLES: readonly UserRole[] = ["admin", "engineer", "viewer"] as const;
    const sanitizeRole = (r: unknown): UserRole => {
      if (typeof r === "string" && (VALID_ROLES as readonly string[]).includes(r)) {
        return r as UserRole;
      }
      return "viewer";
    };

    if (isConnectedToMongo) {
      if (decoded.id && mongoose.Types.ObjectId.isValid(decoded.id)) {
        try {
          const user = await User.findById(decoded.id);
          if (!user) {
            return res.status(401).json({
              success: false,
              error: { code: "USER_NOT_FOUND", message: "User account no longer exists or has been deactivated" },
            });
          }

          req.user = {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            role: sanitizeRole(user.role),
          };
          return next();
        } catch (dbErr) {
          console.error("[Auth] Database query error during user verification:", dbErr);
          return res.status(503).json({
            success: false,
            error: { code: "SERVICE_UNAVAILABLE", message: "Database query error during user verification" },
          });
        }
      }

      // If MongoDB is connected and decoded.id is not a valid ObjectId:
      // In production or strict mode, reject since real accounts have valid ObjectIds
      if (process.env.NODE_ENV !== "test" || process.env.STRICT_AUTH_TEST === "true") {
        return res.status(401).json({
          success: false,
          error: { code: "USER_NOT_FOUND", message: "User account no longer exists or has been deactivated" },
        });
      }
    }

    // Permit payload-only fallback only when database is disconnected in safe offline/test mode (never in production)
    if (!isConnectedToMongo) {
      const isProduction = process.env.NODE_ENV === "production";
      const isOfflineAuthPermitted =
        !isProduction &&
        (process.env.ALLOW_OFFLINE_AUTH === "true" ||
          (process.env.NODE_ENV === "test" && process.env.ALLOW_OFFLINE_AUTH !== "false"));

      if (!isOfflineAuthPermitted) {
        return res.status(503).json({
          success: false,
          error: { code: "SERVICE_UNAVAILABLE", message: "Authentication database is disconnected" },
        });
      }
    }

    req.user = {
      id: decoded.id || "offline-user",
      email: decoded.email || "offline@plant.local",
      name: decoded.name || "Offline User",
      role: sanitizeRole(decoded.role),
    };
    return next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: { code: "TOKEN_INVALID", message: "Session token is invalid or expired" },
    });
  }
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: ExpressResponse, next: ExpressNext) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: `Access denied. Requires one of roles: [${allowedRoles.join(", ")}]`,
        },
      });
    }

    next();
  };
}
