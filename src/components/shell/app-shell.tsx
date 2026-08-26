import type { ReactNode } from "react";
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
  return (
    <div className={cn("hub-shell", withTabs && "hub-shell--tabs", className)}>
      {withTabs ? <TabBar /> : null}
      <div className="hub-main">{children}</div>
    </div>
  );
}
