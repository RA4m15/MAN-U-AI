import { useState, useMemo } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  Search,
  Plus,
  MessageSquare,
  Library,
  BookOpen,
  Settings2,
  Activity,
  BarChart3,
  Cpu,
  FileText,
  Puzzle,
  Users,
  ChevronRight,
  LogOut,
  Zap,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { conversationsApi } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { PanelType } from "./AppShell";

interface NavSection {
  label?: string;
  items: NavItem[];
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  badge?: string | number;
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: "AI Assistant", path: "assistant", icon: <Bot size={15} /> },
    ],
  },
  {
    label: "Knowledge & Assets",
    items: [
      { label: "Knowledge Library", path: "knowledge", icon: <Library size={15} /> },
      { label: "SOPs & Manuals", path: "knowledge?tab=sops", icon: <BookOpen size={15} /> },
      { label: "Equipment", path: "equipment", icon: <Cpu size={15} /> },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Summaries", path: "summaries", icon: <FileText size={15} /> },
      { label: "System Insights & Analytics", path: "insights", icon: <BarChart3 size={15} />, adminOnly: true },
      { label: "Audit Activity", path: "activity", icon: <Activity size={15} />, adminOnly: true },
    ],
  },
  {
    label: "Administration",
    items: [
      { label: "Integrations", path: "integrations", icon: <Puzzle size={15} />, adminOnly: true },
      { label: "Access Control", path: "settings?tab=access", icon: <Users size={15} />, adminOnly: true },
      { label: "System Settings", path: "settings", icon: <Settings2 size={15} />, adminOnly: true },
    ],
  },
];

interface SidebarProps {
  panel: PanelType;
  onMobileClose: () => void;
}

export function Sidebar({ panel, onMobileClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const basePath = `/${panel}`;

  const navSections = useMemo(
    () =>
      NAV_SECTIONS
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => panel === "admin" || !item.adminOnly),
        }))
        .filter((section) => section.items.length > 0),
    [panel]
  );

  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      try {
        const res = await conversationsApi.list(1, 15);
        return res.data?.data || [];
      } catch {
        return [];
      }
    },
    refetchInterval: 15_000,
  });

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c: any) => c.title?.toLowerCase().includes(q));
  }, [conversations, searchQuery]);

  const handleNewChat = () => {
    navigate(`${basePath}/assistant`);
    onMobileClose();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2.5 h-12 px-4 border-b border-hairline flex-shrink-0">
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/20 border border-primary/30">
          <Zap size={13} className="text-primary" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold tracking-tight text-gradient-primary leading-tight">
            MAN-U-AI
          </span>
          <span className="text-2xs text-ink-tertiary leading-tight">
            {panel === "admin" ? "Administration Console" : "Operations Workspace"}
          </span>
        </div>
      </div>

      <div className="px-3 pt-3 pb-2 flex-shrink-0">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-tertiary pointer-events-none" />
          <input
            className="input pl-8 text-xs h-8"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="px-3 pb-2 flex-shrink-0">
        <button
          onClick={handleNewChat}
          className="btn-primary w-full h-8 text-xs flex items-center justify-center gap-1.5 shadow-sm"
        >
          <Plus size={13} />
          New Chat
        </button>
      </div>

      <div className="px-3 pb-1 flex-shrink-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-2xs font-medium text-ink-tertiary uppercase tracking-wide">
            Recent Conversations
          </span>
          <ChevronRight size={11} className="text-ink-tertiary" />
        </div>
        <div className="space-y-0.5 max-h-36 overflow-y-auto scrollbar-none">
          {filteredConversations.length > 0 ? (
            filteredConversations.map((conv: any) => (
              <NavLink
                key={conv.id}
                to={`${basePath}/chat/${conv.id}`}
                onClick={onMobileClose}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer group",
                    "hover:bg-surface-2 transition-colors",
                    isActive && "bg-surface-2 text-primary font-medium"
                  )
                }
              >
                <MessageSquare size={12} className="text-ink-tertiary flex-shrink-0 group-hover:text-primary transition-colors" />
                <span className="text-xs text-ink-subtle truncate group-hover:text-ink transition-colors">
                  {conv.title}
                </span>
              </NavLink>
            ))
          ) : (
            <p className="text-2xs text-ink-tertiary px-2 py-1 italic">
              No previous conversations
            </p>
          )}
        </div>
      </div>

      <div className="mx-3 my-1 divider" />

      <nav className="flex-1 overflow-y-auto px-3 pb-3 scrollbar-none space-y-3">
        {navSections.map((section, i) => (
          <div key={section.label ?? i}>
            {section.label && (
              <div className="text-2xs font-medium text-ink-tertiary uppercase tracking-wide mb-1 px-1">
                {section.label}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const to = item.path ? `${basePath}/${item.path}` : basePath;
                return (
                  <NavLink
                    key={item.path}
                    to={to}
                    onClick={onMobileClose}
                    className={({ isActive }) =>
                      cn("nav-item", isActive && "nav-item-active")
                    }
                  >
                    <span className="flex-shrink-0 text-ink-tertiary">{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="badge-muted text-2xs">{item.badge}</span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-hairline p-3 flex-shrink-0 bg-surface-1">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-primary">
              {user?.name?.charAt(0).toUpperCase() ?? "U"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-ink truncate">{user?.name ?? "Industrial User"}</p>
            <p className="text-2xs text-ink-tertiary truncate">
              {panel === "admin" ? "Administrator" : "Manager / Operator"} Access
            </p>
          </div>
          <button
            onClick={logout}
            className="btn-icon p-1.5 text-ink-tertiary hover:text-danger"
            title="Sign out of plant session"
            aria-label="Sign out"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
