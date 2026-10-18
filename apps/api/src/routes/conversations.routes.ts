import { Router, Request, Response } from "express";
import { Conversation, Message } from "../models";
import { isConnectedToMongo } from "../config/database";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth";

export const conversationsRouter: Router = Router();

conversationsRouter.get("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (isConnectedToMongo) {
    try {
      const convs = await Conversation.find({ userId: req.user?.id }).sort({ lastMessageAt: -1 }).limit(30);
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
      console.warn("[Conversations] MongoDB query failed, returning fallback list:", err);
    }
  }

  return res.json({
    success: true,
    data: [
      { id: "demo-1", title: "Pump seal replacement SOP", lastMessageAt: new Date().toISOString() },
      { id: "demo-2", title: "Compressor fault code P0142", lastMessageAt: new Date().toISOString() },
      { id: "demo-3", title: "HVAC maintenance schedule Q4", lastMessageAt: new Date().toISOString() },
    ],
  });
});

conversationsRouter.post("/", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const title = req.body.title || "New Technical Conversation";
  let convId = `conv-${Date.now()}`;

  if (isConnectedToMongo) {
    try {
      const conv = await Conversation.create({
        userId: req.user?.id || "usr-demo-01",
        title,
      });
      convId = conv._id.toString();
    } catch (err) {
      console.warn("[Conversations] Mongo create failed:", err);
    }
  }

  return res.status(201).json({
    success: true,
    data: {
      id: convId,
      title,
      createdAt: new Date().toISOString(),
    },
  });
});

conversationsRouter.get("/:id/messages", requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  if (isConnectedToMongo) {
    try {
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
      console.warn("[Messages] Mongo query failed:", err);
    }
  }

  return res.json({
    success: true,
    data: [],
  });
});
