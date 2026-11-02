import crypto from "crypto";
import {
  FlowchartNodeDTO,
  FlowchartEdgeDTO,
  SOPFlowchartDTO,
  GenerateFlowchartInput,
  ApproveFlowchartInput,
  generateMermaidFromFlowchart,
} from "@man-u-ai/shared";
import { geminiService } from "./gemini.service";
import { isConnectedToMongo } from "../config/database";

// In-memory persistent cache for offline mode / fast retrieval
const flowchartCache = new Map<string, SOPFlowchartDTO>();

// Seed default high-value factory SOP flowcharts for instant demo
const DEFAULT_DRYPIX_JAM_FLOWCHART: SOPFlowchartDTO = {
  id: "fc-drypix-jam-221",
  title: "DRYPIX Smart Error 221 Film Jam Clearance",
  sopTitle: "Fuji DRYPIX Smart Imager SOP Section 4.3: Jam Clearance",
  equipmentId: "equip-drypix-smart",
  equipmentName: "Fuji DRYPIX Smart Imager",
  status: "approved",
  summary: "Certified standard operating procedure for clearing sheet feeder jams without damaging optical pickup rollers.",
  nodes: [
    {
      id: "node-1",
      type: "start",
      label: "Start Jam Clearance",
      citedPassage: "Initiate jam clearance procedure immediately when error code 221 or 223 is displayed on LCD panel.",
      section: "4.3.1",
      page: 14,
    },
    {
      id: "node-2",
      type: "warning",
      label: "DO NOT TOUCH EXPOSURE UNIT",
      description: "Laser unit contains sensitive Class 3B optical components and thermal heaters reaching 120°C.",
      citedPassage: "CAUTION: Do not reach into the thermal development zone. Heater elements remain hot (>100°C) for 15 minutes following error code 221.",
      section: "4.3.2 Hazard Warning",
      page: 14,
      ppeRequired: ["Heat Resistant Gloves", "ESD Wrist Strap"],
    },
    {
      id: "node-3",
      type: "step",
      label: "Open Front Access Door",
      description: "Pull down release latch on front lower panel.",
      citedPassage: "Step 1: Release front lower chassis latch and swing the main access door downward.",
      section: "4.3.3",
      page: 15,
    },
    {
      id: "node-4",
      type: "decision",
      label: "Is film sheet visible at feed roller?",
      citedPassage: "Inspect tray 1 pickup assembly. Check whether the leading edge of the film sheet is visible beyond the registration guide.",
      section: "4.3.4",
      page: 15,
    },
    {
      id: "node-5",
      type: "step",
      label: "Gently withdraw sheet straight out",
      description: "Pull with even pressure across both edges to prevent tearing.",
      citedPassage: "If film is exposed at the feed roller, grasp both edges firmly with clean hands and pull straight out towards the operator without twisting.",
      section: "4.3.5",
      page: 15,
    },
    {
      id: "node-6",
      type: "step",
      label: "Rotate manual knob CCW 3 turns",
      description: "Advance transport rollers using green thumbwheel.",
      citedPassage: "If the sheet is jammed inside the transport chute, rotate the green manual advance knob counter-clockwise exactly 3 full rotations.",
      section: "4.3.6",
      page: 16,
      numericalValue: "3 rotations",
    },
    {
      id: "node-7",
      type: "decision",
      label: "Did film feed into exit tray?",
      citedPassage: "Verify that the trailing edge discharges into the upper receipt tray.",
      section: "4.3.7",
      page: 16,
    },
    {
      id: "node-8",
      type: "step",
      label: "Close door & run test sheet",
      description: "Confirm optical scanner calibration.",
      citedPassage: "Close access panel securely. Press Reset on LCD console to run automatic density test sheet.",
      section: "4.3.8",
      page: 16,
    },
    {
      id: "node-9",
      type: "end",
      label: "Unit Cleared & Online",
      citedPassage: "System status transitions to READY when LCD backlight illuminates green.",
      section: "4.3.9",
      page: 16,
    },
  ],
  edges: [
    { id: "e1-2", from: "node-1", to: "node-2" },
    { id: "e2-3", from: "node-2", to: "node-3" },
    { id: "e3-4", from: "node-3", to: "node-4" },
    { id: "e4-5", from: "node-4", to: "node-5", label: "Yes (Visible)" },
    { id: "e4-6", from: "node-4", to: "node-6", label: "No (Trapped)" },
    { id: "e5-8", from: "node-5", to: "node-8" },
    { id: "e6-7", from: "node-6", to: "node-7" },
    { id: "e7-8", from: "node-7", to: "node-8", label: "Yes (Ejected)" },
    { id: "e7-2", from: "node-7", to: "node-2", label: "No (Still Jammed)" },
    { id: "e8-9", from: "node-8", to: "node-9" },
  ],
  mermaidDefinition: "",
  approval: {
    approvedBy: "Marcus Vance",
    approvedByRole: "Chief Medical Equipment Engineer",
    approvedAt: "2026-10-31T14:20:00Z",
    comments: "Verified against OEM Fuji Service Manual Rev 4.1. Official shop-floor standard.",
    certificateHash: "SHA256:8f2a91b4028ce3729d5b",
  },
  totalSteps: 5,
  warningCount: 1,
  decisionCount: 2,
  createdAt: "2026-10-31T14:20:00Z",
  updatedAt: "2026-10-31T14:20:00Z",
};
DEFAULT_DRYPIX_JAM_FLOWCHART.mermaidDefinition = generateMermaidFromFlowchart(
  DEFAULT_DRYPIX_JAM_FLOWCHART.nodes,
  DEFAULT_DRYPIX_JAM_FLOWCHART.edges
);
flowchartCache.set(DEFAULT_DRYPIX_JAM_FLOWCHART.id, DEFAULT_DRYPIX_JAM_FLOWCHART);

