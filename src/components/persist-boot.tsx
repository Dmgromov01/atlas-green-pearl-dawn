import { useEffect } from "react";
import { useSettings } from "@/lib/stores/settings";
import { useTasks } from "@/lib/stores/tasks";
import { useCalendar } from "@/lib/stores/calendar";
import { useInbox } from "@/lib/stores/inbox";
import { useChat } from "@/lib/stores/chat";
import { useDictionary } from "@/lib/stores/dictionary";
import { useSources } from "@/lib/stores/sources";

const stores = [
  useSettings,
  useTasks,
  useCalendar,
  useInbox,
  useChat,
  useDictionary,
  useSources,
] as const;

export function PersistBoot() {
  useEffect(() => {
    for (const store of stores) {
      try {
        if (!store.persist.hasHydrated()) {
          void Promise.resolve(store.persist.rehydrate()).catch(() => {});
        }
      } catch {
        /* iframe storage can throw */
      }
    }
  }, []);
  return null;
}
