import { Link, useRouterState } from "@tanstack/react-router";
import { tabModules } from "@/lib/hub/registry";
import { useSettings } from "@/lib/stores/settings";
import { haptic } from "@/lib/haptic";
import { cn } from "@/lib/utils";

export function TabBar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const enabled = useSettings((s) => s.enabledModules);
  const tabs = tabModules(enabled);
  const home = tabs.find((t) => t.id === "home");
  const chat = tabs.find((t) => t.id === "chat");
  const more = tabs.find((t) => t.id === "settings");

  const item = (tab: (typeof tabs)[number], fab = false) => {
    const active = tab.path === "/" ? pathname === "/" : pathname.startsWith(tab.path);
    const Icon = tab.icon;
    return (
      <Link
        key={tab.id}
        to={tab.path}
        onClick={() => haptic()}
        className={cn(fab ? "tabbar__fab" : "tabbar__item", active && "is-active")}
        aria-current={active ? "page" : undefined}
        aria-label={tab.title}
      >
        <Icon className={fab ? "size-5" : "tabbar__icon"} strokeWidth={active || fab ? 2.2 : 1.8} />
        {fab ? null : <span className="tabbar__label">{tab.shortTitle}</span>}
      </Link>
    );
  };

  return (
    <nav className="tabbar" aria-label="Основная навигация">
      <div className="tabbar__side tabbar__side--left">{home ? item(home) : null}</div>
      <div className="tabbar__slot">{chat ? item(chat, true) : null}</div>
      <div className="tabbar__side tabbar__side--right">{more ? item(more) : <span className="tabbar__item" aria-hidden />}</div>
    </nav>
  );
}
