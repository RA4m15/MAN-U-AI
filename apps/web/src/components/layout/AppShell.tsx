import { useState, useEffect } from "react";
import { Outlet, NavLink, Link, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { RightPanel } from "./RightPanel";
import {
  Menu,
  X,
  Bot,
  Cpu,
  LayoutDashboard,
  Activity,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type PanelType = "admin" | "manager";

interface AppShellProps {
  panel: PanelType;
}

export function AppShell({ panel }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setSidebarOpen(false);
        setRightPanelOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const basePath = panel === "admin" ? "/admin" : "/manager";

  return (
    <div className="flex flex-col h-full bg-canvas text-ink overflow-hidden relative">
      {/* Eye-Catcher Ambient Lighting */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      {/* Top Application Header Bar */}
      <header className="h-14 px-3 sm:px-5 border-b border-hairline/80 bg-surface-1/80 backdrop-blur-md flex items-center justify-between gap-3 z-30 flex-shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Hamburger Menu Button */}
          <button
            onClick={() => setSidebarOpen((prev) => !prev)}
            className="p-2 rounded-xl text-ink-subtle hover:text-ink hover:bg-surface-2 border border-transparent hover:border-hairline transition-all group"
            title="Toggle Navigation Menu (Ctrl+B)"
            aria-label="Toggle navigation menu"
          >
            <Menu size={18} className="group-hover:scale-105 transition-transform" />
          </button>

          {/* Logo & Brand */}
          <Link to={basePath} className="flex items-center gap-2.5 group">
            <div className="w-7 h-7 rounded-lg bg-black border border-primary/30 flex items-center justify-center shadow-sm overflow-hidden flex-shrink-0 group-hover:border-primary/60 transition-colors">
              <img src="/logo.png" alt="MAN-U-AI" className="w-full h-full object-contain" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight text-ink font-mono">
                MAN-U-AI
              </span>
              <span
                className={cn(
                  "text-3xs uppercase tracking-widest px-2 py-0.5 rounded-full font-semibold border",
                  panel === "admin"
                    ? "bg-warning/10 text-warning border-warning/20"
                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                )}
              >
                {panel === "admin" ? "Admin" : "Operations"}
              </span>
            </div>
          </Link>

          {/* Quick Navigation Pills */}
          <nav className="hidden lg:flex items-center gap-1 ml-3 pl-3 border-l border-hairline/70">
            <NavLink
              to={basePath}
              end
              className={({ isActive }) =>
                cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
                  isActive
                    ? "bg-surface-2 text-ink font-semibold border border-hairline shadow-sm"
                    : "text-ink-subtle hover:text-ink hover:bg-surface-2/60"
                )
              }
            >
              <LayoutDashboard size={13} className="text-ink-tertiary" />
              <span>Dashboard</span>
            </NavLink>
            <NavLink
              to={`${basePath}/assistant`}
              className={({ isActive }) =>
                cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
                  isActive
                    ? "bg-surface-2 text-ink font-semibold border border-hairline shadow-sm"
                    : "text-ink-subtle hover:text-ink hover:bg-surface-2/60"
                )
              }
            >
              <Bot size={13} className="text-primary" />
              <span>AI Assistant</span>
            </NavLink>
            <NavLink
              to={`${basePath}/equipment`}
              className={({ isActive }) =>
                cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
                  isActive
                    ? "bg-surface-2 text-ink font-semibold border border-hairline shadow-sm"
                    : "text-ink-subtle hover:text-ink hover:bg-surface-2/60"
                )
              }
            >
              <Cpu size={13} className="text-ink-tertiary" />
              <span>Machinery</span>
            </NavLink>
            <NavLink
              to={`${basePath}/tasks`}
              className={({ isActive }) =>
                cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5",
                  isActive
                    ? "bg-surface-2 text-ink font-semibold border border-hairline shadow-sm"
                    : "text-ink-subtle hover:text-ink hover:bg-surface-2/60"
                )
              }
            >
              <ClipboardList size={13} className="text-ink-tertiary" />
              <span>Tasks</span>
            </NavLink>
          </nav>
        </div>

        {/* Right Header */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Eye-Catcher: Live Status Pill */}
          <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-2/70 border border-hairline text-2xs text-ink-subtle shadow-inner">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-medium text-emerald-400">Online</span>
            <span className="text-ink-tertiary">·</span>
            <span className="font-mono text-3xs text-ink-tertiary">Live Facility</span>
          </div>

          {/* Telemetry / Context Drawer Toggle */}
          <button
            onClick={() => setRightPanelOpen((prev) => !prev)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all shadow-sm",
              rightPanelOpen
                ? "bg-primary/15 text-primary border-primary/30"
                : "bg-surface-2 hover:bg-surface-3 text-ink-subtle border-hairline"
            )}
            title="Toggle Context Panel"
            aria-label="Toggle context panel"
          >
            <Activity size={14} className={rightPanelOpen ? "text-primary animate-pulse" : "text-ink-tertiary"} />
            <span className="hidden md:inline">Context</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Slide-out Navigation Drawer (Hamburger Drawer) */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 animate-fade-in">
            {/* Backdrop Blur */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
              onClick={() => setSidebarOpen(false)}
            />
            {/* Drawer Panel */}
            <aside className="relative flex flex-col w-72 sm:w-80 h-full bg-surface-1 border-r border-hairline shadow-2xl z-10 animate-slide-right">
              <Sidebar panel={panel} onMobileClose={() => setSidebarOpen(false)} />
            </aside>
          </div>
        )}

        {/* Full-width Main Viewport */}
        <main className="flex-1 min-w-0 h-full overflow-hidden flex flex-col bg-canvas">
          <Outlet />
        </main>

        {/* Right Context Drawer */}
        <aside
          className={cn(
            "fixed inset-y-0 right-0 z-40 w-80 max-w-[85vw] border-l border-hairline bg-surface-1/95 backdrop-blur-md shadow-2xl flex flex-col transition-transform duration-300 ease-in-out",
            rightPanelOpen ? "translate-x-0" : "translate-x-full"
          )}
        >
          <div className="flex items-center justify-between h-14 px-4 border-b border-hairline flex-shrink-0">
            <div className="flex items-center gap-2">
              <Activity size={15} className="text-primary" />
              <span className="text-xs font-bold text-ink tracking-wider uppercase">
                {panel === "admin" ? "System Context" : "Operations Context"}
              </span>
            </div>
            <button
              onClick={() => setRightPanelOpen(false)}
              className="p-1.5 rounded-lg text-ink-tertiary hover:text-ink hover:bg-surface-2 transition-colors"
              title="Close panel"
            >
              <X size={15} />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <RightPanel panel={panel} />
          </div>
        </aside>
      </div>
    </div>
  );
}
