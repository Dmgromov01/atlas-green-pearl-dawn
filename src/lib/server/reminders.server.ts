import { randomBytes } from "node:crypto";
import { getSql } from "@/lib/db";
import { notifyTelegram } from "@/lib/telegram/bot";
import { nextDue, parseReminder, type Recurrence } from "@/lib/reminders/parse";
import { requireHubUser } from "./hub-auth.server";
import { audit } from "./hub-auth.server";

export type ReminderRow = {
  id: string;
  user_id: string;
  text: string;
  due_at: string;
  recurrence: Recurrence;
  source: "user" | "agent";
  confirmed: boolean;
  delivered_at: string | null;
  created_at: string;
  owner_name?: string;
};

function uid() {
  return randomBytes(16).toString("hex");
}

export async function previewReminder(text: string) {
  const parsed = parseReminder(text);
  if (!parsed) throw new Error("Не понял напоминание");
  return {
    text: parsed.text,
    dueAt: parsed.dueAt.toISOString(),
    recurrence: parsed.recurrence,
  };
}

export async function createReminder(
  token: string | undefined,
  input: {
    text: string;
    dueAt?: string;
    recurrence?: Recurrence;
    source?: "user" | "agent";
    confirm?: boolean;
  },
) {
  const { user } = await requireHubUser(token);
  const parsed = parseReminder(input.text);
  if (!parsed) throw new Error("Не понял напоминание");
  const due = input.dueAt ? new Date(input.dueAt) : parsed.dueAt;
  if (Number.isNaN(due.getTime())) throw new Error("Некорректное время");
  const recurrence = input.recurrence ?? parsed.recurrence;
  const source = input.source === "agent" ? "agent" : "user";
  const sql = await getSql();
  const id = uid();
  await sql`
    insert into hub_reminders (id, user_id, text, due_at, recurrence, source, confirmed)
    values (
      ${id},
      ${user.id},
      ${parsed.text},
      ${due.toISOString()},
      ${recurrence},
      ${source},
      ${input.confirm !== false}
    )
  `;
  await audit({
    userId: user.id,
    action: "reminder_create",
    detail: `${source}: ${parsed.text}`,
  });
  return {
    id,
    text: parsed.text,
    dueAt: due.toISOString(),
    recurrence,
    source,
  };
}

export async function listReminders(token?: string) {
  const { user } = await requireHubUser(token);
  const sql = await getSql();
  const rows = await sql<ReminderRow>`
    select r.id, r.user_id, r.text, r.due_at::text as due_at, r.recurrence, r.source,
           r.confirmed, r.delivered_at::text as delivered_at, r.created_at::text as created_at,
           u.display_name as owner_name
    from hub_reminders r
    join hub_users u on u.id = r.user_id
    where r.due_at > now() - interval '2 days'
    order by r.due_at asc
    limit 80
  `;
  if (user.role === "admin") return rows;
  return rows.filter((r) => r.user_id === user.id);
}

export async function deleteReminder(token: string | undefined, id: string) {
  const { user } = await requireHubUser(token);
  const sql = await getSql();
  if (user.role === "admin") {
    await sql`delete from hub_reminders where id = ${id}`;
  } else {
    await sql`delete from hub_reminders where id = ${id} and user_id = ${user.id}`;
  }
  await audit({ userId: user.id, action: "reminder_delete", detail: id });
  return { ok: true };
}

export async function fireDueReminders() {
  const sql = await getSql();
  const due = await sql<ReminderRow & { telegram_id: string | null; display_name: string }>`
    select r.id, r.user_id, r.text, r.due_at::text as due_at, r.recurrence, r.source,
           r.confirmed, r.delivered_at::text as delivered_at, r.created_at::text as created_at,
           u.telegram_id, u.display_name
    from hub_reminders r
    join hub_users u on u.id = r.user_id
    where r.confirmed = true
      and r.due_at <= now()
      and (r.delivered_at is null or r.recurrence <> 'none')
      and r.due_at > now() - interval '2 hours'
    order by r.due_at asc
    limit 40
  `;
  let sent = 0;
  for (const row of due) {
    if (row.delivered_at && row.recurrence === "none") continue;
    if (row.delivered_at && new Date(row.due_at).getTime() <= new Date(row.delivered_at).getTime()) continue;
    const who = row.source === "agent" ? "агент" : row.display_name || "семья";
    const body = `Напоминание (${who}): ${row.text}`;
    if (row.telegram_id && !row.telegram_id.startsWith("dev:")) {
      await notifyTelegram(row.telegram_id, body);
    }
    if (row.recurrence === "none") {
      await sql`update hub_reminders set delivered_at = now() where id = ${row.id}`;
    } else {
      const next = nextDue(new Date(row.due_at), row.recurrence);
      await sql`
        update hub_reminders
        set delivered_at = now(), due_at = ${next.toISOString()}
        where id = ${row.id}
      `;
    }
    sent += 1;
  }
  return { sent };
}
