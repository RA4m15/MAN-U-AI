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

    if (isConnectedToMongo && mongoose.Types.ObjectId.isValid(decoded.id)) {
      const user = await User.findById(decoded.id);
      if (user) {
        req.user = {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          role: user.role,
        };
        return next();
      }
    }


    // Valid signed JWT payload
    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name || "Engineer",
      role: decoded.role || "engineer",
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
