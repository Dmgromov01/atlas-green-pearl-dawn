import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { addClient, attachHubLive, getBus, HUB_LIVE_PATH, publish, removeClient, snapshot } from "./hub-live.mjs";

const WebSocket = globalThis.WebSocket;

test("publish bumps version and notifies matching clients", () => {
  const bus = getBus();
  bus.versions.clear();
  bus.clients.clear();
  const got = [];
  const client = addClient((text) => got.push(JSON.parse(text)), ["weather"]);
  publish("weather");
  publish("rates");
  assert.equal(snapshot().weather, 1);
  assert.equal(snapshot().rates, 1);
  assert.equal(got.length, 1);
  assert.equal(got[0].type, "invalidate");
  assert.equal(got[0].tag, "weather");
  assert.equal(got[0].v, 1);
  removeClient(client);
});

test("unknown tag is ignored", () => {
  const before = snapshot().weather;
  publish("nope");
  assert.equal(snapshot().weather, before);
});

test("websocket hello + invalidate roundtrip", async () => {
  const http = createServer();
  attachHubLive(http);
  await new Promise((resolve) => http.listen(0, "127.0.0.1", resolve));
  const { port } = http.address();
  const ws = new WebSocket(`ws://127.0.0.1:${port}${HUB_LIVE_PATH}`);
  const messages = [];
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("ws timeout")), 4000);
    ws.addEventListener("message", (ev) => {
      messages.push(JSON.parse(String(ev.data)));
      if (messages.length >= 2) {
        clearTimeout(timer);
        resolve();
      }
    });
    ws.addEventListener("error", reject);
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "sub", tags: ["weather"] }));
      setTimeout(() => publish("weather"), 50);
    });
  });
  ws.close();
  await new Promise((resolve) => http.close(resolve));
  assert.equal(messages[0].type, "hello");
  assert.equal(messages[0].v, 1);
  assert.equal(messages[1].type, "invalidate");
  assert.equal(messages[1].tag, "weather");
});
