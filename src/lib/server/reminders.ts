import { createServerFn } from "@tanstack/react-start";
import type { Recurrence } from "@/lib/reminders/parse";

export const reminderPreview = createServerFn({ method: "POST" })
  .validator((data: { text: string }) => data)
  .handler(async ({ data }) => {
    const { previewReminder } = await import("./reminders.server");
    return previewReminder(data.text);
  });

export const reminderCreate = createServerFn({ method: "POST" })
  .validator(
    (data: {
      token?: string;
      text: string;
      dueAt?: string;
      recurrence?: Recurrence;
      source?: "user" | "agent";
    }) => data,
  )
  .handler(async ({ data }) => {
    const { createReminder } = await import("./reminders.server");
    return createReminder(data.token, data);
  });

export const reminderList = createServerFn({ method: "POST" })
  .validator((data?: { token?: string }) => data ?? {})
  .handler(async ({ data }) => {
    const { listReminders } = await import("./reminders.server");
    return listReminders(data.token);
  });

export const reminderDelete = createServerFn({ method: "POST" })
  .validator((data: { token?: string; id: string }) => data)
  .handler(async ({ data }) => {
    const { deleteReminder } = await import("./reminders.server");
    return deleteReminder(data.token, data.id);
  });
