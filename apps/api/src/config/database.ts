import mongoose from "mongoose";
import { env } from "./env";

export let isConnectedToMongo = false;

let listenersRegistered = false;

export function setupMongooseListeners(): void {
  if (listenersRegistered) return;
  listenersRegistered = true;

  mongoose.connection.on("connected", () => {
    isConnectedToMongo = true;
  });

  mongoose.connection.on("disconnected", () => {
    isConnectedToMongo = false;
  });

  mongoose.connection.on("reconnected", () => {
    isConnectedToMongo = true;
  });

  mongoose.connection.on("close", () => {
    isConnectedToMongo = false;
  });

  mongoose.connection.on("error", () => {
    if (mongoose.connection.readyState !== 1) {
      isConnectedToMongo = false;
    }
  });
}

// Initialize listeners once on module load
setupMongooseListeners();

export function setIsConnectedToMongo(connected: boolean): void {
  isConnectedToMongo = connected;
}

export let isAppInitialized = process.env.NODE_ENV === "test";

export function setIsAppInitialized(initialized: boolean): void {
  isAppInitialized = initialized;
}

/**
 * Sanitizes any MongoDB URI or error string to ensure credentials are never leaked.
 */
export function sanitizeMongoMessage(msg: string): string {
  return msg.replace(/mongodb(\+srv)?:\/\/[^@]+@/gi, "mongodb$1://[REDACTED]@");
}

export interface MongoDiagnostics {
  hasUri: boolean;
  uriScheme: string;
  clusterHost: string;
  targetDatabase: string;
  errorCategory: string | null;
  errorReason: string | null;
  lastAttemptAt: string | null;
}

export let mongoDiagnostics: MongoDiagnostics = {
  hasUri: false,
  uriScheme: "none",
  clusterHost: "none",
  targetDatabase: "none",
  errorCategory: null,
  errorReason: null,
  lastAttemptAt: null,
};

