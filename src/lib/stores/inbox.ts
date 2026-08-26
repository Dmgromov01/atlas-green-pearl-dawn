import { create } from "zustand";
import { persist } from "zustand/middleware";
import { persistOptions } from "./persist";
import { uid } from "@/lib/utils";
import type { InboxNote } from "@/lib/hub/types";

type InboxState = {
  notes: InboxNote[];
  add: (input: string | Partial<InboxNote> & { text: string }) => InboxNote | void;
  remove: (id: string) => void;
  mergeShared: (items: InboxNote[]) => void;
  reset: () => void;
};

function normalize(input: string | (Partial<InboxNote> & { text: string })): InboxNote {
  if (typeof input === "string") {
    return { id: uid(), text: input.trim().slice(0, 800), createdAt: Date.now() };
  }
  return {
    id: input.id || uid(),
    text: input.text.trim().slice(0, 800),
    createdAt: input.createdAt ?? Date.now(),
    shared: Boolean(input.shared),
    ownerName: input.ownerName,
  };
}

export const useInbox = create<InboxState>()(
  persist(
    (set) => ({
      notes: [],
      add: (input) => {
        const n = normalize(input);
        if (!n.text) return;
        set((s) => ({ notes: [n, ...s.notes.filter((x) => x.id !== n.id)] }));
        return n;
      },
      remove: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),
      mergeShared: (items) => {
        const incoming = items.filter((t) => t.shared);
        set((s) => {
          const keep = s.notes.filter((t) => !t.shared);
          const localShared = s.notes.filter((t) => t.shared && !incoming.some((i) => i.id === t.id));
          return { notes: [...incoming, ...localShared, ...keep] };
        });
      },
      reset: () => set({ notes: [] }),
    }),
    { ...persistOptions("r2d2.inbox.v1") },
  ),
);
