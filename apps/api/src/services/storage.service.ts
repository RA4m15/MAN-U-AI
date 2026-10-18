import fs from "fs";
import path from "path";
import https from "https";
import http from "http";
import { URL } from "url";
import { v4 as uuidv4 } from "uuid";
import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";

export type StorageProviderType = "local" | "cloudinary" | "s3" | "gcs";

export interface SaveFileResult {
  storagePath: string;
  sizeBytes: number;
  storageProvider: StorageProviderType;
}

export interface IStorageAdapter {
  saveFile(originalFilename: string, buffer: Buffer): Promise<SaveFileResult>;
  getFileStream(storagePath: string): Promise<NodeJS.ReadableStream> | NodeJS.ReadableStream;
  deleteFile(storagePath: string): Promise<void>;
}

export interface IStorageService {
  saveFile(originalFilename: string, buffer: Buffer): Promise<SaveFileResult>;
  getFileStream(storagePath: string, provider?: string): Promise<NodeJS.ReadableStream>;
  deleteFile(storagePath: string, provider?: string): Promise<void>;
}

export class LocalStorageService implements IStorageAdapter {
  private uploadDir: string;
  private dirInitialized = false;

  constructor() {
    this.uploadDir = path.resolve(process.cwd(), env.STORAGE_LOCAL_PATH);
  }

  private ensureDir(): void {
    if (!this.dirInitialized) {
      if (!fs.existsSync(this.uploadDir)) {
        fs.mkdirSync(this.uploadDir, { recursive: true });
      }
      this.dirInitialized = true;
    }
  }

  async saveFile(originalFilename: string, buffer: Buffer): Promise<SaveFileResult> {
    this.ensureDir();
    const ext = path.extname(originalFilename);
    const safeName = `${uuidv4()}${ext}`;
    const destination = path.join(this.uploadDir, safeName);

    await fs.promises.writeFile(destination, buffer);
    return {
      storagePath: safeName,
      sizeBytes: buffer.length,
      storageProvider: "local",
    };
  }

  getFileStream(storagePath: string): fs.ReadStream {
    this.ensureDir();
    const safeBase = path.basename(storagePath);
    const fullPath = path.resolve(this.uploadDir, safeBase);
    const normalizedUploadDir = path.resolve(this.uploadDir);

    if (!fullPath.startsWith(normalizedUploadDir)) {
      throw new Error("Path traversal violation: file is outside private storage directory");
    }
    if (!fs.existsSync(fullPath)) {
      throw new Error("File not found in private storage");
    }
    return fs.createReadStream(fullPath);
  }

  async deleteFile(storagePath: string): Promise<void> {
    const safeBase = path.basename(storagePath);
    const fullPath = path.resolve(this.uploadDir, safeBase);
    const normalizedUploadDir = path.resolve(this.uploadDir);

    if (!fullPath.startsWith(normalizedUploadDir)) {
      throw new Error("Path traversal violation: file is outside private storage directory");
    }
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
    }
  }
}

export const APPROVED_CLOUDINARY_HOSTS = new Set([
  "res.cloudinary.com",
  "api.cloudinary.com",
]);

export function isAllowedCloudinaryDeliveryHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().trim();

  // Explicit allowed host check
  if (APPROVED_CLOUDINARY_HOSTS.has(normalized)) {
    return true;
  }

  // Check valid subdomain of cloudinary.com (e.g. res-1.cloudinary.com, sub.res.cloudinary.com)
  if (normalized.endsWith(".cloudinary.com") && normalized !== "cloudinary.com") {
    // Reject if subdomain contains private / internal keywords or IP fragments
    if (
      normalized.includes("localhost") ||
      normalized.includes("127.0.0.1") ||
      normalized.includes("169.254.") ||
      normalized.includes("10.") ||
      normalized.includes("192.168.")
    ) {
      return false;
    }
    return true;
  }

  return false;
}

export function validateCloudinaryStreamUrl(urlString: string): URL {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    throw new Error("Invalid Cloudinary download URL");
  }

  // 1. Strict HTTPS restriction - plain HTTP rejected
  if (parsedUrl.protocol !== "https:") {
    throw new Error(`Insecure protocol '${parsedUrl.protocol}' rejected; only HTTPS Cloudinary delivery URLs are permitted.`);
  }

  const hostname = parsedUrl.hostname.toLowerCase().trim();

  // 2. Reject localhost and private / internal IP ranges
  const isPrivateOrLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1" ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("169.254.") ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal");

  if (isPrivateOrLocal) {
    throw new Error(`Access to private or local host '${hostname}' is prohibited.`);
  }

  // 3. Reject unrelated domains or unauthorized hosts
  if (!isAllowedCloudinaryDeliveryHost(hostname)) {
    throw new Error(`Untrusted redirect host '${hostname}' rejected. Only approved Cloudinary delivery domains are permitted.`);
  }

  return parsedUrl;
}

export class CloudinaryStorageService implements IStorageAdapter {
  constructor() {
    if (env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET) {
      cloudinary.config({
        cloud_name: env.CLOUDINARY_CLOUD_NAME,
        api_key: env.CLOUDINARY_API_KEY,
        api_secret: env.CLOUDINARY_API_SECRET,
        secure: true,
      });
    } else if (env.CLOUDINARY_URL) {
      cloudinary.config({
        cloudinary_url: env.CLOUDINARY_URL,
        secure: true,
      });
    }
  }

