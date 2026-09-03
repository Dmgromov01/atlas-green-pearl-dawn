import { createServerFn } from "@tanstack/react-start";
import { cached, fetchJson } from "./cache";
import { hourlyIcon, hourInTz, isNightHours, weatherInfo, windHero, type WeatherIcon } from "@/lib/weather/codes";
import { nextForecastHours } from "@/lib/weather/forecast";


type WeatherPayload = {
  lat: number;
  lon: number;
  tz: string;
  city: string;
};

type GeoHit = {
  name: string;
  lat: number;
  lon: number;
  tz: string;
  country?: string;
  admin?: string;
};

export type WeatherHour = {
  time: string;
  temp: number;
  icon: string;
  precip: number;
  precipChance: number | null;
  wind: number | null;
};

export type WeatherNow = {
  city: string;
  temp: number;
  wind: number;
  condition: string;
  icon: string;
  hero: string;
  tone: string;
  night: boolean;
  aqi: number | null;
  hourly: WeatherHour[];
  ts: number;
};

type OpenMeteo = {
  current?: {
    temperature_2m: number;
    wind_speed_10m: number;
    weather_code: number;
    time: number;
  };
  hourly?: {
    time: number[];
    temperature_2m: number[];
    precipitation: number[];
    precipitation_probability: number[];
    weather_code: number[];
    wind_speed_10m: number[];
  };
};

type OpenMeteoAir = { current?: { european_aqi?: number } };

type MetNo = {
  properties?: {
    timeseries?: {
      time: string;
      data: {
        instant: { details: { air_temperature?: number; wind_speed?: number } };
        next_1_hours?: { summary?: { symbol_code?: string }; details?: { precipitation_amount?: number } };
      };
    }[];
  };
};

type Wttr = {
  current_condition?: {
    temp_C?: string;
    windspeedKmph?: string;
    weatherDesc?: { value?: string }[];
    weatherCode?: string;
  }[];
  weather?: {
    date?: string;
    hourly?: { time?: string; tempC?: string; weatherDesc?: { value?: string }[]; precipMM?: string }[];
  }[];
};

function fromOpenMeteo(raw: OpenMeteo, city: string, tz: string, aqi: number | null): WeatherNow {
  const cur = raw.current;
  if (!cur) throw new Error("Нет данных о погоде");
  const currentTime = new Date(cur.time * 1000).toISOString();
  const hour = hourInTz(currentTime, tz);
  const night = isNightHours(hour);
  const info = weatherInfo(cur.weather_code, night);
  const wind = Math.round(cur.wind_speed_10m * 10) / 10;
  const hero = wind >= 12 && (info.tone === "clear" || info.tone === "cloud") ? windHero(night) : info.hero;
  const rows = (raw.hourly?.time ?? []).map((timestamp, i): WeatherHour => {
    const time = new Date(timestamp * 1000).toISOString();
    const precip = raw.hourly?.precipitation[i] ?? 0;
    const code = raw.hourly?.weather_code[i] ?? 0;
    const h = hourInTz(time, tz);
    return {
      time,
      temp: Math.round(raw.hourly?.temperature_2m[i] ?? 0),
      icon: hourlyIcon(code, precip, 0, isNightHours(h)),
      precip,
      precipChance: raw.hourly?.precipitation_probability[i] ?? null,
      wind: raw.hourly?.wind_speed_10m[i] ?? null,
    };
  });
  return {
    city,
    temp: Math.round(cur.temperature_2m),
    wind,
    condition: info.label,
    icon: info.icon,
    hero,
    tone: info.tone,
    night,
    aqi,
    hourly: nextForecastHours(rows, cur.time * 1000),
    ts: Date.now(),
  };
}

