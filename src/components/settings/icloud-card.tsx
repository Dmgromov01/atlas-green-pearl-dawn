import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  icloudDisconnect,
  icloudSave,
  icloudSaveCalendars,
  icloudStatus,
} from "@/lib/server/icloud";
import { useHub } from "@/lib/stores/hub";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionLabel } from "@/components/shell/page";
import { haptic } from "@/lib/haptic";

export function IcloudCard() {
  const token = useHub((s) => s.token);
  const [appleId, setAppleId] = useState("");
  const [password, setPassword] = useState("");
  const [primaryHref, setPrimaryHref] = useState("");
  const [familyHref, setFamilyHref] = useState("");

  const status = useQuery({
    queryKey: ["icloud", token],
    queryFn: () => icloudStatus({ data: { token } }),
    enabled: Boolean(token),
    staleTime: 30_000,
  });

  useEffect(() => {
    const d = status.data;
    if (!d?.connected) return;
    if (d.primaryHref) setPrimaryHref(d.primaryHref);
    if (d.familyHref) setFamilyHref(d.familyHref);
    if (d.appleId) setAppleId(d.appleId);
  }, [status.data]);

  const save = useMutation({
    mutationFn: () => icloudSave({ data: { token, appleId, password } }),
    onSuccess: (res) => {
      haptic("success");
      toast("iCloud подключён — события пойдут на iPhone");
      setPassword("");
      if (res.primaryHref) setPrimaryHref(res.primaryHref);
      if (res.familyHref) setFamilyHref(res.familyHref);
      void status.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pick = useMutation({
    mutationFn: () => icloudSaveCalendars({ data: { token, primaryHref, familyHref } }),
    onSuccess: () => {
      haptic("success");
      toast("Календари iCloud сохранены");
      void status.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const off = useMutation({
    mutationFn: () => icloudDisconnect({ data: { token } }),
    onSuccess: () => {
      haptic();
      toast("iCloud отключён");
      void status.refetch();
    },
  });

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

  return (
    <Card className="space-y-3 p-4">
      <SectionLabel>iPhone · iCloud</SectionLabel>
      <p className="text-sm leading-snug text-muted-foreground">
        Пишем в календарь iCloud — iPhone забирает сам. К каждому событию ставим напоминания
        за час и за 15 минут. На iPhone: Настройки → Уведомления → Календарь — разрешить.
      </p>
      <p className="text-xs leading-snug text-muted-foreground">
        appleid.apple.com → Вход и безопасность → Пароли приложений → создать для «Personal AI Hub».
      </p>
      {connected ? (
        <p className="text-xs font-semibold text-accent">Подключено · {status.data?.appleId}</p>
      ) : status.data?.error ? (
        <p className="text-xs text-destructive">{status.data.error}</p>
      ) : null}

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

      {connected ? (
        <>
          <label className="block text-xs font-bold text-muted-foreground">Мой календарь</label>
          <select
            className="flex h-9 w-full rounded-full border border-border bg-muted px-3.5 text-sm text-foreground"
            value={primaryHref}
            onChange={(e) => setPrimaryHref(e.target.value)}
          >
            <option value="">Не выбран</option>
            {calendars.map((c) => (
              <option key={c.href} value={c.href}>
                {c.name}
                {c.family ? " · семья" : ""}
              </option>
            ))}
          </select>
          <label className="block text-xs font-bold text-muted-foreground">Семейный календарь</label>
          <select
            className="flex h-9 w-full rounded-full border border-border bg-muted px-3.5 text-sm text-foreground"
            value={familyHref}
            onChange={(e) => setFamilyHref(e.target.value)}
          >
            <option value="">Нет</option>
            {calendars.map((c) => (
              <option key={c.href} value={c.href}>
                {c.name}
                {c.family ? " · семья" : ""}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2">
            <Button variant="solid" disabled={pick.isPending} onClick={() => pick.mutate()}>
              Сохранить
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
