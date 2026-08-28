import { createHash, randomBytes } from "node:crypto";
import { getSql } from "@/lib/db";
import { extractiveBrief } from "@/lib/digest/brief";
import { loadRss } from "./digest";
import { requireHubUser } from "./hub-auth.server";

const DEFAULTS = [
  { id: "meduza", url: "https://meduza.io/rss/all", name: "Медуза" },
  { id: "rbc", url: "https://rssexport.rbc.ru/rbcnews/news/30/full.rss", name: "РБК" },
  { id: "kommersant", url: "https://www.kommersant.ru/rss/news.xml", name: "Коммерсантъ" },
  { id: "istories", url: "https://istories.media/rss/all.xml", name: "Важные истории" },
] as const;

function uid() {
  return randomBytes(12).toString("hex");
}

function scoreOf(published: Date | null, sourceRank: number) {
  const now = Date.now();
  const ageH = published ? Math.max(0, (now - published.getTime()) / 3_600_000) : 12;
  return Math.exp(-ageH / 18) * (1 + (12 - sourceRank) * 0.06);
}

async function ensureDefaultSources() {
  const sql = await getSql();
  const existing = await sql<{ n: number }>`select count(*)::int as n from hub_digest_sources`;
  if (Number(existing[0]?.n ?? 0) > 0) return;
  for (let i = 0; i < DEFAULTS.length; i++) {
    const s = DEFAULTS[i]!;
    try {
      await sql`
        insert into hub_digest_sources (id, name, url, kind, enabled, rank)
        values (${s.id}, ${s.name}, ${s.url}, 'rss', true, ${i})
      `;
    } catch {
      /* unique url */
    }
  }
}

export async function syncDigestSources(
  token: string | undefined,
  sources: { id: string; title: string; name: string; type: "rss" | "tg"; enabled: boolean }[],
) {
  const { user } = await requireHubUser(token);
  if (user.role !== "admin") return { ok: true as const, skipped: true };
  const sql = await getSql();
  await sql`delete from hub_digest_sources`;
  let rank = 0;
  for (const s of sources.slice(0, 12)) {
    if (s.type !== "rss") continue;
    await sql`
      insert into hub_digest_sources (id, user_id, name, url, kind, enabled, rank)
      values (${s.id || uid()}, ${user.id}, ${s.title.slice(0, 80)}, ${s.name}, 'rss', ${s.enabled}, ${rank})
    `;
    rank += 1;
  }
  return { ok: true as const, skipped: false };
}

export async function refreshDigestSnapshot() {
  await ensureDefaultSources();
  const sql = await getSql();
  const sources = await sql<{ id: string; name: string; url: string; rank: number }>`
    select id, name, url, rank from hub_digest_sources
    where enabled = true and kind = 'rss'
    order by rank asc
    limit 12
  `;
  const seen = new Set<string>();
  const rows: {
    id: string;
    sourceId: string;
    url: string;
    title: string;
    summary: string;
    published: string | null;
    score: number;
  }[] = [];

  await Promise.all(
    sources.map(async (src, i) => {
      try {
        const posts = await loadRss(src.url);
        for (const post of posts) {
          const url =
            post.url && post.url.startsWith("http")
              ? post.url.slice(0, 500)
              : `urn:digest:${createHash("sha1").update(post.text).digest("hex")}`;
          const key = url.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          const published = post.date ? new Date(post.date) : null;
          const pubOk = published && !Number.isNaN(published.getTime()) ? published : null;
          const title = (post.title || post.text.split(" — ")[0] || src.name).slice(0, 240);
          const summary = (post.text.split(" — ").slice(1).join(" — ") || post.text).slice(0, 600);
          rows.push({
            id: uid(),
            sourceId: src.id,
            url,
            title,
            summary,
            published: pubOk ? pubOk.toISOString() : null,
            score: scoreOf(pubOk, i),
          });
        }
      } catch {
        /* keep previous snapshot for this source */
      }
    }),
  );

  if (rows.length) {
    await sql`delete from hub_digest_items`;
    for (const row of rows) {
      await sql`
        insert into hub_digest_items (id, source_id, url, title, summary, published_at, score)
        values (${row.id}, ${row.sourceId}, ${row.url}, ${row.title}, ${row.summary}, ${row.published}, ${row.score})
      `;
    }
  }

  const top = rows.sort((a, b) => b.score - a.score).slice(0, 16);
  const brief = extractiveBrief([
    {
      title: "Дайджест",
      posts: top.map((r) => ({ text: `${r.title} — ${r.summary}` })),
    },
  ]).join("\n");
  await sql`delete from hub_digest_meta`;
  await sql`
    insert into hub_digest_meta (id, refreshed_at, item_count, brief)
    values ('main', now(), ${rows.length}, ${brief})
  `;
  return { items: rows.length, brief };
}

export async function readDigestSnapshot() {
  const sql = await getSql();
  const meta = await sql<{ refreshed_at: string | null; item_count: number; brief: string | null }>`
    select refreshed_at::text as refreshed_at, item_count, brief from hub_digest_meta where id = 'main' limit 1
  `;
  const items = await sql<{
    id: string;
    url: string;
    title: string;
    summary: string | null;
    published_at: string | null;
    score: number;
    source: string | null;
  }>`
    select i.id, i.url, i.title, i.summary, i.published_at::text as published_at, i.score,
           s.name as source
    from hub_digest_items i
    left join hub_digest_sources s on s.id = i.source_id
    order by i.score desc, i.published_at desc nulls last
    limit 40
  `;
  return {
    refreshedAt: meta[0]?.refreshed_at ?? null,
    total: Number(meta[0]?.item_count ?? items.length),
    brief: meta[0]?.brief ?? "",
    items,
  };
}
