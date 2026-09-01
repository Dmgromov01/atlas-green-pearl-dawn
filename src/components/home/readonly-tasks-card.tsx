import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTasks } from "@/lib/stores/tasks";
import { Card } from "@/components/ui/card";
import { haptic } from "@/lib/haptic";

export function ReadonlyTasksCard() {
  const navigate = useNavigate();
  const allTasks = useTasks((state) => state.tasks);
  const tasks = useMemo(() => allTasks.filter((task) => !task.done), [allTasks]);
  const visible = tasks.slice(0, 3);
  return (
    <Card className="reference-card">
      <div className="reference-card__header"><h2>Задачи</h2><span>{tasks.length}</span></div>
      {visible.map((task) => (
        <button key={task.id} type="button" className="task-row" onClick={() => { haptic("light"); void navigate({ to: "/archive" }); }}>
          <span className="task-row__title">{task.text}</span>
          <span className="task-row__subtitle">{task.dueAt ? "Сегодня" : "Без срока"}</span>
        </button>
      ))}
      {visible.length === 0 ? <div className="reference-empty">Открытых задач нет</div> : null}
      <button type="button" className="reference-more" onClick={() => { haptic("light"); void navigate({ to: "/archive" }); }}>
        ещё {Math.max(tasks.length - visible.length, 0)}
      </button>
    </Card>
  );
}
