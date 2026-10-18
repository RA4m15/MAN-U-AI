import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Plus,
  Sparkles,
  Download,
  Copy,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Share2,
  Bot,
  Layers,
  X,
  FileCheck,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { analyticsApi } from "@/lib/api";

interface SummaryItem {
  id: string;
  title: string;
  type: "shift_handoff" | "root_cause" | "weekly_preventive" | "safety_audit";
  date: string;
  shift: string;
  author: string;
  equipmentCovered: string[];
  keyHighlights: string[];
  fullMarkdown: string;
}

const FALLBACK_SUMMARY: SummaryItem = {
  id: "sum-01",
  title: "Shift Handoff Report: Line 1 & Line 3 Operations",
  type: "shift_handoff",
  date: "Today",
  shift: "Current Active Window",
  author: "Plant Personnel (AI Assisted)",
  equipmentCovered: ["Centrifugal Slurry Pump P-102", "Hydraulic Press HP-400"],
  keyHighlights: [
    "Slurry Pump P-102 vibration velocity stabilized at 4.8 mm/s after mechanical seal flush line purge.",
    "HP-400 LOTO safety procedure executed and verified per OSHA 1910.147.",
    "Zero lost-time injuries or reportable environmental excursions logged during shift.",
  ],
  fullMarkdown: `# Shift Handoff Report — Industrial Operations

## Executive Summary
Production targets were sustained across Lines 1, 2, and 3. Primary operational interventions centered around mechanical seal inspection and hydraulic press alignment.

## Equipment Interventions & Observations
1. **Slurry Pump P-102:** Inspected mechanical seal gland stud torque (45 N·m cross-diagonal).
2. **Hydraulic Press HP-400:** Complete Lockout/Tagout confirmed prior to manifold inspection.

## Incoming Shift Recommendations
- Continue monitoring P-102 seal temperature every 2 hours.
- Verify air supply line pressure to pneumatic valve actuators.`,
};

