import React, { useState, useEffect } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import {
  Workflow,
  Sparkles,
  UploadCloud,
  FileText,
  Printer,
  CheckCircle,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  ArrowRight,
  BookOpen,
  Layers,
  ChevronDown,
  RefreshCw,
  Award,
} from "lucide-react";
import type { SOPFlowchartDTO, FlowchartNodeDTO } from "@man-u-ai/shared";
import { flowchartsApi } from "@/lib/api";
import { MermaidFlowchartViewer } from "@/components/flowchart/MermaidFlowchartViewer";
import { FlowchartNodeInspector } from "@/components/flowchart/FlowchartNodeInspector";
import { useAuth } from "@/contexts/AuthContext";

// Sample Factory SOP Presets for 1-click test
const SOP_PRESETS = [
  {
    id: "preset-drypix",
    title: "Fuji DRYPIX Smart Film Jam Clearance",
    text: `STANDARD OPERATING PROCEDURE: DRYPIX Smart Imager Section 4.3 Sheet Feeder Jam Recovery.
WARNING: Thermal development unit remains hot (>100°C) for 15 minutes following error code 221. Do not reach into the thermal heater chute without heat-resistant gloves.
Step 1: Release front lower chassis latch and swing the main access door downward.
Step 2: Check whether leading edge of the film sheet is visible at the pickup roller?
If film sheet is visible at the feed roller, grasp both edges firmly with clean hands and pull straight out toward the operator without twisting.
If film sheet is trapped inside the transport chute, rotate the green manual advance knob counter-clockwise exactly 3 full rotations.
Step 3: Check if film successfully feeds into upper exit tray?
If sheet does not eject, stop immediately and notify imaging specialist.
Step 4: Close access door securely until mechanical latch clicks.
Step 5: Press Reset on console to run automatic optical scanner calibration and test print.
Final Step: Verify LCD panel illuminates READY indicator and resume diagnostic printing.`,
  },
  {
    id: "preset-conveyor-loto",
    title: "Conveyor Belt A61 LOTO & Roller Inspection",
    text: `STANDARD OPERATING PROCEDURE: Conveyor Belt A61 Lockout/Tagout & Tensioner Servicing.
DANGER: High voltage 480V 3-phase supply hazard. Verify all personnel wear Level 2 Arc Flash PPE and safety face shields before approaching MCC cabinet.
Step 1: Notify central control room operator that Conveyor Belt A61 is being taken offline.
Step 2: Rotate MCC circuit breaker disconnect switch to OFF position and verify zero voltage.
Step 3: Attach personal safety padlock and danger lockout tag to breaker handle hasp.
Step 4: Check if pneumatic belt tensioner pressure exceeds 0.5 bar?
If pressure is above 0.5 bar, open manual bleed valve V-12 until primary pressure gauge reads exactly 0 bar.
Step 5: Press local emergency pull-cord and attempt manual start to confirm zero mechanical energy state.
Step 6: Inspect 36 vulcanized idler rollers for bearing play, rubber fraying, or material buildup.
Step 7: Check if belt tracking deviation exceeds 15 mm from center line?
If tracking exceeds 15 mm, adjust left-hand take-up screw by 1/2 turn clockwise.
Final Step: Sign off permit-to-work in plant CMMS system and remove lockout locks in reverse order.`,
  },
  {
    id: "preset-turbocompressor",
    title: "Turbocompressor B01 Impeller Vibration Check",
    text: `STANDARD OPERATING PROCEDURE: Turbocompressor B01 Vibration Spike Diagnostic.
CAUTION: Turbocompressor rotates at 14,200 RPM. Never open acoustic housing while rotor is spinning down.
Step 1: Verify tachometer indicates 0 RPM and lube oil temperature has dropped below 60°C.
Step 2: Disconnect high-pressure bypass solenoid wiring harness.
Step 3: Mount tri-axial magnetic accelerometer probe at drive-end bearing casing.
Step 4: Check if overall casing vibration velocity exceeds 4.5 mm/s RMS threshold?
If vibration exceeds 4.5 mm/s, lubricate planetary gearbox bearings with Mobil DTE 732 oil and check for cavitation.
If vibration remains below 4.5 mm/s, record harmonic frequencies at 1X and 2X running speed.
Step 5: Inspect titanium impeller inlet guide vanes for pitting or erosion.
Final Step: Secure acoustic enclosure latches and submit diagnostic vibration report to reliability engineering.`,
  },
];

