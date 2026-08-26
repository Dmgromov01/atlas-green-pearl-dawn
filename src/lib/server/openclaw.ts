import { createServerFn } from "@tanstack/react-start";
import { clampText } from "@/lib/sanitize";

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
    const system = [
      "Ты личный ассистент Personal AI Hub. Отвечай кратко по-русски, без эмодзи и без воды.",
      "Если пользователь явно просит добавить задачу, событие или заметку — сделай это, добавив в КОНЕЦ ответа строго такой блок:",
      "<<<HUB",
      '{"actions":[{"op":"task","text":"купить молоко","due":"2026-08-26T18:00","repeat":"none","shared":false}]}',
      "HUB>>>",
      "op: task | event | note. task: text, due (локально YYYY-MM-DDTHH:mm или пусто), repeat none|daily|weekdays|weekly, shared true только если сказано «семье».",
      "event: summary, start (YYYY-MM-DDTHH:mm), shared. note: text, shared.",
      "Не выдумывай действия без явной просьбы. Сначала короткий ответ человеку, блок — только в конце. Даты бери из контекста «Сейчас».",
      data.context ? `Контекст дня:\n${clampText(data.context, 1400)}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    const messages = (data.messages ?? []).slice(-12).map((m) => ({
      role: m.role,
      content: clampText(m.text, 2000),
    }));
    return chatViaUser(user.id, messages, system);
  });
