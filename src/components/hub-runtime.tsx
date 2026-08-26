import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchIcsFeed } from "@/lib/server/ics";
import { hubShareList } from "@/lib/server/hub-share";
import { hubTickReminders } from "@/lib/server/hub-nudge";
import { useHub } from "@/lib/stores/hub";
import { useSettings } from "@/lib/stores/settings";
import { useTasks } from "@/lib/stores/tasks";
import { useCalendar } from "@/lib/stores/calendar";
import { useInbox } from "@/lib/stores/inbox";
import { formatDue, localDateKey } from "@/lib/utils";
import { queryClient } from "@/lib/query-client";
import { queryKeysFor } from "@/lib/live/tags";
import { useLive } from "@/lib/live/status";

export function HubRuntime() {
  const token = useHub((s) => s.token);
  const family = useSettings((s) => s.familyShare);
  const icsUrl = useSettings((s) => s.icsUrl);
  const reminders = useSettings((s) => s.reminders);
  const name = useSettings((s) => s.displayName);
  const setIcs = useCalendar((s) => s.setIcs);
  const mergeCal = useCalendar((s) => s.mergeShared);
  const mergeTasks = useTasks((s) => s.mergeShared);
  const mergeNotes = useInbox((s) => s.mergeShared);

  const ics = useQuery({
    queryKey: ["ics", icsUrl],
    queryFn: () => fetchIcsFeed({ data: { url: icsUrl } }),
    enabled: Boolean(icsUrl?.trim()),
    staleTime: 10 * 60_000,
  });

  useEffect(() => {
    if (ics.data && !ics.data.error) setIcs(icsUrl, ics.data.events);
  }, [ics.data, icsUrl, setIcs]);

  const pullShare = useRef(async () => {});
  pullShare.current = async () => {
    if (!token || !family) return;
    try {
      const pack = await hubShareList({ data: { token } });
      mergeTasks(pack.tasks);
      mergeCal(pack.events);
      mergeNotes(pack.notes);
    } catch {
      /* session optional */
    }
  };

  useEffect(() => {
    void pullShare.current();
  }, [token, family]);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    void import("@/lib/live/client")
      .then(({ connectHubLive }) => {
        if (cancelled) return;
        stop = connectHubLive({
          onStatus: (status) => useLive.setState({ status }),
          onInvalidate: (tag) => {
            useLive.setState({ lastTag: tag, at: Date.now() });
            if (tag === "share") {
              void pullShare.current();
              return;
            }
            for (const key of queryKeysFor(tag)) {
              void queryClient.invalidateQueries({ queryKey: key });
            }
          },
        });
      })
      .catch((err) => {
        console.warn("[hub-live]", err);
        useLive.setState({ status: "off" });
      });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  useEffect(() => {
    if (!token) return;
    const prefs = reminders ?? { morning: true, events: true, evening: true };
    const tick = async () => {
      const hour = new Date().getHours();
      const tasks = useTasks.getState().tasks.filter((t) => !t.done);
      const overdue = tasks.filter((t) => t.dueAt && t.dueAt < Date.now());
      const todayKey = localDateKey(new Date());
      const events = useCalendar
        .getState()
        .events.filter((e) => {
          const t = new Date(e.start).getTime();
          return t >= Date.now() && t - Date.now() < 21 * 60_000;
        })
        .map((e) => ({
          id: e.id,
          summary: e.summary,
          minutes: Math.max(0, Math.round((new Date(e.start).getTime() - Date.now()) / 60_000)),
        }));
      const todayEvents = useCalendar
        .getState()
        .events.filter((e) => localDateKey(e.start) === todayKey)
        .slice(0, 4)
        .map((e) => `${formatDue(new Date(e.start).getTime())} ${e.summary}`)
        .join("; ");
      try {
        await hubTickReminders({
          data: {
            token,
            hour,
            morning: prefs.morning
              ? [
                  `Доброе утро${name ? `, ${name}` : ""}.`,
                  tasks.length ? `Открытых задач: ${tasks.length}.` : "Открытых задач нет.",
                  todayEvents ? `Сегодня: ${todayEvents}.` : "Событий на сегодня нет.",
                ].join(" ")
              : undefined,
            evening: prefs.evening
              ? [
                  `Вечерняя сводка${name ? `, ${name}` : ""}.`,
                  overdue.length ? `Просрочено: ${overdue.length}.` : "",
                  tasks.length ? `Ещё открыто: ${tasks.length}.` : "Все дела закрыты.",
                ]
                  .filter(Boolean)
                  .join(" ")
              : undefined,
            events: prefs.events ? events : [],
          },
        });
      } catch {
        /* bot optional */
      }
    };
    void tick();
    const id = window.setInterval(tick, 90_000);
    return () => window.clearInterval(id);
  }, [token, reminders, name]);

  return null;
}
