import { Router, Request, Response } from "express";
import path from "path";
import fs from "fs";
import { requireAuth } from "../middlewares/auth";
import { diagramService } from "../services/diagram.service";
import {
  CreateDiagramAnnotationSchema,
  ApiResponse,
  DiagramAnnotationDTO,
} from "@man-u-ai/shared";

export const diagramRouter: Router = Router();

// Stream diagram figure image (e.g. SimReady Conveyor Belt A61, Turbocompressor B01)
diagramRouter.get("/:figureId/image", async (req: Request, res: Response) => {
  // Always set CORS + cache headers before any response
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=86400");

  try {
    const figureId = String(req.params.figureId);
    const isConveyorA61 =
      figureId.toUpperCase().includes("CONVEYOR") ||
      figureId.toUpperCase().includes("A61") ||
      figureId === "FIG-CONVEYOR-BELT-A61";

    const isTurbocompressor =
      figureId.toUpperCase().includes("TURBO") ||
      figureId.toUpperCase().includes("COMPRESSOR") ||
      figureId.toUpperCase().includes("B01") ||
      figureId === "FIG-TURBOCOMPRESSOR-B01";

    if (isConveyorA61) {
      // Primary: bundled alongside API in public/diagrams/
      const candidatePaths = [
        path.join(__dirname, "..", "..", "public", "diagrams", "conveyor_belt_a61.png"),
        path.join(process.cwd(), "public", "diagrams", "conveyor_belt_a61.png"),
        path.join(process.cwd(), "simready-assets-653d91e1", "conveyor_belt_a61", "simready_usd", ".thumbs", "sm_conveyor_belt_a61_01_thumbnail.png"),
        path.join(process.cwd(), "..", "simready-assets-653d91e1", "conveyor_belt_a61", "simready_usd", ".thumbs", "sm_conveyor_belt_a61_01_thumbnail.png"),
        path.join(process.cwd(), "..", "..", "simready-assets-653d91e1", "conveyor_belt_a61", "simready_usd", ".thumbs", "sm_conveyor_belt_a61_01_thumbnail.png"),
        "C:\\MAN-U-AI\\MAN-U-AI\\simready-assets-653d91e1\\conveyor_belt_a61\\simready_usd\\.thumbs\\sm_conveyor_belt_a61_01_thumbnail.png",
      ];

      const imagePath = candidatePaths.find((p) => {
        try { return fs.existsSync(p); } catch { return false; }
      });

      if (imagePath) {
        res.setHeader("Content-Type", "image/png");
        return fs.createReadStream(imagePath).pipe(res);
      }
    }

    if (isTurbocompressor) {
      const candidatePaths = [
        path.join(__dirname, "..", "..", "public", "diagrams", "turbocompressor_b01.png"),
        path.join(process.cwd(), "public", "diagrams", "turbocompressor_b01.png"),
        path.join(process.cwd(), "simready-assets-653d91e1", "engineComponent_turbocompressor_b01", "simready_usd", ".thumbs", "sm_engineComponent_turbocompressor_b01_01_thumbnail.png"),
        path.join(process.cwd(), "..", "simready-assets-653d91e1", "engineComponent_turbocompressor_b01", "simready_usd", ".thumbs", "sm_engineComponent_turbocompressor_b01_01_thumbnail.png"),
        "C:\\MAN-U-AI\\MAN-U-AI\\simready-assets-653d91e1\\engineComponent_turbocompressor_b01\\simready_usd\\.thumbs\\sm_engineComponent_turbocompressor_b01_01_thumbnail.png",
      ];

      const imagePath = candidatePaths.find((p) => {
        try { return fs.existsSync(p); } catch { return false; }
      });

      if (imagePath) {
        res.setHeader("Content-Type", "image/png");
        return fs.createReadStream(imagePath).pipe(res);
      }
    }

    return res.status(404).json({
      success: false,
      error: { code: "FIGURE_NOT_FOUND", message: `Figure image ${figureId} not found` },
    });
  } catch (err: any) {
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: { code: "IMAGE_STREAM_ERROR", message: err.message },
      });
    }
  }
});

// Get diagram annotations/hotspots for a figure
diagramRouter.get("/:figureId", requireAuth, async (req: Request, res: Response) => {
  try {
    const figureId = String(req.params.figureId);
    const annotations = await diagramService.getAnnotations(figureId);

    if (!annotations) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: `No annotations found for figure ${figureId}` },
      });
    }

    const response: ApiResponse<DiagramAnnotationDTO> = {
      success: true,
      data: annotations,
    };
    return res.json(response);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: "DIAGRAM_FETCH_ERROR", message: err.message },
    });
  }
});

// Run Gemini Vision to detect component hotspots automatically
diagramRouter.post("/:figureId/annotate", requireAuth, async (req: Request, res: Response) => {
  try {
    const figureId = String(req.params.figureId);
    const annotations = await diagramService.annotateWithVision(figureId);

    return res.json({
      success: true,
      data: annotations,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: "DIAGRAM_ANNOTATE_ERROR", message: err.message },
    });
  }
});

// Save or edit diagram annotations
diagramRouter.post("/:figureId/hotspots", requireAuth, async (req: Request, res: Response) => {
  try {
    const role = (req as any).user?.role;
    if (role === "operator") {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Operators cannot edit diagram hotspots." },
      });
    }

    const parseResult = CreateDiagramAnnotationSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parseResult.error.issues[0]?.message || "Invalid hotspot payload.",
        },
      });
    }

    const saved = await diagramService.saveAnnotations(parseResult.data);
    return res.json({
      success: true,
      data: saved,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: "DIAGRAM_SAVE_ERROR", message: err.message },
    });
  }
});
