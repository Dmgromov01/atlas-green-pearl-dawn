import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { haptic } from "@/lib/haptic";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";
import { APP_NAME } from "@/lib/brand";

export function Header({
  title,
  subtitle,
  backTo,
  right,
  brand,
}: {
  title: ReactNode;
  subtitle?: string;
  backTo?: string;
  right?: ReactNode;
  brand?: boolean;
}) {
  const navigate = useNavigate();
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
        <div className="size-8" />
      )}
      <div className="min-w-0 flex-1 px-1 text-center">
        {brand ? (
          <div className="flex items-center justify-center gap-1.5">
            <BrandMark size={40} />
            <div className="min-w-0 truncate text-lg font-bold tracking-tight text-foreground">{APP_NAME}</div>
          </div>
        ) : (
          <div className="truncate text-base font-semibold tracking-tight text-foreground">{title}</div>
        )}
        {subtitle ? (
          <div className="truncate text-xs font-medium text-muted-foreground">{subtitle}</div>
        ) : null}
      </div>
      <div className="flex size-8 shrink-0 items-center justify-center">{right ?? <div className="size-8" />}</div>
    </header>
  );
}
