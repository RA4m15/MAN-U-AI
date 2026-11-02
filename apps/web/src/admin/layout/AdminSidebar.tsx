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
  ClipboardList,
  Puzzle,
  Users,
  LogOut,
  Zap,
  LayoutDashboard,
  Workflow,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { conversationsApi } from "@/lib/api";
import { cn } from "@/lib/utils";

interface NavSection {
  label?: string;
  items: NavItem[];
}

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const ADMIN_NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: "Admin Dashboard", path: "", icon: <LayoutDashboard size={15} /> },
      { label: "AI Assistant", path: "assistant", icon: <Bot size={15} /> },
    ],
  },
  {
    label: "Knowledge & Assets",
    items: [
      { label: "Knowledge Library", path: "knowledge", icon: <Library size={15} /> },
      { label: "SOPs & Manuals", path: "knowledge?tab=sops", icon: <BookOpen size={15} /> },
      { label: "SOP Flowcharts", path: "flowcharts", icon: <Workflow size={15} /> },
      { label: "Equipment Registry", path: "equipment", icon: <Cpu size={15} /> },
      { label: "Summaries", path: "summaries", icon: <FileText size={15} /> },
      { label: "Shift Tasks Dispatch", path: "tasks", icon: <ClipboardList size={15} /> },
    ],
  },
  {
    label: "Intelligence & Security",
    items: [
      { label: "Insights & Analytics", path: "insights", icon: <BarChart3 size={15} /> },
      { label: "Audit Activity Log", path: "activity", icon: <Activity size={15} /> },
    ],
  },
  {
    label: "System Administration",
    items: [
      { label: "Personnel & Roles", path: "users", icon: <Users size={15} /> },
      { label: "Ecosystem Integrations", path: "integrations", icon: <Puzzle size={15} /> },
      { label: "System Settings", path: "settings", icon: <Settings2 size={15} /> },
    ],
  },
];

interface AdminSidebarProps {
  onMobileClose?: () => void;
}

export function AdminSidebar({ onMobileClose }: AdminSidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

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
    navigate("/admin/assistant");
    onMobileClose?.();
  };

  return (
    <div className="flex flex-col h-full bg-surface-1 border-r border-hairline">
      {/* Brand Header */}
      <div className="flex items-center gap-2.5 h-12 px-4 border-b border-hairline flex-shrink-0">
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-black border border-primary/40 overflow-hidden flex-shrink-0">
          <img src="/logo.png" alt="MAN-U-AI" className="w-full h-full object-contain" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold tracking-tight text-gradient-primary leading-tight">
            MAN-U-AI
          </span>
          <span className="text-2xs text-ink-tertiary leading-tight font-medium">
            Admin Console
          </span>
        </div>
        {onMobileClose && (
          <button
            onClick={onMobileClose}
            className="ml-auto p-1.5 rounded-lg text-ink-tertiary hover:text-ink hover:bg-surface-2 transition-colors"
            title="Close menu"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Conversation Search */}
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

      {/* New Ingestion Chat Button */}
      <div className="px-3 pb-2 flex-shrink-0">
        <button
          onClick={handleNewChat}
          className="btn-secondary w-full justify-center text-xs py-1.5 h-8 gap-1.5 font-medium"
        >
          <Plus size={13} />
          <span>New AI Consultation</span>
        </button>
      </div>

      {/* Navigation Sections */}
      <nav className="flex-1 overflow-y-auto px-2 space-y-4 py-2">
        {ADMIN_NAV_SECTIONS.map((section, idx) => (
          <div key={idx}>
            {section.label && (
              <p className="px-2.5 pb-1 text-2xs font-semibold uppercase tracking-wider text-ink-tertiary">
                {section.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <li key={item.label}>
                  <NavLink
                    to={`/admin${item.path ? `/${item.path}` : ""}`}
                    end={item.path === ""}
                    onClick={onMobileClose}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                        isActive
                          ? "bg-primary/10 text-primary border border-primary/20 font-semibold"
                          : "text-ink-subtle hover:text-ink hover:bg-surface-2"
                      )
                    }
                  >
                    <span className="flex-shrink-0">{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {/* Recent Conversations */}
        {filteredConversations.length > 0 && (
          <div className="pt-2 border-t border-hairline">
            <p className="px-2.5 pb-1 text-2xs font-semibold uppercase tracking-wider text-ink-tertiary">
              Recent Consultations
            </p>
            <ul className="space-y-0.5">
              {filteredConversations.slice(0, 5).map((conv: any) => (
                <li key={conv.id}>
                  <NavLink
                    to={`/admin/chat/${conv.id}`}
                    onClick={onMobileClose}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-colors",
                        isActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-ink-tertiary hover:text-ink hover:bg-surface-2"
                      )
                    }
                  >
                    <MessageSquare size={12} className="flex-shrink-0" />
                    <span className="truncate">{conv.title || "Untitled Session"}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>

      {/* User Session Footer */}
      <div className="p-3 border-t border-hairline flex items-center justify-between flex-shrink-0 bg-surface-2/40">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() || "A"}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-ink truncate leading-tight">{user?.name || "Administrator"}</p>
            <p className="text-2xs text-primary font-semibold uppercase tracking-wider leading-tight">Admin</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="btn-icon p-1.5 text-ink-tertiary hover:text-danger hover:bg-danger/10 transition-colors"
          title="Sign out of Admin Console"
        >
          <LogOut size={14} />
        </button>
      </div>
    </div>
  );
}
