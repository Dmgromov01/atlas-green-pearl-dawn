import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftRight } from "lucide-react";
import { getRates } from "@/lib/server/rates";
import { AppShell } from "@/components/shell/app-shell";
import { Header } from "@/components/shell/header";
import { Page, SectionLabel } from "@/components/shell/page";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { haptic } from "@/lib/haptic";

const CURRENCIES = ["USD", "EUR", "CNY", "JPY", "GBP", "RUB"] as const;
const LABELS: Record<string, string> = {
  USD: "Доллар США",
  EUR: "Евро",
  CNY: "Юань",
  JPY: "Иена",
  GBP: "Фунт",
  RUB: "Рубль",
};

function formatRub(n: number) {
  return n.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function RatesView() {
  const [amount, setAmount] = useState(1000);
  const [from, setFrom] = useState("CNY");
  const [to, setTo] = useState("RUB");
  const q = useQuery({ queryKey: ["rates"], queryFn: () => getRates() });
  const rates = q.data?.rates;

  const result = useMemo(() => {
    if (!rates || !rates[from] || !rates[to]) return null;
    return (amount * rates[from]!) / rates[to]!;
  }, [amount, from, to, rates]);

  const swap = () => {
    haptic();
    setFrom(to);
    setTo(from);
  };

  return (
    <AppShell>
      <Header title="Курсы" subtitle="ЦБ РФ · конвертер" backTo="/" />
      <Page>
        <Card className="space-y-3 p-4">
          <SectionLabel>Конвертер</SectionLabel>
          <Input
            type="number"
            inputMode="decimal"
            value={Number.isFinite(amount) ? amount : 0}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="font-bold tabular-nums"
            aria-label="Сумма"
          />
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <select
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 min-w-0 rounded-full border border-border bg-muted px-3 text-sm font-bold text-foreground"
              aria-label="Из валюты"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="secondary"
              size="icon-sm"
              aria-label="Поменять местами"
              onClick={swap}
            >
              <ArrowLeftRight className="size-4" />
            </Button>
            <select
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 min-w-0 rounded-full border border-border bg-muted px-3 text-sm font-bold text-foreground"
              aria-label="В валюту"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-2xl border border-success/25 bg-success/10 px-3.5 py-2.5">
          <SectionLabel>Результат</SectionLabel>
            <div className="mt-1 break-all text-xl font-extrabold tabular-nums text-success">
              {result == null ? "—" : formatRub(result)} {to}
            </div>
          </div>
        </Card>

        <Card>
          <SectionLabel className="px-4 pb-1 pt-3">Курс к рублю</SectionLabel>
          {q.isLoading ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : null}
          {q.isError ? (
            <p className="px-4 py-6 text-sm text-destructive">Не удалось загрузить курсы ЦБ.</p>
          ) : null}
          {rates
            ? CURRENCIES.filter((c) => c !== "RUB").map((code, i) => (
                <div
                  key={code}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                  style={i > 0 ? { borderTop: "1px solid var(--border)" } : undefined}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{code}</div>
                    <div className="text-xs text-muted-foreground">{LABELS[code]}</div>
                  </div>
                  <div className="shrink-0 text-right text-base font-extrabold tabular-nums">
                    {formatRub(rates[code] ?? 0)}
                    <span className="ml-1 text-xs font-bold text-muted-foreground">₽</span>
                  </div>
                </div>
              ))
            : null}
        </Card>
      </Page>
    </AppShell>
  );
}