export function SopFlowchartPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const locationState = location.state as { initialProcedure?: string; initialTitle?: string } | undefined;

  const [activeFlowchart, setActiveFlowchart] = useState<SOPFlowchartDTO | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [procedureText, setProcedureText] = useState<string>(
    locationState?.initialProcedure || SOP_PRESETS[0].text
  );
  const [procedureTitle, setProcedureTitle] = useState<string>(
    locationState?.initialTitle || SOP_PRESETS[0].title
  );
  const [showApprovalModal, setShowApprovalModal] = useState<boolean>(false);
  const [approverName, setApproverName] = useState<string>(user?.name || "Lead Reliability Engineer");
  const [approverRole, setApproverRole] = useState<string>(
    user?.role === "admin" ? "Plant Administrator" : "Certified Maintenance Specialist"
  );
  const [approvalComments, setApprovalComments] = useState<string>(
    "Certified against OEM operational service manual. Approved for machine wall deployment."
  );

  // Load existing flowchart or default on mount
  useEffect(() => {
    const loadInitial = async () => {
      try {
        const res = await flowchartsApi.list();
        if (res.data?.success && res.data.data.length > 0) {
          const first = res.data.data[0];
          setActiveFlowchart(first);
          setSelectedNodeId(first.nodes[0]?.id || null);
        }
      } catch (err) {
        console.warn("Could not fetch flowcharts:", err);
      }
    };
    loadInitial();
  }, []);

  const handleSelectPreset = (preset: typeof SOP_PRESETS[0]) => {
    setProcedureTitle(preset.title);
    setProcedureText(preset.text);
  };

  const handleGenerate = async () => {
    if (!procedureText.trim()) return;
    setIsLoading(true);
    try {
      const res = await flowchartsApi.generate({
        text: procedureText,
        title: procedureTitle || "Standard Operating Procedure Flowchart",
      });
      if (res.data?.success) {
        setActiveFlowchart(res.data.data);
        setSelectedNodeId(res.data.data.nodes[0]?.id || null);
      }
    } catch (err: any) {
      alert(`Generation failed: ${err.response?.data?.error?.message || err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!activeFlowchart) return;
    try {
      const res = await flowchartsApi.approve(activeFlowchart.id, {
        approvedBy: approverName,
        approvedByRole: approverRole,
        comments: approvalComments,
      });
      if (res.data?.success) {
        setActiveFlowchart(res.data.data);
        setShowApprovalModal(false);
      }
    } catch (err: any) {
      alert(`Approval failed: ${err.response?.data?.error?.message || err.message}`);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const selectedNode: FlowchartNodeDTO | null =
    activeFlowchart?.nodes.find((n) => n.id === selectedNodeId) || null;

  return (
    <div className="flex flex-col h-full bg-canvas overflow-y-auto p-4 md:p-8 space-y-6 pb-24 animate-fade-in print:p-0 print:m-0 print:space-y-4 print:overflow-visible">
      {/* Page Header (Hidden during wall print) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-primary/20 text-primary border border-primary/30">
              <Workflow size={22} />
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight">
              SOP Flowcharts
            </h1>
            <span className="text-2xs font-mono uppercase tracking-widest px-2 py-0.5 rounded-md bg-surface-2 border border-hairline text-ink-tertiary">
              Workflow Intelligence
            </span>
          </div>
          <p className="text-xs md:text-sm text-ink-muted mt-1">
            Interactive visual execution paths with decision branching, operator safety gates, and source verification.
          </p>
        </div>

        {activeFlowchart && (
          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-hairline text-xs font-bold text-ink transition-colors shadow-sm"
              title="Print high-contrast poster for machine wall"
            >
              <Printer size={15} className="text-primary" />
              <span>Print for Machine Wall</span>
            </button>

            {activeFlowchart.status !== "approved" ? (
              <button
                onClick={() => setShowApprovalModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 text-white font-bold text-xs hover:bg-emerald-600 transition-colors shadow-md shadow-emerald-500/20"
              >
                <ShieldCheck size={16} />
                <span>Approve as Official SOP</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-extrabold uppercase tracking-wider">
                <Award size={15} />
                <span>Official Certified SOP</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input & Generator Panel (Collapsible / hidden in print) */}
      <div className="rounded-2xl bg-surface-1 border border-hairline p-5 shadow-xl space-y-4 print:hidden">
        <div className="flex items-center justify-between pb-2 border-b border-hairline/60">
          <span className="text-2xs font-extrabold uppercase tracking-wider text-ink-tertiary flex items-center gap-1.5">
            <FileText size={14} className="text-primary" />
            Procedure Specification
          </span>
          <div className="flex items-center gap-1.5 text-2xs">
            <span className="text-ink-tertiary hidden sm:inline">Try preset:</span>
            {SOP_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelectPreset(p)}
                className="px-2 py-0.5 rounded-md bg-surface-2 hover:bg-surface-3 text-ink-muted hover:text-ink border border-hairline text-3xs font-semibold transition-colors"
              >
                {p.title.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1 space-y-2">
            <label className="text-xs font-bold text-ink uppercase tracking-wider">Procedure Title</label>
            <input
              type="text"
              value={procedureTitle}
              onChange={(e) => setProcedureTitle(e.target.value)}
              placeholder="e.g. Fuji DRYPIX Jam Clearance Protocol"
              className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-hairline text-ink text-xs focus:outline-none focus:border-primary"
            />
            <p className="text-3xs text-ink-tertiary">
              Generates structured decision branches and cited source references.
            </p>
          </div>

          <div className="md:col-span-2 space-y-2">
            <label className="text-xs font-bold text-ink uppercase tracking-wider">SOP Procedure Text</label>
            <textarea
              rows={4}
              value={procedureText}
              onChange={(e) => setProcedureText(e.target.value)}
              placeholder="Paste long text SOP procedure here with steps, cautions, warnings, and condition checks..."
              className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-hairline text-ink text-xs font-mono leading-relaxed focus:outline-none focus:border-primary resize-y"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-3xs text-ink-tertiary">
            ~10 seconds generation time · Extracts start, action steps, decision diamonds, and red warning nodes.
          </span>
          <button
            onClick={handleGenerate}
            disabled={isLoading || !procedureText.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primary-hover disabled:opacity-50 transition-all shadow-md shadow-primary/25"
          >
            {isLoading ? <RefreshCw size={15} className="animate-spin" /> : <Sparkles size={15} />}
            <span>{isLoading ? "Analyzing & Generating Flowchart..." : "Generate Flowchart (~10s)"}</span>
          </button>
        </div>
      </div>

      {/* Main Flowchart Screen */}
      {activeFlowchart ? (
        <div className="space-y-4">
          {/* Official Certification & Metrics Strip */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-surface-2 border border-hairline">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black text-white tracking-tight">
                  {activeFlowchart.title}
                </h2>
                {activeFlowchart.status === "approved" ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-3xs font-extrabold uppercase tracking-wider">
                    <ShieldCheck size={12} />
                    Official Certified Standard
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-3xs font-extrabold uppercase tracking-wider">
                    <AlertTriangle size={12} />
                    AI Draft — Pending Expert Sign-Off
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-muted">
                {activeFlowchart.summary}
              </p>
              {activeFlowchart.approval && (
                <div className="text-3xs text-emerald-400 font-mono pt-0.5 flex items-center gap-2 flex-wrap">
                  <span>Approved by {activeFlowchart.approval.approvedBy} ({activeFlowchart.approval.approvedByRole})</span>
                  <span>·</span>
                  <span>Cert: {activeFlowchart.approval.certificateHash}</span>
                </div>
              )}
            </div>

            {/* Quick Metrics */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="px-3 py-1.5 rounded-lg bg-surface-3 border border-hairline text-center">
                <div className="text-xs font-mono font-black text-primary">{activeFlowchart.totalSteps}</div>
                <div className="text-3xs uppercase font-bold text-ink-tertiary">Steps</div>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-surface-3 border border-hairline text-center">
                <div className="text-xs font-mono font-black text-amber-400">{activeFlowchart.decisionCount}</div>
                <div className="text-3xs uppercase font-bold text-ink-tertiary">Decisions</div>
              </div>
              <div className="px-3 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-center">
                <div className="text-xs font-mono font-black text-rose-400">{activeFlowchart.warningCount}</div>
                <div className="text-3xs uppercase font-bold text-rose-300">Warnings</div>
              </div>
            </div>
          </div>

          {/* Interactive Split View: Mermaid Diagram Canvas + Cited Passage Inspector */}
          <div className="flex flex-col lg:flex-row items-start gap-5">
            <div className="flex-1 w-full">
              <MermaidFlowchartViewer
                mermaidDefinition={activeFlowchart.mermaidDefinition}
                nodes={activeFlowchart.nodes}
                edges={activeFlowchart.edges}
                selectedNodeId={selectedNodeId}
                onSelectNode={(id) => setSelectedNodeId(id)}
              />
            </div>

            {/* Side Inspector Panel */}
            <div className="w-full lg:w-96 flex-shrink-0 lg:sticky lg:top-4">
              <FlowchartNodeInspector
                node={selectedNode}
                edges={activeFlowchart.edges}
                nodes={activeFlowchart.nodes}
                onSelectNode={(id) => setSelectedNodeId(id)}
                onClose={() => setSelectedNodeId(null)}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center rounded-2xl bg-surface-1 border border-hairline space-y-3">
          <Workflow size={36} className="mx-auto text-primary animate-pulse" />
          <h3 className="text-lg font-bold text-white">No Flowchart Active</h3>
          <p className="text-xs text-ink-muted max-w-md mx-auto">
            Select one of the sample presets above or paste your facility's long text standard operating procedure to generate an interactive visual flowchart.
          </p>
        </div>
      )}

      {/* Expert Approval Modal */}
      {showApprovalModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface-1 border border-hairline-strong p-6 shadow-2xl space-y-4 animate-scale-up">
            <div className="flex items-center gap-2.5 text-emerald-400 font-bold text-base">
              <ShieldCheck size={22} />
              <h3>Expert SOP Flowchart Sign-off</h3>
            </div>
            <p className="text-xs text-ink-muted">
              By certifying this flowchart, you verify that all steps, decision thresholds, and red safety warning nodes accurately reflect OEM specifications and facility protocol.
            </p>

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-xs font-bold text-ink uppercase tracking-wider block mb-1">
                  Certifying Engineer / Expert Name
                </label>
                <input
                  type="text"
                  value={approverName}
                  onChange={(e) => setApproverName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-hairline text-ink text-xs focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-ink uppercase tracking-wider block mb-1">
                  Official Role / Qualification
                </label>
                <input
                  type="text"
                  value={approverRole}
                  onChange={(e) => setApproverRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-hairline text-ink text-xs focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-ink uppercase tracking-wider block mb-1">
                  Certification Comments & Standards Reference
                </label>
                <textarea
                  rows={2}
                  value={approvalComments}
                  onChange={(e) => setApprovalComments(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-surface-2 border border-hairline text-ink text-xs focus:outline-none focus:border-primary resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-hairline/60">
              <button
                onClick={() => setShowApprovalModal(false)}
                className="px-4 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-ink text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors shadow-md shadow-emerald-500/25"
              >
                Sign & Certify as Official SOP
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