export function SummariesPage() {
  const queryClient = useQueryClient();
  const [selectedSummary, setSelectedSummary] = useState<SummaryItem>(FALLBACK_SUMMARY);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form for generating new summary
  const [summaryType, setSummaryType] = useState("shift_handoff");
  const [focusArea, setFocusArea] = useState("Line 1 Slurry Pump & Hydraulic Press Cells");

  const { data: resp, isLoading } = useQuery({
    queryKey: ["summaries"],
    queryFn: () => analyticsApi.summaries(),
  });

  const rawSummaries = resp?.data?.data;
  const summaries: SummaryItem[] =
    Array.isArray(rawSummaries) && rawSummaries.length > 0
      ? rawSummaries.map((s: any) => ({
          id: s.id || s._id,
          title: s.title,
          type: s.type || "shift_handoff",
          date: s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "Recent",
          shift: s.shift || "Active Shift",
          author: s.author || "MAN-U-AI Agent",
          equipmentCovered: s.equipmentCovered || ["Plant Assets"],
          keyHighlights: s.keyHighlights || ["Operational review completed."],
          fullMarkdown: s.fullMarkdown || "# Summary Record",
        }))
      : [FALLBACK_SUMMARY];

  const activeSelected = summaries.find((s) => s.id === selectedSummary.id) || summaries[0] || FALLBACK_SUMMARY;

  const generateMutation = useMutation({
    mutationFn: (data: { summaryType: string; focusArea: string }) =>
      analyticsApi.generateSummary(data.summaryType, data.focusArea),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["summaries"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      if (res?.data?.data) {
        const created = res.data.data;
        const newSum: SummaryItem = {
          id: created.id,
          title: created.title,
          type: created.type,
          date: "Just now",
          shift: created.shift || "Active Shift",
          author: created.author || "MAN-U-AI Engine",
          equipmentCovered: created.equipmentCovered || [focusArea],
          keyHighlights: created.keyHighlights || ["Summary generated from live records."],
          fullMarkdown: created.fullMarkdown,
        };
        setSelectedSummary(newSum);
      }
      setIsGenerateOpen(false);
    },
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(activeSelected.fullMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([activeSelected.fullMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${activeSelected.title.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!focusArea.trim()) return;
    generateMutation.mutate({ summaryType, focusArea });
  };

  return (
    <div className="flex flex-col h-full bg-canvas overflow-hidden">
      {/* Top Header */}
      <div className="p-4 md:p-6 border-b border-hairline bg-surface-1 flex items-center justify-between flex-shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="text-primary w-5 h-5" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-ink">
              Industrial AI Summaries
            </h1>
            <span className="badge-primary text-2xs">Autonomous Synthesis</span>
            <span className="badge-muted text-2xs font-mono">Persisted MongoDB</span>
          </div>
          <p className="text-xs text-ink-subtle">
            Shift handoff briefs, Root Cause Failure Analyses (RCFA), and weekly preventive maintenance rollups.
          </p>
        </div>

        <button
          onClick={() => setIsGenerateOpen(true)}
          className="btn-primary text-xs flex items-center gap-1.5 shadow-glow-primary"
        >
          <Sparkles size={13} />
          Generate Shift Summary
        </button>
      </div>

      {/* Main 2-Panel Layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left List of Summaries */}
        <aside className="w-80 md:w-96 border-r border-hairline bg-surface-1 flex flex-col flex-shrink-0 overflow-y-auto scrollbar-none p-3 space-y-2">
          {isLoading && (
            <div className="p-4 text-xs text-ink-subtle text-center flex items-center justify-center gap-2">
              <Loader2 size={13} className="animate-spin text-primary" />
              <span>Loading saved summaries...</span>
            </div>
          )}
          {summaries.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedSummary(item)}
              className={cn(
                "p-3.5 rounded-xl border transition-all cursor-pointer",
                activeSelected.id === item.id
                  ? "bg-surface-2 border-primary/40 shadow-sm"
                  : "bg-surface-1 border-hairline hover:border-hairline-strong"
              )}
            >
              <div className="flex items-center justify-between text-2xs mb-1.5">
                <span className="badge-muted text-2xs font-mono uppercase">
                  {item.type.replace("_", " ")}
                </span>
                <span className="text-ink-tertiary">{item.date}</span>
              </div>
              <h3 className="text-xs font-semibold text-ink line-clamp-2 mb-2 leading-snug">
                {item.title}
              </h3>
              <p className="text-2xs text-ink-subtle line-clamp-2">
                {item.keyHighlights[0]}
              </p>
            </div>
          ))}
        </aside>

        {/* Right Summary Detail Viewer */}
        <main className="flex-1 bg-canvas overflow-y-auto p-6 md:p-10">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-hairline">
              <div>
                <span className="badge-primary text-2xs font-mono uppercase mb-2">
                  {activeSelected.type.replace("_", " ")}
                </span>
                <h2 className="text-lg md:text-xl font-bold text-ink tracking-tight mt-1">
                  {activeSelected.title}
                </h2>
                <div className="flex items-center gap-3 text-2xs text-ink-subtle mt-1.5">
                  <span className="flex items-center gap-1">
                    <Clock size={11} /> {activeSelected.shift}
                  </span>
                  <span>•</span>
                  <span>Author: {activeSelected.author}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="btn-secondary text-xs flex items-center gap-1.5"
                >
                  {copied ? <CheckCircle2 size={13} className="text-success" /> : <Copy size={13} />}
                  <span>{copied ? "Copied" : "Copy MD"}</span>
                </button>
                <button
                  onClick={handleDownloadMarkdown}
                  className="btn-secondary text-xs flex items-center gap-1.5"
                >
                  <Download size={13} />
                  <span>Download MD</span>
                </button>
              </div>
            </div>

            {/* Key Highlights Card */}
            <div className="p-4 rounded-xl bg-surface-1 border border-hairline space-y-2">
              <h4 className="text-2xs font-semibold text-ink-tertiary uppercase tracking-wider">
                Key Industrial Highlights
              </h4>
              <ul className="space-y-1.5">
                {activeSelected.keyHighlights.map((hl, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-ink">
                    <CheckCircle2 size={13} className="text-primary flex-shrink-0 mt-0.5" />
                    <span>{hl}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Full Markdown Report */}
            <div className="p-6 rounded-xl bg-surface-1 border border-hairline">
              <div className="prose prose-invert prose-xs max-w-none text-ink leading-relaxed whitespace-pre-wrap font-sans">
                {activeSelected.fullMarkdown}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Generate Modal */}
      {isGenerateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-1 border border-hairline rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-hairline mb-4">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-primary" />
                <h3 className="text-sm font-semibold text-ink">Generate Industrial Summary</h3>
              </div>
              <button onClick={() => setIsGenerateOpen(false)} className="btn-icon p-1">
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleGenerateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-2xs font-medium text-ink-subtle uppercase mb-1">
                  Summary Report Type
                </label>
                <select
                  value={summaryType}
                  onChange={(e) => setSummaryType(e.target.value)}
                  className="input text-xs"
                >
                  <option value="shift_handoff">Shift Handoff Brief</option>
                  <option value="root_cause">Root Cause Failure Analysis (RCFA)</option>
                  <option value="weekly_preventive">Weekly Preventive Maintenance Rollup</option>
                  <option value="safety_audit">LOTO & Safety Compliance Audit</option>
                </select>
              </div>

              <div>
                <label className="block text-2xs font-medium text-ink-subtle uppercase mb-1">
                  Equipment / Focus Area
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Centrifugal Slurry Pump P-102 & Rotary Compressor"
                  value={focusArea}
                  onChange={(e) => setFocusArea(e.target.value)}
                  className="input text-xs"
                />
                <p className="text-2xs text-ink-tertiary mt-1">
                  Synthesizes equipment manuals, active alarms, and maintenance logs into a structured brief.
                </p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsGenerateOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={generateMutation.isPending}
                  className="btn-primary text-xs flex items-center gap-1.5 shadow-glow-primary"
                >
                  {generateMutation.isPending && <Loader2 size={12} className="animate-spin" />}
                  {generateMutation.isPending ? "Synthesizing Brief..." : "Generate Brief"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
