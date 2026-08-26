import { createFileRoute } from "@tanstack/react-router";
import { ChatView } from "@/components/chat/chat-view";

export const Route = createFileRoute("/chat")({
  validateSearch: (raw: Record<string, unknown>) => ({
    q: typeof raw.q === "string" ? raw.q.slice(0, 400) : undefined,
  }),
  component: ChatView,
});
