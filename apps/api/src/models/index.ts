import mongoose, { Schema, Document as MongooseDocument } from "mongoose";
import bcrypt from "bcryptjs";
import type { UserRole, DocumentStatus, JobStatus, MessageRole, FigureStatus } from "@man-u-ai/shared";

// ── 1. User Model ──────────────────────────────────────────────────────────
export interface IUser extends MongooseDocument {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  orgId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["admin", "engineer", "viewer", "manager"], default: "viewer" },
    orgId: { type: String, default: "default-plant-org" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

UserSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.passwordHash);
};

export const User = mongoose.model<IUser>("User", UserSchema);

// ── 2. Equipment Model ─────────────────────────────────────────────────────
export interface IEquipment {
  name: string;
  type: string;
  model?: string;
  manufacturer?: string;
  serialNumber?: string;
  location?: string;
  documentIds: string[];
  telemetryConfig?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

const EquipmentSchema = new Schema<IEquipment>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true },
    model: { type: String },
    manufacturer: { type: String },
    serialNumber: { type: String },
    location: { type: String },
    documentIds: [{ type: Schema.Types.ObjectId, ref: "Document" }],
    telemetryConfig: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

export const Equipment = mongoose.model<IEquipment>("Equipment", EquipmentSchema);

// ── 3. Document Model ──────────────────────────────────────────────────────
export interface IDocumentModel extends MongooseDocument {
  title: string;
  revision: string;
  filename: string;
  storagePath: string;
  storageProvider?: "local" | "cloudinary" | "s3" | "gcs";
  mimeType: string;
  sizeBytes: number;
  status: DocumentStatus;
  pageCount?: number;
  processingError?: string;
  equipmentId?: mongoose.Types.ObjectId;
  tags: string[];
  uploadedById: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema = new Schema<IDocumentModel>(
  {
    title: { type: String, required: true, trim: true },
    revision: { type: String, default: "v1.0" },
    filename: { type: String, required: true },
    storagePath: { type: String, required: true },
    storageProvider: {
      type: String,
      enum: ["local", "cloudinary", "s3", "gcs"],
      default: "local",
    },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "processing", "indexed", "failed", "needs_ocr"],
      default: "pending",
    },
    pageCount: { type: Number, default: 0 },
    processingError: { type: String },
    equipmentId: { type: Schema.Types.ObjectId, ref: "Equipment" },
    tags: [{ type: String }],
    uploadedById: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

DocumentSchema.index({ title: "text", tags: "text" });

export const DocumentModel = mongoose.model<IDocumentModel>("Document", DocumentSchema);

// ── 4. Document Chunk (Vector Store Model) ─────────────────────────────────
export interface IDocumentChunk extends MongooseDocument {
  documentId: mongoose.Types.ObjectId;
  documentTitle: string;
  revision: string;
  page: number;
  section?: string;
  text: string;
  embedding: number[];
  tokenCount: number;
  figureIds?: string[];
  createdAt: Date;
}

const DocumentChunkSchema = new Schema<IDocumentChunk>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: "Document", required: true, index: true },
    documentTitle: { type: String, required: true },
    revision: { type: String, default: "v1.0" },
    page: { type: Number, required: true },
    section: { type: String },
    text: { type: String, required: true },
    embedding: { type: [Number], required: true },
    tokenCount: { type: Number, default: 0 },
    figureIds: [{ type: String }],
  },
  { timestamps: true }
);

DocumentChunkSchema.index({ documentId: 1, page: 1 });
DocumentChunkSchema.index({ documentTitle: 1 });
DocumentChunkSchema.index({ text: "text" });
DocumentChunkSchema.index({ createdAt: -1 });

export const DocumentChunk = mongoose.model<IDocumentChunk>("DocumentChunk", DocumentChunkSchema);

