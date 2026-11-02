import { Link } from "react-router-dom";
import { ShieldCheck, Cpu, ArrowRight, Smartphone, Lock, Activity, Sparkles, Database } from "lucide-react";
import { SubdomainLink } from "@/components/SubdomainLink";

export function PortalSelectionPage() {
  return (
    <div className="min-h-screen w-full bg-canvas flex flex-col justify-between items-center px-4 py-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Branding */}
      <header className="w-full max-w-4xl flex items-center justify-between pb-6 border-b border-hairline z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-black border border-primary/30 overflow-hidden flex items-center justify-center shadow-lg shadow-primary/20">
            <img src="/logo.png" alt="MAN-U-AI" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-ink tracking-tight font-mono">MAN-U-AI</span>
              <span className="text-3xs uppercase tracking-widest px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">
                Enterprise
              </span>
            </div>
            <p className="text-2xs text-ink-subtle">Industrial AI Intelligence Platform</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-2xs text-ink-subtle">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Facility Systems Online</span>
        </div>
      </header>

      {/* Main Workspace Portal Selection */}
      <main className="w-full max-w-4xl my-auto py-8 z-10">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-2 border border-hairline text-xs text-ink-subtle mb-4">
            <Lock size={12} className="text-primary" />
            <span>Role-Separated Web Workspaces</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight">
            Select Workspace Portal
          </h1>
          <p className="text-sm text-ink-subtle mt-3 leading-relaxed">
            Choose your designated facility workspace to sign in. Each portal provides an isolated,
            role-specific environment powered by the shared industrial intelligence core.
          </p>
        </div>

        {/* Two Portal Workspace Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Admin Panel Card */}
          <section className="group rounded-2xl bg-surface-1/80 backdrop-blur-md border border-hairline hover:border-warning/50 p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:shadow-warning/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-warning/5 rounded-full blur-2xl group-hover:bg-warning/10 transition-all pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-warning/10 border border-warning/20 flex items-center justify-center text-warning group-hover:scale-105 transition-transform">
                  <ShieldCheck size={24} />
                </div>
                <span className="text-2xs uppercase tracking-wider px-2.5 py-1 rounded-full bg-warning/10 text-warning font-semibold border border-warning/20">
                  Admin Clearance
                </span>
              </div>

              <h2 className="text-xl font-bold text-ink group-hover:text-warning transition-colors">
                Plant Administration Console
              </h2>
              <p className="text-xs text-ink-subtle mt-2 leading-relaxed">
                Facility-wide system overview, user provisioning, role assignments, global AI/RAG settings,
                audit trails, and ecosystem integrations.
              </p>

              <div className="mt-5 space-y-2 text-2xs text-ink-subtle border-t border-hairline pt-4">
                <div className="flex items-center gap-2">
                  <Database size={13} className="text-warning flex-shrink-0" />
                  <span>Personnel registry & role assignments</span>
                </div>
                <div className="flex items-center gap-2">
                  <Activity size={13} className="text-warning flex-shrink-0" />
                  <span>Facility-wide telemetry & system analytics</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles size={13} className="text-warning flex-shrink-0" />
                  <span>Global facility configurations & AI models</span>
                </div>
              </div>
            </div>

            <div className="mt-7 pt-4 border-t border-hairline flex flex-col gap-2.5">
              <SubdomainLink
                target="admin"
                to="/admin/login"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-warning hover:bg-warning/90 text-surface-0 font-semibold text-xs transition-all shadow-md shadow-warning/20 group/btn"
              >
                <span>Admin Login</span>
                <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
              </SubdomainLink>
              <SubdomainLink
                target="admin"
                to="/admin/register"
                className="text-center text-2xs text-ink-tertiary hover:text-ink transition-colors"
              >
                Need admin provisioning policy? Learn more →
              </SubdomainLink>
            </div>
          </section>

          {/* Manager Panel Card */}
          <section className="group rounded-2xl bg-surface-1/80 backdrop-blur-md border border-hairline hover:border-emerald-500/50 p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/10 transition-all pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                  <Cpu size={24} />
                </div>
                <span className="text-2xs uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                  Manager & Operator
                </span>
              </div>

              <h2 className="text-xl font-bold text-ink group-hover:text-emerald-400 transition-colors">
                Plant Operations Workspace
              </h2>
              <p className="text-xs text-ink-subtle mt-2 leading-relaxed">
                Day-to-day shopfloor operations, machinery health monitoring, shift handovers, maintenance coordination,
                and multimodal AI troubleshooting.
              </p>

              <div className="mt-5 space-y-2 text-2xs text-ink-subtle border-t border-hairline pt-4">
                <div className="flex items-center gap-2">
                  <Activity size={13} className="text-emerald-400 flex-shrink-0" />
                  <span>Real-time machine health & maintenance status</span>
                </div>
                <div className="flex items-center gap-2">
                  <Sparkles size={13} className="text-emerald-400 flex-shrink-0" />
                  <span>Multimodal RAG assistant with grounded citations</span>
                </div>
                <div className="flex items-center gap-2">
                  <Database size={13} className="text-emerald-400 flex-shrink-0" />
                  <span>Shift handoff summaries & technical SOP manuals</span>
                </div>
              </div>
            </div>

            <div className="mt-7 pt-4 border-t border-hairline flex flex-col gap-2.5">
              <SubdomainLink
                target="manager"
                to="/manager/login"
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-md shadow-emerald-600/20 group/btn"
              >
                <span>Manager / Operator Login</span>
                <ArrowRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
              </SubdomainLink>
              <SubdomainLink
                target="manager"
                to="/manager/register"
                className="text-center text-2xs text-ink-tertiary hover:text-ink transition-colors"
              >
                New to operations? Request enrollment details →
              </SubdomainLink>
            </div>
          </section>
        </div>

        {/* Engineer Mobile Flutter App Notice Banner */}
        <section className="mt-8 rounded-xl bg-surface-2/60 border border-hairline p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary flex-shrink-0">
              <Smartphone size={18} />
            </div>
            <div>
              <p className="text-xs font-semibold text-ink">Field Service Engineer?</p>
              <p className="text-2xs text-ink-subtle">
                Mobile machinery inspections, visual diagnostics, and field checklists are conducted via the dedicated Flutter tablet app.
              </p>
            </div>
          </div>
          <Link
            to="/engineer-mobile-required"
            className="flex-shrink-0 inline-flex items-center gap-1.5 text-2xs font-medium text-primary hover:text-primary-hover transition-colors"
          >
            <span>View Mobile App Instructions</span>
            <ArrowRight size={12} />
          </Link>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-4xl pt-6 border-t border-hairline flex flex-col sm:flex-row items-center justify-between gap-3 text-2xs text-ink-tertiary z-10">
        <p>© 2026 MAN-U-AI. All rights reserved. Industrial Multimodal Intelligence.</p>
        <div className="flex items-center gap-4">
          <Link to="/login" className="hover:text-ink transition-colors">
            Legacy Account Login
          </Link>
          <span>·</span>
          <span>Security Level: Enterprise Zero-Trust</span>
        </div>
      </footer>
    </div>
  );
}
