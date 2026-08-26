import { createServerFn } from "@tanstack/react-start";

export const gcalSaveCreds = createServerFn({ method: "POST" })
  .validator(
    (data: { token: string; clientId: string; clientSecret: string; refreshToken: string }) => data,
  )
  .handler(async ({ data }) => {
    const { saveGcalCreds } = await import("./gcal.server");
    return saveGcalCreds(data);
  });

export const gcalSaveCalendars = createServerFn({ method: "POST" })
  .validator((data: { token: string; primaryId: string; familyId: string }) => data)
  .handler(async ({ data }) => {
    const { saveGcalCalendars } = await import("./gcal.server");
    return saveGcalCalendars(data);
  });

export const gcalStatus = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const mod = await import("./gcal.server");
    return mod.statusGcal(data.token);
  });

export const gcalDisconnect = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const { disconnectGcal } = await import("./gcal.server");
    return disconnectGcal(data.token);
  });

export const gcalUpsertEvent = createServerFn({ method: "POST" })
  .validator(
    (data: {
      token: string;
      localId: string;
      summary: string;
      start: string;
      end?: string;
      shared?: boolean;
      tz?: string;
      googleEventId?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { upsertGcalEvent } = await import("./gcal.server");
    return upsertGcalEvent(data);
  });

export const gcalDeleteEvent = createServerFn({ method: "POST" })
  .validator(
    (data: { token: string; googleEventId: string; calendarId?: string; shared?: boolean }) => data,
  )
  .handler(async ({ data }) => {
    const { deleteGcalEvent } = await import("./gcal.server");
    return deleteGcalEvent(data);
  });

export const gcalCreateFamily = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const { createFamilyCalendar } = await import("./gcal.server");
    return createFamilyCalendar(data.token);
  });

export const gcalShareFamily = createServerFn({ method: "POST" })
  .validator((data: { token: string; emails: string }) => data)
  .handler(async ({ data }) => {
    const { shareFamilyCalendar } = await import("./gcal.server");
    return shareFamilyCalendar(data);
  });

export const gcalCreateCalendar = createServerFn({ method: "POST" })
  .validator(
    (data: {
      token: string;
      name: string;
      color: string;
      asFamily?: boolean;
      asPrimary?: boolean;
      emails?: string;
      publish?: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { createGcalCalendar } = await import("./gcal.server");
    return createGcalCalendar(data);
  });

export const gcalUpdateCalendar = createServerFn({ method: "POST" })
  .validator(
    (data: {
      token: string;
      id: string;
      name: string;
      color: string;
      asFamily?: boolean;
      asPrimary?: boolean;
      publish?: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { updateGcalCalendar } = await import("./gcal.server");
    return updateGcalCalendar(data);
  });

export const gcalDeleteCalendar = createServerFn({ method: "POST" })
  .validator((data: { token: string; id: string }) => data)
  .handler(async ({ data }) => {
    const { deleteGcalCalendar } = await import("./gcal.server");
    return deleteGcalCalendar(data);
  });

export const gcalShareCalendar = createServerFn({ method: "POST" })
  .validator((data: { token: string; id: string; emails: string; write?: boolean }) => data)
  .handler(async ({ data }) => {
    const { shareGcalCalendar } = await import("./gcal.server");
    return shareGcalCalendar(data);
  });

export const gcalUnshareCalendar = createServerFn({ method: "POST" })
  .validator((data: { token: string; id: string; email: string }) => data)
  .handler(async ({ data }) => {
    const { unshareGcalCalendar } = await import("./gcal.server");
    return unshareGcalCalendar(data);
  });

export const gcalCalendarInfo = createServerFn({ method: "POST" })
  .validator((data: { token: string; id: string }) => data)
  .handler(async ({ data }) => {
    const { calendarInfoGcal } = await import("./gcal.server");
    return calendarInfoGcal(data);
  });
