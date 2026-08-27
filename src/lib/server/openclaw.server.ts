import { getSql } from "@/lib/db";
import { assertPublicHttps } from "@/lib/sanitize";
import { chatCompletionsUrl, explainGatewayError, normalizeGatewayUrl } from "@/lib/hub/gateway";
import { rateLimit } from "./limit";
import type { ByokProvider, KeySource } from "@/lib/hub/identity";
import { audit, requireHubUser, userById } from "./hub-auth.server";
import { decryptUserKey } from "./hub-keys.server";

type Creds = {
  source: KeySource;
  provider: ByokProvider;
  baseUrl: string;
  apiKey: string;
};

type ChatTurn = { role: "user" | "assistant"; content: string };

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

export function envGatewayUrl() {
  return normalizeGatewayUrl(
    process.env.OPENCLAW_GATEWAY_URL || process.env.OPENCLAW_URL || "http://127.0.0.1:18789",
  );
}

function envToken() {
  return (process.env.OPENCLAW_GATEWAY_TOKEN || process.env.OPENCLAW_TOKEN || "").trim();
}

function modelFor(provider: ByokProvider) {
  if (provider === "openai") return process.env.OPENAI_MODEL || "gpt-4.1-mini";
  if (provider === "anthropic") return process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
  return process.env.OPENCLAW_MODEL || "openclaw/default";
}

function labelFor(provider: ByokProvider) {
  if (provider === "openai") return "OpenAI";
  if (provider === "anthropic") return "Anthropic";
  if (provider === "custom") return "шлюз";
  return "OpenClaw";
}

async function resetQuotaIfNeeded(userId: string, resetOn: string | null, used: number) {
  const today = todayUtc();
  if (resetOn === today) return used;
  const sql = await getSql();
  await sql`update hub_users set quota_used = 0, quota_reset_on = ${today} where id = ${userId}`;
  return 0;
}

async function byokBaseUrl(userId: string) {
  const sql = await getSql();
  const extra = await sql<{ byok_base_url: string | null }>`
    select byok_base_url from hub_users where id = ${userId} limit 1
  `;
  return extra[0]?.byok_base_url ?? null;
}

export async function resolveAiCredentials(userId: string): Promise<Creds> {
  const user = await userById(userId);
  if (!user) throw new Error("Нет пользователя");

  if (user.ai_mode === "byok" && user.byok_key_hint) {
    const key = await decryptUserKey(userId);
    if (!key) throw new Error("Ключ не удалось расшифровать");
    const provider = (user.byok_provider as ByokProvider) || "openai";
    const custom = await byokBaseUrl(userId);
    const baseUrl =
      provider === "anthropic"
        ? "https://api.anthropic.com"
        : provider === "openai"
          ? "https://api.openai.com"
          : provider === "custom" && custom
            ? custom
            : envGatewayUrl();
    if (provider === "custom") assertPublicHttps(baseUrl);
    return { source: "byok", provider, baseUrl, apiKey: key };
  }

  if (user.ai_mode === "shared" && user.allow_global_ai) {
    const used = await resetQuotaIfNeeded(userId, user.quota_reset_on, Number(user.quota_used));
    if (used >= Number(user.quota_daily)) {
      throw new Error("Дневная квота общего пула исчерпана");
    }
    const token = envToken();
    if (!token) throw new Error("Общий шлюз OpenClaw не настроен (нет OPENCLAW_GATEWAY_TOKEN)");
    return { source: "shared", provider: "openclaw", baseUrl: envGatewayUrl(), apiKey: token };
  }

  throw new Error("AI недоступен: включите свой ключ или попросите доступ к общему пулу");
}

async function bumpQuota(userId: string) {
  const sql = await getSql();
  await sql`update hub_users set quota_used = quota_used + 1 where id = ${userId}`;
}

async function completeOpenAi(creds: Creds, system: string, turns: ChatTurn[], maxTokens: number) {
  const res = await fetch(chatCompletionsUrl(creds.baseUrl), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${creds.apiKey}`,
    },
    body: JSON.stringify({
      model: modelFor(creds.provider),
      max_tokens: maxTokens,
      max_completion_tokens: maxTokens,
      ...(creds.provider === "openclaw" ? { tool_choice: "none" } : {}),
      messages: [{ role: "system", content: system }, ...turns],
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(explainGatewayError(res.status, body, labelFor(creds.provider)));
  }
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) {
    throw new Error("Шлюз вернул пустой ответ. Проверьте агента OpenClaw и HTTP chatCompletions.");
  }
  return text;
}

async function completeAnthropic(creds: Creds, system: string, turns: ChatTurn[], maxTokens: number) {
  const res = await fetch(`${normalizeGatewayUrl(creds.baseUrl)}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": creds.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: modelFor("anthropic"),
      max_tokens: maxTokens,
      system,
      messages: turns.map((t) => ({ role: t.role, content: t.content })),
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}`);
  const json = (await res.json()) as { content?: { text?: string }[] };
  return json.content?.map((c) => c.text ?? "").join("").trim() ?? "";
}

async function runComplete(
  userId: string,
  system: string,
  turns: ChatTurn[],
  maxTokens: number,
  opts?: { countQuota?: boolean },
) {
  const creds = await resolveAiCredentials(userId);
  try {
    const text =
      creds.provider === "anthropic"
        ? await completeAnthropic(creds, system, turns, maxTokens)
        : await completeOpenAi(creds, system, turns, maxTokens);
    if (creds.source === "shared" && opts?.countQuota !== false) await bumpQuota(userId);
    await audit({
      userId,
      action: "ai_complete",
      keySource: creds.source,
      detail: creds.provider,
    });
    return { text, source: creds.source, provider: creds.provider };
  } catch (err) {
    await audit({
      userId,
      action: "ai_fail",
      keySource: creds.source,
      detail: err instanceof Error ? err.message : "fail",
    });
    throw err;
  }
}

export async function completeViaUser(userId: string, prompt: string, system: string) {
  return runComplete(userId, system, [{ role: "user", content: prompt }], 320);
}

export async function chatViaUser(userId: string, messages: ChatTurn[], system: string) {
  if (!rateLimit(`ai:chat:${userId}`, 40, 60 * 60_000)) {
    throw new Error("Слишком много запросов к агенту. Подождите немного.");
  }
  const turns = messages.slice(-12).filter((m) => m.content.trim());
  if (!turns.length) throw new Error("Пустое сообщение");
  return runComplete(userId, system, turns, 700);
}

export async function probeAiHub(token: string) {
  const { user } = await requireHubUser(token);
  if (!rateLimit(`ai:probe:${user.id}`, 8, 60 * 60_000)) {
    throw new Error("Слишком много проверок. Подождите немного.");
  }
  const out = await runComplete(
    user.id,
    "Короткий технический пинг. Одно слово.",
    [{ role: "user", content: "Ответь одним словом: ок" }],
    32,
    { countQuota: false },
  );
  return { ok: Boolean(out.text), source: out.source, provider: out.provider };
}
