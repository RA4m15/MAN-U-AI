import { z } from "zod";

// ─── Auth ───────────────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name cannot exceed 100 characters"),
  email: z.string().trim().email("Invalid email format").max(255, "Email cannot exceed 255 characters"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password cannot exceed 128 characters"),
  role: z.enum(["admin", "engineer", "operator", "manager"]).optional().default("operator"),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().trim().email("Invalid email format").max(255, "Email cannot exceed 255 characters"),
  password: z.string().min(1, "Password is required").max(128, "Password cannot exceed 128 characters"),
});
export type LoginInput = z.infer<typeof LoginSchema>;

// ─── User ───────────────────────────────────────────────────────────────────

export type UserRole = "admin" | "engineer" | "operator" | "manager";

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
  ownerName?: string;
  ownerEmail?: string;
  reviewDate?: string;
  isOverdue?: boolean;
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
  ownerName: z.string().trim().max(100).optional(),
  ownerEmail: z.string().trim().email("Invalid owner email format").max(255).optional().or(z.literal("")),
  reviewDate: z.string().trim().optional(),
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

// ─── Safety & Preconditions ─────────────────────────────────────────────────

export type SafetyCategory =
  | "hazard_warning"
  | "ppe_required"
  | "loto_isolation"
  | "general_procedure";

export interface SafetyPreconditionsDTO {
  warnings: string[];
  ppeRequired: string[];
  lotoSteps: string[];
  isOverdueWarning?: string;
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
  safetyCategory?: SafetyCategory;
  isOverdue?: boolean;
  reviewDate?: string;
}

export interface MessageDTO {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  citations?: CitationDTO[];
  warningLevel?: "none" | "caution" | "critical";
  safetyPreconditions?: SafetyPreconditionsDTO;
  suggestedTicket?: {
    query: string;
    equipmentId?: string;
    reason: string;
  };
  expandedTerms?: string[];
  workerAnswer?: WorkerResponseDTO;
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
  preferredLanguage: z.enum(["en", "hi", "hinglish"]).optional(),
  simpler: z.boolean().optional(),
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

// ─── Plant Glossary & Slang Mapping ──────────────────────────────────────────

export type PlantGlossaryCategory = "slang" | "equipment_tag" | "abbreviation" | "component";

export interface PlantGlossaryDTO {
  id: string;
  term: string;
  canonicalTerm: string;
  equipmentTag?: string;
  category: PlantGlossaryCategory;
  synonyms: string[];
  plantArea?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export const CreatePlantGlossarySchema = z.object({
  term: z.string().trim().min(1, "Term cannot be empty").max(100),
  canonicalTerm: z.string().trim().min(1, "Canonical term cannot be empty").max(150),
  equipmentTag: z.string().trim().max(50).optional(),
  category: z.enum(["slang", "equipment_tag", "abbreviation", "component"]).default("slang"),
  synonyms: z.array(z.string().trim().min(1)).default([]),
  plantArea: z.string().trim().max(100).optional(),
  isActive: z.boolean().default(true),
});
export type CreatePlantGlossaryInput = z.infer<typeof CreatePlantGlossarySchema>;

export interface GlossarySuggestionDTO {
  id: string;
  rawQuery: string;
  unmatchedTerms: string[];
  frequency: number;
  lastSearchedAt: string;
  status: "pending" | "approved" | "dismissed";
  suggestedCanonical?: string;
  createdAt: string;
}

export const ApproveGlossarySuggestionSchema = z.object({
  term: z.string().trim().min(1),
  canonicalTerm: z.string().trim().min(1),
  category: z.enum(["slang", "equipment_tag", "abbreviation", "component"]).default("slang"),
  equipmentTag: z.string().trim().optional(),
  synonyms: z.array(z.string().trim()).default([]),
});
export type ApproveGlossarySuggestionInput = z.infer<typeof ApproveGlossarySuggestionSchema>;

// ─── Refusal-to-Fix Documentation Tickets ───────────────────────────────────

export type TicketStatus = "open" | "assigned" | "uploaded" | "closed";

export interface DocRequestTicketDTO {
  id: string;
  ticketNumber: string;
  equipmentId?: string;
  equipmentName?: string;
  requestedBy: {
    id: string;
    name?: string;
    email?: string;
  };
  userQuery: string;
  searchContext?: string;
  closestMatch?: {
    documentTitle: string;
    page: number;
    score: number;
  };
  status: TicketStatus;
  assignedToEmail?: string;
  resolutionNotes?: string;
  createdAt: string;
  resolvedAt?: string;
}

export const CreateDocRequestTicketSchema = z.object({
  equipmentId: z.string().trim().optional(),
  equipmentName: z.string().trim().optional(),
  userQuery: z.string().trim().min(1, "User query is required").max(1000),
  searchContext: z.string().trim().max(3000).optional(),
  closestMatch: z
    .object({
      documentTitle: z.string().trim(),
      page: z.number(),
      score: z.number(),
    })
    .optional(),
});
export type CreateDocRequestTicketInput = z.infer<typeof CreateDocRequestTicketSchema>;

export const UpdateDocRequestTicketSchema = z.object({
  status: z.enum(["open", "assigned", "uploaded", "closed"]).optional(),
  assignedToEmail: z.string().trim().email().optional().or(z.literal("")),
  resolutionNotes: z.string().trim().max(2000).optional(),
});
export type UpdateDocRequestTicketInput = z.infer<typeof UpdateDocRequestTicketSchema>;

// ─── Tap-the-Part Interactive Diagrams ──────────────────────────────────────

export interface DiagramHotspotDTO {
  id: string;
  partNumber: string;
  partName: string;
  boundingBox: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized 0-1000
  manualPage?: number;
  description?: string;
}

export interface DiagramAnnotationDTO {
  id: string;
  figureId: string;
  documentId: string;
  documentTitle: string;
  page: number;
  title?: string;
  hotspots: DiagramHotspotDTO[];
  createdAt: string;
}

export const CreateDiagramAnnotationSchema = z.object({
  figureId: z.string().trim().min(1),
  documentId: z.string().trim().min(1),
  documentTitle: z.string().trim().min(1),
  page: z.number().int().min(1),
  title: z.string().trim().optional(),
  hotspots: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        partNumber: z.string().trim().min(1),
        partName: z.string().trim().min(1),
        boundingBox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
        manualPage: z.number().optional(),
        description: z.string().trim().optional(),
      })
    )
    .default([]),
});
export type CreateDiagramAnnotationInput = z.infer<typeof CreateDiagramAnnotationSchema>;