export function parseMongoUriMetadata(uriStr?: string): {
  hasUri: boolean;
  uriScheme: string;
  clusterHost: string;
  targetDatabase: string;
} {
  if (!uriStr || uriStr.trim() === "") {
    return {
      hasUri: false,
      uriScheme: "none",
      clusterHost: "not_configured",
      targetDatabase: "none",
    };
  }

  const trimmed = uriStr.trim();
  const schemeMatch = trimmed.match(/^mongodb(?:\+srv)?:\/\//i);
  const uriScheme = schemeMatch ? schemeMatch[0].replace("://", "").toLowerCase() : "invalid";

  let clusterHost = "unknown";
  let targetDatabase = "manuai";

  const atIndex = trimmed.indexOf("@");
  if (atIndex !== -1) {
    const afterAt = trimmed.slice(atIndex + 1);
    const slashIndex = afterAt.indexOf("/");
    const questionIndex = afterAt.indexOf("?");
    const endHost = slashIndex !== -1 ? slashIndex : (questionIndex !== -1 ? questionIndex : afterAt.length);
    clusterHost = afterAt.slice(0, endHost);

    if (slashIndex !== -1) {
      const afterSlash = afterAt.slice(slashIndex + 1);
      const qIndex = afterSlash.indexOf("?");
      targetDatabase = qIndex !== -1 ? afterSlash.slice(0, qIndex) : afterSlash;
      if (!targetDatabase) targetDatabase = "default";
    }
  } else {
    const afterScheme = trimmed.replace(/^mongodb(?:\+srv)?:\/\//i, "");
    const slashIndex = afterScheme.indexOf("/");
    const questionIndex = afterScheme.indexOf("?");
    const endHost = slashIndex !== -1 ? slashIndex : (questionIndex !== -1 ? questionIndex : afterScheme.length);
    clusterHost = afterScheme.slice(0, endHost);
    if (slashIndex !== -1) {
      const afterSlash = afterScheme.slice(slashIndex + 1);
      const qIndex = afterSlash.indexOf("?");
      targetDatabase = qIndex !== -1 ? afterSlash.slice(0, qIndex) : afterSlash;
      if (!targetDatabase) targetDatabase = "default";
    }
  }

  return {
    hasUri: true,
    uriScheme,
    clusterHost,
    targetDatabase,
  };
}

export function categorizeMongoError(err: unknown, uriMeta: { hasUri: boolean; uriScheme: string; clusterHost: string }): {
  category: string;
  reason: string;
} {
  if (!uriMeta.hasUri) {
    return {
      category: "Missing or invalid MONGODB_URI",
      reason: "MONGODB_URI environment variable is missing or empty",
    };
  }

  if (uriMeta.uriScheme === "invalid") {
    return {
      category: "Missing or invalid MONGODB_URI",
      reason: "MONGODB_URI does not start with mongodb:// or mongodb+srv://",
    };
  }

  const errStr = err instanceof Error ? err.message : String(err);
  const errName = err instanceof Error ? err.name : "";
  const sanitized = sanitizeMongoMessage(errStr);

  if (
    /auth(entication)? failed/i.test(errStr) ||
    /bad auth/i.test(errStr) ||
    (err as any)?.code === 18 ||
    (err as any)?.codeName === "AuthenticationFailed"
  ) {
    return {
      category: "Incorrect or outdated credentials after password rotation",
      reason: sanitized,
    };
  }

  if (/URI malformed/i.test(errStr) || /URI does not have hostname/i.test(errStr) || /unescaped/i.test(errStr)) {
    return {
      category: "Password characters not correctly URL-encoded",
      reason: sanitized,
    };
  }

  if (/querySrv ENOTFOUND/i.test(errStr) || /queryTxt ENOTFOUND/i.test(errStr) || /getaddrinfo ENOTFOUND/i.test(errStr)) {
    return {
      category: "DNS/SRV resolution failure",
      reason: sanitized,
    };
  }

  if (/whitelist/i.test(errStr) || /not allowed to access/i.test(errStr) || /IP.*not.*whitelisted/i.test(errStr)) {
    return {
      category: "Atlas Network Access blocking the Render service",
      reason: sanitized,
    };
  }

  if (
    errName === "MongooseServerSelectionError" ||
    errName === "MongoServerSelectionError" ||
    /server selection timed out/i.test(errStr) ||
    /could not connect to any servers/i.test(errStr)
  ) {
    if (uriMeta.clusterHost.includes(".mongodb.net")) {
      return {
        category: "Atlas Network Access blocking the Render service",
        reason: sanitized,
      };
    }
    return {
      category: "Connection selection timeout or cluster unavailable",
      reason: sanitized,
    };
  }

  return {
    category: "Another specific driver or configuration error",
    reason: sanitized,
  };
}

export interface MongoUriComponents {
  uri: string;
  scheme: string;
  isSrv: boolean;
  isAtlas: boolean;
  hosts: string[];
  rawHosts: string[];
  database: string;
}

export function parseMongoUriComponents(uriStr: string): MongoUriComponents {
  if (!uriStr || typeof uriStr !== "string" || uriStr.trim() === "") {
    return {
      uri: "",
      scheme: "none",
      isSrv: false,
      isAtlas: false,
      hosts: [],
      rawHosts: [],
      database: "",
    };
  }

  const trimmed = uriStr.trim();
  const schemeMatch = trimmed.match(/^mongodb(?:\+srv)?:\/\//i);
  if (!schemeMatch) {
    return {
      uri: trimmed,
      scheme: "invalid",
      isSrv: false,
      isAtlas: false,
      hosts: [],
      rawHosts: [],
      database: "",
    };
  }

  const scheme = schemeMatch[0].replace("://", "").toLowerCase();
  const isSrv = scheme === "mongodb+srv";
  const withoutScheme = trimmed.slice(schemeMatch[0].length);

  const slashIdx = withoutScheme.indexOf("/");
  const qIdx = withoutScheme.indexOf("?");
  const firstDelimiter =
    slashIdx !== -1 && qIdx !== -1 ? Math.min(slashIdx, qIdx) : slashIdx !== -1 ? slashIdx : qIdx;
  const authorityPart = firstDelimiter !== -1 ? withoutScheme.slice(0, firstDelimiter) : withoutScheme;
  const restPart = firstDelimiter !== -1 ? withoutScheme.slice(firstDelimiter) : "";

  const atIndex = authorityPart.lastIndexOf("@");
  const hostPart = atIndex !== -1 ? authorityPart.slice(atIndex + 1) : authorityPart;

  let database = "";
  if (restPart.startsWith("/")) {
    const dbAndQuery = restPart.slice(1);
    const endDbIdx = dbAndQuery.indexOf("?");
    database = endDbIdx !== -1 ? dbAndQuery.slice(0, endDbIdx) : dbAndQuery;
  }

  const rawHosts = hostPart.split(",").map((h) => h.trim()).filter(Boolean);
  const hosts: string[] = [];
  let isAtlas = isSrv;

  for (const rawHost of rawHosts) {
    let hostname = rawHost;
    if (hostname.startsWith("[")) {
      const closeBracket = hostname.indexOf("]");
      if (closeBracket !== -1) {
        hostname = hostname.slice(1, closeBracket);
      }
    } else {
      const lastColonIdx = hostname.lastIndexOf(":");
      if (lastColonIdx !== -1) {
        const potentialPort = hostname.slice(lastColonIdx + 1);
        if (/^\d+$/.test(potentialPort)) {
          hostname = hostname.slice(0, lastColonIdx);
        }
      }
    }
    const normalized = hostname.trim().toLowerCase();
    if (normalized) {
      hosts.push(normalized);
      if (normalized.endsWith(".mongodb.net") || normalized === "mongodb.net") {
        isAtlas = true;
      }
    }
  }

  return {
    uri: trimmed,
    scheme,
    isSrv,
    isAtlas,
    hosts,
    rawHosts,
    database: database.trim(),
  };
}

export function isLocalLoopbackHost(host: string): boolean {
  const normalized = host.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "localhost") return true;
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;
  // IPv4 127.0.0.0/8 loopback range (127.0.0.1 to 127.255.255.254)
  if (/^127(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(normalized)) return true;
  return false;
}

export const PROHIBITED_TEST_DATABASES = new Set([
  "manuai",
  "production",
  "admin",
  "config",
  "local",
  "prod",
]);

export interface TestDbValidationResult {
  safe: boolean;
  reason?: string;
  components: MongoUriComponents;
}

export function validateTestDatabaseSafety(
  uriStr: string,
  options?: {
    allowRemote?: boolean;
    allowedHosts?: string[];
  }
): TestDbValidationResult {
  const components = parseMongoUriComponents(uriStr);

  if (components.scheme === "invalid" || components.hosts.length === 0) {
    return {
      safe: false,
      reason: `Invalid MongoDB URI format: ${sanitizeMongoMessage(uriStr)}`,
      components,
    };
  }

  // 1. Atlas Live Cluster is NEVER permitted in test mode under any circumstance
  if (components.isAtlas || components.isSrv) {
    return {
      safe: false,
      reason: `Test suite attempted to connect to live production Atlas database (${sanitizeMongoMessage(uriStr)}). Tests must use a dedicated local test database (e.g. 'manuai_test').`,
      components,
    };
  }

  // 2. Database Name Validation: Prevent accidental connection to production or system databases
  const dbName = components.database.toLowerCase();
  if (!dbName) {
    return {
      safe: false,
      reason: `Test database URI must specify an explicit target database name (e.g. 'manuai_test'): ${sanitizeMongoMessage(uriStr)}`,
      components,
    };
  }

  if (
    !/^[a-zA-Z0-9_-]+$/.test(components.database) ||
    PROHIBITED_TEST_DATABASES.has(dbName) ||
    dbName.endsWith("_prod") ||
    dbName.endsWith("_production") ||
    dbName.startsWith("prod_") ||
    dbName.includes("production")
  ) {
    return {
      safe: false,
      reason: `Test suite attempted to target prohibited or production database '${components.database}'. Tests must target a dedicated test database (e.g. 'manuai_test').`,
      components,
    };
  }

  // 3. Remote Host Policy: Default strictly to local loopback instances only
  const allowRemoteOptIn =
    options?.allowRemote ??
    (process.env.ALLOW_REMOTE_TEST_DB === "true" || process.env.TEST_MONGODB_ALLOW_REMOTE === "true");

  const customAllowedHosts = new Set(
    (options?.allowedHosts || (process.env.TEST_MONGODB_ALLOWED_HOSTS || "").split(","))
      .map((h) => h.trim().toLowerCase().replace(/^\[|\]$/g, ""))
      .filter(Boolean)
  );

  for (const host of components.hosts) {
    const isLoopback = isLocalLoopbackHost(host);
    const isExplicitlyAllowedHost = customAllowedHosts.has(host);

    if (!isLoopback && !isExplicitlyAllowedHost && !allowRemoteOptIn) {
      return {
        safe: false,
        reason: `Test environment attempted to connect to remote MongoDB host '${host}' without explicit opt-in. Tests default to local instances (localhost / 127.0.0.1). To explicitly permit a remote or container test database, set ALLOW_REMOTE_TEST_DB=true or specify TEST_MONGODB_ALLOWED_HOSTS.`,
        components,
      };
    }
  }

  return {
    safe: true,
    components,
  };
}

export function assertSafeTestDatabase(
  uriStr: string,
  options?: {
    allowRemote?: boolean;
    allowedHosts?: string[];
  }
): MongoUriComponents {
  const result = validateTestDatabaseSafety(uriStr, options);
  if (!result.safe) {
    throw new Error(`[Database Safety Violation] ${result.reason}`);
  }
  return result.components;
}

export function isTestMode(): boolean {
  return (
    process.env.NODE_ENV === "test" ||
    process.env.VITEST === "true" ||
    env.NODE_ENV === "test"
  );
}

export async function connectDatabase(overrideUri?: string): Promise<boolean> {
  // Isolate tests from production/Atlas databases unless explicitly configured
  const uri = overrideUri || (process.env.NODE_ENV === "test"
    ? (process.env.TEST_MONGODB_URI || "mongodb://localhost:27017/manuai_test")
    : env.MONGODB_URI);

  const meta = parseMongoUriMetadata(uri);
  mongoDiagnostics = {
    ...meta,
    errorCategory: null,
    errorReason: null,
    lastAttemptAt: new Date().toISOString(),
  };

  // Safety guard: Whenever running in test mode, the test database safety policy
  // MUST execute and CANNOT be bypassed by any conflicting configuration value (e.g. env.NODE_ENV === "production").
  if (isTestMode()) {
    assertSafeTestDatabase(uri);
  }

  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      socketTimeoutMS: 10000,
    });

    // Real database ping to confirm cluster connectivity with finite 3s timeout
    const adminDb = mongoose.connection.db?.admin();
    if (adminDb) {
      await Promise.race([
        adminDb.ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Database ping timed out")), 3000)),
      ]);
    }

    isConnectedToMongo = true;
    mongoDiagnostics.errorCategory = null;
    mongoDiagnostics.errorReason = null;
    const host = mongoose.connection.host || "unknown-host";
    const dbName = mongoose.connection.name || "manuai";
    const isAtlas = host.includes("mongodb.net");

    // Safe connection confirmation without logging connection string, username or password
    console.log(`[MongoDB] Connected successfully! Type: ${isAtlas ? "MongoDB Atlas" : "Local/Standard MongoDB"} | Host: ${host} | Database: ${dbName}`);
    return true;
  } catch (err: unknown) {
    isConnectedToMongo = false;
    isAppInitialized = false;
    const categorized = categorizeMongoError(err, meta);
    mongoDiagnostics.errorCategory = categorized.category;
    mongoDiagnostics.errorReason = categorized.reason;

    const errorMsg = sanitizeMongoMessage(err instanceof Error ? err.message : String(err));
    if (env.NODE_ENV === "production") {
      throw new Error(`[FATAL] Production database connection failed: ${errorMsg}`);
    }

    console.warn(`[MongoDB] Notice: Could not connect to MongoDB (${errorMsg}). Service is reporting unavailable database state.`);
    return false;
  }
}

