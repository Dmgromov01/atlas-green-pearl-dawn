import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Newspaper, SquareCheckBig } from "lucide-react";
import { useTasks } from "@/lib/stores/tasks";
import { useSettings } from "@/lib/stores/settings";
import { haptic } from "@/lib/haptic";
import { IconWell } from "@/components/shell/icon-well";

export function SummaryStrip() {
  const navigate = useNavigate();
  const enabled = useSettings((s) => s.enabledModules);
  const on = (id: "tasks" | "digest") => enabled === "all" || enabled.includes(id);
  const active = useTasks((s) => s.tasks.filter((t) => !t.done).length);

  const pills = [
    on("tasks")
      ? {
          id: "tasks",
          icon: <SquareCheckBig className="size-4" />,
          label: `${active} задач`,
          onClick: () => {
            haptic();
            document.getElementById("tasks-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
          },
        }
      : null,
    on("digest")
      ? {
          id: "digest",
          icon: <Newspaper className="size-4" />,
          label: "Дайджест",
          onClick: () => {
            haptic("medium");
            navigate({ to: "/digest" });
          },
        }
      : null,
  ].filter(Boolean) as { id: string; icon: ReactNode; label: string; onClick: () => void }[];

  if (!pills.length) return null;

  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 sm:px-6">
      {pills.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={p.onClick}
          className="flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-2 text-foreground transition-transform duration-150 active:scale-[0.98]"
        >
          <IconWell className="size-6 shrink-0 border-0 bg-muted text-foreground">{p.icon}</IconWell>
          <span className="truncate text-xs font-semibold">{p.label}</span>
        </button>
      ))}
    </div>
  );
}
