import { NavLink } from "react-router-dom";
import { Bot, Library, Cpu, Activity, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

const MOBILE_NAV = [
  { to: "/", label: "Assistant", icon: <Bot size={18} />, end: true },
  { to: "/knowledge", label: "Library", icon: <Library size={18} /> },
  { to: "/equipment", label: "Equipment", icon: <Cpu size={18} /> },
  { to: "/activity", label: "Activity", icon: <Activity size={18} /> },
  { to: "/settings", label: "Settings", icon: <Settings2 size={18} /> },
];

export function MobileNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-1 border-t border-hairline z-40 flex items-center justify-around px-2 py-1.5">
      {MOBILE_NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cn(
              "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-md transition-colors",
              isActive ? "text-primary" : "text-ink-tertiary hover:text-ink-subtle"
            )
          }
        >
          {item.icon}
          <span className="text-2xs font-medium">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
