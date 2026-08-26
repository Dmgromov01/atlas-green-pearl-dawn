import { getSql } from "@/lib/db";
import { decryptSecret, encryptSecret, keyHint } from "@/lib/crypto/aes";
import { assertPublicHttps } from "@/lib/sanitize";
import { notifyTelegram } from "@/lib/telegram/bot";
import type { AiMode, ByokProvider } from "@/lib/hub/identity";
import { audit, requireHubUser } from "./hub-auth.server";

export async function saveKeyHub(data: {
  token: string;
  provider: ByokProvider;
  apiKey: string;
  baseUrl?: string;
}) {
  const { user } = await requireHubUser(data.token);
  const key = data.apiKey.trim();
  if (key.length < 12) throw new Error("Ключ слишком короткий");
  let base: string | null = null;
  if (data.provider === "custom") {
    if (!data.baseUrl) throw new Error("Укажите адрес шлюза");
    base = assertPublicHttps(data.baseUrl).origin;
  }
  const enc = encryptSecret(key);
  const sql = await getSql();
  await sql`
    update hub_users
    set byok_provider = ${data.provider},
        byok_base_url = ${base},
        byok_key_enc = ${enc},
        byok_key_hint = ${keyHint(key)},
        ai_mode = 'byok'
    where id = ${user.id}
  `;
  await audit({
    userId: user.id,
    telegramId: user.telegram_id,
    action: "byok_saved",
    keySource: "byok",
    detail: data.provider,
  });
  if (user.telegram_id && !user.telegram_id.startsWith("dev:")) {
    void notifyTelegram(user.telegram_id, "В R2D2 сохранён ваш AI-ключ (BYOK).");
  }
  return { ok: true, hint: keyHint(key) };
}

export async function clearKeyHub(token: string) {
  const { user } = await requireHubUser(token);
  const sql = await getSql();
  await sql`
    update hub_users
    set byok_key_enc = null, byok_key_hint = null, byok_provider = null, byok_base_url = null,
        ai_mode = case when allow_global_ai then 'shared' else 'off' end
    where id = ${user.id}
  `;
  await audit({ userId: user.id, telegramId: user.telegram_id, action: "byok_cleared" });
  return { ok: true };
}

export async function setAiModeHub(token: string, mode: AiMode) {
  const { user } = await requireHubUser(token);
  if (mode === "shared" && !user.allow_global_ai) {
    throw new Error("Общий пул отключён администратором");
  }
  if (mode === "byok" && !user.byok_key_hint) {
    throw new Error("Сначала сохраните свой ключ");
  }
  const sql = await getSql();
  await sql`update hub_users set ai_mode = ${mode} where id = ${user.id}`;
  await audit({
    userId: user.id,
    telegramId: user.telegram_id,
    action: "ai_mode",
    keySource: mode === "byok" ? "byok" : mode === "shared" ? "shared" : "none",
    detail: mode,
  });
  return { ok: true };
}

export async function decryptUserKey(userId: string) {
  const sql = await getSql();
  const rows = await sql<{ byok_key_enc: string | null }>`
    select byok_key_enc from hub_users where id = ${userId} limit 1
  `;
  const blob = rows[0]?.byok_key_enc;
  if (!blob) return null;
  return decryptSecret(blob);
}
