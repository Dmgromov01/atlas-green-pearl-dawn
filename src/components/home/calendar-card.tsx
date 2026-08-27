import { useMemo } from "react";
import { CalendarDays } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useCalendar } from "@/lib/stores/calendar";
import { holidaysInRange } from "@/lib/calendar/holidays";
import { Card } from "@/components/ui/card";
import { ServiceRow } from "@/components/shell/service-row";
import { haptic } from "@/lib/haptic";
import { localDateKey } from "@/lib/utils";
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

  const nEvents = useMemo(() => {
    const list = upcomingDays(7);
    const from = localDateKey(list[0]!);
    const last = list[6]!;
    const toDate = new Date(last);
    toDate.setDate(last.getDate() + 1);
    const all: CalEvent[] = [...events, ...holidaysInRange(from, localDateKey(toDate))];
    const keys = new Set(list.map((d) => localDateKey(d)));
    return all.filter((e) => keys.has(localDateKey(e.start))).length;
  }, [events]);

  return (
    <Card>
      <ServiceRow
        icon={<CalendarDays className="size-4" />}
        title="Календарь"
        status={nEvents ? `${nEvents} на 7 дней` : "ближайшие 7 дней"}
        onClick={() => {
          haptic("medium");
          navigate({ to: "/calendar" });
        }}
      />
    </Card>
  );
}
