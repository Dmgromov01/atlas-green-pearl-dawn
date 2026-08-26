import { hubShareUpsert } from "@/lib/server/hub-share";
import { useCalendar } from "@/lib/stores/calendar";
import { useInbox } from "@/lib/stores/inbox";
import { useTasks } from "@/lib/stores/tasks";
import { localDateKey } from "@/lib/utils";
import { pushEventToPhone } from "@/lib/calendar/gcal-sync";
import { useSettings } from "@/lib/stores/settings";
import type { RepeatRule } from "./types";

export type HubAction =
  | { op: "task"; text: string; due?: string | null; repeat?: RepeatRule; shared?: boolean }
  | { op: "event"; summary: string; start: string; shared?: boolean }
  | { op: "note"; text: string; shared?: boolean };

const REPEATS = new Set<RepeatRule>(["none", "daily", "weekdays", "weekly"]);
const FENCE = /<<<HUB\s*([\s\S]*?)\s*HUB>>>/;
const JSON_FENCE = /```json\s*([\s\S]*?)```/i;

function padTime(raw: string) {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "09:00";
  return `${m[1]!.padStart(2, "0")}:${m[2]}`;
}

function nextSlotIso() {
  const d = new Date();
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return d.toISOString();
}

export function parseDue(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})(?:[t\s](\d{1,2}:\d{2}))?/);
  if (iso) {
    const t = new Date(`${iso[1]}T${padTime(iso[2] ?? "09:00")}:00`).getTime();
    return Number.isNaN(t) ? null : t;
  }
  const clock = s.match(/(\d{1,2}:\d{2})/)?.[1];
  const now = new Date();
  if (s.startsWith("сегодня") || s.startsWith("today")) {
    return new Date(`${localDateKey(now)}T${padTime(clock ?? "18:00")}:00`).getTime();
  }
  if (s.startsWith("завтра") || s.startsWith("tomorrow")) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return new Date(`${localDateKey(d)}T${padTime(clock ?? "09:00")}:00`).getTime();
  }
  return null;
}

export function parseStartIso(raw: string | null | undefined): string {
  const ts = parseDue(raw);
  if (ts) return new Date(ts).toISOString();
  return nextSlotIso();
}

function normalizeAction(raw: unknown): HubAction | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const op = String(o.op ?? o.type ?? "").toLowerCase();
  const shared = Boolean(o.shared);
  if (op === "task") {
    const text = String(o.text ?? "").trim().slice(0, 240);
    if (!text) return null;
    const repeat = REPEATS.has(o.repeat as RepeatRule) ? (o.repeat as RepeatRule) : "none";
    const due = typeof o.due === "string" ? o.due : null;
    return { op: "task", text, due, repeat, shared };
  }
  if (op === "event") {
    const summary = String(o.summary ?? o.text ?? "").trim().slice(0, 120);
    if (!summary) return null;
    const start = String(o.start ?? o.due ?? "").trim();
    return { op: "event", summary, start, shared };
  }
  if (op === "note") {
    const text = String(o.text ?? "").trim().slice(0, 800);
    if (!text) return null;
    return { op: "note", text, shared };
  }
  return null;
}

function parseActions(blob: string): HubAction[] {
  if (!blob.trim()) return [];
  try {
    const json = JSON.parse(blob) as unknown;
    const list = Array.isArray(json)
      ? json
      : json && typeof json === "object" && Array.isArray((json as { actions?: unknown }).actions)
        ? (json as { actions: unknown[] }).actions
        : [];
    return list.slice(0, 8).map(normalizeAction).filter((a): a is HubAction => Boolean(a));
  } catch {
    return [];
  }
}

export function splitHubReply(raw: string): { text: string; actions: HubAction[] } {
  let text = (raw || "").trim();
  let blob = "";
  const fenced = text.match(FENCE);
  if (fenced) {
    blob = fenced[1] ?? "";
    text = text.replace(FENCE, "").trim();
  } else {
    const json = text.match(JSON_FENCE);
    if (json && /"actions"\s*:/.test(json[1] ?? "")) {
      blob = json[1] ?? "";
      text = text.replace(JSON_FENCE, "").trim();
    }
  }
  return { text, actions: parseActions(blob) };
}

export function applyHubActions(
  actions: HubAction[],
  opts?: { token?: string; name?: string; family?: boolean },
): string[] {
  const labels: string[] = [];
  const family = Boolean(opts?.family);
  const token = opts?.token;
  const name = opts?.name;

  for (const a of actions) {
    const shared = family && Boolean(a.shared);
    if (a.op === "task") {
      const id = useTasks.getState().add({
        text: a.text,
        dueAt: parseDue(a.due),
        repeat: a.repeat ?? "none",
        shared,
        ownerName: name,
      });
      if (!id) continue;
      const item = useTasks.getState().tasks.find((t) => t.id === id);
      if (item && shared && token) {
        void hubShareUpsert({ data: { token, kind: "task", payload: item } });
      }
      labels.push(`задача «${a.text}»`);
    } else if (a.op === "event") {
      const item = useCalendar.getState().add({
        start: parseStartIso(a.start),
        summary: a.summary,
        shared,
        ownerName: name,
        source: shared ? "shared" : "local",
      });
      if (!item) continue;
      if (shared && token) {
        void hubShareUpsert({ data: { token, kind: "event", payload: item } });
      }
      pushEventToPhone(token, item, useSettings.getState().city.tz);
      labels.push(`событие «${a.summary}»`);
    } else {
      const note = useInbox.getState().add({ text: a.text, shared, ownerName: name });
      if (!note) continue;
      if (shared && token) {
        void hubShareUpsert({ data: { token, kind: "note", payload: note } });
      }
      labels.push("заметка");
    }
  }
  return labels;
}
