import { Router, Response } from "express";
import mongoose from "mongoose";
import { ragService } from "../services/rag.service";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth";
import { Message, Conversation, Equipment } from "../models";
import { isConnectedToMongo } from "../config/database";
import { extractStructuredErrorInfo, logStructuredError } from "../utils/errorReporting";
import { toMongoObjectId } from "./documents.routes";
import { SendMessageSchema, MachineContextDTO, ExplodedViewDTO } from "@man-u-ai/shared";
import { machineComponentService } from "../services/component.service";

export const chatRouter: Router = Router();

/**
 * Detects whether an incoming user query is requesting an interactive 3D exploded view,
 * CAD assembly visualization, or internal structural inspection of machine components.
 * Regular maintenance questions mentioning components (e.g., lubrication specs) return false.
 */
export function isExplodedViewIntent(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const q = text.toLowerCase().trim();

  // Guard against questions that are purely maintenance, specification or troubleshooting queries
  const isSpecOrTroubleshoot =
    /\b(spec|specification|specs|lubrication|lubricate|temperature|vibration|pressure|torque|clearance|troubleshoot|procedure|oil|grease|schedule|interval|frequency|why|how much|how do|what is the (torque|temp|oil|pressure|spec|clearance))\b/i.test(q);

  const isExplicit3D =
    /\b(exploded[\s-]view|explode\b.*(assembly|machine|model|view)|open\b.*3d|show\b.*3d|view\b.*3d|load\b.*3d|launch\b.*3d|3d\s*(cad|model|viewer|assembly))\b/i.test(q);

  if (isSpecOrTroubleshoot && !isExplicit3D) {
    return false;
  }

  const patterns = [
    /\b(exploded[\s-]view|explode\b.*(assembly|machine|model|view)|show\b.*explosion)\b/i,
    /\b(open|show|display|load|launch|inspect|view)\b.*\b(3d\s*(model|cad|viewer|assembly|mesh)|cad\s*(model|viewer|assembly))\b/i,
    /\b(3d\s*(model|cad|viewer|assembly))\b/i,
    /\b(show|view|inspect|display|open)\b.*\b(internal\s*structure|machine\s*assembly|assembly\s*view|assembly\s*hierarchy)\b/i,
    /\b(let\s+me\s+inspect\s+(this|the)\s+machine|open\s+(this|the)\s+machine\s+model|inspect\s+(this|the)\s+machine)\b/i,
    /\b(show|open|display|inspect)\b.*\b(machine\s*components|components\s*in\s*3d)\b/i,
    /^(show|open|view|launch)\s+(exploded\s+view|3d\s+model|cad\s+model)$/i,
  ];

  return patterns.some((p) => p.test(q));
}


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

        // Intent Detection: Exploded View & 3D Interactive Model Inspection
    if (isExplodedViewIntent(message)) {
      let targetMachineId: string | undefined = validatedMachineContext?.machineId;
      if (!targetMachineId && resolvedEquipmentId) {
        targetMachineId = resolvedEquipmentId;
      }
      if (!targetMachineId) {
        const q = message.toLowerCase();
        if (q.includes("turbomachinery") || q.includes("turbine")) {
          targetMachineId = "machine_turbomachinery";
        } else if (q.includes("generator") || q.includes("cat")) {
          targetMachineId = "machine_002";
        } else if (q.includes("skid") || q.includes("process equipment")) {
          targetMachineId = "machine_003";
        } else if (q.includes("cnc") || q.includes("machining")) {
          targetMachineId = "machine_004";
        } else if (q.includes("conveyor") || q.includes("a61")) {
          targetMachineId = "equip-cb-a61";
        } else {
          targetMachineId = "machine_001";
        }
      }

      const resolvedMachine = await machineComponentService.resolveMachine(targetMachineId);
      const machineName = resolvedMachine?.name || validatedMachineContext?.machineName || "Industrial Equipment";
      const isCadAvailable = Boolean(resolvedMachine?.cadModel?.available);
      const isCadPending = !isCadAvailable;
      const modelUrl = isCadAvailable
        ? (resolvedMachine?.cadModel?.storageReference || "/cad/models/slurry_pump_p102.step")
        : "";

      const title = isCadAvailable
        ? `${machineName} — 3D Interactive Exploded View`
        : `${machineName} — CAD Model Pending`;

      const description = isCadAvailable
        ? "Interactive 3D assembly loaded. Use step controls to inspect exploded stages or tap components for specifications."
        : "CAD model for this equipment has not been ingested yet. An actual CAD assembly (.STEP/.STP/.IGES) must be uploaded to generate 3D exploded views.";

      const answer = isCadAvailable
        ? `Displaying interactive 3D exploded view for ${machineName}. You can navigate through sequential assembly stages, inspect individual components, or ask technical questions about any highlighted part.`
        : `CAD model pending for ${machineName}. An interactive 3D assembly is not yet available for this equipment. Upload an authoritative CAD model (.STEP/.STP/.IGES) to enable exploded-view inspection.`;

      const explodedViewPayload: ExplodedViewDTO = {
        machineId: resolvedMachine?.id || targetMachineId,
        machineName: machineName,
        modelUrl: modelUrl,
        title: title,
        description: description,
        conversationId: conversationId,
        initialStep: isCadAvailable ? 1 : 0,
        totalSteps: isCadAvailable ? 4 : 0,
        isCadPending: isCadPending,
        referenceImage: resolvedMachine?.referenceImage || null,
        documentation: resolvedMachine?.documentIds || [],
      };

      const outMachineContext: MachineContextDTO = validatedMachineContext || {
        machineId: resolvedMachine?.id || targetMachineId,
        machineName: machineName,
      };

      if (isConnectedToMongo && conversationId) {
        try {
          await Message.create({
            conversationId,
            role: "user",
            content: message,
            machineContext: outMachineContext,
          });
          await Message.create({
            conversationId,
            role: "assistant",
            content: answer,
            messageType: "exploded_view",
            explodedView: explodedViewPayload,
            machineContext: outMachineContext,
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
          answer: answer,
          citations: [],
          warningLevel: "none",
          confidenceScore: 1.0,
          provider: "man-u-ai-cad-engine",
          messageType: "exploded_view",
          explodedView: explodedViewPayload,
          machineContext: outMachineContext,
        },
      });
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
