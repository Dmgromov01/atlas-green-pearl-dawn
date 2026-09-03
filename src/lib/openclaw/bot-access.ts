/** Read-only OpenClaw Telegram bot access registry (no message text). */

export type BotToolPermission = {
  id: string;
  label: string;
  allowed: boolean;
};

export type BotModelUsage = {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  sessions: number;
};

export type BotAccessPeer = {
  telegramId: string;
  label: string;
  agentId: string;
  template: "owner" | "family" | "custom";
  status: "active";
  workspace: string | null;
  lastInteractionAt: string | null;
  permissions: BotToolPermission[];
  usage: BotModelUsage[];
  totals: {
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number;
  };
};

export type BotAccessRegistry = {
  bot: string;
  dmPolicy: string;
  generatedAt: string;
  peers: BotAccessPeer[];
  providersConfigured: string[];
};

export const KNOWN_BOT_TOOLS: Array<{ id: string; label: string }> = [
  { id: "read", label: "Читать выданные файлы" },
  { id: "image", label: "Смотреть фото" },
  { id: "pdf", label: "Открывать PDF" },
  { id: "web_search", label: "Веб-поиск" },
  { id: "web_fetch", label: "Загрузка веб-страниц" },
  { id: "write", label: "Писать файлы" },
  { id: "edit", label: "Править файлы" },
  { id: "exec", label: "Команды на сервере" },
  { id: "memory_get", label: "Читать MEMORY" },
  { id: "memory_search", label: "Искать в памяти" },
  { id: "message", label: "Писать в мессенджеры" },
  { id: "cron", label: "Планировщик" },
];

export type Binding = {
  agentId?: string;
  match?: {
    channel?: string;
    peer?: { kind?: string; id?: string } | string;
  };
};

export type AgentEntry = {
  id?: string;
  workspace?: string;
  tools?: { allow?: string[] | unknown };
};

export type SessionMeta = {
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  model?: string;
  modelProvider?: string;
  updatedAt?: number | string;
  lastInteractionAt?: number | string;
  lastActivityAt?: number | string;
};

export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function peerIdFromBinding(binding: Binding): string | null {
  const peer = binding.match?.peer;
  if (!peer) return null;
  if (typeof peer === "string") return peer;
  if (typeof peer.id === "string" && peer.id.trim()) return peer.id.trim();
  return null;
}

export function resolveAgentForPeer(
  telegramId: string,
  bindings: Binding[],
  fallbackAgentId = "main",
): string {
  for (const binding of bindings) {
    if (binding.match?.channel && binding.match.channel !== "telegram") continue;
    const peerId = peerIdFromBinding(binding);
    if (peerId && peerId === String(telegramId) && binding.agentId) {
      return String(binding.agentId);
    }
  }
  const channelDefault = bindings.find(
    (binding) => binding.match?.channel === "telegram" && !binding.match?.peer && binding.agentId,
  );
  return channelDefault?.agentId ? String(channelDefault.agentId) : fallbackAgentId;
}

export function permissionsForAgent(
  agentId: string,
  agents: AgentEntry[],
): { template: BotAccessPeer["template"]; permissions: BotToolPermission[]; workspace: string | null } {
  const agent = agents.find((entry) => entry.id === agentId);
  const workspace = agent?.workspace ? String(agent.workspace) : null;
  const rawAllow = agent?.tools?.allow;
  const hasExplicitAllow = Array.isArray(rawAllow);
  const allow = hasExplicitAllow ? rawAllow.map(String) : null;

  if (agentId === "hub" && allow && allow.length === 0) {
    return {
      template: "custom",
      workspace,
      permissions: KNOWN_BOT_TOOLS.map((tool) => ({ ...tool, allowed: false })),
    };
  }

  if (hasExplicitAllow && allow) {
    const set = new Set(allow);
    const template =
      agentId === "chat" && allow.length === 3 && set.has("read") && set.has("image") && set.has("pdf")
        ? "family"
        : "custom";
    return {
      template,
      workspace,
      permissions: KNOWN_BOT_TOOLS.map((tool) => ({ ...tool, allowed: set.has(tool.id) })),
    };
  }

  return {
    template: agentId === "main" ? "owner" : "custom",
    workspace,
    permissions: KNOWN_BOT_TOOLS.map((tool) => ({ ...tool, allowed: true })),
  };
}

export function msToIso(value: number | string | undefined): string | null {
  if (value == null) return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  const ms = n < 1e12 ? n * 1000 : n;
  try {
    return new Date(ms).toISOString();
  } catch {
    return null;
  }
}

export function sessionPeerId(sessionKey: string): string | null {
  const parts = sessionKey.split(":");
  if (parts.length >= 5 && parts[2] === "telegram" && parts[3] === "direct") {
    return parts[4] || null;
  }
  return null;
}

