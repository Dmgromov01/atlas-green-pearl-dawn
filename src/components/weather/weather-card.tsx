import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getWeather, type WeatherNow } from "@/lib/server/weather";
import { useSettings } from "@/lib/stores/settings";
import { hourInTz } from "@/lib/weather/codes";
import type { City } from "@/lib/hub/types";
import { readCache, writeCache } from "@/lib/local-cache";
import { locateCity } from "@/lib/geo";

function hourLabel(iso: string, tz: string) {
  return String(hourInTz(iso, tz)).padStart(2, "0");
}

function validCity(city: City | null | undefined): City | null {
  const lat = Number(city?.lat);
  const lon = Number(city?.lon);
  if (city && Number.isFinite(lat) && Number.isFinite(lon) && city.tz) return city;
  return null;
}

function Hourly({ data, tz }: { data: WeatherNow; tz: string }) {
  return (
    <div className="weather-card__hourly">
      {data.hourly.slice(0, 12).map((h) => (
        <div key={h.time} className="weather-card__hour">
          <span className="weather-card__hour-time">{hourLabel(h.time, tz)}</span>
          <img src={`/weather-icons/meteocons/${h.icon}.svg`} alt="" className="weather-card__hour-ic" />
          <span className="weather-card__hour-temp">{Math.round(h.temp)}°</span>
        </div>
      ))}
    </div>
  );
}

function Shell({
  children,
  tone = "cloud",
  label,
}: {
  children: ReactNode;
  tone?: string;
  label: string;
}) {
  return (
    <div className="weather-card-wrap mx-4 sm:mx-6 overflow-hidden rounded-2xl">
      <section className="weather-card rounded-2xl" data-tone={tone} aria-label={label}>
        {children}
      </section>
    </div>
  );
}

export function WeatherCard() {
  const rawCity = useSettings((s) => s.city);
  const setCity = useSettings((s) => s.setCity);
  const city = validCity(rawCity);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (city) return;
    let cancelled = false;
    locateCity()
      .then((next) => {
        if (!cancelled) setCity(next);
      })
      .catch(() => {
        if (!cancelled) setDenied(true);
      });
    return () => {
      cancelled = true;
    };
  }, [city, setCity]);

  const cacheKey = city ? `wx:${city.lat.toFixed(3)},${city.lon.toFixed(3)}` : "wx:none";
  const cached = city ? readCache<WeatherNow>(cacheKey, 12 * 60 * 60_000) : undefined;
  const q = useQuery({
    queryKey: ["weather", "v3", city?.lat, city?.lon, city?.tz],
    queryFn: async () => {
      if (!city) throw new Error("no-city");
      const data = await getWeather({ data: { lat: city.lat, lon: city.lon, tz: city.tz, city: city.name } });
      writeCache(cacheKey, data);
      return data;
    },
    enabled: Boolean(city),
    staleTime: 20 * 60_000,
    gcTime: 12 * 60 * 60_000,
    retry: 1,
    retryDelay: 400,
    placeholderData: (prev) => prev ?? cached,
  });

  if (!city) {
    return (
      <Shell label="Погода">
        <div className="weather-card__now">
          <div className="weather-card__city">Погода</div>
          <div className="weather-card__temp">··</div>
          <div className="weather-card__meta">{denied ? "нужна геолокация" : "определяю место"}</div>
        </div>
        {denied ? (
          <button
            type="button"
            className="weather-card__retry"
            onClick={() => {
              setDenied(false);
              void locateCity()
                .then(setCity)
                .catch(() => setDenied(true));
            }}
          >
            Разрешить
          </button>
        ) : null}
      </Shell>
    );
  }

  if (q.isLoading && !q.data) {
    return (
      <Shell label="Загрузка погоды">
        <div className="weather-card__now">
          <div className="weather-card__city">{city.name}</div>
          <div className="weather-card__temp">··</div>
          <div className="weather-card__meta">обновляю погоду</div>
        </div>
      </Shell>
    );
  }

  if (q.isError && !q.data) {
    return (
      <Shell label="Погода недоступна">
        <div className="weather-card__now">
          <div className="weather-card__city">{city.name}</div>
          <div className="weather-card__temp">—</div>
          <div className="weather-card__meta">нет сети</div>
        </div>
        <button type="button" className="weather-card__retry" onClick={() => void q.refetch()}>
          Обновить
        </button>
      </Shell>
    );
  }

  const w = q.data!;
  return (
    <Shell tone={w.tone} label={`Погода в ${w.city}`}>
      <img className="weather-card__art" src={`/weather-icons/hero/${w.hero}?v=3`} alt="" decoding="async" />
      <div className="weather-card__body">
        <div className="weather-card__now">
          <div className="weather-card__city">{w.city}</div>
          <div className="weather-card__temp">
            {w.temp}
            <sup>°</sup>
          </div>
          <div className="weather-card__meta">
            {w.condition} · {w.wind} м/с
          </div>
        </div>
        <Hourly data={w} tz={city.tz} />
      </div>
    </Shell>
  );
}