export class FlowchartService {
  /**
   * Generates a structured SOP flowchart from text using Gemini LLM with instant heuristic fallback.
   */
  async generateFlowchart(input: GenerateFlowchartInput): Promise<SOPFlowchartDTO> {
    const flowchartId = `fc-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
    const cleanText = input.text.trim();

    let nodes: FlowchartNodeDTO[] = [];
    let edges: FlowchartEdgeDTO[] = [];
    let summary = "Standard operating procedure converted into structured execution flowchart.";

    // 1. Attempt structured LLM generation with Gemini
    try {
      const prompt = `You are MAN-U-AI Industrial Expert. Convert this Standard Operating Procedure (SOP) text into a clean execution flowchart.

OUTPUT SCHEMA (JSON only, no markdown):
{
  "summary": "<1-2 sentence executive summary of the procedure>",
  "nodes": [
    {
      "id": "node-1",
      "type": "start" | "step" | "decision" | "warning" | "end",
      "label": "<concise text, max 8 words>",
      "description": "<optional 1 sentence detail>",
      "citedPassage": "<EXACT sentence copied verbatim from the procedure>",
      "section": "<optional section number like 1.2 or General>",
      "page": 1,
      "ppeRequired": ["optional PPE item"],
      "numericalValue": "<e.g. 45 Nm or 5 bar>"
    }
  ],
  "edges": [
    {
      "id": "e1-2",
      "from": "node-1",
      "to": "node-2",
      "label": "<optional branch text: 'Yes', 'No', 'Pass', 'Fail', or null>"
    }
  ]
}

RULES:
1. Always start with a "start" node and conclude with an "end" node.
2. Put any safety hazard, caution, danger, or LOTO mandate into a "warning" node (rendered red for operators).
3. Put any inspection, condition check, or branch question into a "decision" node (e.g., "Pressure above limit?"). Decision nodes must have at least two outgoing edges with labels (e.g. "Yes" and "No").
4. Action steps must be "step" nodes.
5. EVERY single node MUST have "citedPassage" containing the EXACT sentence from the text below.
6. Keep flowchart concise, logical, and easy for shop floor workers to follow on a single screen.

SOP PROCEDURE TEXT:
"""
${cleanText.slice(0, 8000)}
"""

Return JSON only:`;

      const rawJson = await Promise.race([
        geminiService.generateAnswer(prompt, {
          temperature: 0.1,
          responseMimeType: "application/json",
        }),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("Gemini timeout, switching to fast deterministic heuristic parser")), 6500)
        ),
      ]);

      let parsed: any;
      try {
        const cleaned = rawJson.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
        parsed = JSON.parse(cleaned);
      } catch (parseErr) {
        console.warn("[FlowchartService] Failed to parse LLM JSON, falling back to heuristic parsing:", parseErr);
      }

      if (parsed && Array.isArray(parsed.nodes) && parsed.nodes.length >= 3 && Array.isArray(parsed.edges)) {
        nodes = parsed.nodes;
        edges = parsed.edges;
        if (parsed.summary) summary = parsed.summary;
      }
    } catch (llmErr) {
      console.warn("[FlowchartService] Gemini LLM generation unavailable, using deterministic SOP parser:", llmErr);
    }

    // 2. Heuristic deterministic fallback if LLM returned insufficient nodes
    if (nodes.length < 3) {
      const generated = this.parseSopHeuristic(cleanText);
      nodes = generated.nodes;
      edges = generated.edges;
      summary = generated.summary;
    }

    const totalSteps = nodes.filter((n) => n.type === "step").length;
    const warningCount = nodes.filter((n) => n.type === "warning").length;
    const decisionCount = nodes.filter((n) => n.type === "decision").length;

    const mermaidDef = generateMermaidFromFlowchart(nodes, edges);

    const flowchart: SOPFlowchartDTO = {
      id: flowchartId,
      title: input.title || "Standard Operating Procedure Flowchart",
      sopTitle: input.title || "Industrial Procedure",
      equipmentId: input.equipmentId,
      equipmentName: input.equipmentName,
      status: "draft",
      summary,
      nodes,
      edges,
      mermaidDefinition: mermaidDef,
      totalSteps,
      warningCount,
      decisionCount,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    flowchartCache.set(flowchart.id, flowchart);
    return flowchart;
  }

  /**
   * Deterministic heuristic parser: splits SOP text into discrete logical nodes (Start, Step, Decision, Warning, End).
   */
  private parseSopHeuristic(text: string): { nodes: FlowchartNodeDTO[]; edges: FlowchartEdgeDTO[]; summary: string } {
    const rawSentences = text
      .replace(/\r\n/g, "\n")
      .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
      .map((s) => s.trim())
      .filter((s) => s.length > 8);

    const nodes: FlowchartNodeDTO[] = [];
    const edges: FlowchartEdgeDTO[] = [];

    // 1. Start node
    nodes.push({
      id: "node-1",
      type: "start",
      label: "Start SOP Procedure",
      citedPassage: rawSentences[0] || "Begin procedure following plant guidelines.",
      section: "1.0",
      page: 1,
    });

    let currentId = 2;
    let prevNodeId = "node-1";

    for (let i = 1; i < rawSentences.length; i++) {
      const sent = rawSentences[i];
      const lower = sent.toLowerCase();
      const thisNodeId = `node-${currentId++}`;

      // Check if sentence is a warning
      const isWarning =
        lower.startsWith("warning") ||
        lower.startsWith("danger") ||
        lower.startsWith("caution") ||
        lower.includes("danger:") ||
        lower.includes("warning:") ||
        lower.includes("caution:") ||
        lower.includes("hazard") ||
        lower.includes("high voltage") ||
        lower.includes("hot surface");

      // Check if sentence is a decision/branch condition
      const isDecision =
        sent.includes("?") ||
        lower.startsWith("if ") ||
        lower.includes("check if") ||
        lower.includes("verify if") ||
        lower.includes("whether") ||
        lower.includes("exceeds") ||
        lower.includes("above threshold");

      if (isWarning) {
        nodes.push({
          id: thisNodeId,
          type: "warning",
          label: sent.slice(0, 45).replace(/^(warning|caution|danger):\s*/i, "").trim(),
          description: "High priority safety restriction.",
          citedPassage: sent,
          section: `Safety Step ${i + 1}`,
          page: 1,
          ppeRequired: lower.includes("ppe") ? ["Safety Glasses", "Protective Gloves"] : undefined,
        });
        edges.push({ id: `e-${prevNodeId}-${thisNodeId}`, from: prevNodeId, to: thisNodeId });
        prevNodeId = thisNodeId;
      } else if (isDecision) {
        let decisionLabel = sent
          .replace(/^(step\s*\d+:?\s*)/i, "")
          .replace(/^(if|check if|verify if)\s*/i, "")
          .slice(0, 50)
          .trim();
        if (!decisionLabel.endsWith("?")) {
          decisionLabel += "?";
        }
        nodes.push({
          id: thisNodeId,
          type: "decision",
          label: decisionLabel,
          citedPassage: sent,
          section: `Decision Check ${i + 1}`,
          page: 1,
        });
        edges.push({ id: `e-${prevNodeId}-${thisNodeId}`, from: prevNodeId, to: thisNodeId });

        // Create Yes branch and No branch
        const nextStepId = `node-${currentId++}`;
        const nextSent = rawSentences[i + 1] || "Proceed with normal sequence";
        nodes.push({
          id: nextStepId,
          type: "step",
          label: nextSent.slice(0, 40).trim(),
          citedPassage: nextSent,
          section: `Action ${i + 2}`,
          page: 1,
        });
        edges.push({ id: `e-${thisNodeId}-${nextStepId}-yes`, from: thisNodeId, to: nextStepId, label: "Yes / Pass" });

        // Branch fallback
        const alternateId = `node-${currentId++}`;
        nodes.push({
          id: alternateId,
          type: "step",
          label: "Adjust or notify supervisor",
          citedPassage: `Reference condition: ${sent}`,
          section: `Alternate Route`,
          page: 1,
        });
        edges.push({ id: `e-${thisNodeId}-${alternateId}-no`, from: thisNodeId, to: alternateId, label: "No / Fail" });

        // Reconnect alternate to next step
        edges.push({ id: `e-${alternateId}-${nextStepId}`, from: alternateId, to: nextStepId });

        prevNodeId = nextStepId;
        i++; // skip already used sentence
      } else {
        nodes.push({
          id: thisNodeId,
          type: "step",
          label: sent.slice(0, 45).trim(),
          citedPassage: sent,
          section: `Step ${i + 1}`,
          page: 1,
        });
        edges.push({ id: `e-${prevNodeId}-${thisNodeId}`, from: prevNodeId, to: thisNodeId });
        prevNodeId = thisNodeId;
      }

      if (nodes.length >= 10) break; // Keep visual clarity on a single screen
    }

    // End node
    const endNodeId = `node-${currentId}`;
    nodes.push({
      id: endNodeId,
      type: "end",
      label: "Procedure Completed Safely",
      citedPassage: rawSentences[rawSentences.length - 1] || "Equipment returned to active operational state.",
      section: "Final",
      page: 1,
    });
    edges.push({ id: `e-${prevNodeId}-${endNodeId}`, from: prevNodeId, to: endNodeId });

    return {
      nodes,
      edges,
      summary: `Automated flowchart extracted from ${rawSentences.length} sentences with start, steps, decisions, and safety warning nodes.`,
    };
  }

  /**
   * Retrieves all flowcharts.
   */
  async getFlowcharts(): Promise<SOPFlowchartDTO[]> {
    return Array.from(flowchartCache.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Retrieves a flowchart by ID.
   */
  async getFlowchartById(id: string): Promise<SOPFlowchartDTO | null> {
    return flowchartCache.get(id) || null;
  }

  /**
   * Approves a flowchart as an official certified facility SOP standard.
   */
  async approveFlowchart(id: string, input: ApproveFlowchartInput): Promise<SOPFlowchartDTO | null> {
    const fc = flowchartCache.get(id);
    if (!fc) return null;

    const certHash = `CERT-${crypto.createHash("sha256").update(`${id}:${input.approvedBy}:${Date.now()}`).digest("hex").slice(0, 16).toUpperCase()}`;

    fc.status = "approved";
    fc.approval = {
      approvedBy: input.approvedBy,
      approvedByRole: input.approvedByRole,
      approvedAt: new Date().toISOString(),
      comments: input.comments || "Approved as official facility standard operating procedure.",
      certificateHash: certHash,
    };
    fc.updatedAt = new Date().toISOString();

    flowchartCache.set(id, fc);
    return fc;
  }

  /**
   * Deletes a flowchart.
   */
  async deleteFlowchart(id: string): Promise<boolean> {
    return flowchartCache.delete(id);
  }
}

export const flowchartService = new FlowchartService();
