import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Clock, Mic, Plus, SquareCheckBig, Users, X } from "lucide-react";
import { useTasks } from "@/lib/stores/tasks";
import { useHub } from "@/lib/stores/hub";
import { useSettings } from "@/lib/stores/settings";
import { hubShareDelete, hubShareUpsert } from "@/lib/server/hub-share";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DateField, TimeField, combineLocal, nextHourValue } from "@/components/ui/datetime";
import { FoldCard } from "@/components/home/fold-card";
import { startDictation } from "@/lib/voice";
import { haptic } from "@/lib/haptic";
import { cn, formatDue, isOverdue } from "@/lib/utils";
import { REPEAT_LABEL } from "@/lib/calendar/repeat";
import type { RepeatRule, TaskItem } from "@/lib/hub/types";

export function TasksCard() {
  const navigate = useNavigate();
  const { tasks, add, toggle, remove } = useTasks();
  const token = useHub((s) => s.token);
  const name = useHub((s) => s.user?.displayName);
  const family = useSettings((s) => s.familyShare);
  const [value, setValue] = useState("");
  const [openMore, setOpenMore] = useState(false);
  const defaults = nextHourValue();
  const [date, setDate] = useState(defaults.date);
  const [time, setTime] = useState(defaults.time);
  const [repeat, setRepeat] = useState<RepeatRule>("none");
  const [share, setShare] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const active = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);

  const persistShare = (item: TaskItem | void) => {
    if (item && item.shared && token) {
      void hubShareUpsert({ data: { token, kind: "task", payload: item } });
    }
  };

  const submit = (text?: string) => {
    const id = add({
      text: text ?? value,
      dueAt: openMore ? new Date(combineLocal(date, time)).getTime() : null,
      repeat: openMore ? repeat : "none",
      shared: family && share,
      ownerName: name,
    });
    const item = useTasks.getState().tasks.find((t) => t.id === id);
    persistShare(item);
    setValue("");
    haptic("medium");
  };

  return (
    <FoldCard
      icon={<SquareCheckBig className="size-4" />}
      title="Задачи"
      status={`${active.length} активных · ${done.length} в архиве`}
    >
      {active.slice(0, 6).map((t) => (
        <div key={t.id} className="flex items-center gap-2 rounded-full border border-border bg-muted px-2.5 py-1.5">
          <button
            type="button"
            onClick={() => {
              haptic();
              toggle(t.id);
              const next = useTasks.getState().tasks.find((x) => x.id === t.id);
              if (t.shared && token) {
                if (next && !next.done) persistShare(next);
                else void hubShareDelete({ data: { token, id: t.id } });
              }
            }}
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-lg border-2 border-border-strong bg-card",
              t.done && "border-accent bg-accent text-accent-foreground",
            )}
            aria-label={t.done ? "Вернуть" : "Выполнить"}
          >
            {t.done ? <span className="text-xs font-black">✓</span> : null}
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold leading-snug text-foreground">{t.text}</div>
            <div
              className={cn(
                "text-[11px] font-medium tabular-nums text-muted-foreground",
                isOverdue(t.dueAt, t.done) && "text-destructive",
              )}
            >
              {[
                t.dueAt ? formatDue(t.dueAt) : null,
                t.repeat && t.repeat !== "none" ? REPEAT_LABEL[t.repeat] : null,
                t.shared ? "семья" : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              haptic();
              remove(t.id);
              if (t.shared && token) void hubShareDelete({ data: { token, id: t.id } });
            }}
            className="grid size-8 place-items-center text-muted-foreground hover:text-destructive"
            aria-label="Удалить"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
      {active.length === 0 ? (
        <div className="py-2 text-center text-xs text-muted-foreground">Все дела выполнены. Добавьте новую задачу.</div>
      ) : null}
      {openMore ? (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <DateField value={date} onChange={setDate} />
          <TimeField value={time} onChange={setTime} />
          <select
            value={repeat}
            onChange={(e) => setRepeat(e.target.value as RepeatRule)}
            className="h-9 min-w-0 flex-1 rounded-full border border-border bg-muted px-3 text-xs font-bold"
            aria-label="Повтор"
          >
            {(Object.keys(REPEAT_LABEL) as RepeatRule[]).map((k) => (
              <option key={k} value={k}>
                {REPEAT_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="flex min-w-0 items-center gap-1.5 pt-1">
        <Input
          placeholder="Новая задача…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          className="min-w-0 flex-1"
        />
        <Button type="button" variant={openMore ? "default" : "secondary"} size="icon" className="shrink-0" onClick={() => setOpenMore((v) => !v)} aria-label="Срок">
          <Clock className="size-4" />
        </Button>
        {family ? (
          <Button type="button" variant={share ? "default" : "secondary"} size="icon" className="shrink-0" onClick={() => setShare((v) => !v)} aria-label="Семья">
            <Users className="size-4" />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="shrink-0"
          onClick={() =>
            startDictation(
              (t) => setValue(t),
              (msg) => {
                setVoiceError(msg);
                setTimeout(() => setVoiceError(""), 2500);
              },
            )
          }
          aria-label="Надиктовать"
        >
          <Mic className="size-4" />
        </Button>
        <Button type="button" variant="solid" size="icon" className="shrink-0" onClick={() => submit()} aria-label="Добавить">
          <Plus className="size-4" />
        </Button>
      </div>
      {voiceError ? <div className="text-xs font-semibold text-destructive">{voiceError}</div> : null}
      {done.length ? (
        <button
          type="button"
          className="flex h-9 w-full items-center justify-center text-xs font-semibold text-muted-foreground"
          onClick={() => {
            haptic();
            navigate({ to: "/archive" });
          }}
        >
          Архив · {done.length}
        </button>
      ) : null}
    </FoldCard>
  );
}
