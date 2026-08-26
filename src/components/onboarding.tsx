import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { searchCities } from "@/lib/server/weather";
import { MOSCOW, useSettings } from "@/lib/stores/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { haptic } from "@/lib/haptic";
import { APP_NAME } from "@/lib/brand";
import { BrandMark } from "@/components/brand-mark";
import type { City } from "@/lib/hub/types";
import { telegramUserName } from "@/lib/telegram/webapp";

export function Onboarding() {
  const completeOnboarding = useSettings((s) => s.completeOnboarding);
  const [name, setName] = useState(() => telegramUserName());
  const [query, setQuery] = useState("Москва");
  const [city, setLocalCity] = useState<City>(MOSCOW);
  const search = useMutation({
    mutationFn: (q: string) => searchCities({ data: { q } }),
  });

  useEffect(() => {
    if (name) return;
    const n = telegramUserName();
    if (n) setName(n);
  }, [name]);

  const finish = () => {
    const n = name.trim().slice(0, 40) || "Гость";
    completeOnboarding(n, city);
    try {
      haptic("success");
    } catch {
      /* ignore */
    }
  };

  return (
    <form
      className="mx-auto flex min-h-dvh max-w-lg flex-col px-5 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-8"
      onSubmit={(e) => {
        e.preventDefault();
        finish();
      }}
    >
      <BrandMark size={72} className="mx-auto" />
      <h1 className="mt-3 text-center text-3xl font-semibold tracking-tight text-foreground">{APP_NAME}</h1>
      <p className="mx-auto mt-1 max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
        Погода, курсы, задачи, дайджест и переводчик.
      </p>
      <div className="mt-5 space-y-3">
        <label className="block text-xs font-semibold text-muted-foreground" htmlFor="onboard-name">
          Как к вам обращаться
        </label>
        <Input
          id="onboard-name"
          name="displayName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Имя"
          autoFocus
          autoComplete="nickname"
        />
        <label className="block pt-1 text-xs font-semibold text-muted-foreground" htmlFor="onboard-city">
          Город для погоды
        </label>
        <div className="flex gap-2">
          <Input
            id="onboard-city"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти город"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={() => search.mutate(query)}
          >
            Найти
          </Button>
        </div>
        <div className="max-h-40 space-y-1 overflow-y-auto">
          <button
            type="button"
            onClick={() => {
              setLocalCity(MOSCOW);
              setQuery(MOSCOW.name);
            }}
            className="w-full rounded-full border border-border bg-card px-3 py-2.5 text-left text-sm font-medium"
          >
            {city.name === MOSCOW.name ? "Выбрано: " : ""}
            Москва
          </button>
          {(search.data ?? []).slice(0, 5).map((c) => (
            <button
              key={`${c.lat}-${c.lon}`}
              type="button"
              onClick={() => {
                setLocalCity({
                  name: c.name,
                  lat: c.lat,
                  lon: c.lon,
                  tz: c.tz,
                  country: c.country,
                });
                setQuery(c.name);
              }}
              className="w-full rounded-full border border-border bg-muted px-3 py-2.5 text-left text-sm"
            >
              {c.name}
              {c.admin ? `, ${c.admin}` : ""}
              {c.country ? ` · ${c.country}` : ""}
            </button>
          ))}
        </div>
      </div>
      <Button type="submit" className="sticky bottom-20 z-30 mt-6 h-12 w-full">
        Продолжить
      </Button>
    </form>
  );
}
