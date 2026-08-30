import { CalendarDays, Inbox, Sparkles, SquareCheckBig } from "lucide-react";
import { useTasks } from "@/lib/stores/tasks";
import { useCalendar } from "@/lib/stores/calendar";
import { useInbox } from "@/lib/stores/inbox";
import { IconWell } from "@/components/shell/icon-well";
import { FoldCard } from "@/components/home/fold-card";
import { formatEventTime, isOverdue, localDateKey } from "@/lib/utils";

const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const WEEKDAYS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

export function TodayCard() {
  const tasks = useTasks((s) => s.tasks);
  const events = useCalendar((s) => s.events);
  const notes = useInbox((s) => s.notes);
  const open = tasks.filter((t) => !t.done);

  const now = new Date();
  const today = localDateKey(now);
  const next = events
    .filter((e) => localDateKey(e.start) === today)
    .sort((a, b) => a.start.localeCompare(b.start))[0];
  const overdue = open.filter((t) => isOverdue(t.dueAt, t.done));
  const dateLabel = `${WEEKDAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}`;

  const bits = [
    open.length ? `${open.length} задач` : "задач нет",
    next ? formatEventTime(next.start, next.allDay) : null,
  ].filter(Boolean);

  return (
    <FoldCard icon={<Sparkles className="size-4" />} title="Сегодня" status={`${dateLabel} · ${bits.join(" · ")}`} accent>
      <div className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2">
        <IconWell className="size-7">
          <SquareCheckBig className="size-3.5" />
        </IconWell>
        <div className="min-w-0 text-sm font-semibold">
          {open.length ? `${open.length} задач` : "задач нет"}
          {overdue.length ? ` · ${overdue.length} просроч.` : ""}
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2">
        <IconWell className="size-7">
          <CalendarDays className="size-3.5" />
        </IconWell>
        <div className="min-w-0 truncate text-sm font-semibold">
          {next ? `${formatEventTime(next.start, next.allDay)} ${next.summary}` : "событий нет"}
        </div>
      </div>
      {notes.length ? (
        <div className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2">
          <IconWell className="size-7">
            <Inbox className="size-3.5" />
          </IconWell>
          <div className="min-w-0 text-sm font-semibold">{notes.length} в Inbox</div>
        </div>
      ) : null}
    </FoldCard>
  );
}