  async saveFile(originalFilename: string, buffer: Buffer): Promise<SaveFileResult> {
    const ext = path.extname(originalFilename) || ".pdf";
    const uniqueId = uuidv4();
    const filenameWithoutExt = `${uniqueId}${ext}`;

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: "raw",
          type: "authenticated",
          folder: "manuai/documents",
          public_id: filenameWithoutExt,
        },
        (error, result) => {
          if (error || !result) {
            return reject(error || new Error("Cloudinary upload failed with empty result"));
          }
          resolve({
            storagePath: result.public_id,
            sizeBytes: result.bytes || buffer.length,
            storageProvider: "cloudinary",
          });
        }
      );
      uploadStream.end(buffer);
    });
  }

  async getFileStream(storagePath: string): Promise<NodeJS.ReadableStream> {
    const downloadUrl = cloudinary.utils.private_download_url(storagePath, "", {
      resource_type: "raw",
      type: "authenticated",
      expires_at: Math.floor(Date.now() / 1000) + 3600,
    });

    return new Promise((resolve, reject) => {
      let activeRequest: http.ClientRequest | null = null;
      let settled = false;

      const safeReject = (err: Error) => {
        if (!settled) {
          settled = true;
          if (activeRequest) {
            try {
              activeRequest.destroy();
            } catch {
              // ignore
            }
          }
          reject(err);
        }
      };

      const fetchWithRedirects = (currentUrl: string, redirectsLeft = 3) => {
        let parsedUrl: URL;
        try {
          parsedUrl = validateCloudinaryStreamUrl(currentUrl);
        } catch (validationErr: any) {
          return safeReject(validationErr);
        }

        const requestOptions: https.RequestOptions = {
          protocol: parsedUrl.protocol,
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 443,
          path: `${parsedUrl.pathname}${parsedUrl.search}`,
          method: "GET",
          headers: {
            "User-Agent": "MAN-U-AI-StorageService/1.0",
          },
          timeout: 10000, // 10s connection & socket timeout
        };

        const request = https.get(requestOptions, (response) => {
          // Handle redirects
          if (
            response.statusCode &&
            response.statusCode >= 300 &&
            response.statusCode < 400 &&
            response.headers.location
          ) {
            response.resume(); // drain response body to release socket
            if (redirectsLeft <= 0) {
              return safeReject(new Error("Too many redirects fetching Cloudinary asset"));
            }
            try {
              // Resolve relative or absolute redirect location against current URL
              const nextUrl = new URL(response.headers.location, currentUrl).href;
              return fetchWithRedirects(nextUrl, redirectsLeft - 1);
            } catch (urlErr: any) {
              return safeReject(urlErr);
            }
          }

          if (response.statusCode && (response.statusCode < 200 || response.statusCode >= 300)) {
            response.resume(); // drain response body to release socket
            return safeReject(new Error(`Failed to fetch file from Cloudinary (HTTP ${response.statusCode})`));
          }

          if (!settled) {
            settled = true;
            resolve(response);
          }
        });

        activeRequest = request;

        request.on("timeout", () => {
          request.destroy(new Error("Cloudinary file stream connection timed out"));
        });

        request.on("error", (err) => {
          safeReject(err);
        });
      };

      fetchWithRedirects(downloadUrl);
    });
  }

  async deleteFile(storagePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(
        storagePath,
        { resource_type: "raw", type: "authenticated" },
        (error, result) => {
          if (error) {
            return reject(error);
          }
          resolve();
        }
      );
    });
  }
}

export class StorageServiceFacade implements IStorageService {
  private localAdapter?: LocalStorageService;
  private cloudinaryAdapter?: CloudinaryStorageService;

  constructor(private activeProvider: StorageProviderType) {
    if (activeProvider === "cloudinary") {
      this.cloudinaryAdapter = new CloudinaryStorageService();
    } else if (activeProvider === "local") {
      this.localAdapter = new LocalStorageService();
    }
  }

  public getLocalAdapter(): LocalStorageService {
    if (!this.localAdapter) {
      this.localAdapter = new LocalStorageService();
    }
    return this.localAdapter;
  }

  public getCloudinaryAdapter(): CloudinaryStorageService {
    if (!this.cloudinaryAdapter) {
      this.cloudinaryAdapter = new CloudinaryStorageService();
    }
    return this.cloudinaryAdapter;
  }

  private resolveAdapter(provider?: string, storagePath?: string): IStorageAdapter {
    if (provider === "cloudinary") {
      return this.getCloudinaryAdapter();
    }
    if (provider === "local") {
      return this.getLocalAdapter();
    }
    // Backward compatibility inference if provider is omitted:
    if (storagePath && storagePath.startsWith("manuai/")) {
      return this.getCloudinaryAdapter();
    }
    if (this.activeProvider === "cloudinary") {
      return this.getCloudinaryAdapter();
    }
    return this.getLocalAdapter();
  }

  async saveFile(originalFilename: string, buffer: Buffer): Promise<SaveFileResult> {
    const adapter = this.resolveAdapter(this.activeProvider);
    return adapter.saveFile(originalFilename, buffer);
  }

  async getFileStream(storagePath: string, provider?: string): Promise<NodeJS.ReadableStream> {
    const adapter = this.resolveAdapter(provider, storagePath);
    return adapter.getFileStream(storagePath);
  }

  async deleteFile(storagePath: string, provider?: string): Promise<void> {
    const adapter = this.resolveAdapter(provider, storagePath);
    return adapter.deleteFile(storagePath);
  }
}

export const storageService: IStorageService = new StorageServiceFacade(
  env.STORAGE_PROVIDER as StorageProviderType
);
