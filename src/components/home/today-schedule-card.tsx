import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useCalendar } from "@/lib/stores/calendar";
import { Card } from "@/components/ui/card";
import { haptic } from "@/lib/haptic";
import { formatEventTime, localDateKey } from "@/lib/utils";

const WEEKDAYS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

function calendarLabel(source: string) {
  if (source === "google") return "работа";
  if (source === "shared") return "семья";
  return "личный";
}

export function TodayScheduleCard() {
  const navigate = useNavigate();
  const events = useCalendar((s) => s.events);
  const now = new Date();
  const today = localDateKey(now);
  const items = useMemo(() => events.filter((event) => localDateKey(event.start) === today).sort((a, b) => a.start.localeCompare(b.start)), [events, today]);
  const visible = items.slice(0, 3);
  const date = `${WEEKDAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`;

  return (
    <Card className="reference-card">
      <div className="reference-card__header"><h2>Сегодня</h2><span>{date}</span></div>
      {visible.map((event) => (
        <button key={event.id} type="button" className="schedule-row" onClick={() => { haptic("light"); void navigate({ to: "/calendar" }); }}>
          <span className="schedule-row__time">{formatEventTime(event.start, event.allDay)}</span>
          <span className="schedule-row__title">{event.summary}</span>
          <span className="schedule-row__source">{calendarLabel(event.source)}</span>
        </button>
      ))}
      {visible.length === 0 ? <div className="reference-empty">Сегодня встреч нет</div> : null}
      <button type="button" className="reference-more" onClick={() => { haptic("light"); void navigate({ to: "/calendar" }); }}>
        ещё {Math.max(items.length - visible.length, 0)} встреч
      </button>
    </Card>
  );
}
