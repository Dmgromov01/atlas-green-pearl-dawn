import { create } from "zustand";
import { persist } from "zustand/middleware";
import { persistOptions } from "./persist";
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
  icsUrl: string;
  add: (event: Omit<CalEvent, "id" | "source"> & { id?: string; source?: CalEvent["source"] }) => CalEvent | void;
  remove: (id: string) => void;
  patch: (id: string, patch: Partial<CalEvent>) => void;
  setIcs: (url: string, events: CalEvent[]) => void;
  mergeShared: (items: CalEvent[]) => void;
  reset: () => void;
};

export const useCalendar = create<CalState>()(
  persist(
    (set) => ({
      events: [demoEvent()],
      icsUrl: "",
      add: (event) => {
        const summary = event.summary.trim().slice(0, 120);
        if (!summary) return;
        const item: CalEvent = {
          ...event,
          summary,
          id: event.id || uid(),
          source: event.shared ? "shared" : event.source || "local",
        };
        set((s) => ({ events: [...s.events.filter((e) => e.id !== item.id), item] }));
        return item;
      },
      remove: (id) => set((s) => ({ events: s.events.filter((e) => e.id !== id) })),
      patch: (id, patch) =>
        set((s) => ({
          events: s.events.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        })),
      setIcs: (icsUrl, ics) =>
        set((s) => ({
          icsUrl,
          events: [...s.events.filter((e) => e.source !== "ics"), ...ics],
        })),
      mergeShared: (items) => {
        const incoming = items.filter((e) => e.shared || e.source === "shared");
        set((s) => {
          const keep = s.events.filter((e) => e.source !== "shared");
          const localShared = s.events.filter(
            (e) => e.source === "shared" && !incoming.some((i) => i.id === e.id),
          );
          return { events: [...keep, ...localShared, ...incoming] };
        });
      },
      reset: () => set({ events: [], icsUrl: "" }),
    }),
    { ...persistOptions("r2d2.calendar.v2") },
  ),
);
