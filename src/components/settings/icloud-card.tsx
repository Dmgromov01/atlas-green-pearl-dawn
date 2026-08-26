import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Plus, RefreshCw, X } from "lucide-react";
import {
  icloudCalendarInfo,
  icloudCreateCalendar,
  icloudDeleteCalendar,
  icloudDisconnect,
  icloudSave,
  icloudShareCalendar,
  icloudStatus,
  icloudUnshareCalendar,
  icloudUpdateCalendar,
} from "@/lib/server/icloud";
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
  "#007AFF",
  "#5856D6",
  "#AF52DE",
  "#FF2D55",
  "#A2845E",
  "#8E8E93",
  "#636366",
] as const;

type Invitee = { email: string; name: string; status: string; access: string };

type Editor = {
  href?: string;
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
    color: CAL_COLORS[0],
    asFamily,
    asPrimary: false,
    allowInvite: true,
    publish: false,
    publishUrl: "",
    emails: "",
    invitees: [],
  };
}

function roleLabel(href: string, primary?: string | null, family?: string | null) {
  if (href === family && href === primary) return "семья · мой";
  if (href === family) return "семья";
  if (href === primary) return "мой";
  return "";
}

function statusLabel(status: string) {
  if (status === "accepted") return "принят";
  if (status === "declined") return "отклонён";
  return "приглашение";
}

