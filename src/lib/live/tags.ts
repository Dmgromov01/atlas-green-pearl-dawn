export const LIVE_TAGS = ["weather", "rates", "digest", "ics", "share"] as const;
export type LiveTag = (typeof LIVE_TAGS)[number];

export type LiveStatus = "on" | "off" | "retry";

export type LiveHello = { type: "hello"; v: 1; versions: Record<LiveTag, number> };
export type LiveInvalidate = { type: "invalidate"; tag: LiveTag; v: number };
export type LiveSub = { type: "sub"; tags?: LiveTag[] };
export type LivePing = { type: "ping" };

export type LiveDown = LiveHello | LiveInvalidate;
export type LiveUp = LiveSub | LivePing;

export function isLiveTag(value: unknown): value is LiveTag {
  return typeof value === "string" && (LIVE_TAGS as readonly string[]).includes(value);
}

export function queryKeysFor(tag: LiveTag): string[][] {
  switch (tag) {
    case "weather":
      return [["weather"]];
    case "rates":
      return [["rates"]];
    case "digest":
      return [["digest"], ["brief"]];
    case "ics":
      return [["ics"]];
    case "share":
      return [];
  }
}

export function emptyVersions(): Record<LiveTag, number> {
  return { weather: 0, rates: 0, digest: 0, ics: 0, share: 0 };
}
