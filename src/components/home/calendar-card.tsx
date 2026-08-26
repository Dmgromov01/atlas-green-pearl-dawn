import { useMemo, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useCalendar } from "@/lib/stores/calendar";
import { holidaysInRange } from "@/lib/calendar/holidays";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TimeField, combineLocal, nextHourValue } from "@/components/ui/datetime";
import { ServiceRow } from "@/components/shell/service-row";
import { haptic } from "@/lib/haptic";
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

export function CalendarCard() {
  const navigate = useNavigate();
  const events = useCalendar((s) => s.events);
  const add = useCalendar((s) => s.add);
  const [draft, setDraft] = useState("");
  const defaults = nextHourValue();
  const [time, setTime] = useState(defaults.time);

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
    add({ start: combineLocal(defaults.date, time), summary });
    setDraft("");
    haptic("medium");
  };

  return (
    <Card>
      <ServiceRow
        icon={<CalendarDays className="size-5" />}
        title="Календарь"
        status="7 дней · локальные события и праздники"
        onClick={() => {
          haptic();
          navigate({ to: "/calendar" });
        }}
      />
      <div className="space-y-2 border-t border-border px-4 py-3">
        {visible.length === 0 ? (
          <div className="py-2 text-center text-xs text-muted-foreground">На ближайшие 7 дней событий нет.</div>
        ) : (
          visible.map((d) => (
            <div key={d.key} className="rounded-xl border border-border bg-muted p-3">
              <div className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">{d.label}</div>
              <div className="space-y-1.5">
                {d.events.map((ev) => (
                  <div key={ev.id} className="flex items-start gap-2">
                    <span className="mt-0.5 w-16 shrink-0 text-xs font-extrabold tabular-nums text-accent">
                      {formatEventTime(ev.start, ev.allDay)}
                    </span>
                    <div className="min-w-0 flex-1 text-sm font-semibold leading-snug">{ev.summary}</div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
        <div className="flex gap-2 pt-1">
          <Input
            placeholder="Новое событие…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addQuick();
            }}
          />
          <TimeField value={time} onChange={setTime} />
          <Button type="button" variant="solid" size="icon" onClick={addQuick} aria-label="Добавить событие">
            <Plus className="size-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
