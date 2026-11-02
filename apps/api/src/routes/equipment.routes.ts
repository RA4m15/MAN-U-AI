import multer from "multer";
import path from "path";
import fs from "fs";
import { Router, Request, Response } from "express";
import mongoose from "mongoose";
import { Equipment } from "../models";
import { isConnectedToMongo } from "../config/database";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middlewares/auth";
import { CreateEquipmentSchema, SyncCheckSchema } from "@man-u-ai/shared";
import { offlineService } from "../services/offline.service";

export const equipmentRouter: Router = Router();

// GET / - List all equipment records
equipmentRouter.get("/", requireAuth, async (req: Request, res: Response) => {
  if (!isConnectedToMongo) {
    const isOfflineAuthPermitted =
      process.env.NODE_ENV !== "production" &&
      process.env.ALLOW_OFFLINE_AUTH === "true";
    if (isOfflineAuthPermitted) {
      const offlineEquipment = [
        {
          id: "machine_001",
          name: "Industrial Turbomachinery Assembly",
          type: "Industrial rotating equipment",
          category: "Industrial rotating equipment",
          referenceImage: "assets/images/machines/machine_turbomachinery.jpg",
          cadModel: { available: false, format: null, storageReference: null, version: null },
          documentIds: ["doc-01", "doc-slurry-pump"],
          status: "operational",
        },
        {
          id: "machine_002",
          name: "CAT Generator Set",
          type: "Power generation equipment",
          category: "Power generation equipment",
          referenceImage: "assets/images/machines/machine_cat_generator.jpg",
          cadModel: { available: false, format: null, storageReference: null, version: null },
          documentIds: [],
          status: "operational",
        },
        {
          id: "machine_003",
          name: "Industrial Process Equipment Skid",
          type: "Industrial process equipment",
          category: "Industrial process equipment",
          referenceImage: "assets/images/machines/machine_process_skid.jpg",
          cadModel: { available: false, format: null, storageReference: null, version: null },
          documentIds: [],
          status: "operational",
        },
        {
          id: "machine_004",
          name: "CNC Machining Center",
          type: "Manufacturing equipment",
          category: "Manufacturing equipment",
          referenceImage: "assets/images/machines/machine_cnc_center.jpg",
          cadModel: { available: false, format: null, storageReference: null, version: null },
          documentIds: [],
          status: "operational",
        },
        {
          id: "equip-drypix-6000",
          name: "Fuji Medical Dry Laser Imager DRYPIX Smart",
          type: "Dry Laser Imager",
          model: "DRYPIX Smart (DRYPIX 6000)",
          manufacturer: "FUJIFILM Corporation",
          serialNumber: "FX-6000-897N",
          location: "Imaging Suite 2 - Radiology",
          documentIds: ["doc-drypix-6000"],
          status: "operational",
          telemetryConfig: {
            connected: true,
            temperature: 42.5,
            vibrationRms: 0.18,
            healthScore: 98,
          },
          runtimeHours: 1420,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "equip-cb-a61",
          name: "Conveyor Belt A61",
          type: "Modular Belt Conveyor",
          model: "A61-SIMREADY-01",
          manufacturer: "SimReady Systems",
          serialNumber: "SR-CB-A61-2024",
          location: "Packaging & Sortation Line 1",
          cadModel: {
            available: true,
            format: "step",
            storageReference: "conveyor_belt_a61.step",
            version: "v1.0",
          },
          documentIds: ["doc-conveyor-a61"],
          status: "operational",
          telemetryConfig: {
            connected: true,
            temperature: 58.2,
            vibrationRms: 1.45,
            healthScore: 94,
          },
          runtimeHours: 2850,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "equip-p102",
          name: "Centrifugal Slurry Pump P-102",
          type: "Centrifugal Pump",
          model: "SP-400 Heavy Duty",
          manufacturer: "Flowserve",
          serialNumber: "FS-2023-9981",
          location: "Line 1 - Slurry Preparation",
          cadModel: {
            available: true,
            format: "step",
            storageReference: "slurry_pump_p102.step",
            version: "v1.0",
          },
          documentIds: ["doc-slurry-pump"],
          status: "operational",
          telemetryConfig: {
            connected: true,
            temperature: 64.0,
            vibrationRms: 2.10,
            healthScore: 89,
          },
          runtimeHours: 4120,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "equip-hp400",
          name: "Hydraulic Stamping Press HP-400",
          type: "Hydraulic Press",
          model: "Schuler 400-T",
          manufacturer: "Schuler Pressen",
          serialNumber: "SC-400-091",
          location: "Line 3 - Main Fabrication",
          documentIds: ["doc-sop-loto"],
          status: "warning",
          telemetryConfig: {
            connected: true,
            temperature: 71.5,
            vibrationRms: 3.25,
            healthScore: 78,
          },
          runtimeHours: 6400,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "equip-ac300",
          name: "Rotary Screw Air Compressor AC-300",
          type: "Air Compressor",
          model: "Atlas Copco GA-90+",
          manufacturer: "Atlas Copco",
          serialNumber: "AC-8812-B",
          location: "Utility Room B",
          documentIds: ["doc-rotary-compressor"],
          status: "operational",
          telemetryConfig: {
            connected: true,
            temperature: 52.0,
            vibrationRms: 1.10,
            healthScore: 96,
          },
          runtimeHours: 3200,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      return res.json({ success: true, data: offlineEquipment });
    }
    return res.status(503).json({
      success: false,
      error: { code: "SERVICE_UNAVAILABLE", message: "Database connection unavailable for equipment listing" },
    });
  }

  try {
    const items = await Equipment.find().sort({ createdAt: -1 });
    return res.json({
      success: true,
      data: items.map((eq) => ({
        id: eq._id.toString(),
        name: eq.name,
        type: eq.type,
        model: eq.model,
        manufacturer: eq.manufacturer,
        serialNumber: eq.serialNumber,
        location: eq.location,
        documentIds: eq.documentIds,
        createdAt: eq.createdAt ? eq.createdAt.toISOString() : null,
        updatedAt: eq.updatedAt ? eq.updatedAt.toISOString() : null,
      })),
    });
  } catch (err) {
    console.error("[Equipment] Mongo query failed:", err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to retrieve equipment from database" },
    });
  }
});

// GET /:id/offline-pack - Download offline Area Pack (documents, chunks, figures)
equipmentRouter.get("/:id/offline-pack", requireAuth, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  try {
    const pack = await offlineService.getAreaPack(id);
    if (!pack) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: `Equipment with ID ${id} was not found.` },
      });
    }

    return res.json({
      success: true,
      data: pack,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: "OFFLINE_PACK_ERROR", message: err.message },
    });
  }
});

