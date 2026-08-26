import { create } from "zustand";
import { persist } from "zustand/middleware";
import { uid } from "@/lib/utils";
import type { CalEvent } from "@/lib/hub/types";

function demoEvent(): CalEvent {
  const start = new Date(Date.now() + 2 * 3600_000);
  start.setMinutes(0, 0, 0);
  return {
    id: "seed-cal-1",
    start: start.toISOString(),
    summary: "Созвон по проекту",
    source: "local",
  };
}

type CalState = {
  events: CalEvent[];
  add: (event: Omit<CalEvent, "id" | "source">) => void;
  remove: (id: string) => void;
  reset: () => void;
};

export const useCalendar = create<CalState>()(
  persist(
    (set) => ({
      events: [demoEvent()],
      add: (event) => {
        const summary = event.summary.trim().slice(0, 120);
        if (!summary) return;
        set((s) => ({
          events: [...s.events, { ...event, summary, id: uid(), source: "local" as const }],
        }));
      },
      remove: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
      reset: () => set({ events: [] }),
    }),
    { name: "r2d2.calendar.v1" },
  ),
);
