import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  buildBotAccessRegistry,
  parseOpenClawConfig,
  parseSessionsFile,
  peerPrimaryLabel,
  type BotAccessRegistry,
} from "@/lib/openclaw/bot-access";
import { botToken } from "@/lib/telegram/bot";
import { requireHubUser } from "./hub-auth.server";

function openclawHome(): string {
  return process.env.OPENCLAW_HOME || process.env.OPENCLAW_STATE_DIR || "/root/.openclaw";
}

function readTextFile(path: string): string | null {
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

const DEFAULT_MAIN_WORKSPACE = "/root/openclaw";

function readJsonFile(path: string): unknown {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

async function fetchTelegramUsernames(ids: string[]): Promise<Record<string, string>> {
  const token = botToken();
  const out: Record<string, string> = {};
  if (!token || !ids.length) return out;
  await Promise.all(ids.map(async (id) => {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: id }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return;
      const data = await res.json();
      const username = data && data.result && data.result.username;
      if (typeof username === "string" && username) out[id] = username;
    } catch { /* best effort */ }
  }));
  return out;
}

export async function listBotAccessAdmin(token: string): Promise<BotAccessRegistry> {
  const { user } = await requireHubUser(token);
  if (user.role !== "admin") throw new Error("Только администратор");

  const home = openclawHome();
  const configRaw = readJsonFile(join(home, "openclaw.json"));
  if (!configRaw) {
    return {
      bot: "@Dmbotmy_bot",
      dmPolicy: "unknown",
      generatedAt: new Date().toISOString(),
      peers: [],
      providersConfigured: [],
    };
  }

  const parsed = parseOpenClawConfig(configRaw);
  const sessionsByAgent: Record<string, ReturnType<typeof parseSessionsFile>> = {};
  for (const agent of ["main", "chat", "hub"]) {
    const sessionsPath = join(home, "agents", agent, "sessions", "sessions.json");
    const raw = readJsonFile(sessionsPath);
    if (raw) sessionsByAgent[agent] = parseSessionsFile(raw);
  }

  const userMdByAgent: Record<string, string> = {};
  for (const agent of parsed.agents) {
    if (!agent.id) continue;
    const workspace = agent.workspace ? String(agent.workspace) : agent.id === "main" ? DEFAULT_MAIN_WORKSPACE : null;
    if (!workspace) continue;
    const md = readTextFile(join(workspace, "USER.md"));
    if (md) userMdByAgent[agent.id] = md;
  }
  if (!userMdByAgent["main"]) {
    const md = readTextFile(join(DEFAULT_MAIN_WORKSPACE, "USER.md"));
    if (md) userMdByAgent["main"] = md;
  }

  const registry = buildBotAccessRegistry({
    allowFrom: parsed.allowFrom,
    bindings: parsed.bindings,
    agents: parsed.agents,
    sessionsByAgent,
    providersConfigured: parsed.providersConfigured,
    dmPolicy: parsed.dmPolicy,
    botName: "@Dmbotmy_bot",
    userMdByAgent,
  });

  const missing = registry.peers.filter((p) => !p.telegramUsername).map((p) => p.telegramId);
  const usernames = await fetchTelegramUsernames(missing);
  for (const peer of registry.peers) {
    const username = usernames[peer.telegramId];
    if (username && !peer.telegramUsername) {
      peer.telegramUsername = username.replace(/^@/, "");
      peer.label = peerPrimaryLabel(peer);
    }
  }

  return registry;
}
