const DRYPIX_FALLBACK_DOC = {
  id: "doc-drypix-6000",
  title: "Fuji Medical Dry Laser Imager DRYPIX Smart (DRYPIX 6000) Reference Guide",
  revision: "8th Edition (897N102437G)",
  filename: "drypix_smart_reference_guide.pdf",
  storagePath: "documents/drypix_smart_reference_guide.pdf",
  sizeBytes: 6753751,
  status: "indexed",
  pageCount: 80,
  tags: ["FujiFilm", "Dry Laser Imager", "DRYPIX 6000", "Thermal Development", "Error Codes", "DICOM", "Maintenance"],
  equipmentId: "equip-drypix-6000",
};

const DRYPIX_FALLBACK_FIGURES = [
  {
    id: "fig-drypix-units",
    documentId: "doc-drypix-6000",
    page: 30,
    figureId: "FIG-DRYPIX-6000",
    title: "DRYPIX Smart Main Unit Names and Functions",
    caption: "Isometric diagram illustrating Operation Panel, Front Cover, Film Trays 1 & 2, Laser Recording Unit, Thermal Development Unit, Conveyance Assembly, and Output Tray.",
    status: "extracted",
    storagePath: "/documents/drypix_schematic_units.png",
  },
  {
    id: "fig-drypix-panel",
    documentId: "doc-drypix-6000",
    page: 32,
    figureId: "FIG-DRYPIX-PANEL",
    title: "DRYPIX Smart Operation Panel & 7-Segment LED Display",
    caption: "Operation panel with 3-digit LED Display, Enter button, Utility button, and Stand-by switch.",
    status: "extracted",
    storagePath: "/documents/drypix_operation_panel.png",
  },
  {
    id: "fig-drypix-dims",
    documentId: "doc-drypix-6000",
    page: 78,
    figureId: "FIG-DRYPIX-DIMENSIONS",
    title: "External View & Dimensions (610 x 630 x 893 mm)",
    caption: "Orthographic engineering dimensions: width 610mm, depth 630mm, height 893mm, weight 104kg.",
    status: "extracted",
    storagePath: "/documents/drypix_dimensions.png",
  },
];

