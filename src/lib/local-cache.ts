const PREFIX = "hub.cache.";

type Envelope<T> = { t: number; d: T };

export function readCache<T>(key: string, maxAgeMs: number): T | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Envelope<T>;
    if (!parsed || typeof parsed.t !== "number") return undefined;
    if (Date.now() - parsed.t > maxAgeMs) return undefined;
    return parsed.d;
  } catch {
    return undefined;
  }
}

export function writeCache(key: string, data: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify({ t: Date.now(), d: data }));
  } catch {
    /* quota */
  }
}

export function cacheAge(key: string): number | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { t?: number };
    return typeof parsed.t === "number" ? parsed.t : undefined;
  } catch {
    return undefined;
  }
}
