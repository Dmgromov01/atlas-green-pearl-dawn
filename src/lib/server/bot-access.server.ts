import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  buildBotAccessRegistry,
  parseOpenClawConfig,
  parseSessionsFile,
  type BotAccessRegistry,
} from "@/lib/openclaw/bot-access";
import { requireHubUser } from "./hub-auth.server";

function openclawHome(): string {
  return process.env.OPENCLAW_HOME || process.env.OPENCLAW_STATE_DIR || "/root/.openclaw";
}

function readJsonFile(path: string): unknown {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
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

  return buildBotAccessRegistry({
    allowFrom: parsed.allowFrom,
    bindings: parsed.bindings,
    agents: parsed.agents,
    sessionsByAgent,
    providersConfigured: parsed.providersConfigured,
    dmPolicy: parsed.dmPolicy,
    botName: "@Dmbotmy_bot",
  });
}
