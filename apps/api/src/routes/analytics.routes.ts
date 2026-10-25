import { Router, Request, Response } from "express";
import { AuditEvent, Message, DocumentModel, Equipment, SummaryModel, MaintenanceIssue } from "../models";
import { isConnectedToMongo } from "../config/database";
import { requireAuth, AuthenticatedRequest } from "../middlewares/auth";
import { geminiService } from "../services/gemini.service";

export const analyticsRouter: Router = Router();

// GET /summaries - Get real persisted summaries
analyticsRouter.get("/summaries", requireAuth, async (req: Request, res: Response) => {
  if (!isConnectedToMongo) {
    return res.status(503).json({
      success: false,
      error: { code: "SERVICE_UNAVAILABLE", message: "Database connection unavailable" },
    });
  }

  try {
    const summaries = await SummaryModel.find().sort({ createdAt: -1 });
    return res.json({
      success: true,
      data: summaries.map((s) => ({
        id: s._id.toString(),
        title: s.title,
        type: s.type,
        shift: s.shift,
        author: s.author,
        equipmentCovered: s.equipmentCovered,
        keyHighlights: s.keyHighlights,
        fullMarkdown: s.fullMarkdown,
        createdAt: s.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("[Summaries] DB fetch error:", err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to retrieve summaries" },
    });
  }
});

// POST /summaries/generate - Generate and save an authentic operational summary from real plant records
analyticsRouter.post("/summaries/generate", requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (!isConnectedToMongo) {
    return res.status(503).json({
      success: false,
      error: { code: "SERVICE_UNAVAILABLE", message: "Database unavailable for summary generation" },
    });
  }

  const { summaryType, focusArea } = req.body;
  const user = req.user;

  try {
    // Gather authentic records from the database
    const [recentAudits, openIssues, relevantEquipment] = await Promise.all([
      AuditEvent.find().sort({ createdAt: -1 }).limit(10),
      MaintenanceIssue.find({ status: { $in: ["open", "in_progress"] } }).limit(10),
      Equipment.find(focusArea ? { name: new RegExp(focusArea, "i") } : {}).limit(5),
    ]);

    const auditSummary =
      recentAudits.map((a) => `- ${a.action} on ${a.resourceType} (${(a as any).actorName || a.userEmail || "System"})`).join("\n") ||
      "No recent audit events logged.";
    const issueSummary =
      openIssues.map((i) => `- [${(i.severity || "NORMAL").toUpperCase()}] ${i.title}: ${i.description}`).join("\n") ||
      "No open maintenance issues recorded.";
    const equipSummary =
      relevantEquipment.map((e) => `- ${e.name} (${e.model}, ${e.type}) at ${e.location || "plant floor"}`).join("\n") ||
      "General plant facility equipment.";

    const prompt = `Synthesize an authentic ${summaryType || "Shift Handoff Report"} strictly from the following plant records:

Equipment Under Observation:
${equipSummary}

Open Maintenance Issues:
${issueSummary}

Recent Operational Actions:
${auditSummary}

Structure into:
1. Executive Operational Summary
2. Active Maintenance Issues & Equipment Status
3. Next Shift Action Items

Note: Label generated content truthfully. Do not invent unrecorded failures or fictional measurements.`;

    const generatedText = await geminiService.generateAnswer(prompt, {
      temperature: 0.2,
      systemInstruction:
        "You are an industrial reliability copilot synthesizing operational briefs from verified database records. Prepend an explicit '[AI-Assisted Operational Synthesis]' label and ground statements in provided records.",
    });

    const labeledMarkdown = `### [AI-Assisted Operational Synthesis]\n*Synthesized from verified plant maintenance issues, equipment records, and audit logs.*\n\n${generatedText}`;

    const title = `${summaryType === "root_cause" ? "RCFA" : "Operational Brief"}: ${focusArea || "Facility Records"}`;
    const keyHighlights = [
      `Synthesized operational state from ${openIssues.length} active maintenance records and ${recentAudits.length} audit logs.`,
      `Monitored equipment scope: ${relevantEquipment.map((e) => e.name).join(", ") || "General facility"}.`,
    ];

    const created = await SummaryModel.create({
      title,
      type: summaryType || "shift_handoff",
      shift: "Active Operational Window",
      author: `${user?.name || "Engineer"} (AI Assisted)`,
      equipmentCovered: relevantEquipment.map((e) => e.name),
      keyHighlights,
      fullMarkdown: labeledMarkdown,
    });

    const { toMongoObjectId } = await import("./documents.routes");
    await AuditEvent.create({
      userId: toMongoObjectId(user?.id),
      userEmail: user?.email,
      action: "summary_generate",
      resourceType: "Summary",
      resourceId: created._id.toString(),
      details: { title, summaryType },
    });

    return res.status(201).json({
      success: true,
      data: {
        id: created._id.toString(),
        title,
        type: summaryType,
        shift: created.shift,
        author: created.author,
        equipmentCovered: created.equipmentCovered,
        keyHighlights,
        summary: labeledMarkdown,
        fullMarkdown: labeledMarkdown,
        createdAt: created.createdAt.toISOString(),
      },
    });
  } catch (err: unknown) {
    console.error("[Summary Generation Error]:", err);
    return res.status(500).json({
      success: false,
      error: { code: "SUMMARY_FAILED", message: "Failed to generate operational summary" },
    });
  }
});

// GET /analytics/insights - Real database counts and reliability metrics
analyticsRouter.get("/analytics/insights", requireAuth, async (req: Request, res: Response) => {
  const rawRange = typeof req.query.range === "string" ? req.query.range.toLowerCase() : "all";
  const validRanges = ["7d", "30d", "all"];
  if (!validRanges.includes(rawRange)) {
    return res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: `Invalid range parameter '${rawRange}'. Accepted values: 7d, 30d, all`,
      },
    });
  }

  if (!isConnectedToMongo) {
    return res.status(503).json({
      success: false,
      error: { code: "SERVICE_UNAVAILABLE", message: "Database connection unavailable" },
    });
  }

  const range = rawRange as "7d" | "30d" | "all";
  let startDate: Date | undefined = undefined;
  if (range === "7d") {
    startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  } else if (range === "30d") {
    startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  }

  try {
    const [totalDocs, totalEquip, totalQueries, totalIssues] = await Promise.all([
      DocumentModel.countDocuments({ status: "indexed" }),
      Equipment.countDocuments(),
      Message.countDocuments({
        role: "user",
        ...(startDate ? { createdAt: { $gte: startDate } } : {}),
      }),
      MaintenanceIssue.countDocuments({ status: { $in: ["open", "in_progress"] } }),
    ]);

    return res.json({
      success: true,
      data: {
        range,
        periodStart: startDate ? startDate.toISOString() : null,
        totalIndexedDocuments: totalDocs,
        totalMonitoredEquipment: totalEquip,
        totalRAGInquiries: totalQueries,
        activeOpenIssues: totalIssues,
        metrics: {
          groundingPolicy: "Strict (Zero-Tolerance)",
          unverifiedCitationsAllowed: 0,
          evaluationMethod: "Exact Chunk Substring & Vector Verification",
        },
      },
    });
  } catch (err) {
    console.error("[Insights] Count error:", err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to query analytics metrics" },
    });
  }
});