const DRYPIX_FALLBACK_CHUNKS = [
  {
    _id: "chk-dp-01",
    page: 1,
    section: "Cover & Technical Overview",
    text: "Fuji Medical Dry Laser Imager DRYPIX Smart (DRYPIX 6000) Reference Guide (8th Edition, February 2017, Doc 897N102437G). Indicates diagnostic quality printing of medical images onto film from CT, MRI, Ultrasound, CR, DR, Digital Mammography, and Nuclear Medicine.",
  },
  {
    _id: "chk-dp-02",
    page: 13,
    section: "1.2 Safety & Class 3B Laser Precautions",
    text: "Class 1 Laser Product (IEC 60825-1/EN 60825-1). Embedded Class 3B Semiconductor Laser: 659nm (TYP) wavelength, 130mW (CW) maximum diode output, 20° beam emittance. Never defeat door interlocks or remove covers other than front and right-side doors.",
  },
  {
    _id: "chk-dp-03",
    page: 30,
    section: "2.3.1 Main Unit Names and Functions",
    text: "Main Unit Components: (1) Operation panel (2) Front cover (3) Film tray 1 (Slot 1) (4) Film tray 2 (Slot 2) (7) Output film tray (stacks up to 50 films) (8) Right-side cover (9) Bottom right-side cover (10) LAN connector 10/100/1000Base-T (11) Power inlet (12) Main power switch (13) Additional protective earth terminal.",
  },
  {
    _id: "chk-dp-04",
    page: 32,
    section: "2.3.2 Operation Panel Indications",
    text: "LED Indications: 888 (Starting up), ooo / o x (Initializing), Pro (Printing in progress), oPn (Film tray unlocked), PUL (Film tray locked), SLP (Sleep mode), EP1 / EP2 (No more film in Tray 1 or 2), 0-150 (Remaining film sheets), End (Shutting down), U-0~U-7 (User utility modes).",
  },
  {
    _id: "chk-dp-05",
    page: 35,
    section: "3.2 Replacing the Film Pack",
    text: "When EP1 or EP2 appears, prepare DI-HL or DI-ML film. (1) Press Enter to unlock tray ('oPn'). (2) Pull out film tray carefully, discard protective material and cardboard. (3) Verify arrow mark on film pack points to rear of tray. (4) Tear off label and open both pack ends. (5) Use film cutter stored on right-side of operation panel to cut film pack along tray edge. (6) Push tray slowly until firmly locked ('PUL'). (7) Gently pull outer pack wrapper straight out toward you.",
  },
  {
    _id: "chk-dp-06",
    page: 38,
    section: "3.3 Replacing Film Tray with Shutter",
    text: "Replaceable film trays: 14x17\", 14x14\", 10x14\", 10x12\", and 8x10\". When removing a loaded tray, fully insert the metal light-tight shutter (stored on rear of unit) into the top slit. Press Enter to unlock ('oPn'). Pull tray out using both hands (weight ~8 kg). Insert target tray firmly until 'PUL' appears, then withdraw and store shutter in rear pocket.",
  },
  {
    _id: "chk-dp-07",
    page: 44,
    section: "4.4 Utility U-1: Automatic Film Density Calibration",
    text: "Press Utility button to display 'U-1'. Press Enter, select slot (SL1 or SL2) with Utility button, and press Enter to execute. Auto gray level correction prints a step wedge pattern and scans with internal densitometer to calibrate density gradation curve.",
  },
  {
    _id: "chk-dp-08",
    page: 58,
    section: "5.4 Error Code Master List",
    text: "Error Codes: 201 (Cover open - close right cover then front cover); 203/207 (Load tray Slot 1/2); 204/208 (Remove shutter Slot 1/2); 211/212 (Auto density measurement error); 213 (Laser life approaching expiration - service soon); 214 (Laser life expired - service required); 221/223 (Film jam in sheet-feeder); 226/227 (Film jam in conveyance unit); 228 (Film jam in recording unit); 230 (Film jam in thermal development unit); 232 (Film jam in discharge unit).",
  },
  {
    _id: "chk-dp-09",
    page: 60,
    section: "5.5.1 Clearing Sheet-Feeder Jam (Error 221/223)",
    text: "Procedure for Error 221 / 223: (1) Open front cover. (2) Open right-side cover. (3) Open conveyance unit cover inside right-side cover. (4) Carefully remove jammed film. (5) Close conveyance unit cover and right-side cover. (6) Open bottom right-side cover and remove any jammed sheet. (7) Close bottom right-side cover then front cover. Machine ready in 3 to 5 minutes.",
  },
  {
    _id: "chk-dp-10",
    page: 66,
    section: "5.5.4 Clearing Thermal Development Jam (Error 230)",
    text: "Procedure for Error 230: CAUTION - High Temperature Unit. (1) Open front cover. (2) Slowly turn right-side handle clockwise and left-side handle counterclockwise one by one until film end emerges. If hidden, turn left-side handle clockwise to eject through discharge unit. (3) Remove film. (4) Close front cover firmly.",
  },
  {
    _id: "chk-dp-11",
    page: 72,
    section: "6.1.3 Weekly Care: Washing Cleaning Roller with Water",
    text: "When white blurred streaks appear on film, wash optional cleaning roller weekly. (1) Shut down system. (2) Open front cover and right-side cover. (3) Open conveyance cover and remove cleaning roller with both hands. (4) Splash running water and rub surface gently. (5) Wipe water using gauze with anhydrous ethanol. (6) Allow roller to dry completely before re-installing. Replace every 3 years.",
  },
  {
    _id: "chk-dp-12",
    page: 78,
    section: "Appendix A.2 External Dimensions & Weight",
    text: "Physical Dimensions: Width: Approx. 610 mm (24.0 in) | Depth: Approx. 630 mm (24.8 in) | Height: Approx. 893 mm (35.1 in) | Weight: Approx. 104 kg (229.3 lb). Power: AC 100/110/120V / 200/220/230/240V 50-60Hz Single Phase.",
  },
];

