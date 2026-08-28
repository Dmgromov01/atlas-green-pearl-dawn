export type Recurrence = "none" | "daily" | "weekly" | "weekdays";

export type ParsedReminder = {
  text: string;
  dueAt: Date;
  recurrence: Recurrence;
};

const WEEKDAYS: Record<string, number> = {
  воскресенье: 0,
  вс: 0,
  понедельник: 1,
  пн: 1,
  вторник: 2,
  вт: 2,
  среда: 3,
  ср: 3,
  четверг: 4,
  чт: 4,
  пятница: 5,
  пт: 5,
  суббота: 6,
  сб: 6,
};

function atHour(base: Date, hour: number, minute: number) {
  const d = new Date(base);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function stripTimeWords(input: string) {
  return input
    .replace(/\bчерез\s+\d+\s+(минут[уы]?|час(?:а|ов)?|дн(?:я|ей|ень))\b/gi, " ")
    .replace(/\bзавтра(?:\s+в\s+\d{1,2}(?::\d{2})?)?\b/gi, " ")
    .replace(/\bсегодня(?:\s+в\s+\d{1,2}(?::\d{2})?)?\b/gi, " ")
    .replace(/\bкаждый\s+день(?:\s+в\s+\d{1,2}(?::\d{2})?)?\b/gi, " ")
    .replace(/\bпо\s+будням(?:\s+в\s+\d{1,2}(?::\d{2})?)?\b/gi, " ")
    .replace(/\bкаждый\s+(понедельник|вторник|среда|четверг|пятница|суббота|воскресенье|пн|вт|ср|чт|пт|сб|вс)(?:\s+в\s+\d{1,2}(?::\d{2})?)?\b/gi, " ")
    .replace(/\bв\s+\d{1,2}(?::\d{2})?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseClock(raw: string | undefined, fallbackHour = 9) {
  if (!raw) return { hour: fallbackHour, minute: 0 };
  const [h, m] = raw.split(":");
  const hour = Math.min(23, Math.max(0, Number(h)));
  const minute = Math.min(59, Math.max(0, Number(m || 0)));
  return { hour, minute };
}

export function parseReminder(input: string, now = new Date()): ParsedReminder | null {
  const raw = input.replace(/\s+/g, " ").trim();
  if (raw.length < 2) return null;

  let due = new Date(now.getTime() + 60 * 60_000);
  let recurrence: Recurrence = "none";

  const through = raw.match(/через\s+(\d+)\s+(минут[уы]?|час(?:а|ов)?|дн(?:я|ей|ень))/i);
  if (through) {
    const n = Number(through[1]);
    const unit = through[2].toLowerCase();
    due = new Date(now);
    if (unit.startsWith("мин")) due.setMinutes(due.getMinutes() + n);
    else if (unit.startsWith("час")) due.setHours(due.getHours() + n);
    else due.setDate(due.getDate() + n);
  }

  const daily = raw.match(/каждый\s+день(?:\s+в\s+(\d{1,2}(?::\d{2})?))?/i);
  const weekdays = raw.match(/по\s+будням(?:\s+в\s+(\d{1,2}(?::\d{2})?))?/i);
  const weekly = raw.match(
    /каждый\s+(понедельник|вторник|среда|четверг|пятница|суббота|воскресенье|пн|вт|ср|чт|пт|сб|вс)(?:\s+в\s+(\d{1,2}(?::\d{2})?))?/i,
  );
  const tomorrow = raw.match(/завтра(?:\s+в\s+(\d{1,2}(?::\d{2})?))?/i);
  const todayClock = raw.match(/(?:сегодня\s+)?в\s+(\d{1,2}(?::\d{2})?)/i);

  if (daily) {
    recurrence = "daily";
    const { hour, minute } = parseClock(daily[1]);
    due = atHour(now, hour, minute);
    if (due.getTime() <= now.getTime()) due.setDate(due.getDate() + 1);
  } else if (weekdays) {
    recurrence = "weekdays";
    const { hour, minute } = parseClock(weekdays[1]);
    due = atHour(now, hour, minute);
    while (due.getTime() <= now.getTime() || due.getDay() === 0 || due.getDay() === 6) {
      due.setDate(due.getDate() + 1);
    }
  } else if (weekly) {
    recurrence = "weekly";
    const want = WEEKDAYS[weekly[1]!.toLowerCase()] ?? 1;
    const { hour, minute } = parseClock(weekly[2]);
    due = atHour(now, hour, minute);
    let guard = 0;
    while ((due.getDay() !== want || due.getTime() <= now.getTime()) && guard < 8) {
      due.setDate(due.getDate() + 1);
      due = atHour(due, hour, minute);
      guard += 1;
    }
  } else if (tomorrow) {
    const { hour, minute } = parseClock(tomorrow[1]);
    due = atHour(now, hour, minute);
    due.setDate(due.getDate() + 1);
  } else if (todayClock && !through) {
    const { hour, minute } = parseClock(todayClock[1]);
    due = atHour(now, hour, minute);
    if (due.getTime() <= now.getTime()) due.setDate(due.getDate() + 1);
  }

  const text = stripTimeWords(raw) || raw;
  return { text: text.slice(0, 280), dueAt: due, recurrence };
}

export function nextDue(due: Date, recurrence: Recurrence) {
  const next = new Date(due);
  if (recurrence === "daily") next.setDate(next.getDate() + 1);
  else if (recurrence === "weekly") next.setDate(next.getDate() + 7);
  else if (recurrence === "weekdays") {
    do next.setDate(next.getDate() + 1);
    while (next.getDay() === 0 || next.getDay() === 6);
  }
  return next;
}

export function recurrenceLabel(r: Recurrence) {
  if (r === "daily") return "каждый день";
  if (r === "weekly") return "каждую неделю";
  if (r === "weekdays") return "по будням";
  return "один раз";
}
