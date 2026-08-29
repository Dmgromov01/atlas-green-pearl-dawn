import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadAirQuality, loadCitiesNominatim, loadNextHoliday, loadWikipediaSummary } from "./free-apis.server.ts";

describe("free API guards", () => {
  it("rejects invalid air-quality coordinates before network access", async () => {
    await assert.rejects(() => loadAirQuality({ lat: 91, lon: 37 }), /Invalid coordinates/);
  });

  it("returns no city result for too-short Nominatim query", async () => {
    assert.deepEqual(await loadCitiesNominatim({ q: "a" }), []);
  });

  it("returns no Wikipedia result for too-short title", async () => {
    assert.equal(await loadWikipediaSummary({ title: "" }), null);
  });

  it("rejects holiday years outside the supported range", async () => {
    await assert.rejects(() => loadNextHoliday({ year: 2101 }), /Invalid holiday year/);
  });
});
