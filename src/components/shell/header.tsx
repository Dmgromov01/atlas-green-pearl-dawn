import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { haptic } from "@/lib/haptic";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";

export function Header({
  title,
  subtitle,
  backTo,
  right,
  brand,
  greet,
}: {
  title?: ReactNode;
  subtitle?: string;
  backTo?: string;
  right?: ReactNode;
  brand?: boolean;
  greet?: string;
}) {
  const navigate = useNavigate();
  if (greet) {
    return (
      <header className="sticky top-0 z-20 flex min-h-14 items-center gap-2.5 bg-background px-4 pt-[max(8px,env(safe-area-inset-top))] pb-1 sm:px-6">
        <BrandMark size={32} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-semibold leading-tight tracking-tight text-foreground">{greet}</div>
        </div>
        <div className="flex shrink-0 items-center justify-center">{right}</div>
      </header>
    );
  }
  return (
    <header className="sticky top-0 z-20 flex min-h-14 items-center justify-between gap-2 bg-background px-4 pt-[env(safe-area-inset-top)] sm:px-6">
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
        <div className="size-11" />
      )}
      <div className="min-w-0 flex-1 px-1 text-center">
        {brand ? (
          <div className="flex items-center justify-center gap-1.5">
            <BrandMark size={28} />
            <div className="min-w-0 truncate text-base font-bold tracking-tight text-foreground">{title}</div>
          </div>
        ) : (
          <div className="truncate text-base font-semibold tracking-tight text-foreground">{title}</div>
        )}
        {subtitle ? (
          <div className="truncate text-sm font-medium text-muted-foreground">{subtitle}</div>
        ) : null}
      </div>
      <div className="flex size-11 shrink-0 items-center justify-center">{right ?? <div className="size-11" />}</div>
    </header>
  );
}
