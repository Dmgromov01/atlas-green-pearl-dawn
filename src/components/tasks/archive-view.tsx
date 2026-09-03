import { Trash2, X } from "lucide-react";
import { useTasks } from "@/lib/stores/tasks";
import { AppShell } from "@/components/shell/app-shell";
import { Header } from "@/components/shell/header";
import { Page } from "@/components/shell/page";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { haptic } from "@/lib/haptic";
import { formatDue } from "@/lib/utils";

export function ArchiveView() {
  const { tasks, toggle, remove, clearDone } = useTasks();
  const done = tasks.filter((t) => t.done);

  return (
    <AppShell>
      <Header
        title="Архив дел"
        subtitle="Выполненные задачи"
        backTo="/"
        right={
          done.length > 0 ? (
            <Button
              variant="secondary"
              size="icon-sm"
              aria-label="Очистить архив"
              onClick={() => {
                haptic("heavy");
                clearDone();
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          ) : undefined
        }
      />
      <Page>
        <Card>
          {done.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              В архиве нет выполненных задач.
            </div>
          ) : (
            <div className="space-y-1.5 p-3">
              {done.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-md border border-border bg-muted px-2.5 py-1.5">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    onClick={() => {
                      haptic();
                      toggle(t.id);
                    }}
                  >
                    <div className="grid size-6 shrink-0 place-items-center rounded-lg bg-success text-xs font-bold text-accent-foreground">
                      ✓
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-muted-foreground line-through">{t.text}</span>
                      {t.dueAt ? (
                        <span className="text-[11px] text-muted-foreground">{formatDue(t.dueAt)}</span>
                      ) : null}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(t.id)}
                    className="grid size-8 place-items-center text-muted-foreground hover:text-destructive"
                    aria-label="Удалить"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </Page>
    </AppShell>
  );
}
