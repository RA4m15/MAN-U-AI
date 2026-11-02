import React, { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  Download,
  Printer,
  Sliders,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import type { FlowchartNodeDTO, FlowchartEdgeDTO } from "@man-u-ai/shared";

interface MermaidFlowchartViewerProps {
  mermaidDefinition: string;
  nodes: FlowchartNodeDTO[];
  edges: FlowchartEdgeDTO[];
  selectedNodeId?: string | null;
  onSelectNode: (nodeId: string) => void;
  className?: string;
}

export function MermaidFlowchartViewer({
  mermaidDefinition,
  nodes,
  edges,
  selectedNodeId,
  onSelectNode,
  className = "",
}: MermaidFlowchartViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>("");
  const [renderError, setRenderError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isRendering, setIsRendering] = useState<boolean>(true);

  // Initialize Mermaid configuration
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      securityLevel: "loose",
      fontFamily: "Space Grotesk, JetBrains Mono, sans-serif",
      flowchart: {
        htmlLabels: true,
        curve: "basis",
        padding: 15,
        useMaxWidth: false,
      },
      themeVariables: {
        darkmode: true,
        background: "#070B14",
        mainBkg: "#0057FF",
        nodeBorder: "#003BB3",
        textColor: "#FFFFFF",
        lineColor: "#3B82F6",
        edgeLabelBackground: "#18181B",
        clusterBkg: "#121212",
        clusterBorder: "#27272A",
      },
    });
  }, []);

  // Render Mermaid definition
  useEffect(() => {
    let isMounted = true;
    setIsRendering(true);
    setRenderError(null);

    const renderGraph = async () => {
      try {
        const id = `mermaid-svg-${Date.now()}`;
        // Clean definition
        const def = mermaidDefinition.trim();
        const { svg } = await mermaid.render(id, def);

        if (isMounted) {
          setSvgContent(svg);
          setIsRendering(false);
        }
      } catch (err: any) {
        console.warn("[MermaidFlowchartViewer] Mermaid render failed, using fallback:", err);
        if (isMounted) {
          setRenderError(err.message || "Failed to render Mermaid graph");
          setIsRendering(false);
        }
      }
    };

    renderGraph();

    return () => {
      isMounted = false;
    };
  }, [mermaidDefinition]);

  // Bind interactive click handlers to rendered SVG elements
  useEffect(() => {
    if (!containerRef.current || !svgContent) return;

    const svgEl = containerRef.current.querySelector("svg");
    if (!svgEl) return;

    // Enhance SVG styling for industrial display
    svgEl.style.width = "100%";
    svgEl.style.height = "auto";
    svgEl.style.maxHeight = "650px";
    svgEl.style.display = "block";
    svgEl.style.margin = "0 auto";

    // Query node elements
    nodes.forEach((node) => {
      // Find element matching node id in SVG
      const nodeSelector = `[id*="${node.id}"], [id^="flowchart-${node.id}-"], g[class*="${node.id}"]`;
      const el = svgEl.querySelector(nodeSelector);

      if (el) {
        el.setAttribute("cursor", "pointer");
        el.setAttribute("title", `Click to view cited SOP passage for "${node.label}"`);

        // Highlight if selected
        if (selectedNodeId === node.id) {
          (el as HTMLElement).style.filter = "drop-shadow(0 0 10px rgba(0, 87, 255, 0.9))";
        } else {
          (el as HTMLElement).style.filter = "none";
        }

        const clickHandler = (e: Event) => {
          e.stopPropagation();
          onSelectNode(node.id);
        };

        el.addEventListener("click", clickHandler);
      }
    });
  }, [svgContent, nodes, selectedNodeId, onSelectNode]);

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.max(0.6, Math.min(2.0, prev + delta)));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
  };

  const handleExportSvg = () => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SOP-Flowchart-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`relative flex flex-col rounded-2xl bg-surface-1 border border-hairline overflow-hidden shadow-2xl ${className}`}>
      {/* Canvas Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-surface-2/80 border-b border-hairline/60 z-10">
        <div className="flex items-center gap-2">
          <span className="text-2xs font-extrabold uppercase tracking-wider text-ink-tertiary flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Interactive Diagram Canvas
          </span>
          <span className="text-3xs text-ink-subtle hidden sm:inline">
            (Tap any node to view cited SOP passage)
          </span>
        </div>

        {/* Zoom & Action Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleZoom(-0.15)}
            className="p-1.5 rounded-lg bg-surface-3 hover:bg-surface-4 text-ink-muted hover:text-ink transition-colors"
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-3xs font-mono font-bold text-ink-tertiary px-1">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            onClick={() => handleZoom(0.15)}
            className="p-1.5 rounded-lg bg-surface-3 hover:bg-surface-4 text-ink-muted hover:text-ink transition-colors"
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={handleResetZoom}
            className="p-1.5 rounded-lg bg-surface-3 hover:bg-surface-4 text-ink-muted hover:text-ink transition-colors"
            title="Reset Zoom"
          >
            <Maximize2 size={14} />
          </button>
          <div className="w-px h-4 bg-hairline mx-1" />
          <button
            onClick={handleExportSvg}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/15 text-primary border border-primary/30 text-2xs font-bold hover:bg-primary/25 transition-colors"
            title="Export clean SVG diagram"
          >
            <Download size={12} />
            <span>Export SVG</span>
          </button>
        </div>
      </div>

      {/* Main Flowchart Viewport */}
      <div
        className="relative flex-1 p-6 overflow-auto min-h-[420px] flex items-center justify-center bg-radial-grid select-none"
        style={{
          backgroundSize: "24px 24px",
          backgroundImage:
            "radial-gradient(circle, rgba(255, 255, 255, 0.04) 1px, transparent 1px)",
        }}
      >
        {isRendering && (
          <div className="flex flex-col items-center gap-3 text-ink-muted">
            <RefreshCw size={24} className="text-primary animate-spin" />
            <span className="text-xs font-semibold">Generating visual flowchart nodes...</span>
          </div>
        )}

        {!isRendering && renderError && (
          /* Interactive Fallback Grid if Mermaid cannot parse */
          <div className="w-full max-w-xl space-y-4 text-center py-6">
            <div className="flex items-center justify-center gap-2 text-amber-400">
              <AlertTriangle size={18} />
              <span className="text-xs font-bold">Standard Node Flow Display Active</span>
            </div>
            <div className="space-y-3">
              {nodes.map((node) => {
                const isSelected = selectedNodeId === node.id;
                return (
                  <div
                    key={node.id}
                    onClick={() => onSelectNode(node.id)}
                    className={`cursor-pointer p-3.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "bg-primary/15 border-primary shadow-lg ring-1 ring-primary/40"
                        : node.type === "warning"
                        ? "bg-rose-500/10 border-rose-500/40 text-rose-200"
                        : node.type === "decision"
                        ? "bg-amber-500/10 border-amber-500/40 text-amber-200"
                        : "bg-surface-2 border-hairline text-ink"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>{node.label}</span>
                      <span className="text-3xs uppercase font-mono px-2 py-0.5 rounded bg-surface-3">
                        {node.type}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!isRendering && !renderError && svgContent && (
          <div
            ref={containerRef}
            className="w-full transition-transform duration-200 origin-center"
            style={{ transform: `scale(${zoomLevel})` }}
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        )}
      </div>

      {/* Canvas Footnote */}
      <div className="flex items-center justify-between px-4 py-2 bg-surface-2 border-t border-hairline/60 text-3xs text-ink-tertiary">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Start / End
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-primary" /> Action Steps
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rotate-45 rounded-xs bg-amber-500" /> Decision Checks
          </span>
          <span className="flex items-center gap-1.5 text-rose-400 font-bold">
            <span className="w-2.5 h-2.5 rounded-xs bg-rose-500" /> Critical Warnings
          </span>
        </div>
        <span>High-definition vector geometry</span>
      </div>
    </div>
  );
}
