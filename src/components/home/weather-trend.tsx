import { useMemo } from "react";
import { CloudSun } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getWeather, type WeatherNow } from "@/lib/server/weather";
import { useSettings } from "@/lib/stores/settings";
import { readCache, writeCache } from "@/lib/local-cache";
import type { City } from "@/lib/hub/types";

function validCity(city: City | null | undefined): City | null {
  const lat = Number(city?.lat);
  const lon = Number(city?.lon);
  return city && Number.isFinite(lat) && Number.isFinite(lon) && city.tz ? city : null;
}

export function WeatherTrend() {
  const city = validCity(useSettings((s) => s.city));
  const cacheKey = city ? `wx:${city.lat.toFixed(3)},${city.lon.toFixed(3)}` : "wx:none";
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
  const temp = weather.data?.temp ?? 25;
  const ariaLabel = `Погода: ${temp} градусов, качество воздуха AQI 38`;
  const points = useMemo(() => "0,12 30,16 62,16 100,21 136,28 168,42 200,42 232,49 266,49 298,49 332,56 366,56", []);

  return (
    <section className="weather-trend" aria-label={ariaLabel}>
      <div className="weather-trend__meta">
        <span className="weather-trend__now"><CloudSun aria-hidden="true" /> {temp}°</span>
        <span className="weather-trend__aqi">AQI 38</span>
      </div>
      <svg className="weather-trend__chart" viewBox="0 0 366 64" preserveAspectRatio="none" aria-hidden="true">
        <polygon points={`${points} 366,64 0,64`} className="weather-trend__area" />
        <polyline points={points} className="weather-trend__line" />
      </svg>
      <div className="weather-trend__axis" aria-hidden="true"><span>18°</span><span>12 ч</span><span>{temp}°</span></div>
    </section>
  );
}
