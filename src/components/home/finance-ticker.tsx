import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { getExchangeRates } from "@/lib/server/exchange-rates";
import { formatRate, type ExchangeRates } from "@/lib/finance/rates";
import { readCache, writeCache } from "@/lib/local-cache";

const CACHE_KEY = "rates:cbr";
const FLAGS = { USD: "🇺🇸", EUR: "🇪🇺", CNY: "🇨🇳", JPY: "🇯🇵" } as const;

export function FinanceTicker() {
  const cached = readCache<ExchangeRates>(CACHE_KEY, 7 * 24 * 60 * 60_000);
  const query = useQuery({
    queryKey: ["rates"],
    queryFn: async () => {
      const data = await getExchangeRates();
      writeCache(CACHE_KEY, data);
      return data;
    },
    staleTime: 60 * 60_000,
    placeholderData: cached,
  });
  const data = query.data;
  const date = data ? new Date(data.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "";

  return (
    <section className="finance-card" aria-label="Курсы валют ЦБ РФ">
      <div className="finance-card__header"><a href="https://www.cbr-xml-daily.ru/" target="_blank" rel="noreferrer">Курсы ЦБ</a><small>{date || (query.isError ? "нет данных" : "обновляем…")}</small></div>
      <div className="finance-ticker">
        {(data?.rates ?? []).map((rate) => {
          const Trend = rate.change > 0 ? ArrowUpRight : rate.change < 0 ? ArrowDownRight : Minus;
          return <div key={rate.code} className="finance-ticker__item">
            <span className="finance-ticker__label"><span aria-hidden="true">{FLAGS[rate.code]}</span>{rate.code}</span>
            <span className="finance-ticker__value">{formatRate(rate.value)}</span>
            <Trend className={rate.change > 0 ? "is-up" : rate.change < 0 ? "is-down" : ""} aria-label={rate.change > 0 ? "курс вырос" : rate.change < 0 ? "курс снизился" : "без изменений"} />
          </div>;
        })}
        {!data ? <div className="finance-ticker__empty">{query.isError ? "Не удалось получить курсы" : "Загружаем актуальные курсы…"}</div> : null}
      </div>
    </section>
  );
}
