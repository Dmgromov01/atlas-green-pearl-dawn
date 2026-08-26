import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { RefreshCw, SlidersHorizontal } from "lucide-react";
import { getDigest } from "@/lib/server/digest";
import { useSources } from "@/lib/stores/sources";
import { AppShell } from "@/components/shell/app-shell";
import { Header } from "@/components/shell/header";
import { Page } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BriefingCard } from "@/components/digest/briefing-card";
import { haptic } from "@/lib/haptic";

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

  return (
    <AppShell>
      <Header
        title="Дайджест"
        subtitle={`${sources.length} источников`}
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
        <BriefingCard blocks={q.data?.blocks} loading={false} />
        {q.data && q.data.blocks.every((b) => b.posts.length === 0) ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Нет свежих материалов. Источники — в настройках дайджеста.
          </p>
        ) : null}
      </Page>
    </AppShell>
  );
}
