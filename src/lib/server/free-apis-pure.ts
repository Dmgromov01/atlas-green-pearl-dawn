export type AirLabel = "хороший" | "умеренный" | "плохой" | "нет данных";

export function airLabel(aqi: number | null): AirLabel {
  if (aqi === null) return "нет данных";
  return aqi <= 20 ? "хороший" : aqi <= 40 ? "умеренный" : "плохой";
}

export function normalizeExternalQuery(value: unknown, max = 120): string {
  return String(value || "").trim().slice(0, max);
}
