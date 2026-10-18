import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { Readable, PassThrough } from "stream";
import fs from "fs";
import path from "path";
import { v2 as cloudinary } from "cloudinary";
import https from "https";
import { app } from "../src/app";
import { env } from "../src/config/env";
import { connectDatabase, isConnectedToMongo } from "../src/config/database";
import { DocumentModel, DocumentPermission } from "../src/models";
import { toMongoObjectId } from "../src/routes/documents.routes";
import {
  storageService,
  StorageServiceFacade,
  LocalStorageService,
  CloudinaryStorageService,
  validateCloudinaryStreamUrl,
  isAllowedCloudinaryDeliveryHost,
} from "../src/services/storage.service";

describe("Cloudinary Persistent Storage Integration & Security Suite", () => {
  let adminToken: string;
  let engineerToken: string;
  let unauthorizedToken: string;
  let adminId: string;
  let engineerId: string;
  let unauthorizedId: string;

  beforeAll(async () => {
    await connectDatabase();

    adminId = "usr-admin-storage-root";
    engineerId = "usr-engineer-storage-1";
    unauthorizedId = "usr-unauth-storage-2";

    adminToken = jwt.sign(
      { id: adminId, email: "admin.storage@plant.io", name: "Admin Storage", role: "admin" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    engineerToken = jwt.sign(
      { id: engineerId, email: "engineer.storage@plant.io", name: "Engineer Storage", role: "engineer" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    unauthorizedToken = jwt.sign(
      { id: unauthorizedId, email: "viewer.storage@plant.io", name: "Viewer Storage", role: "viewer" },
      env.JWT_SECRET,
      { expiresIn: "1h" }
    );
  });

  afterAll(async () => {
    if (isConnectedToMongo) {
      await DocumentModel.deleteMany({ title: /Storage Test/ });
    }
  });

  // ── 1. Absence of local-directory creation in Cloudinary mode ───────────────
  it("Requirement 1: Cloudinary mode does not construct LocalStorageService or create local directories", () => {
    const mkdirSpy = vi.spyOn(fs, "mkdirSync");

    try {
      // Construct facade configured with cloudinary provider
      const facade = new StorageServiceFacade("cloudinary");

      // Verify LocalStorageService is not eagerly instantiated
      expect((facade as any).localAdapter).toBeUndefined();
      expect((facade as any).cloudinaryAdapter).toBeDefined();

      // Ensure no directory creation occurred
      expect(mkdirSpy).not.toHaveBeenCalled();
    } finally {
      mkdirSpy.mockRestore();
    }
  });

  it("Requirement 1b: LocalStorageService constructor does not eagerly create directories", () => {
    const mkdirSpy = vi.spyOn(fs, "mkdirSync");

    try {
      // Even if LocalStorageService constructor is called, dir creation is lazy
      const local = new LocalStorageService();
      expect((local as any).dirInitialized).toBe(false);
      expect(mkdirSpy).not.toHaveBeenCalled();
    } finally {
      mkdirSpy.mockRestore();
    }
  });

  // ── 2. Cloudinary Upload Success & Metadata Persistence ────────────────────
  it("Requirement 2: Uploads PDF to Cloudinary as raw/authenticated asset and stores public_id and provider in MongoDB", async () => {
    const fakePublicId = "manuai/documents/c7b2a1e0-test-uuid.pdf";
    const samplePdfBuffer = Buffer.from("%PDF-1.4\nIndustrial Turbine Calibration Guide Test");

    // Mock Cloudinary upload_stream with a PassThrough stream
    const uploadStreamSpy = vi
      .spyOn(cloudinary.uploader, "upload_stream")
      .mockImplementation((options: any, callback?: any) => {
        expect(options.resource_type).toBe("raw");
        expect(options.type).toBe("authenticated");
        expect(options.folder).toBe("manuai/documents");

        const passThrough = new PassThrough();
        passThrough.on("finish", () => {
          if (callback) {
            callback(null, {
              public_id: fakePublicId,
              bytes: samplePdfBuffer.length,
              resource_type: "raw",
              type: "authenticated",
              format: "pdf",
              secure_url: `https://res.cloudinary.com/test/raw/authenticated/v1/${fakePublicId}`,
            });
          }
        });
        return passThrough as any;
      });

    // Temporarily switch activeProvider to cloudinary on facade
    const originalProvider = (storageService as any).activeProvider;
    (storageService as any).activeProvider = "cloudinary";

    try {
      const res = await request(app)
        .post("/api/v1/documents/upload")
        .set("Authorization", `Bearer ${engineerToken}`)
        .field("title", "Storage Test Turbine Manual")
        .field("revision", "Rev 2.1")
        .attach("file", samplePdfBuffer, "Turbine_Manual.pdf");

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      const docId = res.body.data.id;
      expect(docId).toBeDefined();

      // Verify MongoDB document record
      const doc = await DocumentModel.findById(docId);
      expect(doc).not.toBeNull();
      expect(doc!.storagePath).toBe(fakePublicId);
      expect(doc!.storageProvider).toBe("cloudinary");
      // Must not store a public URL as storagePath
      expect(doc!.storagePath.startsWith("http")).toBe(false);
      expect(doc!.sizeBytes).toBe(samplePdfBuffer.length);
      expect(uploadStreamSpy).toHaveBeenCalled();
    } finally {
      uploadStreamSpy.mockRestore();
      (storageService as any).activeProvider = originalProvider;
    }
  });

  // ── 3. Partial Failure Cleanup on Metadata Failure ──────────────────────────
  it("Requirement 3: Cleans up Cloudinary asset if MongoDB metadata persistence fails", async () => {
    const fakePublicId = "manuai/documents/orphan-to-delete.pdf";
    const samplePdfBuffer = Buffer.from("%PDF-1.4\nOrphaned Document Content Test");

    const uploadStreamSpy = vi
      .spyOn(cloudinary.uploader, "upload_stream")
      .mockImplementation((options: any, callback?: any) => {
        const passThrough = new PassThrough();
        passThrough.on("finish", () => {
          if (callback) {
            callback(null, {
              public_id: fakePublicId,
              bytes: samplePdfBuffer.length,
              resource_type: "raw",
              type: "authenticated",
            });
          }
        });
        return passThrough as any;
      });

    const destroySpy = vi
      .spyOn(cloudinary.uploader, "destroy")
      .mockImplementation((publicId: string, options: any, callback?: any) => {
        expect(publicId).toBe(fakePublicId);
        expect(options.resource_type).toBe("raw");
        expect(options.type).toBe("authenticated");
        if (callback) callback(null, { result: "ok" });
        return Promise.resolve({ result: "ok" }) as any;
      });

    // Mock DocumentModel.create to simulate database failure
    const createSpy = vi.spyOn(DocumentModel, "create").mockRejectedValueOnce(new Error("Simulated Atlas timeout"));

    const originalProvider = (storageService as any).activeProvider;
    (storageService as any).activeProvider = "cloudinary";

    try {
      const res = await request(app)
        .post("/api/v1/documents/upload")
        .set("Authorization", `Bearer ${engineerToken}`)
        .field("title", "Storage Test Fail Orphan")
        .attach("file", samplePdfBuffer, "Orphan_Manual.pdf");

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("DATABASE_PERSISTENCE_FAILED");

      // Verify Cloudinary destroy was invoked to clean up orphaned raw asset
      expect(destroySpy).toHaveBeenCalledWith(
        fakePublicId,
        expect.objectContaining({ resource_type: "raw", type: "authenticated" }),
        expect.any(Function)
      );

      // Verify no document record exists in MongoDB
      const doc = await DocumentModel.findOne({ title: "Storage Test Fail Orphan" });
      expect(doc).toBeNull();
    } finally {
      uploadStreamSpy.mockRestore();
      destroySpy.mockRestore();
      createSpy.mockRestore();
      (storageService as any).activeProvider = originalProvider;
    }
  });

  // ── 4. Authorized PDF Download via Server-Side Stream ───────────────────────
  it("Requirement 4: Authorized users download Cloudinary document via authenticated server stream", async () => {
    const fakePublicId = "manuai/documents/authorized-doc.pdf";
    const manualContent = "%PDF-1.4\nConfidential Plant Blueprint 2026";

    // Create document in database
    const doc = await DocumentModel.create({
      title: "Storage Test Confidential Blueprint",
      revision: "v1.0",
      filename: "blueprint.pdf",
      storagePath: fakePublicId,
      storageProvider: "cloudinary",
      mimeType: "application/pdf",
      sizeBytes: manualContent.length,
      status: "indexed",
      uploadedById: toMongoObjectId(engineerId),
    });

    const privateDownloadUrlSpy = vi
      .spyOn(cloudinary.utils, "private_download_url")
      .mockReturnValue("https://api.cloudinary.com/v1_1/test/raw/download?signature=fake123");

    // Mock https.get for Cloudinary download
    const httpsGetSpy = vi.spyOn(https, "get").mockImplementation((url: any, cb?: any) => {
      const mockStream = new Readable({
        read() {
          this.push(Buffer.from(manualContent));
          this.push(null);
        },
      });
      (mockStream as any).statusCode = 200;
      (mockStream as any).headers = { "content-type": "application/pdf" };
      if (cb) cb(mockStream);
      return mockStream as any;
    });

    try {
      // Engineer (uploader) accesses document file
      const res = await request(app)
        .get(`/api/v1/documents/${doc._id}/file`)
        .set("Authorization", `Bearer ${engineerToken}`)
        .buffer(true);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/pdf");
      expect(res.headers["content-disposition"]).toContain('filename="blueprint.pdf"');
      const receivedContent = res.text || (res.body ? res.body.toString() : "");
      expect(receivedContent).toBe(manualContent);
      expect(privateDownloadUrlSpy).toHaveBeenCalledWith(
        fakePublicId,
        "",
        expect.objectContaining({ resource_type: "raw", type: "authenticated" })
      );
    } finally {
      privateDownloadUrlSpy.mockRestore();
      httpsGetSpy.mockRestore();
      await DocumentModel.findByIdAndDelete(doc._id);
    }
  });

  // ── 5. Unauthorized Download Rejection ───────────────────────────────────────
  it("Requirement 5: Rejects unauthorized download attempts (401/403) without contacting Cloudinary", async () => {
    const fakePublicId = "manuai/documents/unauthorized-probe.pdf";
    const doc = await DocumentModel.create({
      title: "Storage Test Restricted Specs",
      revision: "v1.0",
      filename: "restricted.pdf",
      storagePath: fakePublicId,
      storageProvider: "cloudinary",
      mimeType: "application/pdf",
      sizeBytes: 100,
      status: "indexed",
      uploadedById: toMongoObjectId(engineerId),
    });

    const privateDownloadUrlSpy = vi.spyOn(cloudinary.utils, "private_download_url");
    const httpsGetSpy = vi.spyOn(https, "get");

    try {
      // 1. Unauthenticated request (no token) -> 401
      const noAuthRes = await request(app).get(`/api/v1/documents/${doc._id}/file`);
      expect(noAuthRes.status).toBe(401);

      // 2. Unauthorized viewer (not owner, not admin, no permission) -> 403
      const forbiddenRes = await request(app)
        .get(`/api/v1/documents/${doc._id}/file`)
        .set("Authorization", `Bearer ${unauthorizedToken}`);
      expect(forbiddenRes.status).toBe(403);
      expect(forbiddenRes.body.error.code).toBe("FORBIDDEN");

      // Verify Cloudinary was never contacted
      expect(privateDownloadUrlSpy).not.toHaveBeenCalled();
      expect(httpsGetSpy).not.toHaveBeenCalled();
    } finally {
      privateDownloadUrlSpy.mockRestore();
      httpsGetSpy.mockRestore();
      await DocumentModel.findByIdAndDelete(doc._id);
    }
  });

  // ── 6. Backward Compatibility with Local Storage Records ─────────────────────
  it("Requirement 6: Seamlessly retrieves existing local storage documents", async () => {
    const localDir = path.resolve(process.cwd(), env.STORAGE_LOCAL_PATH);
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    const testLocalFilename = "compat_test_manual.pdf";
    const testLocalPath = path.join(localDir, testLocalFilename);
    const localContent = "%PDF-1.4\nLegacy Local Disk Storage Content";
    fs.writeFileSync(testLocalPath, localContent);

    const doc = await DocumentModel.create({
      title: "Storage Test Legacy Local Manual",
      revision: "v1.0",
      filename: "legacy_manual.pdf",
      storagePath: testLocalFilename,
      storageProvider: "local",
      mimeType: "application/pdf",
      sizeBytes: localContent.length,
      status: "indexed",
      uploadedById: toMongoObjectId(adminId),
    });

    try {
      const res = await request(app)
        .get(`/api/v1/documents/${doc._id}/file`)
        .set("Authorization", `Bearer ${adminToken}`)
        .buffer(true);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/pdf");
      const receivedContent = res.text || (res.body ? res.body.toString() : "");
      expect(receivedContent).toBe(localContent);
    } finally {
      await DocumentModel.findByIdAndDelete(doc._id);
      if (fs.existsSync(testLocalPath)) {
        fs.unlinkSync(testLocalPath);
      }
    }
  });

  // ── 7. Cloudinary Hardened Download Streaming Security (Stage 4.1) ─────────────
  describe("7. Hardened Cloudinary Download Streaming Security (Stage 4.1)", () => {
    it("validates and allows approved Cloudinary delivery hostnames via HTTPS", () => {
      const allowedUrls = [
        "https://res.cloudinary.com/test-cloud/raw/upload/manuai/documents/sample.pdf",
        "https://api.cloudinary.com/v1_1/test-cloud/resources/raw",
        "https://res-1.cloudinary.com/test-cloud/image/upload/s--xyz--/sample.pdf",
      ];

      for (const url of allowedUrls) {
        const parsed = validateCloudinaryStreamUrl(url);
        expect(parsed.protocol).toBe("https:");
        expect(isAllowedCloudinaryDeliveryHost(parsed.hostname)).toBe(true);
      }
    });

    it("rejects plain HTTP URLs unconditionally", () => {
      expect(() => {
        validateCloudinaryStreamUrl("http://res.cloudinary.com/test-cloud/raw/upload/sample.pdf");
      }).toThrow(/Insecure protocol 'http:' rejected/);
    });

    it("rejects localhost and loopback redirect targets", () => {
      const localUrls = [
        "https://localhost/etc/passwd",
        "https://127.0.0.1:8080/secret",
        "https://0.0.0.0/keys",
      ];

      for (const url of localUrls) {
        expect(() => validateCloudinaryStreamUrl(url)).toThrow(/Access to private or local host/);
      }
    });

    it("rejects private, internal, and cloud metadata IP ranges", () => {
      const internalUrls = [
        "https://169.254.169.254/latest/meta-data/iam/security-credentials",
        "https://10.0.1.50:8443/internal/backup.pdf",
        "https://192.168.1.1/router/config",
        "https://172.16.0.5/secrets",
      ];

      for (const url of internalUrls) {
        expect(() => validateCloudinaryStreamUrl(url)).toThrow(/Access to private or local host/);
      }
    });

    it("rejects unrelated or unauthorized domains", () => {
      const evilUrls = [
        "https://evil-attacker.com/malicious.pdf",
        "https://example.com/document.pdf",
        "https://cloudinary.com/homepage", // apex domain is not a media host
      ];

      for (const url of evilUrls) {
        expect(() => validateCloudinaryStreamUrl(url)).toThrow(/Untrusted redirect host/);
      }
    });

    it("getFileStream safely rejects unauthorized redirect targets and drains response", async () => {
      const cloudinaryAdapter = new CloudinaryStorageService();

      const downloadUrlSpy = vi.spyOn(cloudinary.utils, "private_download_url").mockReturnValue(
        "https://res.cloudinary.com/test-cloud/raw/upload/initial.pdf"
      );

      // Simulate a redirect to evil.com
      const mockRedirectResponse: any = new PassThrough();
      mockRedirectResponse.statusCode = 302;
      mockRedirectResponse.headers = {
        location: "https://evil.com/exfiltrated.pdf",
      };

      const httpsGetSpy = vi.spyOn(https, "get").mockImplementation(((options: any, callback: any) => {
        callback(mockRedirectResponse);
        return {
          on: vi.fn().mockReturnThis(),
          setTimeout: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
        } as any;
      }) as any);

      try {
        await expect(cloudinaryAdapter.getFileStream("manuai/documents/test.pdf")).rejects.toThrow(
          /Untrusted redirect host 'evil.com' rejected/
        );
      } finally {
        downloadUrlSpy.mockRestore();
        httpsGetSpy.mockRestore();
      }
    });

    it("getFileStream safely rejects plain HTTP redirects", async () => {
      const cloudinaryAdapter = new CloudinaryStorageService();

      const downloadUrlSpy = vi.spyOn(cloudinary.utils, "private_download_url").mockReturnValue(
        "https://res.cloudinary.com/test-cloud/raw/upload/initial.pdf"
      );

      const mockRedirectResponse: any = new PassThrough();
      mockRedirectResponse.statusCode = 302;
      mockRedirectResponse.headers = {
        location: "http://res.cloudinary.com/test-cloud/raw/upload/insecure.pdf",
      };

      const httpsGetSpy = vi.spyOn(https, "get").mockImplementation(((options: any, callback: any) => {
        callback(mockRedirectResponse);
        return {
          on: vi.fn().mockReturnThis(),
          setTimeout: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
        } as any;
      }) as any);

      try {
        await expect(cloudinaryAdapter.getFileStream("manuai/documents/test.pdf")).rejects.toThrow(
          /Insecure protocol 'http:' rejected/
        );
      } finally {
        downloadUrlSpy.mockRestore();
        httpsGetSpy.mockRestore();
      }
    });

    it("getFileStream handles connection timeout cleanly by destroying request", async () => {
      const cloudinaryAdapter = new CloudinaryStorageService();

      const downloadUrlSpy = vi.spyOn(cloudinary.utils, "private_download_url").mockReturnValue(
        "https://res.cloudinary.com/test-cloud/raw/upload/initial.pdf"
      );

      let timeoutHandler: (() => void) | undefined;
      const destroyMock = vi.fn();

      const mockReq = {
        on: vi.fn((event: string, handler: any) => {
          if (event === "timeout") timeoutHandler = handler;
          return mockReq;
        }),
        setTimeout: vi.fn().mockReturnThis(),
        destroy: destroyMock,
      };

      const httpsGetSpy = vi.spyOn(https, "get").mockImplementation((() => {
        return mockReq as any;
      }) as any);

      try {
        const streamPromise = cloudinaryAdapter.getFileStream("manuai/documents/test.pdf");

        // Trigger the registered timeout callback
        expect(timeoutHandler).toBeDefined();
        timeoutHandler!();

        expect(destroyMock).toHaveBeenCalledWith(expect.any(Error));
      } finally {
        downloadUrlSpy.mockRestore();
        httpsGetSpy.mockRestore();
      }
    });

    it("getFileStream rejects non-200 responses and drains the socket response", async () => {
      const cloudinaryAdapter = new CloudinaryStorageService();

      const downloadUrlSpy = vi.spyOn(cloudinary.utils, "private_download_url").mockReturnValue(
        "https://res.cloudinary.com/test-cloud/raw/upload/missing.pdf"
      );

      const mockNotFoundResponse: any = new PassThrough();
      mockNotFoundResponse.statusCode = 404;
      const resumeSpy = vi.spyOn(mockNotFoundResponse, "resume");

      const httpsGetSpy = vi.spyOn(https, "get").mockImplementation(((options: any, callback: any) => {
        callback(mockNotFoundResponse);
        return {
          on: vi.fn().mockReturnThis(),
          setTimeout: vi.fn().mockReturnThis(),
          destroy: vi.fn(),
        } as any;
      }) as any);

      try {
        await expect(cloudinaryAdapter.getFileStream("manuai/documents/missing.pdf")).rejects.toThrow(
          /Failed to fetch file from Cloudinary \(HTTP 404\)/
        );
        expect(resumeSpy).toHaveBeenCalled();
      } finally {
        downloadUrlSpy.mockRestore();
        httpsGetSpy.mockRestore();
      }
    });
  });
});