// POST /:id/sync-check - Verify offline cache validity against latest revisions
equipmentRouter.post("/:id/sync-check", requireAuth, async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const parseResult = SyncCheckSchema.safeParse({ ...req.body, equipmentId: id });
  if (!parseResult.success) {
    return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid sync check payload" },
    });
  }

  try {
    const syncResult = await offlineService.checkSync(parseResult.data);
    return res.json({
      success: true,
      data: syncResult,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: "SYNC_CHECK_ERROR", message: err.message },
    });
  }
});

// GET /:id - Get single equipment record by ID
equipmentRouter.get("/:id", requireAuth, async (req: Request, res: Response) => {
  const id = String(req.params.id);

  if (!isConnectedToMongo) {
    return res.status(503).json({
      success: false,
      error: { code: "SERVICE_UNAVAILABLE", message: "Database connection unavailable for equipment retrieval" },
    });
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Equipment not found" },
    });
  }

  try {
    const eq = await Equipment.findById(id).populate("documentIds");
    if (!eq) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Equipment not found" },
      });
    }

    return res.json({
      success: true,
      data: {
        id: eq._id.toString(),
        name: eq.name,
        type: eq.type,
        model: eq.model,
        manufacturer: eq.manufacturer,
        serialNumber: eq.serialNumber,
        location: eq.location,
        documentIds: eq.documentIds,
        createdAt: eq.createdAt ? eq.createdAt.toISOString() : null,
        updatedAt: eq.updatedAt ? eq.updatedAt.toISOString() : null,
      },
    });
  } catch (err) {
    console.error("[Equipment] Find error:", err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to query equipment record" },
    });
  }
});

