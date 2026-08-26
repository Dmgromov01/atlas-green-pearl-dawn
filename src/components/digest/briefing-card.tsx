import { useQuery } from "@tanstack/react-query";
import { Newspaper } from "lucide-react";
import { briefAllSources } from "@/lib/server/ai";
import { extractiveBrief } from "@/lib/digest/brief";
import type { DigestBlock } from "@/lib/server/digest";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { IconWell } from "@/components/shell/icon-well";
import { cn } from "@/lib/utils";

export function BriefingCard({
  blocks,
  loading,
  compact,
  onOpen,
}: {
  blocks?: DigestBlock[];
  loading?: boolean;
  compact?: boolean;
  onOpen?: () => void;
}) {
  const ready = (blocks ?? []).filter((b) => b.posts.length > 0);
  const items = ready.flatMap((b) =>
    b.posts.slice(0, 3).map((p) => ({ source: b.title, text: p.text })),
  );
  const fallback = extractiveBrief(ready).slice(0, compact ? 3 : 6);

  const brief = useQuery({
    queryKey: ["brief", items.map((i) => i.text.slice(0, 32)).join("|")],
    queryFn: () => briefAllSources({ data: { items } }),
    enabled: items.length > 0,
    staleTime: 15 * 60_000,
  });

  if (loading) {
    return <Skeleton className="h-32 rounded-2xl" />;
  }
  if (!ready.length) return null;

  const bullets = (brief.data?.bullets?.length ? brief.data.bullets : fallback).slice(
    0,
    compact ? 3 : 6,
  );
  const Comp = onOpen ? "button" : "div";

  return (
    <Card>
      <Comp
        type={onOpen ? "button" : undefined}
        onClick={onOpen}
        className={cn("w-full px-3 py-2.5 text-left", onOpen && "active:bg-muted/50")}
      >
        <div className="mb-1.5 flex items-center gap-2">
          <IconWell className="size-6">
            <Newspaper className="size-3.5" />
          </IconWell>
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            Сводка дня
          </div>
          <div className="ml-auto text-[11px] font-medium text-muted-foreground">
            {ready.length} каналов
          </div>
        </div>
        <ul className="space-y-1">
          {bullets.map((item, i) => (
            <li key={i} className="flex gap-2 text-[13px] leading-snug text-foreground">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
              <span className={cn("min-w-0", compact && "line-clamp-2")}>{item}</span>
            </li>
          ))}
        </ul>
      </Comp>
    </Card>
  );
}
