import { Router, Request, Response } from "express";
import { ragService } from "../services/rag.service";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth";
import { Message, Conversation } from "../models";
import { isConnectedToMongo } from "../config/database";
import { extractStructuredErrorInfo, logStructuredError } from "../utils/errorReporting";

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
    const result = await ragService.answerQuestion(message, userContext, conversationId, equipmentId, requestId);

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
