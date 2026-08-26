import { createServerFn } from "@tanstack/react-start";
import { clampText } from "@/lib/sanitize";
import { fetchJson } from "./cache";
import { rateLimit } from "./limit";

const MAX = 1500;
const PAIRS = new Set(["en|ru", "ru|en", "es|ru", "ru|es", "de|ru", "ru|de"]);

type MyMemory = {
  responseStatus?: number;
  responseDetails?: string;
  responseData?: { translatedText?: string };
};

export const translateText = createServerFn({ method: "POST" })
  .validator((data: { text: string; pair: string }) => data)
  .handler(async ({ data }): Promise<{ text: string }> => {
    if (!rateLimit("translate", 30, 10 * 60_000)) {
      throw new Error("Слишком много запросов. Подождите немного.");
    }
    const text = clampText(data.text, MAX);
    if (!text) throw new Error("Введите текст");
    const pair = PAIRS.has(data.pair) ? data.pair : "en|ru";
    const url =
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}` +
      `&langpair=${encodeURIComponent(pair)}`;
    let raw: MyMemory;
    try {
      raw = await fetchJson<MyMemory>(url, 10000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("429")) throw new Error("Лимит переводчика. Попробуйте через минуту.");
      throw new Error("Перевод недоступен");
    }
    if (raw.responseStatus && raw.responseStatus !== 200) {
      throw new Error(raw.responseDetails || "Перевод недоступен");
    }
    const out = raw.responseData?.translatedText?.trim() ?? "";
    if (!out) throw new Error("Пустой ответ переводчика");
    return { text: out };
  });
