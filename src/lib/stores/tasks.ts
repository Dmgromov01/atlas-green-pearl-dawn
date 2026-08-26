import { create } from "zustand";
import { persist } from "zustand/middleware";
import { persistOptions } from "./persist";
import { uid } from "@/lib/utils";
import { nextDue } from "@/lib/calendar/repeat";
import type { RepeatRule, TaskItem } from "@/lib/hub/types";

type TasksState = {
  tasks: TaskItem[];
  add: (input: string | Partial<TaskItem> & { text: string }) => string | void;
  patch: (id: string, patch: Partial<TaskItem>) => void;
  toggle: (id: string) => void;
  remove: (id: string) => void;
  clearDone: () => void;
  mergeShared: (items: TaskItem[]) => void;
  reset: () => void;
};

const seed: TaskItem[] = [
  {
    id: "seed-1",
    text: "Согласовать спецификацию",
    done: false,
    createdAt: Date.now() - 3600_000,
  },
  {
    id: "seed-2",
    text: "Проверить выгрузку реестра",
    done: true,
    createdAt: Date.now() - 86_400_000,
  },
];

function normalize(input: string | (Partial<TaskItem> & { text: string })): TaskItem {
  if (typeof input === "string") {
    return { id: uid(), text: input.trim().slice(0, 240), done: false, createdAt: Date.now() };
  }
  return {
    id: input.id || uid(),
    text: input.text.trim().slice(0, 240),
    done: Boolean(input.done),
    createdAt: input.createdAt ?? Date.now(),
    dueAt: input.dueAt ?? null,
    repeat: input.repeat ?? "none",
    shared: Boolean(input.shared),
    ownerName: input.ownerName,
  };
}

export const useTasks = create<TasksState>()(
  persist(
    (set, get) => ({
      tasks: seed,
      add: (input) => {
        const t = normalize(input);
        if (!t.text) return;
        set((s) => ({ tasks: [t, ...s.tasks.filter((x) => x.id !== t.id)] }));
        return t.id;
      },
      patch: (id, patch) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      toggle: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== id) return t;
            if (!t.done && t.repeat && t.repeat !== "none" && t.dueAt) {
              const due = nextDue(t.dueAt, t.repeat as RepeatRule);
              return { ...t, done: false, dueAt: due };
            }
            return { ...t, done: !t.done };
          }),
        })),
      remove: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
      clearDone: () => set((s) => ({ tasks: s.tasks.filter((t) => !t.done) })),
      mergeShared: (items) => {
        const incoming = items.filter((t) => t.shared);
        set((s) => {
          const keep = s.tasks.filter((t) => !t.shared);
          const localShared = s.tasks.filter((t) => t.shared && !incoming.some((i) => i.id === t.id));
          return { tasks: [...incoming, ...localShared, ...keep] };
        });
        void get;
      },
      reset: () => set({ tasks: [] }),
    }),
    { ...persistOptions("r2d2.tasks.v2") },
  ),
);
