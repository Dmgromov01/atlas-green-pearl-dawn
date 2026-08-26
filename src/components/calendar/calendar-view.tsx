import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { useCalendar } from "@/lib/stores/calendar";
import { holidaysInRange } from "@/lib/calendar/holidays";
import { AppShell } from "@/components/shell/app-shell";
import { Header } from "@/components/shell/header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateField, TimeField, combineLocal, nextHourValue } from "@/components/ui/datetime";
import { haptic } from "@/lib/haptic";
import { formatDayLabel, formatEventTime, localDateKey } from "@/lib/utils";
import type { CalEvent } from "@/lib/hub/types";

export function CalendarView() {
  const events = useCalendar((s) => s.events);
  const add = useCalendar((s) => s.add);
  const remove = useCalendar((s) => s.remove);
  const defaults = nextHourValue();
  const [summary, setSummary] = useState("");
  const [date, setDate] = useState(defaults.date);
  const [time, setTime] = useState(defaults.time);

  const days = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const list = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
    const last = list.at(-1)!;
    const to = new Date(last);
    to.setDate(last.getDate() + 1);
    const all: CalEvent[] = [...events, ...holidaysInRange(localDateKey(list[0]!), localDateKey(to))];
    return list.map((d) => {
      const key = localDateKey(d);
      return {
        key,
        label: formatDayLabel(d),
        events: all.filter((e) => localDateKey(e.start) === key).sort((a, b) => a.start.localeCompare(b.start)),
      };
    });
  }, [events]);

  return (
    <AppShell>
      <Header title="Календарь" subtitle="14 дней · локально + праздники" backTo="/" />
      <div className="space-y-3 px-4">
        <Card className="space-y-2 p-4">
          <Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Событие" />
          <div className="flex gap-2">
            <DateField value={date} onChange={setDate} />
            <TimeField value={time} onChange={setTime} />
            <Button
              size="icon"
              onClick={() => {
                if (!summary.trim()) return;
                add({ start: combineLocal(date, time), summary });
                setSummary("");
                haptic("medium");
              }}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </Card>
        {days.map((d) => (
          <Card key={d.key} className="p-4">
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{d.label}</div>
            {d.events.length === 0 ? (
              <div className="text-sm text-muted-foreground">Нет событий</div>
            ) : (
              <div className="space-y-2">
                {d.events.map((ev) => (
                  <div key={ev.id} className="flex items-start gap-2">
                    <span className="mt-0.5 w-16 shrink-0 text-xs font-extrabold tabular-nums text-accent">
                      {formatEventTime(ev.start, ev.allDay)}
                    </span>
                    <div className="min-w-0 flex-1 text-sm font-semibold">{ev.summary}</div>
                    {ev.source === "local" ? (
                      <button
                        type="button"
                        onClick={() => remove(ev.id)}
                        className="grid size-8 place-items-center text-muted-foreground"
                        aria-label="Удалить"
                      >
                        <X className="size-4" />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </AppShell>
  );
}
