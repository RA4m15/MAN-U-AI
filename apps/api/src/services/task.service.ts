import mongoose from "mongoose";
import { Task, ITask } from "../models";
import { isConnectedToMongo } from "../config/database";
import type { TaskDTO, CreateTaskInput, UpdateTaskInput, TaskStatus } from "@man-u-ai/shared";

// Seeded in-memory storage for test runs & disconnected MongoDB environments
let MEMORY_TASKS: TaskDTO[] = [
  {
    id: "task-seed-001",
    title: "Inspect Slurry Pump P-102 mechanical seal & oil level",
    description: "Verify mechanical seal housing torque specs (45 Nm). Check bearing lubricant clarity and verify zero leakage at suction flange before Shift B run.",
    priority: "high",
    status: "pending",
    equipmentId: "PUMP-P102",
    equipmentName: "Slurry Pump P-102",
    assignedTo: "all",
    assignedToName: "All Field Engineers",
    shift: "today",
    dueDate: new Date(Date.now() + 4 * 3600000).toISOString(),
    createdById: "mgr-001",
    createdByName: "Marcus Vance (Plant Manager)",
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: "task-seed-002",
    title: "Perform LOTO & air filter replacement on Compressor C-04",
    description: "Execute standard Lockout/Tagout on Breaker B-14. Relieve receiver tank pressure via drain valve. Replace particulate air filter intake element.",
    priority: "critical",
    status: "in_progress",
    equipmentId: "COMP-C04",
    equipmentName: "Turbocompressor C-04",
    assignedTo: "all",
    assignedToName: "All Field Engineers",
    shift: "today",
    dueDate: new Date(Date.now() + 6 * 3600000).toISOString(),
    createdById: "mgr-001",
    createdByName: "Marcus Vance (Plant Manager)",
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "task-seed-003",
    title: "Calibrate Conveyor Belt A61 speed sensors & emergency stop pull-cords",
    description: "Inspect optical speed encoder sensors on Head Pulley A-61. Test e-stop pull cord continuity along Sector 3 line.",
    priority: "medium",
    status: "completed",
    equipmentId: "CONV-A61",
    equipmentName: "Conveyor Belt A61",
    assignedTo: "all",
    assignedToName: "All Field Engineers",
    shift: "today",
    dueDate: new Date().toISOString(),
    createdById: "mgr-001",
    createdByName: "Marcus Vance (Plant Manager)",
    completionNotes: "Sensors calibrated within ±0.5% tolerance. E-stop tested and reset.",
    completedAt: new Date(Date.now() - 1800000).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    updatedAt: new Date(Date.now() - 1800000).toISOString(),
  },
];

