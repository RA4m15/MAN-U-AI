import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
  Search,
  BookOpen,
  Bot,
  AlertTriangle,
  ShieldAlert,
  Layers,
  Sparkles,
  ExternalLink,
  Download,
  Share2,
  Printer,
  Sliders,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { documentsApi } from "@/lib/api";

export function ManualViewerPage() {
  const { documentId } = useParams();
  const navigate = useNavigate();

  const [currentPage, setCurrentPage] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [activeTab, setActiveTab] = useState<"analysis" | "chunks" | "safety">("chunks");
  const [searchInDoc, setSearchInDoc] = useState("");

  // Fetch real document from backend
  const { data: docResp, isLoading: docLoading, error: docError } = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => documentsApi.get(documentId || "default"),
    enabled: Boolean(documentId),
  });

  // Fetch real chunks from backend
  const { data: chunksResp, isLoading: chunksLoading } = useQuery({
    queryKey: ["document-chunks", documentId],
    queryFn: () => documentsApi.chunks(documentId || "default"),
    enabled: Boolean(documentId),
  });

  const doc = docResp?.data?.data;
  const chunks: any[] = chunksResp?.data?.data || [];

  // Group chunks by page number
  const pageMap = useMemo(() => {
    const map = new Map<number, any[]>();
    for (const chunk of chunks) {
      const p = chunk.page || 1;
      if (!map.has(p)) map.set(p, []);
      map.get(p)!.push(chunk);
    }
    return map;
  }, [chunks]);

  const availablePages = useMemo(() => {
    const pages = Array.from(pageMap.keys()).sort((a, b) => a - b);
    return pages.length > 0 ? pages : [1];
  }, [pageMap]);

  const totalPages = Math.max(doc?.pageCount || 1, availablePages[availablePages.length - 1] || 1);

  // Active chunks on the currently viewed page
  const activePageChunks = pageMap.get(currentPage) || [];

  const handleNextPage = () => {
    if (currentPage < totalPages) setCurrentPage((p) => p + 1);
  };
  const handlePrevPage = () => {
    if (currentPage > 1) setCurrentPage((p) => p - 1);
  };

  const handleAskCopilot = () => {
    const docTitle = doc?.title || "Equipment Manual";
    navigate(
      `/?query=Explain+the+procedures,+specifications,+and+safety+protocols+on+page+${currentPage}+of+${encodeURIComponent(
        docTitle
      )}`
    );
  };

  if (docLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-canvas text-ink-subtle space-y-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-xs">Loading authentic manual record and vector indices...</p>
      </div>
    );
  }

  if (docError || (!doc && !docLoading && documentId)) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-canvas text-ink space-y-4 p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-danger/10 border border-danger/20 flex items-center justify-center text-danger">
          <AlertTriangle size={24} />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-bold">Document Record Not Found</h2>
          <p className="text-xs text-ink-subtle max-w-md">
            The requested technical manual ID ({documentId}) is not registered in the MongoDB knowledge database or has been deleted.
          </p>
        </div>
        <Link to="/knowledge" className="btn-primary text-xs">
          Return to Knowledge Library
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-canvas overflow-hidden">
      {/* ── Top Header Bar ─────────────────────────────────────────── */}
      <header className="h-12 border-b border-hairline bg-surface-1 px-4 flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <Link
            to="/knowledge"
            className="btn-icon p-1.5 text-ink-subtle hover:text-ink"
            title="Back to Knowledge Library"
          >
            <ChevronLeft size={16} />
          </Link>
          <div className="w-px h-4 bg-hairline" />
          <div className="flex items-center gap-2">
            <BookOpen size={14} className="text-primary" />
            <span className="text-xs font-semibold text-ink truncate max-w-xs md:max-w-md">
              {doc?.title || "Industrial Equipment Manual"}
            </span>
            <span className="badge-muted text-2xs font-mono">{doc?.revision || "Rev 1.0"}</span>
            <span className="badge-success text-2xs uppercase">
              {doc?.status === "indexed" ? "Indexed" : doc?.status || "Ready"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="hidden sm:flex items-center gap-1 bg-surface-2 border border-hairline rounded-md px-1.5 py-0.5">
            <button
              onClick={() => setZoomLevel((z) => Math.max(50, z - 15))}
              className="btn-icon p-1 text-ink-subtle hover:text-ink"
              title="Zoom out"
            >
              <ZoomOut size={13} />
            </button>
            <span className="text-2xs font-mono text-ink-subtle w-10 text-center">
              {zoomLevel}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(200, z + 15))}
              className="btn-icon p-1 text-ink-subtle hover:text-ink"
              title="Zoom in"
            >
              <ZoomIn size={13} />
            </button>
          </div>

          {/* Page pagination */}
          <div className="flex items-center gap-1 bg-surface-2 border border-hairline rounded-md px-2 py-1">
            <button
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
              className="btn-icon p-0.5 disabled:opacity-30"
            >
              <ChevronLeft size={13} />
            </button>
            <span className="text-2xs font-mono text-ink">
              Page <span className="text-primary font-bold">{currentPage}</span> / {totalPages}
            </span>
            <button
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
              className="btn-icon p-0.5 disabled:opacity-30"
            >
              <ChevronRight size={13} />
            </button>
          </div>

          <button
            onClick={handleAskCopilot}
            className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5 shadow-glow-primary"
          >
            <Bot size={13} />
            <span>Ask Copilot</span>
          </button>
        </div>
      </header>

      {/* ── Main 3-Column Viewer Workspace ──────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Indexed Pages & Sections */}
        <aside className="hidden md:flex flex-col w-64 border-r border-hairline bg-surface-1 flex-shrink-0">
          <div className="p-3 border-b border-hairline">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-tertiary" />
              <input
                type="text"
                placeholder="Find in indexed pages..."
                value={searchInDoc}
                onChange={(e) => setSearchInDoc(e.target.value)}
                className="input pl-8 py-1 text-xs"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-none">
            <div className="text-2xs font-semibold text-ink-tertiary uppercase tracking-wider px-2 py-1">
              Indexed Document Pages ({availablePages.length})
            </div>
            {availablePages
              .filter((p) => (searchInDoc ? `page ${p}`.includes(searchInDoc.toLowerCase()) : true))
              .map((p) => {
                const chunkCount = pageMap.get(p)?.length || 0;
                return (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={cn(
                      "w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors",
                      currentPage === p
                        ? "bg-surface-2 text-primary font-medium border border-primary/20"
                        : "text-ink-subtle hover:bg-surface-2 hover:text-ink"
                    )}
                  >
                    <span className="truncate">Page {p} Overview</span>
                    <span className="text-2xs text-ink-tertiary font-mono ml-2">
                      {chunkCount} {chunkCount === 1 ? "chunk" : "chunks"}
                    </span>
                  </button>
                );
              })}
          </div>

          <div className="p-3 border-t border-hairline text-2xs text-ink-tertiary flex items-center justify-between">
            <span>Indexed Chunks: {chunks.length}</span>
            <span className="flex items-center gap-1 text-success">
              <CheckCircle2 size={11} /> MongoDB Vector
            </span>
          </div>
        </aside>

        {/* Center: High-Resolution Page Canvas & Schematic Viewer */}
        <div className="flex-1 overflow-auto bg-canvas flex items-center justify-center p-4 sm:p-8">
          <div
            className="bg-surface-1 border border-hairline rounded-xl shadow-2xl relative transition-all duration-150 overflow-hidden"
            style={{
              width: `${(620 * zoomLevel) / 100}px`,
              minHeight: `${(850 * zoomLevel) / 100}px`,
            }}
          >
            {/* Header */}
            <div className="p-6 border-b border-hairline flex items-center justify-between bg-surface-2/40">
              <div className="flex items-center gap-2">
                <span className="text-2xs font-mono uppercase tracking-widest text-ink-tertiary">
                  {doc?.title || "TECHNICAL SPECIFICATION"} — PAGE {currentPage}
                </span>
              </div>
              <span className="text-2xs font-mono text-ink-tertiary">
                SHEET {currentPage} OF {totalPages}
              </span>
            </div>

            {/* Page Body Content */}
            <div className="p-6 sm:p-8 space-y-5 text-ink">
              <div className="border-b border-hairline pb-3">
                <h2 className="text-lg font-bold text-ink tracking-tight">
                  {doc?.title || "Industrial Equipment Specification"}
                </h2>
                <p className="text-xs text-ink-subtle mt-0.5">
                  Revision: {doc?.revision || "v1.0"} · Storage Object: {doc?.filename || "stored_file.pdf"}
                </p>
              </div>

              {/* Real Extracted Chunks for This Page */}
              {activePageChunks.length > 0 ? (
                <div className="space-y-4">
                  {activePageChunks.map((chunk, idx) => (
                    <div
                      key={chunk._id || idx}
                      className="p-4 rounded-lg bg-surface-2/80 border border-hairline space-y-2"
                    >
                      <div className="flex items-center justify-between text-2xs font-mono text-primary">
                        <span>CHUNK #{idx + 1} (PAGE {chunk.page})</span>
                        {chunk.section && <span>SECTION: {chunk.section}</span>}
                      </div>
                      <p className="text-xs leading-relaxed text-ink font-mono whitespace-pre-wrap">
                        {chunk.text}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-lg bg-surface-2/40 border border-dashed border-hairline text-center space-y-2">
                  <FileText className="w-8 h-8 text-ink-tertiary mx-auto" />
                  <p className="text-xs text-ink-subtle">
                    No indexed text chunks extracted for Page {currentPage}.
                  </p>
                  <p className="text-2xs text-ink-tertiary">
                    This page may contain graphical schematics, cover layout, or table formatting.
                  </p>
                </div>
              )}

              {/* Technical Schematic Diagram Demonstration Asset */}
              <div className="bg-surface-2 rounded-lg border border-hairline p-4 relative">
                <div className="flex items-center justify-between mb-2 text-2xs font-mono text-ink-tertiary">
                  <span>SCHEMATIC CROSS-SECTION</span>
                  <span className="badge-muted text-2xs">Demonstration Figure</span>
                </div>
                <div className="w-full h-44 bg-surface-3/60 rounded flex items-center justify-center border border-dashed border-hairline relative overflow-hidden">
                  <svg className="w-full h-full text-primary/40 p-4" viewBox="0 0 400 140" fill="none" stroke="currentColor">
                    <line x1="20" y1="70" x2="380" y2="70" strokeWidth="3" strokeDasharray="6 3" />
                    <rect x="60" y="30" width="80" height="80" rx="4" strokeWidth="2" />
                    <text x="75" y="65" fill="currentColor" stroke="none" fontSize="9" fontFamily="monospace">HOUSING</text>
                    <rect x="160" y="38" width="40" height="64" rx="2" strokeWidth="1.5" />
                    <text x="165" y="74" fill="#828fff" stroke="none" fontSize="8" fontFamily="monospace">GLAND (M12)</text>
                    <rect x="220" y="45" width="25" height="50" rx="1" strokeWidth="2" stroke="#5e6ad2" fill="rgba(94,106,210,0.2)" />
                    <rect x="250" y="45" width="25" height="50" rx="1" strokeWidth="2" stroke="#27a644" fill="rgba(39,166,68,0.2)" />
                    <path d="M 290 55 L 340 55 L 340 85 L 290 85" strokeWidth="1.5" />
                    <circle cx="237" cy="45" r="4" fill="#ef4444" />
                    <line x1="237" y1="45" x2="270" y2="20" stroke="#ef4444" strokeWidth="1" />
                    <text x="275" y="22" fill="#ef4444" stroke="none" fontSize="8" fontFamily="monospace">TORQUE: 45 N·m</text>
                  </svg>
                </div>
                <p className="text-2xs text-ink-tertiary mt-2">
                  * System Demonstration Asset: Illustrative assembly cross-section for mechanical rebuilds.
                </p>
              </div>
            </div>

            {/* Page Footer */}
            <div className="p-4 border-t border-hairline bg-surface-2/30 flex items-center justify-between text-2xs text-ink-tertiary">
              <span>MAN-U-AI Multimodal Vector Search</span>
              <span>Doc ID: {documentId?.slice(0, 12)}...</span>
            </div>
          </div>
        </div>

        {/* Right: AI Document Intelligence & Context Insights */}
        <aside className="hidden lg:flex flex-col w-80 border-l border-hairline bg-surface-1 flex-shrink-0">
          <div className="flex items-center border-b border-hairline px-3">
            {[
              { id: "chunks", label: `Page Chunks (${activePageChunks.length})` },
              { id: "analysis", label: "Metadata" },
              { id: "safety", label: "Safety Flags" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "px-3 py-2.5 text-xs font-medium border-b-2 transition-colors",
                  activeTab === tab.id
                    ? "border-primary text-ink"
                    : "border-transparent text-ink-tertiary hover:text-ink-subtle"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-none">
            {activeTab === "chunks" && (
              <div className="space-y-2">
                {activePageChunks.length > 0 ? (
                  activePageChunks.map((chunk, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-surface-2 border border-hairline text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between text-2xs font-mono text-primary">
                        <span>Chunk #{idx + 1}</span>
                        <span>{chunk.tokenCount || 120} tokens</span>
                      </div>
                      <p className="text-ink-subtle text-2xs font-mono line-clamp-4">
                        "{chunk.text}"
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-ink-tertiary text-center py-6">
                    No chunk records on this page.
                  </p>
                )}
              </div>
            )}

            {activeTab === "analysis" && (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-surface-2 border border-hairline">
                  <div className="flex items-center gap-1.5 text-2xs font-semibold text-primary mb-1">
                    <Sparkles size={12} />
                    DOCUMENT SPECIFICATIONS
                  </div>
                  <div className="space-y-1.5 text-xs text-ink-subtle mt-2">
                    <div className="flex justify-between py-1 border-b border-hairline">
                      <span className="text-ink-tertiary">Filename</span>
                      <span className="font-mono text-ink text-2xs">{doc?.filename}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-hairline">
                      <span className="text-ink-tertiary">File Size</span>
                      <span className="font-mono text-ink text-2xs">
                        {((doc?.sizeBytes || 0) / (1024 * 1024)).toFixed(1)} MB
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-hairline">
                      <span className="text-ink-tertiary">Total Pages</span>
                      <span className="font-mono text-primary font-semibold">{totalPages}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-ink-tertiary">Processing Status</span>
                      <span className="badge-success text-2xs">{doc?.status || "indexed"}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleAskCopilot}
                  className="btn-secondary w-full text-xs flex items-center justify-center gap-2"
                >
                  <Bot size={14} className="text-primary" />
                  Query Copilot On This Page
                </button>
              </div>
            )}

            {activeTab === "safety" && (
              <div className="space-y-3">
                <div className="notice-danger">
                  <ShieldAlert size={15} className="text-danger flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-danger">
                    <strong>Critical Hazard Verification Required</strong>
                    <p className="mt-0.5">
                      Verify complete electrical and hydraulic Lockout/Tagout (LOTO) per OSHA 1910.147 prior to performing mechanical work.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
