import { randomBytes } from "node:crypto";
import { getSql } from "@/lib/db";
import { requireHubUser } from "./hub-auth.server";
import { publish } from "@/lib/live/bus";
import type { CalEvent, InboxNote, TaskItem } from "@/lib/hub/types";

export type ShareKind = "task" | "event" | "note";

function uid() {
  return randomBytes(16).toString("hex");
}

function parse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function listShare(token: string) {
  await requireHubUser(token);
  const sql = await getSql();
  const rows = await sql<{ id: string; kind: ShareKind; payload: string; owner_id: string }>`
    select id, kind, payload, owner_id from hub_share order by updated_at desc limit 400
  `;
  const tasks: TaskItem[] = [];
  const events: CalEvent[] = [];
  const notes: InboxNote[] = [];
  for (const row of rows) {
    if (row.kind === "task") {
      const t = parse<TaskItem>(row.payload);
      if (t?.text) tasks.push({ ...t, id: row.id, shared: true });
    } else if (row.kind === "event") {
      const e = parse<CalEvent>(row.payload);
      if (e?.summary && e.start) events.push({ ...e, id: row.id, shared: true, source: "shared" });
    } else if (row.kind === "note") {
      const n = parse<InboxNote>(row.payload);
      if (n?.text) notes.push({ ...n, id: row.id, shared: true });
    }
  }
  return { tasks, events, notes };
}

export async function upsertShare(
  token: string,
  kind: ShareKind,
  payload: TaskItem | CalEvent | InboxNote,
) {
  const { user } = await requireHubUser(token);
  const id = payload.id || uid();
  const sql = await getSql();
  const body = JSON.stringify({ ...payload, id, shared: true, ownerName: user.display_name });
  const existing = await sql<{ id: string }>`select id from hub_share where id = ${id} limit 1`;
  if (existing[0]) {
    await sql`update hub_share set payload = ${body}, updated_at = now() where id = ${id}`;
  } else {
    await sql`
      insert into hub_share (id, kind, owner_id, payload)
      values (${id}, ${kind}, ${user.id}, ${body})
    `;
  }
  publish("share");
  return { id };
}

export async function deleteShare(token: string, id: string) {
  await requireHubUser(token);
  const sql = await getSql();
  await sql`delete from hub_share where id = ${id}`;
  publish("share");
  return { ok: true };
}
