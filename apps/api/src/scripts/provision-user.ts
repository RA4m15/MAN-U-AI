import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

/**
 * Canonical root .env locator for development, CLI scripts, and compiled execution.
 * Discovers the repository root marked by pnpm-workspace.yaml or .git.
 * Returns null if no repository root marker is found to prevent accidental cwd fallbacks.
 */
export function findCanonicalRootEnvPath(startDir: string = __dirname): string | null {
  let curr = startDir;
  while (curr && curr !== path.dirname(curr)) {
    const workspaceMarker = path.join(curr, "pnpm-workspace.yaml");
    const gitMarker = path.join(curr, ".git");
    if (fs.existsSync(workspaceMarker) || fs.existsSync(gitMarker)) {
      return path.join(curr, ".env");
    }
    curr = path.dirname(curr);
  }
  return null;
}

/**
 * Loads the environment from the canonical root .env if it exists.
 * If the canonical root .env does not exist or no root marker is found, no fallback to
 * subfolder .env or process.cwd()/.env is performed, preserving environment variables
 * already supplied by the runtime.
 */
export function loadCanonicalRootEnv(startDir: string = __dirname): { loaded: boolean; path: string | null } {
  const envPath = findCanonicalRootEnvPath(startDir);
  if (envPath && fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    return { loaded: true, path: envPath };
  }
  return { loaded: false, path: envPath };
}

// 1. Immediately establish canonical environment configuration at startup
loadCanonicalRootEnv();

// 2. Type-only import erased at compile time to avoid module hoisting
import type { ProvisionedUserResult } from "../services/provision.service";
export type { ProvisionedUserResult };

// 3. Deferred module loader ensuring loadCanonicalRootEnv() executes before application modules initialize
let _provisionUserFn: typeof import("../services/provision.service").provisionUser | null = null;
export async function getProvisionUser(): Promise<typeof import("../services/provision.service").provisionUser> {
  if (!_provisionUserFn) {
    const service = await import("../services/provision.service");
    _provisionUserFn = service.provisionUser;
  }
  return _provisionUserFn;
}

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
 * Strips leading/trailing control characters, whitespace, and surrounding single or double quotes.
 */
export function cleanMongoUri(uri: string): string {
  if (!uri || typeof uri !== "string") return "";
  let cleaned = uri.replace(/^[\s\x00-\x1F\x7F]+|[\s\x00-\x1F\x7F]+$/g, "");
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  return cleaned.replace(/^[\s\x00-\x1F\x7F]+|[\s\x00-\x1F\x7F]+$/g, "");
}

/**
 * Parses and sanitizes a MongoDB URI into host and database components.
 * Strips accidental quotes or control characters, validates protocol schemes,
 * verifies database presence, and normalizes hostnames to detect all loopback variants.
 */
