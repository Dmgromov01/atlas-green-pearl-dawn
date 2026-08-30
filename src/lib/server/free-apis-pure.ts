export type AirLabel = "хороший" | "умеренный" | "плохой" | "нет данных";

export function airLabel(aqi: number | null): AirLabel {
  if (aqi === null) return "нет данных";
  return aqi <= 20 ? "хороший" : aqi <= 40 ? "умеренный" : "плохой";
}

export function normalizeExternalQuery(value: unknown, max = 120): string {
  return String(value || "").trim().slice(0, max);
}

export function normalizeCountryCode(country?: string) {
  const value = (country || "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(value)) return value;
  return ({
    "РОССИЯ": "RU",
    "БЕЛАРУСЬ": "BY",
    "КАЗАХСТАН": "KZ",
    "ГЕРМАНИЯ": "DE",
    "ФРАНЦИЯ": "FR",
    "США": "US",
    "ТУРЦИЯ": "TR",
  } as Record<string, string>)[value] || "RU";
}
