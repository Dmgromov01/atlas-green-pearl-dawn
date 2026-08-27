import { getSql } from "@/lib/db";
import { notifyTelegram } from "@/lib/telegram/bot";
import { audit, requireHubUser } from "./hub-auth.server";
import type { HubRole } from "@/lib/hub/identity";

async function requireAdmin(token: string) {
  const { user } = await requireHubUser(token);
  if (user.role !== "admin") throw new Error("Только администратор");
  return user;
}

function ownerId() {
  return (process.env.TELEGRAM_OWNER_ID || "").trim();
}

async function targetRow(userId: string) {
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    telegram_id: string | null;
    role: HubRole;
    allowed: boolean;
  }>`select id, telegram_id, role, allowed from hub_users where id = ${userId} limit 1`;
  return rows[0] ?? null;
}

async function adminCount() {
  const sql = await getSql();
  const rows = await sql<{ n: number }>`select count(*)::int as n from hub_users where role = 'admin'`;
  return Number(rows[0]?.n ?? 0);
}

async function assertMutable(
  adminId: string,
  target: { id: string; telegram_id: string | null; role: HubRole },
  next?: { allowed?: boolean; role?: HubRole },
) {
  const owner = ownerId();
  if (owner && target.telegram_id === owner) {
    throw new Error("Владельца нельзя менять");
  }
  if (target.id === adminId && next?.allowed === false) {
    throw new Error("Нельзя заблокировать себя");
  }
  if (target.role === "admin" && (next?.role === "user" || next?.allowed === false)) {
    if ((await adminCount()) <= 1) throw new Error("Нужен хотя бы один администратор");
  }
}

export async function listUsersAdmin(token: string) {
  await requireAdmin(token);
  const sql = await getSql();
  return sql<{
    id: string;
    telegram_id: string | null;
    username: string | null;
    display_name: string;
    role: HubRole;
    allowed: boolean;
    allow_global_ai: boolean;
    quota_daily: number;
    quota_used: number;
    ai_mode: string;
    last_seen_at: string | null;
    created_at: string;
  }>`
    select id, telegram_id, username, display_name, role, allowed, allow_global_ai,
           quota_daily, quota_used, ai_mode, last_seen_at::text as last_seen_at,
           created_at::text as created_at
    from hub_users
    order by created_at desc
    limit 200
  `;
}

export async function patchUserAdmin(data: {
  token: string;
  userId: string;
  allowed?: boolean;
  allowGlobalAi?: boolean;
  quotaDaily?: number;
  role?: HubRole;
}) {
  const admin = await requireAdmin(data.token);
  const target = await targetRow(data.userId);
  if (!target) throw new Error("Пользователь не найден");
  await assertMutable(admin.id, target, { allowed: data.allowed, role: data.role });

  const sql = await getSql();
  if (typeof data.allowed === "boolean") {
    await sql`update hub_users set allowed = ${data.allowed} where id = ${data.userId}`;
  }
  if (typeof data.allowGlobalAi === "boolean") {
    if (data.allowGlobalAi) {
      await sql`update hub_users set allow_global_ai = true where id = ${data.userId}`;
    } else {
      await sql`
        update hub_users
        set allow_global_ai = false,
            ai_mode = case when ai_mode = 'shared' then 'off' else ai_mode end
        where id = ${data.userId}
      `;
    }
  }
  if (typeof data.quotaDaily === "number") {
    const n = Math.max(0, Math.min(1000, Math.floor(data.quotaDaily)));
    await sql`update hub_users set quota_daily = ${n} where id = ${data.userId}`;
  }
  if (data.role) {
    await sql`update hub_users set role = ${data.role} where id = ${data.userId}`;
  }
  await audit({
    userId: admin.id,
    action: "admin_patch",
    detail: `${data.userId} allowed=${data.allowed} global=${data.allowGlobalAi} quota=${data.quotaDaily} role=${data.role}`,
  });
  const tid = target.telegram_id;
  if (tid && !tid.startsWith("dev:") && data.allowGlobalAi === true) {
    void notifyTelegram(tid, "Администратор открыл вам общий AI-пул.");
  }
  if (tid && !tid.startsWith("dev:") && data.allowed === true) {
    void notifyTelegram(tid, "Доступ к AI Personal Hub разрешён.");
  }
  return { ok: true };
}

export async function deleteUserAdmin(token: string, userId: string) {
  const admin = await requireAdmin(token);
  const target = await targetRow(userId);
  if (!target) throw new Error("Пользователь не найден");
  if (target.id === admin.id) throw new Error("Нельзя удалить себя");
  await assertMutable(admin.id, target, { role: "user", allowed: false });
  const sql = await getSql();
  await sql`delete from hub_users where id = ${userId}`;
  await audit({
    userId: admin.id,
    telegramId: target.telegram_id,
    action: "admin_delete",
    detail: userId,
  });
  return { ok: true };
}

export async function auditAdmin(token: string) {
  await requireAdmin(token);
  const sql = await getSql();
  return sql<{
    id: number;
    user_id: string | null;
    telegram_id: string | null;
    action: string;
    auth_method: string | null;
    key_source: string | null;
    detail: string | null;
    created_at: string;
  }>`
    select id, user_id, telegram_id, action, auth_method, key_source, detail,
           created_at::text as created_at
    from hub_audit
    order by id desc
    limit 80
  `;
}
