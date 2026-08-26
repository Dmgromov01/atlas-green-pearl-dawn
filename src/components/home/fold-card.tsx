import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ServiceRow } from "@/components/shell/service-row";
import { haptic } from "@/lib/haptic";
import { cn } from "@/lib/utils";

export function FoldCard({
  icon,
  title,
  status,
  accent,
  children,
}: {
  icon: ReactNode;
  title: string;
  status?: string;
  accent?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <ServiceRow
        icon={icon}
        title={title}
        status={status}
        accent={accent}
        chevron={false}
        expanded={open}
        trailing={
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out",
              open && "rotate-180",
            )}
          />
        }
        onClick={() => {
          haptic();
          setOpen((v) => !v);
        }}
      />
      {open ? <div className="space-y-1.5 border-t border-border px-3 py-2">{children}</div> : null}
    </Card>
  );
}
