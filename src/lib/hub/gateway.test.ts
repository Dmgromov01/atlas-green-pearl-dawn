import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chatCompletionsUrl, explainGatewayError, normalizeGatewayUrl } from "./gateway.ts";

describe("normalizeGatewayUrl", () => {
  it("strips trailing slash and /v1", () => {
    assert.equal(normalizeGatewayUrl("http://127.0.0.1:18789/"), "http://127.0.0.1:18789");
    assert.equal(normalizeGatewayUrl("http://127.0.0.1:18789/v1"), "http://127.0.0.1:18789");
    assert.equal(normalizeGatewayUrl("http://127.0.0.1:18789/v1/"), "http://127.0.0.1:18789");
  });

  it("maps websocket URLs to http(s)", () => {
    assert.equal(normalizeGatewayUrl("ws://127.0.0.1:18789"), "http://127.0.0.1:18789");
    assert.equal(normalizeGatewayUrl("wss://gw.internal/v1"), "https://gw.internal");
  });

  it("does not double /v1 on the chat path", () => {
    assert.equal(
      chatCompletionsUrl("http://127.0.0.1:18789/v1"),
      "http://127.0.0.1:18789/v1/chat/completions",
    );
    assert.equal(
      chatCompletionsUrl("https://api.openai.com"),
      "https://api.openai.com/v1/chat/completions",
    );
  });
});

describe("explainGatewayError", () => {
  it("points at the disabled HTTP surface", () => {
    const msg = explainGatewayError(404, "", "OpenClaw");
    assert.match(msg, /chatCompletions/);
  });
});
