import { z } from "zod";

// ─── Auth ───────────────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name cannot exceed 100 characters"),
  email: z.string().trim().email("Invalid email format").max(255, "Email cannot exceed 255 characters"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password cannot exceed 128 characters"),
  role: z.enum(["admin", "engineer", "viewer", "manager"]).optional().default("viewer"),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().trim().email("Invalid email format").max(255, "Email cannot exceed 255 characters"),
  password: z.string().min(1, "Password is required").max(128, "Password cannot exceed 128 characters"),
});
export type LoginInput = z.infer<typeof LoginSchema>;

// ─── User ───────────────────────────────────────────────────────────────────

export type UserRole = "admin" | "engineer" | "viewer" | "manager";

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

// ─── Document ────────────────────────────────────────────────────────────────

export type DocumentStatus =
  | "pending"
  | "processing"
  | "indexed"
  | "failed"
  | "needs_ocr";

export interface DocumentDTO {
  id: string;
  title: string;
  revision: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  pageCount?: number;
  processingError?: string;
  uploadedById: string;
  createdAt: string;
  updatedAt: string;
}

export const UploadDocumentSchema = z.object({
  title: z.string().trim().min(1, "Document title cannot be empty").max(255, "Document title too long"),
  revision: z.string().trim().max(50, "Revision too long").optional().default("v1"),
  equipmentId: z
    .string()
    .trim()
    .refine((val) => !val || /^[0-9a-fA-F]{24}$/.test(val), {
      message: "Invalid equipment ID format: must be a 24-character hexadecimal ObjectId",
    })
    .optional(),
  tags: z.array(z.string().trim().min(1, "Tag cannot be empty").max(100, "Tag too long")).max(50, "Cannot exceed 50 tags").optional().default([]),
});
export type UploadDocumentInput = z.infer<typeof UploadDocumentSchema>;

// ─── Processing Job ──────────────────────────────────────────────────────────

export type JobStatus = "queued" | "running" | "done" | "failed";

export interface ProcessingJobDTO {
  id: string;
  documentId: string;
  status: JobStatus;
  progress: number; // 0–100
  error?: string;
  startedAt?: string;
  finishedAt?: string;
}

// ─── Conversation & Messages ─────────────────────────────────────────────────

export type MessageRole = "user" | "assistant" | "system";

export type FigureStatus = "pending" | "extracted" | "failed" | "unavailable";

export interface DocumentFigureDTO {
  id: string;
  documentId: string;
  documentTitle: string;
  revision: string;
  page: number;
  figureId: string;
  title?: string;
  caption?: string;
  storagePath?: string;
  storageProvider?: string;
  mimeType?: string;
  sizeBytes?: number;
  dimensions?: { width: number; height: number };
  status: FigureStatus;
  processingError?: string;
  associatedChunkIds: string[];
  createdAt?: string;
}

export interface CitationDTO {
  id: string;
  documentId: string;
  documentTitle: string;
  revision: string;
  page: number;
  section?: string;
  excerpt: string;
  figures?: DocumentFigureDTO[];
}

export interface MessageDTO {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  citations?: CitationDTO[];
  createdAt: string;
}

export interface ConversationDTO {
  id: string;
  title: string;
  equipmentId?: string;
  equipmentName?: string;
  lastMessageAt: string;
  messageCount: number;
  createdAt: string;
}

export const SendMessageSchema = z.object({
  content: z.string().trim().min(1, "Message text is required").max(8000, "Message text too long").optional(),
  message: z.string().trim().min(1, "Message text is required").max(8000, "Message text too long").optional(),
  conversationId: z.string().trim().max(100).optional(),
  equipmentId: z.string().trim().max(100).optional(),
  attachmentIds: z.array(z.string().trim().min(1, "Attachment ID cannot be empty").max(100, "Attachment ID too long")).max(20, "Cannot exceed 20 attachments").optional().default([]),
}).refine((data) => Boolean((data.content && data.content.trim()) || (data.message && data.message.trim())), {
  message: "Message text is required",
  path: ["message"],
});
export type SendMessageInput = z.infer<typeof SendMessageSchema>;

// ─── Equipment ───────────────────────────────────────────────────────────────

export interface EquipmentDTO {
  id: string;
  name: string;
  type: string;
  model?: string;
  manufacturer?: string;
  serialNumber?: string;
  location?: string;
  documentIds: string[];
  createdAt: string;
}

export const CreateEquipmentSchema = z.object({
  name: z.string().trim().min(1, "Equipment name is required").max(255, "Equipment name too long"),
  type: z.string().trim().min(1, "Equipment type is required").max(100, "Equipment type too long"),
  model: z.string().trim().max(100).optional(),
  manufacturer: z.string().trim().max(100).optional(),
  serialNumber: z.string().trim().max(100).optional(),
  location: z.string().trim().max(100).optional(),
});
export type CreateEquipmentInput = z.infer<typeof CreateEquipmentSchema>;

// ─── Feedback ────────────────────────────────────────────────────────────────

export const FeedbackSchema = z.object({
  messageId: z.string().trim().min(1, "Message ID is required").max(100, "Message ID too long"),
  rating: z.enum(["up", "down"], { message: "Rating must be 'up' or 'down'" }),
  comment: z.string().trim().max(1000, "Comment cannot exceed 1000 characters").optional(),
});
export type FeedbackInput = z.infer<typeof FeedbackSchema>;

// ─── Settings ────────────────────────────────────────────────────────────────

export const SUPPORTED_AI_MODELS = [
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-2.0-flash",
  "gemini-3.8-flash",
] as const;

export interface FacilitySettingsDTO {
  facilityName: string;
  timezone: string;
  selectedModel: string;
  temperature: number;
  topK: number;
  similarityThreshold: number;
  updatedAt?: string;
  updatedBy?: string;
  supportedModels: string[];
}

export const UpdateSettingsSchema = z.object({
  facilityName: z.string().min(1).max(120).optional(),
  timezone: z.string().min(1).max(80).optional(),
  selectedModel: z.string().min(1).optional(),
  temperature: z.number().min(0.0).max(1.0).optional(),
  topK: z.number().int().min(1).max(20).optional(),
  similarityThreshold: z.number().min(0.1).max(0.99).optional(),
});
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsSchema>;

// ─── API Response wrapper ────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── Pagination ──────────────────────────────────────────────────────────────

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
