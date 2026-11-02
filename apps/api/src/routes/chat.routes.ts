import { Router, Response } from "express";
import mongoose from "mongoose";
import { ragService } from "../services/rag.service";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth";
import { Message, Conversation, Equipment } from "../models";
import { isConnectedToMongo } from "../config/database";
import { extractStructuredErrorInfo, logStructuredError } from "../utils/errorReporting";
import { toMongoObjectId } from "./documents.routes";
import { SendMessageSchema, MachineContextDTO } from "@man-u-ai/shared";
import { machineComponentService } from "../services/component.service";

export const chatRouter: Router = Router();

chatRouter.post("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = SendMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const message = firstIssue?.message || "Message text is required";
    return res.status(400).json({
      success: false,
      error: { code: "BAD_REQUEST", message, details: parsed.error.issues },
    });
  }

  const message = (parsed.data.message || parsed.data.content)!.trim();
  const conversationId = parsed.data.conversationId;
  const equipmentId = parsed.data.equipmentId;
  const preferredLanguage = parsed.data.preferredLanguage;
  const simpler = parsed.data.simpler;
  const requestId = (req as any).id;

  const userContext = req.user
    ? { id: req.user.id, role: req.user.role }
    : { id: "usr-demo-01", role: "operator" };

  try {
    let resolvedEquipmentId = equipmentId;

    // Validate equipmentId if explicitly provided
    if (equipmentId !== undefined && equipmentId !== null && equipmentId !== "") {
      const rawEqId = String(equipmentId);
      if (!mongoose.Types.ObjectId.isValid(rawEqId)) {
        return res.status(400).json({
          success: false,
          error: { code: "INVALID_EQUIPMENT_ID", message: "Invalid equipment ID format" },
        });
      }
      if (isConnectedToMongo) {
        const eqDoc = await Equipment.findById(rawEqId);
        if (!eqDoc) {
          return res.status(404).json({
            success: false,
            error: { code: "EQUIPMENT_NOT_FOUND", message: "Referenced equipment does not exist" },
          });
        }
      }
    }

    // Validate machineContext if provided
    let validatedMachineContext: MachineContextDTO | undefined = undefined;
    if (parsed.data.machineContext) {
      const mc = parsed.data.machineContext;
      const ownership = await machineComponentService.validateComponentOwnership(
        mc.machineId,
        mc.selectedPartId
      );

      if (!ownership.valid) {
        if (!ownership.machine) {
          return res.status(404).json({
            success: false,
            error: {
              code: "INVALID_MACHINE_ID",
              message: ownership.error || `Referenced machine '${mc.machineId}' does not exist`,
            },
          });
        }
        return res.status(400).json({
          success: false,
          error: {
            code: "INVALID_COMPONENT_ID",
            message: ownership.error || `Component '${mc.selectedPartId}' does not belong to machine '${mc.machineId}'`,
          },
        });
      }

      // Populate authoritative metadata
      validatedMachineContext = {
        machineId: mc.machineId,
        machineName: ownership.machine?.name || mc.machineName || mc.machineId,
        selectedPartId: mc.selectedPartId,
        selectedPartName: ownership.component?.name || mc.selectedPartName,
        parentAssemblyId: ownership.component?.parentAssemblyId || mc.parentAssemblyId,
        currentExplosionStep: mc.currentExplosionStep,
      };
    }

    if (isConnectedToMongo && conversationId) {
      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        return res.status(400).json({
          success: false,
          error: { code: "INVALID_CONVERSATION_ID", message: "Invalid conversation ID format" },
        });
      }

      const conv = await Conversation.findById(conversationId);
      if (!conv) {
        return res.status(404).json({
          success: false,
          error: { code: "NOT_FOUND", message: "Conversation not found" },
        });
      }

      // Authorization: Check conversation ownership or admin role
      const userOid = toMongoObjectId(req.user?.id);
      const convUserIdStr = conv.userId ? conv.userId.toString() : "";
      const isOwner = convUserIdStr === req.user?.id || convUserIdStr === userOid.toString();
      const isAdmin = req.user?.role === "admin";
      if (!isOwner && !isAdmin) {
        return res.status(403).json({
          success: false,
          error: { code: "FORBIDDEN", message: "Access to conversation denied: unauthorized" },
        });
      }

      // Check authoritative equipment association
      if (conv.equipmentId) {
        const boundEqId = conv.equipmentId.toString();
        if (equipmentId && equipmentId.toString() !== boundEqId) {
          return res.status(400).json({
            success: false,
            error: {
              code: "EQUIPMENT_MISMATCH",
              message: "Equipment ID does not match the active conversation's equipment. A new conversation must be started when switching equipment.",
            },
          });
        }
        resolvedEquipmentId = boundEqId;
      } else if (resolvedEquipmentId) {
        await Conversation.findByIdAndUpdate(conversationId, {
          equipmentId: toMongoObjectId(resolvedEquipmentId),
        });
      }
    }

    const result = await ragService.answerQuestion(
      message,
      userContext,
      conversationId,
      resolvedEquipmentId,
      requestId,
      { preferredLanguage, simpler, machineContext: validatedMachineContext }
    );

    if (isConnectedToMongo && conversationId) {
      try {
        await Message.create({
          conversationId,
          role: "user",
          content: message,
          machineContext: validatedMachineContext,
        });
        await Message.create({
          conversationId,
          role: "assistant",
          content: result.answer,
          workerAnswer: result.workerAnswer,
          citations: result.citations,
          warningLevel: result.warningLevel,
          safetyPreconditions: result.safetyPreconditions,
          expandedTerms: result.expandedTerms,
          machineContext: validatedMachineContext,
        });
        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessageAt: new Date(),
        });
      } catch (err) {
        console.warn("[ChatRouter] Could not save messages to Mongo:", err);
      }
    }

    if (res.headersSent) return;
    return res.json({
      success: true,
      data: {
        answer: result.answer,
        workerAnswer: result.workerAnswer,
        citations: result.citations,
        warningLevel: result.warningLevel,
        confidenceScore: result.confidenceScore,
        provider: result.provider,
        safetyPreconditions: result.safetyPreconditions,
        suggestedTicket: result.suggestedTicket,
        expandedTerms: result.expandedTerms,
        machineContext: validatedMachineContext,
      },
    });
  } catch (err: unknown) {
    const failedStage = (err as any)?.stage || "rag_pipeline";
    const errorInfo = extractStructuredErrorInfo(err, failedStage, req);
    logStructuredError(errorInfo, {
      conversationId,
      equipmentId,
      userRole: req.user?.role,
    });

    if (res.headersSent) return;
    const status = errorInfo.httpStatus || 500;
    const retryAfter = (err as any)?.retryAfterSeconds;
    const errorPayload: Record<string, any> = {
      code: errorInfo.code || "RAG_ERROR",
      message: "Error running multimodal RAG pipeline",
      details: errorInfo.sanitizedMessage,
      stage: errorInfo.stage,
      requestId: errorInfo.requestId,
    };
    if (typeof retryAfter === "number" && retryAfter > 0) {
      errorPayload.retryAfter = retryAfter;
    }
    return res.status(status).json({
      success: false,
      error: errorPayload,
    });
  }
});
