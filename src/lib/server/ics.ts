import { createServerFn } from "@tanstack/react-start";
import { assertPublicHttps } from "@/lib/sanitize";
import { cached, fetchText } from "./cache";
import { parseIcs } from "@/lib/calendar/ics";
import type { CalEvent } from "@/lib/hub/types";

export const fetchIcsFeed = createServerFn({ method: "POST" })
  .validator((data: { url: string }) => data)
  .handler(async ({ data }): Promise<{ events: CalEvent[]; error?: string }> => {
    const raw = (data.url || "").trim();
    if (!raw) return { events: [] };
    try {
      const url = assertPublicHttps(raw);
      const text = await cached(`ics:${url.href}`, 10 * 60_000, () => fetchText(url.href, 12000, 800_000), "ics");
      const events = parseIcs(text).slice(0, 80);
      return { events };
    } catch (err) {
      return { events: [], error: err instanceof Error ? err.message : "Не удалось прочитать календарь" };
    }
  });
