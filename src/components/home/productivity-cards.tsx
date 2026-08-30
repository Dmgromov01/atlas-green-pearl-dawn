import { CalendarPlus, CheckCircle2, Inbox, Plus } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useTasks } from "@/lib/stores/tasks";
import { useCalendar } from "@/lib/stores/calendar";
import { useInbox } from "@/lib/stores/inbox";
import { useHub } from "@/lib/stores/hub";
import { Card } from "@/components/ui/card";
import { haptic } from "@/lib/haptic";

export function QuickActionsCard() {
  const navigate = useNavigate();
  const actions = [
    ["Задача", "/", Plus],
    ["Событие", "/calendar", CalendarPlus],
    ["Inbox", "/", Inbox],
  ] as const;
  return (
    <Card className="p-3">
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Быстрые действия</div>
      <div className="grid grid-cols-4 gap-2">
        {actions.map(([label, path, Icon]) => (
          <button key={label} type="button" className="flex min-w-0 flex-col items-center gap-1 rounded-2xl bg-muted px-1 py-2 text-xs font-semibold" onClick={() => { haptic("medium"); void navigate({ to: path }); }}>
            <Icon className="size-4" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>
    </Card>
  );
}

export function WeeklyReviewCard() {
  const tasks = useTasks((s) => s.tasks);
  const events = useCalendar((s) => s.events);
  const notes = useInbox((s) => s.notes);
  const name = useHub((s) => s.user?.displayName);
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + 7);
  const weekTasks = tasks.filter((task) => !task.done && (!task.dueAt || task.dueAt <= end.getTime()));
  const weekEvents = events.filter((event) => {
    const time = new Date(event.start).getTime();
    return time >= now.getTime() && time <= end.getTime();
  });
  const overdue = tasks.filter((task) => !task.done && task.dueAt && task.dueAt < now.getTime()).length;
  const title = name && name !== "Гость" ? `План на неделю, ${name}` : "План на неделю";
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className="size-4 text-accent" />{title}</div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-muted px-2 py-2"><div className="text-lg font-bold">{weekTasks.length}</div><div className="text-[11px] text-muted-foreground">задач</div></div>
        <div className="rounded-2xl bg-muted px-2 py-2"><div className="text-lg font-bold">{weekEvents.length}</div><div className="text-[11px] text-muted-foreground">событий</div></div>
        <div className="rounded-2xl bg-muted px-2 py-2"><div className="text-lg font-bold">{notes.length}</div><div className="text-[11px] text-muted-foreground">Inbox</div></div>
      </div>
      {overdue ? <p className="mt-3 text-xs font-semibold text-amber-600 dark:text-amber-400">Просрочено задач: {overdue}</p> : null}
      {!weekTasks.length && !weekEvents.length && !notes.length ? <p className="mt-3 text-xs text-muted-foreground">Неделя свободна.</p> : null}
    </Card>
  );
}
