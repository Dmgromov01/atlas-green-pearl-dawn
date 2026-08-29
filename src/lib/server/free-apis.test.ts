import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { airLabel, normalizeExternalQuery } from "./free-apis-pure.ts";

describe("free API pure helpers", () => {
  it("maps AQI to a compact user-facing label", () => {
    assert.equal(airLabel(null), "нет данных");
    assert.equal(airLabel(20), "хороший");
    assert.equal(airLabel(40), "умеренный");
    assert.equal(airLabel(41), "плохой");
  });

  it("bounds external query input", () => {
    assert.equal(normalizeExternalQuery("  Москва  "), "Москва");
    assert.equal(normalizeExternalQuery("x".repeat(200)).length, 120);
  });
});
