import { Router, Request, Response } from "express";
import { ragService } from "../services/rag.service";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth";
import { Message, Conversation } from "../models";
import { isConnectedToMongo } from "../config/database";

export const chatRouter: Router = Router();

chatRouter.post("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { message, conversationId, equipmentId } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({
      success: false,
      error: { code: "BAD_REQUEST", message: "Message text is required" },
    });
  }

  const userId = req.user?.id || "usr-demo-01";

  try {
    const result = await ragService.answerQuestion(message, userId, conversationId, equipmentId);

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
    return res.status(500).json({
      success: false,
      error: { code: "RAG_ERROR", message: "Error running multimodal RAG pipeline", details: String(err) },
    });
  }
});
