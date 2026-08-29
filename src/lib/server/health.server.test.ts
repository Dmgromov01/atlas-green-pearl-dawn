import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { healthResponse } from "./health-response.ts";

describe("health probe response", () => {
  it("returns cache-free liveness", async () => {
    const response = healthResponse();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok" });
    assert.equal(response.headers.get("cache-control"), "no-store");
  });
});
