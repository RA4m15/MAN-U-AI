import { Router, Request, Response } from "express";
import { FeedbackSchema } from "@man-u-ai/shared";
import { Feedback } from "../models";
import { isConnectedToMongo } from "../config/database";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth";

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

  if (isConnectedToMongo) {
    try {
      await Feedback.create({
        messageId,
        userId: req.user?.id || "usr-demo-01",
        rating,
        comment,
      });
    } catch (err) {
      console.warn("[Feedback] Mongo save error:", err);
    }
  }

  return res.status(201).json({
    success: true,
    data: { message: "Feedback received successfully" },
  });
});
