import { Router, Request, Response } from "express";
import { requireAuth, requireRole } from "../middlewares/auth";
import { taskService } from "../services/task.service";
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  ApiResponse,
  TaskDTO,
} from "@man-u-ai/shared";

export const taskRouter = Router();

/**
 * POST /api/v1/tasks
 * Manager and Admin can create and dispatch new shift tasks.
 */
taskRouter.post(
  "/",
  requireAuth,
  requireRole(["manager", "admin"]),
  async (req: Request, res: Response) => {
    try {
      const parseResult = CreateTaskSchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: parseResult.error.issues[0]?.message || "Invalid task payload.",
          },
        });
      }

      const currentUser = (req as any).user || {
        id: "manager-user",
        name: "Plant Operations Manager",
      };

      const task = await taskService.createTask(parseResult.data, currentUser);

      const response: ApiResponse<TaskDTO> = {
        success: true,
        data: task,
      };
      return res.status(201).json(response);
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: { code: "TASK_CREATE_ERROR", message: err.message },
      });
    }
  }
);

/**
 * GET /api/v1/tasks
 * All authenticated users (engineers, managers, admins) can view tasks.
 */
taskRouter.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { status, equipmentId, shift } = req.query;

    const tasks = await taskService.listTasks({
      status: typeof status === "string" ? status : undefined,
      equipmentId: typeof equipmentId === "string" ? equipmentId : undefined,
      shift: typeof shift === "string" ? shift : undefined,
      userRole: user?.role,
      userId: user?.id || user?._id,
    });

    const response: ApiResponse<TaskDTO[]> = {
      success: true,
      data: tasks,
    };
    return res.json(response);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: "TASK_LIST_ERROR", message: err.message },
    });
  }
});

/**
 * GET /api/v1/tasks/:id
 * Retrieve details of a specific task.
 */
taskRouter.get("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const task = await taskService.getTaskById(id);

    if (!task) {
      return res.status(404).json({
        success: false,
        error: { code: "TASK_NOT_FOUND", message: `Task with id '${id}' not found.` },
      });
    }

    const response: ApiResponse<TaskDTO> = {
      success: true,
      data: task,
    };
    return res.json(response);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: "TASK_GET_ERROR", message: err.message },
    });
  }
});

/**
 * PATCH /api/v1/tasks/:id
 * Update task status (e.g. Engineer starting or completing, Manager editing).
 */
taskRouter.patch("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const parseResult = UpdateTaskSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: parseResult.error.issues[0]?.message || "Invalid task update payload.",
        },
      });
    }

    const updated = await taskService.updateTask(id, parseResult.data);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: { code: "TASK_NOT_FOUND", message: `Task with id '${id}' not found.` },
      });
    }

    const response: ApiResponse<TaskDTO> = {
      success: true,
      data: updated,
    };
    return res.json(response);
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: "TASK_UPDATE_ERROR", message: err.message },
    });
  }
});

/**
 * DELETE /api/v1/tasks/:id
 * Manager / Admin can delete a task.
 */
taskRouter.delete(
  "/:id",
  requireAuth,
  requireRole(["manager", "admin"]),
  async (req: Request, res: Response) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const deleted = await taskService.deleteTask(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: { code: "TASK_NOT_FOUND", message: `Task with id '${id}' not found.` },
        });
      }

      return res.json({
        success: true,
        data: { id, deleted: true },
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: { code: "TASK_DELETE_ERROR", message: err.message },
      });
    }
  }
);

