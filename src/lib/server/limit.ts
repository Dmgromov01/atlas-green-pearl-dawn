type Bucket = { n: number; reset: number };

const buckets = new Map<string, Bucket>();

/** In-memory limiter for anonymous server functions. */
export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const hit = buckets.get(key);
  if (!hit || now > hit.reset) {
    buckets.set(key, { n: 1, reset: now + windowMs });
    return true;
  }
  if (hit.n >= max) return false;
  hit.n += 1;
  return true;
}