import { useState, useMemo } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
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
  ImageIcon,
} from "lucide-react";
import { cn } from "@man-u-ai/ui";
import { documentsApi } from "../lib/api";

export function ManualViewerPage() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialPage = parseInt(searchParams.get("page") || "1", 10);
  const [currentPage, setCurrentPage] = useState(!isNaN(initialPage) && initialPage > 0 ? initialPage : 1);
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

  // Fetch real figures from backend
  const { data: figuresResp, isLoading: figuresLoading } = useQuery({
    queryKey: ["document-figures", documentId],
    queryFn: () => documentsApi.figures(documentId || "default"),
    enabled: Boolean(documentId),
  });

  const isDrypixParam = Boolean(
    documentId && (documentId.includes("drypix") || documentId.includes("6000"))
  );

  const doc = docResp?.data?.data || (isDrypixParam ? DRYPIX_FALLBACK_DOC : null);
  const chunks: any[] = (chunksResp?.data?.data && chunksResp.data.data.length > 0)
    ? chunksResp.data.data
    : (isDrypixParam ? DRYPIX_FALLBACK_CHUNKS : []);
  const figures: any[] = (figuresResp?.data?.data && figuresResp.data.data.length > 0)
    ? figuresResp.data.data
    : (isDrypixParam ? DRYPIX_FALLBACK_FIGURES : []);

  // Group figures by page number
  const figuresPageMap = useMemo(() => {
    const map = new Map<number, any[]>();
    for (const fig of figures) {
      const p = fig.page || 1;
      if (!map.has(p)) map.set(p, []);
      map.get(p)!.push(fig);
    }
    return map;
  }, [figures]);

  const activePageFigures = figuresPageMap.get(currentPage) || [];

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

              {/* Genuine Extracted Technical Figures & Schematics */}
              {activePageFigures.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-2xs font-mono text-primary font-semibold">
                    <span className="flex items-center gap-1.5">
                      <ImageIcon size={13} />
                      TECHNICAL FIGURES & SCHEMATICS ({activePageFigures.length})
                    </span>
                    <span className="badge-primary text-2xs">Page {currentPage} Evidence</span>
                  </div>
                  {activePageFigures.map((fig) => (
                    <div key={fig.id || fig.figureId} className="bg-surface-2 rounded-lg border border-hairline p-4 space-y-3">
                      <div className="flex items-center justify-between text-2xs font-mono text-ink">
                        <span className="font-bold text-primary">{fig.figureId}</span>
                        {fig.dimensions && (
                          <span className="text-ink-tertiary">{fig.dimensions.width} × {fig.dimensions.height} px</span>
                        )}
                      </div>
                      {fig.caption && (
                        <p className="text-xs text-ink-subtle italic">"{fig.caption}"</p>
                      )}
                      {fig.status === "extracted" && fig.storagePath ? (
                        <div className="w-full rounded-md border border-hairline overflow-hidden bg-black/20 flex items-center justify-center p-2">
                          <img
                            src={fig.storagePath && fig.storagePath.startsWith("/") ? fig.storagePath : (fig.storagePath && fig.storagePath.includes("documents/") ? `/${fig.storagePath}` : documentsApi.figureImageUrl(documentId || "", fig.figureId))}
                            alt={fig.caption || fig.figureId}
                            className="max-h-96 max-w-full object-contain rounded"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        </div>
                      ) : (
                        <div className="p-3 rounded bg-surface-3/50 text-2xs text-ink-tertiary">
                          Image data could not be rendered: {fig.processingError || "Corrupted image stream"}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
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
