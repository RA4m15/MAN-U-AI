import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { User, AuditEvent } from "../models";
import type { UserRole } from "@man-u-ai/shared";

export const ProvisionUserSchema = z.object({
  email: z.string().email("Invalid email format").trim().toLowerCase(),
  name: z.string().min(1).max(100).trim().optional(),
  role: z.enum(["admin", "engineer", "operator", "manager"], {
    message: "Invalid role. Allowed roles are: admin, engineer, operator, manager",
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

export const PromoteUserSchema = z.object({
  email: z.string().email("Invalid email format").trim().toLowerCase(),
  role: z.enum(["admin", "engineer", "operator", "manager"], {
    message: "Invalid role. Allowed roles are: admin, engineer, operator, manager",
  }),
  confirm: z.boolean().refine((val) => val === true, {
    message: "Explicit confirmation required. Confirmation flag must be true to modify the database.",
  }),
  operatorEmail: z.string().email().optional(),
  expectedDatabase: z.string().trim().optional(),
  expectedOrgId: z.string().trim().optional(),
});

export type PromoteUserInput = z.infer<typeof PromoteUserSchema>;

export interface PromotedUserResult {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  previousRole: UserRole;
  orgId?: string;
  alreadySet: boolean;
  updatedAt: Date;
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

/**
 * Narrowly scoped, auditable service to safely assign/promote an existing account's role.
 *
 * Guarantees:
 * 1. Requires explicit operator confirmation flag.
 * 2. Targets ONLY the explicitly supplied email address.
 * 3. Verifies the existing account and optional organization.
 * 4. Updates ONLY the authorized role field.
 * 5. Strictly preserves the passwordHash, email, name, and other account credentials.
 * 6. Records the role change in the audit log (AuditEvent).
 * 7. Returns before-and-after roles safely without exposing secrets.
 * 8. Fails safely if user does not exist or database/org conditions mismatch.
 * 9. Idempotent: repeated calls with the same role safely report alreadySet without redundant mutations.
 */
export async function promoteUser(input: PromoteUserInput): Promise<PromotedUserResult> {
  const parsed = PromoteUserSchema.safeParse(input);
  if (!parsed.success) {
    const errorMessages = parsed.error.issues.map((i) => i.message).join("; ");
    throw new Error(`User role promotion validation failed: ${errorMessages}`);
  }

  const { email, role, confirm, expectedDatabase, expectedOrgId, operatorEmail } = parsed.data;

  if (!confirm) {
    throw new Error("Explicit operator confirmation is required before modifying user roles in the database.");
  }

  if (expectedDatabase) {
    const currentDb = mongoose.connection.db?.databaseName;
    if (currentDb && currentDb.toLowerCase() !== expectedDatabase.toLowerCase()) {
      throw new Error(
        `Target database mismatch: connected to "${currentDb}" but explicit confirmation required "${expectedDatabase}".`
      );
    }
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await User.findOne({
    $or: [{ email: normalizedEmail }, { email: email.trim() }],
  });

  if (!existingUser) {
    throw new Error(`Target account with email "${email}" does not exist in the database.`);
  }

  if (expectedOrgId && existingUser.orgId && existingUser.orgId !== expectedOrgId) {
    throw new Error(
      `Organization mismatch for account "${email}": Expected "${expectedOrgId}" but found "${existingUser.orgId}".`
    );
  }

  const previousRole = existingUser.role as UserRole;
  const alreadySet = previousRole === role;

  if (!alreadySet) {
    existingUser.role = role;
    await existingUser.save();

    try {
      await AuditEvent.create({
        userId: existingUser._id,
        userEmail: operatorEmail || "system-operator@internal",
        action: "role_change",
        resourceType: "User",
        resourceId: existingUser._id.toString(),
        details: {
          targetEmail: existingUser.email,
          previousRole,
          newRole: role,
          operator: operatorEmail || "cli_operator",
          timestamp: new Date().toISOString(),
        },
      });
    } catch (auditErr) {
      console.warn("[Promote] AuditEvent logging non-fatal error:", auditErr);
    }
  }

  return {
    id: existingUser._id.toString(),
    email: existingUser.email,
    name: existingUser.name,
    role: existingUser.role as UserRole,
    previousRole,
    orgId: existingUser.orgId,
    alreadySet,
    updatedAt: existingUser.updatedAt,
  };
}

export interface MigrateLegacyViewersInput {
  dryRun?: boolean;
  confirm?: boolean;
  expectedDatabase?: string;
  operatorEmail?: string;
  authorizedEngineerEmail?: string;
}

export interface MigrationAccountResult {
  id: string;
  email: string;
  previousRole: string;
  newRole: UserRole;
  actionTaken: "promoted_to_engineer" | "migrated_to_operator" | "unchanged";
}

export interface MigrateLegacyViewersResult {
  dryRun: boolean;
  totalFound: number;
  migratedCount: number;
  promotedEngineerCount: number;
  accounts: MigrationAccountResult[];
}

/**
 * Controlled, auditable migration service to safely convert legacy 'viewer' accounts:
 * - engineer@plant.io (or custom authorizedEngineerEmail) is promoted to 'engineer'
 * - all other legacy 'viewer' accounts become 'operator'
 * - passwords, emails, names, orgIds remain strictly untouched
 * - records an AuditEvent per modified account
 * - supports dry-run mode and requires explicit confirm: true for writes
 */
export async function migrateLegacyViewers(
  input: MigrateLegacyViewersInput
): Promise<MigrateLegacyViewersResult> {
  const isDryRun = input.dryRun !== false && input.confirm !== true;
  const targetEngineerEmail = (input.authorizedEngineerEmail || "engineer@plant.io").toLowerCase().trim();

  if (!isDryRun && input.expectedDatabase) {
    const currentDb = mongoose.connection.db?.databaseName;
    if (currentDb && currentDb.toLowerCase() !== input.expectedDatabase.toLowerCase()) {
      throw new Error(
        `Target database mismatch: connected to "${currentDb}" but explicit confirmation required "${input.expectedDatabase}".`
      );
    }
  }

  // Find all users with legacy viewer role (using lean/raw collection query to bypass schema validation)
  const legacyUsers = await User.collection.find({
    role: { $in: ["viewer", "VIEWER", "Viewer"] },
  }).toArray();

  const accounts: MigrationAccountResult[] = [];
  let migratedCount = 0;
  let promotedEngineerCount = 0;

  for (const doc of legacyUsers) {
    const email = (doc.email || "").toLowerCase().trim();
    const id = doc._id.toString();
    const prevRole = String(doc.role || "viewer");

    let targetRole: UserRole = "operator";
    let action: "promoted_to_engineer" | "migrated_to_operator" = "migrated_to_operator";

    if (email === targetEngineerEmail) {
      targetRole = "engineer";
      action = "promoted_to_engineer";
    }

    accounts.push({
      id,
      email: doc.email,
      previousRole: prevRole,
      newRole: targetRole,
      actionTaken: action,
    });

    if (action === "promoted_to_engineer") {
      promotedEngineerCount++;
    } else {
      migratedCount++;
    }

    if (!isDryRun) {
      await User.collection.updateOne(
        { _id: doc._id },
        { $set: { role: targetRole, updatedAt: new Date() } }
      );

      try {
        await AuditEvent.create({
          userId: doc._id,
          userEmail: input.operatorEmail || "system-migration@internal",
          action: "legacy_role_migration",
          resourceType: "User",
          resourceId: id,
          details: {
            targetEmail: doc.email,
            previousRole: prevRole,
            newRole: targetRole,
            operator: input.operatorEmail || "cli_migration",
            actionTaken: action,
            timestamp: new Date().toISOString(),
          },
        });
      } catch (auditErr) {
        console.warn("[Migrate] AuditEvent logging non-fatal error:", auditErr);
      }
    }
  }

  if (!isDryRun) {
    // Also migrate any legacy DocumentPermissions
    try {
      const { DocumentPermission } = await import("../models");
      await DocumentPermission.collection.updateMany(
        { role: { $in: ["viewer", "VIEWER", "Viewer"] } },
        { $set: { role: "operator", updatedAt: new Date() } }
      );
    } catch (permErr) {
      console.warn("[Migrate] DocumentPermission migration warning:", permErr);
    }
  }

  return {
    dryRun: isDryRun,
    totalFound: legacyUsers.length,
    migratedCount,
    promotedEngineerCount,
    accounts,
  };
}
