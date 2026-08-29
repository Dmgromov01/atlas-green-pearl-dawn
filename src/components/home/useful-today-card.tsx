import { useState } from "react";
import { BookOpen, CalendarDays, Wind } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ServiceRow } from "@/components/shell/service-row";
import { useSettings } from "@/lib/stores/settings";
import { getAirQuality, getNextHoliday, wikipediaSummary } from "@/lib/server/free-apis";

function airTone(label?: string) {
  if (label === "хороший") return "text-emerald-600 dark:text-emerald-400";
  if (label === "умеренный") return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

export function UsefulTodayCard() {
  const city = useSettings((s) => s.city);
  const [query, setQuery] = useState("");
  const [wikiTitle, setWikiTitle] = useState("");
  const air = useQuery({
    queryKey: ["air-quality", city?.lat, city?.lon],
    queryFn: () => getAirQuality({ data: { lat: city!.lat, lon: city!.lon } }),
    enabled: Boolean(city),
    staleTime: 15 * 60_000,
    retry: 1,
  });
  const holiday = useQuery({
    queryKey: ["next-holiday", city?.country || "RU"],
    queryFn: () => getNextHoliday({ data: { countryCode: "RU" } }),
    staleTime: 24 * 60 * 60_000,
    retry: 1,
  });
  const wiki = useQuery({
    queryKey: ["wikipedia", wikiTitle],
    queryFn: () => wikipediaSummary({ data: { title: wikiTitle } }),
    enabled: wikiTitle.length >= 2,
    staleTime: 24 * 60 * 60_000,
    retry: 1,
  });

  return (
    <Card className="space-y-3 p-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <ServiceRow
          icon={<Wind className="size-4" />}
          title="Качество воздуха"
          status={air.isPending ? "обновляю…" : air.data ? air.data.label : "нет данных"}
        />
        {air.data?.aqi !== null && air.data?.aqi !== undefined ? (
          <div className={`px-3 text-sm font-semibold ${airTone(air.data.label)}`}>
            AQI {air.data.aqi} · PM2.5 {air.data.pm25 ?? "—"}
          </div>
        ) : null}
      </div>
      <ServiceRow
        icon={<CalendarDays className="size-4" />}
        title="Ближайший праздник"
        status={holiday.data ? holiday.data.date : holiday.isPending ? "проверяю…" : "нет данных"}
      />
      {holiday.data ? <p className="px-3 text-sm font-semibold">{holiday.data.localName}</p> : null}
      <div className="border-t border-border pt-3">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <BookOpen className="size-4" /> Узнать о чём-то
        </div>
        <div className="flex gap-2">
          <Input
            value={query}
            maxLength={120}
            placeholder="Например, Кусково или Сахалин"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") setWikiTitle(query.trim());
            }}
          />
          <Button variant="secondary" onClick={() => setWikiTitle(query.trim())} disabled={query.trim().length < 2}>
            Найти
          </Button>
        </div>
        {wiki.data ? (
          <div className="mt-3 space-y-1 text-sm">
            <a className="font-semibold text-accent underline" href={wiki.data.url} target="_blank" rel="noreferrer">
              {wiki.data.title}
            </a>
            <p className="leading-snug text-muted-foreground">{wiki.data.extract}</p>
          </div>
        ) : wikiTitle && !wiki.isPending ? (
          <p className="mt-2 text-xs text-muted-foreground">Статья не найдена.</p>
        ) : null}
      </div>
    </Card>
  );
}
