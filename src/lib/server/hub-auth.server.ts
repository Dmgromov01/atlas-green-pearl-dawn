import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { getSql } from "@/lib/db";
import { botToken, verifyInitData } from "@/lib/telegram/init-data";
import { notifyTelegram } from "@/lib/telegram/bot";
import type { AiMode, AuthMethod, HubRole, HubUserPublic, KeySource } from "@/lib/hub/identity";
import { SESSION_TTL_SEC } from "@/lib/hub/identity";
import { rateLimit } from "./limit";
import { bearerOrCookie, clearSessionCookie, writeSessionCookie } from "./hub-session.server";

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

export function hashToken(token: string) {
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

async function hasPasskey(userId: string) {
  const sql = await getSql();
  const rows = await sql<{ n: number }>`
    select count(*)::int as n from hub_webauthn where user_id = ${userId}
  `;
  return Number(rows[0]?.n ?? 0) > 0;
}

async function publicUser(row: UserRow): Promise<HubUserPublic> {
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
    hasPasskey: await hasPasskey(row.id),
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

export async function wipeSessions(userId: string, keepHash?: string | null) {
  const sql = await getSql();
  if (keepHash) {
    await sql`delete from hub_sessions where user_id = ${userId} and token_hash <> ${keepHash}`;
    return;
  }
  await sql`delete from hub_sessions where user_id = ${userId}`;
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
  writeSessionCookie(token);
  return { token, expiresAt: exp };
}

export async function userById(id: string) {
  const sql = await getSql();
  const rows = await sql<UserRow>`select * from hub_users where id = ${id} limit 1`;
  return rows[0] ?? null;
}

export async function requireHubUser(token?: string | null) {
  const raw = bearerOrCookie(token);
  if (!raw) throw new Error("Нет сессии");
  const sql = await getSql();
  const rows = await sql<{ user_id: string; expires_at: string; auth_method: AuthMethod }>`
    select user_id, expires_at::text as expires_at, auth_method
    from hub_sessions
    where token_hash = ${hashToken(raw)}
    limit 1
  `;
  const ses = rows[0];
  if (!ses) throw new Error("Сессия недействительна");
  if (new Date(ses.expires_at).getTime() < Date.now()) throw new Error("Сессия истекла");
  const user = await userById(ses.user_id);
  if (!user || !user.allowed) throw new Error("Доступ запрещён");
  return { user, method: ses.auth_method, token: raw };
}

async function countAdminsReady() {
  const sql = await getSql();
  const rows = await sql<{ n: number }>`
    select count(*)::int as n from hub_users
    where role = 'admin' and allowed = true and pin_hash is not null
  `;
  const pinReady = Number(rows[0]?.n ?? 0);
  const pass = await sql<{ n: number }>`
    select count(*)::int as n
    from hub_webauthn w
    join hub_users u on u.id = w.user_id
    where u.role = 'admin' and u.allowed = true
  `;
  return pinReady + Number(pass[0]?.n ?? 0);
}

async function firstUnclaimedAdmin() {
  const sql = await getSql();
  const rows = await sql<UserRow>`
    select * from hub_users
    where role = 'admin' and allowed = true and pin_hash is null
    order by created_at asc
    limit 1
  `;
  return rows[0] ?? null;
}

export async function hubAuthStatus() {
  const ready = await countAdminsReady();
  return { needsSetup: ready === 0 };
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
  return null;
}

async function findByPin(pin: string, hintUserId?: string) {
  const sql = await getSql();
  const hinted = hintUserId
    ? await sql<UserRow>`select * from hub_users where id = ${hintUserId} and allowed = true limit 1`
    : [];
  const rest = await sql<UserRow>`
    select * from hub_users
    where allowed = true and pin_hash is not null
    order by last_seen_at desc nulls last
    limit 20
  `;
  const seen = new Set<string>();
  const ordered: UserRow[] = [];
  for (const row of [...hinted, ...rest]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    ordered.push(row);
  }
  let match: UserRow | null = null;
  for (const row of ordered) {
    if (pinOk(pin, row.pin_salt, row.pin_hash) && !match) match = row;
  }
  return match;
}

function sessionResult(row: UserRow, ses: { token: string; expiresAt: string }, user: HubUserPublic) {
  return { token: ses.token, expiresAt: ses.expiresAt, user };
}

export async function loginHub(data: {
  initData?: string;
  pin?: string;
  hintUserId?: string;
  displayName?: string;
  biometric?: boolean;
}): Promise<{ token: string; expiresAt: string; user: HubUserPublic } | { error: string }> {
  const tokenEnv = botToken();
  let method: AuthMethod = "pin";
  let row: UserRow | null = null;

  if (data.initData && tokenEnv) {
    const tg = verifyInitData(data.initData, tokenEnv);
    if (!tg) {
      await audit({ action: "login_fail_initdata", telegramId: null, detail: "bad hmac" });
      return { error: "Неверная подпись Telegram" };
    }
    row = await upsertTelegramUser(tg);
    if (!row) return { error: "Этот Telegram ещё не в семье. Нужен инвайт." };
    method = data.biometric ? "biometric" : "initData";
    if (row.pin_hash && data.pin && !pinOk(data.pin, row.pin_salt, row.pin_hash)) {
      await audit({ userId: row.id, telegramId: row.telegram_id, action: "login_fail_pin", authMethod: method });
      return { error: "Неверный PIN" };
    }
    if (data.pin) method = "pin";
  } else if (data.pin) {
    if (!rateLimit("pin-login", 12, 15 * 60_000)) return { error: "Слишком много попыток. Подождите." };
    if (!/^\d{4,8}$/.test(data.pin)) return { error: "PIN: 4–8 цифр" };
    row = await findByPin(data.pin, data.hintUserId);
    method = "pin";
    if (!row) {
      await audit({ action: "login_fail_pin", detail: "no match" });
      return { error: "Неверный PIN" };
    }
  } else {
    return { error: "Нужен Face ID или PIN" };
  }

  if (!row.allowed) {
    await audit({ userId: row.id, telegramId: row.telegram_id, action: "login_denied", authMethod: method });
    return { error: "Доступ запрещён. Обратитесь к владельцу." };
  }

  const ses = await issueSession(row.id, method);
  await audit({ userId: row.id, telegramId: row.telegram_id, action: "login_ok", authMethod: method });
  if (row.telegram_id && !row.telegram_id.startsWith("dev:")) {
    void notifyTelegram(
      row.telegram_id,
      method === "biometric"
        ? "Вход в AI Personal Hub по Face ID."
        : method === "initData"
          ? "Вход в AI Personal Hub через Telegram."
          : "Вход в AI Personal Hub по PIN.",
    );
  }
  return sessionResult(row, ses, await publicUser(row));
}

export async function setupOwnerHub(data: {
  displayName: string;
  pin: string;
}): Promise<{ token: string; expiresAt: string; user: HubUserPublic } | { error: string }> {
  if (!/^\d{4,8}$/.test(data.pin)) return { error: "PIN: 4–8 цифр" };
  const name = data.displayName.trim().slice(0, 40);
  if (!name) return { error: "Укажите имя" };
  if (!rateLimit("setup-owner", 6, 30 * 60_000)) return { error: "Слишком много попыток" };

  const ready = await countAdminsReady();
  if (ready > 0) return { error: "Владелец уже назначен. Войдите или попросите инвайт." };

  const sql = await getSql();
  const existing = await firstUnclaimedAdmin();
  const salt = randomBytes(16).toString("hex");
  const hash = hashPin(data.pin, salt);
  let row: UserRow;

  if (existing) {
    await sql`
      update hub_users
      set display_name = ${name}, pin_salt = ${salt}, pin_hash = ${hash},
          allowed = true, role = 'admin', allow_global_ai = true, ai_mode = 'shared'
      where id = ${existing.id}
    `;
    row = (await sql<UserRow>`select * from hub_users where id = ${existing.id} limit 1`)[0]!;
  } else {
    const id = uid();
    await sql`
      insert into hub_users (
        id, display_name, role, allowed, allow_global_ai, ai_mode, pin_salt, pin_hash
      ) values (
        ${id}, ${name}, 'admin', true, true, 'shared', ${salt}, ${hash}
      )
    `;
    row = (await sql<UserRow>`select * from hub_users where id = ${id} limit 1`)[0]!;
  }

  await wipeSessions(row.id);
  const ses = await issueSession(row.id, "pin");
  await audit({ userId: row.id, action: "setup_owner", authMethod: "pin", detail: name });
  return sessionResult(row, ses, await publicUser(row));
}

export async function createInviteHub(token: string, input?: { displayName?: string }) {
  const { user } = await requireHubUser(token);
  if (user.role !== "admin") throw new Error("Только владелец может приглашать");
  const raw = randomBytes(24).toString("base64url");
  const id = uid();
  const name = (input?.displayName || "").trim().slice(0, 40) || null;
  const exp = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const sql = await getSql();
  await sql`
    insert into hub_invites (id, token_hash, created_by, role, display_name, expires_at)
    values (${id}, ${hashToken(raw)}, ${user.id}, 'user', ${name}, ${exp})
  `;
  await audit({ userId: user.id, action: "invite_create", detail: name });
  const origin = (process.env.HUB_ORIGIN || "https://hub.gbkz.uk").replace(/\/+$/, "");
  return { token: raw, url: `${origin}/?invite=${raw}`, expiresAt: exp };
}

export async function redeemInviteHub(data: {
  invite: string;
  displayName: string;
  pin: string;
}): Promise<{ token: string; expiresAt: string; user: HubUserPublic } | { error: string }> {
  if (!/^\d{4,8}$/.test(data.pin)) return { error: "PIN: 4–8 цифр" };
  const name = data.displayName.trim().slice(0, 40);
  if (!name) return { error: "Укажите имя" };
  if (!rateLimit("invite-redeem", 10, 30 * 60_000)) return { error: "Слишком много попыток" };
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    role: HubRole;
    display_name: string | null;
    expires_at: string;
    used_at: string | null;
  }>`
    select id, role, display_name, expires_at::text as expires_at, used_at::text as used_at
    from hub_invites
    where token_hash = ${hashToken(data.invite)}
    limit 1
  `;
  const inv = rows[0];
  if (!inv) return { error: "Инвайт не найден" };
  if (inv.used_at) return { error: "Инвайт уже использован" };
  if (new Date(inv.expires_at).getTime() < Date.now()) return { error: "Инвайт истёк" };

  const salt = randomBytes(16).toString("hex");
  const hash = hashPin(data.pin, salt);
  const id = uid();
  const shown = name || inv.display_name || "Семья";
  await sql`
    insert into hub_users (id, display_name, role, allowed, allow_global_ai, ai_mode, pin_salt, pin_hash)
    values (${id}, ${shown}, ${inv.role === "admin" ? "user" : inv.role}, true, false, 'off', ${salt}, ${hash})
  `;
  await sql`
    update hub_invites set used_by = ${id}, used_at = now() where id = ${inv.id}
  `;
  const row = (await sql<UserRow>`select * from hub_users where id = ${id} limit 1`)[0]!;
  const ses = await issueSession(row.id, "invite");
  await audit({ userId: row.id, action: "invite_redeem", authMethod: "invite", detail: shown });
  return sessionResult(row, ses, await publicUser(row));
}

export async function listInvitesHub(token?: string) {
  const { user } = await requireHubUser(token);
  if (user.role !== "admin") throw new Error("Только владелец");
  const sql = await getSql();
  return sql<{
    id: string;
    display_name: string | null;
    expires_at: string;
    used_at: string | null;
    created_at: string;
  }>`
    select id, display_name, expires_at::text as expires_at,
           used_at::text as used_at, created_at::text as created_at
    from hub_invites
    where created_by = ${user.id}
    order by created_at desc
    limit 30
  `;
}

export async function issueSessionFor(userId: string, method: AuthMethod) {
  const row = await userById(userId);
  if (!row || !row.allowed) throw new Error("Доступ запрещён");
  const ses = await issueSession(row.id, method);
  await audit({ userId: row.id, telegramId: row.telegram_id, action: "login_ok", authMethod: method });
  return { ...ses, user: await publicUser(row) };
}

export async function meHub(token?: string) {
  const { user } = await requireHubUser(token);
  return publicUser(user);
}

export async function logoutHub(token?: string) {
  const raw = bearerOrCookie(token);
  const sql = await getSql();
  if (raw) await sql`delete from hub_sessions where token_hash = ${hashToken(raw)}`;
  clearSessionCookie();
  return { ok: true };
}

export async function setPinHub(token: string | undefined, pin: string) {
  if (!/^\d{4,8}$/.test(pin)) throw new Error("PIN: 4–8 цифр");
  const { user } = await requireHubUser(token);
  const salt = randomBytes(16).toString("hex");
  const hash = hashPin(pin, salt);
  const sql = await getSql();
  await sql`update hub_users set pin_salt = ${salt}, pin_hash = ${hash} where id = ${user.id}`;
  await wipeSessions(user.id);
  const ses = await issueSession(user.id, "pin");
  await audit({
    userId: user.id,
    telegramId: user.telegram_id,
    action: "pin_set",
    authMethod: "pin",
  });
  if (user.telegram_id && !user.telegram_id.startsWith("dev:")) {
    void notifyTelegram(user.telegram_id, "PIN AI Personal Hub изменён. Старые сессии закрыты.");
  }
  return { ok: true, token: ses.token, expiresAt: ses.expiresAt, user: await publicUser(user) };
}

export async function clearPinHub(token?: string) {
  const { user } = await requireHubUser(token);
  if (!(await hasPasskey(user.id))) throw new Error("Сначала привяжите Face ID — PIN нельзя снять без запасного входа");
  const sql = await getSql();
  await sql`update hub_users set pin_salt = null, pin_hash = null where id = ${user.id}`;
  await wipeSessions(user.id);
  const ses = await issueSession(user.id, "webauthn");
  await audit({ userId: user.id, telegramId: user.telegram_id, action: "pin_clear" });
  return { ok: true, token: ses.token, expiresAt: ses.expiresAt };
}
