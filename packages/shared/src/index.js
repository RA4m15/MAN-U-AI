"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaginationSchema = exports.FeedbackSchema = exports.CreateEquipmentSchema = exports.SendMessageSchema = exports.UploadDocumentSchema = exports.LoginSchema = exports.RegisterSchema = void 0;
const zod_1 = require("zod");
// ─── Auth ───────────────────────────────────────────────────────────────────
exports.RegisterSchema = zod_1.z.object({
    name: zod_1.z.string().min(2).max(100),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(8).max(128),
    role: zod_1.z.enum(["admin", "engineer", "viewer"]).optional().default("viewer"),
});
exports.LoginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(1),
});
exports.UploadDocumentSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(255),
    revision: zod_1.z.string().max(50).optional().default("v1"),
    equipmentId: zod_1.z.string().optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional().default([]),
});
exports.SendMessageSchema = zod_1.z.object({
    content: zod_1.z.string().min(1).max(8000),
    attachmentIds: zod_1.z.array(zod_1.z.string()).optional().default([]),
});
exports.CreateEquipmentSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(255),
    type: zod_1.z.string().min(1),
    model: zod_1.z.string().min(1),
    manufacturer: zod_1.z.string().min(1),
    serialNumber: zod_1.z.string().optional(),
    location: zod_1.z.string().optional(),
});
// ─── Feedback ────────────────────────────────────────────────────────────────
exports.FeedbackSchema = zod_1.z.object({
    messageId: zod_1.z.string(),
    rating: zod_1.z.enum(["up", "down"]),
    comment: zod_1.z.string().max(1000).optional(),
});
exports.PaginationSchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().optional().default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).optional().default(20),
});
//# sourceMappingURL=index.js.map