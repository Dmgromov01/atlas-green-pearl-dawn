import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getWeather, type WeatherNow } from "@/lib/server/weather";
import { useSettings } from "@/lib/stores/settings";
import { readCache, writeCache } from "@/lib/local-cache";
import { locateCity } from "@/lib/geo";
import { formatTime } from "@/lib/utils";
import type { City } from "@/lib/hub/types";

function validCity(city: City | null | undefined): City | null {
  const lat = Number(city?.lat);
  const lon = Number(city?.lon);
  if (city && Number.isFinite(lat) && Number.isFinite(lon) && city.tz) return city;
  return null;
}

export function WeatherChip() {
  const rawCity = useSettings((s) => s.city);
  const setCity = useSettings((s) => s.setCity);
  const city = validCity(rawCity);
  const [now, setNow] = useState(() => formatTime(new Date()));

  useEffect(() => {
    const id = window.setInterval(() => setNow(formatTime(new Date())), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (city) return;
    let cancelled = false;
    locateCity()
      .then((next) => {
        if (!cancelled) setCity(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [city, setCity]);

  const cacheKey = city ? `wx:${city.lat.toFixed(3)},${city.lon.toFixed(3)}` : "wx:none";
  const cached = city ? readCache<WeatherNow>(cacheKey, 12 * 60 * 60_000) : undefined;
  const q = useQuery({
    queryKey: ["weather", "chip", city?.lat, city?.lon, city?.tz],
    queryFn: async () => {
      if (!city) throw new Error("no-city");
      const data = await getWeather({ data: { lat: city.lat, lon: city.lon, tz: city.tz, city: city.name } });
      writeCache(cacheKey, data);
      return data;
    },
    enabled: Boolean(city),
    staleTime: 20 * 60_000,
    placeholderData: cached,
    retry: 1,
  });

  const temp = q.data ? `${q.data.temp}°` : "·°";
  const icon = q.data?.icon;

  return (
    <div
      className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-foreground"
      aria-label={q.data ? `Сейчас ${q.data.temp}°, ${now}` : "Погода"}
    >
      {icon ? (
        <img src={`/weather-icons/meteocons/${icon}.svg`} alt="" className="size-4" />
      ) : null}
      <span className="text-sm font-semibold tabular-nums">{temp}</span>
      <span className="text-xs font-medium text-muted-foreground tabular-nums">{now}</span>
    </div>
  );
}