export class TaskService {
  private toDTO(doc: any): TaskDTO {
    return {
      id: String(doc._id || doc.id),
      title: doc.title,
      description: doc.description,
      priority: doc.priority,
      status: doc.status,
      equipmentId: doc.equipmentId || undefined,
      equipmentName: doc.equipmentName || undefined,
      assignedTo: doc.assignedTo || "all",
      assignedToName: doc.assignedToName || "All Field Engineers",
      shift: doc.shift || "today",
      dueDate: doc.dueDate ? (doc.dueDate instanceof Date ? doc.dueDate.toISOString() : String(doc.dueDate)) : undefined,
      createdById: String(doc.createdById),
      createdByName: doc.createdByName,
      completionNotes: doc.completionNotes || undefined,
      completedAt: doc.completedAt ? (doc.completedAt instanceof Date ? doc.completedAt.toISOString() : String(doc.completedAt)) : undefined,
      createdAt: doc.createdAt ? (doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt)) : new Date().toISOString(),
      updatedAt: doc.updatedAt ? (doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt)) : new Date().toISOString(),
    };
  }

  /**
   * Create a new task (Manager / Admin).
   */
  async createTask(
    input: CreateTaskInput,
    user: { id?: string; _id?: string; name?: string }
  ): Promise<TaskDTO> {
    const userId = String(user.id || (user as any)._id || "manager-system");
    const userName = user.name || "Plant Operations Manager";

    if (!isConnectedToMongo) {
      const newTask: TaskDTO = {
        id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: input.title,
        description: input.description,
        priority: input.priority || "medium",
        status: "pending",
        equipmentId: input.equipmentId,
        equipmentName: input.equipmentName,
        assignedTo: input.assignedTo || "all",
        assignedToName: input.assignedToName || "All Field Engineers",
        shift: input.shift || "today",
        dueDate: input.dueDate || new Date(Date.now() + 8 * 3600000).toISOString(),
        createdById: userId,
        createdByName: userName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      MEMORY_TASKS.unshift(newTask);
      try {
        const { emitTaskCreated } = require("../index");
        emitTaskCreated(newTask);
      } catch {}
      return newTask;
    }

    const created = await Task.create({
      title: input.title,
      description: input.description,
      priority: input.priority || "medium",
      status: "pending",
      equipmentId: input.equipmentId,
      equipmentName: input.equipmentName,
      assignedTo: input.assignedTo || "all",
      assignedToName: input.assignedToName || "All Field Engineers",
      shift: input.shift || "today",
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      createdById: userId,
      createdByName: userName,
    });

    const dto = this.toDTO(created);
    try {
      const { emitTaskCreated } = require("../index");
      emitTaskCreated(dto);
    } catch {}
    return dto;
  }

  /**
   * List tasks with optional filtering by status, equipmentId, or assignment.
   */
  async listTasks(filters?: {
    status?: string;
    equipmentId?: string;
    assignedTo?: string;
    shift?: string;
    userRole?: string;
    userId?: string;
  }): Promise<TaskDTO[]> {
    if (!isConnectedToMongo) {
      let filtered = [...MEMORY_TASKS];

      if (filters?.status) {
        filtered = filtered.filter((t) => t.status === filters.status);
      }
      if (filters?.equipmentId) {
        filtered = filtered.filter((t) => t.equipmentId === filters.equipmentId);
      }
      if (filters?.shift) {
        filtered = filtered.filter((t) => t.shift === filters.shift);
      }

      // If user is engineer, show tasks assigned to "all" or explicitly to them
      if (filters?.userRole === "engineer" && filters?.userId) {
        filtered = filtered.filter(
          (t) => t.assignedTo === "all" || t.assignedTo === filters.userId
        );
      }

      return filtered;
    }

    const query: Record<string, any> = {};

    if (filters?.status) {
      query.status = filters.status;
    }
    if (filters?.equipmentId) {
      query.equipmentId = filters.equipmentId;
    }
    if (filters?.shift) {
      query.shift = filters.shift;
    }

    if (filters?.userRole === "engineer" && filters?.userId) {
      query.$or = [{ assignedTo: "all" }, { assignedTo: filters.userId }];
    }

    const tasks = await Task.find(query).sort({ createdAt: -1 }).lean();
    return tasks.map((t) => this.toDTO(t));
  }

  /**
   * Get task by ID.
   */
  async getTaskById(taskId: string): Promise<TaskDTO | null> {
    if (!isConnectedToMongo) {
      const task = MEMORY_TASKS.find((t) => t.id === taskId);
      return task || null;
    }

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      // Fallback check in memory for seed IDs
      const mem = MEMORY_TASKS.find((t) => t.id === taskId);
      if (mem) return mem;
      return null;
    }

    const found = await Task.findById(taskId).lean();
    return found ? this.toDTO(found) : null;
  }

  /**
   * Update task status, notes, or details.
   */
  async updateTask(taskId: string, input: UpdateTaskInput): Promise<TaskDTO | null> {
    const isCompleted = input.status === "completed";
    const completedAt = isCompleted ? new Date().toISOString() : undefined;

    if (!isConnectedToMongo) {
      const idx = MEMORY_TASKS.findIndex((t) => t.id === taskId);
      if (idx === -1) return null;

      const existing = MEMORY_TASKS[idx];
      const updated: TaskDTO = {
        ...existing,
        ...input,
        completedAt: isCompleted ? (completedAt || existing.completedAt) : existing.completedAt,
        updatedAt: new Date().toISOString(),
      };

      MEMORY_TASKS[idx] = updated;
      try {
        const { emitTaskUpdated } = require("../index");
        emitTaskUpdated(updated);
      } catch {}
      return updated;
    }

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      const idx = MEMORY_TASKS.findIndex((t) => t.id === taskId);
      if (idx !== -1) {
        MEMORY_TASKS[idx] = {
          ...MEMORY_TASKS[idx],
          ...input,
          updatedAt: new Date().toISOString(),
        };
        return MEMORY_TASKS[idx];
      }
      return null;
    }

    const updatePayload: Record<string, any> = { ...input };
    if (isCompleted) {
      updatePayload.completedAt = new Date();
    }

    const updated = await Task.findByIdAndUpdate(
      taskId,
      { $set: updatePayload },
      { new: true }
    ).lean();

    return updated ? this.toDTO(updated) : null;
  }

  /**
   * Delete task (Manager / Admin).
   */
  async deleteTask(taskId: string): Promise<boolean> {
    if (!isConnectedToMongo) {
      const prevLen = MEMORY_TASKS.length;
      MEMORY_TASKS = MEMORY_TASKS.filter((t) => t.id !== taskId);
      return MEMORY_TASKS.length < prevLen;
    }

    if (!mongoose.Types.ObjectId.isValid(taskId)) {
      const prevLen = MEMORY_TASKS.length;
      MEMORY_TASKS = MEMORY_TASKS.filter((t) => t.id !== taskId);
      return MEMORY_TASKS.length < prevLen;
    }

    const res = await Task.findByIdAndDelete(taskId);
    return !!res;
  }

  /**
   * Reset in-memory tasks for test isolation.
   */
  resetMemoryTasks() {
    MEMORY_TASKS = [];
  }
}

export const taskService = new TaskService();
