import { describe, it, expect } from "vitest";
import { flowchartService } from "../src/services/flowchart.service";
import { generateMermaidFromFlowchart } from "@man-u-ai/shared";

describe("SOP to Auto-Flowchart Service & Generator", () => {
  const sampleSopText = `
STANDARD OPERATING PROCEDURE: Conveyor Belt A61 Lockout/Tagout Protocol
Section 1.0 General Instructions:
Always notify the control room supervisor prior to starting work.
DANGER: High voltage 480V supply hazard. Verify all operators are wearing Level 2 Arc Flash PPE and face shields.
Step 1: Rotate main electrical isolator handle to OFF position.
Step 2: Attach personal safety padlock and yellow danger tag to hasp.
Step 3: Check if pneumatic tensioner pressure exceeds 0.5 bar threshold?
If pressure is above 0.5 bar, open manual bleed valve V-12 until gauge reads 0 bar.
Step 4: Press local conveyor start button to verify zero mechanical motion (zero energy test).
Step 5: Inspect rubber vulcanized seams across idler rollers.
Final step: Record service completion in plant CMMS logbook.
`;

  it("generates structured flowchart with start, steps, decisions, and warning nodes", async () => {
    const fc = await flowchartService.generateFlowchart({
      text: sampleSopText,
      title: "Conveyor Belt A61 LOTO Protocol",
      equipmentName: "Conveyor Belt A61",
    });

    expect(fc).toBeDefined();
    expect(fc.id).toMatch(/^fc-/);
    expect(fc.status).toBe("draft");
    expect(fc.nodes.length).toBeGreaterThanOrEqual(4);
    expect(fc.edges.length).toBeGreaterThanOrEqual(3);

    // Verify presence of start and end nodes
    const startNode = fc.nodes.find((n) => n.type === "start");
    const endNode = fc.nodes.find((n) => n.type === "end");
    expect(startNode).toBeDefined();
    expect(endNode).toBeDefined();

    // Verify warning node was identified for High voltage 480V danger
    const warningNode = fc.nodes.find((n) => n.type === "warning");
    expect(warningNode).toBeDefined();
    expect(warningNode?.citedPassage).toContain("hazard");

    // Verify decision node was identified for pressure check
    const decisionNode = fc.nodes.find((n) => n.type === "decision");
    expect(decisionNode).toBeDefined();
    expect(decisionNode?.label).toMatch(/\?/);

    // Verify every node has citedPassage from the original SOP text
    for (const node of fc.nodes) {
      expect(node.citedPassage).toBeDefined();
      expect(node.citedPassage.length).toBeGreaterThan(0);
    }

    // Verify valid Mermaid definition was generated
    expect(fc.mermaidDefinition).toContain("flowchart TD");
    expect(fc.mermaidDefinition).toContain("warningNode");
  });

  it("approves flowchart as official certified SOP standard with certificate hash", async () => {
    const fc = await flowchartService.generateFlowchart({
      text: sampleSopText,
      title: "Hydraulic Pump Calibration SOP",
    });

    expect(fc.status).toBe("draft");
    expect(fc.approval).toBeUndefined();

    const approved = await flowchartService.approveFlowchart(fc.id, {
      approvedBy: "Marcus Vance",
      approvedByRole: "Chief Reliability Engineer",
      comments: "Full shop-floor audit completed. Approved for machine posting.",
    });

    expect(approved).not.toBeNull();
    expect(approved?.status).toBe("approved");
    expect(approved?.approval).toBeDefined();
    expect(approved?.approval?.approvedBy).toBe("Marcus Vance");
    expect(approved?.approval?.certificateHash).toMatch(/^CERT-/);
  });

  it("generateMermaidFromFlowchart formats nodes and branches correctly", () => {
    const testNodes: any[] = [
      { id: "node-1", type: "start", label: "Start", citedPassage: "Start" },
      { id: "node-2", type: "warning", label: "Hazard Alert", citedPassage: "Watch out" },
      { id: "node-3", type: "decision", label: "Pressure OK?", citedPassage: "Check pressure" },
      { id: "node-4", type: "end", label: "End Safe", citedPassage: "Done" },
    ];
    const testEdges: any[] = [
      { id: "e1", from: "node-1", to: "node-2" },
      { id: "e2", from: "node-2", to: "node-3" },
      { id: "e3", from: "node-3", to: "node-4", label: "Yes" },
    ];

    const mermaid = generateMermaidFromFlowchart(testNodes, testEdges);
    expect(mermaid).toContain("flowchart TD");
    expect(mermaid).toContain('node-1(["Start"])');
    expect(mermaid).toContain('node-2[/"⚠️ WARNING: Hazard Alert"/]');
    expect(mermaid).toContain('node-3{"Pressure OK?"}');
    expect(mermaid).toContain('node-3 -->|"Yes"| node-4');
  });
});
