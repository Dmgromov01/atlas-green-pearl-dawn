export const RATE_CODES = ["USD", "EUR", "CNY", "JPY"] as const;
export type RateCode = (typeof RATE_CODES)[number];

type RawRate = { CharCode?: string; Nominal?: number; Value?: number; Previous?: number };
export type RawRates = { Date?: string; Timestamp?: string; Valute?: Record<string, RawRate> };

export type ExchangeRate = {
  code: RateCode;
  value: number;
  previous: number;
  change: number;
};

export type ExchangeRates = {
  date: string;
  fetchedAt: number;
  rates: ExchangeRate[];
};

export function normalizeRates(raw: RawRates, fetchedAt = Date.now()): ExchangeRates {
  const date = raw.Date;
  if (!date || !Number.isFinite(Date.parse(date))) throw new Error("Некорректная дата курса");
  const rates = RATE_CODES.map((code) => {
    const row = raw.Valute?.[code];
    const nominal = Number(row?.Nominal);
    const value = Number(row?.Value);
    const previous = Number(row?.Previous);
    if (row?.CharCode !== code || !Number.isFinite(nominal) || nominal <= 0 || !Number.isFinite(value) || !Number.isFinite(previous)) {
      throw new Error(`Нет курса ${code}`);
    }
    const unitValue = value / nominal;
    const unitPrevious = previous / nominal;
    return { code, value: unitValue, previous: unitPrevious, change: unitValue - unitPrevious };
  });
  return { date, fetchedAt, rates };
}

export function formatRate(value: number) {
  return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}