// POST / - Create equipment record (Admin or Engineer only)
equipmentRouter.post(
  "/",
  requireAuth,
  requireRole(["admin", "engineer", "manager"]),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = CreateEquipmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid equipment format", details: parsed.error.issues },
      });
    }

    if (!isConnectedToMongo) {
      return res.status(503).json({
        success: false,
        error: { code: "SERVICE_UNAVAILABLE", message: "Database connection unavailable for equipment registration" },
      });
    }

    try {
      const created = await Equipment.create(parsed.data);
      return res.status(201).json({
        success: true,
        data: {
          id: created._id.toString(),
          ...parsed.data,
          createdAt: created.createdAt ? created.createdAt.toISOString() : null,
        },
      });
    } catch (err) {
      console.error("[Equipment] Mongo save failed:", err);
      return res.status(500).json({
        success: false,
        error: { code: "DATABASE_WRITE_FAILED", message: "Failed to persist equipment record to database" },
      });
    }
  }
);

// DELETE /:id - Delete equipment record (Admin or Engineer only)
equipmentRouter.delete(
  "/:id",
  requireAuth,
  requireRole(["admin", "engineer", "manager"]),
  async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params.id);

    if (!isConnectedToMongo) {
      return res.status(503).json({
        success: false,
        error: { code: "SERVICE_UNAVAILABLE", message: "Database connection unavailable for equipment deletion" },
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Equipment not found" },
      });
    }

    try {
      const deleted = await Equipment.findByIdAndDelete(id);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Equipment not found" },
        });
      }

      return res.json({
        success: true,
        data: { message: "Equipment removed successfully" },
      });
    } catch (err) {
      console.error("[Equipment] Delete error:", err);
      return res.status(500).json({
        success: false,
        error: { code: "SERVER_ERROR", message: "Failed to delete equipment record" },
      });
    }
  }
);

// ─── CAD Model Storage & Upload Endpoints (Part 5) ──────────────────────────

const ALLOWED_CAD_EXTENSIONS = new Set([".step", ".stp", ".iges", ".igs", ".brep"]);
const MAX_CAD_FILE_SIZE = 90 * 1024 * 1024; // 90 MB max (aligned with frontend WebAssembly / Emscripten heap threshold)

const inMemoryCadStorage = new Map<string, any>([
  [
    "equip-p102",
    {
      available: true,
      format: "step",
      storageReference: "slurry_pump_p102.step",
      version: "v1.0",
      fileSizeBytes: 252719,
      uploadedAt: new Date("2026-10-25T00:00:00.000Z").toISOString(),
    },
  ],
  [
    "machine_001",
    {
      available: true,
      format: "step",
      storageReference: "slurry_pump_p102.step",
      version: "v1.0",
      fileSizeBytes: 252719,
      uploadedAt: new Date("2026-10-25T00:00:00.000Z").toISOString(),
    },
  ],
  [
    "equip-cb-a61",
    {
      available: true,
      format: "step",
      storageReference: "conveyor_belt_a61.step",
      version: "v1.0",
      fileSizeBytes: 244702,
      uploadedAt: new Date("2026-10-25T00:00:00.000Z").toISOString(),
    },
  ],
]);

const cadUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CAD_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_CAD_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported CAD format '${ext}'. Allowed formats: .step, .stp, .iges, .igs, .brep`));
    }
  },
});

// POST /:id/cad - Upload CAD model for machine (Admin or Manager only)
equipmentRouter.post(
  "/:id/cad",
  requireAuth,
  requireRole(["admin", "manager"]),
  (req, res, next) => {
    cadUpload.single("file")(req, res, (err: any) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            success: false,
            error: {
              code: "CAD_FILE_TOO_LARGE",
              message: "CAD model exceeds maximum supported size of 90 MB (aligned with WebAssembly memory limits).",
            },
          });
        }
        if (err.message && err.message.includes("Unsupported CAD format")) {
          return res.status(400).json({
            success: false,
            error: { code: "INVALID_CAD_FORMAT", message: err.message },
          });
        }
        return res.status(400).json({
          success: false,
          error: { code: "INVALID_FILE_UPLOAD", message: err.message || "File upload failed" },
        });
      }
      next();
    });
  },
  async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params.id);
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: "FILE_REQUIRED", message: "A CAD model file (.step, .stp, .iges, .igs, .brep) is required." },
      });
    }

    const ext = path.extname(req.file.originalname).toLowerCase().replace(".", "");
    const version = (req.body.version as string) || "v1.0";

    const cadUploadDir = path.resolve(process.cwd(), "uploads", "cad");
    if (!fs.existsSync(cadUploadDir)) {
      fs.mkdirSync(cadUploadDir, { recursive: true });
    }

    const safeFilename = `${id}_${Date.now()}_${path.basename(req.file.originalname).replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const targetFilePath = path.join(cadUploadDir, safeFilename);

    try {
      fs.writeFileSync(targetFilePath, req.file.buffer);

      const cadModelData = {
        available: true,
        format: ext,
        storageReference: safeFilename,
        version,
        fileSizeBytes: req.file.size,
        uploadedAt: new Date().toISOString(),
      };

      inMemoryCadStorage.set(id.toLowerCase(), cadModelData);

      if (isConnectedToMongo) {
        const query = mongoose.Types.ObjectId.isValid(id)
          ? { _id: id }
          : { $or: [{ serialNumber: id }, { model: id }] };
        await Equipment.findOneAndUpdate(query, { $set: { cadModel: cadModelData } });
      }

      return res.json({
        success: true,
        data: {
          machineId: id,
          cadModel: cadModelData,
          message: "CAD assembly uploaded and associated successfully.",
        },
      });
    } catch (err: any) {
      console.error("[Equipment CAD Upload] Failed to write CAD file:", err);
      return res.status(500).json({
        success: false,
        error: { code: "UPLOAD_FAILED", message: "Failed to persist CAD file to storage." },
      });
    }
  }
);

