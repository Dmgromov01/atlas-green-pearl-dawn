import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { haptic } from "@/lib/haptic";
import { Button } from "@/components/ui/button";

export function Header({
  title,
  subtitle,
  backTo,
  right,
}: {
  title: string;
  subtitle?: string;
  backTo?: string;
  right?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-20 flex min-h-[58px] items-center justify-between gap-2 bg-background px-4 pt-[env(safe-area-inset-top)]">
      {backTo ? (
        <Button
          variant="secondary"
          size="icon-sm"
          aria-label="Назад"
          onClick={() => {
            haptic();
            navigate({ to: backTo });
          }}
        >
          <ArrowLeft className="size-5" />
        </Button>
      ) : (
        <div className="size-9" />
      )}
      <div className="min-w-0 flex-1 px-2 text-center">
        <div className="truncate text-lg font-semibold tracking-tight text-foreground">{title}</div>
        {subtitle ? (
          <div className="truncate text-xs font-medium text-muted-foreground">{subtitle}</div>
        ) : null}
      </div>
      <div className="flex size-9 items-center justify-center">{right ?? <div className="size-9" />}</div>
    </header>
  );
}
