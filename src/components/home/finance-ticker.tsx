const RATES = [
  { flag: "🇺🇸", value: "81,42", code: "USD" },
  { flag: "🇪🇺", value: "94,18", code: "EUR" },
  { flag: "🇨🇳", value: "11,47", code: "CNY" },
  { flag: "🇯🇵", value: "0,55", code: "JPY" },
] as const;

export function FinanceTicker() {
  return (
    <section className="finance-ticker" aria-label="Курсы валют">
      {RATES.map((rate) => (
        <div key={rate.code} className="finance-ticker__item">
          <span className="finance-ticker__flag" aria-hidden="true">{rate.flag}</span>
          <span className="finance-ticker__value">{rate.value}</span>
          <span className="finance-ticker__code">{rate.code}</span>
        </div>
      ))}
    </section>
  );
}
