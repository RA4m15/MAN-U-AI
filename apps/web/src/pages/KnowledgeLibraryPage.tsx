import { useState, useMemo, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Library,
  Upload,
  Search,
  Filter,
  FileText,
  BookOpen,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Trash2,
  Eye,
  Plus,
  FileCheck,
  Layers,
  X,
  ExternalLink,
} from "lucide-react";
import { documentsApi, getSocket } from "@/lib/api";
import { cn, formatFileSize, formatRelativeTime } from "@/lib/utils";

export function KnowledgeLibraryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "all";
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // New document form state
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<string>("manual");
  const [newRevision, setNewRevision] = useState("Rev 1.0");
  const [newEquipment, setNewEquipment] = useState("");
  const [newTags, setNewTags] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Fetch real documents from MongoDB via TanStack Query
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const res = await documentsApi.list();
      return (res.data?.data || []).map((doc: any) => ({
        ...doc,
        category:
          doc.tags?.some((t: string) => t.toLowerCase().includes("sop") || t.toLowerCase().includes("loto"))
            ? "sop"
            : doc.tags?.some((t: string) => t.toLowerCase().includes("schematic") || t.toLowerCase().includes("diagram"))
            ? "schematic"
            : doc.tags?.some((t: string) => t.toLowerCase().includes("safety") || t.toLowerCase().includes("emergency"))
            ? "safety"
            : "manual",
      }));
    },
    refetchInterval: 10_000,
  });

  // Socket.IO real-time ingestion status updates
  useEffect(() => {
    const socket = getSocket();
    const handleStatus = () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    };

    socket.on("document:status", handleStatus);
    socket.on("document:progress", handleStatus);

    return () => {
      socket.off("document:status", handleStatus);
      socket.off("document:progress", handleStatus);
    };
  }, [queryClient]);

  const filteredDocs = useMemo(() => {
    return documents.filter((doc: any) => {
      // Tab filter
      if (activeTab === "sops" && doc.category !== "sop") return false;
      if (activeTab === "manuals" && doc.category !== "manual") return false;
      if (activeTab === "schematics" && doc.category !== "schematic") return false;
      if (activeTab === "safety" && doc.category !== "safety") return false;

      // Status filter
      if (statusFilter !== "all" && doc.status !== statusFilter) return false;

      // Text search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = doc.title?.toLowerCase().includes(query);
        const matchesFilename = doc.filename?.toLowerCase().includes(query);
        const matchesTags = doc.tags?.some((t: string) => t.toLowerCase().includes(query));
        return matchesTitle || matchesFilename || matchesTags;
      }
      return true;
    });
  }, [documents, activeTab, statusFilter, searchQuery]);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setUploadError("Please enter a document title.");
      return;
    }

    if (!selectedFile) {
      setUploadError("Please select an authentic PDF document file to upload.");
      return;
    }

    if (!selectedFile.name.toLowerCase().endsWith(".pdf") && selectedFile.type !== "application/pdf") {
      setUploadError("Invalid file type. Only authentic PDF manuals are accepted.");
      return;
    }

    if (selectedFile.size > 50 * 1024 * 1024) {
      setUploadError("File exceeds the 50MB upload size limit.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", newTitle.trim());
      formData.append("revision", newRevision || "Rev 1.0");
      if (newTags) {
        formData.append("tags", newTags);
      }

      const res = await documentsApi.upload(formData);
      if (res.data?.success) {
        queryClient.invalidateQueries({ queryKey: ["documents"] });
        setIsUploadOpen(false);
        setNewTitle("");
        setNewTags("");
        setSelectedFile(null);
      } else {
        throw new Error(res.data?.error?.message || "Upload rejected by backend");
      }
    } catch (err: any) {
      console.error("[Upload Error]:", err);
      const errData = err.response?.data?.error;
      const msg = errData
        ? (errData.details ? `${errData.message} (${errData.details})` : errData.message)
        : (err.message || "Failed to upload document.");
      setUploadError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to remove this document and purge its vector index entries?")) {
      try {
        await documentsApi.delete(id);
        queryClient.invalidateQueries({ queryKey: ["documents"] });
      } catch (err: any) {
        alert(err.response?.data?.error?.message || "Could not delete document");
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-canvas overflow-y-auto p-4 md:p-8 space-y-6">
      {/* Top Banner / Heading */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Library className="text-primary w-5 h-5" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-ink">
              Knowledge Library
            </h1>
            <span className="badge-primary text-2xs font-mono">{documents.length} Ingested</span>
          </div>
          <p className="text-xs md:text-sm text-ink-subtle">
            Verified equipment manuals, SOPs, electrical schematics, and safety compliance guides stored in private object storage.
          </p>
        </div>

        <button
          onClick={() => {
            setIsUploadOpen(true);
            setUploadError(null);
          }}
          className="btn-primary self-start sm:self-auto flex items-center gap-2 shadow-sm"
        >
          <Plus size={15} />
          Upload Document
        </button>
      </div>

      {/* Tabs bar */}
      <div className="flex items-center gap-1 border-b border-hairline overflow-x-auto pb-px">
        {[
          { key: "all", label: "All Documents", count: documents.length },
          { key: "manuals", label: "Equipment Manuals", count: documents.filter((d: any) => d.category === "manual").length },
          { key: "sops", label: "SOPs", count: documents.filter((d: any) => d.category === "sop").length },
          { key: "schematics", label: "Diagrams & Schematics", count: documents.filter((d: any) => d.category === "schematic").length },
          { key: "safety", label: "Safety Bulletins", count: documents.filter((d: any) => d.category === "safety").length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSearchParams({ tab: tab.key })}
            className={cn(
              "flex items-center gap-2 px-3 py-2 text-xs font-medium border-b-2 transition-all whitespace-nowrap",
              activeTab === tab.key
                ? "border-primary text-ink"
                : "border-transparent text-ink-tertiary hover:text-ink-subtle"
            )}
          >
            {tab.label}
            <span className={cn(
              "text-2xs px-1.5 py-0.2 rounded-full font-mono",
              activeTab === tab.key ? "bg-primary/20 text-primary" : "bg-surface-3 text-ink-tertiary"
            )}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
          <input
            type="text"
            placeholder="Search by title, equipment tag or filename..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-ink-tertiary" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input text-xs w-36"
          >
            <option value="all">All Statuses</option>
            <option value="indexed">Indexed (Ready)</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed Index</option>
          </select>
        </div>
      </div>

      {/* Documents Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-xs text-ink-subtle flex items-center justify-center gap-2">
          <Loader2 size={16} className="animate-spin text-primary" />
          <span>Loading knowledge records from database...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredDocs.map((doc: any) => (
            <div
              key={doc.id}
              className="card bg-surface-1 border border-hairline rounded-xl p-4 flex flex-col justify-between hover:border-hairline-strong transition-all group relative shadow-card"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-surface-2 border border-hairline flex items-center justify-center flex-shrink-0 text-primary">
                      {doc.category === "manual" && <BookOpen size={16} />}
                      {doc.category === "sop" && <FileCheck size={16} />}
                      {doc.category === "schematic" && <Layers size={16} />}
                      {doc.category === "safety" && <AlertTriangle size={16} />}
                    </div>
                    <div className="min-w-0">
                      <span className="text-2xs font-mono uppercase tracking-wider text-ink-tertiary">
                        {doc.category} · {doc.revision}
                      </span>
                      <h3 className="text-sm font-semibold text-ink truncate group-hover:text-primary transition-colors">
                        {doc.title}
                      </h3>
                    </div>
                  </div>

                  {/* Status Badge */}
                  {doc.status === "indexed" && (
                    <span className="badge-success text-2xs flex-shrink-0">
                      <CheckCircle2 size={10} /> Indexed
                    </span>
                  )}
                  {doc.status === "processing" && (
                    <span className="badge-primary text-2xs flex-shrink-0">
                      <Loader2 size={10} className="animate-spin" /> Ingesting
                    </span>
                  )}
                  {doc.status === "failed" && (
                    <span className="badge-danger text-2xs flex-shrink-0">
                      <AlertTriangle size={10} /> Index Error
                    </span>
                  )}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 my-3">
                  {(doc.tags || []).map((t: string, idx: number) => (
                    <span key={idx} className="badge-muted text-2xs font-mono">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>

              {/* Footer & Actions */}
              <div className="pt-3 border-t border-hairline flex items-center justify-between text-2xs text-ink-tertiary font-mono">
                <div className="flex items-center gap-2">
                  <span>{doc.pageCount || 1} pages</span>
                  <span>•</span>
                  <span>{formatFileSize(doc.sizeBytes || 4500000)}</span>
                </div>

                <div className="flex items-center gap-1 font-sans">
                  <Link
                    to={`/knowledge/manuals/${doc.id}`}
                    className="btn-icon p-1.5 text-ink-subtle hover:text-ink"
                    title="Open in Document Viewer"
                  >
                    <Eye size={13} />
                  </Link>
                  <button
                    onClick={() => handleDelete(doc.id)}
                    className="btn-icon p-1.5 text-ink-subtle hover:text-danger"
                    title="Delete Document"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {filteredDocs.length === 0 && !isLoading && (
        <div className="text-center py-12 border border-dashed border-hairline rounded-xl">
          <FileText className="mx-auto text-ink-tertiary w-8 h-8 mb-2" />
          <p className="text-sm font-medium text-ink">No documents match the active filter</p>
          <p className="text-xs text-ink-subtle mt-1">Upload a real equipment manual or clear search filters.</p>
        </div>
      )}

      {/* Upload Document Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-1 border border-hairline rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-hairline mb-4">
              <div className="flex items-center gap-2">
                <Upload size={16} className="text-primary" />
                <h3 className="text-sm font-semibold text-ink">Upload Plant Manual / SOP</h3>
              </div>
              <button
                onClick={() => setIsUploadOpen(false)}
                className="btn-icon p-1"
              >
                <X size={15} />
              </button>
            </div>

            {uploadError && (
              <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/30 flex items-center gap-2 text-xs text-danger">
                <AlertTriangle size={14} className="flex-shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4">
              <div>
                <label className="block text-2xs font-medium text-ink-subtle uppercase mb-1">
                  Document Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sulzer Feedwater Pump Overhaul Standard"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-medium text-ink-subtle uppercase mb-1">
                    Document Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="input text-xs"
                  >
                    <option value="manual">Equipment Manual</option>
                    <option value="sop">Standard Operating Procedure (SOP)</option>
                    <option value="schematic">Technical Schematic / Diagram</option>
                    <option value="safety">Safety Bulletin / Hazard Protocol</option>
                  </select>
                </div>
                <div>
                  <label className="block text-2xs font-medium text-ink-subtle uppercase mb-1">
                    Revision / Edition
                  </label>
                  <input
                    type="text"
                    placeholder="Rev 2.1"
                    value={newRevision}
                    onChange={(e) => setNewRevision(e.target.value)}
                    className="input text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-2xs font-medium text-ink-subtle uppercase mb-1">
                  Technical Tags (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="Hydraulics, Seals, Torque, LOTO"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  className="input text-xs"
                />
              </div>

              {/* Drag and drop upload zone */}
              <div>
                <label className="block text-2xs font-medium text-ink-subtle uppercase mb-1">
                  PDF Technical Manual <span className="text-danger">*</span>
                </label>
                <div className={cn(
                  "border-2 border-dashed rounded-xl p-5 text-center bg-surface-2 transition-colors cursor-pointer relative",
                  selectedFile ? "border-primary/60 bg-primary/5" : "border-hairline hover:border-primary/50"
                )}>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0];
                        if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
                          setUploadError("Invalid file type. Only authentic PDF manuals are accepted.");
                          setSelectedFile(null);
                          return;
                        }
                        if (file.size > 50 * 1024 * 1024) {
                          setUploadError("File exceeds the 50MB maximum upload limit.");
                          setSelectedFile(null);
                          return;
                        }
                        setSelectedFile(file);
                        setUploadError(null);
                        if (!newTitle.trim()) {
                          setNewTitle(file.name.replace(/\.[^/.]+$/, ""));
                        }
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <FileText className={cn("mx-auto w-7 h-7 mb-2", selectedFile ? "text-primary" : "text-ink-tertiary")} />
                  <p className="text-xs font-medium text-ink">
                    {selectedFile ? selectedFile.name : "Select or drag authentic PDF manual here"}
                  </p>
                  <p className="text-2xs text-ink-tertiary mt-1">
                    Accepts genuine PDF files up to 50MB. OCR and structural chunking run in background.
                  </p>
                  {!selectedFile && (
                    <p className="text-2xs text-amber-500/90 mt-1 font-medium">
                      Authentic PDF file selection is required to enable upload.
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !selectedFile || !newTitle.trim()}
                  className="btn-primary text-xs flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isUploading && <Loader2 size={13} className="animate-spin" />}
                  <span>{isUploading ? "Uploading to Storage..." : "Start Ingestion"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
