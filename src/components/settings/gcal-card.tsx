import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Plus, RefreshCw, X } from "lucide-react";
import {
  gcalCalendarInfo,
  gcalCreateCalendar,
  gcalDeleteCalendar,
  gcalDisconnect,
  gcalSaveCreds,
  gcalShareCalendar,
  gcalStatus,
  gcalUnshareCalendar,
  gcalUpdateCalendar,
} from "@/lib/server/gcal";
import { useHub } from "@/lib/stores/hub";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SectionLabel } from "@/components/shell/page";
import { haptic } from "@/lib/haptic";
import { cn } from "@/lib/utils";

const CAL_COLORS = [
  "#FF3B30",
  "#FF9500",
  "#FFCC00",
  "#34C759",
  "#00C7BE",
  "#30B0C7",
  "#32ADE6",
  "#4285F4",
  "#5856D6",
  "#AF52DE",
  "#FF2D55",
  "#A2845E",
  "#8E8E93",
  "#636366",
] as const;

type Invitee = { email: string; name: string; status: string; access: string };

type Editor = {
  id?: string;
  name: string;
  color: string;
  asFamily: boolean;
  asPrimary: boolean;
  allowInvite: boolean;
  publish: boolean;
  publishUrl: string;
  emails: string;
  invitees: Invitee[];
};

function emptyEditor(asFamily = false): Editor {
  return {
    name: "",
    color: CAL_COLORS[7],
    asFamily,
    asPrimary: false,
    allowInvite: true,
    publish: false,
    publishUrl: "",
    emails: "",
    invitees: [],
  };
}

function parseBundle(raw: string) {
  const t = raw.trim();
  if (!t) return null;
  try {
    const j = JSON.parse(t) as Record<string, unknown>;
    const web = (j.web || j.installed || j) as Record<string, unknown>;
    const clientId = String(j.client_id || web.client_id || "");
    const clientSecret = String(j.client_secret || web.client_secret || "");
    const tokens = (j.tokens || j) as Record<string, unknown>;
    const refreshToken = String(j.refresh_token || tokens.refresh_token || "");
    if (clientId && clientSecret && refreshToken) return { clientId, clientSecret, refreshToken };
  } catch {
    return null;
  }
  return null;
}

function roleLabel(id: string, primary?: string | null, family?: string | null, isPrimary?: boolean) {
  const mine = isPrimary || id === primary || id === "primary";
  if (id === family && mine) return "семья · мой";
  if (id === family) return "семья";
  if (mine) return "мой";
  return "";
}

function statusLabel(status: string) {
  if (status === "accepted") return "принят";
  if (status === "declined") return "отклонён";
  return "приглашение";
}

