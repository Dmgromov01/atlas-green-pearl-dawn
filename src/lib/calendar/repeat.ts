import type { RepeatRule } from "@/lib/hub/types";

export function nextDue(dueAt: number, repeat: RepeatRule | undefined): number | null {
  if (!repeat || repeat === "none") return null;
  const d = new Date(dueAt);
  if (repeat === "daily") {
    d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  if (repeat === "weekly") {
    d.setDate(d.getDate() + 7);
    return d.getTime();
  }
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return d.getTime();
}

export const REPEAT_LABEL: Record<RepeatRule, string> = {
  none: "без повтора",
  daily: "каждый день",
  weekdays: "пн–пт",
  weekly: "раз в неделю",
};