// ── 4b. Document Figure Model (Multimodal Visual Metadata & References) ─────
export interface IDocumentFigure extends MongooseDocument {
  documentId: mongoose.Types.ObjectId;
  documentTitle: string;
  revision: string;
  page: number;
  figureId: string;
  title?: string;
  caption?: string;
  storagePath?: string;
  storageProvider?: "local" | "cloudinary" | "s3" | "gcs";
  mimeType?: string;
  sizeBytes?: number;
  dimensions?: { width: number; height: number };
  status: FigureStatus;
  processingError?: string;
  associatedChunkIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

const DocumentFigureSchema = new Schema<IDocumentFigure>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: "Document", required: true, index: true },
    documentTitle: { type: String, required: true },
    revision: { type: String, default: "v1.0" },
    page: { type: Number, required: true },
    figureId: { type: String, required: true },
    title: { type: String },
    caption: { type: String },
    storagePath: { type: String },
    storageProvider: {
      type: String,
      enum: ["local", "cloudinary", "s3", "gcs"],
      default: "local",
    },
    mimeType: { type: String },
    sizeBytes: { type: Number },
    dimensions: {
      width: { type: Number },
      height: { type: Number },
    },
    status: {
      type: String,
      enum: ["pending", "extracted", "failed", "unavailable"],
      default: "pending",
    },
    processingError: { type: String },
    associatedChunkIds: [{ type: String }],
  },
  { timestamps: true }
);

DocumentFigureSchema.index({ documentId: 1, page: 1 });
DocumentFigureSchema.index({ documentId: 1, figureId: 1 });

export const DocumentFigure = mongoose.model<IDocumentFigure>("DocumentFigure", DocumentFigureSchema);

// ── 5. Document Permission Model ───────────────────────────────────────────
export interface IDocumentPermission extends MongooseDocument {
  documentId: mongoose.Types.ObjectId;
  role?: UserRole;
  userId?: mongoose.Types.ObjectId;
  canRead: boolean;
  canWrite: boolean;
}

const DocumentPermissionSchema = new Schema<IDocumentPermission>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: "Document", required: true, index: true },
    role: { type: String, enum: ["admin", "engineer", "viewer", "manager"] },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    canRead: { type: Boolean, default: true },
    canWrite: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const DocumentPermission = mongoose.model<IDocumentPermission>("DocumentPermission", DocumentPermissionSchema);

// ── 6. Processing Job Model ────────────────────────────────────────────────
export interface IProcessingJob extends MongooseDocument {
  documentId: mongoose.Types.ObjectId;
  status: JobStatus;
  progress: number;
  error?: string;
  startedAt?: Date;
  finishedAt?: Date;
  createdAt: Date;
}

const ProcessingJobSchema = new Schema<IProcessingJob>(
  {
    documentId: { type: Schema.Types.ObjectId, ref: "Document", required: true, index: true },
    status: {
      type: String,
      enum: ["queued", "running", "done", "failed"],
      default: "queued",
    },
    progress: { type: Number, default: 0 },
    error: { type: String },
    startedAt: { type: Date },
    finishedAt: { type: Date },
  },
  { timestamps: true }
);

export const ProcessingJob = mongoose.model<IProcessingJob>("ProcessingJob", ProcessingJobSchema);

// ── 7. Conversation Model ──────────────────────────────────────────────────
export interface IConversation extends MongooseDocument {
  userId: mongoose.Types.ObjectId;
  title: string;
  equipmentId?: mongoose.Types.ObjectId;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, default: "New Technical Ingestion" },
    equipmentId: { type: Schema.Types.ObjectId, ref: "Equipment" },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const Conversation = mongoose.model<IConversation>("Conversation", ConversationSchema);

// ── 8. Message Model ───────────────────────────────────────────────────────
export interface IMessage extends MongooseDocument {
  conversationId: mongoose.Types.ObjectId;
  role: MessageRole;
  content: string;
  citations: Array<{
    documentId: string;
    documentTitle: string;
    revision: string;
    page: number;
    section?: string;
    excerpt: string;
  }>;
  createdAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    role: { type: String, enum: ["user", "assistant", "system"], required: true },
    content: { type: String, required: true },
    citations: [
      {
        documentId: { type: String },
        documentTitle: { type: String },
        revision: { type: String },
        page: { type: Number },
        section: { type: String },
        excerpt: { type: String },
      },
    ],
  },
  { timestamps: true }
);

