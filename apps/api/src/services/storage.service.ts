import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { env } from "../config/env";

export interface IStorageService {
  saveFile(originalFilename: string, buffer: Buffer): Promise<{ storagePath: string; sizeBytes: number }>;
  getFileStream(storagePath: string): fs.ReadStream;
  deleteFile(storagePath: string): Promise<void>;
}

class LocalStorageService implements IStorageService {
  private uploadDir: string;

  constructor() {
    this.uploadDir = path.resolve(process.cwd(), env.STORAGE_LOCAL_PATH);
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async saveFile(originalFilename: string, buffer: Buffer): Promise<{ storagePath: string; sizeBytes: number }> {
    const ext = path.extname(originalFilename);
    const safeName = `${uuidv4()}${ext}`;
    const destination = path.join(this.uploadDir, safeName);

    await fs.promises.writeFile(destination, buffer);
    return {
      storagePath: safeName,
      sizeBytes: buffer.length,
    };
  }

  getFileStream(storagePath: string): fs.ReadStream {
    const fullPath = path.join(this.uploadDir, path.basename(storagePath));
    if (!fs.existsSync(fullPath)) {
      throw new Error("File not found in private storage");
    }
    return fs.createReadStream(fullPath);
  }

  async deleteFile(storagePath: string): Promise<void> {
    const fullPath = path.join(this.uploadDir, path.basename(storagePath));
    if (fs.existsSync(fullPath)) {
      await fs.promises.unlink(fullPath);
    }
  }
}

export const storageService: IStorageService = new LocalStorageService();
