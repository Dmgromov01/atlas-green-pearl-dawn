import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { haptic } from "@/lib/haptic";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";

export function Header({ title, subtitle, backTo, right, brand, greet }: { title?: ReactNode; subtitle?: string; backTo?: string; right?: ReactNode; brand?: boolean; greet?: string }) {
  const navigate = useNavigate();
  if (greet) return <header className="reference-header"><BrandMark size={36} /><h1>{greet}</h1>{right ? <div>{right}</div> : null}</header>;
  return <header className="sticky top-0 z-20 flex min-h-13 items-center justify-between gap-2 bg-background px-4 pt-[env(safe-area-inset-top)] sm:px-6">
    {backTo ? <Button variant="secondary" size="icon-sm" aria-label="Назад" onClick={() => { haptic(); void navigate({ to: backTo }); }}><ArrowLeft className="size-4" /></Button> : <div className="size-10" />}
    <div className="min-w-0 flex-1 px-1 text-center">{brand ? <div className="flex items-center justify-center gap-1.5"><BrandMark size={24} /><div className="min-w-0 truncate text-[15px] font-bold tracking-tight text-foreground">{title}</div></div> : <div className="truncate text-[15px] font-semibold tracking-tight text-foreground">{title}</div>}{subtitle ? <div className="truncate text-xs font-medium text-muted-foreground">{subtitle}</div> : null}</div>
    <div className="flex size-10 shrink-0 items-center justify-center">{right ?? <div className="size-10" />}</div>
  </header>;
}
