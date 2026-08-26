export type WeatherIcon =
  | "clear-day"
  | "clear-night"
  | "partly-cloudy-day"
  | "partly-cloudy-night"
  | "cloudy"
  | "overcast"
  | "overcast-night"
  | "fog"
  | "fog-night"
  | "drizzle"
  | "rain"
  | "thunderstorms"
  | "snow"
  | "sleet"
  | "wind";

export type WeatherInfo = {
  label: string;
  icon: WeatherIcon;
  hero: string;
  tone: "clear" | "cloud" | "rain" | "storm" | "snow" | "fog";
};

type Row = {
  label: string;
  day: WeatherIcon;
  night: WeatherIcon;
  hero: string;
  heroNight: string;
  tone: WeatherInfo["tone"];
};

const TABLE: Record<number, Row> = {
  0: { label: "Ясно", day: "clear-day", night: "clear-night", hero: "sunny-background.png", heroNight: "clear-night.png", tone: "clear" },
  1: { label: "Почти ясно", day: "partly-cloudy-day", night: "partly-cloudy-night", hero: "mostly-sunny-background.png", heroNight: "partly-cloudy-night.png", tone: "clear" },
  2: { label: "Переменная облачность", day: "partly-cloudy-day", night: "partly-cloudy-night", hero: "partly-cloudy-background.png", heroNight: "partly-cloudy-night.png", tone: "cloud" },
  3: { label: "Пасмурно", day: "overcast", night: "overcast-night", hero: "overcast-background.png", heroNight: "cloudy-night.png", tone: "cloud" },
  45: { label: "Туман", day: "fog", night: "fog-night", hero: "fog-background.png", heroNight: "cloudy-night.png", tone: "fog" },
  48: { label: "Изморозь", day: "fog", night: "fog-night", hero: "fog-background.png", heroNight: "cloudy-night.png", tone: "fog" },
  51: { label: "Морось", day: "drizzle", night: "drizzle", hero: "drizzle-background.png", heroNight: "rain-night.png", tone: "rain" },
  53: { label: "Морось", day: "drizzle", night: "drizzle", hero: "drizzle-background.png", heroNight: "rain-night.png", tone: "rain" },
  55: { label: "Сильная морось", day: "drizzle", night: "drizzle", hero: "drizzle-background.png", heroNight: "rain-night.png", tone: "rain" },
  61: { label: "Небольшой дождь", day: "rain", night: "rain", hero: "rain-background.png", heroNight: "rain-night.png", tone: "rain" },
  63: { label: "Дождь", day: "rain", night: "rain", hero: "rain-background.png", heroNight: "rain-night.png", tone: "rain" },
  65: { label: "Сильный дождь", day: "rain", night: "rain", hero: "heavy-rain-background.png", heroNight: "rain-night.png", tone: "rain" },
  71: { label: "Небольшой снег", day: "snow", night: "snow", hero: "light-snow-background.png", heroNight: "snow-night.png", tone: "snow" },
  73: { label: "Снег", day: "snow", night: "snow", hero: "snow-background.png", heroNight: "snow-night.png", tone: "snow" },
  75: { label: "Сильный снег", day: "snow", night: "snow", hero: "snow-background.png", heroNight: "snow-night.png", tone: "snow" },
  77: { label: "Снежные зёрна", day: "sleet", night: "sleet", hero: "sleet-background.png", heroNight: "snow-night.png", tone: "snow" },
  80: { label: "Ливень", day: "rain", night: "rain", hero: "rain-background.png", heroNight: "rain-night.png", tone: "rain" },
  81: { label: "Ливень", day: "rain", night: "rain", hero: "heavy-rain-background.png", heroNight: "rain-night.png", tone: "rain" },
  82: { label: "Сильный ливень", day: "thunderstorms", night: "thunderstorms", hero: "thunderstorm-background.png", heroNight: "thunderstorm-night.png", tone: "storm" },
  85: { label: "Снегопад", day: "snow", night: "snow", hero: "snow-background.png", heroNight: "snow-night.png", tone: "snow" },
  86: { label: "Сильный снегопад", day: "snow", night: "snow", hero: "snow-background.png", heroNight: "snow-night.png", tone: "snow" },
  95: { label: "Гроза", day: "thunderstorms", night: "thunderstorms", hero: "thunderstorm-background.png", heroNight: "thunderstorm-night.png", tone: "storm" },
  96: { label: "Гроза с градом", day: "thunderstorms", night: "thunderstorms", hero: "thunderstorm-background.png", heroNight: "thunderstorm-night.png", tone: "storm" },
  99: { label: "Гроза с градом", day: "thunderstorms", night: "thunderstorms", hero: "thunderstorm-background.png", heroNight: "thunderstorm-night.png", tone: "storm" },
};

export function hourInTz(iso: string | Date, tz: string) {
  try {
    const d = iso instanceof Date ? iso : new Date(iso);
    const parts = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: tz || "Europe/Moscow",
    }).formatToParts(d);
    return Number(parts.find((p) => p.type === "hour")?.value ?? d.getHours());
  } catch {
    const d = iso instanceof Date ? iso : new Date(iso);
    return d.getHours();
  }
}

export function isNightHours(hour: number) {
  return hour >= 21 || hour < 6;
}

export function weatherInfo(code: number, night: boolean): WeatherInfo {
  const row = TABLE[code] ?? TABLE[2]!;
  return {
    label: row.label,
    icon: night ? row.night : row.day,
    hero: night ? row.heroNight : row.hero,
    tone: row.tone,
  };
}

export function windHero(night: boolean) {
  return night ? "cloudy-night.png" : "wind-background.png";
}

export function hourlyIcon(code: number, rain: number, snow: number, night: boolean): WeatherIcon {
  const precip = rain + snow;
  if (precip > 0) {
    if (snow >= rain && snow > 0) return "snow";
    if (precip < 0.3) return "drizzle";
    if (precip < 3) return "rain";
    return code >= 95 ? "thunderstorms" : "rain";
  }
  return weatherInfo(code, night).icon;
}
