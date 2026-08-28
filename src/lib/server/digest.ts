import { createServerFn } from "@tanstack/react-start";
import { assertPublicHttps, stripHtml } from "@/lib/sanitize";
import { cached, fetchText } from "./cache";

export type DigestPost = { text: string; date?: string; url?: string; title?: string };
export type DigestBlock = { title: string; type: "rss" | "tg"; posts: DigestPost[]; error?: string };
export type DigestResult = { blocks: DigestBlock[]; total: number; ts: number; ranked?: DigestPost[] };

type SourceIn = { type: "rss" | "tg"; name: string; title: string };

function tag(xml: string, name: string) {
  const cdata = xml.match(new RegExp(`<${name}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${name}>`, "i"));
  if (cdata?.[1]) return cdata[1];
  const plain = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return plain?.[1] ?? "";
}

function linkOf(chunk: string) {
  const href = chunk.match(/<link[^>]*href=["']([^"']+)["']/i);
  if (href?.[1]) return stripHtml(href[1]);
  return stripHtml(tag(chunk, "link") || tag(chunk, "guid") || tag(chunk, "id"));
}

export function parseFeed(xml: string): DigestPost[] {
  const items = [...xml.matchAll(/<item[\s\S]*?<\/item>/gi), ...xml.matchAll(/<entry[\s\S]*?<\/entry>/gi)];
  const out: DigestPost[] = [];
  for (const m of items.slice(0, 16)) {
    const chunk = m[0];
    const title = stripHtml(tag(chunk, "title"));
    const desc = stripHtml(tag(chunk, "description") || tag(chunk, "summary") || tag(chunk, "content"));
    const date = stripHtml(tag(chunk, "pubDate") || tag(chunk, "updated") || tag(chunk, "published"));
    const url = linkOf(chunk);
    const text = [title, desc].filter(Boolean).join(" — ").slice(0, 900);
    if (text) out.push({ text, date: date || undefined, url: url || undefined, title: title || undefined });
  }
  return out;
}

export async function loadRss(url: string): Promise<DigestPost[]> {
  const safe = assertPublicHttps(url);
  const xml = await cached(`rss:${safe.href}`, 12 * 60_000, () => fetchText(safe.href, 9000, 600_000), "digest");
  return parseFeed(xml);
}

function rankPosts(blocks: DigestBlock[]) {
  const now = Date.now();
  const seen = new Set<string>();
  const ranked: (DigestPost & { score: number; source: string })[] = [];
  blocks.forEach((block, sourceRank) => {
    for (const post of block.posts) {
      const key = (post.url || post.title || post.text).slice(0, 180).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const published = post.date ? Date.parse(post.date) : now;
      const ageH = Number.isFinite(published) ? Math.max(0, (now - published) / 3_600_000) : 12;
      const recency = Math.exp(-ageH / 18);
      const score = recency * (1 + (12 - sourceRank) * 0.06);
      ranked.push({ ...post, score, source: block.title });
    }
  });
  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, 40);
}

export const getDigest = createServerFn({ method: "POST" })
  .validator((data: { sources: SourceIn[] }) => data)
  .handler(async ({ data }): Promise<DigestResult> => {
    const sources = (data.sources ?? []).slice(0, 12);
    const blocks: DigestBlock[] = new Array(sources.length);
    let total = 0;
    await Promise.all(
      sources.map(async (s, i) => {
        if (s.type === "tg") {
          blocks[i] = {
            title: s.title || s.name,
            type: "tg",
            posts: [],
            error: "Telegram-каналы подключаются через бота. Добавьте RSS-ленту источника.",
          };
          return;
        }
        try {
          const posts = await loadRss(s.name);
          total += posts.length;
          blocks[i] = { title: s.title || s.name, type: "rss", posts };
        } catch (err) {
          blocks[i] = {
            title: s.title || s.name,
            type: "rss",
            posts: [],
            error: err instanceof Error ? err.message : "Не удалось загрузить",
          };
        }
      }),
    );
    const ready = blocks.filter(Boolean);
    return { blocks: ready, total, ts: Date.now(), ranked: rankPosts(ready) };
  });
