import mongoose, { Schema, Document as MongooseDocument } from "mongoose";
import bcrypt from "bcryptjs";
import type {
  UserRole,
  DocumentStatus,
  JobStatus,
  MessageRole,
  FigureStatus,
  SafetyCategory,
  PlantGlossaryCategory,
  TicketStatus,
  TaskPriority,
  TaskStatus,
} from "@man-u-ai/shared";

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
    role: { type: String, enum: ["admin", "engineer", "operator", "manager"], default: "operator" },
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
export interface IComponentMetadata {
  partId: string;
  name: string;
  description?: string;
  parentAssemblyId?: string;
  aliases?: string[];
  documentReferences?: string[];
  technicalSpecifications?: Record<string, any>;
  maintenanceInstructions?: string[];
}

export interface ICadModelMetadata {
  available: boolean;
  format?: string | null;
  storageReference?: string | null;
  version?: string | null;
  fileSizeBytes?: number | null;
  uploadedAt?: Date | null;
}

export interface IEquipment {
  name: string;
  type: string;
  category?: string;
  model?: string;
  manufacturer?: string;
  serialNumber?: string;
  location?: string;
  referenceImage?: string | null;
  cadModel?: ICadModelMetadata;
  documentIds: string[];
  telemetryConfig?: Record<string, any>;
  components?: IComponentMetadata[];
  explosionConfiguration?: Record<string, any> | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const EquipmentSchema = new Schema<IEquipment>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true },
    category: { type: String },
    model: { type: String },
    manufacturer: { type: String },
    serialNumber: { type: String },
    location: { type: String },
    referenceImage: { type: String },
    cadModel: {
      available: { type: Boolean, default: false },
      format: { type: String, default: null },
      storageReference: { type: String, default: null },
      version: { type: String, default: null },
      fileSizeBytes: { type: Number, default: null },
      uploadedAt: { type: Date, default: null },
    },
    documentIds: [{ type: Schema.Types.ObjectId, ref: "Document" }],
    telemetryConfig: { type: Schema.Types.Mixed },
    explosionConfiguration: { type: Schema.Types.Mixed, default: null },
    components: [
      {
        partId: { type: String, required: true },
        name: { type: String, required: true },
        description: { type: String },
        parentAssemblyId: { type: String },
        aliases: [{ type: String }],
        documentReferences: [{ type: String }],
        technicalSpecifications: { type: Schema.Types.Mixed },
        maintenanceInstructions: [{ type: String }],
      },
    ],
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
  ownerName?: string;
  ownerEmail?: string;
  reviewDate?: Date;
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
    ownerName: { type: String, trim: true },
    ownerEmail: { type: String, trim: true },
    reviewDate: { type: Date },
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
  safetyCategory?: SafetyCategory;
  ppeTags?: string[];
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
    safetyCategory: {
      type: String,
      enum: ["hazard_warning", "ppe_required", "loto_isolation", "general_procedure"],
      default: "general_procedure",
    },
    ppeTags: [{ type: String }],
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
    role: { type: String, enum: ["admin", "engineer", "operator", "manager"] },
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
  messageType?: string;
  explodedView?: {
    machineId: string;
    machineName: string;
    modelUrl: string;
    title: string;
    description: string;
    conversationId?: string;
    initialStep?: number;
    totalSteps?: number;
    sequenceConfig?: Record<string, any>;
    viewerInstanceId?: string;
    isCadPending?: boolean;
    referenceImage?: string | null;
    documentation?: string[];
  };
  citations: Array<{
    documentId: string;
    documentTitle: string;
    revision: string;
    page: number;
    section?: string;
    excerpt: string;
    safetyCategory?: SafetyCategory;
    isOverdue?: boolean;
    reviewDate?: string;
  }>;
  machineContext?: {
    machineId: string;
    machineName?: string;
    selectedPartId?: string;
    selectedPartName?: string;
    parentAssemblyId?: string;
    currentExplosionStep?: number;
  };
  warningLevel?: "none" | "caution" | "critical";
  safetyPreconditions?: {
    warnings: string[];
    ppeRequired: string[];
    lotoSteps: string[];
    isOverdueWarning?: string;
  };
  expandedTerms?: string[];
  createdAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    role: { type: String, enum: ["user", "assistant", "system"], required: true },
    content: { type: String, required: true },
    messageType: { type: String, default: "text" },
    explodedView: {
      machineId: { type: String },
      machineName: { type: String },
      modelUrl: { type: String },
      title: { type: String },
      description: { type: String },
      conversationId: { type: String },
      initialStep: { type: Number },
      totalSteps: { type: Number },
      sequenceConfig: { type: Schema.Types.Mixed },
      viewerInstanceId: { type: String },
      isCadPending: { type: Boolean, default: false },
      referenceImage: { type: String },
      documentation: [{ type: String }],
    },
    citations: [
      {
        documentId: { type: String },
        documentTitle: { type: String },
        revision: { type: String },
        page: { type: Number },
        section: { type: String },
        excerpt: { type: String },
        safetyCategory: { type: String },
        isOverdue: { type: Boolean },
        reviewDate: { type: String },
      },
    ],
    machineContext: {
      machineId: { type: String },
      machineName: { type: String },
      selectedPartId: { type: String },
      selectedPartName: { type: String },
      parentAssemblyId: { type: String },
      currentExplosionStep: { type: Number },
    },
    warningLevel: { type: String, enum: ["none", "caution", "critical"], default: "none" },
    safetyPreconditions: {
      warnings: [{ type: String }],
      ppeRequired: [{ type: String }],
      lotoSteps: [{ type: String }],
      isOverdueWarning: { type: String },
    },
    expandedTerms: [{ type: String }],
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

