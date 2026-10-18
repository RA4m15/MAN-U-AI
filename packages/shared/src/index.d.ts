import { z } from "zod";
export declare const RegisterSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
    role: z.ZodDefault<z.ZodOptional<z.ZodEnum<["admin", "engineer", "viewer"]>>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    email: string;
    password: string;
    role: "admin" | "engineer" | "viewer";
}, {
    name: string;
    email: string;
    password: string;
    role?: "admin" | "engineer" | "viewer" | undefined;
}>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export declare const LoginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type UserRole = "admin" | "engineer" | "viewer";
export interface UserDTO {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    createdAt: string;
}
export type DocumentStatus = "pending" | "processing" | "indexed" | "failed";
export interface DocumentDTO {
    id: string;
    title: string;
    revision: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
    status: DocumentStatus;
    pageCount?: number;
    uploadedById: string;
    createdAt: string;
    updatedAt: string;
}
export declare const UploadDocumentSchema: z.ZodObject<{
    title: z.ZodString;
    revision: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    equipmentId: z.ZodOptional<z.ZodString>;
    tags: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    revision: string;
    tags: string[];
    equipmentId?: string | undefined;
}, {
    title: string;
    revision?: string | undefined;
    equipmentId?: string | undefined;
    tags?: string[] | undefined;
}>;
export type UploadDocumentInput = z.infer<typeof UploadDocumentSchema>;
export type JobStatus = "queued" | "running" | "done" | "failed";
export interface ProcessingJobDTO {
    id: string;
    documentId: string;
    status: JobStatus;
    progress: number;
    error?: string;
    startedAt?: string;
    finishedAt?: string;
}
export type MessageRole = "user" | "assistant" | "system";
export interface CitationDTO {
    id: string;
    documentId: string;
    documentTitle: string;
    revision: string;
    page: number;
    section?: string;
    excerpt: string;
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
    lastMessageAt: string;
    messageCount: number;
    createdAt: string;
}
export declare const SendMessageSchema: z.ZodObject<{
    content: z.ZodString;
    attachmentIds: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodString, "many">>>;
}, "strip", z.ZodTypeAny, {
    content: string;
    attachmentIds: string[];
}, {
    content: string;
    attachmentIds?: string[] | undefined;
}>;
export type SendMessageInput = z.infer<typeof SendMessageSchema>;
export interface EquipmentDTO {
    id: string;
    name: string;
    type: string;
    model: string;
    manufacturer: string;
    serialNumber?: string;
    location?: string;
    documentIds: string[];
    createdAt: string;
}
export declare const CreateEquipmentSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodString;
    model: z.ZodString;
    manufacturer: z.ZodString;
    serialNumber: z.ZodOptional<z.ZodString>;
    location: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: string;
    name: string;
    model: string;
    manufacturer: string;
    serialNumber?: string | undefined;
    location?: string | undefined;
}, {
    type: string;
    name: string;
    model: string;
    manufacturer: string;
    serialNumber?: string | undefined;
    location?: string | undefined;
}>;
export type CreateEquipmentInput = z.infer<typeof CreateEquipmentSchema>;
export declare const FeedbackSchema: z.ZodObject<{
    messageId: z.ZodString;
    rating: z.ZodEnum<["up", "down"]>;
    comment: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    messageId: string;
    rating: "up" | "down";
    comment?: string | undefined;
}, {
    messageId: string;
    rating: "up" | "down";
    comment?: string | undefined;
}>;
export type FeedbackInput = z.infer<typeof FeedbackSchema>;
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
export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}
export declare const PaginationSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, "strip", z.ZodTypeAny, {
    page: number;
    limit: number;
}, {
    page?: number | undefined;
    limit?: number | undefined;
}>;