export function aggregateUsageForPeer(
  telegramId: string,
  agentId: string,
  sessionsByAgent: Record<string, Record<string, SessionMeta>>,
): { usage: BotModelUsage[]; totals: BotAccessPeer["totals"]; lastInteractionAt: string | null } {
  const sessions = sessionsByAgent[agentId] || {};
  const byModel = new Map<string, BotModelUsage>();
  let inputTokens = 0;
  let outputTokens = 0;
  let estimatedCostUsd = 0;
  let lastMs = 0;

  for (const [key, meta] of Object.entries(sessions)) {
    const peer = sessionPeerId(key);
    if (peer && peer !== String(telegramId)) continue;
    if (!peer && !key.includes(`telegram:direct:${telegramId}`)) continue;

    const provider = String(meta.modelProvider || "unknown");
    const model = String(meta.model || "unknown");
    const mapKey = `${provider}|${model}`;
    const row = byModel.get(mapKey) || {
      provider,
      model,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCostUsd: 0,
      sessions: 0,
    };
    const inn = Number(meta.inputTokens) || 0;
    const out = Number(meta.outputTokens) || 0;
    const cost = Number(meta.estimatedCostUsd) || 0;
    row.inputTokens += inn;
    row.outputTokens += out;
    row.estimatedCostUsd += cost;
    row.sessions += 1;
    byModel.set(mapKey, row);
    inputTokens += inn;
    outputTokens += out;
    estimatedCostUsd += cost;

    for (const stamp of [meta.lastInteractionAt, meta.lastActivityAt, meta.updatedAt]) {
      const n = typeof stamp === "number" ? stamp : Number(stamp);
      if (Number.isFinite(n) && n > lastMs) lastMs = n;
    }
  }

  return {
    usage: [...byModel.values()].sort((a, b) => b.inputTokens - a.inputTokens),
    totals: { inputTokens, outputTokens, estimatedCostUsd },
    lastInteractionAt: msToIso(lastMs || undefined),
  };
}

export function maskTelegramId(id: string): string {
  const s = String(id);
  if (s.length <= 4) return s;
  return `${s.slice(0, 2)}…${s.slice(-4)}`;
}


export function buildBotAccessRegistry(input: {
  allowFrom: Array<string | number>;
  bindings: Binding[];
  agents: AgentEntry[];
  sessionsByAgent: Record<string, Record<string, SessionMeta>>;
  providersConfigured?: string[];
  botName?: string;
  dmPolicy?: string;
  now?: string;
}): BotAccessRegistry {
  const allow = input.allowFrom.map(String).filter(Boolean);
  const peers: BotAccessPeer[] = allow.map((telegramId) => {
    const agentId = resolveAgentForPeer(telegramId, input.bindings);
    const { template, permissions, workspace } = permissionsForAgent(agentId, input.agents);
    const { usage, totals, lastInteractionAt } = aggregateUsageForPeer(
      telegramId,
      agentId,
      input.sessionsByAgent,
    );
    return {
      telegramId,
      label: maskTelegramId(telegramId),
      agentId,
      template,
      status: "active" as const,
      workspace,
      lastInteractionAt,
      permissions,
      usage,
      totals,
    };
  });

  peers.sort((a, b) => {
    if (a.template === "owner" && b.template !== "owner") return -1;
    if (b.template === "owner" && a.template !== "owner") return 1;
    return (b.lastInteractionAt || "").localeCompare(a.lastInteractionAt || "");
  });

  return {
    bot: input.botName || "@Dmbotmy_bot",
    dmPolicy: input.dmPolicy || "allowlist",
    generatedAt: input.now || new Date().toISOString(),
    peers,
    providersConfigured: input.providersConfigured || [],
  };
}

export function parseSessionsFile(raw: unknown): Record<string, SessionMeta> {
  const root = asRecord(raw);
  if (!root) return {};
  const out: Record<string, SessionMeta> = {};
  for (const [key, value] of Object.entries(root)) {
    const row = asRecord(value);
    if (!row) continue;
    out[key] = {
      inputTokens: typeof row.inputTokens === "number" ? row.inputTokens : Number(row.inputTokens) || 0,
      outputTokens: typeof row.outputTokens === "number" ? row.outputTokens : Number(row.outputTokens) || 0,
      estimatedCostUsd:
        typeof row.estimatedCostUsd === "number" ? row.estimatedCostUsd : Number(row.estimatedCostUsd) || 0,
      model: typeof row.model === "string" ? row.model : undefined,
      modelProvider: typeof row.modelProvider === "string" ? row.modelProvider : undefined,
      updatedAt: row.updatedAt as number | string | undefined,
      lastInteractionAt: row.lastInteractionAt as number | string | undefined,
      lastActivityAt: row.lastActivityAt as number | string | undefined,
    };
  }
  return out;
}

export function parseOpenClawConfig(raw: unknown): {
  allowFrom: string[];
  bindings: Binding[];
  agents: AgentEntry[];
  providersConfigured: string[];
  dmPolicy: string;
} {
  const root = asRecord(raw) || {};
  const channels = asRecord(root.channels) || {};
  const telegram = asRecord(channels.telegram) || {};
  const allowFrom = Array.isArray(telegram.allowFrom) ? telegram.allowFrom.map(String) : [];
  const bindings = Array.isArray(root.bindings) ? (root.bindings as Binding[]) : [];
  const agentsRoot = asRecord(root.agents) || {};
  const agents = Array.isArray(agentsRoot.list) ? (agentsRoot.list as AgentEntry[]) : [];
  const models = asRecord(root.models) || {};
  const providers = asRecord(models.providers) || {};
  return {
    allowFrom,
    bindings,
    agents,
    providersConfigured: Object.keys(providers).sort(),
    dmPolicy: typeof telegram.dmPolicy === "string" ? telegram.dmPolicy : "allowlist",
  };
}

export function formatTokenCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 100) / 10}k`;
  return String(Math.round(n));
}

export function templateLabel(template: BotAccessPeer["template"]): string {
  if (template === "owner") return "владелец";
  if (template === "family") return "семья";
  return "особый";
}

