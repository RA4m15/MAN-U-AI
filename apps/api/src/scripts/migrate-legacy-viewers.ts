import mongoose from "mongoose";
import {
  loadCanonicalRootEnv,
  parseArgs,
  parseAndSanitizeMongoTarget,
  cleanMongoUri,
  sanitizeMongoMessage,
  type SanitizedTargetInfo,
} from "./provision-user";
import {
  migrateLegacyViewers,
  type MigrateLegacyViewersResult,
} from "../services/provision.service";

// Establish canonical environment
loadCanonicalRootEnv();

export interface MigrateLegacyViewersCliOptions {
  args: Record<string, string | boolean>;
  envVars?: NodeJS.ProcessEnv;
  output?: NodeJS.WritableStream;
}

export async function migrateLegacyViewersCli(
  options: MigrateLegacyViewersCliOptions
): Promise<MigrateLegacyViewersResult> {
  const { args, envVars = process.env, output = process.stdout } = options;

  const confirm = args.confirm === true;
  const dryRun = args["dry-run"] === true || !confirm;
  const allowLocal = args["allow-local"] === true;
  const targetDbConfirm = ((args["target-db"] as string) || (args.d as string) || "").trim();
  const engineerEmail = ((args["engineer-email"] as string) || "engineer@plant.io").trim();
  const operator = ((args.operator as string) || (args.by as string) || "").trim();

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
      `Target database resolves to a local address (${target.host} / ${target.database}). Local database migration is refused by default. To permit, pass --allow-local.`
    );
  }

  if (!dryRun) {
    if (!targetDbConfirm) {
      throw new Error(
        `Error: Explicit --target-db=<database-name> confirmation is required for execution.\nTarget database is "${target.database}". You must pass --target-db="${target.database}" --confirm to execute.`
      );
    }
    if (target.database.toLowerCase() !== targetDbConfirm.toLowerCase()) {
      throw new Error(
        `Target database mismatch: URI specifies "${target.database}" but --target-db confirmation specified "${targetDbConfirm}". Operation aborted.`
      );
    }
  }

  output.write(`=== MAN-U-AI Viewer-to-Operator Role Migration ===\n`);
  output.write(`Mode:             ${dryRun ? "DRY-RUN (No changes applied)" : "LIVE EXECUTION"}\n`);
  output.write(`Target Host:      ${target.host}\n`);
  output.write(`Target Database:  ${target.database}\n`);
  output.write(`Engineer Target:  ${engineerEmail} -> engineer\n`);
  output.write(`General Targets:  * (viewer) -> operator\n`);
  output.write(`Connecting to database...\n`);

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
    const result = await migrateLegacyViewers({
      dryRun,
      confirm,
      expectedDatabase: dryRun ? undefined : target.database,
      authorizedEngineerEmail: engineerEmail,
      operatorEmail: operator || undefined,
    });

    output.write(`\nMigration Scan Complete:\n`);
    output.write(`  Total legacy 'viewer' accounts found: ${result.totalFound}\n`);
    output.write(`  Accounts promoted to 'engineer':     ${result.promotedEngineerCount}\n`);
    output.write(`  Accounts migrated to 'operator':      ${result.migratedCount}\n`);

    if (result.accounts.length > 0) {
      output.write(`\nAccounts list:\n`);
      for (const a of result.accounts) {
        output.write(`  - ${a.email}: ${a.previousRole} -> ${a.newRole} (${a.actionTaken})\n`);
      }
    }

    if (result.dryRun) {
      output.write(`\n[DRY-RUN COMPLETE] No database records were modified.\n`);
      output.write(`To execute the migration against "${target.database}", run:\n`);
      output.write(`  pnpm --filter @man-u-ai/api migrate-legacy-viewers -- --target-db=${target.database} --confirm\n`);
    } else {
      output.write(`\n[SUCCESS] All legacy accounts updated and audit events logged.\n`);
    }

    return result;
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  }
}

// Direct CLI invocation
if (require.main === module) {
  const cliArgs = parseArgs(process.argv.slice(2));
  migrateLegacyViewersCli({ args: cliArgs })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err.message || String(err));
      process.exit(1);
    });
}

