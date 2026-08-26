import { createServerFn } from "@tanstack/react-start";

export const icloudSave = createServerFn({ method: "POST" })
  .validator((data: { token: string; appleId: string; password: string }) => data)
  .handler(async ({ data }) => {
    const { saveIcloud } = await import("./icloud.server");
    return saveIcloud(data);
  });

export const icloudSaveCalendars = createServerFn({ method: "POST" })
  .validator((data: { token: string; primaryHref: string; familyHref: string }) => data)
  .handler(async ({ data }) => {
    const { saveIcloudCalendars } = await import("./icloud.server");
    return saveIcloudCalendars(data);
  });

export const icloudStatus = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const { statusIcloud } = await import("./icloud.server");
    return statusIcloud(data.token);
  });

export const icloudDisconnect = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const { disconnectIcloud } = await import("./icloud.server");
    return disconnectIcloud(data.token);
  });

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
  .handler(async ({ data }) => {
    const { upsertIcloudEvent } = await import("./icloud.server");
    return upsertIcloudEvent(data);
  });

export const icloudDeleteEvent = createServerFn({ method: "POST" })
  .validator((data: { token: string; href?: string; localId: string; shared?: boolean }) => data)
  .handler(async ({ data }) => {
    const { deleteIcloudEvent } = await import("./icloud.server");
    return deleteIcloudEvent(data);
  });
