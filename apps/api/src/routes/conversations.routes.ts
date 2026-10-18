import { Router, Response } from "express";
import { Conversation, Message } from "../models";
import { isConnectedToMongo } from "../config/database";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth";
import { toMongoObjectId } from "./documents.routes";

export const conversationsRouter: Router = Router();

// GET /conversations - List conversations for the authenticated user
conversationsRouter.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!isConnectedToMongo) {
    return res.status(503).json({
      success: false,
      error: { code: "SERVICE_UNAVAILABLE", message: "Database connection unavailable" },
    });
  }

  try {
    const userOid = toMongoObjectId(req.user?.id);
    const convs = await Conversation.find({
      $or: [{ userId: req.user?.id }, { userId: userOid }],
    })
      .sort({ lastMessageAt: -1 })
      .limit(50);
    return res.json({
      success: true,
      data: convs.map((c) => ({
        id: c._id.toString(),
        title: c.title,
        lastMessageAt: c.lastMessageAt.toISOString(),
        createdAt: c.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[Conversations] Query error:", err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to retrieve conversations" },
    });
  }
});

// POST /conversations - Create a new conversation for authenticated user
conversationsRouter.post("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!isConnectedToMongo) {
    return res.status(503).json({
      success: false,
      error: { code: "SERVICE_UNAVAILABLE", message: "Database connection unavailable" },
    });
  }

  const title = req.body.title || "New Technical Conversation";
  const userId = req.user?.id;

  try {
    const conv = await Conversation.create({
      userId,
      title,
    });

    return res.status(201).json({
      success: true,
      data: {
        id: conv._id.toString(),
        title: conv.title,
        createdAt: conv.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("[Conversations] Create error:", err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to create conversation" },
    });
  }
});

// GET /conversations/:id/messages - Retrieve messages (Owner or Admin only)
conversationsRouter.get("/:id/messages", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!isConnectedToMongo) {
    return res.status(503).json({
      success: false,
      error: { code: "SERVICE_UNAVAILABLE", message: "Database connection unavailable" },
    });
  }

  try {
    const conv = await Conversation.findById(id);
    if (!conv) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Conversation not found" },
      });
    }

    const userOid = toMongoObjectId(userId);
    const convUserIdStr = conv.userId ? conv.userId.toString() : "";
    const isOwner =
      convUserIdStr === userId ||
      convUserIdStr === userOid.toString();
    const isAdmin = userRole === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Access to conversation denied: unauthorized" },
      });
    }

    const msgs = await Message.find({ conversationId: id }).sort({ createdAt: 1 });
    return res.json({
      success: true,
      data: msgs.map((m) => ({
        id: m._id.toString(),
        conversationId: id,
        role: m.role,
        content: m.content,
        citations: m.citations,
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[Conversations] Message fetch error:", err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to retrieve conversation messages" },
    });
  }
});
