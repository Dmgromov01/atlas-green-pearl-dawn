import { toast } from "sonner";
import { gcalDeleteEvent, gcalUpsertEvent } from "@/lib/server/gcal";
import { icloudDeleteEvent, icloudUpsertEvent } from "@/lib/server/icloud";
import { useCalendar } from "@/lib/stores/calendar";
import type { CalEvent } from "@/lib/hub/types";
import { useSettings } from "@/lib/stores/settings";

export function pushEventToPhone(
  token: string | null | undefined,
  event: CalEvent,
  tz: string,
) {
  pushEventToIcloud(token, event);
  pushEventToGoogle(token, event, tz);
}

export function removeEventFromPhone(
  token: string | null | undefined,
  event: Pick<CalEvent, "id" | "googleEventId" | "googleCalId" | "icloudHref" | "shared" | "source">,
) {
  removeEventFromIcloud(token, event);
  removeEventFromGoogle(token, event);
}

function toFamily(event: Pick<CalEvent, "shared" | "source">) {
  const mode = useSettings.getState().icloudCal ?? "family";
  return mode === "family" || Boolean(event.shared || event.source === "shared");
}

export function pushEventToIcloud(token: string | null | undefined, event: CalEvent) {
  if (!token) return;
  void icloudUpsertEvent({
    data: {
      token,
      localId: event.id,
      summary: event.summary,
      start: event.start,
      end: event.end,
      shared: toFamily(event),
      href: event.icloudHref,
    },
  })
    .then((res) => {
      if ("href" in res && res.href) {
        useCalendar.getState().patch(event.id, { icloudHref: res.href });
      }
    })
    .catch((err: Error) => {
      if (!/не выбран|не установлен|Сначала/i.test(err.message || "") && err.message !== "Сначала подключите Google") {
        toast.error(err.message || "Не записалось в iCloud");
      }
    });
}

export function removeEventFromIcloud(
  token: string | null | undefined,
  event: Pick<CalEvent, "id" | "icloudHref" | "shared" | "source">,
) {
  if (!token) return;
  void icloudDeleteEvent({
    data: {
      token,
      href: event.icloudHref,
      localId: event.id,
      shared: toFamily(event),
    },
  }).catch(() => {});
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
