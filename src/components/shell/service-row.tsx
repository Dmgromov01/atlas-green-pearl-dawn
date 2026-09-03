import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconWell } from "./icon-well";

export function ServiceRow({
  icon,
  title,
  status,
  onClick,
  trailing,
  accent,
  chevron = true,
  expanded,
}: {
  icon: ReactNode;
  title: string;
  status?: string;
  onClick?: () => void;
  trailing?: ReactNode;
  accent?: boolean;
  chevron?: boolean;
  expanded?: boolean;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-expanded={expanded}
      className={cn(
        "relative flex min-h-13 w-full items-center gap-2.5 px-3.5 py-2 text-left",
        onClick && "transition-colors duration-150 hover:bg-muted/60",
      )}
    >
      <IconWell accent={accent}>{icon}</IconWell>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold leading-snug text-foreground">{title}</div>
        {status ? (
          <div className="truncate text-xs font-medium leading-snug text-muted-foreground">{status}</div>
        ) : null}
      </div>
      {trailing}
      {chevron && onClick ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" /> : null}
    </Comp>
  );
}
