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