// ─── Offline-Capable Area Pack & Sync ────────────────────────────────────────

export interface AreaPackChunkDTO {
  id: string;
  documentId: string;
  documentTitle: string;
  page: number;
  section?: string;
  text: string;
  safetyCategory?: SafetyCategory;
  ppeTags?: string[];
}

export interface AreaPackDTO {
  equipmentId: string;
  equipmentName: string;
  equipmentType: string;
  model?: string;
  generatedAt: string;
  versionHash: string;
  documents: DocumentDTO[];
  chunks: AreaPackChunkDTO[];
  figures: DocumentFigureDTO[];
}

export const SyncCheckSchema = z.object({
  equipmentId: z.string().trim().min(1),
  currentVersionHash: z.string().trim().optional(),
  cachedAt: z.string().trim().optional(),
});
export type SyncCheckInput = z.infer<typeof SyncCheckSchema>;

export interface SyncCheckResponseDTO {
  equipmentId: string;
  isUpToDate: boolean;
  latestVersionHash: string;
  latestRevisionDate: string;
}

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

// ─── Worker-Friendly Structured Answers ──────────────────────────────────────

export type WorkerLanguage = "en" | "hi" | "hinglish";

export const WorkerWarningSchema = z.object({
  text: z.string(),
  source_id: z.string().optional(),
});
export type WorkerWarningDTO = z.infer<typeof WorkerWarningSchema>;

export const ManualSentenceSchema = z.object({
  id: z.string(),
  text: z.string(),
  source_id: z.string().optional(),
  documentTitle: z.string().optional(),
  page: z.number().optional(),
});
export type ManualSentenceDTO = z.infer<typeof ManualSentenceSchema>;

export const WorkerStepSchema = z.object({
  n: z.number(),
  text: z.string(),
  source_id: z.string().optional(),
  source_sentence_id: z.string().optional(),
});
export type WorkerStepDTO = z.infer<typeof WorkerStepSchema>;

export const WorkerValueSchema = z.object({
  label: z.string(),
  value: z.string(),
  unit: z.string().optional().default(""),
  source_id: z.string().optional(),
});
export type WorkerValueDTO = z.infer<typeof WorkerValueSchema>;

export const WorkerSourceSchema = z.object({
  document: z.string(),
  version: z.string().optional(),
  page: z.number().optional().default(1),
  section: z.string().optional(),
});
export type WorkerSourceDTO = z.infer<typeof WorkerSourceSchema>;

