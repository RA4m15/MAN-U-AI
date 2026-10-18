import mongoose from "mongoose";
import { env } from "./env";

export let isConnectedToMongo = false;

/**
 * Sanitizes any MongoDB URI or error string to ensure credentials are never leaked.
 */
export function sanitizeMongoMessage(msg: string): string {
  return msg.replace(/mongodb(\+srv)?:\/\/[^@]+@/gi, "mongodb$1://[REDACTED]@");
}

export async function connectDatabase(overrideUri?: string): Promise<boolean> {
  // Isolate tests from production/Atlas databases unless explicitly configured
  const uri = overrideUri || (process.env.NODE_ENV === "test"
    ? (process.env.TEST_MONGODB_URI || "mongodb://localhost:27017/manuai_test")
    : env.MONGODB_URI);

  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    });

    // Real database ping to confirm cluster connectivity
    const adminDb = mongoose.connection.db?.admin();
    if (adminDb) {
      await adminDb.ping();
    }

    isConnectedToMongo = true;
    const host = mongoose.connection.host || "unknown-host";
    const dbName = mongoose.connection.name || "manuai";
    const isAtlas = host.includes("mongodb.net");

    // Safe connection confirmation without logging connection string, username or password
    console.log(`[MongoDB] Connected successfully! Type: ${isAtlas ? "MongoDB Atlas" : "Local/Standard MongoDB"} | Host: ${host} | Database: ${dbName}`);
    return true;
  } catch (err: unknown) {
    const errorMsg = sanitizeMongoMessage(err instanceof Error ? err.message : String(err));
    if (env.NODE_ENV === "production") {
      throw new Error(`[FATAL] Production database connection failed: ${errorMsg}`);
    }

    console.warn(`[MongoDB] Notice: Could not connect to MongoDB (${errorMsg}). Switching to in-memory active store fallback for development/test.`);
    isConnectedToMongo = false;
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

