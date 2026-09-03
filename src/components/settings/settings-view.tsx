import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { HeartPulse, Newspaper, RefreshCw, Shield } from "lucide-react";
import { searchCities } from "@/lib/server/weather";
import { fetchIcsFeed } from "@/lib/server/ics";
import { useSettings } from "@/lib/stores/settings";
import { useTasks } from "@/lib/stores/tasks";
import { useCalendar } from "@/lib/stores/calendar";
import { useDictionary } from "@/lib/stores/dictionary";
import { useSources } from "@/lib/stores/sources";
import { useInbox } from "@/lib/stores/inbox";
import { useChat } from "@/lib/stores/chat";
import { useHub } from "@/lib/stores/hub";
import { hubLogout } from "@/lib/server/hub-auth";
import { AppShell } from "@/components/shell/app-shell";
import { Header } from "@/components/shell/header";
import { Page, SectionLabel } from "@/components/shell/page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ServiceRow } from "@/components/shell/service-row";
import { AiAccessCard } from "@/components/settings/ai-access";
import { GcalCard } from "@/components/settings/gcal-card";
import { FamilyCard } from "@/components/settings/family-card";
import { PasskeysCard } from "@/components/settings/passkeys-card";
import { HomeScreenCard } from "@/components/settings/home-screen-card";
import { haptic } from "@/lib/haptic";
import { HUB_MODULES } from "@/lib/hub/registry";
import type { HubModuleId } from "@/lib/hub/types";
import { refreshHubData } from "@/lib/server/live";
import { useLive } from "@/lib/live/status";
import { queryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";
import { locateCity } from "@/lib/geo";

export function SettingsView() {
  const navigate = useNavigate();
  const s = useSettings();
  const hub = useHub();
  const live = useLive();
  const [name, setName] = useState(hub.user?.displayName || s.displayName);
  const [q, setQ] = useState(s.city?.name ?? "");
  const search = useMutation({
    mutationFn: (query: string) => searchCities({ data: { q: query } }),
  });
  const ics = useQuery({
    queryKey: ["ics", s.icsUrl],
    queryFn: () => fetchIcsFeed({ data: { url: s.icsUrl } }),
    enabled: Boolean(s.icsUrl.trim()),
    staleTime: 10 * 60_000,
  });

  const saveName = () => {
    s.setDisplayName(name.trim().slice(0, 40) || "Гость");
    haptic("success");
    toast("Имя на этом устройстве сохранено");
  };

  const setTheme = (theme: "light" | "dark" | "system") => {
    s.setTheme(theme);
    haptic();
  };

  const toggleModule = (id: HubModuleId) => {
    const current = s.enabledModules === "all" ? HUB_MODULES.map((m) => m.id) : [...s.enabledModules];
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    const core: HubModuleId[] = ["home", "settings"];
    const merged = Array.from(new Set([...core, ...next]));
    s.setEnabledModules(merged.length >= HUB_MODULES.length ? "all" : merged);
    haptic();
  };

  const enabled = (id: HubModuleId) => s.enabledModules === "all" || s.enabledModules.includes(id);

  const signOut = async () => {
    await hubLogout({ data: { token: hub.token } }).catch(() => {});
    hub.clear();
    haptic();
    toast("Сессия закрыта");
  };

  const wipe = async () => {
    if (!window.confirm("Сбросить имя, задачи, календарь и словарь на этом устройстве?")) return;
    await hubLogout({ data: { token: hub.token } }).catch(() => {});
    useTasks.getState().reset();
    useCalendar.getState().reset();
    useDictionary.getState().reset();
    useSources.getState().reset();
    useInbox.getState().reset();
    useChat.getState().reset();
    hub.clear();
    s.resetAll();
    haptic("heavy");
    toast("Данные сброшены");
  };

  return (
    <AppShell>
      <Header title="Настройки" subtitle="Профиль и доступ" backTo="/" />
      <Page>
        {hub.user?.role === "admin" ? (
          <Card>
            <ServiceRow
              icon={<Shield className="size-4" />}
              title="Админ-панель"
              status="Семья, инвайты, аудит"
              onClick={() => {
                haptic();
                navigate({ to: "/admin" });
              }}
            />
          </Card>
        ) : null}

        <Card>
          <ServiceRow
            icon={<HeartPulse className="size-4" />}
            title="Состояние системы"
            status="Календари, шлюз, лента агента"
            onClick={() => {
              haptic();
              navigate({ to: "/status" });
            }}
          />
        </Card>

        <Card className="space-y-3 p-4">
          <SectionLabel>Профиль</SectionLabel>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя" />
          <Button variant="secondary" onClick={saveName}>
            Сохранить имя
          </Button>
        </Card>

        <PasskeysCard />

        <AiAccessCard />

        <FamilyCard />

        <GcalCard />

        <Card>
          <ServiceRow
            icon={<Newspaper className="size-4" />}
            title="Настройки дайджеста"
            status="Источники, RSS, сколько материалов читать"
            onClick={() => {
              haptic();
              navigate({ to: "/sources" });
            }}
          />
        </Card>

        <Card className="space-y-3 p-4">
          <SectionLabel>Календарь iCal</SectionLabel>
          <p className="text-sm text-muted-foreground">
            Секретная ссылка Google Календаря или экспорт CalDAV (HTTPS .ics).
          </p>
          <Input
            value={s.icsUrl ?? ""}
            onChange={(e) => s.setIcsUrl(e.target.value)}
            onBlur={(e) => s.setIcsUrl(e.target.value.trim())}
            placeholder="https://calendar.google.com/calendar/ical/…"
            inputMode="url"
            autoComplete="off"
          />
          {s.icsUrl.trim() ? (
            <p className="text-xs text-muted-foreground">
              {ics.isFetching
                ? "Читаю календарь…"
                : ics.data?.error
                  ? ics.data.error
                  : `${ics.data?.events.length ?? 0} событий загружено`}
            </p>
          ) : null}
        </Card>

        <Card className="space-y-3 p-4">
          <SectionLabel>Утро / вечер в Telegram</SectionLabel>
          <p className="text-sm text-muted-foreground">
            Сводка, пока хаб открыт. Точечные напоминания — отдельной карточкой на главной.
          </p>
          {(
            [
              ["morning", "Утренняя сводка"],
              ["events", "За 15 минут до события"],
              ["evening", "Вечер: незакрытые задачи"],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="flex min-h-11 items-center justify-between gap-3">
              <div className="text-sm font-semibold">{label}</div>
              <Switch
                checked={Boolean((s.reminders ?? { morning: true, events: true, evening: true })[key])}
                onCheckedChange={(v) => s.setReminders({ [key]: v })}
              />
            </div>
          ))}
        </Card>

        <Card className="space-y-3 p-4">
          <SectionLabel>Тема</SectionLabel>
          <div className="seg">
            {(["light", "dark", "system"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={`seg__btn ${s.theme === t ? "is-on" : ""}`}
              >
                {t === "light" ? "Светлая" : t === "dark" ? "Тёмная" : "Система"}
              </button>
            ))}
          </div>
        </Card>

        <Card className="space-y-3 p-4">
          <SectionLabel>Город</SectionLabel>
          <p className="text-sm text-muted-foreground">
            {s.city ? `Сейчас: ${s.city.name}` : "Определяется по геолокации"}
          </p>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              void locateCity()
                .then((city) => {
                  s.setCity(city);
                  setQ(city.name);
                  toast("Место обновлено");
                })
                .catch(() => toast.error("Геолокация недоступна"));
            }}
          >
            Моё место
          </Button>
          <div className="flex gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти город" />
            <Button variant="secondary" onClick={() => search.mutate(q)}>
              Найти
            </Button>
          </div>
          {(search.data ?? []).map((c) => (
            <button
              key={`${c.lat}-${c.lon}`}
              type="button"
              className="min-h-10 w-full rounded-md bg-muted px-3 py-2 text-left text-sm"
              onClick={() => {
                s.setCity({ name: c.name, lat: c.lat, lon: c.lon, tz: c.tz, country: c.country });
                setQ(c.name);
                toast("Город обновлён");
              }}
            >
              {c.name}
              {c.admin ? `, ${c.admin}` : ""}
            </button>
          ))}
        </Card>

        <Card className="space-y-1 p-4">
          <SectionLabel className="mb-2">Модули</SectionLabel>
          {HUB_MODULES.filter((m) => !["home", "settings", "admin", "chat", "status"].includes(m.id)).map((m) => (
            <div key={m.id} className="flex min-h-11 items-center justify-between gap-3 py-2">
              <div>
                <div className="text-sm font-semibold">{m.title}</div>
                <div className="text-xs text-muted-foreground">{m.description}</div>
              </div>
              <Switch checked={enabled(m.id)} onCheckedChange={() => toggleModule(m.id)} />
            </div>
          ))}
        </Card>

        <Card className="space-y-3 p-4">
          <SectionLabel>Данные</SectionLabel>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                live.status === "on"
                  ? "bg-emerald-500"
                  : live.status === "retry"
                    ? "bg-amber-400"
                    : "bg-muted-foreground/40",
              )}
              aria-hidden
            />
            <p className="text-sm leading-relaxed text-muted-foreground">
              {live.status === "on"
                ? "Онлайн — погода, календарь и семья обновляются сразу."
                : live.status === "retry"
                  ? "Переподключаюсь. Пока обновляю по таймеру."
                  : "Задачи и Inbox на устройстве. Сессия — в httpOnly-куке."}
            </p>
          </div>
          <Button
            variant="secondary"
            className="w-full"
            onClick={async () => {
              haptic();
              try {
                await refreshHubData({ data: { tags: ["weather", "rates", "digest", "ics"] } });
                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: ["weather"] }),
                  queryClient.invalidateQueries({ queryKey: ["rates"] }),
                  queryClient.invalidateQueries({ queryKey: ["digest"] }),
                  queryClient.invalidateQueries({ queryKey: ["brief"] }),
                  queryClient.invalidateQueries({ queryKey: ["ics"] }),
                ]);
                toast("Данные обновлены");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Не удалось обновить");
              }
            }}
          >
            <RefreshCw className="size-4" />
            Обновить сейчас
          </Button>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Задачи, Inbox и календарь на устройстве. Сессия, ключи и аудит — на сервере.
          </p>
          {hub.token ? (
            <Button variant="secondary" className="w-full" onClick={() => void signOut()}>
              Выйти
            </Button>
          ) : null}
          <Button variant="outline" className="w-full text-destructive" onClick={() => void wipe()}>
            Сбросить локальные данные
          </Button>
        </Card>
        <HomeScreenCard />
      </Page>
    </AppShell>
  );
}
