import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";
import { User } from "../models";
import { cleanMongoUri, sanitizeMongoMessage } from "./provision-user";
import { parseMongoUriComponents, isLocalLoopbackHost } from "../config/database";

dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

/**
 * Validates whether the given connection URI points strictly to a local/loopback database instance.
 * Uses strict authority and hostname parsing to reject remote databases, Atlas SRV URIs,
 * and remote hosts that contain "localhost" in credentials.
 */
export function isLocalDatabaseUri(uri: string): boolean {
  if (!uri || typeof uri !== "string" || uri.trim() === "") {
    return false;
  }
  const cleaned = cleanMongoUri(uri);
  if (!cleaned) return false;

  const components = parseMongoUriComponents(cleaned);

  // Reject invalid schemes, mongodb+srv, and empty host lists
  if (components.scheme !== "mongodb" || components.isSrv || components.hosts.length === 0) {
    return false;
  }

  // Reject MongoDB Atlas even if standard mongodb:// is used
  if (components.isAtlas) {
    return false;
  }

  // All replica-set hosts must be verified local loopback hosts (localhost, 127.0.0.0/8, ::1)
  // Rejects remote IPs, unspecified addresses like :: or 0.0.0.0, and multi-host URIs containing any remote host
  return components.hosts.every((host) => isLocalLoopbackHost(host));
}

export interface EnsureUsersOptions {
  allowRemote?: boolean;
  mongoUri?: string;
}

/**
 * Development-only initialization helper.
 * Strictly forbidden in production environments.
 * Idempotent: Never overwrites existing user passwords or promotes existing roles.
 */
export async function ensureUsers(options?: EnsureUsersOptions): Promise<{ created: string[]; preserved: string[] }> {
  // 1. Production Mode Guard: Block predictable default credential creation
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "[Security Policy Violation] ensure-users cannot be executed in production. " +
        "Predictable default credentials and automated seeding are strictly forbidden. " +
        "Use the secure interactive provisioning workflow instead: pnpm --filter @man-u-ai/api provision-user"
    );
  }

  const rawUri = options?.mongoUri || process.env.MONGODB_URI;
  if (!rawUri || rawUri.trim() === "") {
    throw new Error("MONGODB_URI environment variable is required.");
  }

  // 2. Target Safety Guard: Prevent accidental execution against remote/production MongoDB clusters
  const isLocal = isLocalDatabaseUri(rawUri);
  const allowRemote = options?.allowRemote || process.env.ALLOW_REMOTE_DEV_SEED === "true";

  if (!isLocal && !allowRemote) {
    throw new Error(
      `[Security Policy Violation] Execution blocked against remote database target (${sanitizeMongoMessage(
        rawUri
      )}). Development seeding is restricted to local MongoDB instances. To bypass in development, set ALLOW_REMOTE_DEV_SEED=true.`
    );
  }

  // 3. Required Explicit Development Seed Password Guard (No hardcoded fallback password)
  const devPassword = process.env.INITIAL_SEED_PASSWORD;
  if (!devPassword || devPassword.trim() === "") {
    throw new Error(
      "[Security Policy Violation] INITIAL_SEED_PASSWORD environment variable is required for development seeding. " +
        "Hardcoded fallback passwords are forbidden. Supply INITIAL_SEED_PASSWORD in your environment."
    );
  }

  console.log(`[Security] Connecting to development MongoDB (${sanitizeMongoMessage(rawUri)})...`);
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(rawUri);
  }

  // 4. Allowed Development Demo Accounts ONLY (No hardcoded admin/manager production accounts)
  const devAccounts = [
    {
      name: "Elena Rostova (Dev Admin)",
      email: "admin@plant.io",
      role: "admin",
    },
    {
      name: "Alex Mercer (Dev Engineer)",
      email: "alex.mercer@plant.io",
      role: "engineer",
    },
    {
      name: "Alex Mercer (Dev Engineer Alias)",
      email: "engineer@plant.io",
      role: "engineer",
    },
    {
      name: "Sam Taylor (Dev Operator)",
      email: "operator@plant.io",
      role: "viewer",
    },
  ];

  const created: string[] = [];
  const preserved: string[] = [];

  for (const acc of devAccounts) {
    const existing = await User.findOne({ email: acc.email });

    if (existing) {
      // 4. Protection Guard: Never silently reset an existing user's password or promote role
      preserved.push(acc.email);
      console.log(
        `[Security] Preserving existing user ${acc.email} (role: ${existing.role}). Password and permissions were not overwritten.`
      );
    } else {
      const passwordHash = await bcrypt.hash(devPassword, 10);
      await User.create({
        name: acc.name,
        email: acc.email,
        passwordHash,
        role: acc.role,
        orgId: "plant-alpha",
        isActive: true,
      });
      created.push(acc.email);
      console.log(`[Security] Initialized local dev account: ${acc.email} (role: ${acc.role})`);
    }
  }

  console.log(
    `[Security] Development account check complete. Created: ${created.length}, Preserved: ${preserved.length}.`
  );
  console.log(
    "[Security] For production or custom administrator enrollment, use the secure provisioning CLI: pnpm --filter @man-u-ai/api provision-user"
  );

  return { created, preserved };
}

// Execute directly if run via CLI
if (require.main === module) {
  ensureUsers()
    .then(async () => {
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error("[FATAL]", err.message);
      process.exit(1);
    });
}
