import { createServerFn } from "@tanstack/react-start";
import { clampText } from "@/lib/sanitize";

export const hubTickReminders = createServerFn({ method: "POST" })
  .validator(
    (data: {
      token: string;
      hour: number;
      morning?: string;
      evening?: string;
      events?: { id: string; summary: string; minutes: number }[];
    }) => data,
  )
  .handler(async ({ data }) => {
    const { tickReminders } = await import("./hub-nudge.server");
    return tickReminders(data.token, {
      hour: data.hour,
      morning: data.morning ? clampText(data.morning, 1400) : undefined,
      evening: data.evening ? clampText(data.evening, 1400) : undefined,
      events: (data.events ?? []).slice(0, 8).map((e) => ({
        id: e.id.slice(0, 80),
        summary: clampText(e.summary, 160),
        minutes: e.minutes,
      })),
    });
  });
