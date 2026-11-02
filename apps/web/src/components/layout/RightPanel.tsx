import { useEffect, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  FileText,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Layers,
  Sparkles,
} from "lucide-react";
import { documentsApi, getSocket } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import type { PanelType } from "./AppShell";

function StatusIcon({ status }: { status: string }) {
  if (status === "indexed") return <CheckCircle2 size={12} className="text-success" />;
  if (status === "processing") return <Loader2 size={12} className="text-primary animate-spin" />;
  if (status === "failed") return <AlertTriangle size={12} className="text-danger" />;
  if (status === "needs_ocr") return <Clock size={12} className="text-warning" />;
  return <Clock size={12} className="text-ink-tertiary" />;
}

export function RightPanel({ panel = "manager" }: { panel?: PanelType }) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const basePath = `/${panel}`;
  const [liveProgress, setLiveProgress] = useState<{ docId: string; progress: number; stage: string } | null>(null);

  const { data: rawDocuments = [] } = useQuery({
    queryKey: ["right-panel-documents"],
    queryFn: async () => {
      try {
        const res = await documentsApi.list(1, 20);
        return Array.isArray(res.data?.data) ? res.data.data : [];
      } catch {
        return [];
      }
    },
    refetchInterval: 10_000,
  });

  const docList: any[] = Array.isArray(rawDocuments)
    ? rawDocuments
    : (Array.isArray((rawDocuments as any)?.data?.data)
      ? (rawDocuments as any).data.data
      : (Array.isArray((rawDocuments as any)?.data)
        ? (rawDocuments as any).data
        : []));

  useEffect(() => {
    const socket = getSocket();

    const onProgress = (data: { documentId: string; progress: number; stage: string }) => {
      setLiveProgress({ docId: data.documentId, progress: data.progress, stage: data.stage });
      if (data.progress >= 100) {
        setTimeout(() => setLiveProgress(null), 3000);
      }
    };

    const onStatus = () => {
      queryClient.invalidateQueries({ queryKey: ["right-panel-documents"] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["analytics"] });
    };

    socket.on("document:progress", onProgress);
    socket.on("document:status", onStatus);

    return () => {
      socket.off("document:progress", onProgress);
      socket.off("document:status", onStatus);
    };
  }, [queryClient]);

  const activeProcessingDocs = docList.filter((d: any) => d && d.status === "processing");
  const indexedDocs = docList.filter((d: any) => d && d.status === "indexed");

  return (
    <div className="flex flex-col h-full overflow-y-auto scrollbar-none p-4 space-y-5">
      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-ink-subtle uppercase tracking-wide flex items-center gap-1.5">
            <Layers size={13} className="text-primary" />
            Document Processing Queue
          </h3>
          <span className="badge-muted text-2xs font-mono">{activeProcessingDocs.length} Active</span>
        </div>

        {liveProgress && (
          <div className="mb-2 p-2.5 rounded-lg bg-surface-2 border border-primary/40 animate-fade-in space-y-1.5">
            <div className="flex items-center justify-between text-2xs">
              <span className="text-ink font-medium truncate">{liveProgress.stage}</span>
              <span className="font-mono text-primary font-bold">{liveProgress.progress}%</span>
            </div>
            <div className="w-full bg-surface-3 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all duration-300"
                style={{ width: `${liveProgress.progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          {docList.slice(0, 4).map((doc: any) => (
            <Link
              key={doc.id}
              to={`${basePath}/knowledge/manuals/${doc.id}`}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg bg-surface-2 border border-hairline hover:border-hairline-strong transition-colors group"
            >
              <StatusIcon status={doc.status} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-ink truncate group-hover:text-primary transition-colors">{doc.title}</p>
                <p className="text-2xs text-ink-tertiary capitalize">
                  {doc.revision} · {doc.status} · {formatRelativeTime(doc.createdAt)}
                </p>
              </div>
            </Link>
          ))}

          {docList.length === 0 && (
            <p className="text-2xs text-ink-tertiary p-3 text-center border border-dashed border-hairline rounded-lg">
              No documents in processing queue
            </p>
          )}
        </div>
      </section>

      <div className="divider" />

      <section>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-ink-subtle uppercase tracking-wide flex items-center gap-1.5">
            <BookOpen size={13} className="text-primary" />
            Authorized Plant Manuals
          </h3>
          <span className="badge-primary text-2xs">{indexedDocs.length}</span>
        </div>

        <div className="space-y-2">
          {indexedDocs.slice(0, 3).map((src: any) => (
            <Link
              key={src.id}
              to={`${basePath}/knowledge/manuals/${src.id}`}
              className="block rounded-lg border border-hairline bg-surface-2 p-3 hover:border-primary/40 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <FileText size={12} className="text-primary flex-shrink-0" />
                  <span className="text-xs font-semibold text-ink truncate max-w-[180px] group-hover:text-primary transition-colors">
                    {src.title}
                  </span>
                </div>
                <ExternalLink size={11} className="text-ink-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div className="flex items-center gap-2 text-2xs text-ink-tertiary font-mono">
                <span>{src.revision}</span>
                <span>•</span>
                <span>{src.pageCount || 1} pages</span>
              </div>
            </Link>
          ))}

          {indexedDocs.length === 0 && (
            <p className="text-2xs text-ink-tertiary p-3 text-center border border-dashed border-hairline rounded-lg">
              No indexed manuals currently linked
            </p>
          )}
        </div>
      </section>

      <div className="divider" />

      <section>
        <h3 className="text-xs font-semibold text-ink-subtle uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <Sparkles size={13} className="text-primary" />
          Active Intelligence Guardrails
        </h3>
        <div className="space-y-2 text-2xs">
          <div className="p-2.5 rounded-lg bg-surface-2 border border-hairline space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink">Zero Hallucination</span>
              <span className="text-success font-mono font-bold">STRICT</span>
            </div>
            <p className="text-ink-tertiary">All copilot answers require direct citations from verified plant SOPs.</p>
          </div>
          <div className="p-2.5 rounded-lg bg-surface-2 border border-hairline space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-ink">Role Separation</span>
              <span className="text-primary font-mono font-bold">{panel.toUpperCase()}</span>
            </div>
            <p className="text-ink-tertiary">
              {panel === "admin"
                ? "Full administrative controls and telemetry."
                : "Shift operations and plant floor execution."}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
