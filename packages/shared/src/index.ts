import { z } from "zod";

// ─── Auth ───────────────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: z.enum(["admin", "engineer", "viewer"]).optional().default("viewer"),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginSchema>;

// ─── User ───────────────────────────────────────────────────────────────────

export type UserRole = "admin" | "engineer" | "viewer";

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
  title: z.string().min(1).max(255),
  revision: z.string().max(50).optional().default("v1"),
  equipmentId: z.string().optional(),
  tags: z.array(z.string().max(100)).max(50).optional().default([]),
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
  content: z.string().min(1).max(8000),
  equipmentId: z.string().optional(),
  attachmentIds: z.array(z.string().max(100)).max(20).optional().default([]),
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
  name: z.string().min(1).max(255),
  type: z.string().min(1),
  model: z.string().optional(),
  manufacturer: z.string().optional(),
  serialNumber: z.string().optional(),
  location: z.string().optional(),
});
export type CreateEquipmentInput = z.infer<typeof CreateEquipmentSchema>;

// ─── Feedback ────────────────────────────────────────────────────────────────

export const FeedbackSchema = z.object({
  messageId: z.string(),
  rating: z.enum(["up", "down"]),
  comment: z.string().max(1000).optional(),
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
