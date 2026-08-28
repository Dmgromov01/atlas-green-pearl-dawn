import { useQuery } from "@tanstack/react-query";
import { Activity, HeartPulse } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { hubSystemStatus } from "@/lib/server/hub-status";
import { useHub } from "@/lib/stores/hub";
import { AppShell } from "@/components/shell/app-shell";
import { Header } from "@/components/shell/header";
import { Page, SectionLabel } from "@/components/shell/page";
import { Card } from "@/components/ui/card";
import { ServiceRow } from "@/components/shell/service-row";
import { haptic } from "@/lib/haptic";

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        ok ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-destructive/10 text-destructive"
      }`}
    >
      {label}
    </span>
  );
}

export function StatusView() {
  const token = useHub((s) => s.token);
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ["system-status"],
    queryFn: () => hubSystemStatus({ data: { token } }),
    enabled: Boolean(token),
    staleTime: 20_000,
  });
  const s = q.data;

  return (
    <AppShell>
      <Header title="Состояние" subtitle="Календари, шлюз, хаб" backTo="/settings" />
      <Page>
        <Card className="space-y-2 p-4">
          <SectionLabel>Хаб</SectionLabel>
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">Сайт</div>
            <Pill ok label="онлайн" />
          </div>
          <p className="text-xs leading-snug text-muted-foreground">
            Слушает только loopback, снаружи — nginx TLS. Шлюз OpenClaw на WAN не публикуется.
          </p>
        </Card>

        <Card className="space-y-2 p-4">
          <SectionLabel>Google Calendar</SectionLabel>
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">Семейный календарь</div>
            <Pill
              ok={Boolean(s?.calendar.google.connected)}
              label={s?.calendar.google.connected ? "подключен" : "нет"}
            />
          </div>
          <p className="text-xs leading-snug text-muted-foreground">{s?.calendar.google.note}</p>
          {s?.calendar.google.email ? (
            <p className="text-xs text-muted-foreground">{s.calendar.google.email}</p>
          ) : null}
          {s?.calendar.google.error ? <p className="text-xs text-destructive">{s.calendar.google.error}</p> : null}
        </Card>

        <Card className="space-y-2 p-4">
          <SectionLabel>iCloud</SectionLabel>
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">Личный CalDAV</div>
            <Pill
              ok={Boolean(s?.calendar.icloud.connected)}
              label={s?.calendar.icloud.connected ? "подключен" : "нет"}
            />
          </div>
          <p className="text-xs leading-snug text-muted-foreground">{s?.calendar.icloud.note}</p>
          {s?.calendar.icloud.appleId ? (
            <p className="text-xs text-muted-foreground">{s.calendar.icloud.appleId}</p>
          ) : null}
          {s?.calendar.icloud.error ? <p className="text-xs text-destructive">{s.calendar.icloud.error}</p> : null}
        </Card>

        <Card className="space-y-2 p-4">
          <SectionLabel>OpenClaw</SectionLabel>
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">Шлюз агента</div>
            <Pill ok={Boolean(s?.gateway.ok)} label={s?.gateway.ok ? "отвечает" : "тишина"} />
          </div>
          <p className="text-xs leading-snug text-muted-foreground">
            Агент хаба без tools. Рестарт шлюза — только с SSH, не из Telegram.
          </p>
        </Card>

        <Card>
          <ServiceRow
            icon={<Activity className="size-4" />}
            title="Лента агента"
            status="Входы, инвайты, напоминания"
            onClick={() => {
              haptic();
              void navigate({ to: "/activity" });
            }}
          />
        </Card>
        <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <HeartPulse className="size-3.5" />
          {q.isFetching ? "Обновляю…" : "Статус с сервера, без догадок"}
        </div>
      </Page>
    </AppShell>
  );
}
