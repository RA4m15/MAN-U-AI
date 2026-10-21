import { Router, Response } from "express";
import mongoose from "mongoose";
import { ragService } from "../services/rag.service";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth";
import { Message, Conversation, Equipment } from "../models";
import { isConnectedToMongo } from "../config/database";
import { extractStructuredErrorInfo, logStructuredError } from "../utils/errorReporting";
import { toMongoObjectId } from "./documents.routes";

export const chatRouter: Router = Router();

chatRouter.post("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { message, conversationId, equipmentId } = req.body;
  const requestId = (req as any).id;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({
      success: false,
      error: { code: "BAD_REQUEST", message: "Message text is required" },
    });
  }

  const userContext = req.user
    ? { id: req.user.id, role: req.user.role }
    : { id: "usr-demo-01", role: "viewer" };

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
      requestId
    );

    if (isConnectedToMongo && conversationId) {
      try {
        await Message.create({
          conversationId,
          role: "user",
          content: message,
        });
        await Message.create({
          conversationId,
          role: "assistant",
          content: result.answer,
          citations: result.citations,
        });
        await Conversation.findByIdAndUpdate(conversationId, {
          lastMessageAt: new Date(),
        });
      } catch (err) {
        console.warn("[ChatRouter] Could not save messages to Mongo:", err);
      }
    }

    return res.json({
      success: true,
      data: {
        answer: result.answer,
        citations: result.citations,
        warningLevel: result.warningLevel,
        confidenceScore: result.confidenceScore,
        provider: result.provider,
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
