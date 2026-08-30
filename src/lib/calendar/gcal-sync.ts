import { toast } from "sonner";
import { gcalDeleteEvent, gcalUpsertEvent } from "@/lib/server/gcal";
import { useCalendar } from "@/lib/stores/calendar";
import type { CalEvent } from "@/lib/hub/types";

export function pushEventToPhone(
  token: string | null | undefined,
  event: CalEvent,
  tz: string,
) {
  pushEventToGoogle(token, event, tz);
}

export function removeEventFromPhone(
  token: string | null | undefined,
  event: Pick<CalEvent, "id" | "googleEventId" | "googleCalId" | "shared" | "source">,
) {
  removeEventFromGoogle(token, event);
}

export function pushEventToGoogle(
  token: string | null | undefined,
  event: CalEvent,
  tz: string,
) {
  if (!token) return;
  void gcalUpsertEvent({
    data: {
      token,
      localId: event.id,
      summary: event.summary,
      start: event.start,
      end: event.end,
      shared: Boolean(event.shared || event.source === "shared"),
      tz,
      googleEventId: event.googleEventId,
    },
  })
    .then((res) => {
      if ("googleEventId" in res && res.googleEventId) {
        useCalendar.getState().patch(event.id, {
          googleEventId: res.googleEventId,
          googleCalId: res.calendarId,
        });
      }
    })
    .catch((err: Error) => toast.error(err.message || "Не записалось в Google Календарь"));
}

export function removeEventFromGoogle(
  token: string | null | undefined,
  event: Pick<CalEvent, "googleEventId" | "googleCalId" | "shared" | "source">,
) {
  if (!token || !event.googleEventId) return;
  void gcalDeleteEvent({
    data: {
      token,
      googleEventId: event.googleEventId,
      calendarId: event.googleCalId,
      shared: Boolean(event.shared || event.source === "shared"),
    },
  }).catch((err: Error) => toast.error(err.message || "Не удалилось в Google"));
}