function metNoIcon(symbol: string, night: boolean): { icon: WeatherIcon; tone: WeatherNow["tone"]; label: string; hero: string } {
  const s = symbol.replace(/_(day|night|polartwilight)$/i, "");
  const n = night;
  if (s.includes("thunder")) return { icon: "thunderstorms", tone: "storm", label: "Гроза", hero: n ? "thunderstorm-night.jpg" : "thunderstorm-background.jpg" };
  if (s.includes("snow") || s.includes("sleet")) return { icon: "snow", tone: "snow", label: "Снег", hero: n ? "snow-night.jpg" : "snow-background.jpg" };
  if (s.includes("rain") || s.includes("shower")) return { icon: "rain", tone: "rain", label: "Дождь", hero: n ? "rain-night.jpg" : "rain-background.jpg" };
  if (s.includes("drizzle")) return { icon: "drizzle", tone: "rain", label: "Морось", hero: n ? "rain-night.jpg" : "drizzle-background.jpg" };
  if (s.includes("fog") || s.includes("mist")) return { icon: n ? "fog-night" : "fog", tone: "fog", label: "Туман", hero: n ? "cloudy-night.jpg" : "fog-background.jpg" };
  if (s === "cloudy") return { icon: n ? "overcast-night" : "overcast", tone: "cloud", label: "Пасмурно", hero: n ? "cloudy-night.jpg" : "overcast-background.jpg" };
  if (s.includes("partly") || s === "fair") return { icon: n ? "partly-cloudy-night" : "partly-cloudy-day", tone: "cloud", label: "Переменная облачность", hero: n ? "partly-cloudy-night.jpg" : "partly-cloudy-background.jpg" };
  return { icon: n ? "clear-night" : "clear-day", tone: "clear", label: "Ясно", hero: n ? "clear-night.jpg" : "sunny-background.jpg" };
}

function fromMetNo(raw: MetNo, city: string, tz: string): WeatherNow {
  const series = raw.properties?.timeseries ?? [];
  if (!series.length) throw new Error("Нет данных о погоде");
  const now = series[0]!;
  const temp = now.data.instant.details.air_temperature ?? 0;
  const wind = Math.round((now.data.instant.details.wind_speed ?? 0) * 10) / 10;
  const hour = hourInTz(now.time, tz);
  const night = isNightHours(hour);
  const symbol = now.data.next_1_hours?.summary?.symbol_code ?? "cloudy";
  const info = metNoIcon(symbol, night);
  const hourly: WeatherHour[] = series.slice(0, 24).map((row) => {
    const h = hourInTz(row.time, tz);
    const n = isNightHours(h);
    const sym = row.data.next_1_hours?.summary?.symbol_code ?? symbol;
    const mapped = metNoIcon(sym, n);
    return {
      time: row.time,
      temp: Math.round(row.data.instant.details.air_temperature ?? temp),
      icon: mapped.icon,
      precip: row.data.next_1_hours?.details?.precipitation_amount ?? 0,
      precipChance: null,
      wind: row.data.instant.details.wind_speed ?? null,
    };
  });
  return {
    city,
    temp: Math.round(temp),
    wind,
    condition: info.label,
    icon: info.icon,
    hero: info.hero,
    tone: info.tone,
    night,
    aqi: null,
    hourly: nextForecastHours(hourly),
    ts: Date.now(),
  };
}

function descInfo(desc: string, night: boolean) {
  const s = desc.toLowerCase();
  if (s.includes("thunder") || s.includes("гроз")) return metNoIcon("thunder", night);
  if (s.includes("snow") || s.includes("снег") || s.includes("sleet")) return metNoIcon("snow", night);
  if (s.includes("drizzle") || s.includes("морось")) return metNoIcon("drizzle", night);
  if (s.includes("rain") || s.includes("дожд") || s.includes("shower")) return metNoIcon("rain", night);
  if (s.includes("fog") || s.includes("mist") || s.includes("туман")) return metNoIcon("fog", night);
  if (s.includes("overcast") || s.includes("пасмурн") || s.includes("cloud")) return metNoIcon("cloudy", night);
  if (s.includes("partly") || s.includes("перемен")) return metNoIcon("partlycloudy", night);
  return metNoIcon("clearsky", night);
}

