import { createServerFn } from "@tanstack/react-start";
import type { CalEvent, InboxNote, TaskItem } from "@/lib/hub/types";

export const hubShareList = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const { listShare } = await import("./hub-share.server");
    return listShare(data.token);
  });

export const hubShareUpsert = createServerFn({ method: "POST" })
  .validator(
    (data: {
      token: string;
      kind: "task" | "event" | "note";
      payload: TaskItem | CalEvent | InboxNote;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { upsertShare } = await import("./hub-share.server");
    return upsertShare(data.token, data.kind, data.payload);
  });

export const hubShareDelete = createServerFn({ method: "POST" })
  .validator((data: { token: string; id: string }) => data)
  .handler(async ({ data }) => {
    const { deleteShare } = await import("./hub-share.server");
    return deleteShare(data.token, data.id);
  });