function nearestColor(hex: string) {
  const raw = hex.replace(/^#/, "").toUpperCase();
  if (CAL_COLORS.some((c) => c.slice(1) === raw)) return `#${raw}`;
  return hex.startsWith("#") ? hex.toUpperCase() : `#${raw}`;
}

export function GcalCard() {
  const token = useHub((s) => s.token);
  const [bundle, setBundle] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [showCreds, setShowCreds] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);

  const status = useQuery({
    queryKey: ["gcal", token],
    queryFn: () => gcalStatus({ data: { token } }),
    enabled: Boolean(token),
    staleTime: 30_000,
  });

  const save = useMutation({
    mutationFn: () => {
      const parsed = parseBundle(bundle);
      return gcalSaveCreds({
        data: {
          token,
          clientId: parsed?.clientId || clientId,
          clientSecret: parsed?.clientSecret || clientSecret,
          refreshToken: parsed?.refreshToken || refreshToken,
        },
      });
    },
    onSuccess: () => {
      haptic("success");
      toast("Google Календарь подключён");
      setClientSecret("");
      setRefreshToken("");
      setBundle("");
      setShowCreds(false);
      void status.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const off = useMutation({
    mutationFn: () => gcalDisconnect({ data: { token } }),
    onSuccess: () => {
      haptic();
      toast("Google отключён");
      void status.refetch();
    },
  });

  const create = useMutation({
    mutationFn: (draft: Editor) =>
      gcalCreateCalendar({
        data: {
          token,
          name: draft.name,
          color: draft.color,
          asFamily: draft.asFamily,
          asPrimary: draft.asPrimary,
          emails: draft.emails,
          publish: draft.publish,
        },
      }),
    onSuccess: () => {
      haptic("success");
      toast("Календарь создан — откроется на iPhone в Google");
      setEditor(null);
      void status.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: (draft: Editor) =>
      gcalUpdateCalendar({
        data: {
          token,
          id: draft.id!,
          name: draft.name,
          color: draft.color,
          asFamily: draft.asFamily,
          asPrimary: draft.asPrimary,
          publish: draft.publish,
        },
      }),
    onSuccess: () => {
      haptic("success");
      toast("Календарь сохранён");
      setEditor(null);
      void status.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => gcalDeleteCalendar({ data: { token, id } }),
    onSuccess: () => {
      haptic();
      toast("Календарь удалён");
      setEditor(null);
      void status.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const share = useMutation({
    mutationFn: (input: { id: string; emails: string; write: boolean }) =>
      gcalShareCalendar({ data: { token, id: input.id, emails: input.emails, write: input.write } }),
    onSuccess: (res, input) => {
      haptic("success");
      toast("Приглашение отправлено");
      setEditor((cur) => (cur && cur.id === input.id ? { ...cur, emails: "", invitees: res.invitees } : cur));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unshare = useMutation({
    mutationFn: (input: { id: string; email: string }) =>
      gcalUnshareCalendar({ data: { token, id: input.id, email: input.email } }),
    onSuccess: (res, input) => {
      haptic();
      setEditor((cur) => (cur && cur.id === input.id ? { ...cur, invitees: res.invitees } : cur));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => {
    haptic();
    setEditor(emptyEditor());
  };

  const openEdit = async (id: string, name: string, color: string) => {
    haptic();
    const family = status.data?.connected ? status.data.familyId : "";
    const primary = status.data?.connected ? status.data.primaryId : "";
    const cal = status.data?.calendars.find((c) => c.id === id);
    setEditor({
      ...emptyEditor(),
      id,
      name,
      color: nearestColor(color),
      asFamily: id === family,
      asPrimary: Boolean(cal?.primary) || id === primary,
    });
    try {
      const info = await gcalCalendarInfo({ data: { token, id } });
      setEditor((cur) =>
        cur && cur.id === id
          ? { ...cur, invitees: info.invitees, publish: info.publish, publishUrl: info.publishUrl }
          : cur,
      );
    } catch {
      /* list still usable */
    }
  };

  if (!token) {
    return (
      <Card className="space-y-2 p-4">
        <SectionLabel>Google Календарь</SectionLabel>
        <p className="text-sm text-muted-foreground">Сессия ещё не установлена.</p>
      </Card>
    );
  }

  const connected = status.data?.connected;
  const calendars = status.data?.calendars ?? [];
  const busy = create.isPending || update.isPending || remove.isPending;

  if (editor) {
    const isNew = !editor.id;
    const title = isNew ? "Новый календарь" : "Календарь";
    const action = isNew ? "Добавить" : "Готово";
    const pending = isNew ? create.isPending : update.isPending;
    const patch = (partial: Partial<Editor>) => setEditor((cur) => (cur ? { ...cur, ...partial } : cur));
    const submit = () => {
      if (!editor.name.trim()) {
        toast.error("Напишите название");
        return;
      }
      if (isNew) create.mutate(editor);
      else update.mutate(editor);
    };

    return (
      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="grid size-9 place-items-center rounded-full text-accent"
            aria-label="Назад"
            onClick={() => setEditor(null)}
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1 text-center text-sm font-bold">{title}</div>
          <button
            type="button"
            className="h-9 px-2 text-sm font-bold text-accent disabled:opacity-40"
            disabled={pending || !editor.name.trim()}
            onClick={submit}
          >
            {pending ? "…" : action}
          </button>
        </div>

        <Input
          value={editor.name}
          onChange={(e) => patch({ name: e.target.value })}
          placeholder="Название"
          autoComplete="off"
        />

        <div>
          <div className="mb-2 text-xs font-bold text-muted-foreground">Цвет</div>
          <div className="grid grid-cols-7 gap-2">
            {CAL_COLORS.map((c) => {
              const on = editor.color.toUpperCase() === c;
              return (
                <button
                  key={c}
                  type="button"
                  aria-label={`Цвет ${c}`}
                  aria-pressed={on}
                  onClick={() => {
                    haptic();
                    patch({ color: c });
                  }}
                  className={cn(
                    "relative grid size-9 place-items-center rounded-full",
                    on && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
                  )}
                >
                  <span className="size-8 rounded-full" style={{ backgroundColor: c }} />
                  {on ? <Check className="pointer-events-none absolute size-3.5" color="#fff" strokeWidth={3} /> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex min-h-11 items-center justify-between gap-3 rounded-2xl bg-muted px-3">
          <div className="text-sm font-semibold">Учётная запись</div>
          <div className="text-sm text-muted-foreground">Google</div>
        </div>

        <div className="space-y-2 rounded-2xl bg-muted px-3 py-3">
          <div className="text-xs font-bold text-muted-foreground">Общий доступ</div>
          {editor.invitees.length ? (
            <div className="space-y-1">
              {editor.invitees.map((p) => (
                <div key={p.email} className="flex min-h-10 items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{p.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {p.email} · {statusLabel(p.status)}
                    </div>
                  </div>
                  {editor.id ? (
                    <button
                      type="button"
                      className="grid size-8 place-items-center text-muted-foreground"
                      aria-label={`Убрать ${p.email}`}
                      onClick={() => unshare.mutate({ id: editor.id!, email: p.email })}
                    >
                      <X className="size-4" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Пока никого. Семье придёт приглашение на почту.</p>
          )}
          <div className="flex gap-2">
            <Input
              value={editor.emails}
              onChange={(e) => patch({ emails: e.target.value })}
              placeholder="Почта семьи"
              autoComplete="off"
              inputMode="email"
            />
            <Button
              variant="secondary"
              disabled={!editor.emails.includes("@") || share.isPending}
              onClick={() => {
                if (editor.id) {
                  share.mutate({ id: editor.id, emails: editor.emails, write: editor.allowInvite });
                } else {
                  toast("Человек получит доступ после «Добавить»");
                }
              }}
            >
              Добавить
            </Button>
          </div>
        </div>

        <div className="flex min-h-11 items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Другие могут приглашать</div>
            <div className="text-xs text-muted-foreground">Гости пишут события</div>
          </div>
          <Switch checked={editor.allowInvite} onCheckedChange={(v) => patch({ allowInvite: v })} />
        </div>

        <div className="flex min-h-11 items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Общий URL-адрес</div>
            <div className="text-xs text-muted-foreground">Публичная ссылка Google</div>
          </div>
          <Switch
            checked={editor.publish}
            onCheckedChange={(v) => patch({ publish: v, publishUrl: v ? editor.publishUrl : "" })}
          />
        </div>
        {editor.publish && editor.publishUrl ? (
          <button
            type="button"
            className="w-full truncate rounded-2xl bg-muted px-3 py-2 text-left text-xs text-accent"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(editor.publishUrl);
                toast("Ссылка скопирована");
              } catch {
                toast(editor.publishUrl);
              }
            }}
          >
            {editor.publishUrl}
          </button>
        ) : null}

        <div className="flex min-h-11 items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Семейный в хабе</div>
            <div className="text-xs text-muted-foreground">Сюда пишутся общие встречи</div>
          </div>
          <Switch checked={editor.asFamily} onCheckedChange={(v) => patch({ asFamily: v })} />
        </div>
        <div className="flex min-h-11 items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Мой календарь</div>
            <div className="text-xs text-muted-foreground">Личные события с хаба</div>
          </div>
          <Switch checked={editor.asPrimary} onCheckedChange={(v) => patch({ asPrimary: v })} />
        </div>

        <Button variant="solid" className="w-full" disabled={busy || !editor.name.trim()} onClick={submit}>
          {pending ? "Сохраняю…" : action}
        </Button>

        {!isNew ? (
          <Button
            variant="outline"
            className="w-full text-destructive"
            disabled={remove.isPending}
            onClick={() => {
              if (!window.confirm(`Удалить календарь «${editor.name}» в Google?`)) return;
              remove.mutate(editor.id!);
            }}
          >
            Удалить календарь
          </Button>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className="space-y-3 p-4">
      <SectionLabel>Google Календарь</SectionLabel>
      <p className="text-sm leading-snug text-muted-foreground">
        Личные события — в Google (и на iPhone). Семейные — в общий календарь без подписки Family. Можно создать
        календарь, выбрать цвет и открыть семье по почте.
      </p>
      {connected ? (
        <p className="text-xs font-semibold text-success">
          Готово{status.data?.email ? ` · ${status.data.email}` : ""}
        </p>
      ) : status.data?.error ? (
        <p className="text-xs text-destructive">{status.data.error}</p>
      ) : null}

      {!connected || showCreds ? (
        <>
          <Input
            value={bundle}
            onChange={(e) => setBundle(e.target.value)}
            placeholder="Вставить JSON: client_id, client_secret, refresh_token"
            autoComplete="off"
          />
          <Input
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Client ID"
            autoComplete="off"
          />
          <Input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder="Client secret"
            autoComplete="off"
          />
          <Input
            type="password"
            value={refreshToken}
            onChange={(e) => setRefreshToken(e.target.value)}
            placeholder="Refresh token"
            autoComplete="off"
          />
          <Button variant="solid" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Проверяю…" : connected ? "Подключить заново" : "Подключить"}
          </Button>
        </>
      ) : (
        <button type="button" className="text-left text-xs font-semibold text-accent" onClick={() => setShowCreds(true)}>
          Сменить ключи Google
        </button>
      )}

      {connected ? (
        <>
          <div className="text-xs font-bold text-muted-foreground">Календари</div>
          <div className="divide-y divide-border overflow-hidden rounded-2xl bg-muted">
            {calendars.length === 0 ? (
              <div className="px-3 py-3 text-sm text-muted-foreground">Календарей пока нет</div>
            ) : (
              calendars.map((c) => {
                const role = roleLabel(c.id, status.data?.primaryId, status.data?.familyId, c.primary);
                return (
                  <button
                    key={c.id}
                    type="button"
                    className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left"
                    onClick={() => void openEdit(c.id, c.summary, c.color)}
                  >
                    <span className="size-3.5 shrink-0 rounded-full" style={{ backgroundColor: c.color || CAL_COLORS[7] }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{c.summary}</div>
                      {role ? <div className="text-xs text-muted-foreground">{role}</div> : null}
                    </div>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                );
              })
            )}
          </div>
          <Button variant="secondary" className="w-full" onClick={openCreate}>
            <Plus className="size-4" />
            Добавить календарь
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={status.isFetching}
              onClick={() => {
                haptic();
                void status.refetch().then(() => toast("Календари обновлены"));
              }}
            >
              <RefreshCw className="size-4" />
              Синхронизировать
            </Button>
            <Button variant="secondary" onClick={() => off.mutate()}>
              Отключить
            </Button>
          </div>
        </>
      ) : null}
    </Card>
  );
}
