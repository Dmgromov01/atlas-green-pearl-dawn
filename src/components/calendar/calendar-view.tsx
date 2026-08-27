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
import { formatEventTime, localDateKey } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { CalEvent } from "@/lib/hub/types";

const WEEKDAYS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

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
  const [selected, setSelected] = useState(defaults.date);
  const token = useHub((s) => s.token);
  const name = useHub((s) => s.user?.displayName);
  const family = useSettings((s) => s.familyShare);
  const tz = useSettings((s) => s.city?.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone);

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
        date: d,
        dow: WEEKDAYS[d.getDay()] ?? "",
        num: d.getDate(),
        events: all.filter((e) => localDateKey(e.start) === key).sort((a, b) => a.start.localeCompare(b.start)),
      };
    });
  }, [events]);

  const current = days.find((d) => d.key === selected) ?? days[0];

  const addEvent = () => {
    if (!summary.trim()) return;
    try {
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
      setSelected(date);
      setSummary("");
      haptic("medium");
    } catch {
      haptic("heavy");
    }
  };

  return (
    <AppShell>
      <Header title="Календарь" subtitle="14 дней · локально и с телефона" backTo="/" />
      <Page>
        <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
          {days.slice(0, 7).map((d) => (
            <button
              key={d.key}
              type="button"
              onClick={() => {
                setSelected(d.key);
                setDate(d.key);
                haptic();
              }}
              className={cn(
                "flex w-11 shrink-0 flex-col items-center rounded-2xl border py-2",
                d.key === selected
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border bg-card text-foreground",
              )}
            >
              <span className="text-[10px] font-semibold uppercase opacity-80">{d.dow}</span>
              <span className="text-sm font-bold tabular-nums">{d.num}</span>
              {d.events.length ? <span className="mt-0.5 size-1 rounded-full bg-current opacity-80" /> : <span className="mt-0.5 size-1" />}
            </button>
          ))}
        </div>

        <Card className="space-y-2 p-3">
          <Input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addEvent();
            }}
            placeholder="Новое событие"
          />
          <div className="flex min-w-0 items-center gap-1.5">
            <DateField value={date} onChange={(v) => { setDate(v); setSelected(v); }} />
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

        <Card className="p-3">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {current ? `${current.dow} ${current.num}` : "День"}
          </div>
          {current && current.events.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">На этот день событий нет</div>
          ) : (
            <div className="space-y-2">
              {current?.events.map((ev) => {
                const hint = sourceHint(ev);
                const canDelete = ev.source === "local" || ev.source === "shared";
                return (
                  <div key={ev.id} className="flex items-start gap-2 rounded-2xl bg-muted px-3 py-2">
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
      </Page>
    </AppShell>
  );
}