export const WorkerAnswerSchema = z.object({
  status: z.literal("answered"),
  language: z.enum(["en", "hi", "hinglish"]).default("en"),
  headline: z.string(),
  warnings: z.array(WorkerWarningSchema).default([]),
  steps: z.array(WorkerStepSchema).default([]),
  values: z.array(WorkerValueSchema).default([]),
  has_more_steps: z.boolean().default(false),
  all_steps: z.array(WorkerStepSchema).optional(),
  sources: z.array(WorkerSourceSchema).default([]),
  manual_text: z.string().optional(),
  manual_sentences: z.array(ManualSentenceSchema).optional(),
  follow_up: z.string().nullable().optional(),
  simpler_applied: z.boolean().optional(),
});
export type WorkerAnswerDTO = z.infer<typeof WorkerAnswerSchema>;

export const WorkerCannotVerifySchema = z.object({
  status: z.literal("cannot_verify"),
  language: z.enum(["en", "hi", "hinglish"]).default("en"),
  message: z.string(),
  closest_sources: z.array(WorkerSourceSchema).optional().default([]),
});
export type WorkerCannotVerifyDTO = z.infer<typeof WorkerCannotVerifySchema>;

export type WorkerResponseDTO = WorkerAnswerDTO | WorkerCannotVerifyDTO;

// ─── Shift Task & Work Order Dispatch ────────────────────────────────────────

export type TaskPriority = "critical" | "high" | "medium" | "low";
export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";

export interface TaskDTO {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  equipmentId?: string;
  equipmentName?: string;
  assignedTo: string;
  assignedToName?: string;
  shift: string;
  dueDate?: string;
  createdById: string;
  createdByName: string;
  completionNotes?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const CreateTaskSchema = z.object({
  title: z.string().trim().min(3, "Task title must be at least 3 characters").max(200, "Task title cannot exceed 200 characters"),
  description: z.string().trim().min(5, "Task instructions must be at least 5 characters").max(2000, "Description cannot exceed 2000 characters"),
  priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
  equipmentId: z.string().optional(),
  equipmentName: z.string().optional(),
  assignedTo: z.string().optional().default("all"),
  assignedToName: z.string().optional().default("All Field Engineers"),
  shift: z.string().optional().default("today"),
  dueDate: z.string().optional(),
});
export type CreateTaskInput = z.input<typeof CreateTaskSchema>;

export const UpdateTaskSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().min(5).max(2000).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  status: z.enum(["pending", "in_progress", "completed", "cancelled"]).optional(),
  completionNotes: z.string().max(1000).optional(),
  equipmentId: z.string().optional(),
  equipmentName: z.string().optional(),
  assignedTo: z.string().optional(),
  assignedToName: z.string().optional(),
  shift: z.string().optional(),
  dueDate: z.string().optional(),
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

// ─── Machine Media Ingestion ────────────────────────────────────────────────

export type MediaType = "image" | "video";
export type MediaStatus = "uploading" | "uploaded" | "processing" | "indexed" | "failed";

export interface MediaDTO {
  id: string;
  title: string;
  description?: string;
  mediaType: MediaType;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds?: number;
  equipmentId?: string;
  uploadedById: string;
  status: MediaStatus;
  processingError?: string;
  technicalFindings?: string;
  extractedText?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export const IngestMediaSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title cannot exceed 200 characters"),
  description: z.string().trim().max(2000, "Description cannot exceed 2000 characters").optional().default(""),
  equipmentId: z
    .string()
    .trim()
    .refine((val) => !val || /^[0-9a-fA-F]{24}$/.test(val), {
      message: "Invalid equipment ID format: must be a 24-character hexadecimal ObjectId",
    })
    .optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional().default([]),
});
export type IngestMediaInput = z.infer<typeof IngestMediaSchema>;





// ─── Step-to-Source Lines & Number Fidelity Utilities ─────────────────────────

export interface HighlightColorTheme {
  id: string;
  name: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  glow: string;
  stroke: string;
}

