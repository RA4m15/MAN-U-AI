import { Router, Response } from "express";
import mongoose from "mongoose";
import { Conversation, Message, Equipment } from "../models";
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
      .populate("equipmentId", "name model manufacturer")
      .sort({ lastMessageAt: -1 })
      .limit(50);
    return res.json({
      success: true,
      data: convs.map((c) => {
        const eq = c.equipmentId as any;
        return {
          id: c._id.toString(),
          title: c.title,
          equipmentId: eq?._id ? eq._id.toString() : c.equipmentId?.toString(),
          equipmentName: eq?.name ? `${eq.name}${eq.model ? ` (${eq.model})` : ""}` : undefined,
          lastMessageAt: c.lastMessageAt.toISOString(),
          createdAt: c.createdAt.toISOString(),
        };
      }),
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

  const rawTitle = typeof req.body.title === "string" ? req.body.title.trim().slice(0, 200) : "";
  const title = rawTitle || "New Technical Conversation";
  const userId = toMongoObjectId(req.user?.id);
  let validatedEquipmentId: mongoose.Types.ObjectId | undefined;
  let equipmentDoc: any = null;

  if (req.body.equipmentId !== undefined && req.body.equipmentId !== null && req.body.equipmentId !== "") {
    const rawEqId = String(req.body.equipmentId);
    if (!mongoose.Types.ObjectId.isValid(rawEqId)) {
      return res.status(400).json({
        success: false,
        error: { code: "INVALID_EQUIPMENT_ID", message: "Invalid equipment ID format" },
      });
    }
    equipmentDoc = await Equipment.findById(rawEqId);
    if (!equipmentDoc) {
      return res.status(404).json({
        success: false,
        error: { code: "EQUIPMENT_NOT_FOUND", message: "Referenced equipment does not exist" },
      });
    }
    validatedEquipmentId = equipmentDoc._id;
  }

  try {
    const conv = await Conversation.create({
      userId,
      title,
      equipmentId: validatedEquipmentId,
    });

    return res.status(201).json({
      success: true,
      data: {
        id: conv._id.toString(),
        title: conv.title,
        equipmentId: conv.equipmentId?.toString(),
        equipmentName: equipmentDoc ? `${equipmentDoc.name}${equipmentDoc.model ? ` (${equipmentDoc.model})` : ""}` : undefined,
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

// GET /conversations/:id - Retrieve conversation details (Owner or Admin only)
conversationsRouter.get("/:id", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!isConnectedToMongo) {
    return res.status(503).json({
      success: false,
      error: { code: "SERVICE_UNAVAILABLE", message: "Database connection unavailable" },
    });
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({
      success: false,
      error: { code: "NOT_FOUND", message: "Conversation not found" },
    });
  }

  try {
    const conv = await Conversation.findById(id).populate("equipmentId", "name model manufacturer");
    if (!conv) {
      return res.status(404).json({
        success: false,
        error: { code: "NOT_FOUND", message: "Conversation not found" },
      });
    }

    const userOid = toMongoObjectId(userId);
    const convUserIdStr = conv.userId ? conv.userId.toString() : "";
    const isOwner = convUserIdStr === userId || convUserIdStr === userOid.toString();
    const isAdmin = userRole === "admin";

    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Access to conversation denied: unauthorized" },
      });
    }

    const eq = conv.equipmentId as any;
    return res.json({
      success: true,
      data: {
        id: conv._id.toString(),
        title: conv.title,
        equipmentId: eq?._id ? eq._id.toString() : conv.equipmentId?.toString(),
        equipmentName: eq?.name ? `${eq.name}${eq.model ? ` (${eq.model})` : ""}` : undefined,
        createdAt: conv.createdAt.toISOString(),
        lastMessageAt: conv.lastMessageAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("[Conversations] Get error:", err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to retrieve conversation" },
    });
  }
});

// GET /conversations/:id/messages - Retrieve messages (Owner or Admin only)
conversationsRouter.get("/:id/messages", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const id = String(req.params.id);
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