// GET /audit - Get real audit events from MongoDB
analyticsRouter.get("/audit", requireAuth, async (req: Request, res: Response) => {
  if (!isConnectedToMongo) {
    return res.status(503).json({
      success: false,
      error: { code: "SERVICE_UNAVAILABLE", message: "Database connection unavailable" },
    });
  }

  const rawAction = typeof req.query.action === "string" ? req.query.action.trim() : undefined;
  const parsedLimit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 50;
  const maxLimit = Math.min(100, Math.max(1, isNaN(parsedLimit) ? 50 : parsedLimit));

  try {
    const query: any = {};
    if (rawAction && rawAction !== "all") {
      query.action = rawAction;
    }
    const logs = await AuditEvent.find(query).sort({ createdAt: -1 }).limit(maxLimit);
    return res.json({
      success: true,
      data: logs.map((l) => ({
        id: l._id.toString(),
        action: l.action,
        actorName: l.userEmail ? l.userEmail.split("@")[0] : "System",
        actorRole: "Plant Personnel",
        description: l.details?.title ? `Processed: "${l.details.title}"` : `Action: ${l.action}`,
        resourceTitle: l.resourceType,
        status: "success",
        timestamp: l.createdAt.toISOString(),
        metadata: l.details,
      })),
    });
  } catch (err) {
    console.error("[Audit] Mongo query failed:", err);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: "Failed to query audit events" },
    });
  }
});
