import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { RefreshCw, SlidersHorizontal } from "lucide-react";
import { getDigest } from "@/lib/server/digest";
import { splitPost } from "@/lib/digest/brief";
import { useSources } from "@/lib/stores/sources";
import { AppShell } from "@/components/shell/app-shell";
import { Header } from "@/components/shell/header";
import { Page } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BriefingCard } from "@/components/digest/briefing-card";
import { haptic } from "@/lib/haptic";

function formatStamp(raw?: string) {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 16);
  return d.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function DigestView() {
  const navigate = useNavigate();
  const allSources = useSources((s) => s.sources);
  const sources = allSources.filter((x) => x.enabled);

  const q = useQuery({
    queryKey: ["digest", sources.map((s) => s.id).join(",")],
    queryFn: () =>
      getDigest({
        data: {
          sources: sources.map((s) => ({ type: s.type, name: s.name, title: s.title })),
        },
      }),
  });

  const blocks = q.data?.blocks ?? [];
  const withPosts = blocks.filter((b) => b.posts.length > 0);
  const failed = blocks.filter((b) => b.error && !b.posts.length);

  return (
    <AppShell>
      <Header
        title="Дайджест"
        subtitle={`${sources.length} источников · ${q.data?.total ?? 0} материалов`}
        backTo="/"
        right={
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="icon-sm"
              aria-label="Настройки дайджеста"
              onClick={() => {
                haptic();
                navigate({ to: "/sources" });
              }}
            >
              <SlidersHorizontal className="size-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon-sm"
              aria-label="Обновить"
              onClick={() => {
                haptic("light");
                void q.refetch();
              }}
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
        }
      />
      <Page>
        {q.isLoading ? <Skeleton className="h-32 rounded-2xl" /> : null}
        {q.isError ? (
          <p className="py-8 text-center text-sm text-destructive">Не удалось собрать дайджест.</p>
        ) : null}
        <BriefingCard blocks={blocks} loading={false} />
        {withPosts.map((block) => (
          <Card key={block.title} className="space-y-2 p-3">
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{block.title}</div>
            {block.posts.slice(0, 8).map((p, i) => {
              const { title, lead } = splitPost(p.text);
              return (
                <div key={`${block.title}-${i}`} className="border-t border-border pt-2 first:border-0 first:pt-0">
                  <div className="text-sm font-semibold leading-snug text-foreground">{title}</div>
                  {lead ? <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{lead.slice(0, 280)}</p> : null}
                  {p.date ? <div className="mt-1 text-[11px] text-muted-foreground">{formatStamp(p.date)}</div> : null}
                </div>
              );
            })}
          </Card>
        ))}
        {failed.map((block) => (
          <Card key={`err-${block.title}`} className="p-3">
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{block.title}</div>
            <p className="mt-1 text-sm text-muted-foreground">{block.error}</p>
          </Card>
        ))}
        {q.data && withPosts.length === 0 && !q.isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Нет свежих материалов. Источники — в настройках дайджеста.
          </p>
        ) : null}
      </Page>
    </AppShell>
  );
}
