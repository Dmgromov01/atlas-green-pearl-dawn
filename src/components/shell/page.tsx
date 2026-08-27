import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("hub-page", className)}>{children}</div>;
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("text-sm font-semibold text-muted-foreground", className)}>
      {children}
    </div>
  );
}
