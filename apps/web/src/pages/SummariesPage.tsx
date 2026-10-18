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
  Bot,
  X,
  FileCheck,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { analyticsApi } from "@/lib/api";

interface SummaryItem {
  id: string;
  title: string;
  type: "shift_handoff" | "root_cause" | "weekly_preventive" | "safety_audit" | string;
  date: string;
  shift: string;
  author: string;
  equipmentCovered: string[];
  keyHighlights: string[];
  fullMarkdown: string;
}

export function SummariesPage() {
  const queryClient = useQueryClient();
  const [selectedSummaryId, setSelectedSummaryId] = useState<string | null>(null);
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form for generating new summary
  const [summaryType, setSummaryType] = useState("shift_handoff");
  const [focusArea, setFocusArea] = useState("");

  const {
    data: resp,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["summaries"],
    queryFn: () => analyticsApi.summaries(),
  });

  const rawSummaries = resp?.data?.data;
  const summaries: SummaryItem[] = Array.isArray(rawSummaries)
    ? rawSummaries.map((s: any) => ({
        id: String(s.id || s._id),
        title: s.title || "Untitled Summary",
        type: s.type || "shift_handoff",
        date: s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "Recent",
        shift: s.shift || "Active Shift",
        author: s.author || "MAN-U-AI Agent",
        equipmentCovered: Array.isArray(s.equipmentCovered) ? s.equipmentCovered : [],
        keyHighlights: Array.isArray(s.keyHighlights) ? s.keyHighlights : [],
        fullMarkdown: s.fullMarkdown || s.summary || "# Operational Summary",
      }))
    : [];

  const activeSelected =
    summaries.find((s) => s.id === selectedSummaryId) || (summaries.length > 0 ? summaries[0] : null);

  const generateMutation = useMutation({
    mutationFn: (data: { summaryType: string; focusArea: string }) =>
      analyticsApi.generateSummary(data.summaryType, data.focusArea),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["summaries"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      if (res?.data?.data?.id) {
        setSelectedSummaryId(String(res.data.data.id));
      }
      setIsGenerateOpen(false);
      setFocusArea("");
      setErrorMessage(null);
    },
    onError: (err: any) => {
      setErrorMessage(
        err.response?.data?.error?.message || "Failed to generate operational summary. Ensure MongoDB is accessible."
      );
    },
  });

  const handleCopy = () => {
    if (!activeSelected) return;
    navigator.clipboard.writeText(activeSelected.fullMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    if (!activeSelected) return;
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
    setErrorMessage(null);
    generateMutation.mutate({
      summaryType,
      focusArea: focusArea.trim(),
    });
  };

  const getErrorMessage = () => {
    if (!error) return "Failed to retrieve summaries from the database.";
    const axiosErr = error as any;
    if (axiosErr.response?.status === 503) {
      return "Database connection unavailable for summary retrieval.";
    }
    return axiosErr.response?.data?.error?.message || axiosErr.message || "Failed to load summaries from database.";
  };

  return (
    <div className="flex flex-col h-full bg-canvas overflow-y-auto p-4 md:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FileText className="text-primary w-5 h-5" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-ink">
              Operational Summaries
            </h1>
            {!isLoading && !isError && (
              <span className="badge-primary text-2xs">{summaries.length} Saved</span>
            )}
            <span className="badge-muted text-2xs font-mono">Persisted MongoDB</span>
          </div>
          <p className="text-xs md:text-sm text-ink-subtle">
            Generate and review shift handoffs, maintenance logs, and incident root cause summaries synthesized from authentic plant records.
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMessage(null);
            setIsGenerateOpen(true);
          }}
          className="btn-primary self-start sm:self-auto flex items-center gap-2 text-xs"
        >
          <Sparkles size={14} />
          Generate Summary
        </button>
      </div>

      {/* Global Mutation Error Notice */}
      {errorMessage && (
        <div className="p-3 rounded-lg bg-danger/10 border border-danger/30 text-xs text-danger flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="btn-icon p-1 text-danger hover:bg-danger/20">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="card bg-surface-1 border border-hairline p-12 flex flex-col items-center justify-center text-center space-y-3">
          <Loader2 size={24} className="animate-spin text-primary" />
          <p className="text-xs text-ink-subtle">Loading persisted operational summaries from MongoDB...</p>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="card bg-surface-1 border border-danger/30 p-8 flex flex-col items-center justify-center text-center space-y-4">
          <div className="p-3 rounded-full bg-danger/10 text-danger">
            <AlertCircle size={28} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink">Failed to Load Summaries</h3>
            <p className="text-xs text-ink-subtle mt-1 max-w-md">{getErrorMessage()}</p>
          </div>
          <button
            onClick={() => refetch()}
            className="btn-secondary text-xs flex items-center gap-1.5"
          >
            <RefreshCw size={13} />
            Retry Query
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && summaries.length === 0 && (
        <div className="card bg-surface-1 border border-hairline p-12 flex flex-col items-center justify-center text-center space-y-4">
          <div className="p-4 rounded-full bg-surface-2 border border-hairline text-ink-tertiary">
            <FileText size={32} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink">No Operational Summaries Saved</h3>
            <p className="text-xs text-ink-subtle mt-1 max-w-md">
              There are currently no persisted shift handoff or maintenance summaries in the database. Generate your first summary from live plant records.
            </p>
          </div>
          <button
            onClick={() => {
              setErrorMessage(null);
              setIsGenerateOpen(true);
            }}
            className="btn-primary text-xs flex items-center gap-2"
          >
            <Sparkles size={14} />
            Generate First Summary
          </button>
        </div>
      )}

      {/* Main Split View: Left List / Right Detail */}
      {!isLoading && !isError && summaries.length > 0 && activeSelected && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Summary Cards Selector */}
          <div className="space-y-3 lg:col-span-1">
            <span className="text-2xs font-semibold uppercase text-ink-tertiary tracking-wider block">
              Persisted Summaries ({summaries.length})
            </span>
            <div className="space-y-2">
              {summaries.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedSummaryId(item.id)}
                  className={cn(
                    "p-3.5 rounded-xl border text-left transition-all cursor-pointer",
                    activeSelected.id === item.id
                      ? "bg-surface-2 border-primary shadow-sm"
                      : "bg-surface-1 border-hairline hover:border-hairline-strong"
                  )}
                >
                  <div className="flex items-center justify-between text-2xs text-ink-tertiary mb-1">
                    <span className="uppercase font-mono">{item.type.replace(/_/g, " ")}</span>
                    <span>{item.date}</span>
                  </div>
                  <h4 className="text-xs font-semibold text-ink line-clamp-2">{item.title}</h4>
                  <div className="mt-2 flex items-center gap-2 text-2xs text-ink-subtle">
                    <Clock size={11} />
                    <span>{item.shift}</span>
                    <span>·</span>
                    <span className="truncate">{item.author}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Full Markdown Report View */}
          <div className="card bg-surface-1 border border-hairline p-6 lg:col-span-2 space-y-5 rounded-2xl shadow-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-hairline">
              <div>
                <span className="badge-primary text-2xs uppercase tracking-wider">
                  {activeSelected.type.replace(/_/g, " ")}
                </span>
                <h2 className="text-base font-bold text-ink mt-1.5">{activeSelected.title}</h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-ink-subtle mt-1">
                  <span className="flex items-center gap-1 font-mono text-2xs">
                    <Calendar size={12} /> {activeSelected.date}
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1 text-2xs">
                    <Clock size={12} /> {activeSelected.shift}
                  </span>
                  <span>·</span>
                  <span className="text-2xs">Author: {activeSelected.author}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="btn-secondary text-xs flex items-center gap-1.5"
                  title="Copy Markdown"
                >
                  {copied ? <CheckCircle2 size={13} className="text-success" /> : <Copy size={13} />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
                <button
                  onClick={handleDownloadMarkdown}
                  className="btn-secondary text-xs flex items-center gap-1.5"
                  title="Export Markdown File"
                >
                  <Download size={13} />
                  <span>Download .md</span>
                </button>
              </div>
            </div>

            {/* Key Highlights */}
            {activeSelected.keyHighlights.length > 0 && (
              <div className="p-4 rounded-xl bg-surface-2 border border-hairline space-y-2">
                <h4 className="text-2xs font-semibold uppercase text-ink-subtle tracking-wider flex items-center gap-1.5">
                  <FileCheck size={13} className="text-primary" />
                  Key Operational Highlights
                </h4>
                <ul className="space-y-1 text-xs text-ink">
                  {activeSelected.keyHighlights.map((hl, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>{hl}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Raw Markdown Output */}
            <div className="prose prose-sm dark:prose-invert max-w-none text-xs text-ink-subtle space-y-3 leading-relaxed font-sans">
              <pre className="whitespace-pre-wrap font-sans bg-transparent p-0 border-0 text-ink leading-relaxed">
                {activeSelected.fullMarkdown}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Generate Summary Modal */}
      {isGenerateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-1 border border-hairline rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-hairline mb-4">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-primary" />
                <h3 className="text-sm font-semibold text-ink">Synthesize Operational Summary</h3>
              </div>
              <button onClick={() => setIsGenerateOpen(false)} className="btn-icon p-1">
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleGenerateSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-2xs font-medium text-ink-subtle uppercase mb-1">
                  Summary Report Type
                </label>
                <select
                  value={summaryType}
                  onChange={(e) => setSummaryType(e.target.value)}
                  className="input text-xs"
                >
                  <option value="shift_handoff">Shift Handoff Report</option>
                  <option value="root_cause">Incident / Root Cause Analysis</option>
                  <option value="weekly_preventive">Weekly Preventive Overview</option>
                  <option value="safety_audit">Industrial Safety Audit</option>
                </select>
              </div>

              <div>
                <label className="block text-2xs font-medium text-ink-subtle uppercase mb-1">
                  Equipment or Facility Focus Area (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Slurry Pump P-102 or Line 1 Cells"
                  value={focusArea}
                  onChange={(e) => setFocusArea(e.target.value)}
                  className="input text-xs"
                />
                <p className="text-2xs text-ink-tertiary mt-1">
                  Filters authentic database records (audit logs, maintenance issues, equipment) used to generate the report.
                </p>
              </div>

              <div className="pt-3 flex justify-end gap-2">
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
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Synthesizing from Records...
                    </>
                  ) : (
                    <>
                      <Sparkles size={12} />
                      Generate & Persist Summary
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
