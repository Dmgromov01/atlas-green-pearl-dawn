import { liveVersions } from "@/lib/server/live";
import { emptyVersions, isLiveTag, LIVE_TAGS, type LiveTag, type LiveStatus } from "./tags";

/** HTTP-only live invalidation. No WebSocket — the preview frame cannot upgrade. */
export function connectHubLive(opts: {
  onInvalidate: (tag: LiveTag, v: number) => void;
  onStatus: (status: LiveStatus) => void;
  tags?: LiveTag[];
}): () => void {
  let stopped = false;
  let pollTimer: number | undefined;
  const last = emptyVersions();
  const tags = opts.tags?.length ? opts.tags.filter(isLiveTag) : [...LIVE_TAGS];

  const apply = (snap: Partial<Record<LiveTag, number>>, bump: boolean) => {
    for (const tag of tags) {
      const v = snap[tag] ?? 0;
      if (bump && v > (last[tag] ?? 0)) opts.onInvalidate(tag, v);
      last[tag] = Math.max(last[tag] ?? 0, v);
    }
  };

  const poll = async () => {
    if (stopped) return;
    try {
      const snap = await liveVersions();
      apply(snap, true);
      opts.onStatus("on");
    } catch {
      opts.onStatus("retry");
    }
  };

  const vis = () => {
    if (document.visibilityState === "visible") void poll();
  };

  opts.onStatus("retry");
  const startTimer: number | undefined = window.setTimeout(() => {
    void poll();
    pollTimer = window.setInterval(() => void poll(), 45_000);
  }, 4000);
  document.addEventListener("visibilitychange", vis);

  return () => {
    stopped = true;
    document.removeEventListener("visibilitychange", vis);
    if (startTimer) window.clearTimeout(startTimer);
    if (pollTimer) window.clearInterval(pollTimer);
    opts.onStatus("off");
  };
}
