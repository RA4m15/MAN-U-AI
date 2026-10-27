import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { RightPanel } from "./RightPanel";
import { MobileNav } from "./MobileNav";
import { PanelRightOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export type PanelType = "admin" | "manager";

interface AppShellProps {
  panel: PanelType;
}

export function AppShell({ panel }: AppShellProps) {
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-full bg-canvas overflow-hidden">
      {/* Desktop sidebar uses role-specific navigation. */}
      <aside className="hidden md:flex flex-col flex-shrink-0 w-60 border-r border-hairline bg-surface-1 z-sidebar">
        <Sidebar panel={panel} onMobileClose={() => setMobileMenuOpen(false)} />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative flex flex-col w-72 h-full bg-surface-1 border-r border-hairline z-10 animate-slide-right">
            <Sidebar panel={panel} onMobileClose={() => setMobileMenuOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex flex-1 min-w-0 h-full overflow-hidden">
        <main className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
          <div className="flex items-center gap-3 h-12 px-4 border-b border-hairline bg-surface-1 md:hidden flex-shrink-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="btn-icon"
              aria-label="Open navigation"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="2" y="3.5" width="12" height="1.5" rx="0.75" />
                <rect x="2" y="7.25" width="12" height="1.5" rx="0.75" />
                <rect x="2" y="11" width="12" height="1.5" rx="0.75" />
              </svg>
            </button>
            <span className="font-semibold text-base tracking-tight text-gradient-primary">
              MAN-U-AI
            </span>
            <span className="text-2xs font-medium uppercase tracking-wide text-ink-tertiary">
              {panel} panel
            </span>
            <div className="ml-auto">
              <button
                onClick={() => setRightPanelOpen(!rightPanelOpen)}
                className="btn-icon"
                aria-label="Toggle context panel"
              >
                <PanelRightOpen size={15} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <Outlet />
          </div>
        </main>

        {/* Shared operational context, scoped to the active panel's routes. */}
        <aside
          className={cn(
            "hidden lg:flex flex-col flex-shrink-0 border-l border-hairline bg-surface-1",
            "transition-all duration-250",
            rightPanelOpen ? "w-80" : "w-0 overflow-hidden border-none"
          )}
        >
          <div className="flex items-center justify-between h-12 px-4 border-b border-hairline flex-shrink-0">
            <span className="text-xs font-medium text-ink-subtle tracking-wide uppercase">
              {panel === "admin" ? "System context" : "Operations context"}
            </span>
            <button
              onClick={() => setRightPanelOpen(false)}
              className="btn-icon p-1.5"
              aria-label="Close context panel"
            >
              <PanelRightOpen size={13} className="rotate-180" />
            </button>
          </div>
          <RightPanel panel={panel} />
        </aside>

        {!rightPanelOpen && (
          <button
            onClick={() => setRightPanelOpen(true)}
            className="hidden lg:flex btn-icon fixed right-4 top-14 z-10"
            aria-label="Open context panel"
          >
            <PanelRightOpen size={15} />
          </button>
        )}
      </div>

      <MobileNav panel={panel} />
    </div>
  );
}
