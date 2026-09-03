import { useMemo } from "react";
import { CloudSun, Droplets, Wind } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getWeather, type WeatherNow } from "@/lib/server/weather";
import { temperaturePoints } from "@/lib/weather/forecast";
import { useSettings } from "@/lib/stores/settings";
import { readCache, writeCache } from "@/lib/local-cache";
import type { City } from "@/lib/hub/types";

function validCity(city: City | null | undefined): City | null {
  const lat = Number(city?.lat);
  const lon = Number(city?.lon);
  return city && Number.isFinite(lat) && Number.isFinite(lon) && city.tz ? city : null;
}

function timeLabel(time: string, tz: string) {
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz }).format(new Date(time));
}

function dayLabel(time: string, tz: string) {
  return new Intl.DateTimeFormat("ru-RU", { weekday: "short", timeZone: tz }).format(new Date(time));
}

function aqiLabel(aqi: number) {
  if (aqi <= 20) return "хороший";
  if (aqi <= 40) return "нормальный";
  if (aqi <= 60) return "умеренный";
  if (aqi <= 80) return "плохой";
  return "очень плохой";
}

export function WeatherTrend() {
  const city = validCity(useSettings((s) => s.city));
  const cacheKey = city ? `wx24:${city.lat.toFixed(3)},${city.lon.toFixed(3)}` : "wx24:none";
  const cached = city ? readCache<WeatherNow>(cacheKey, 12 * 60 * 60_000) : undefined;
  const weather = useQuery({
    queryKey: ["weather", "home", city?.lat, city?.lon, city?.tz],
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
  const data = weather.data;
  const hours = useMemo(() => data?.hourly ?? [], [data?.hourly]);
  const points = useMemo(() => temperaturePoints(hours), [hours]);
  const min = hours.length ? Math.min(...hours.map((hour) => hour.temp)) : null;
  const max = hours.length ? Math.max(...hours.map((hour) => hour.temp)) : null;
  const labels = hours.filter((_, index) => index % 6 === 0 || index === hours.length - 1);

  if (!city) return <section className="weather-panel weather-panel--empty">Выберите город в настройках, чтобы увидеть прогноз.</section>;
  if (!data) return <section className="weather-panel weather-panel--empty">{weather.isError ? "Не удалось загрузить погоду" : "Загружаем прогноз…"}</section>;

  return (
    <section className="weather-panel" aria-label={`Погода в городе ${data.city}: ${data.temp} градусов, ${data.condition}`}>
      <div className="weather-panel__head">
        <div><span className="weather-panel__city">{data.city}</span><strong><CloudSun aria-hidden="true" />{data.temp}°</strong></div>
        <div className="weather-panel__facts"><span>{data.condition}</span><span><Wind aria-hidden="true" />{data.wind} м/с</span>{data.aqi !== null ? <span>AQI {data.aqi} · {aqiLabel(data.aqi)}</span> : null}</div>
      </div>
      <div className="weather-chart">
        <svg viewBox="0 0 360 72" preserveAspectRatio="none" aria-hidden="true"><polygon points={`${points} 360,72 0,72`} /><polyline points={points} /></svg>
        <div className="weather-chart__range"><span>{max}°</span><span>следующие 24 часа</span><span>{min}°</span></div>
        <div className="weather-chart__labels">{labels.map((hour, index) => <span key={hour.time}>{index === 0 ? "сейчас" : `${dayLabel(hour.time, city.tz)} ${timeLabel(hour.time, city.tz)}`}</span>)}</div>
      </div>
      <div className="weather-panel__source">Данные: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a>{data.aqi !== null ? <> · <a href="https://ads.atmosphere.copernicus.eu/" target="_blank" rel="noreferrer">CAMS</a></> : null}</div>
      <div className="weather-hours" aria-label="Почасовой прогноз">
        {hours.map((hour, index) => <div className="weather-hour" key={hour.time}>
          <time dateTime={hour.time}>{index === 0 ? "сейчас" : timeLabel(hour.time, city.tz)}</time><strong>{hour.temp}°</strong>
          <span><Droplets aria-hidden="true" />{hour.precipChance !== null ? `${Math.round(hour.precipChance)}%` : `${hour.precip.toFixed(1)} мм`}</span>
          <span><Wind aria-hidden="true" />{hour.wind !== null ? `${Math.round(hour.wind)} м/с` : "—"}</span>
        </div>)}
      </div>
    </section>
  );
}
