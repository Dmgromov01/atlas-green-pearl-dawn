export type ForecastHour = {
  time: string;
  temp: number;
  icon: string;
  precip: number;
  precipChance: number | null;
  wind: number | null;
};

export function nextForecastHours<T extends { time: string }>(rows: T[], now = Date.now(), count = 24): T[] {
  const sorted = rows
    .filter((row) => Number.isFinite(Date.parse(row.time)))
    .sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  let current = -1;
  for (let index = sorted.length - 1; index >= 0; index--) {
    if (Date.parse(sorted[index]!.time) <= now) {
      current = index;
      break;
    }
  }
  const start = current >= 0 ? current : sorted.findIndex((row) => Date.parse(row.time) > now);
  return sorted.slice(Math.max(0, start), Math.max(0, start) + count);
}

export function temperaturePoints(hours: Pick<ForecastHour, "temp">[], width = 360, height = 72, pad = 8) {
  if (!hours.length) return "";
  const values = hours.map((hour) => hour.temp);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 2);
  return values.map((temp, index) => {
    const x = hours.length === 1 ? width / 2 : (index / (hours.length - 1)) * width;
    const y = pad + ((max - temp) / span) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}
