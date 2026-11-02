import { Router, Request, Response } from "express";
import {
  GenerateFlowchartSchema,
  ApproveFlowchartSchema,
  ApiResponse,
  SOPFlowchartDTO,
} from "@man-u-ai/shared";
import { flowchartService } from "../services/flowchart.service";
import { requireAuth, requireRole, AuthenticatedRequest } from "../middlewares/auth";

export const flowchartsRouter: Router = Router();

/**
 * POST /api/v1/flowcharts/generate
 * Converts long text procedure/SOP into a clean structured flowchart.
 */
flowchartsRouter.post(
  "/generate",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const parseResult = GenerateFlowchartSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parseResult.error.issues[0]?.message || "Invalid procedure payload for flowchart generation.",
          },
        });
      }

      const flowchart = await flowchartService.generateFlowchart(parseResult.data);
      if (res.headersSent) return;
      const response: ApiResponse<SOPFlowchartDTO> = {
        success: true,
        data: flowchart,
      };
      return res.status(201).json(response);
    } catch (err: any) {
      if (res.headersSent) return;
      console.error("[FlowchartRouter] Generation error:", err);
      return res.status(500).json({
        success: false,
        error: { code: "FLOWCHART_GENERATE_ERROR", message: err.message },
      });
    }
  }
);

/**
 * GET /api/v1/flowcharts
 * Lists all generated SOP flowcharts.
 */
flowchartsRouter.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const list = await flowchartService.getFlowcharts();
    const response: ApiResponse<SOPFlowchartDTO[]> = {
      success: true,
      data: list,
    };
    return res.json(response);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: "FLOWCHART_LIST_ERROR", message: err.message },
    });
  }
});

/**
 * GET /api/v1/flowcharts/:id
 * Retrieves a specific flowchart by ID.
 */
flowchartsRouter.get("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const flowchart = await flowchartService.getFlowchartById(id);

    if (!flowchart) {
      return res.status(404).json({
        success: false,
        error: { code: "FLOWCHART_NOT_FOUND", message: `Flowchart with ID '${id}' not found.` },
      });
    }

    const response: ApiResponse<SOPFlowchartDTO> = {
      success: true,
      data: flowchart,
    };
    return res.json(response);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: "FLOWCHART_GET_ERROR", message: err.message },
    });
  }
});

/**
 * POST /api/v1/flowcharts/:id/approve
 * Expert approval endpoint: sets status to 'approved' and records signature / certificate.
 */
flowchartsRouter.post(
  "/:id/approve",
  requireAuth,
  requireRole(["admin", "engineer", "manager"]),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const parseResult = ApproveFlowchartSchema.safeParse(req.body);

      const approvedBy = parseResult.success
        ? parseResult.data.approvedBy
        : req.user?.name || "Certified Engineer";
      const approvedByRole = parseResult.success
        ? parseResult.data.approvedByRole
        : req.user?.role === "admin"
        ? "Plant Administrator"
        : req.user?.role === "manager"
        ? "Operations Manager"
        : "Lead Reliability Engineer";

      const updated = await flowchartService.approveFlowchart(id, {
        approvedBy,
        approvedByRole,
        comments: parseResult.success ? parseResult.data.comments : undefined,
      });

      if (!updated) {
        return res.status(404).json({
          success: false,
          error: { code: "FLOWCHART_NOT_FOUND", message: `Flowchart with ID '${id}' not found.` },
        });
      }

      const response: ApiResponse<SOPFlowchartDTO> = {
        success: true,
        data: updated,
      };
      return res.json(response);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: { code: "FLOWCHART_APPROVE_ERROR", message: err.message },
      });
    }
  }
);

/**
 * DELETE /api/v1/flowcharts/:id
 * Deletes a flowchart.
 */
flowchartsRouter.delete(
  "/:id",
  requireAuth,
  requireRole(["admin", "manager"]),
  async (req: Request, res: Response) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const deleted = await flowchartService.deleteFlowchart(id);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: { code: "FLOWCHART_NOT_FOUND", message: `Flowchart with ID '${id}' not found.` },
        });
      }
      return res.json({ success: true, data: { deleted: true } });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: { code: "FLOWCHART_DELETE_ERROR", message: err.message },
      });
    }
  }
);