/**
 * Creates a harmless test record on the connected database, reads it back, and cleans it up
 * to verify write and read persistence without altering application data.
 */
export async function verifyDatabasePersistence(): Promise<{
  success: boolean;
  host: string;
  database: string;
  isAtlas: boolean;
  error?: string;
}> {
  if (!isConnectedToMongo || !mongoose.connection.db) {
    return {
      success: false,
      host: "disconnected",
      database: "disconnected",
      isAtlas: false,
      error: "MongoDB is not connected",
    };
  }

  const host = mongoose.connection.host || "";
  const database = mongoose.connection.name || "";
  const isAtlas = host.includes("mongodb.net");

  try {
    const testSchema = new mongoose.Schema({
      testKey: String,
      verifiedAt: Date,
      purpose: String,
    });
    const PingCollection = mongoose.models["_AtlasVerification"] || mongoose.model("_AtlasVerification", testSchema);

    // 1. Create harmless verification record
    const created = await PingCollection.create({
      testKey: `atlas-check-${Date.now()}`,
      verifiedAt: new Date(),
      purpose: "MAN-U-AI Database Persistence Verification",
    });

    // 2. Read back
    const read = await PingCollection.findById(created._id);
    if (!read || read.testKey !== created.testKey) {
      throw new Error("Persistence verification failed: Record could not be read back from database.");
    }

    // 3. Clean up
    await PingCollection.findByIdAndDelete(created._id);

    return {
      success: true,
      host,
      database,
      isAtlas,
    };
  } catch (err: any) {
    return {
      success: false,
      host,
      database,
      isAtlas,
      error: sanitizeMongoMessage(err?.message || String(err)),
    };
  }
}

