import { useQuery } from "@tanstack/react-query";
import { hubActivityFeed } from "@/lib/server/hub-status";
import { useHub } from "@/lib/stores/hub";
import { AppShell } from "@/components/shell/app-shell";
import { Header } from "@/components/shell/header";
import { Page } from "@/components/shell/page";
import { Card } from "@/components/ui/card";

const LABELS: Record<string, string> = {
  login_ok: "Вход",
  login_fail_pin: "Неверный PIN",
  login_denied: "Отказ во входе",
  setup_owner: "Назначен владелец",
  pin_set: "PIN изменён",
  pin_clear: "PIN снят",
  passkey_register: "Привязан Face ID",
  passkey_delete: "Face ID отвязан",
  invite_create: "Инвайт",
  invite_redeem: "Вход по инвайту",
  reminder_create: "Напоминание",
  reminder_delete: "Напоминание удалено",
  admin_patch: "Права изменены",
  admin_delete: "Пользователь удалён",
};

function stamp(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16);
  return d.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function ActivityView() {
  const token = useHub((s) => s.token);
  const q = useQuery({
    queryKey: ["activity-feed"],
    queryFn: () => hubActivityFeed({ data: { token } }),
    enabled: Boolean(token),
    staleTime: 15_000,
  });

  return (
    <AppShell>
      <Header title="Лента агента" subtitle="Что делал хаб" backTo="/status" />
      <Page>
        {(q.data ?? []).map((row) => (
          <Card key={row.id} className="px-3 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-sm font-semibold">{LABELS[row.action] || row.action}</div>
              <div className="text-[11px] tabular-nums text-muted-foreground">{stamp(row.created_at)}</div>
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {row.display_name || "система"}
              {row.auth_method ? ` · ${row.auth_method}` : ""}
              {row.detail ? ` · ${row.detail}` : ""}
            </div>
          </Card>
        ))}
        {q.data && q.data.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Пока пусто.</p>
        ) : null}
      </Page>
    </AppShell>
  );
}