export function IcloudCard() {
  const token = useHub((s) => s.token);
  const [appleId, setAppleId] = useState("");
  const [password, setPassword] = useState("");
  const [showCreds, setShowCreds] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);

  const status = useQuery({
    queryKey: ["icloud", token],
    queryFn: () => icloudStatus({ data: { token } }),
    enabled: Boolean(token),
    staleTime: 30_000,
  });

  useEffect(() => {
    const d = status.data;
    if (!d?.connected) return;
    if (d.appleId) setAppleId(d.appleId);
  }, [status.data]);

  const save = useMutation({
    mutationFn: () => icloudSave({ data: { token, appleId, password } }),
    onSuccess: (res) => {
      haptic("success");
      toast("iCloud подключён — события пойдут на iPhone");
      setPassword("");
      setShowCreds(false);
      void status.refetch();
      void res;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const off = useMutation({
    mutationFn: () => icloudDisconnect({ data: { token } }),
    onSuccess: () => {
      haptic();
      toast("iCloud отключён");
      setEditor(null);
      void status.refetch();
    },
  });

  const create = useMutation({
    mutationFn: (draft: Editor) =>
      icloudCreateCalendar({
        data: {
          token,
          name: draft.name,
          color: draft.color,
          asFamily: draft.asFamily,
          asPrimary: draft.asPrimary,
          emails: draft.emails,
          publish: draft.publish,
          allowInvite: draft.allowInvite,
        },
      }),
    onSuccess: () => {
      haptic("success");
      toast("Календарь появится на iPhone");
      setEditor(null);
      void status.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: (draft: Editor) =>
      icloudUpdateCalendar({
        data: {
          token,
          href: draft.href!,
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
    mutationFn: (href: string) => icloudDeleteCalendar({ data: { token, href } }),
    onSuccess: () => {
      haptic("heavy");
      toast("Календарь удалён на iPhone");
      setEditor(null);
      void status.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const share = useMutation({
    mutationFn: (payload: { href: string; emails: string; write: boolean }) =>
      icloudShareCalendar({ data: { token, ...payload } }),
    onSuccess: async (_res, payload) => {
      haptic("success");
      toast("Приглашение отправлено");
      setEditor((cur) => (cur ? { ...cur, emails: "" } : cur));
      try {
        const info = await icloudCalendarInfo({ data: { token, href: payload.href } });
        setEditor((cur) => (cur ? { ...cur, invitees: info.invitees, publishUrl: info.publishUrl } : cur));
      } catch {
        /* list refresh is best-effort */
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unshare = useMutation({
    mutationFn: (payload: { href: string; email: string }) => icloudUnshareCalendar({ data: { token, ...payload } }),
    onSuccess: (_res, payload) => {
      haptic();
      setEditor((cur) =>
        cur ? { ...cur, invitees: cur.invitees.filter((p) => p.email !== payload.email) } : cur,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => {
    haptic();
    setEditor(emptyEditor());
  };

  const openEdit = async (href: string, name: string, color: string) => {
    haptic();
    const familyHref = status.data?.familyHref;
    const primaryHref = status.data?.primaryHref;
    setEditor({
      ...emptyEditor(href === familyHref),
      href,
      name,
      color: color || CAL_COLORS[0],
      asFamily: href === familyHref,
      asPrimary: href === primaryHref,
    });
    try {
      const info = await icloudCalendarInfo({ data: { token, href } });
      setEditor((cur) =>
        cur && cur.href === href
          ? {
              ...cur,
              name: info.name || cur.name,
              color: info.color || cur.color,
              invitees: info.invitees,
              publish: Boolean(info.publishUrl),
              publishUrl: info.publishUrl,
            }
          : cur,
      );
    } catch {
      /* editor still usable without invite list */
    }
  };

  if (!token) {
    return (
      <Card className="space-y-2 p-4">
        <SectionLabel>iPhone · iCloud</SectionLabel>
        <p className="text-sm text-muted-foreground">Сессия ещё не установлена.</p>
      </Card>
    );
  }

  const connected = status.data?.connected;
  const calendars = status.data?.calendars ?? [];
  const busy = create.isPending || update.isPending || remove.isPending;

  if (editor) {
    const isNew = !editor.href;
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
          <div className="text-sm text-muted-foreground">iCloud</div>
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
                  {editor.href ? (
                    <button
                      type="button"
                      className="grid size-8 place-items-center text-muted-foreground"
                      aria-label={`Убрать ${p.email}`}
                      onClick={() => unshare.mutate({ href: editor.href!, email: p.email })}
                    >
                      <X className="size-4" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Пока никого. Семья увидит календарь после приглашения.</p>
          )}
          <div className="flex gap-2">
            <Input
              value={editor.emails}
              onChange={(e) => patch({ emails: e.target.value })}
              placeholder="Почта iCloud"
              autoComplete="off"
              inputMode="email"
            />
            <Button
              variant="secondary"
              disabled={!editor.emails.includes("@") || share.isPending}
              onClick={() => {
                if (editor.href) {
                  share.mutate({ href: editor.href, emails: editor.emails, write: editor.allowInvite });
                } else {
                  patch({ emails: editor.emails });
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
            <div className="text-xs text-muted-foreground">Гости пишут события и зовут людей</div>
          </div>
          <Switch checked={editor.allowInvite} onCheckedChange={(v) => patch({ allowInvite: v })} />
        </div>

        <div className="flex min-h-11 items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Общий URL-адрес</div>
            <div className="text-xs text-muted-foreground">Публичная ссылка на календарь</div>
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
              if (!window.confirm(`Удалить календарь «${editor.name}» с iPhone?`)) return;
              remove.mutate(editor.href!);
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
      <SectionLabel>iPhone · iCloud</SectionLabel>
      <p className="text-sm leading-snug text-muted-foreground">
        Пишем в календарь iCloud — iPhone забирает сам. Можно создать новый, выбрать цвет и открыть семье, как
        в приложении Календарь.
      </p>
      {connected ? (
        <p className="text-xs font-semibold text-success">Готово · {status.data?.appleId}</p>
      ) : status.data?.error ? (
        <p className="text-xs text-destructive">{status.data.error}</p>
      ) : (
        <p className="text-xs leading-snug text-muted-foreground">
          appleid.apple.com → Вход и безопасность → Пароли приложений → создать для «Personal AI Hub».
        </p>
      )}

      {!connected || showCreds ? (
        <>
          <Input
            value={appleId}
            onChange={(e) => setAppleId(e.target.value)}
            placeholder="Apple ID · email"
            autoComplete="username"
          />
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Пароль приложения xxxx-xxxx-xxxx-xxxx"
            autoComplete="off"
          />
          <Button variant="solid" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Проверяю iCloud…" : connected ? "Подключить заново" : "Подключить iCloud"}
          </Button>
        </>
      ) : (
        <button type="button" className="text-left text-xs font-semibold text-accent" onClick={() => setShowCreds(true)}>
          Сменить Apple ID
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
                const role = roleLabel(c.href, status.data?.primaryHref, status.data?.familyHref);
                return (
                  <button
                    key={c.href}
                    type="button"
                    className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left"
                    onClick={() => void openEdit(c.href, c.name, c.color)}
                  >
                    <span className="size-3.5 shrink-0 rounded-full" style={{ backgroundColor: c.color || CAL_COLORS[7] }} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{c.name}</div>
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
