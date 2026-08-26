import { useMemo, useState } from "react";
import { Plus, Users, X } from "lucide-react";
import { useCalendar } from "@/lib/stores/calendar";
import { useHub } from "@/lib/stores/hub";
import { useSettings } from "@/lib/stores/settings";
import { hubShareDelete, hubShareUpsert } from "@/lib/server/hub-share";
import { holidaysInRange } from "@/lib/calendar/holidays";
import { AppShell } from "@/components/shell/app-shell";
import { Header } from "@/components/shell/header";
import { Page } from "@/components/shell/page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateField, TimeField, combineLocal, nextHourValue } from "@/components/ui/datetime";
import { haptic } from "@/lib/haptic";
import { pushEventToPhone, removeEventFromPhone } from "@/lib/calendar/gcal-sync";
import { formatDayLabel, formatEventTime, localDateKey } from "@/lib/utils";
import type { CalEvent } from "@/lib/hub/types";

function sourceHint(ev: CalEvent) {
  if (ev.source === "ics") return "iCal";
  if (ev.source === "shared" || ev.shared) return ev.ownerName ? `семья · ${ev.ownerName}` : "семья";
  if (ev.source === "holiday") return "праздник";
  if (ev.icloudHref) return ev.shared ? "семья · iPhone" : "iPhone";
  if (ev.googleEventId) return ev.shared ? "семья · Google" : "Google";
  return "";
}

export function CalendarView() {
  const events = useCalendar((s) => s.events);
  const add = useCalendar((s) => s.add);
  const remove = useCalendar((s) => s.remove);
  const defaults = nextHourValue();
  const [summary, setSummary] = useState("");
  const [date, setDate] = useState(defaults.date);
  const [time, setTime] = useState(defaults.time);
  const [share, setShare] = useState(false);
  const token = useHub((s) => s.token);
  const name = useHub((s) => s.user?.displayName);
  const family = useSettings((s) => s.familyShare);
  const tz = useSettings((s) => s.city.tz);

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

  const addEvent = () => {
    if (!summary.trim()) return;
    const item = add({
      start: combineLocal(date, time),
      summary,
      shared: family && share,
      ownerName: name,
      source: family && share ? "shared" : "local",
    });
    if (item && family && share && token) {
      void hubShareUpsert({ data: { token, kind: "event", payload: item } });
    }
    if (item) pushEventToPhone(token, item, tz);
    setSummary("");
    haptic("medium");
  };

  return (
    <AppShell>
      <Header
        title="Календарь"
        subtitle="локально · Google · праздники"
        backTo="/"
      />
      <Page>
        <Card className="space-y-2 p-4">
          <Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Событие" />
          <div className="flex min-w-0 items-center gap-1.5">
            <DateField value={date} onChange={setDate} />
            <TimeField value={time} onChange={setTime} />
            {family ? (
              <Button
                type="button"
                variant={share ? "default" : "secondary"}
                size="icon"
                className="shrink-0"
                aria-label="Семья"
                onClick={() => setShare((v) => !v)}
              >
                <Users className="size-4" />
              </Button>
            ) : null}
            <Button variant="solid" size="icon" className="shrink-0" aria-label="Добавить событие" onClick={addEvent}>
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
                {d.events.map((ev) => {
                  const hint = sourceHint(ev);
                  const canDelete = ev.source === "local" || ev.source === "shared";
                  return (
                    <div key={ev.id} className="flex items-start gap-2 rounded-full bg-muted px-3 py-2">
                      <span className="mt-0.5 w-16 shrink-0 text-xs font-extrabold tabular-nums text-accent">
                        {formatEventTime(ev.start, ev.allDay)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold">{ev.summary}</div>
                        {hint ? <div className="text-xs text-muted-foreground">{hint}</div> : null}
                      </div>
                      {canDelete ? (
                        <button
                          type="button"
                          onClick={() => {
                            remove(ev.id);
                            if ((ev.shared || ev.source === "shared") && token) {
                              void hubShareDelete({ data: { token, id: ev.id } });
                            }
                            removeEventFromPhone(token, ev);
                          }}
                          className="grid size-8 place-items-center text-muted-foreground"
                          aria-label="Удалить"
                        >
                          <X className="size-4" />
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        ))}
      </Page>
    </AppShell>
  );
}
