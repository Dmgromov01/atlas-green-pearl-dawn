import assert from "node:assert/strict";
import { test } from "node:test";
import { formatRate, normalizeRates } from "./rates.ts";

const raw = {
  Date: "2026-09-03T11:30:00+03:00",
  Valute: {
    USD: { CharCode: "USD", Nominal: 1, Value: 86.9963, Previous: 86.753 },
    EUR: { CharCode: "EUR", Nominal: 1, Value: 100.8287, Previous: 100.5988 },
    CNY: { CharCode: "CNY", Nominal: 1, Value: 12.9217, Previous: 12.897 },
    JPY: { CharCode: "JPY", Nominal: 100, Value: 54.2879, Previous: 54.2987 },
  },
};

test("normalizes CBR nominal to one currency unit", () => {
  const result = normalizeRates(raw, 123);
  assert.equal(result.fetchedAt, 123);
  assert.equal(result.rates.find((x) => x.code === "JPY")?.value, 0.542879);
  assert.ok((result.rates.find((x) => x.code === "USD")?.change ?? 0) > 0);
  assert.ok((result.rates.find((x) => x.code === "JPY")?.change ?? 0) < 0);
});

test("rejects incomplete provider data", () => {
  const incomplete = Object.fromEntries(Object.entries(raw.Valute).filter(([code]) => code !== "EUR"));
  assert.throws(() => normalizeRates({ ...raw, Valute: incomplete }), /EUR/);
});

test("formats a rate for the Russian locale", () => {
  assert.equal(formatRate(86.9963), "87,00");
});
