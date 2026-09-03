import { createServerFn } from "@tanstack/react-start";
import { normalizeRates, type ExchangeRates, type RawRates } from "@/lib/finance/rates";
import { cached, fetchJson } from "./cache";

const RATES_URL = "https://www.cbr-xml-daily.ru/daily_json.js";

export const getExchangeRates = createServerFn({ method: "GET" }).handler(async (): Promise<ExchangeRates> => {
  return cached(
    "rates:cbr:daily:v1",
    2 * 60 * 60_000,
    async () => normalizeRates(await fetchJson<RawRates>(RATES_URL, 5000)),
    "rates",
  );
});
