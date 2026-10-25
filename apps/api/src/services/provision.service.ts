import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User } from "../models";
import type { UserRole } from "@man-u-ai/shared";

export const ProvisionUserSchema = z.object({
  email: z.string().email("Invalid email format").trim().toLowerCase(),
  name: z.string().min(1).max(100).trim().optional(),
  role: z.enum(["admin", "engineer", "viewer"], {
    message: "Invalid role. Allowed roles are: admin, engineer, viewer",
  }),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .max(128, "Password must not exceed 128 characters"),
  confirm: z.boolean().refine((val) => val === true, {
    message: "Explicit confirmation required. Confirmation flag must be true to modify the database.",
  }),
  expectedDatabase: z.string().trim().optional(),
});

export type ProvisionUserInput = z.infer<typeof ProvisionUserSchema>;

export interface ProvisionedUserResult {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
}

/**
 * Narrowly scoped service to provision a single production or administrative operator account.
 *
 * Guarantees:
 * 1. Validates email and allowed UserRole strictly.
 * 2. Requires explicit operator confirmation flag before writing.
 * 3. Never overwrites an existing user account or resets passwords.
 * 4. Never creates synthetic demo equipment, documents, vector chunks, or audit fixtures.
 * 5. Uses standard bcrypt hashing with work factor 10.
 * 6. Never logs passwords or sensitive credentials.
 * 7. Verifies intended target database matches current database connection if expectedDatabase is specified.
 */
export async function provisionUser(input: ProvisionUserInput): Promise<ProvisionedUserResult> {
  const parsed = ProvisionUserSchema.safeParse(input);
  if (!parsed.success) {
    const errorMessages = parsed.error.issues.map((i) => i.message).join("; ");
    throw new Error(`Provisioning validation failed: ${errorMessages}`);
  }

  const { email, role, password, confirm, expectedDatabase } = parsed.data;
  const name = parsed.data.name || email.split("@")[0];

  if (!confirm) {
    throw new Error("Explicit operator confirmation is required before modifying the database.");
  }

  if (expectedDatabase) {
    const currentDb = mongoose.connection.db?.databaseName;
    if (currentDb && currentDb.toLowerCase() !== expectedDatabase.toLowerCase()) {
      throw new Error(
        `Target database mismatch: connected to "${currentDb}" but explicit confirmation required "${expectedDatabase}".`
      );
    }
  }

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error(
      `User with email "${email}" already exists (Role: ${existingUser.role}, ID: ${existingUser._id.toString()}). Existing accounts and passwords cannot be overwritten.`
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const newUser = await User.create({
    name,
    email,
    passwordHash,
    role,
    orgId: "default-plant-org",
  });

  return {
    id: newUser._id.toString(),
    email: newUser.email,
    name: newUser.name,
    role: newUser.role,
    createdAt: newUser.createdAt,
  };
}
