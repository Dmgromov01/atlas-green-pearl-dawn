import { Link, useRouterState } from "@tanstack/react-router";
import { CircleHelp, FileText, House, Settings } from "lucide-react";
import { haptic } from "@/lib/haptic";
import { cn } from "@/lib/utils";

const tabs = [
  { label: "Домой", path: "/", icon: House },
  { label: "Справка", path: "/status", icon: CircleHelp },
  { label: "Дайджест", path: "/digest", icon: FileText },
  { label: "Настройки", path: "/settings", icon: Settings },
] as const;

export function TabBar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <nav className="reference-tabbar" aria-label="Основная навигация">
      {tabs.map((tab) => {
        const active = tab.path === "/" ? pathname === "/" : pathname.startsWith(tab.path);
        const Icon = tab.icon;
        return (
          <Link key={tab.path} to={tab.path} onClick={() => haptic("light")} className={cn("reference-tabbar__item", active && "is-active")} aria-current={active ? "page" : undefined}>
            <span className="reference-tabbar__icon"><Icon aria-hidden="true" /></span>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