// ── 14. Plant Glossary & Slang Mapping Model ──────────────────────────────
export interface IPlantGlossary extends MongooseDocument {
  term: string;
  canonicalTerm: string;
  equipmentTag?: string;
  category: PlantGlossaryCategory;
  synonyms: string[];
  plantArea?: string;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PlantGlossarySchema = new Schema<IPlantGlossary>(
  {
    term: { type: String, required: true, trim: true, index: true },
    canonicalTerm: { type: String, required: true, trim: true },
    equipmentTag: { type: String, trim: true },
    category: {
      type: String,
      enum: ["slang", "equipment_tag", "abbreviation", "component"],
      default: "slang",
    },
    synonyms: [{ type: String, trim: true }],
    plantArea: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

PlantGlossarySchema.index({ term: "text", canonicalTerm: "text", synonyms: "text" });

export const PlantGlossary = mongoose.model<IPlantGlossary>("PlantGlossary", PlantGlossarySchema);

// ── 15. Glossary Suggestions Model ─────────────────────────────────────────
export interface IGlossarySuggestion extends MongooseDocument {
  rawQuery: string;
  unmatchedTerms: string[];
  frequency: number;
  lastSearchedAt: Date;
  status: "pending" | "approved" | "dismissed";
  suggestedCanonical?: string;
  createdAt: Date;
  updatedAt: Date;
}

const GlossarySuggestionSchema = new Schema<IGlossarySuggestion>(
  {
    rawQuery: { type: String, required: true, trim: true },
    unmatchedTerms: [{ type: String, trim: true }],
    frequency: { type: Number, default: 1 },
    lastSearchedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["pending", "approved", "dismissed"],
      default: "pending",
    },
    suggestedCanonical: { type: String, trim: true },
  },
  { timestamps: true }
);

GlossarySuggestionSchema.index({ status: 1, lastSearchedAt: -1 });

export const GlossarySuggestion = mongoose.model<IGlossarySuggestion>("GlossarySuggestion", GlossarySuggestionSchema);

// ── 16. Refusal-to-Fix Documentation Ticket Model ──────────────────────────
export interface IDocRequestTicket extends MongooseDocument {
  ticketNumber: string;
  equipmentId?: mongoose.Types.ObjectId;
  equipmentName?: string;
  requestedBy: mongoose.Types.ObjectId;
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
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DocRequestTicketSchema = new Schema<IDocRequestTicket>(
  {
    ticketNumber: { type: String, required: true, unique: true },
    equipmentId: { type: Schema.Types.ObjectId, ref: "Equipment" },
    equipmentName: { type: String, trim: true },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    userQuery: { type: String, required: true, trim: true },
    searchContext: { type: String },
    closestMatch: {
      documentTitle: { type: String },
      page: { type: Number },
      score: { type: Number },
    },
    status: {
      type: String,
      enum: ["open", "assigned", "uploaded", "closed"],
      default: "open",
    },
    assignedToEmail: { type: String, trim: true },
    resolutionNotes: { type: String },
    resolvedAt: { type: Date },
  },
  { timestamps: true }
);

DocRequestTicketSchema.index({ status: 1, createdAt: -1 });

export const DocRequestTicket = mongoose.model<IDocRequestTicket>("DocRequestTicket", DocRequestTicketSchema);

// ── 17. Tap-the-Part Diagram Annotation Model ──────────────────────────────
export interface IDiagramHotspot {
  id: string;
  partNumber: string;
  partName: string;
  boundingBox: [number, number, number, number]; // [ymin, xmin, ymax, xmax] 0-1000
  manualPage?: number;
  description?: string;
}

export interface IDiagramAnnotation extends MongooseDocument {
  figureId: string;
  documentId: mongoose.Types.ObjectId;
  documentTitle: string;
  page: number;
  title?: string;
  hotspots: IDiagramHotspot[];
  createdAt: Date;
  updatedAt: Date;
}

const DiagramAnnotationSchema = new Schema<IDiagramAnnotation>(
  {
    figureId: { type: String, required: true, index: true },
    documentId: { type: Schema.Types.ObjectId, ref: "Document", required: true, index: true },
    documentTitle: { type: String, required: true },
    page: { type: Number, required: true },
    title: { type: String },
    hotspots: [
      {
        id: { type: String, required: true },
        partNumber: { type: String, required: true },
        partName: { type: String, required: true },
        boundingBox: { type: [Number], required: true },
        manualPage: { type: Number },
        description: { type: String },
      },
    ],
  },
  { timestamps: true }
);

DiagramAnnotationSchema.index({ documentId: 1, figureId: 1 }, { unique: true });

export const DiagramAnnotation = mongoose.model<IDiagramAnnotation>("DiagramAnnotation", DiagramAnnotationSchema);

// ── 18. Shift Task & Work Order Model ──────────────────────────────────────
export interface ITask extends MongooseDocument {
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  equipmentId?: string;
  equipmentName?: string;
  assignedTo: string;
  assignedToName?: string;
  shift: string;
  dueDate?: Date;
  createdById: string;
  createdByName: string;
  completionNotes?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TaskMongooseSchema = new Schema<ITask>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    priority: {
      type: String,
      enum: ["critical", "high", "medium", "low"],
      default: "medium",
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "cancelled"],
      default: "pending",
      index: true,
    },
    equipmentId: { type: String, trim: true },
    equipmentName: { type: String, trim: true },
    assignedTo: { type: String, default: "all", index: true },
    assignedToName: { type: String, default: "All Field Engineers" },
    shift: { type: String, default: "today" },
    dueDate: { type: Date },
    createdById: { type: String, required: true },
    createdByName: { type: String, required: true },
    completionNotes: { type: String },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

TaskMongooseSchema.index({ status: 1, createdAt: -1 });

export const Task = mongoose.model<ITask>("Task", TaskMongooseSchema);

// ─── Machine Media Evidence Model ───────────────────────────────────────────

export interface IMedia extends MongooseDocument {
  title: string;
  description?: string;
  mediaType: "image" | "video";
  originalFilename: string;
  storagePath: string;
  storageProvider: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds?: number;
  equipmentId?: mongoose.Types.ObjectId;
  uploadedById: mongoose.Types.ObjectId;
  status: "uploading" | "uploaded" | "processing" | "indexed" | "failed";
  processingError?: string;
  technicalFindings?: string;
  extractedText?: string;
  tags: string[];
  thumbnailPath?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const MediaSchema = new Schema<IMedia>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    mediaType: { type: String, enum: ["image", "video"], required: true, index: true },
    originalFilename: { type: String, required: true },
    storagePath: { type: String, required: true },
    storageProvider: { type: String, default: "local" },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    durationSeconds: { type: Number },
    equipmentId: { type: Schema.Types.ObjectId, ref: "Equipment", index: true },
    uploadedById: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: {
      type: String,
      enum: ["uploading", "uploaded", "processing", "indexed", "failed"],
      default: "processing",
      index: true,
    },
    processingError: { type: String },
    technicalFindings: { type: String },
    extractedText: { type: String },
    tags: { type: [String], default: [] },
    thumbnailPath: { type: String },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

MediaSchema.index({ createdAt: -1 });
MediaSchema.index({ equipmentId: 1, createdAt: -1 });

export const MediaModel = mongoose.model<IMedia>("Media", MediaSchema);

