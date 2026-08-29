import { createServerFn } from "@tanstack/react-start";
import { clampText } from "@/lib/sanitize";
import { agentSystemPrompt } from "@/lib/hub/agent";

export const hubAiProbe = createServerFn({ method: "POST" })
  .validator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    const { probeAiHub } = await import("./openclaw.server");
    return probeAiHub(data.token);
  });

export const hubAiChat = createServerFn({ method: "POST" })
  .validator(
    (data: {
      token: string;
      messages: { role: "user" | "assistant"; text: string }[];
      context?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const { requireHubUser } = await import("./hub-auth.server");
    const { chatViaUser } = await import("./openclaw.server");
    const { user } = await requireHubUser(data.token);
    const messages = (data.messages ?? []).slice(-8).map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
      content: clampText(m.text, 2000),
    }));
    return chatViaUser(user.id, messages, agentSystemPrompt(clampText(data.context ?? "", 3000)));
  });
