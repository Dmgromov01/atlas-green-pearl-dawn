import { hubShareUpsert } from "@/lib/server/hub-share";
import { useCalendar } from "@/lib/stores/calendar";
import { useInbox } from "@/lib/stores/inbox";
import { useTasks } from "@/lib/stores/tasks";
import { pushEventToPhone } from "@/lib/calendar/gcal-sync";
import { useSettings } from "@/lib/stores/settings";
import { parseDue, parseStartIso } from "./action-parse";
import type { HubAction } from "./action-parse";

export type { HubAction } from "./action-parse";
export { parseDue, parseStartIso, splitHubReply } from "./action-parse";

export function applyHubActions(
  actions: HubAction[],
  opts?: { token?: string; name?: string; family?: boolean },
): string[] {
  const labels: string[] = [];
  const family = Boolean(opts?.family);
  const token = opts?.token;
  const name = opts?.name;

  for (const a of actions) {
    const shared = family && Boolean(a.shared);
    if (a.op === "task") {
      const id = useTasks.getState().add({
        text: a.text,
        dueAt: parseDue(a.due),
        repeat: a.repeat ?? "none",
        shared,
        ownerName: name,
      });
      if (!id) continue;
      const item = useTasks.getState().tasks.find((t) => t.id === id);
      if (item && shared && token) {
        void hubShareUpsert({ data: { token, kind: "task", payload: item } });
      }
      labels.push(`задача «${a.text}»`);
    } else if (a.op === "event") {
      const item = useCalendar.getState().add({
        start: parseStartIso(a.start),
        summary: a.summary,
        shared,
        ownerName: name,
        source: shared ? "shared" : "local",
      });
      if (!item) continue;
      if (shared && token) {
        void hubShareUpsert({ data: { token, kind: "event", payload: item } });
      }
      pushEventToPhone(token, item, useSettings.getState().city?.tz ?? "UTC");
      labels.push(`событие «${a.summary}»`);
    } else {
      const note = useInbox.getState().add({ text: a.text, shared, ownerName: name });
      if (!note) continue;
      if (shared && token) {
        void hubShareUpsert({ data: { token, kind: "note", payload: note } });
      }
      labels.push("заметка");
    }
  }
  return labels;
}
