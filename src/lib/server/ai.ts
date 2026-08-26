import { createServerFn } from "@tanstack/react-start";
import { clampText } from "@/lib/sanitize";
import { cached } from "./cache";
import { rateLimit } from "./limit";

const MAX_POSTS = 8;
const MAX_CHARS = 3500;

export const summarizeDigest = createServerFn({ method: "POST" })
  .validator((data: { title: string; posts: string[] }) => data)
  .handler(async ({ data }): Promise<{ text: string; unavailable?: boolean }> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { text: "", unavailable: true };
    if (!rateLimit("ai:summarize", 8, 10 * 60_000)) {
      return { text: "Слишком много запросов. Подождите несколько минут.", unavailable: true };
    }
    const posts = (data.posts ?? []).slice(0, MAX_POSTS).map((p) => clampText(p, 400));
    const blob = posts.join("\n• ");
    if (!blob) return { text: "" };
    const body = clampText(`Источник: ${data.title}\n• ${blob}`, MAX_CHARS);
    const cacheKey = `sum:${data.title}:${posts.length}:${posts[0]?.slice(0, 48) ?? ""}`;
    return cached(cacheKey, 30 * 60_000, async () => {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-4.5",
          max_tokens: 280,
          messages: [
            {
              role: "system",
              content:
                "Ты редактор короткого новостного дайджеста. 3–5 предложений на русском, факты без воды, без эмодзи, без заголовка.",
            },
            { role: "user", content: body },
          ],
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) return { text: "", unavailable: true };
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return { text: json.choices?.[0]?.message?.content?.trim() ?? "" };
    });
  });
