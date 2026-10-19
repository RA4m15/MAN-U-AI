import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../src/app";
import { env } from "../src/config/env";
import { connectDatabase, isConnectedToMongo } from "../src/config/database";
import { DocumentModel } from "../src/models";
import { storageService } from "../src/services/storage.service";
import { extractStructuredErrorInfo, logStructuredError } from "../src/utils/errorReporting";

describe("Stage 5.5 — Document Upload Error Observability & Pipeline Diagnostics Suite", () => {
  let engineerToken: string;
  let engineerId: string;
  const validPdfBuffer = Buffer.from("%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\ntrailer\n<<\n>>\n%%EOF");

  beforeAll(async () => {
    await connectDatabase();

    engineerId = "usr-eng-stage55";
    engineerToken = jwt.sign(
      { id: engineerId, email: "engineer.stage55@plant.io", name: "Engineer 5.5", role: "engineer" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );
  });

  afterAll(async () => {
    if (isConnectedToMongo) {
      await DocumentModel.deleteMany({ title: /Stage 5\.5/ });
    }
  });

  it("Requirement 1: extractStructuredErrorInfo handles plain objects without returning [object Object]", () => {
    const plainErrorObj = {
      message: "Invalid API key or secret",
      http_code: 401,
      code: "CLOUDINARY_AUTH_ERROR",
    };

    const info = extractStructuredErrorInfo(plainErrorObj, "storage_upload");
    expect(info.errorName).toBe("StorageProviderError");
    expect(info.errorMessage).toBe("Invalid API key or secret");
    expect(info.sanitizedMessage).toContain("Invalid API key or secret");
    expect(info.sanitizedMessage).not.toContain("[object Object]");
    expect(info.httpStatus).toBe(502); // 401 upstream mapped to 502 Bad Gateway
    expect(info.errorCode).toBe("STORAGE_PROVIDER_AUTH_FAILED");
    expect(info.stage).toBe("storage_upload");
    expect(info.requestId).toMatch(/^req-/);
  });

  it("Requirement 2: extractStructuredErrorInfo sanitizes sensitive secrets from error messages", () => {
    const sensitiveErr = new Error("Failed to connect to mongodb+srv://admin_user:SuperSecretPassword123@cluster0.mongodb.net/manuai with api_key=CLOUDINARY_SECRET_KEY");
    const info = extractStructuredErrorInfo(sensitiveErr, "database_persistence");

    expect(info.sanitizedMessage).not.toContain("SuperSecretPassword123");
    expect(info.sanitizedMessage).not.toContain("CLOUDINARY_SECRET_KEY");
    expect(info.sanitizedMessage).toContain("[REDACTED_USER:PASS]");
    expect(info.sanitizedMessage).toContain("api_key=[REDACTED]");
  });

  it("Requirement 3: logStructuredError safely logs without throwing and includes correlation details", () => {
    const spyError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const info = extractStructuredErrorInfo(new Error("Storage disk write timeout"), "storage_upload");
      logStructuredError(info, { filename: "manual.pdf", sizeBytes: 1024 });

      expect(spyError).toHaveBeenCalled();
      const loggedCall = spyError.mock.calls[0][0];
      expect(loggedCall).toContain("[Upload Pipeline Failure]");
      expect(loggedCall).toContain(info.requestId);
      expect(loggedCall).toContain("storage_upload");
      expect(loggedCall).toContain("Storage disk write timeout");
      expect(loggedCall).toContain("filename=manual.pdf");
    } finally {
      spyError.mockRestore();
    }
  });

  it("Requirement 4: Valid PDF upload succeeds and returns 202 with processing status (not false indexed)", async () => {
    const saveSpy = vi.spyOn(storageService, "saveFile").mockResolvedValueOnce({
      storagePath: "test/stage55-manual.pdf",
      sizeBytes: validPdfBuffer.length,
      storageProvider: "local",
    });

    try {
      const res = await request(app)
        .post("/api/v1/documents/upload")
        .set("Authorization", `Bearer ${engineerToken}`)
        .field("title", "Stage 5.5 Authentic Operations Manual")
        .field("revision", "Rev 1.0")
        .attach("file", validPdfBuffer, "operations_manual.pdf");

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("processing");
      expect(res.body.data.status).not.toBe("indexed");
      expect(res.body.data.id).toBeDefined();
    } finally {
      saveSpy.mockRestore();
    }
  });

  it("Requirement 5: Uploading file without authentic PDF signature returns 400 INVALID_FILE_SIGNATURE", async () => {
    const invalidBuffer = Buffer.from("<html><body>Not a PDF</body></html>");

    const res = await request(app)
      .post("/api/v1/documents/upload")
      .set("Authorization", `Bearer ${engineerToken}`)
      .field("title", "Fake HTML Document")
      .attach("file", invalidBuffer, "fake.pdf");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe("INVALID_FILE_SIGNATURE");
  });

  it("Requirement 6: Storage failure with plain object returns 502 with structured details (never [object Object])", async () => {
    const storagePlainError = {
      message: "Must supply cloud_name or invalid API credentials",
      http_code: 401,
    };
    const saveSpy = vi.spyOn(storageService, "saveFile").mockRejectedValueOnce(storagePlainError);
    const spyError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const res = await request(app)
        .post("/api/v1/documents/upload")
        .set("Authorization", `Bearer ${engineerToken}`)
        .field("title", "Stage 5.5 Cloudinary Test")
        .attach("file", validPdfBuffer, "test_manual.pdf");

      expect(res.status).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("STORAGE_PROVIDER_AUTH_FAILED");
      expect(res.body.error.details).toContain("Must supply cloud_name or invalid API credentials");
      expect(res.body.error.details).not.toContain("[object Object]");
      expect(res.body.error.stage).toBe("storage_upload");
      expect(res.body.error.requestId).toBeDefined();

      // Verify that server log received the structured error
      expect(spyError).toHaveBeenCalled();
      const logContent = spyError.mock.calls.map((c) => c.join(" ")).join("\n");
      expect(logContent).toContain("[Upload Pipeline Failure]");
      expect(logContent).toContain("storage_upload");
      expect(logContent).toContain("Must supply cloud_name or invalid API credentials");
    } finally {
      saveSpy.mockRestore();
      spyError.mockRestore();
    }
  });

  it("Requirement 7: MongoDB persistence failure cleans up stored file and returns 503 DATABASE_PERSISTENCE_FAILED", async () => {
    const saveSpy = vi.spyOn(storageService, "saveFile").mockResolvedValueOnce({
      storagePath: "manuai/documents/temp-to-clean.pdf",
      sizeBytes: validPdfBuffer.length,
      storageProvider: "local",
    });
    const deleteSpy = vi.spyOn(storageService, "deleteFile").mockResolvedValueOnce();
    const createSpy = vi.spyOn(DocumentModel, "create").mockRejectedValueOnce(new Error("Simulated Atlas write error"));
    const spyError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const res = await request(app)
        .post("/api/v1/documents/upload")
        .set("Authorization", `Bearer ${engineerToken}`)
        .field("title", "Stage 5.5 Write Failure Test")
        .attach("file", validPdfBuffer, "cleanup_test.pdf");

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("DATABASE_PERSISTENCE_FAILED");
      expect(res.body.error.stage).toBe("database_persistence");
      expect(res.body.error.requestId).toBeDefined();

      // Verify orphaned file was deleted
      expect(deleteSpy).toHaveBeenCalledWith("manuai/documents/temp-to-clean.pdf", "local");
    } finally {
      saveSpy.mockRestore();
      deleteSpy.mockRestore();
      createSpy.mockRestore();
      spyError.mockRestore();
    }
  });

  it("Requirement 8: Public error responses do not leak internal stack traces or database strings", async () => {
    const errorWithStack = new Error("Failed connecting to cluster0-shard-00-00.mongodb.net:27017");
    const saveSpy = vi.spyOn(storageService, "saveFile").mockRejectedValueOnce(errorWithStack);

    try {
      const res = await request(app)
        .post("/api/v1/documents/upload")
        .set("Authorization", `Bearer ${engineerToken}`)
        .field("title", "Stage 5.5 Secret Leakage Test")
        .attach("file", validPdfBuffer, "leak_test.pdf");

      expect(res.body.error).toBeDefined();
      expect(res.body.error.stack).toBeUndefined();
      const bodyStr = JSON.stringify(res.body);
      expect(bodyStr).not.toContain("cluster0-shard");
      expect(bodyStr).not.toContain(".mongodb.net");
    } finally {
      saveSpy.mockRestore();
    }
  });
});
