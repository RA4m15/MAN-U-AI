import mongoose from "mongoose";
import readline from "readline";
import dotenv from "dotenv";
dotenv.config();

import { provisionUser } from "../services/provision.service";

export function sanitizeMongoMessage(msg: string): string {
  return msg.replace(/mongodb(\+srv)?:\/\/[^@]+@/gi, "mongodb$1://[REDACTED]@");
}

function parseArgs(args: string[]): Record<string, string | boolean> {
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

async function promptHidden(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const email = (args.email as string) || (args.e as string) || "";
  const name = (args.name as string) || (args.n as string) || "";
  const role = (args.role as string) || (args.r as string) || "admin";
  let password = (args.password as string) || process.env.PROVISION_PASSWORD || "";
  const confirm = args.confirm === true;
  const mongoUri = (args.uri as string) || process.env.MONGODB_URI || "mongodb://localhost:27017/manuai";

  if (!email) {
    console.error("Error: --email=<email> is required.");
    console.error("Usage: npm run provision-user -- --email=admin@plant.io --role=admin [--name=\"Admin Name\"] [--password=...] [--confirm]");
    console.error("Alternatively, supply PROVISION_PASSWORD in the environment.");
    process.exit(1);
  }

  if (!confirm) {
    console.error("Error: Confirmation required. Pass --confirm to authorize database modification.");
    process.exit(1);
  }

  if (!password) {
    if (process.stdin.isTTY) {
      password = await promptHidden("Enter initial password (min 8 chars): ");
    } else {
      console.error("Error: Initial password must be supplied via PROVISION_PASSWORD env var or --password flag in non-interactive environments.");
      process.exit(1);
    }
  }

  console.log(`[Provision] Connecting to MongoDB to provision operator account: ${email}...`);
  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });

    // Check ping
    const adminDb = mongoose.connection.db?.admin();
    if (adminDb) {
      await adminDb.ping();
    }
  } catch (connErr: any) {
    console.error("[Provision Error] Failed to establish database connection:", sanitizeMongoMessage(connErr.message || String(connErr)));
    process.exit(1);
  }

  try {
    const result = await provisionUser({
      email,
      name: name || undefined,
      role: role as any,
      password,
      confirm,
    });

    console.log("[Provision] Account provisioned successfully!");
    console.log(`  User ID:    ${result.id}`);
    console.log(`  Email:      ${result.email}`);
    console.log(`  Name:       ${result.name}`);
    console.log(`  Role:       ${result.role}`);
    console.log(`  Created At: ${result.createdAt.toISOString()}`);
    console.log("[Provision] Password securely hashed with bcrypt (work factor: 10). Password value was not logged.");

    await mongoose.disconnect();
    process.exit(0);
  } catch (err: any) {
    console.error("[Provision Error]:", sanitizeMongoMessage(err.message || String(err)));
    await mongoose.disconnect();
    process.exit(1);
  }
}

run().catch(async (err) => {
  console.error("[Provision Fatal Error]:", sanitizeMongoMessage(err.message || String(err)));
  try {
    await mongoose.disconnect();
  } catch {
    // Ignore disconnect error during fatal exit
  }
  process.exit(1);
});
