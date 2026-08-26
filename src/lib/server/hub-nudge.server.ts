import { randomBytes } from "node:crypto";
import { getSql } from "@/lib/db";
import { notifyTelegram } from "@/lib/telegram/bot";
import { requireHubUser } from "./hub-auth.server";

function uid() {
  return randomBytes(16).toString("hex");
}

async function claim(userId: string, stamp: string) {
  const sql = await getSql();
  try {
    await sql`insert into hub_nudge (id, user_id, stamp) values (${uid()}, ${userId}, ${stamp})`;
    return true;
  } catch {
    return false;
  }
}

export async function tickReminders(
  token: string,
  input: {
    hour: number;
    morning?: string;
    evening?: string;
    events?: { id: string; summary: string; minutes: number }[];
  },
) {
  const { user } = await requireHubUser(token);
  if (!user.telegram_id) return { sent: 0 };
  const day = new Date().toISOString().slice(0, 10);
  let sent = 0;

  if (input.morning && input.hour >= 7 && input.hour <= 10) {
    if (await claim(user.id, `morning:${day}`)) {
      await notifyTelegram(user.telegram_id, input.morning);
      sent += 1;
    }
  }

  for (const ev of input.events ?? []) {
    if (ev.minutes < 0 || ev.minutes > 20) continue;
    if (await claim(user.id, `event:${ev.id}`)) {
      const when = ev.minutes <= 1 ? "сейчас" : `через ${ev.minutes} мин`;
      await notifyTelegram(user.telegram_id, `Напоминание ${when}: ${ev.summary}`);
      sent += 1;
    }
  }

  if (input.evening && input.hour >= 20 && input.hour <= 21) {
    if (await claim(user.id, `evening:${day}`)) {
      await notifyTelegram(user.telegram_id, input.evening);
      sent += 1;
    }
  }

  return { sent };
}
