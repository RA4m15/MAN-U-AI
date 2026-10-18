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
  AlertCircle,
  RefreshCw,
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
  status: "success" | "warning" | "error" | "Status unavailable" | string;
  timestamp: string | null;
  metadata?: Record<string, string>;
}

export function ActivityPage() {
  const queryClient = useQueryClient();
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [actionFilter, setActionFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: resp,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
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
  const logs: AuditLogItem[] = Array.isArray(rawLogs)
    ? rawLogs.map((l: any) => ({
        id: String(l.id || l._id),
        action: l.action || "audit_event",
        actorName: l.actorName || l.userEmail || "Actor unavailable",
        actorRole: l.actorRole || "Role unavailable",
        description: l.description || (l.action ? `Action: ${l.action}` : "Description unavailable"),
        resourceTitle: l.resourceTitle || l.resourceType || "Resource unavailable",
        status: (l.status as any) || "Status unavailable",
        timestamp: l.timestamp || l.createdAt || null,
        metadata: l.metadata || {},
      }))
    : [];

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
              `"${l.id}","${l.action}","${l.actorName}","${l.actorRole}","${l.description.replace(/"/g, '""')}","${l.timestamp || "Timestamp unavailable"}","${l.status}"`
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

  const getErrorMessage = () => {
    if (!error) return "Failed to retrieve audit trail from the database.";
    const axiosErr = error as any;
    if (axiosErr.response?.status === 503) {
      return "Database connection unavailable for audit log retrieval.";
    }
    return axiosErr.response?.data?.error?.message || axiosErr.message || "Failed to load audit events from database.";
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
            {!isLoading && !isError && (
              <span className="badge-primary text-2xs">{logs.length} Events</span>
            )}
            <span className="badge-muted text-2xs font-mono">Live Socket.IO</span>
          </div>
          <p className="text-xs md:text-sm text-ink-subtle">
            Complete traceability of AI RAG inquiries, document ingestions, safety authorizations, and permission modifications.
          </p>
        </div>

        {logs.length > 0 && (
          <button
            onClick={handleExport}
            className="btn-secondary self-start sm:self-auto flex items-center gap-2 text-xs"
          >
            <Download size={14} />
            Export Audit Trail (CSV)
          </button>
        )}
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
          <input
            type="text"
            placeholder="Search by action, actor, resource, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-ink-tertiary" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="input text-xs w-44"
          >
            <option value="all">All Operational Events</option>
            <option value="rag_query">RAG Inquiries</option>
            <option value="doc_upload">Manual Ingestions</option>
            <option value="doc_delete">Document Deletions</option>
            <option value="equipment_create">Equipment Created</option>
            <option value="equipment_delete">Equipment Deleted</option>
            <option value="role_change">Role Permissions</option>
            <option value="auth_login">Authentication</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="card bg-surface-1 border border-hairline p-12 flex flex-col items-center justify-center text-center space-y-3">
          <Loader2 size={24} className="animate-spin text-primary" />
          <p className="text-xs text-ink-subtle">Loading authentic audit records from MongoDB...</p>
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="card bg-surface-1 border border-danger/30 p-8 flex flex-col items-center justify-center text-center space-y-4">
          <div className="p-3 rounded-full bg-danger/10 text-danger">
            <AlertCircle size={28} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink">Failed to Load Audit Trail</h3>
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
      {!isLoading && !isError && logs.length === 0 && (
        <div className="card bg-surface-1 border border-hairline p-12 flex flex-col items-center justify-center text-center space-y-4">
          <div className="p-4 rounded-full bg-surface-2 border border-hairline text-ink-tertiary">
            <Shield size={32} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-ink">No Audit Events Logged</h3>
            <p className="text-xs text-ink-subtle mt-1 max-w-sm">
              No user activities, document uploads, or system actions have been recorded yet in the audit collection.
            </p>
          </div>
        </div>
      )}

      {/* Empty Filter State */}
      {!isLoading && !isError && logs.length > 0 && filteredLogs.length === 0 && (
        <div className="card bg-surface-1 border border-hairline p-8 text-center text-xs text-ink-subtle">
          No audit events match your current filter or search criteria.
        </div>
      )}

      {/* Populated Audit Log Table */}
      {!isLoading && !isError && filteredLogs.length > 0 && (
        <div className="card bg-surface-1 border border-hairline rounded-xl overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-2 border-b border-hairline text-2xs uppercase tracking-wider text-ink-tertiary">
                <tr>
                  <th className="py-3 px-4">Event Type</th>
                  <th className="py-3 px-4">Actor</th>
                  <th className="py-3 px-4">Activity Description</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {filteredLogs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-surface-2/60 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-4">
                      <span className="badge-primary text-2xs font-mono uppercase">
                        {log.action.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-semibold text-ink">{log.actorName}</p>
                        <p className="text-2xs text-ink-tertiary">{log.actorRole}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-ink-subtle max-w-md truncate">
                      {log.description}
                    </td>
                    <td className="py-3 px-4 text-ink-tertiary text-2xs font-mono whitespace-nowrap">
                      {log.timestamp ? formatRelativeTime(log.timestamp) : "Timestamp unavailable"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button className="btn-secondary text-2xs py-1 px-2 group-hover:border-primary/40">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-1 border border-hairline rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-hairline mb-4">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-primary" />
                <h3 className="text-sm font-semibold text-ink">Audit Event Details</h3>
              </div>
              <button onClick={() => setSelectedLog(null)} className="btn-icon p-1">
                <X size={15} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-surface-2 border border-hairline">
                  <span className="text-2xs text-ink-tertiary">Event Action</span>
                  <p className="font-mono font-medium text-ink mt-0.5">{selectedLog.action}</p>
                </div>
                <div className="p-3 rounded-lg bg-surface-2 border border-hairline">
                  <span className="text-2xs text-ink-tertiary">Status</span>
                  <p
                    className={cn(
                      "font-medium capitalize mt-0.5",
                      selectedLog.status === "success"
                        ? "text-success"
                        : selectedLog.status === "warning"
                        ? "text-warning"
                        : selectedLog.status === "error"
                        ? "text-danger"
                        : "text-ink-subtle"
                    )}
                  >
                    {selectedLog.status}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-surface-2 border border-hairline">
                <span className="text-2xs text-ink-tertiary">Actor Information</span>
                <p className="font-medium text-ink mt-0.5">
                  {selectedLog.actorName} ({selectedLog.actorRole})
                </p>
              </div>

              <div className="p-3 rounded-lg bg-surface-2 border border-hairline">
                <span className="text-2xs text-ink-tertiary">Description</span>
                <p className="text-ink mt-0.5 leading-relaxed">{selectedLog.description}</p>
              </div>

              <div className="p-3 rounded-lg bg-surface-2 border border-hairline">
                <span className="text-2xs text-ink-tertiary">Timestamp</span>
                <p className="font-mono text-ink mt-0.5">
                  {selectedLog.timestamp
                    ? `${new Date(selectedLog.timestamp).toLocaleString()} (${selectedLog.timestamp})`
                    : "Timestamp unavailable"}
                </p>
              </div>

              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div className="p-3 rounded-lg bg-surface-2 border border-hairline space-y-1">
                  <span className="text-2xs text-ink-tertiary">Event Metadata</span>
                  <pre className="text-2xs font-mono text-ink-subtle overflow-x-auto p-1">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="pt-4 mt-4 border-t border-hairline flex justify-end">
              <button onClick={() => setSelectedLog(null)} className="btn-secondary text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
