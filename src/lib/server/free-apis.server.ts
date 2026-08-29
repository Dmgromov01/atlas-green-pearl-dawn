import { cached, fetchJson } from "./cache.ts";

const MAX_QUERY = 120;
const trimQuery = (value: unknown) => String(value || "").trim().slice(0, MAX_QUERY);

export type AirQuality = {
  aqi: number | null;
  label: "хороший" | "умеренный" | "плохой" | "нет данных";
  pm25: number | null;
  pm10: number | null;
  updatedAt: string;
};

type AirResponse = { current?: { european_aqi?: number; pm2_5?: number; pm10?: number; time?: string } };
function airLabel(aqi: number | null): AirQuality["label"] {
  if (aqi === null) return "нет данных";
  return aqi <= 20 ? "хороший" : aqi <= 40 ? "умеренный" : "плохой";
}
export async function loadAirQuality(data: { lat: number; lon: number }): Promise<AirQuality> {
  const lat = Number(data.lat), lon = Number(data.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) throw new Error("Invalid coordinates");
  const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,pm2_5,pm10`;
  const raw = await cached(`air:${lat.toFixed(3)},${lon.toFixed(3)}`, 900_000, () => fetchJson<AirResponse>(url, 5000));
  const c = raw.current;
  const aqi = Number.isFinite(c?.european_aqi) ? Number(c?.european_aqi) : null;
  const pm25 = Number.isFinite(c?.pm2_5) ? Number(c?.pm2_5) : null;
  const pm10 = Number.isFinite(c?.pm10) ? Number(c?.pm10) : null;
  return { aqi, label: airLabel(aqi), pm25, pm10, updatedAt: c?.time || new Date().toISOString() };
}

export type Holiday = { date: string; localName: string; name: string; global: boolean };
export async function loadNextHoliday(data: { countryCode?: string; year?: number }): Promise<Holiday | null> {
  const country = (String(data.countryCode || "RU").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2) || "RU");
  const year = Number(data.year) || new Date().getUTCFullYear();
  if (year < 2020 || year > 2100) throw new Error("Invalid holiday year");
  const holidays = await cached(`holidays:${country}:${year}`, 86_400_000, () => fetchJson<Holiday[]>(`https://date.nager.at/api/v3/PublicHolidays/${year}/${country}`, 6000));
  const today = new Date().toISOString().slice(0, 10);
  return holidays.find((item) => item.global && item.date >= today) || null;
}

export type CitySearchResult = { name: string; lat: number; lon: number; country?: string; state?: string };
type NominatimItem = { display_name?: string; lat?: string; lon?: string; address?: { city?: string; town?: string; village?: string; country?: string; state?: string } };
export async function loadCitiesNominatim(data: { q: string }): Promise<CitySearchResult[]> {
  const q = trimQuery(data.q);
  if (q.length < 2) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&accept-language=ru&q=${encodeURIComponent(q)}`;
  const raw = await cached(`nominatim:${q.toLowerCase()}`, 86_400_000, () => fetchJson<NominatimItem[]>(url, 7000));
  return raw.flatMap((item) => {
    const lat = Number(item.lat), lon = Number(item.lon), a = item.address || {};
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    return [{ name: a.city || a.town || a.village || item.display_name?.split(",")[0] || q, lat, lon, country: a.country, state: a.state }];
  });
}

export type WikipediaSummary = { title: string; extract: string; url: string; thumbnail?: string };
type WikiItem = { title?: string; extract?: string; content_urls?: { desktop?: { page?: string } }; thumbnail?: { source?: string } };
export async function loadWikipediaSummary(data: { title: string }): Promise<WikipediaSummary | null> {
  const title = trimQuery(data.title);
  if (title.length < 2) return null;
  const encoded = encodeURIComponent(title.replace(/\s+/g, "_"));
  const raw = await cached(`wikipedia:${title.toLowerCase()}`, 86_400_000, () => fetchJson<WikiItem>(`https://ru.wikipedia.org/api/rest_v1/page/summary/${encoded}`, 7000));
  const extract = String(raw.extract || "").trim().slice(0, 1200);
  return extract ? { title: raw.title || title, extract, url: raw.content_urls?.desktop?.page || `https://ru.wikipedia.org/wiki/${encoded}`, thumbnail: raw.thumbnail?.source } : null;
}
