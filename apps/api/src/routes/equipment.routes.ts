import { Router, Request, Response } from "express";
import { Equipment } from "../models";
import { isConnectedToMongo } from "../config/database";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middlewares/auth";
import { CreateEquipmentSchema } from "@man-u-ai/shared";

export const equipmentRouter: Router = Router();

equipmentRouter.get("/", requireAuth, async (req: Request, res: Response) => {
  if (isConnectedToMongo) {
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
          createdAt: eq.createdAt ? eq.createdAt.toISOString() : new Date().toISOString(),
          updatedAt: eq.updatedAt ? eq.updatedAt.toISOString() : new Date().toISOString(),
        })),
      });
    } catch (err) {
      console.warn("[Equipment] Mongo query failed:", err);
    }
  }

  return res.json({ success: true, data: [] });
});

equipmentRouter.get("/:id", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  if (isConnectedToMongo) {
    try {
      const eq = await Equipment.findById(id).populate("documentIds");
      if (eq) {
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
            createdAt: eq.createdAt ? eq.createdAt.toISOString() : new Date().toISOString(),
          },
        });
      }
    } catch (err) {
      console.warn("[Equipment] Find error:", err);
    }
  }

  return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Equipment not found" } });
});

equipmentRouter.post(
  "/",
  requireAuth,
  requireRole(["admin", "engineer"]),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = CreateEquipmentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid equipment format", details: parsed.error.issues },
      });
    }

    let eqId = `eq-${Date.now()}`;
    if (isConnectedToMongo) {
      try {
        const created = await Equipment.create(parsed.data);
        eqId = created._id.toString();
        return res.status(201).json({
          success: true,
          data: { id: eqId, ...parsed.data, createdAt: created.createdAt?.toISOString() || new Date().toISOString() },
        });
      } catch (err) {
        console.warn("[Equipment] Mongo save failed:", err);
      }
    }

    return res.status(201).json({
      success: true,
      data: { id: eqId, ...parsed.data, createdAt: new Date().toISOString() },
    });
  }
);

equipmentRouter.delete(
  "/:id",
  requireAuth,
  requireRole(["admin", "engineer"]),
  async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    if (isConnectedToMongo) {
      try {
        await Equipment.findByIdAndDelete(id);
        return res.json({ success: true, data: { message: "Equipment removed successfully" } });
      } catch (err) {
        console.warn("[Equipment] Delete error:", err);
      }
    }
    return res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Equipment not found" } });
  }
);
