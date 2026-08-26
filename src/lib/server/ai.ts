import { createServerFn } from "@tanstack/react-start";
import { clampText } from "@/lib/sanitize";
import { cached } from "./cache";
import { rateLimit } from "./limit";
import { extractiveBrief, parseBriefBullets } from "@/lib/digest/brief";

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

export const briefAllSources = createServerFn({ method: "POST" })
  .validator((data: { items: { source: string; text: string }[] }) => data)
  .handler(async ({ data }): Promise<{ bullets: string[]; source: "ai" | "extractive" }> => {
    const items = (data.items ?? []).slice(0, 24);
    const fallback = extractiveBrief(
      items.map((it) => ({ title: it.source, posts: [{ text: it.text }] })),
    );
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey || items.length === 0) return { bullets: fallback, source: "extractive" };
    if (!rateLimit("ai:brief", 10, 10 * 60_000)) return { bullets: fallback, source: "extractive" };

    const blob = items
      .map((it) => `${it.source}: ${clampText(it.text, 180)}`)
      .join("\n");
    const body = clampText(blob, MAX_CHARS);
    const cacheKey = `brief:${items.length}:${items[0]?.text.slice(0, 40) ?? ""}`;

    return cached(cacheKey, 20 * 60_000, async () => {
      try {
        const res = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "grok-4.5",
            max_tokens: 320,
            messages: [
              {
                role: "system",
                content:
                  "Сводка дня по всем источникам сразу. Верни 4–6 пунктов. Каждый пункт с новой строки, начинается с «• », одно предложение до 90 знаков. Без вступления, без заголовка, без эмодзи. Общая картина дня, не копируй заголовки подряд.",
              },
              { role: "user", content: body },
            ],
          }),
          signal: AbortSignal.timeout(18000),
        });
        if (!res.ok) return { bullets: fallback, source: "extractive" as const };
        const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        const bullets = parseBriefBullets(json.choices?.[0]?.message?.content ?? "");
        if (bullets.length < 3) return { bullets: fallback, source: "extractive" as const };
        return { bullets, source: "ai" as const };
      } catch {
        return { bullets: fallback, source: "extractive" as const };
      }
    });
  });