// GET /:id/cad - Download or stream machine CAD model (Authenticated users)
equipmentRouter.get("/:id/cad", requireAuth, async (req: Request, res: Response) => {
  const id = String(req.params.id);

  let cadInfo = inMemoryCadStorage.get(id.toLowerCase());

  if (!cadInfo && isConnectedToMongo) {
    const query = mongoose.Types.ObjectId.isValid(id)
      ? { _id: id }
      : { $or: [{ serialNumber: id }, { model: id }] };
    const eq = await Equipment.findOne(query);
    if (eq && (eq as any).cadModel?.available) {
      cadInfo = (eq as any).cadModel;
    }
  }

  if (!cadInfo || !cadInfo.available) {
    return res.status(404).json({
      success: false,
      error: {
        code: "CAD_MODEL_PENDING",
        message: "A CAD 3D assembly has not yet been uploaded for this machine. Visual reference and documentation remain accessible.",
      },
    });
  }

  // If client accepts JSON or requests metadata explicitly, return CAD metadata object
  const acceptsJson = req.headers.accept?.includes("application/json") || req.query.metadata === "true";
  if (acceptsJson && !req.query.download) {
    return res.json({
      success: true,
      data: cadInfo,
    });
  }

  const storageRef = cadInfo.storageReference;
  const cadUploadDir = path.resolve(process.cwd(), "uploads", "cad");
  const fullPath = path.join(cadUploadDir, storageRef);

  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({
      success: false,
      error: { code: "FILE_NOT_FOUND", message: "Referenced CAD asset is unavailable in storage." },
    });
  }

  const mimeMap: Record<string, string> = {
    step: "application/octet-stream",
    stp: "application/octet-stream",
    iges: "application/octet-stream",
    igs: "application/octet-stream",
    brep: "application/octet-stream",
  };

  const modelFormat = cadInfo.format || "step";
  res.setHeader("Content-Type", mimeMap[modelFormat] || "application/octet-stream");
  res.setHeader("Content-Disposition", `inline; filename="${storageRef}"`);
  const stream = fs.createReadStream(fullPath);
  return stream.pipe(res);
});

// DELETE /:id/cad - Remove CAD model association (Admin or Manager only)
equipmentRouter.delete(
  "/:id/cad",
  requireAuth,
  requireRole(["admin", "manager"]),
  async (req: AuthenticatedRequest, res: Response) => {
    const id = String(req.params.id);
    try {
      inMemoryCadStorage.delete(id.toLowerCase());

      if (isConnectedToMongo) {
        const query = mongoose.Types.ObjectId.isValid(id)
          ? { _id: id }
          : { $or: [{ serialNumber: id }, { model: id }] };
        await Equipment.findOneAndUpdate(query, {
          $set: {
            cadModel: {
              available: false,
              format: null,
              storageReference: null,
              version: null,
              fileSizeBytes: null,
              uploadedAt: null,
            },
          },
        });
      }

      return res.json({
        success: true,
        data: {
          message: "CAD model association removed.",
          cadModel: { available: false },
        },
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: { code: "DELETE_FAILED", message: err.message },
      });
    }
  }
);
