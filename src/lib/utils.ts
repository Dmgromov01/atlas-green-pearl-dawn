import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(date: Date, locale = "ru-RU") {
  return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

const WEEKDAYS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

export function localDateKey(input: Date | string) {
  if (typeof input === "string") {
    const dateOnly = input.length <= 19 && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(input);
    if (dateOnly && /^\d{4}-\d{2}-\d{2}/.test(input)) return input.slice(0, 10);
  }
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return typeof input === "string" ? input.slice(0, 10) : "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatEventTime(iso: string, allDay?: boolean) {
  if (allDay) return "весь день";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(11, 16) || "—";
  return formatTime(d);
}

export function formatDayLabel(date: Date, locale = "ru-RU") {
  void locale;
  const today = new Date();
  const isToday =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();
  const label = `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return isToday ? `${label} · сегодня` : label;
}

export function formatDue(ts: number) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const today = localDateKey(new Date());
  const key = localDateKey(d);
  const time = formatTime(d);
  if (key === today) return `сегодня ${time}`;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (key === localDateKey(tomorrow)) return `завтра ${time}`;
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")} ${time}`;
}

export function isOverdue(ts?: number | null, done?: boolean) {
  if (!ts || done) return false;
  return ts < Date.now() - 60_000;
}

export function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
