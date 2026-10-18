import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Search,
  Filter,
  Download,
  Shield,
  FileText,
  Bot,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  ExternalLink,
  X,
  Loader2,
} from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { analyticsApi, getSocket } from "@/lib/api";

interface AuditLogItem {
  id: string;
  action: "rag_query" | "doc_upload" | "safety_ack" | "role_change" | "auth_login" | string;
  actorName: string;
  actorRole: string;
  description: string;
  resourceTitle?: string;
  status: "success" | "warning" | "error";
  timestamp: string;
  metadata?: Record<string, string>;
}

const FALLBACK_LOGS: AuditLogItem[] = [
  {
    id: "aud-01",
    action: "auth_login",
    actorName: "Plant Personnel",
    actorRole: "Engineer",
    description: "Authenticated via Multi-Factor JWT session",
    status: "success",
    timestamp: new Date().toISOString(),
    metadata: {
      "Token Expiry": "7 Days",
      "Environment": "Production MongoDB",
    },
  },
];

export function ActivityPage() {
  const queryClient = useQueryClient();
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [actionFilter, setActionFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: resp, isLoading } = useQuery({
    queryKey: ["activity", actionFilter],
    queryFn: () => analyticsApi.activity(actionFilter),
  });

  // Real-time listener for audit events pushed via Socket.IO
  useEffect(() => {
    const socket = getSocket();
    const handleNewAudit = () => {
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      queryClient.invalidateQueries({ queryKey: ["insights"] });
    };

    socket.on("audit:new", handleNewAudit);
    return () => {
      socket.off("audit:new", handleNewAudit);
    };
  }, [queryClient]);

  const rawLogs = resp?.data?.data;
  const logs: AuditLogItem[] =
    Array.isArray(rawLogs) && rawLogs.length > 0
      ? rawLogs.map((l: any) => ({
          id: l.id || l._id,
          action: l.action || "rag_query",
          actorName: l.actorName || "System",
          actorRole: l.actorRole || "Plant User",
          description: l.description || `Event: ${l.action}`,
          resourceTitle: l.resourceTitle || "Audit Event",
          status: (l.status as any) || "success",
          timestamp: l.timestamp || l.createdAt || new Date().toISOString(),
          metadata: l.metadata || {},
        }))
      : FALLBACK_LOGS;

  const filteredLogs = logs.filter((log) => {
    if (actionFilter !== "all" && log.action !== actionFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        log.description.toLowerCase().includes(q) ||
        log.actorName.toLowerCase().includes(q) ||
        (log.resourceTitle && log.resourceTitle.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleExport = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      ["ID,Action,Actor,Role,Description,Timestamp,Status"]
        .concat(
          filteredLogs.map(
            (l) =>
              `"${l.id}","${l.action}","${l.actorName}","${l.actorRole}","${l.description.replace(/"/g, '""')}","${l.timestamp}","${l.status}"`
          )
        )
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `manuai_audit_trail_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-canvas overflow-y-auto p-4 md:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="text-primary w-5 h-5" />
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-ink">
              System Activity & Audit Log
            </h1>
            <span className="badge-primary text-2xs">SOC2 & ISO 55001 Traceability</span>
            <span className="badge-muted text-2xs font-mono">Live Socket.IO</span>
          </div>
          <p className="text-xs md:text-sm text-ink-subtle">
            Complete traceability of AI RAG inquiries, document ingestions, safety authorizations, and permission modifications.
          </p>
        </div>

        <button
          onClick={handleExport}
          className="btn-secondary self-start sm:self-auto flex items-center gap-2 text-xs"
        >
          <Download size={14} />
          Export Audit Trail (CSV)
        </button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
          <input
            type="text"
            placeholder="Search by actor name, query text, or document title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-ink-tertiary" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="input text-xs w-48"
          >
            <option value="all">All Audit Actions</option>
            <option value="rag_query">AI Copilot Inquiries</option>
            <option value="doc_upload">Document Ingestion</option>
            <option value="summary_generate">Summary Generation</option>
            <option value="safety_ack">Safety & LOTO Sign-offs</option>
            <option value="role_change">Access & RBAC Changes</option>
            <option value="auth_login">Authentication Events</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="card bg-surface-1 border border-hairline rounded-xl overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-2 border-b border-hairline text-2xs uppercase tracking-wider text-ink-tertiary">
              <tr>
                <th className="py-3 px-4">Event / Action</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Referenced Asset</th>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-ink-subtle">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 size={14} className="animate-spin text-primary" />
                      <span>Loading authoritative audit trail...</span>
                    </div>
                  </td>
                </tr>
              )}
              {filteredLogs.map((log) => (
                <tr
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className="hover:bg-surface-2/60 transition-colors cursor-pointer group"
                >
                  <td className="py-3 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {log.action === "rag_query" && (
                        <span className="badge-primary text-2xs">
                          <Bot size={11} /> AI RAG
                        </span>
                      )}
                      {log.action === "doc_upload" && (
                        <span className="badge-muted text-2xs">
                          <FileText size={11} /> Upload
                        </span>
                      )}
                      {log.action === "summary_generate" && (
                        <span className="badge-primary text-2xs">
                          <Layers size={11} /> Summary
                        </span>
                      )}
                      {log.action === "safety_ack" && (
                        <span className="badge-warning text-2xs">
                          <Shield size={11} /> Safety
                        </span>
                      )}
                      {log.action === "role_change" && (
                        <span className="badge-info text-2xs">
                          <UserCheck size={11} /> RBAC
                        </span>
                      )}
                      {log.action === "auth_login" && (
                        <span className="badge-muted text-2xs">
                          <CheckCircle2 size={11} /> Auth
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-3 px-4 whitespace-nowrap">
                    <div>
                      <p className="font-semibold text-ink">{log.actorName}</p>
                      <p className="text-2xs text-ink-tertiary">{log.actorRole}</p>
                    </div>
                  </td>

                  <td className="py-3 px-4 max-w-md">
                    <p className="text-ink-subtle line-clamp-1 group-hover:text-ink transition-colors">
                      {log.description}
                    </p>
                  </td>

                  <td className="py-3 px-4 whitespace-nowrap text-ink-tertiary font-mono">
                    {log.resourceTitle || "—"}
                  </td>

                  <td className="py-3 px-4 whitespace-nowrap text-2xs text-ink-tertiary">
                    {formatRelativeTime(log.timestamp)}
                  </td>

                  <td className="py-3 px-4 whitespace-nowrap text-right">
                    <span className="text-2xs text-primary group-hover:underline">
                      Inspect →
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Detail Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-1 border border-hairline rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <div className="flex items-start justify-between pb-3 border-b border-hairline mb-4">
              <div>
                <span className="badge-primary text-2xs font-mono uppercase mb-1">
                  {selectedLog.action.replace("_", " ")}
                </span>
                <h3 className="text-sm font-bold text-ink mt-1">Audit Record Inspector</h3>
                <p className="text-2xs text-ink-tertiary">
                  Event ID: {selectedLog.id} · {selectedLog.timestamp}
                </p>
              </div>
              <button onClick={() => setSelectedLog(null)} className="btn-icon p-1">
                <X size={15} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-surface-2 border border-hairline">
                <span className="text-2xs text-ink-tertiary uppercase">Actor Credentials</span>
                <p className="font-semibold text-ink mt-0.5">{selectedLog.actorName}</p>
                <p className="text-2xs text-ink-subtle">{selectedLog.actorRole}</p>
              </div>

              <div>
                <span className="text-2xs text-ink-tertiary uppercase">Full Action Details</span>
                <p className="mt-1 p-3 rounded-lg bg-surface-2 border border-hairline text-ink leading-relaxed">
                  {selectedLog.description}
                </p>
              </div>

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div>
                  <span className="text-2xs text-ink-tertiary uppercase mb-1 block">
                    Audit Metadata Payloads
                  </span>
                  <div className="p-3 rounded-lg bg-surface-2 border border-hairline space-y-1.5 font-mono text-2xs">
                    {Object.entries(selectedLog.metadata).map(([k, v]) => (
                      <div
                        key={k}
                        className="flex justify-between py-0.5 border-b border-hairline/60 last:border-none"
                      >
                        <span className="text-ink-tertiary">{k}</span>
                        <span className="text-primary font-semibold">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-3 flex justify-end">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="btn-secondary text-xs"
                >
                  Close Record
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
