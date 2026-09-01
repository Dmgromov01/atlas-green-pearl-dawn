import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { TabBar } from "./tab-bar";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  withTabs = true,
  className,
}: {
  children: ReactNode;
  withTabs?: boolean;
  className?: string;
}) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <div className={cn("hub-shell", withTabs && "hub-shell--tabs", className)}>
      {withTabs ? <TabBar /> : null}
      <div key={pathname} className="hub-main hub-route-enter">{children}</div>
    </div>
  );
}
