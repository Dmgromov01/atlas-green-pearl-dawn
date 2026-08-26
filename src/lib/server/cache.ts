import { LIVE_TAGS, type LiveTag } from "@/lib/live/tags";
import { publish, registerBust } from "@/lib/live/bus";

type Entry<T> = { ts: number; data: T; tag?: LiveTag };

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
  tag?: LiveTag,
): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && Date.now() - hit.ts < ttlMs) return hit.data;

  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) {
    if (hit) return hit.data;
    return running;
  }

  const pending = (async () => {
    try {
      const data = await fn();
      const prev = store.get(key) as Entry<T> | undefined;
      store.set(key, { ts: Date.now(), data, tag: tag ?? prev?.tag });
      if (tag && prev) publish(tag);
      return data;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, pending);

  if (hit) {
    void pending.catch(() => {});
    return hit.data;
  }

  try {
    return await pending;
  } catch (err) {
    throw err;
  }
}

export function bustTags(tags?: LiveTag[]) {
  const list = (tags?.length ? tags : LIVE_TAGS.filter((t) => t !== "share")) as LiveTag[];
  for (const [key, entry] of store) {
    if (entry.tag && list.includes(entry.tag)) store.delete(key);
  }
  for (const tag of list) publish(tag);
}

registerBust(bustTags);

export async function fetchText(url: string, timeoutMs = 10000, maxBytes = 800_000) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "PersonalAIHub/1.0",
      Accept: "application/json, application/rss+xml, application/xml, text/xml, */*",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  if (buf.byteLength > maxBytes) throw new Error("Ответ слишком большой");
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

export async function fetchJson<T>(url: string, timeoutMs = 10000): Promise<T> {
  const text = await fetchText(url, timeoutMs);
  return JSON.parse(text) as T;
}