function fromWttr(raw: Wttr, city: string, tz: string): WeatherNow {
  const cur = raw.current_condition?.[0];
  if (!cur) throw new Error("Нет данных о погоде");
  const temp = Number(cur.temp_C);
  if (!Number.isFinite(temp)) throw new Error("Нет данных о погоде");
  const windKmh = Number(cur.windspeedKmph ?? 0);
  const wind = Math.round((windKmh / 3.6) * 10) / 10;
  const hour = hourInTz(new Date(), tz);
  const night = isNightHours(hour);
  const desc = cur.weatherDesc?.[0]?.value || "облачно";
  const info = descInfo(desc, night);
  const rows = (raw.weather ?? []).flatMap((day) => (day.hourly ?? []).map((row) => ({ day: day.date, row }))).slice(0, 24);
  const hourly: WeatherHour[] = rows.map(({ day, row }) => {
    const hh = String(row.time ?? "0").padStart(4, "0");
    const h = Number(hh.slice(0, -2)) || 0;
    const iso = day ? new Date(`${day}T${String(h).padStart(2, "0")}:00:00Z`) : new Date();
    if (!day) iso.setHours(h, 0, 0, 0);
    const mapped = descInfo(row.weatherDesc?.[0]?.value || desc, isNightHours(h));
    return {
      time: iso.toISOString(),
      temp: Math.round(Number(row.tempC ?? temp)),
      icon: mapped.icon,
      precip: Number(row.precipMM ?? 0),
      precipChance: null,
      wind: null,
    };
  });
  return {
    city,
    temp: Math.round(temp),
    wind,
    condition: info.label,
    icon: info.icon,
    hero: info.hero,
    tone: info.tone,
    night,
    aqi: null,
    hourly: nextForecastHours(hourly.length ? hourly : [{ time: new Date().toISOString(), temp: Math.round(temp), icon: info.icon, precip: 0, precipChance: null, wind: null }]),
    ts: Date.now(),
  };
}

async function loadWeather(lat: number, lon: number, tz: string, city: string): Promise<WeatherNow> {
  const om =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,wind_speed_10m,weather_code` +
    `&hourly=temperature_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m` +
    `&timezone=${encodeURIComponent(tz)}&forecast_days=2&timeformat=unixtime&wind_speed_unit=ms`;
  const air =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
    `&current=european_aqi&timezone=${encodeURIComponent(tz)}`;
  const met = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`;
  const wttr = `https://wttr.in/${lat},${lon}?format=j1&lang=ru`;
  try {
    const [raw, airRaw] = await Promise.all([
      fetchJson<OpenMeteo>(om, 4500),
      fetchJson<OpenMeteoAir>(air, 3000).catch(() => null),
    ]);
    const value = airRaw?.current?.european_aqi;
    return fromOpenMeteo(raw, city, tz, Number.isFinite(value) ? Math.round(value!) : null);
  } catch {
    try {
      return fromMetNo(await fetchJson<MetNo>(met, 3500), city, tz);
    } catch {
      return fromWttr(await fetchJson<Wttr>(wttr, 4000), city, tz);
    }
  }
}

export const getWeather = createServerFn({ method: "POST" })
  .validator((data: WeatherPayload) => data)
  .handler(async ({ data }): Promise<WeatherNow> => {
    const lat = Number(data.lat);
    const lon = Number(data.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new Error("Invalid coordinates");
    }
    const key = `wx7:${lat.toFixed(3)},${lon.toFixed(3)}:${data.tz}`;
    return cached(key, 30 * 60_000, () => loadWeather(lat, lon, data.tz || "Europe/Moscow", data.city), "weather");
  });

type GeoResponse = {
  results?: {
    name: string;
    latitude: number;
    longitude: number;
    timezone?: string;
    country?: string;
    admin1?: string;
  }[];
};

export const searchCities = createServerFn({ method: "GET" })
  .validator((data: { q: string }) => data)
  .handler(async ({ data }): Promise<GeoHit[]> => {
    const q = data.q.trim().slice(0, 80);
    if (q.length < 2) return [];
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=ru&format=json`;
    try {
      const raw = await fetchJson<GeoResponse>(url, 6000);
      return (raw.results ?? []).map((r) => ({
        name: r.name,
        lat: r.latitude,
        lon: r.longitude,
        tz: r.timezone || "Europe/Moscow",
        country: r.country,
        admin: r.admin1,
      }));
    } catch {
      return [];
    }
  });

export const reverseCity = createServerFn({ method: "GET" })
  .validator((data: { lat: number; lon: number }) => data)
  .handler(async ({ data }): Promise<GeoHit | null> => {
    const lat = Number(data.lat);
    const lon = Number(data.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const url = `https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&language=ru&format=json`;
    try {
      const raw = await fetchJson<GeoResponse>(url, 2500);
      const r = raw.results?.[0];
      if (!r) return null;
      return {
        name: r.name,
        lat: r.latitude,
        lon: r.longitude,
        tz: r.timezone || "UTC",
        country: r.country,
        admin: r.admin1,
      };
    } catch {
      return null;
    }
  });
