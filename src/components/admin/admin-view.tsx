import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { adminAudit, adminDeleteUser, adminListBotAccess, adminListUsers, adminPatchUser } from "@/lib/server/hub-admin";
import { formatTokenCount, templateLabel } from "@/lib/openclaw/bot-access";
import { hubCreateInvite, hubListInvites } from "@/lib/server/hub-auth";
import { useHub } from "@/lib/stores/hub";
import { AppShell } from "@/components/shell/app-shell";
import { Header } from "@/components/shell/header";
import { Page, SectionLabel } from "@/components/shell/page";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptic";

export function AdminView() {
  const token = useHub((s) => s.token);
  const me = useHub((s) => s.user);
  const qc = useQueryClient();
  const [inviteUrl, setInviteUrl] = useState("");
  const invites = useQuery({
    queryKey: ["invites"],
    queryFn: () => hubListInvites({ data: { token } }),
    enabled: Boolean(token && me?.role === "admin"),
  });
  const createInvite = useMutation({
    mutationFn: () => hubCreateInvite({ data: { token } }),
    onSuccess: async (result) => {
      setInviteUrl(result.url);
      void qc.invalidateQueries({ queryKey: ["invites"] });
      try {
        await navigator.clipboard.writeText(result.url);
        toast("Инвайт скопирован. Действует 7 дней.");
      } catch {
        toast("Инвайт создан");
      }
      haptic("success");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => adminListUsers({ data: { token } }),
    enabled: Boolean(token && me?.role === "admin"),
  });
  const logs = useQuery({
    queryKey: ["admin-audit"],
    queryFn: () => adminAudit({ data: { token } }),
    enabled: Boolean(token && me?.role === "admin"),
  });
  const botAccess = useQuery({
    queryKey: ["admin-bot-access"],
    queryFn: () => adminListBotAccess({ data: { token } }),
    enabled: Boolean(token && me?.role === "admin"),
    staleTime: 60_000,
  });

  const patch = useMutation({
    mutationFn: (input: Parameters<typeof adminPatchUser>[0]["data"]) => adminPatchUser({ data: input }),
    onSuccess: () => {
      haptic();
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (userId: string) => adminDeleteUser({ data: { token, userId } }),
    onSuccess: () => {
      haptic("heavy");
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
      void qc.invalidateQueries({ queryKey: ["admin-audit"] });
      toast("Пользователь удалён");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (me?.role !== "admin") {
    return (
      <AppShell>
        <Header title="Админка" subtitle="Нет прав" backTo="/settings" />
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">Только для администратора.</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Header title="Админка" subtitle={`${users.data?.length ?? 0} пользователей`} backTo="/settings" />
      <Page>
        <Card className="space-y-3 p-4">
          <SectionLabel>Доступ семьи</SectionLabel>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Новый пользователь входит по одноразовому инвайту, затем привязывает Face ID. PIN остаётся запасным входом.
          </p>
          <Button className="w-full" variant="secondary" disabled={createInvite.isPending} onClick={() => void createInvite.mutate()}>
            {createInvite.isPending ? "Создаю…" : "Создать инвайт"}
          </Button>
          {inviteUrl ? (
            <div className="flex gap-2">
              <Input readOnly value={inviteUrl} aria-label="Ссылка инвайта" />
              <Button
                variant="secondary"
                size="icon"
                aria-label="Скопировать инвайт"
                onClick={() => void navigator.clipboard.writeText(inviteUrl).then(() => toast("Инвайт скопирован")).catch(() => toast.error("Не удалось скопировать ссылку"))}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          ) : null}
          {(invites.data ?? []).slice(0, 5).map((invite) => (
            <p key={invite.id} className="text-xs text-muted-foreground">
              {invite.used_at ? "использован" : "ожидает"} · до {invite.expires_at.slice(0, 10)}
              {invite.display_name ? ` · ${invite.display_name}` : ""}
            </p>
          ))}
        </Card>
        {(users.data ?? []).map((u) => (
          <Card key={u.id} className="space-y-2 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  {u.display_name || u.username || "Без имени"}
                  {u.role === "admin" ? <Shield className="size-3.5 text-accent" /> : null}
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {u.role === "admin" ? "владелец" : "семья"}
                  </span>
                </div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {u.telegram_id?.startsWith("dev:")
                    ? `preview · ${u.telegram_id.slice(4, 12)}`
                    : u.telegram_id || "local"}{" "}
                  · {u.ai_mode} · {u.quota_used}/{u.quota_daily}
                </div>
              </div>
              {u.id !== me.id ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive"
                  onClick={() => {
                    if (!window.confirm("Удалить пользователя и его сессии?")) return;
                    remove.mutate(u.id);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span>Доступ</span>
              <Switch
                checked={Boolean(u.allowed)}
                onCheckedChange={(v) => patch.mutate({ token, userId: u.id, allowed: v })}
              />
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span>Админ</span>
              <Switch
                checked={u.role === "admin"}
                onCheckedChange={(v) => patch.mutate({ token, userId: u.id, role: v ? "admin" : "user" })}
              />
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              <span>Общий AI</span>
              <Switch
                checked={Boolean(u.allow_global_ai)}
                onCheckedChange={(v) => patch.mutate({ token, userId: u.id, allowGlobalAi: v })}
              />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="shrink-0">Квота/день</span>
              <Input
                type="number"
                className="h-8"
                defaultValue={u.quota_daily}
                onBlur={(e) => {
                  const n = Number(e.target.value);
                  if (n !== u.quota_daily) patch.mutate({ token, userId: u.id, quotaDaily: n });
                }}
              />
            </div>
          </Card>
        ))}

        <Card className="space-y-3 p-4">
          <SectionLabel>Доступ к боту</SectionLabel>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Telegram @{((botAccess.data?.bot || "@Dmbotmy_bot").replace(/^@/, ""))}. Только просмотр: кто в
            allowlist, шаблон прав и токены. Чат здесь не ведётся.
          </p>
          {botAccess.data?.providersConfigured?.length ? (
            <p className="text-[11px] text-muted-foreground">
              Провайдеры: {botAccess.data.providersConfigured.join(", ")}
              {botAccess.data.dmPolicy ? ` · ${botAccess.data.dmPolicy}` : ""}
            </p>
          ) : null}
          {botAccess.isLoading ? (
            <p className="text-sm text-muted-foreground">Загружаю реестр бота…</p>
          ) : null}
          {botAccess.isError ? (
            <p className="text-sm text-destructive">
              {(botAccess.error as Error)?.message || "Не удалось прочитать OpenClaw"}
            </p>
          ) : null}
          {(botAccess.data?.peers ?? []).map((peer) => {
            const allowed = peer.permissions.filter((p) => p.allowed);
            const denied = peer.permissions.filter((p) => !p.allowed);
            const last = peer.lastInteractionAt
              ? new Date(peer.lastInteractionAt).toLocaleString("ru-RU", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "нет сессий";
            return (
              <div key={peer.telegramId} className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">
                      {peer.label}{" "}
                      <span className="text-[11px] font-medium text-muted-foreground">
                        · {templateLabel(peer.template)} · агент {peer.agentId}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      активен · писал {last}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                    <div>
                      {formatTokenCount(peer.totals.inputTokens)} → {formatTokenCount(peer.totals.outputTokens)}
                    </div>
                    <div>
                      {peer.totals.estimatedCostUsd > 0
                        ? `~$${peer.totals.estimatedCostUsd.toFixed(3)}`
                        : "—"}
                    </div>
                  </div>
                </div>
                {peer.usage.length ? (
                  <div className="space-y-0.5 text-[11px] text-muted-foreground">
                    {peer.usage.map((u) => (
                      <div key={`${u.provider}|${u.model}`} className="flex justify-between gap-2">
                        <span className="truncate">
                          {u.provider}/{u.model}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {formatTokenCount(u.inputTokens)} → {formatTokenCount(u.outputTokens)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Токены чата пока не зафиксированы.</p>
                )}
                <div className="grid gap-2 text-[11px] sm:grid-cols-2">
                  <div>
                    <div className="mb-0.5 font-semibold text-foreground">Можно</div>
                    <ul className="space-y-0.5 text-muted-foreground">
                      {allowed.map((p) => (
                        <li key={p.id}>✓ {p.label}</li>
                      ))}
                      {!allowed.length ? <li>—</li> : null}
                    </ul>
                  </div>
                  <div>
                    <div className="mb-0.5 font-semibold text-foreground">Нельзя</div>
                    <ul className="space-y-0.5 text-muted-foreground">
                      {denied.slice(0, 8).map((p) => (
                        <li key={p.id}>✗ {p.label}</li>
                      ))}
                      {!denied.length ? <li>—</li> : null}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
          {!botAccess.isLoading && !botAccess.isError && !(botAccess.data?.peers ?? []).length ? (
            <p className="text-sm text-muted-foreground">В allowlist бота пока никого нет.</p>
          ) : null}
        </Card>

        <Card className="p-3">
          <SectionLabel className="mb-2">Аудит</SectionLabel>
          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {(logs.data ?? []).map((l) => (
              <div key={l.id} className="flex gap-2 text-[11px] leading-snug">
                <span className="w-16 shrink-0 tabular-nums text-muted-foreground">
                  {l.created_at.slice(11, 16)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">{l.action}</span>
                  {l.auth_method ? ` · ${l.auth_method}` : ""}
                  {l.key_source ? ` · ${l.key_source}` : ""}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </Page>
    </AppShell>
  );
}
