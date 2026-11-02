import mongoose from "mongoose";
import {
  loadCanonicalRootEnv,
  parseArgs,
  parseAndSanitizeMongoTarget,
  cleanMongoUri,
  sanitizeMongoMessage,
  type SanitizedTargetInfo,
} from "./provision-user";
import { promoteUser, type PromotedUserResult } from "../services/provision.service";
import type { UserRole } from "@man-u-ai/shared";

// Establish canonical environment
loadCanonicalRootEnv();

export interface PromoteUserCliOptions {
  args: Record<string, string | boolean>;
  envVars?: NodeJS.ProcessEnv;
  output?: NodeJS.WritableStream;
}

/**
 * Narrowly scoped, auditable CLI script to promote or assign a role to an existing production user.
 * Strictly preserves passwords, verifies existing account, and records audit logs.
 */
export async function promoteUserCli(options: PromoteUserCliOptions): Promise<PromotedUserResult> {
  const { args, envVars = process.env, output = process.stdout } = options;

  const email = ((args.email as string) || (args.e as string) || "").trim();
  const roleArg = ((args.role as string) || (args.r as string) || "").trim();
  const orgId = ((args["org-id"] as string) || (args.org as string) || "").trim();
  const operator = ((args.operator as string) || (args.by as string) || "").trim();
  const confirm = args.confirm === true;
  const allowLocal = args["allow-local"] === true;
  const targetDbConfirm = ((args["target-db"] as string) || (args.d as string) || "").trim();

  if (!email) {
    throw new Error(
      "Error: --email=<email> is required.\nUsage: pnpm --filter @man-u-ai/api promote-user -- --email=engineer@plant.io --role=engineer --target-db=<dbname> --confirm"
    );
  }

  if (!roleArg) {
    throw new Error(
      "Error: --role=<role> is required. Allowed roles: admin, engineer, viewer, manager.\nUsage: pnpm --filter @man-u-ai/api promote-user -- --email=engineer@plant.io --role=engineer --target-db=<dbname> --confirm"
    );
  }

  const allowedRoles: readonly string[] = ["admin", "engineer", "viewer", "manager"];
  if (!allowedRoles.includes(roleArg.toLowerCase())) {
    throw new Error(
      `Error: Invalid role "${roleArg}". Allowed roles: ${allowedRoles.join(", ")}.`
    );
  }
  const role = roleArg.toLowerCase() as UserRole;

  // Resolve target database URI
  let rawUri = (args.uri as string) || envVars.TARGET_MONGODB_URI || envVars.MONGODB_URI || "";
  let target: SanitizedTargetInfo;
  try {
    target = parseAndSanitizeMongoTarget(rawUri);
  } catch (err: any) {
    throw new Error(`Target database URI error: ${sanitizeMongoMessage(err.message || String(err))}`);
  }

  rawUri = cleanMongoUri(rawUri);

  // Local protection
  if (target.isLocal && !allowLocal) {
    throw new Error(
      `Target database resolves to a local address (${target.host} / ${target.database}). Local database promotion is refused by default. To permit, pass --allow-local.`
    );
  }

  // Target database confirmation
  if (!targetDbConfirm) {
    throw new Error(
      `Error: Explicit --target-db=<database-name> confirmation is required.\nTarget database parsed from URI is "${target.database}". You must pass --target-db="${target.database}" to confirm your intention.`
    );
  }

  if (target.database.toLowerCase() !== targetDbConfirm.toLowerCase()) {
    throw new Error(
      `Target database mismatch: URI specifies "${target.database}" but --target-db confirmation specified "${targetDbConfirm}". Operation aborted.`
    );
  }

  if (!confirm) {
    throw new Error(
      `Confirmation required. Pass --confirm to authorize modifying role for account "${email}" on [${target.host} / ${target.database}].`
    );
  }

  output.write(`[Promote] Target Host:     ${target.host}\n`);
  output.write(`[Promote] Target Database: ${target.database}\n`);
  output.write(`[Promote] Target Account:  ${email}\n`);
  output.write(`[Promote] Requested Role:  ${role}\n`);

  output.write(`[Promote] Connecting to database...\n`);
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    mongoose.set("strictQuery", true);
    await mongoose.connect(rawUri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });
  } catch (connErr: any) {
    throw new Error(`Database connection failed: ${sanitizeMongoMessage(connErr.message || String(connErr))}`);
  }

  try {
    const result = await promoteUser({
      email,
      role,
      confirm,
      expectedDatabase: target.database,
      expectedOrgId: orgId || undefined,
      operatorEmail: operator || undefined,
    });

    output.write("[Promote] Operation completed successfully!\n");
    output.write(`  Account ID:    ${result.id}\n`);
    output.write(`  Email:         ${result.email}\n`);
    output.write(`  Name:          ${result.name}\n`);
    output.write(`  Previous Role: ${result.previousRole}\n`);
    output.write(`  Current Role:  ${result.role}\n`);
    output.write(`  Status:        ${result.alreadySet ? "Already assigned (idempotent no-op)" : "Role updated"}\n`);
    output.write("[Promote] Password and authentication credentials were strictly preserved intact (no password change).\n");
    output.write("[Promote] Audit event logged: action=\"role_change\"\n");

    return result;
  } finally {
    try {
      await mongoose.disconnect();
    } catch {
      // Ignore disconnect error
    }
  }
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  try {
    await promoteUserCli({ args });
    process.exit(0);
  } catch (err: any) {
    console.error("[Promote Error]:", sanitizeMongoMessage(err.message || String(err)));
    try {
      await mongoose.disconnect();
    } catch {
      // Ignore
    }
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}

