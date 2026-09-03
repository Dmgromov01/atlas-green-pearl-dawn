import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildBotAccessRegistry,
  formatTokenCount,
  maskTelegramId,
  parseOpenClawConfig,
  permissionsForAgent,
  resolveAgentForPeer,
  sessionPeerId,
} from "./bot-access.ts";

test("resolves peer-specific chat binding over channel default", () => {
  const agent = resolveAgentForPeer("8335493342", [
    { agentId: "chat", match: { channel: "telegram", peer: { kind: "direct", id: "8335493342" } } },
    { agentId: "main", match: { channel: "telegram" } },
  ]);
  assert.equal(agent, "chat");
  assert.equal(
    resolveAgentForPeer("1916536646", [
      { agentId: "chat", match: { channel: "telegram", peer: { kind: "direct", id: "8335493342" } } },
      { agentId: "main", match: { channel: "telegram" } },
    ]),
    "main",
  );
});

test("family template is read/image/pdf only", () => {
  const { template, permissions } = permissionsForAgent("chat", [
    { id: "chat", tools: { allow: ["read", "image", "pdf"] }, workspace: "/ws-chat" },
  ]);
  assert.equal(template, "family");
  const allowed = permissions.filter((p) => p.allowed).map((p) => p.id).sort();
  assert.deepEqual(allowed, ["image", "pdf", "read"]);
  assert.equal(permissions.find((p) => p.id === "exec")?.allowed, false);
  assert.equal(permissions.find((p) => p.id === "web_search")?.allowed, false);
});

test("owner main without explicit allow is owner template", () => {
  const { template, permissions } = permissionsForAgent("main", [{ id: "main" }]);
  assert.equal(template, "owner");
  assert.equal(permissions.find((p) => p.id === "exec")?.allowed, true);
});

test("builds registry with usage for telegram direct sessions only", () => {
  const registry = buildBotAccessRegistry({
    allowFrom: ["1916536646", "8335493342"],
    bindings: [
      { agentId: "chat", match: { channel: "telegram", peer: { kind: "direct", id: "8335493342" } } },
      { agentId: "main", match: { channel: "telegram" } },
    ],
    agents: [
      { id: "main" },
      { id: "chat", tools: { allow: ["read", "image", "pdf"] }, workspace: "/root/openclaw/workspace-chat" },
    ],
    sessionsByAgent: {
      main: {
        "agent:main:telegram:direct:1916536646": {
          inputTokens: 1000,
          outputTokens: 50,
          estimatedCostUsd: 0.01,
          model: "deepseek-v4-flash",
          modelProvider: "deepseek",
          lastInteractionAt: 1_700_000_000_000,
        },
        "agent:main:cron:job": {
          inputTokens: 9999,
          outputTokens: 9,
          model: "deepseek-v4-flash",
          modelProvider: "deepseek",
        },
      },
      chat: {
        "agent:chat:telegram:direct:8335493342": {
          inputTokens: 32000,
          outputTokens: 6000,
          estimatedCostUsd: 0.02,
          model: "deepseek-v4-flash",
          modelProvider: "deepseek",
          lastInteractionAt: 1_700_000_100_000,
        },
      },
    },
    providersConfigured: ["deepseek", "jina", "openrouter"],
    now: "2026-09-03T12:00:00.000Z",
  });

  assert.equal(registry.peers.length, 2);
  assert.equal(registry.peers[0]?.template, "owner");
  assert.equal(registry.peers[0]?.totals.inputTokens, 1000);
  assert.equal(registry.peers[1]?.template, "family");
  assert.equal(registry.peers[1]?.totals.inputTokens, 32000);
  assert.equal(registry.peers[1]?.agentId, "chat");
  assert.deepEqual(registry.providersConfigured, ["deepseek", "jina", "openrouter"]);
});

test("parse config extracts allowlist and providers", () => {
  const parsed = parseOpenClawConfig({
    channels: { telegram: { dmPolicy: "allowlist", allowFrom: [1, "2"] } },
    bindings: [],
    agents: { list: [{ id: "main" }] },
    models: { providers: { deepseek: {}, openrouter: {}, jina: {} } },
  });
  assert.deepEqual(parsed.allowFrom, ["1", "2"]);
  assert.deepEqual(parsed.providersConfigured, ["deepseek", "jina", "openrouter"]);
});

test("helpers", () => {
  assert.equal(sessionPeerId("agent:chat:telegram:direct:8335493342"), "8335493342");
  assert.equal(maskTelegramId("8335493342"), "83…3342");
  assert.equal(formatTokenCount(32394), "32.4k");
});
