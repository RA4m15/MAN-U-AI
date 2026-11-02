import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  BookOpen,
  ClipboardList,
  Cpu,
  FileText,
  Upload,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Wrench,
  Activity,
  Layers,
} from "lucide-react";
import { equipmentApi, documentsApi, analyticsApi, tasksApi } from "@/lib/api";

export function ManagerDashboardPage() {
  const { data: equipmentResp, isLoading: equipmentLoading } = useQuery({
    queryKey: ["equipment"],
    queryFn: () => equipmentApi.list(),
  });

  const { data: documentsResp, isLoading: documentsLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: () => documentsApi.list(),
  });

  const { data: summariesResp, isLoading: summariesLoading } = useQuery({
    queryKey: ["summaries"],
    queryFn: () => analyticsApi.summaries(),
  });

  const equipment = equipmentResp?.data?.data || [];
  const documents = documentsResp?.data?.data || [];
  const summaries = summariesResp?.data?.data || [];

  const { data: tasksResp } = useQuery({
    queryKey: ["manager-tasks"],
    queryFn: async () => {
      const res = await tasksApi.list();
      return res.data && "data" in res.data ? res.data.data : [];
    },
    refetchInterval: 15_000,
  });

  const tasks = tasksResp || [];
  const pendingTasks = tasks.filter((t: any) => t.status !== "completed");

  const onlineEquipment = equipment.filter((e: any) => e.status !== "offline" && e.status !== "error");
  const attentionEquipment = equipment.filter((e: any) => e.status === "degraded" || e.status === "maintenance");

  const isLoading = equipmentLoading || documentsLoading || summariesLoading;

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-canvas p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Operations Workspace
            </span>
            <span className="badge-muted text-2xs font-mono">Operations</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-ink">
            Manager Dashboard
          </h1>
          <p className="text-sm text-ink-subtle mt-1 max-w-2xl">
            Shopfloor machinery monitoring, shift tasks, and technical AI copilot.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start">
          <Link
            to="/manager/tasks"
            className="btn-primary inline-flex items-center justify-center gap-1.5 text-xs bg-primary text-white shadow-sm"
          >
            <ClipboardList size={14} />
            <span>Shift Tasks</span>
            {pendingTasks.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-white/20 text-3xs font-bold">
                {pendingTasks.length}
              </span>
            )}
          </Link>
          <Link
            to="/manager/knowledge"
            className="btn-primary inline-flex items-center justify-center gap-1.5 text-xs"
          >
            <Upload size={14} />
            <span>Manage Documents</span>
          </Link>
          <Link
            to="/manager/maintenance"
            className="btn-secondary inline-flex items-center justify-center gap-1.5 text-xs"
          >
            <Wrench size={14} />
            <span>Maintenance</span>
          </Link>
        </div>
      </header>

      {/* Real Operational KPI Highlights */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card bg-surface-1/80 backdrop-blur-sm border border-hairline hover:border-emerald-500/40 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/5 group">
          <div className="flex items-center justify-between text-ink-tertiary">
            <span className="text-2xs font-semibold uppercase tracking-wider">Active Machinery</span>
            <Cpu size={15} className="text-success" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-ink">
              {equipmentLoading ? <Loader2 size={18} className="animate-spin text-primary" /> : `${onlineEquipment.length} / ${equipment.length}`}
            </div>
            <div className="text-2xs text-success mt-1 flex items-center gap-1 font-medium">
              <CheckCircle2 size={11} /> Online & Monitored
            </div>
          </div>
        </div>

        <div className="card bg-surface-1/80 backdrop-blur-sm border border-hairline hover:border-emerald-500/40 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/5 group">
          <div className="flex items-center justify-between text-ink-tertiary">
            <span className="text-2xs font-semibold uppercase tracking-wider">Maintenance Alerts</span>
            <AlertTriangle size={15} className="text-warning" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-ink">
              {equipmentLoading ? <Loader2 size={18} className="animate-spin text-warning" /> : attentionEquipment.length}
            </div>
            <div className="text-2xs text-ink-tertiary mt-1">
              <span>Attention required</span>
            </div>
          </div>
        </div>

        <div className="card bg-surface-1/80 backdrop-blur-sm border border-hairline hover:border-emerald-500/40 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/5 group">
          <div className="flex items-center justify-between text-ink-tertiary">
            <span className="text-2xs font-semibold uppercase tracking-wider">Approved SOPs & Manuals</span>
            <BookOpen size={15} className="text-primary" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-ink">
              {documentsLoading ? <Loader2 size={18} className="animate-spin text-primary" /> : documents.length}
            </div>
            <div className="text-2xs text-ink-tertiary mt-1">
              <span>Indexed technical guides</span>
            </div>
          </div>
        </div>

        <div className="card bg-surface-1/80 backdrop-blur-sm border border-hairline hover:border-emerald-500/40 rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-500/5 group">
          <div className="flex items-center justify-between text-ink-tertiary">
            <span className="text-2xs font-semibold uppercase tracking-wider">Shift Summaries</span>
            <ClipboardList size={15} className="text-primary" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-ink">
              {summariesLoading ? <Loader2 size={18} className="animate-spin text-primary" /> : summaries.length}
            </div>
            <div className="text-2xs text-ink-tertiary mt-1">
              <span>Recorded handovers</span>
            </div>
          </div>
        </div>
      </section>

      {/* Operational Workflows */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-tertiary">
          Operational Workflows & Modules
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <article className="card bg-surface-1/70 hover:bg-surface-2/90 border border-hairline hover:border-emerald-500/40 rounded-2xl p-6 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-emerald-500/5 group">
            <div>
              <div className="w-10 h-10 rounded-xl border border-primary/30 bg-primary/20 flex items-center justify-center text-primary mb-3">
                <ClipboardList size={19} />
              </div>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink">Shift Tasks & Floor Dispatch</h3>
                {pendingTasks.length > 0 && (
                  <span className="px-2 py-0.5 rounded text-3xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {pendingTasks.length} Active
                  </span>
                )}
              </div>
              <p className="text-xs leading-relaxed text-ink-subtle mt-1.5">
                Assign inspection and maintenance directives directly to engineer mobile units with live telemetry sync.
              </p>
            </div>
            <Link
              to="/manager/tasks"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              Open task dispatch panel <ArrowRight size={13} />
            </Link>
          </article>
          <article className="card bg-surface-1 border border-hairline rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl border border-primary/20 bg-primary/10 flex items-center justify-center text-primary mb-3">
                <Bot size={19} />
              </div>
              <h3 className="text-sm font-semibold text-ink">AI Copilot Troubleshooting</h3>
              <p className="text-xs leading-relaxed text-ink-subtle mt-1.5">
                Resolve machine alarms and fault codes with grounded citations from approved manuals and SOPs.
              </p>
            </div>
            <Link
              to="/manager/assistant"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              Open assistant <ArrowRight size={13} />
            </Link>
          </article>

          <article className="card bg-surface-1 border border-hairline rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl border border-primary/20 bg-primary/10 flex items-center justify-center text-primary mb-3">
                <BookOpen size={19} />
              </div>
              <h3 className="text-sm font-semibold text-ink">Knowledge Library</h3>
              <p className="text-xs leading-relaxed text-ink-subtle mt-1.5">
                Browse technical manuals, view lockout/tagout (LOTO) protocols, and upload authorized documents.
              </p>
            </div>
            <Link
              to="/manager/knowledge"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              Open library <ArrowRight size={13} />
            </Link>
          </article>

          <article className="card bg-surface-1 border border-hairline rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl border border-primary/20 bg-primary/10 flex items-center justify-center text-primary mb-3">
                <Cpu size={19} />
              </div>
              <h3 className="text-sm font-semibold text-ink">Equipment & Machinery</h3>
              <p className="text-xs leading-relaxed text-ink-subtle mt-1.5">
                Inspect registered machinery, serial numbers, locations, and associated technical specifications.
              </p>
            </div>
            <Link
              to="/manager/equipment"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              View equipment <ArrowRight size={13} />
            </Link>
          </article>

          <article className="card bg-surface-1 border border-hairline rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl border border-primary/20 bg-primary/10 flex items-center justify-center text-primary mb-3">
                <ClipboardList size={19} />
              </div>
              <h3 className="text-sm font-semibold text-ink">Maintenance Summaries</h3>
              <p className="text-xs leading-relaxed text-ink-subtle mt-1.5">
                Generate shift handoff logs, review root-cause assessments, and organize preventive maintenance.
              </p>
            </div>
            <Link
              to="/manager/summaries"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              View summaries <ArrowRight size={13} />
            </Link>
          </article>

          <article className="card bg-surface-1 border border-hairline rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl border border-primary/20 bg-primary/10 flex items-center justify-center text-primary mb-3">
                <Layers size={19} />
              </div>
              <h3 className="text-sm font-semibold text-ink">Operations Management</h3>
              <p className="text-xs leading-relaxed text-ink-subtle mt-1.5">
                Line-by-line machine operational view, active work orders, and documentation readiness.
              </p>
            </div>
            <Link
              to="/manager/operations"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              View operations <ArrowRight size={13} />
            </Link>
          </article>

          <article className="card bg-surface-1 border border-hairline rounded-xl p-5 flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl border border-primary/20 bg-primary/10 flex items-center justify-center text-primary mb-3">
                <Wrench size={19} />
              </div>
              <h3 className="text-sm font-semibold text-ink">Maintenance Coordination</h3>
              <p className="text-xs leading-relaxed text-ink-subtle mt-1.5">
                Coordinate equipment service windows, inspect failure histories, and run diagnostic summaries.
              </p>
            </div>
            <Link
              to="/manager/maintenance"
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              Coordinate maintenance <ArrowRight size={13} />
            </Link>
          </article>
        </div>
      </section>

      {/* Role Isolation Notice */}
      <section className="card bg-surface-1 border border-hairline rounded-xl p-4 flex items-start gap-3">
        <ShieldCheck size={18} className="text-success mt-0.5 flex-shrink-0" />
        <div className="text-xs leading-relaxed text-ink-subtle">
          <span className="font-semibold text-ink">Operational Access Active: </span>
          This workspace is configured for daily plant management, equipment operations, and maintenance workflows. System-wide user administration, global settings, audit logs, and integration controls are restricted to the Admin panel.
        </div>
      </section>
    </div>
  );
}
