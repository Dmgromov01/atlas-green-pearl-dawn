import { useMemo, useState } from "react";
import { CalendarDays, Plus, Users } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useCalendar } from "@/lib/stores/calendar";
import { useHub } from "@/lib/stores/hub";
import { useSettings } from "@/lib/stores/settings";
import { hubShareUpsert } from "@/lib/server/hub-share";
import { holidaysInRange } from "@/lib/calendar/holidays";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TimeField, combineLocal, nextHourValue } from "@/components/ui/datetime";
import { FoldCard } from "@/components/home/fold-card";
import { haptic } from "@/lib/haptic";
import { pushEventToPhone } from "@/lib/calendar/gcal-sync";
import { formatDayLabel, formatEventTime, localDateKey } from "@/lib/utils";
import type { CalEvent } from "@/lib/hub/types";

function upcomingDays(n: number) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function sourceHint(ev: CalEvent) {
  if (ev.source === "ics") return "iCal";
  if (ev.source === "shared" || ev.shared) return ev.ownerName ? `семья · ${ev.ownerName}` : "семья";
  if (ev.source === "holiday") return "праздник";
  return "";
}

export function CalendarCard() {
  const navigate = useNavigate();
  const events = useCalendar((s) => s.events);
  const add = useCalendar((s) => s.add);
  const [draft, setDraft] = useState("");
  const defaults = nextHourValue();
  const [time, setTime] = useState(defaults.time);
  const [share, setShare] = useState(false);
  const token = useHub((s) => s.token);
  const name = useHub((s) => s.user?.displayName);
  const family = useSettings((s) => s.familyShare);
  const tz = useSettings((s) => s.city.tz);

  const days = useMemo(() => {
    const list = upcomingDays(7);
    const from = localDateKey(list[0]!);
    const last = list[6]!;
    const toDate = new Date(last);
    toDate.setDate(last.getDate() + 1);
    const holidays = holidaysInRange(from, localDateKey(toDate));
    const all: CalEvent[] = [...events, ...holidays];
    return list.map((d) => {
      const key = localDateKey(d);
      const dayEvents = all
        .filter((e) => localDateKey(e.start) === key)
        .sort((a, b) => a.start.localeCompare(b.start));
      return { date: d, key, label: formatDayLabel(d), events: dayEvents };
    });
  }, [events]);

  const visible = days.filter((d) => d.events.length > 0);

  const addQuick = () => {
    const summary = draft.trim();
    if (!summary) return;
    const item = add({
      start: combineLocal(defaults.date, time),
      summary,
      shared: family && share,
      ownerName: name,
      source: family && share ? "shared" : "local",
    });
    if (item && family && share && token) {
      void hubShareUpsert({ data: { token, kind: "event", payload: item } });
    }
    if (item) pushEventToPhone(token, item, tz);
    setDraft("");
    haptic("medium");
  };

  const nEvents = visible.reduce((n, d) => n + d.events.length, 0);

  return (
    <FoldCard
      icon={<CalendarDays className="size-4" />}
      title="Календарь"
      status={nEvents ? `${nEvents} на 7 дней` : "ближайшие 7 дней"}
    >
        {visible.length === 0 ? (
          <div className="py-1.5 text-center text-xs text-muted-foreground">На ближайшие 7 дней событий нет.</div>
        ) : (
          visible.map((d) => (
            <div key={d.key} className="rounded-2xl border border-border bg-muted px-3 py-2">
              <div className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{d.label}</div>
              <div className="space-y-1">
                {d.events.map((ev) => {
                  const hint = sourceHint(ev);
                  return (
                    <div key={ev.id} className="flex items-start gap-2">
                      <span className="mt-0.5 w-14 shrink-0 text-xs font-extrabold tabular-nums text-accent">
                        {formatEventTime(ev.start, ev.allDay)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold leading-snug">{ev.summary}</div>
                        {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
        <div className="flex min-w-0 items-center gap-1.5 pt-0.5">
          <Input
            className="min-w-0 flex-1"
            placeholder="Новое событие…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addQuick();
            }}
          />
          <TimeField value={time} onChange={setTime} />
          {family ? (
            <Button type="button" variant={share ? "default" : "secondary"} size="icon" className="shrink-0" onClick={() => setShare((v) => !v)} aria-label="Семья">
              <Users className="size-4" />
            </Button>
          ) : null}
          <Button type="button" variant="solid" size="icon" className="shrink-0" onClick={addQuick} aria-label="Добавить событие">
            <Plus className="size-4" />
          </Button>
        </div>
      <button
        type="button"
        className="flex h-9 w-full items-center justify-center text-xs font-semibold text-muted-foreground"
        onClick={() => {
          haptic();
          navigate({ to: "/calendar" });
        }}
      >
        Открыть календарь
      </button>
    </FoldCard>
  );
}
