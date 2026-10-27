import { Link } from "react-router-dom";
import {
  Bot,
  BookOpen,
  ClipboardList,
  Cpu,
  FileText,
  Upload,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

const WORKFLOWS = [
  {
    title: "Ask the industrial copilot",
    description: "Troubleshoot equipment using grounded answers and citations from approved manuals and SOPs.",
    to: "/manager/assistant",
    action: "Open assistant",
    icon: Bot,
  },
  {
    title: "Knowledge library",
    description: "Review manuals, SOPs, schematics, and their ingestion or indexing status.",
    to: "/manager/knowledge",
    action: "Open library",
    icon: BookOpen,
  },
  {
    title: "Equipment status",
    description: "Review registered machines and open the equipment workspace for operational follow-up.",
    to: "/manager/equipment",
    action: "View equipment",
    icon: Cpu,
  },
  {
    title: "Maintenance summaries",
    description: "Review shift handovers and other operational summaries available to your account.",
    to: "/manager/summaries",
    action: "View summaries",
    icon: ClipboardList,
  },
];

export function ManagerDashboardPage() {
  return (
    <div className="flex flex-col h-full overflow-y-auto bg-canvas p-4 md:p-8 space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary mb-2">Operations workspace</p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-ink">Manager Dashboard</h1>
          <p className="text-sm text-ink-subtle mt-2 max-w-2xl">
            Your workspace for day-to-day lab operations, machine status, technical knowledge, and maintenance coordination.
          </p>
        </div>
        <Link to="/manager/knowledge" className="btn-primary inline-flex items-center justify-center gap-2 self-start">
          <Upload size={15} />
          Manage documents
        </Link>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {WORKFLOWS.map((workflow) => {
          const Icon = workflow.icon;
          return (
            <article key={workflow.title} className="card bg-surface-1 border border-hairline rounded-xl p-5 flex flex-col gap-4">
              <div className="w-10 h-10 rounded-xl border border-primary/20 bg-primary/10 flex items-center justify-center text-primary">
                <Icon size={19} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-ink">{workflow.title}</h2>
                <p className="text-xs leading-relaxed text-ink-subtle mt-2">{workflow.description}</p>
              </div>
              <Link to={workflow.to} className="mt-auto inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                {workflow.action}
                <ArrowRight size={13} />
              </Link>
            </article>
          );
        })}
      </section>

      <section className="card bg-surface-1 border border-hairline rounded-xl p-5 flex items-start gap-3">
        <ShieldCheck size={18} className="text-success mt-0.5 flex-shrink-0" />
        <div>
          <h2 className="text-sm font-semibold text-ink">Operational access</h2>
          <p className="text-xs leading-relaxed text-ink-subtle mt-1">
            This panel focuses on facility operations. System-wide access control, integrations, and administrative configuration are kept in the Admin panel.
          </p>
        </div>
      </section>

      <p className="text-2xs text-ink-tertiary">
        Machine condition and document processing states are shown from persisted system records; this dashboard does not invent live telemetry or status values.
      </p>
    </div>
  );
}