export const STEP_SOURCE_COLOR_PALETTE: HighlightColorTheme[] = [
  {
    id: "amber",
    name: "Amber",
    badgeBg: "rgba(245, 158, 11, 0.20)",
    badgeBorder: "rgba(245, 158, 11, 0.55)",
    badgeText: "#FCD34D",
    glow: "rgba(245, 158, 11, 0.40)",
    stroke: "#F59E0B",
  },
  {
    id: "emerald",
    name: "Emerald",
    badgeBg: "rgba(16, 185, 129, 0.20)",
    badgeBorder: "rgba(16, 185, 129, 0.55)",
    badgeText: "#6EE7B7",
    glow: "rgba(16, 185, 129, 0.40)",
    stroke: "#10B981",
  },
  {
    id: "cyan",
    name: "Cyan",
    badgeBg: "rgba(6, 182, 212, 0.20)",
    badgeBorder: "rgba(6, 182, 212, 0.55)",
    badgeText: "#67E8F9",
    glow: "rgba(6, 182, 212, 0.40)",
    stroke: "#06B6D4",
  },
  {
    id: "purple",
    name: "Purple",
    badgeBg: "rgba(168, 85, 247, 0.20)",
    badgeBorder: "rgba(168, 85, 247, 0.55)",
    badgeText: "#D8B4FE",
    glow: "rgba(168, 85, 247, 0.40)",
    stroke: "#A855F7",
  },
  {
    id: "rose",
    name: "Rose",
    badgeBg: "rgba(244, 63, 94, 0.20)",
    badgeBorder: "rgba(244, 63, 94, 0.55)",
    badgeText: "#FDA4AF",
    glow: "rgba(244, 63, 94, 0.40)",
    stroke: "#F43F5E",
  },
  {
    id: "sky",
    name: "Sky",
    badgeBg: "rgba(14, 165, 233, 0.20)",
    badgeBorder: "rgba(14, 165, 233, 0.55)",
    badgeText: "#7DD3FC",
    glow: "rgba(14, 165, 233, 0.40)",
    stroke: "#0EA5E9",
  },
];

/**
 * Extracts numeric values, units, pressure, torque, percentages, and model/error codes.
 */
export function extractNumbersWithUnits(text?: string | null): string[] {
  if (!text || typeof text !== "string") return [];
  const matches =
    text.match(
      /\b(?:\d+(?:\.\d+)?(?:\s*(?:Nm|bar|BAR|psi|PSI|rpm|RPM|mm|cm|m|kg|g|mg|V|A|mA|kW|W|Hz|kHz|MHz|°C|°F|%))?|[A-Z]{1,3}\d{1,4})\b/g
    ) || [];
  const unique = Array.from(new Set(matches.map((m) => m.trim())));
  return unique.filter((u) => /\d/.test(u));
}

/**
 * Splits text into individual clean sentences while respecting abbreviations, decimals, and section numbers.
 */
export function splitTextIntoManualSentences(
  text: string,
  meta?: { source_id?: string; documentTitle?: string; page?: number; startIdIndex?: number }
): ManualSentenceDTO[] {
  if (!text || typeof text !== "string") return [];

  const startIndex = meta?.startIdIndex ?? 1;
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/([0-9])\.([0-9])/g, "$1___DOT___$2")
    .replace(/\b(Fig|fig|Rev|rev|No|no|e\.g|i\.e|vs|approx|min|max|sec|vol|ref|p)\.\s+/gi, "$1___ABBRDOT___ ");

  const rawSentences = normalized
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .map((s) =>
      s
        .replace(/___DOT___/g, ".")
        .replace(/___ABBRDOT___/g, ".")
        .trim()
    )
    .filter((s) => s.length > 5);

  return rawSentences.map((s, idx) => ({
    id: `sent-${startIndex + idx}`,
    text: s,
    source_id: meta?.source_id,
    documentTitle: meta?.documentTitle,
    page: meta?.page,
  }));
}

/**
 * Matches a worker step to the most faithful sentence in manual sentences based on numeric alignment and token overlap.
 */
export function matchStepToSourceSentence(
  stepText: string,
  sentences: ManualSentenceDTO[],
  stepSourceId?: string
): string | undefined {
  if (!sentences || sentences.length === 0) return undefined;

  const stepNumbers = extractNumbersWithUnits(stepText);
  let bestScore = -1;
  let bestId = sentences[0].id;

  const stepWords = stepText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);

  for (const sent of sentences) {
    let score = 0;
    const sentTextLower = sent.text.toLowerCase();

    // 1. Exact numeric matches (highest weight: 50 points per matching number)
    for (const num of stepNumbers) {
      if (sentTextLower.includes(num.toLowerCase())) {
        score += 50;
      } else {
        const digits = num.replace(/[^0-9.]/g, "");
        if (digits.length > 0 && sentTextLower.includes(digits)) {
          score += 25;
        }
      }
    }

    // 2. Word overlap (5 points per matching word)
    for (const word of stepWords) {
      if (sentTextLower.includes(word)) {
        score += 5;
      }
    }

    // 3. Source ID match bonus
    if (stepSourceId && sent.source_id === stepSourceId) {
      score += 15;
    }

    if (score > bestScore) {
      bestScore = score;
      bestId = sent.id;
    }
  }

  return bestId;
}
