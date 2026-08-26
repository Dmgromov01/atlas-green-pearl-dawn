import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getSql } from "@/lib/db";
import { botToken, notifyTelegram, verifyInitData } from "@/lib/telegram/init-data";
import type { AiMode, AuthMethod, HubRole, HubUserPublic, KeySource } from "@/lib/hub/identity";
import { SESSION_TTL_SEC } from "@/lib/hub/identity";

type UserRow = {
  id: string;
  telegram_id: string | null;
  username: string | null;
  display_name: string;
  role: HubRole;
  allowed: boolean;
  pin_salt: string | null;
  pin_hash: string | null;
  ai_mode: AiMode;
  allow_global_ai: boolean;
  quota_daily: number;
  quota_used: number;
  quota_reset_on: string | null;
  byok_provider: string | null;
  byok_key_hint: string | null;
};

function uid() {
  return randomBytes(16).toString("hex");
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function hashPin(pin: string, salt: string) {
  return scryptSync(pin, salt, 32).toString("hex");
}

function pinOk(pin: string, salt: string | null, hash: string | null) {
  if (!salt || !hash || pin.length < 4) return false;
  const calc = Buffer.from(hashPin(pin, salt), "hex");
  const want = Buffer.from(hash, "hex");
  return calc.length === want.length && timingSafeEqual(calc, want);
}

function publicUser(row: UserRow): HubUserPublic {
  return {
    id: row.id,
    telegramId: row.telegram_id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    allowed: Boolean(row.allowed),
    aiMode: row.ai_mode,
    allowGlobalAi: Boolean(row.allow_global_ai),
    quotaDaily: Number(row.quota_daily),
    quotaUsed: Number(row.quota_used),
    byokProvider: (row.byok_provider as HubUserPublic["byokProvider"]) ?? null,
    byokHint: row.byok_key_hint,
    hasPin: Boolean(row.pin_hash),
  };
}

export async function audit(input: {
  userId?: string | null;
  telegramId?: string | null;
  action: string;
  authMethod?: AuthMethod | null;
  keySource?: KeySource | null;
  detail?: string | null;
}) {
  const sql = await getSql();
  await sql`
    insert into hub_audit (user_id, telegram_id, action, auth_method, key_source, detail)
    values (
      ${input.userId ?? null},
      ${input.telegramId ?? null},
      ${input.action},
      ${input.authMethod ?? null},
      ${input.keySource ?? null},
      ${input.detail ?? null}
    )
  `;
}

async function issueSession(userId: string, method: AuthMethod) {
  const sql = await getSql();
  const token = randomBytes(32).toString("base64url");
  const id = uid();
  const exp = new Date(Date.now() + SESSION_TTL_SEC() * 1000).toISOString();
  await sql`
    insert into hub_sessions (id, user_id, token_hash, auth_method, expires_at)
    values (${id}, ${userId}, ${hashToken(token)}, ${method}, ${exp})
  `;
  await sql`update hub_users set last_seen_at = now() where id = ${userId}`;
  return { token, expiresAt: exp };
}

export async function userById(id: string) {
  const sql = await getSql();
  const rows = await sql<UserRow>`select * from hub_users where id = ${id} limit 1`;
  return rows[0] ?? null;
}

export async function requireHubUser(token: string | undefined | null) {
  if (!token) throw new Error("Нет сессии");
  const sql = await getSql();
  const rows = await sql<{ user_id: string; expires_at: string; auth_method: AuthMethod }>`
    select user_id, expires_at::text as expires_at, auth_method
    from hub_sessions
    where token_hash = ${hashToken(token)}
    limit 1
  `;
  const ses = rows[0];
  if (!ses) throw new Error("Сессия недействительна");
  if (new Date(ses.expires_at).getTime() < Date.now()) throw new Error("Сессия истекла");
  const user = await userById(ses.user_id);
  if (!user || !user.allowed) throw new Error("Доступ запрещён");
  return { user, method: ses.auth_method };
}

async function countUsers() {
  const sql = await getSql();
  const rows = await sql<{ n: number }>`select count(*)::int as n from hub_users`;
  return Number(rows[0]?.n ?? 0);
}

async function upsertTelegramUser(tg: {
  id: number;
  first_name?: string;
  username?: string;
}) {
  const sql = await getSql();
  const tid = String(tg.id);
  const existing = await sql<UserRow>`select * from hub_users where telegram_id = ${tid} limit 1`;
  if (existing[0]) return existing[0];
  const first = (await countUsers()) === 0;
  const owner = (process.env.TELEGRAM_OWNER_ID || "").trim();
  const isOwner = first || (owner && owner === tid);
  const id = uid();
  const name = (tg.first_name || tg.username || "Гость").slice(0, 40);
  await sql`
    insert into hub_users (id, telegram_id, username, display_name, role, allowed, allow_global_ai)
    values (
      ${id},
      ${tid},
      ${tg.username ?? null},
      ${name},
      ${isOwner ? "admin" : "user"},
      ${isOwner},
      ${isOwner}
    )
  `;
  const rows = await sql<UserRow>`select * from hub_users where id = ${id} limit 1`;
  return rows[0]!;
}

export async function loginHub(data: {
  initData?: string;
  pin?: string;
  deviceId?: string;
  displayName?: string;
  biometric?: boolean;
}): Promise<{ token: string; expiresAt: string; user: HubUserPublic } | { error: string }> {
    const tokenEnv = botToken();
    const preview = !tokenEnv;
    let method: AuthMethod = "preview";
    let row: UserRow | null = null;

    if (data.initData && tokenEnv) {
      const tg = verifyInitData(data.initData, tokenEnv);
      if (!tg) {
        await audit({ action: "login_fail_initdata", telegramId: null, detail: "bad hmac" });
        return { error: "Неверная подпись Telegram" };
      }
      row = await upsertTelegramUser(tg);
      method = data.biometric ? "biometric" : "initData";
      if (row.pin_hash && data.pin) {
        if (!pinOk(data.pin, row.pin_salt, row.pin_hash)) {
          await audit({
            userId: row.id,
            telegramId: row.telegram_id,
            action: "login_fail_pin",
            authMethod: method,
          });
          return { error: "Неверный PIN" };
        }
        method = "pin";
      }
    } else if (data.deviceId) {
      const sql = await getSql();
      const did = `dev:${data.deviceId.slice(0, 64)}`;
      const found = await sql<UserRow>`select * from hub_users where telegram_id = ${did} limit 1`;
      if (found[0]) {
        row = found[0];
        if (row.pin_hash && data.pin && !pinOk(data.pin, row.pin_salt, row.pin_hash)) {
          await audit({ userId: row.id, action: "login_fail_pin", authMethod: "pin" });
          return { error: "Неверный PIN" };
        }
        method = data.pin ? "pin" : "preview";
        if (preview && (!row.allowed || row.role !== "admin")) {
          await sql`
            update hub_users
            set allowed = true, role = 'admin', allow_global_ai = true
            where id = ${row.id}
          `;
          row = { ...row, allowed: true, role: "admin", allow_global_ai: true };
        }
      } else {
        const first = (await countUsers()) === 0;
        const id = uid();
        const name = (data.displayName || "Гость").trim().slice(0, 40) || "Гость";
        const asAdmin = first || preview;
        await sql`
          insert into hub_users (id, telegram_id, display_name, role, allowed, allow_global_ai)
          values (${id}, ${did}, ${name}, ${asAdmin ? "admin" : "user"}, ${asAdmin}, ${asAdmin})
        `;
        row = (await sql<UserRow>`select * from hub_users where id = ${id} limit 1`)[0]!;
        method = "preview";
      }
    } else {
      return { error: "Нет данных для входа" };
    }

    if (!row.allowed) {
      await audit({
        userId: row.id,
        telegramId: row.telegram_id,
        action: "login_denied",
        authMethod: method,
      });
      return { error: "Доступ запрещён. Обратитесь к администратору." };
    }

    const ses = await issueSession(row.id, method);
    await audit({
      userId: row.id,
      telegramId: row.telegram_id,
      action: "login_ok",
      authMethod: method,
    });
    if (row.telegram_id && !row.telegram_id.startsWith("dev:")) {
      void notifyTelegram(
        row.telegram_id,
        method === "initData" || method === "biometric"
          ? `Вход в R2D2 (${method === "biometric" ? "биометрия" : "Telegram"}).`
          : `Вход в R2D2 по PIN.`,
      );
    }
    return { token: ses.token, expiresAt: ses.expiresAt, user: publicUser(row) };
}

export async function meHub(token: string) {
  const { user } = await requireHubUser(token);
  return publicUser(user);
}

export async function logoutHub(token: string) {
  const sql = await getSql();
  await sql`delete from hub_sessions where token_hash = ${hashToken(token)}`;
  return { ok: true };
}

export async function setPinHub(token: string, pin: string) {
  if (!/^\d{4,8}$/.test(pin)) throw new Error("PIN: 4–8 цифр");
  const { user } = await requireHubUser(token);
  const salt = randomBytes(16).toString("hex");
  const hash = hashPin(pin, salt);
  const sql = await getSql();
  await sql`update hub_users set pin_salt = ${salt}, pin_hash = ${hash} where id = ${user.id}`;
  await audit({
    userId: user.id,
    telegramId: user.telegram_id,
    action: "pin_set",
    authMethod: "pin",
  });
  if (user.telegram_id && !user.telegram_id.startsWith("dev:")) {
    void notifyTelegram(user.telegram_id, "На аккаунте R2D2 установлен PIN.");
  }
  return { ok: true };
}

export async function clearPinHub(token: string) {
  const { user } = await requireHubUser(token);
  const sql = await getSql();
  await sql`update hub_users set pin_salt = null, pin_hash = null where id = ${user.id}`;
  await audit({ userId: user.id, telegramId: user.telegram_id, action: "pin_clear" });
  return { ok: true };
}
