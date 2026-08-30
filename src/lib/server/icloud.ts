import { createServerFn } from "@tanstack/react-start";

const DORMANT = "iCloud CalDAV в хабе отключён. Канон — Google Calendar.";

function rejectDormant(): never {
  throw new Error(DORMANT);
}

/** Kept so stale clients fail closed. CalDAV lives in icloud.server.ts, unused. */
export const icloudSave = createServerFn({ method: "POST" })
  .validator((data: { token: string; appleId: string; password: string }) => data)
  .handler(async () => rejectDormant());

export const icloudSaveCalendars = createServerFn({ method: "POST" })
  .validator((data: { token: string; primaryHref: string; familyHref: string }) => data)
  .handler(async () => rejectDormant());

export const icloudStatus = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async () => ({
    connected: false as const,
    appleId: null,
    familyHref: null,
    error: null,
    note: DORMANT,
  }));

export const icloudDisconnect = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async () => ({ ok: true as const, note: DORMANT }));

export const icloudUpsertEvent = createServerFn({ method: "POST" })
  .validator(
    (data: {
      token: string;
      localId: string;
      summary: string;
      start: string;
      end?: string;
      shared?: boolean;
      href?: string;
    }) => data,
  )
  .handler(async () => rejectDormant());

export const icloudDeleteEvent = createServerFn({ method: "POST" })
  .validator((data: { token: string; href?: string; localId: string; shared?: boolean }) => data)
  .handler(async () => ({ ok: true as const }));

export const icloudCreateCalendar = createServerFn({ method: "POST" })
  .validator(
    (data: {
      token: string;
      name: string;
      color: string;
      asFamily?: boolean;
      asPrimary?: boolean;
      emails?: string;
      publish?: boolean;
      allowInvite?: boolean;
    }) => data,
  )
  .handler(async () => rejectDormant());

export const icloudUpdateCalendar = createServerFn({ method: "POST" })
  .validator(
    (data: {
      token: string;
      href: string;
      name: string;
      color: string;
      asFamily?: boolean;
      asPrimary?: boolean;
      publish?: boolean;
    }) => data,
  )
  .handler(async () => rejectDormant());

export const icloudDeleteCalendar = createServerFn({ method: "POST" })
  .validator((data: { token: string; href: string }) => data)
  .handler(async () => rejectDormant());

export const icloudShareCalendar = createServerFn({ method: "POST" })
  .validator((data: { token: string; href: string; emails: string; write?: boolean }) => data)
  .handler(async () => rejectDormant());

export const icloudUnshareCalendar = createServerFn({ method: "POST" })
  .validator((data: { token: string; href: string; email: string }) => data)
  .handler(async () => rejectDormant());

export const icloudCalendarInfo = createServerFn({ method: "POST" })
  .validator((data: { token: string; href: string }) => data)
  .handler(async () => rejectDormant());
