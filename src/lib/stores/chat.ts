import { create } from "zustand";
import { persist } from "zustand/middleware";
import { persistOptions } from "./persist";
import { uid } from "@/lib/utils";
import type { ChatMessage } from "@/lib/hub/types";

type ChatState = {
  messages: ChatMessage[];
  push: (role: ChatMessage["role"], text: string) => ChatMessage;
  popLastUser: () => void;
  reset: () => void;
};

export const useChat = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      push: (role, text) => {
        const msg: ChatMessage = {
          id: uid(),
          role,
          text: text.trim().slice(0, 4000),
          createdAt: Date.now(),
        };
        set((s) => ({ messages: [...s.messages, msg].slice(-40) }));
        return msg;
      },
      popLastUser: () =>
        set((s) => {
          const last = s.messages[s.messages.length - 1];
          if (!last || last.role !== "user") return s;
          return { messages: s.messages.slice(0, -1) };
        }),
      reset: () => set({ messages: [] }),
    }),
    { ...persistOptions("r2d2.chat.v1") },
  ),
);
