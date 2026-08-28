import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { RefreshCw, SlidersHorizontal } from "lucide-react";
import { getDigest } from "@/lib/server/digest";
import { digestRefresh, digestSnapshot } from "@/lib/server/digest-snapshot";
import { splitPost } from "@/lib/digest/brief";
import { useSources } from "@/lib/stores/sources";
import { useHub } from "@/lib/stores/hub";
import { AppShell } from "@/components/shell/app-shell";
import { Header } from "@/components/shell/header";
import { Page } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BriefingCard } from "@/components/digest/briefing-card";
import { haptic } from "@/lib/haptic";

function formatStamp(raw?: string | null) {
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 16);
  return d.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function DigestView() {
  const navigate = useNavigate();
  const token = useHub((s) => s.token);
  const allSources = useSources((s) => s.sources);
  const sources = allSources.filter((x) => x.enabled);

  const snap = useQuery({
    queryKey: ["digest-snapshot"],
    queryFn: () => digestSnapshot(),
    staleTime: 5 * 60_000,
  });

  const live = useQuery({
    queryKey: ["digest", sources.map((s) => s.id).join(",")],
    queryFn: () =>
      getDigest({
        data: {
          sources: sources.map((s) => ({ type: s.type, name: s.name, title: s.title })),
        },
      }),
    enabled: !snap.data?.items.length,
  });

  const refresh = async () => {
    haptic("light");
    try {
      await digestRefresh({ data: { token } });
    } catch {
      /* fallback live */
    }
    await Promise.all([snap.refetch(), live.refetch()]);
  };

  const ranked = snap.data?.items ?? [];
  const blocks = live.data?.blocks ?? [];
  const withPosts = blocks.filter((b) => b.posts.length > 0);
  const failed = blocks.filter((b) => b.error && !b.posts.length);
  const briefBlocks = ranked.length
    ? [
        {
          title: "Дайджест",
          type: "rss" as const,
          posts: ranked.slice(0, 12).map((i) => ({
            text: `${i.title} — ${i.summary || ""}`,
            date: i.published_at ?? undefined,
          })),
        },
      ]
    : blocks;

  return (
    <AppShell>
      <Header
        title="Дайджест"
        subtitle={
          snap.data?.refreshedAt
            ? `снимок · ${formatStamp(snap.data.refreshedAt)}`
            : `${sources.length} источников · ${live.data?.total ?? 0} материалов`
        }
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
            <Button variant="secondary" size="icon-sm" aria-label="Обновить" onClick={() => void refresh()}>
              <RefreshCw className="size-4" />
            </Button>
          </div>
        }
      />
      <Page>
        {snap.isLoading && live.isLoading ? <Skeleton className="h-32 rounded-2xl" /> : null}
        <BriefingCard blocks={briefBlocks} loading={false} />
        {ranked.length
          ? ranked.slice(0, 24).map((item) => (
              <Card key={item.id} className="space-y-1 p-3">
                <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {item.source || "Источник"}
                </div>
                {item.url.startsWith("http") ? (
                  <a href={item.url} target="_blank" rel="noreferrer" className="text-sm font-semibold leading-snug">
                    {item.title}
                  </a>
                ) : (
                  <div className="text-sm font-semibold leading-snug">{item.title}</div>
                )}
                {item.summary ? (
                  <p className="text-[13px] leading-relaxed text-muted-foreground">{item.summary.slice(0, 280)}</p>
                ) : null}
                {item.published_at ? (
                  <div className="text-[11px] text-muted-foreground">{formatStamp(item.published_at)}</div>
                ) : null}
              </Card>
            ))
          : withPosts.map((block) => (
              <Card key={block.title} className="space-y-2 p-3">
                <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{block.title}</div>
                {block.posts.slice(0, 8).map((p, i) => {
                  const { title, lead } = splitPost(p.text);
                  return (
                    <div key={`${block.title}-${i}`} className="border-t border-border pt-2 first:border-0 first:pt-0">
                      <div className="text-sm font-semibold leading-snug text-foreground">{title}</div>
                      {lead ? (
                        <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{lead.slice(0, 280)}</p>
                      ) : null}
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
      </Page>
    </AppShell>
  );
}
