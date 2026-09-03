import assert from "node:assert/strict";
import { test } from "node:test";
import { nextForecastHours, temperaturePoints } from "./forecast.ts";

test("selects the next 24 chronological forecast hours across midnight", () => {
  const start = Date.parse("2026-09-03T20:00:00Z");
  const rows = Array.from({ length: 30 }, (_, i) => ({ time: new Date(start + i * 60 * 60_000).toISOString(), temp: i }));
  const selected = nextForecastHours(rows.reverse(), start + 50 * 60_000);
  assert.equal(selected.length, 24);
  assert.equal(selected[0]?.time, "2026-09-03T20:00:00.000Z");
  assert.equal(selected.at(-1)?.time, "2026-09-04T19:00:00.000Z");
});

test("temperature chart remains finite for a flat forecast", () => {
  const points = temperaturePoints(Array.from({ length: 24 }, () => ({ temp: 7 })));
  assert.equal(points.split(" ").length, 24);
  assert.doesNotMatch(points, /NaN|Infinity/);
});
