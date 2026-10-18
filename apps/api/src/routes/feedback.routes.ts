import { Router, Response } from "express";
import { FeedbackSchema } from "@man-u-ai/shared";
import { Feedback } from "../models";
import { isConnectedToMongo } from "../config/database";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth";
import { toMongoObjectId } from "./documents.routes";

export const feedbackRouter: Router = Router();

feedbackRouter.post("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = FeedbackSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid feedback format", details: parsed.error.issues },
    });
  }

  const { messageId, rating, comment } = parsed.data;

  if (!isConnectedToMongo) {
    return res.status(503).json({
      success: false,
      error: { code: "SERVICE_UNAVAILABLE", message: "Database connection unavailable for feedback submission" },
    });
  }

  const userId = toMongoObjectId(req.user?.id);

  try {
    const feedback = await Feedback.create({
      messageId: toMongoObjectId(messageId),
      userId,
      rating,
      comment,
    });

    return res.status(201).json({
      success: true,
      data: {
        id: feedback._id.toString(),
        message: "Feedback received successfully",
      },
    });
  } catch (err) {
    console.error("[Feedback] Mongo save error:", err);
    return res.status(500).json({
      success: false,
      error: { code: "DATABASE_WRITE_FAILED", message: "Failed to persist feedback to database" },
    });
  }
});
