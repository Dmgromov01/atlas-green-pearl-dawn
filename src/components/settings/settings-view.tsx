import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Shield, Newspaper, RefreshCw } from "lucide-react";
import { searchCities } from "@/lib/server/weather";
import { fetchIcsFeed } from "@/lib/server/ics";
import { hashPin, MOSCOW, useSettings } from "@/lib/stores/settings";
import { useTasks } from "@/lib/stores/tasks";
import { useCalendar } from "@/lib/stores/calendar";
import { useDictionary } from "@/lib/stores/dictionary";
import { useSources } from "@/lib/stores/sources";
import { useInbox } from "@/lib/stores/inbox";
import { useChat } from "@/lib/stores/chat";
import { lockSession, unlockSession } from "@/lib/pin-session";
import { useHub } from "@/lib/stores/hub";
import { hubClearPin, hubLogout, hubSetPin } from "@/lib/server/hub-auth";
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
import { IcloudCard } from "@/components/settings/icloud-card";
import { FamilyCard } from "@/components/settings/family-card";
import { HomeScreenCard } from "@/components/settings/home-screen-card";
import { haptic } from "@/lib/haptic";
import { HUB_MODULES } from "@/lib/hub/registry";
import type { HubModuleId } from "@/lib/hub/types";
import { refreshHubData } from "@/lib/server/live";
import { useLive } from "@/lib/live/status";
import { queryClient } from "@/lib/query-client";
import { cn } from "@/lib/utils";

export function SettingsView() {
  const navigate = useNavigate();
  const s = useSettings();
  const hub = useHub();
  const live = useLive();
  const [name, setName] = useState(s.displayName);
  const [q, setQ] = useState(s.city.name);
  const [pin, setPin] = useState("");
  const search = useMutation({
    mutationFn: (query: string) => searchCities({ data: { q } }),
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
    toast("Имя сохранено");
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
    if (hub.token) await hubLogout({ data: { token: hub.token } }).catch(() => {});
    hub.clear();
    haptic();
    toast("Сессия закрыта");
  };

  const wipe = async () => {
    if (!window.confirm("Сбросить имя, PIN, задачи, календарь и словарь на этом устройстве?")) return;
    if (hub.token) await hubLogout({ data: { token: hub.token } }).catch(() => {});
    useTasks.getState().reset();
    useCalendar.getState().reset();
    useDictionary.getState().reset();
    useSources.getState().reset();
    useInbox.getState().reset();
    useChat.getState().reset();
    lockSession();
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
              status="Пользователи, общий AI, аудит"
              onClick={() => {
                haptic();
                navigate({ to: "/admin" });
              }}
            />
          </Card>
        ) : null}

        <Card className="space-y-3 p-4">
          <SectionLabel>Профиль</SectionLabel>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Имя" />
          <Button variant="secondary" onClick={saveName}>
            Сохранить имя
          </Button>
        </Card>

        <HomeScreenCard />

        <AiAccessCard />

        <IcloudCard />

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
          <SectionLabel>Напоминания в Telegram</SectionLabel>
          <p className="text-sm text-muted-foreground">
            Бот пишет, когда хаб открыт: утром, за 15 минут до события и вечером. Нужен вход через Telegram.
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
          <div className="flex gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Найти город" />
            <Button variant="secondary" onClick={() => search.mutate(q)}>
              Найти
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Сейчас: {s.city.name}</p>
          <button
            type="button"
            className="w-full rounded-full bg-muted px-3 py-2 text-left text-sm"
            onClick={() => {
              s.setCity(MOSCOW);
              setQ(MOSCOW.name);
            }}
          >
            Москва
          </button>
          {(search.data ?? []).map((c) => (
            <button
              key={`${c.lat}-${c.lon}`}
              type="button"
              className="w-full rounded-full bg-muted px-3 py-2 text-left text-sm"
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

        <Card className="space-y-3 p-4">
          <SectionLabel>PIN</SectionLabel>
          <p className="text-sm leading-relaxed text-muted-foreground">
            4–8 цифр. Запасной вход, если в Telegram WebView нет биометрии. Хеш на устройстве и на сервере.
          </p>
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            placeholder="4–8 цифр"
          />
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={pin.length < 4}
              onClick={async () => {
                const { salt, hash } = await hashPin(pin);
                s.setPin(salt, hash);
                unlockSession();
                if (hub.token) {
                  try {
                    await hubSetPin({ data: { token: hub.token, pin } });
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "PIN на сервер не ушёл");
                  }
                }
                setPin("");
                toast("Код установлен");
              }}
            >
              Установить
            </Button>
            {s.pinHash ? (
              <Button
                variant="outline"
                onClick={async () => {
                  s.clearPin();
                  if (hub.token) await hubClearPin({ data: { token: hub.token } }).catch(() => {});
                  toast("Код снят");
                }}
              >
                Снять
              </Button>
            ) : null}
          </div>
          {s.pinHash ? (
            <Button
              variant="secondary"
              onClick={() => {
                lockSession();
                window.location.reload();
              }}
            >
              Заблокировать сейчас
            </Button>
          ) : null}
        </Card>

        <Card className="space-y-1 p-4">
          <SectionLabel className="mb-2">Модули</SectionLabel>
          {HUB_MODULES.filter((m) => !["home", "settings", "admin", "chat"].includes(m.id)).map((m) => (
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
                ? "Онлайн — погода, курсы, календарь и семья обновляются сразу."
                : live.status === "retry"
                  ? "Переподключаюсь. Пока обновляю по таймеру."
                  : "Задачи и Inbox на устройстве. Сессия — на сервере."}
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
      </Page>
    </AppShell>
  );
}