export const Message = mongoose.model<IMessage>("Message", MessageSchema);

// ── 9. User Feedback Model ─────────────────────────────────────────────────
export interface IFeedback extends MongooseDocument {
  messageId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  rating: "up" | "down";
  comment?: string;
  createdAt: Date;
}

const FeedbackSchema = new Schema<IFeedback>(
  {
    messageId: { type: Schema.Types.ObjectId, ref: "Message", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: String, enum: ["up", "down"], required: true },
    comment: { type: String },
  },
  { timestamps: true }
);

export const Feedback = mongoose.model<IFeedback>("Feedback", FeedbackSchema);

// ── 10. Audit Event Model ──────────────────────────────────────────────────
export interface IAuditEvent extends MongooseDocument {
  userId?: mongoose.Types.ObjectId;
  userEmail?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  createdAt: Date;
}

const AuditEventSchema = new Schema<IAuditEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    userEmail: { type: String },
    action: { type: String, required: true, index: true },
    resourceType: { type: String, required: true },
    resourceId: { type: String },
    details: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
  },
  { timestamps: true }
);

export const AuditEvent = mongoose.model<IAuditEvent>("AuditEvent", AuditEventSchema);

// ── 11. Maintenance Issue Model ────────────────────────────────────────────
export interface IMaintenanceIssue extends MongooseDocument {
  equipmentId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "resolved" | "closed";
  reportedById: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const MaintenanceIssueSchema = new Schema<IMaintenanceIssue>(
  {
    equipmentId: { type: Schema.Types.ObjectId, ref: "Equipment", required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    severity: { type: String, enum: ["low", "medium", "high", "critical"], default: "medium" },
    status: { type: String, enum: ["open", "in_progress", "resolved", "closed"], default: "open" },
    reportedById: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const MaintenanceIssue = mongoose.model<IMaintenanceIssue>("MaintenanceIssue", MaintenanceIssueSchema);

// ── 12. Summary Model ──────────────────────────────────────────────────────
export interface ISummary extends MongooseDocument {
  title: string;
  type: string;
  shift: string;
  author: string;
  equipmentCovered: string[];
  keyHighlights: string[];
  fullMarkdown: string;
  createdAt: Date;
  updatedAt: Date;
}

const SummarySchema = new Schema<ISummary>(
  {
    title: { type: String, required: true },
    type: { type: String, required: true },
    shift: { type: String, default: "Current Operational Window" },
    author: { type: String, default: "MAN-U-AI Gemini 2.0 Agent" },
    equipmentCovered: [{ type: String }],
    keyHighlights: [{ type: String }],
    fullMarkdown: { type: String, required: true },
  },
  { timestamps: true }
);

export const SummaryModel = mongoose.model<ISummary>("Summary", SummarySchema);

// ── 13. Facility / Application Settings Model ──────────────────────────────
export interface IFacilitySettings extends MongooseDocument {
  facilityName: string;
  timezone: string;
  selectedModel: string;
  temperature: number;
  topK: number;
  similarityThreshold: number;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const FacilitySettingsSchema = new Schema<IFacilitySettings>(
  {
    facilityName: { type: String, default: "MAN-U-AI Heavy Operations Facility Alpha" },
    timezone: { type: String, default: "UTC+05:30 (IST)" },
    selectedModel: { type: String, default: "gemini-3.8-flash" },
    temperature: { type: Number, default: 0.2 },
    topK: { type: Number, default: 5 },
    similarityThreshold: { type: Number, default: 0.5 },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const FacilitySettings = mongoose.model<IFacilitySettings>("FacilitySettings", FacilitySettingsSchema);
