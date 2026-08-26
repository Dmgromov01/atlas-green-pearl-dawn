import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  gcalCreateFamily,
  gcalDisconnect,
  gcalSaveCalendars,
  gcalSaveCreds,
  gcalShareFamily,
  gcalStatus,
} from "@/lib/server/gcal";
import { useHub } from "@/lib/stores/hub";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionLabel } from "@/components/shell/page";
import { haptic } from "@/lib/haptic";

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

export function GcalCard() {
  const token = useHub((s) => s.token);
  const [bundle, setBundle] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [primaryId, setPrimaryId] = useState("primary");
  const [familyId, setFamilyId] = useState("");
  const [emails, setEmails] = useState("");

  const status = useQuery({
    queryKey: ["gcal", token],
    queryFn: () => gcalStatus({ data: { token } }),
    enabled: Boolean(token),
    staleTime: 30_000,
  });

  useEffect(() => {
    const d = status.data;
    if (!d || !("connected" in d) || !d.connected) return;
    if (d.primaryId) setPrimaryId(d.primaryId);
    if (d.familyId) setFamilyId(d.familyId);
    if (d.familyEmails?.length) setEmails(d.familyEmails.join(", "));
  }, [status.data]);

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
    onSuccess: (res) => {
      haptic("success");
      toast("Google Календарь подключён");
      setClientSecret("");
      setRefreshToken("");
      setBundle("");
      const family = res.calendars.find((c) => /семь|family/i.test(c.summary));
      const primary = res.calendars.find((c) => c.primary);
      if (primary) setPrimaryId(primary.id);
      if (family) setFamilyId(family.id);
      void status.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pick = useMutation({
    mutationFn: () => gcalSaveCalendars({ data: { token, primaryId, familyId } }),
    onSuccess: () => {
      haptic("success");
      toast("Календари сохранены");
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

  const make = useMutation({
    mutationFn: () => gcalCreateFamily({ data: { token } }),
    onSuccess: (res) => {
      haptic("success");
      toast("Семейный календарь создан");
      setFamilyId(res.familyId);
      void status.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const share = useMutation({
    mutationFn: () => gcalShareFamily({ data: { token, emails } }),
    onSuccess: () => {
      haptic("success");
      toast("Календарь открыт семье — проверьте почту");
      void status.refetch();
    },
    onError: (e: Error) => toast.error(e.message),
  });

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

  return (
    <Card className="space-y-3 p-4">
      <SectionLabel>Google Календарь</SectionLabel>
      <p className="text-sm leading-snug text-muted-foreground">
        Личные события — в твой Google (и на iPhone). Семейные — в общий календарь, без
        подписки Google Family. Семье придёт приглашение, на iPhone календарь можно включить
        в приложении Календарь.
      </p>
      {connected ? (
        <p className="text-xs font-semibold text-accent">
          Подключено{status.data?.email ? ` · ${status.data.email}` : ""}
        </p>
      ) : status.data?.error ? (
        <p className="text-xs text-destructive">{status.data.error}</p>
      ) : null}

      {!connected ? (
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
            {save.isPending ? "Проверяю…" : "Подключить"}
          </Button>
        </>
      ) : (
        <>
          <label className="block text-xs font-bold text-muted-foreground">Мой календарь</label>
          <select
            className="flex h-9 w-full rounded-full border border-border bg-muted px-3.5 text-sm text-foreground"
            value={primaryId}
            onChange={(e) => setPrimaryId(e.target.value)}
          >
            <option value="primary">primary</option>
            {calendars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.summary}
                {c.primary ? " · основной" : ""}
              </option>
            ))}
          </select>
          <label className="block text-xs font-bold text-muted-foreground">Семейный календарь</label>
          <select
            className="flex h-9 w-full rounded-full border border-border bg-muted px-3.5 text-sm text-foreground"
            value={familyId}
            onChange={(e) => setFamilyId(e.target.value)}
          >
            <option value="">Не выбран</option>
            {calendars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.summary}
              </option>
            ))}
          </select>
          <Button variant="secondary" disabled={make.isPending} onClick={() => make.mutate()}>
            {make.isPending ? "Создаю…" : "Создать семейный календарь"}
          </Button>
          <p className="text-xs leading-snug text-muted-foreground">
            Подписка Google Family не нужна. Создаём обычный общий календарь и открываем его
            семье по почте — на iPhone он появится в Календаре.
          </p>
          <Input
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            placeholder="Почты семьи: anna@gmail.com, ivan@icloud.com"
            autoComplete="off"
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="solid" disabled={pick.isPending} onClick={() => pick.mutate()}>
              Сохранить календари
            </Button>
            <Button variant="solid" disabled={share.isPending} onClick={() => share.mutate()}>
              {share.isPending ? "Шлю…" : "Открыть семье"}
            </Button>
            <Button variant="secondary" onClick={() => off.mutate()}>
              Отключить
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
