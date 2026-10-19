import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { provisionUser, ProvisionedUserResult } from "../services/provision.service";

export interface SanitizedTargetInfo {
  host: string;
  database: string;
  isLocal: boolean;
}

/**
 * Sanitizes any MongoDB URI or error string to ensure credentials are never leaked.
 */
export function sanitizeMongoMessage(msg: string): string {
  return msg.replace(/mongodb(\+srv)?:\/\/[^@]+@/gi, "mongodb$1://[REDACTED]@");
}

/**
 * Parses and sanitizes a MongoDB URI into host and database components.
 * Throws if the URI is missing or invalid.
 */
export function parseAndSanitizeMongoTarget(uri: string): SanitizedTargetInfo {
  if (!uri || typeof uri !== "string" || !uri.trim()) {
    throw new Error("Target database URI is required. Supply TARGET_MONGODB_URI or MONGODB_URI in the environment, or pass --uri=<connection-string>.");
  }

  const match = uri.trim().match(/^mongodb(?:\+srv)?:\/\/(?:[^@]+@)?([^/?#]+)(?:\/([^?#]*))?/i);
  if (!match) {
    throw new Error("Invalid MongoDB URI format.");
  }

  const host = match[1];
  const database = match[2] || "admin";

  const isLocal =
    host.includes("localhost") ||
    host.includes("127.0.0.1") ||
    host.includes("::1") ||
    host.startsWith("0.0.0.0");

  return { host, database, isLocal };
}

/**
 * Prompts for password with genuine terminal masking (asterisks) in interactive TTY mode.
 * Restores terminal raw mode properly on completion, error, or interruption.
 */
export async function promptMaskedPassword(
  prompt: string,
  input: NodeJS.ReadableStream = process.stdin,
  output: NodeJS.WritableStream = process.stdout
): Promise<string> {
  return new Promise((resolve, reject) => {
    output.write(prompt);

    const anyInput = input as any;
    const isTTY = !!anyInput.isTTY && typeof anyInput.setRawMode === "function";

    if (!isTTY) {
      // Non-interactive fallback: read stream until newline / EOF
      let data = "";
      const onData = (chunk: Buffer | string) => {
        data += chunk.toString();
        const newlineIdx = data.indexOf("\n");
        if (newlineIdx !== -1) {
          cleanup();
          resolve(data.slice(0, newlineIdx).replace(/\r$/, ""));
        }
      };
      const onEnd = () => {
        cleanup();
        resolve(data.replace(/[\r\n]+$/, ""));
      };
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      const cleanup = () => {
        input.removeListener("data", onData);
        input.removeListener("end", onEnd);
        input.removeListener("error", onError);
      };

      input.on("data", onData);
      input.on("end", onEnd);
      input.on("error", onError);
      if (typeof anyInput.resume === "function") {
        anyInput.resume();
      }
      return;
    }

    const ttyInput = input as NodeJS.ReadStream;
    let password = "";
    let cleanedUp = false;

    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      try {
        ttyInput.setRawMode(false);
      } catch {
        // Ignore errors during raw mode restore
      }
      ttyInput.removeListener("data", onData);
      process.removeListener("SIGINT", onSigInt);
      process.removeListener("SIGTERM", onSigTerm);
    };

    const onSigInt = () => {
      cleanup();
      output.write("\n");
      process.exit(130);
    };

    const onSigTerm = () => {
      cleanup();
      output.write("\n");
      process.exit(143);
    };

    const onData = (chunk: Buffer) => {
      for (const char of chunk.toString("utf8")) {
        // Ctrl+C (ETX)
        if (char === "\u0003") {
          cleanup();
          output.write("\n");
          process.exit(130);
        }
        // Enter / Return
        if (char === "\r" || char === "\n") {
          cleanup();
          output.write("\n");
          resolve(password);
          return;
        }
        // Backspace / Delete
        if (char === "\u0008" || char === "\u007f") {
          if (password.length > 0) {
            password = password.slice(0, -1);
            output.write("\b \b");
          }
        } else if (char.charCodeAt(0) >= 32) {
          // Printable characters
          password += char;
          output.write("*");
        }
      }
    };

    process.once("SIGINT", onSigInt);
    process.once("SIGTERM", onSigTerm);

    try {
      ttyInput.setRawMode(true);
      ttyInput.resume();
      ttyInput.on("data", onData);
    } catch (err) {
      cleanup();
      reject(err);
    }
  });
}

export function parseArgs(args: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (const arg of args) {
    if (arg.startsWith("--")) {
      const eqIdx = arg.indexOf("=");
      if (eqIdx !== -1) {
        const key = arg.slice(2, eqIdx);
        const val = arg.slice(eqIdx + 1);
        result[key] = val;
      } else {
        result[arg.slice(2)] = true;
      }
    }
  }
  return result;
}

export interface ProvisionUserCliOptions {
  args: Record<string, string | boolean>;
  envVars?: NodeJS.ProcessEnv;
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
}

/**
 * Core CLI execution logic separated from process.exit for robust unit testing and safety.
 */
export async function provisionUserCli(options: ProvisionUserCliOptions): Promise<ProvisionedUserResult> {
  const { args, envVars = process.env, input = process.stdin, output = process.stdout } = options;

  // A. Reject plaintext password command-line flag
  if ("password" in args) {
    throw new Error(
      "The --password command-line argument is disabled for security to prevent exposing secrets in process tables or shell history. Supply the password interactively via the masked terminal prompt, or via the PROVISION_PASSWORD environment variable."
    );
  }

  const email = (args.email as string) || (args.e as string) || "";
  const name = (args.name as string) || (args.n as string) || "";
  const role = (args.role as string) || (args.r as string) || "admin";
  const confirm = args.confirm === true;
  const allowLocal = args["allow-local"] === true;
  const targetDbConfirm = (args["target-db"] as string) || "";

  if (!email) {
    throw new Error(
      "Error: --email=<email> is required.\nUsage: npm run provision-user -- --email=operator@plant.io --role=admin [--name=\"Operator Name\"] [--uri=<connection-string>] [--confirm]"
    );
  }

  // B. Fail-closed on database selection (NO default localhost fallback)
  const rawUri = (args.uri as string) || envVars.TARGET_MONGODB_URI || envVars.MONGODB_URI || "";
  if (!rawUri) {
    throw new Error(
      "Target database URI is required. Supply TARGET_MONGODB_URI or MONGODB_URI in the environment, or pass --uri=<connection-string>."
    );
  }

  const target = parseAndSanitizeMongoTarget(rawUri);

  // Refuse localhost target unless explicitly authorized via --allow-local
  if (target.isLocal && !allowLocal) {
    throw new Error(
      `Target database resolves to a local address (${target.host} / ${target.database}). Local database provisioning is refused by default to prevent accidental local modifications. If you intentionally intend to provision a local test database, explicitly pass --allow-local.`
    );
  }

  // Verify explicit database name confirmation if provided
  if (targetDbConfirm && target.database.toLowerCase() !== targetDbConfirm.toLowerCase()) {
    throw new Error(
      `Target database mismatch: URI specifies database "${target.database}" but --target-db confirmation required "${targetDbConfirm}".`
    );
  }

  // Require explicit confirmation flag
  if (!confirm) {
    throw new Error(
      `Confirmation required. Pass --confirm to authorize provisioning account on target [${target.host} / ${target.database}].`
    );
  }

  // C. Display sanitized target information
  output.write(`[Provision] Target Host:     ${target.host}\n`);
  output.write(`[Provision] Target Database: ${target.database}\n`);
  output.write(`[Provision] Operator Email:  ${email}\n`);
  output.write(`[Provision] Operator Role:   ${role}\n`);

  // D. Obtain password securely
  let password = envVars.PROVISION_PASSWORD || "";
  if (!password) {
    password = await promptMaskedPassword("Enter initial password (min 8 chars): ", input, output);
  }

  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }

  // E. Connect to the specified database
  output.write(`[Provision] Connecting to database...\n`);
  try {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    mongoose.set("strictQuery", true);
    await mongoose.connect(rawUri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });

    const adminDb = mongoose.connection.db?.admin();
    if (adminDb) {
      await adminDb.ping();
    }
  } catch (connErr: any) {
    throw new Error(`Database connection failed: ${sanitizeMongoMessage(connErr.message || String(connErr))}`);
  }

  try {
    const result = await provisionUser({
      email,
      name: name || undefined,
      role: role as any,
      password,
      confirm,
      expectedDatabase: target.database,
    });

    output.write("[Provision] Account provisioned successfully!\n");
    output.write(`  User ID:    ${result.id}\n`);
    output.write(`  Email:      ${result.email}\n`);
    output.write(`  Name:       ${result.name}\n`);
    output.write(`  Role:       ${result.role}\n`);
    output.write(`  Created At: ${result.createdAt.toISOString()}\n`);
    output.write("[Provision] Password securely hashed with bcrypt (work factor: 10). Password value was not logged.\n");

    return result;
  } finally {
    try {
      await mongoose.disconnect();
    } catch {
      // Disconnect error non-fatal during cleanup
    }
  }
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  try {
    await provisionUserCli({ args });
    process.exit(0);
  } catch (err: any) {
    console.error("[Provision Error]:", sanitizeMongoMessage(err.message || String(err)));
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