export function parseAndSanitizeMongoTarget(uri: string): SanitizedTargetInfo {
  if (!uri || typeof uri !== "string") {
    throw new Error(
      "Target database URI is required. Supply TARGET_MONGODB_URI or MONGODB_URI in the environment, or pass --uri=<connection-string>."
    );
  }

  const cleanedUri = cleanMongoUri(uri);

  if (!cleanedUri) {
    throw new Error(
      "Target database URI is empty. Supply TARGET_MONGODB_URI or MONGODB_URI in the environment, or pass --uri=<connection-string>."
    );
  }

  if (!cleanedUri.startsWith("mongodb://") && !cleanedUri.startsWith("mongodb+srv://")) {
    throw new Error(
      "Unsupported MongoDB URI scheme: Connection string must begin with 'mongodb://' or 'mongodb+srv://'."
    );
  }

  const match = cleanedUri.match(/^mongodb(?:\+srv)?:\/\/(?:([^/@]+)@)?([^/?#]+)(?:\/([^?#]*))?(?:\?.*)?$/i);
  if (!match) {
    if (cleanedUri.match(/^mongodb(?:\+srv)?:\/\/\//i)) {
      throw new Error("Invalid MongoDB URI: Hostname is invalid or missing.");
    }
    throw new Error("Invalid MongoDB URI format: Unable to parse host and database path.");
  }

  const rawHost = (match[2] || "").trim();
  if (!rawHost || rawHost.includes("@") || /\s/.test(rawHost)) {
    throw new Error("Invalid MongoDB URI: Hostname is invalid or missing.");
  }

  const database = (match[3] || "").trim();
  if (!database) {
    throw new Error(
      "Invalid MongoDB URI: Database name is missing from URI path. For production, specify '/manuai' before query parameters (e.g. mongodb+srv://<user>:<password>@cluster.mongodb.net/manuai?retryWrites=true)."
    );
  }

  if (/\s/.test(database)) {
    throw new Error("Invalid MongoDB URI: Database name contains invalid whitespace characters.");
  }

  // Check for local host across all hosts (e.g. comma-separated replica sets)
  const hostTokens = rawHost.split(",").map((h) => h.trim());
  let isLocal = false;

  for (const token of hostTokens) {
    const normalizedHost = token.toLowerCase();
    let hostWithoutPort = normalizedHost;

    if (normalizedHost.startsWith("[")) {
      const closingBracket = normalizedHost.indexOf("]");
      if (closingBracket !== -1) {
        hostWithoutPort = normalizedHost.slice(1, closingBracket);
      }
    } else if ((normalizedHost.match(/:/g) || []).length === 1) {
      hostWithoutPort = normalizedHost.split(":")[0];
    }

    const isIpv4Loopback = /^127\.(?:[0-9]{1,3}\.){2}[0-9]{1,3}$/.test(hostWithoutPort);
    const isIpv6Loopback =
      hostWithoutPort === "::1" ||
      hostWithoutPort === "0:0:0:0:0:0:0:1" ||
      hostWithoutPort === "::" ||
      hostWithoutPort === "0:0:0:0:0:0:0:0";
    const isLocalhostDomain =
      hostWithoutPort === "localhost" ||
      hostWithoutPort === "0.0.0.0" ||
      hostWithoutPort.endsWith(".localhost");

    if (isIpv4Loopback || isIpv6Loopback || isLocalhostDomain) {
      isLocal = true;
      break;
    }
  }

  return { host: rawHost, database, isLocal };
}

/**
 * Prompts for password with genuine terminal masking (asterisks) in interactive TTY mode.
 * Fails closed in non-interactive environments unless PROVISION_PASSWORD is provided.
 * Restores terminal raw mode properly on completion, error, or interruption.
 */
export async function promptMaskedPassword(
  prompt: string,
  input: NodeJS.ReadableStream = process.stdin,
  output: NodeJS.WritableStream = process.stdout
): Promise<string> {
  return new Promise((resolve, reject) => {
    const anyInput = input as any;
    const isTTY = !!anyInput.isTTY && typeof anyInput.setRawMode === "function";

    if (!isTTY) {
      reject(
        new Error(
          "Interactive password masking requires a TTY terminal. In non-interactive environments (CI, scripts, or automated tests), supply the initial password via the PROVISION_PASSWORD environment variable."
        )
      );
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
      output.write(prompt);
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

  const email = ((args.email as string) || (args.e as string) || "").trim();
  const name = ((args.name as string) || (args.n as string) || "").trim();
  const roleArg = ((args.role as string) || (args.r as string) || "").trim();
  const confirm = args.confirm === true;
  const allowLocal = args["allow-local"] === true;
  const targetDbConfirm = ((args["target-db"] as string) || (args.d as string) || "").trim();

  if (!email) {
    throw new Error(
      "Error: --email=<email> is required.\nUsage: npm run provision-user -- --email=operator@plant.io --role=admin --target-db=<dbname> [--name=\"Operator Name\"] [--uri=<connection-string>] [--confirm]"
    );
  }

  // B. Make missing --role a validation error; require explicitly supplied allowed role
  if (!roleArg) {
    throw new Error(
      "Error: --role=<role> is required. Allowed roles are: admin, engineer, viewer.\nUsage: npm run provision-user -- --email=operator@plant.io --role=admin --target-db=<dbname> --confirm"
    );
  }

  const allowedRoles = ["admin", "engineer", "viewer"];
  if (!allowedRoles.includes(roleArg.toLowerCase())) {
    throw new Error(
      `Error: Invalid role "${roleArg}". Allowed roles are: ${allowedRoles.join(", ")}.`
    );
  }
  const role = roleArg.toLowerCase() as "admin" | "engineer" | "viewer";

  // C. Target database resolution, validation, and safe recovery
  const anyInput = input as any;
  const isTTY = !!anyInput.isTTY && typeof anyInput.setRawMode === "function";

  let rawUri = (args.uri as string) || envVars.TARGET_MONGODB_URI || envVars.MONGODB_URI || "";
  let target: SanitizedTargetInfo | null = null;
  let uriValidationError: string | null = null;

  if (rawUri) {
    try {
      target = parseAndSanitizeMongoTarget(rawUri);
    } catch (err: any) {
      uriValidationError = err.message || String(err);
      target = null;
    }
  }

  // If URI is missing or invalid:
  if (!target) {
    if (!isTTY) {
      // Non-interactive fail-closed
      const envHint = envVars.TARGET_MONGODB_URI
        ? `\nThe current TARGET_MONGODB_URI environment variable contains invalid input:\n  ${sanitizeMongoMessage(uriValidationError || "Invalid URI")}\nTo clear the invalid value in PowerShell, run:\n  Remove-Item Env:\\TARGET_MONGODB_URI\n`
        : "";
      throw new Error(
        `Target database URI is required and must be valid.${envHint}\nSupply a valid TARGET_MONGODB_URI or MONGODB_URI in the environment, or pass --uri=<connection-string>.`
      );
    }

    // Interactive TTY recovery path
    if (rawUri && uriValidationError) {
      output.write(`[Provision Warning] Database URI from environment is invalid:\n  ${sanitizeMongoMessage(uriValidationError)}\n`);
      output.write(`[Provision Hint] If your environment variable holds stale command text, clear it in PowerShell with:\n  Remove-Item Env:\\TARGET_MONGODB_URI\n\n`);
    } else {
      output.write("[Provision] Target MongoDB URI not found in environment variables.\n");
    }

    let attempts = 0;
    while (!target && attempts < 3) {
      attempts++;
      output.write("[Provision] Enter target MongoDB Atlas connection string (e.g. mongodb+srv://<user>:<password>@cluster.mongodb.net/manuai?retryWrites=true):\n");
      rawUri = await promptMaskedPassword("Enter target MongoDB URI (masked): ", input, output);
      try {
        target = parseAndSanitizeMongoTarget(rawUri);
      } catch (err: any) {
        output.write(`[Provision Error] ${sanitizeMongoMessage(err.message || String(err))}\n`);
        target = null;
        if (attempts >= 3) {
          throw new Error(
            "Failed to provide a valid target MongoDB URI after 3 attempts. Provisioning aborted to protect database integrity."
          );
        }
      }
    }
  }

  if (!target) {
    throw new Error("Target database URI could not be validated.");
  }

  rawUri = cleanMongoUri(rawUri);

  // Refuse localhost target unless explicitly authorized via --allow-local
  if (target.isLocal && !allowLocal) {
    throw new Error(
      `Target database resolves to a local address (${target.host} / ${target.database}). Local database provisioning is refused by default to prevent accidental local modifications. If you intentionally intend to provision a local test database, explicitly pass --allow-local.`
    );
  }

  // Production workflow strictly requires target database to be "manuai"
  if (!allowLocal && target.database.toLowerCase() !== "manuai") {
    throw new Error(
      `Invalid target database "${target.database}": Production account provisioning workflow strictly requires database "manuai".`
    );
  }

  // D. Require explicit --target-db confirmation matching the database parsed from the URI
  if (!targetDbConfirm) {
    throw new Error(
      `Error: Explicit --target-db=<database-name> confirmation is required before any writes.\nTarget database parsed from URI is "${target.database}". You must pass --target-db="${target.database}" to confirm your intention.`
    );
  }

  if (target.database.toLowerCase() !== targetDbConfirm.toLowerCase()) {
    throw new Error(
      `Target database mismatch: URI specifies database "${target.database}" but --target-db confirmation specified "${targetDbConfirm}". Provisioning aborted to protect against targeting the wrong database.`
    );
  }

  // Require explicit confirmation flag
  if (!confirm) {
    throw new Error(
      `Confirmation required. Pass --confirm to authorize provisioning account on target [${target.host} / ${target.database}].`
    );
  }

  // E. Display sanitized target information
  output.write(`[Provision] Target Host:     ${target.host}\n`);
  output.write(`[Provision] Target Database: ${target.database}\n`);
  output.write(`[Provision] Operator Email:  ${email}\n`);
  output.write(`[Provision] Operator Role:   ${role}\n`);

  // F. Obtain password securely (fail closed in non-interactive environments without PROVISION_PASSWORD)
  let password = envVars.PROVISION_PASSWORD || "";
  if (!password) {
    const anyInput = input as any;
    const isTTY = !!anyInput.isTTY && typeof anyInput.setRawMode === "function";
    if (!isTTY) {
      throw new Error(
        "Non-interactive terminal detected without secure password input. In non-interactive environments, supply the initial password securely via the PROVISION_PASSWORD environment variable. Piped unmasked stdin and command-line arguments are disallowed."
      );
    }
    password = await promptMaskedPassword("Enter initial password (min 8 chars): ", input, output);
  }

  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }

  // G. Connect to the specified database
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
    const provision = await getProvisionUser();
    const result = await provision({
      email,
      name: name || undefined,
      role,
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
