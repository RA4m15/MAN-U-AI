import React from "react";
import {
  AlertTriangle,
  HelpCircle,
  PlayCircle,
  CheckCircle2,
  ArrowRight,
  BookOpen,
  ShieldAlert,
  Copy,
  Check,
  X,
  Gauge,
  Sliders,
} from "lucide-react";
import type { FlowchartNodeDTO, FlowchartEdgeDTO } from "@man-u-ai/shared";

interface FlowchartNodeInspectorProps {
  node: FlowchartNodeDTO | null;
  edges: FlowchartEdgeDTO[];
  nodes: FlowchartNodeDTO[];
  onSelectNode: (nodeId: string) => void;
  onClose: () => void;
}

export function FlowchartNodeInspector({
  node,
  edges,
  nodes,
  onSelectNode,
  onClose,
}: FlowchartNodeInspectorProps) {
  const [copied, setCopied] = React.useState(false);

  if (!node) return null;

  const outgoingEdges = edges.filter((e) => e.from === node.id);
  const incomingEdges = edges.filter((e) => e.to === node.id);

  const handleCopy = () => {
    navigator.clipboard.writeText(node.citedPassage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getNodeTypeBadge = () => {
    switch (node.type) {
      case "start":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-bold uppercase tracking-wider">
            <PlayCircle size={13} />
            Start Node
          </span>
        );
      case "warning":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/50 text-xs font-bold uppercase tracking-wider animate-pulse">
            <AlertTriangle size={13} className="text-rose-400" />
            Safety Hazard Warning
          </span>
        );
      case "decision":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold uppercase tracking-wider">
            <HelpCircle size={13} />
            Decision Branch Check
          </span>
        );
      case "end":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-bold uppercase tracking-wider">
            <CheckCircle2 size={13} />
            Procedure End
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/20 text-primary border border-primary/40 text-xs font-bold uppercase tracking-wider">
            <ArrowRight size={13} />
            Action Step
          </span>
        );
    }
  };

  return (
    <div className="w-full lg:w-96 rounded-2xl bg-surface-1 border border-hairline-strong p-5 shadow-2xl space-y-4 animate-fade-in flex flex-col justify-between">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 pb-3 border-b border-hairline/60">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {getNodeTypeBadge()}
              <span className="font-mono text-3xs text-ink-muted">ID: {node.id}</span>
            </div>
            <h3 className="text-base font-extrabold text-white tracking-tight leading-snug pt-1">
              {node.label}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-ink-tertiary hover:text-ink hover:bg-surface-2 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Description if present */}
        {node.description && (
          <div className="p-3 rounded-xl bg-surface-2/60 border border-hairline text-xs text-ink-muted leading-relaxed">
            {node.description}
          </div>
        )}

        {/* Safety PPE Banner for warning nodes */}
        {node.type === "warning" && (
          <div className="rounded-xl bg-rose-500/10 border border-rose-500/40 p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-rose-300 font-bold text-xs uppercase tracking-wider">
              <ShieldAlert size={15} />
              Critical Operator Safeguard
            </div>
            <p className="text-xs text-rose-200/90 leading-relaxed">
              Mandatory safety lock or isolation check. Do not proceed to downstream steps before fulfilling this requirement.
            </p>
            {node.ppeRequired && node.ppeRequired.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {node.ppeRequired.map((ppe, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-200 border border-rose-500/30 text-3xs font-bold"
                  >
                    🛡️ {ppe}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Numerical parameter tag */}
        {node.numericalValue && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs">
            <Gauge size={14} />
            <span className="font-bold">Target Specification:</span>
            <span className="font-mono font-extrabold">{node.numericalValue}</span>
          </div>
        )}

        {/* PRIMARY GROUNDING: CITED PASSAGE */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-2xs font-extrabold text-ink-tertiary uppercase tracking-wider">
            <span className="flex items-center gap-1 text-primary">
              <BookOpen size={13} />
              Verified SOP Cited Passage
            </span>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 hover:text-ink text-ink-subtle transition-colors"
              title="Copy citation"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-2 border border-primary/20 space-y-2">
            <p className="text-xs text-ink leading-relaxed font-sans italic border-l-2 border-primary pl-2.5 py-0.5">
              "{node.citedPassage}"
            </p>
            <div className="flex items-center gap-2 pt-1 text-3xs font-mono text-ink-tertiary">
              {node.section && <span>Section: {node.section}</span>}
              {node.page && <span>Page: {node.page}</span>}
            </div>
          </div>
        </div>

        {/* Downstream Connections */}
        {outgoingEdges.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-hairline/60">
            <span className="text-2xs font-bold uppercase tracking-wider text-ink-tertiary">
              Next Execution Branches ({outgoingEdges.length}):
            </span>
            <div className="space-y-1.5">
              {outgoingEdges.map((edge) => {
                const targetNode = nodes.find((n) => n.id === edge.to);
                return (
                  <button
                    key={edge.id}
                    onClick={() => onSelectNode(edge.to)}
                    className="w-full flex items-center justify-between p-2 rounded-lg bg-surface-2 hover:bg-surface-3 border border-hairline text-left transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <ArrowRight size={13} className="text-primary group-hover:translate-x-0.5 transition-transform" />
                      <span className="text-xs font-medium text-ink truncate max-w-[180px]">
                        {targetNode?.label || edge.to}
                      </span>
                    </div>
                    {edge.label && (
                      <span className="px-1.5 py-0.5 rounded bg-surface-3 text-primary text-3xs font-mono font-bold">
                        {edge.label}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-hairline/60 text-3xs text-ink-tertiary text-center">
        Tapping any node in the flowchart inspects its verbatim passage.
      </div>
    </div>
  );
}
