import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Cpu,
  BookOpen,
  BarChart3,
  Activity,
  Puzzle,
  Settings2,
  ShieldCheck,
  Bot,
  Loader2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Database,
  Radio,
  FileText,
} from "lucide-react";
import { analyticsApi, usersApi, equipmentApi, documentsApi } from "@/lib/api";

export function AdminDashboardPage() {
  const [timeRange, setTimeRange] = useState("all");

  const {
    data: insightsResp,
    isLoading: insightsLoading,
    isError: insightsError,
    refetch: refetchInsights,
  } = useQuery({
    queryKey: ["insights", timeRange],
    queryFn: () => analyticsApi.insights(timeRange),
  });

  const {
    data: usersResp,
    isLoading: usersLoading,
  } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.list(),
  });

  const {
    data: equipmentResp,
    isLoading: equipmentLoading,
  } = useQuery({
    queryKey: ["equipment"],
    queryFn: () => equipmentApi.list(),
  });

  const {
    data: documentsResp,
    isLoading: documentsLoading,
  } = useQuery({
    queryKey: ["documents"],
    queryFn: () => documentsApi.list(),
  });

  const insights = insightsResp?.data?.data;
  const users = usersResp?.data?.data || [];
  const equipment = equipmentResp?.data?.data || [];
  const documents = documentsResp?.data?.data || [];

  const roleCounts = users.reduce((acc: Record<string, number>, u: any) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});

  const isLoading = insightsLoading || usersLoading || equipmentLoading || documentsLoading;

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-canvas p-4 md:p-8 space-y-6">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              System Administration
            </span>
            <span className="badge-muted text-2xs font-mono">Administration</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-ink">
            Admin Dashboard
          </h1>
          <p className="text-sm text-ink-subtle mt-1 max-w-2xl">
            Personnel governance, plant telemetry, and infrastructure controls.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start">
          <Link to="/admin/users" className="btn-primary inline-flex items-center gap-1.5 text-xs">
            <Users size={14} />
            <span>Manage Users</span>
          </Link>
          <button
            onClick={() => refetchInsights()}
            className="btn-secondary p-2"
            title="Refresh Metrics"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </header>

      {/* Loading state */}
      {isLoading && (
        <div className="card bg-surface-1 border border-hairline p-8 flex items-center justify-center gap-3 text-ink-subtle text-xs">
          <Loader2 size={18} className="animate-spin text-primary" />
          <span>Loading plant metrics...</span>
        </div>
      )}

      {/* Key Metric KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="card bg-surface-1 border border-hairline rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-ink-tertiary">
            <span className="text-2xs font-semibold uppercase tracking-wider">Registered Personnel</span>
            <Users size={15} className="text-primary" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-ink">{users.length}</div>
            <div className="flex items-center gap-1 text-2xs text-ink-tertiary mt-1">
              <span>Admin: {roleCounts.admin || 0}</span> ·
              <span>Manager: {roleCounts.manager || 0}</span> ·
              <span>Eng: {roleCounts.engineer || 0}</span>
            </div>
          </div>
        </div>

        {/* Monitored Equipment */}
        <div className="card bg-surface-1 border border-hairline rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-ink-tertiary">
            <span className="text-2xs font-semibold uppercase tracking-wider">Monitored Equipment</span>
            <Cpu size={15} className="text-success" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-ink">
              {insights?.totalMonitoredEquipment ?? equipment.length}
            </div>
            <div className="text-2xs text-success mt-1 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span>Telemetry active across plant sectors</span>
            </div>
          </div>
        </div>

        {/* Indexed Manuals & SOPs */}
        <div className="card bg-surface-1 border border-hairline rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-ink-tertiary">
            <span className="text-2xs font-semibold uppercase tracking-wider">Indexed Documents</span>
            <BookOpen size={15} className="text-warning" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-ink">
              {insights?.totalIndexedDocuments ?? documents.length}
            </div>
            <div className="text-2xs text-ink-tertiary mt-1">
              <span>Active in semantic knowledge index</span>
            </div>
          </div>
        </div>

        {/* RAG Telemetry */}
        <div className="card bg-surface-1 border border-hairline rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-ink-tertiary">
            <span className="text-2xs font-semibold uppercase tracking-wider">RAG Inquiries</span>
            <Bot size={15} className="text-primary" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-ink">
              {insights?.totalRAGInquiries ?? 0}
            </div>
            <div className="text-2xs text-ink-tertiary mt-1">
              <span>Zero-tolerance grounding policy</span>
            </div>
          </div>
        </div>
      </section>

      {/* Admin Modules Quick Launch */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">
          System Management Modules
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            to="/admin/users"
            className="card bg-surface-1 hover:bg-surface-2 border border-hairline rounded-xl p-5 flex flex-col justify-between transition-colors group"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3">
                <Users size={18} />
              </div>
              <h3 className="text-sm font-semibold text-ink group-hover:text-primary transition-colors">
                Personnel & Access Control
              </h3>
              <p className="text-xs text-ink-subtle mt-1 leading-relaxed">
                Provision new accounts, assign administrator and manager roles, and manage plant credentials.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-2xs font-semibold text-primary mt-4">
              Open user registry <ArrowRight size={12} />
            </span>
          </Link>

          <Link
            to="/admin/insights"
            className="card bg-surface-1 hover:bg-surface-2 border border-hairline rounded-xl p-5 flex flex-col justify-between transition-colors group"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3">
                <BarChart3 size={18} />
              </div>
              <h3 className="text-sm font-semibold text-ink group-hover:text-primary transition-colors">
                System Insights & Analytics
              </h3>
              <p className="text-xs text-ink-subtle mt-1 leading-relaxed">
                Inspect authoritative telemetry, RAG volume trends, and knowledge coverage.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-2xs font-semibold text-primary mt-4">
              View analytics <ArrowRight size={12} />
            </span>
          </Link>

          <Link
            to="/admin/activity"
            className="card bg-surface-1 hover:bg-surface-2 border border-hairline rounded-xl p-5 flex flex-col justify-between transition-colors group"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center text-warning mb-3">
                <Activity size={18} />
              </div>
              <h3 className="text-sm font-semibold text-ink group-hover:text-warning transition-colors">
                Audit Trail & Security Log
              </h3>
              <p className="text-xs text-ink-subtle mt-1 leading-relaxed">
                Review immutable audit logs, authentication attempts, document indexing, and administrative changes.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-2xs font-semibold text-warning mt-4">
              Inspect audit log <ArrowRight size={12} />
            </span>
          </Link>

          <Link
            to="/admin/integrations"
            className="card bg-surface-1 hover:bg-surface-2 border border-hairline rounded-xl p-5 flex flex-col justify-between transition-colors group"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3">
                <Puzzle size={18} />
              </div>
              <h3 className="text-sm font-semibold text-ink group-hover:text-primary transition-colors">
                Ecosystem Integrations
              </h3>
              <p className="text-xs text-ink-subtle mt-1 leading-relaxed">
                Probe live connections for MongoDB, Cloudinary, OPC-UA, SAP PM, Maximo, and Gemini AI.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-2xs font-semibold text-primary mt-4">
              Configure integrations <ArrowRight size={12} />
            </span>
          </Link>

          <Link
            to="/admin/settings"
            className="card bg-surface-1 hover:bg-surface-2 border border-hairline rounded-xl p-5 flex flex-col justify-between transition-colors group"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3">
                <Settings2 size={18} />
              </div>
              <h3 className="text-sm font-semibold text-ink group-hover:text-primary transition-colors">
                Facility & AI Settings
              </h3>
              <p className="text-xs text-ink-subtle mt-1 leading-relaxed">
                Update global facility name, timezone, Gemini LLM model selection, temperature, and top-K.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-2xs font-semibold text-primary mt-4">
              System settings <ArrowRight size={12} />
            </span>
          </Link>

          <Link
            to="/admin/knowledge"
            className="card bg-surface-1 hover:bg-surface-2 border border-hairline rounded-xl p-5 flex flex-col justify-between transition-colors group"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-3">
                <BookOpen size={18} />
              </div>
              <h3 className="text-sm font-semibold text-ink group-hover:text-primary transition-colors">
                Knowledge Ingestion & SOPs
              </h3>
              <p className="text-xs text-ink-subtle mt-1 leading-relaxed">
                Upload approved technical documentation, manage indexing pipelines, and view manuals.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-2xs font-semibold text-primary mt-4">
              Knowledge library <ArrowRight size={12} />
            </span>
          </Link>
        </div>
      </section>

      {/* Security Banner */}
      <section className="card bg-surface-1 border border-hairline rounded-xl p-4 flex items-start gap-3">
        <ShieldCheck size={18} className="text-success mt-0.5 flex-shrink-0" />
        <div className="text-xs leading-relaxed text-ink-subtle">
          <span className="font-semibold text-ink">Administrative Policy Active: </span>
          Administrative operations and access modifications are recorded in the security audit log.
        </div>
      </section>
    </div>
  );
}
