import { createServerFn } from "@tanstack/react-start";
import { LIVE_TAGS, isLiveTag, type LiveTag } from "@/lib/live/tags";
import { snapshot } from "@/lib/live/bus";
import { rateLimit } from "./limit";

export const liveVersions = createServerFn({ method: "GET" }).handler(async () => {
  return snapshot();
});

export const refreshHubData = createServerFn({ method: "POST" })
  .validator((data: { tags?: LiveTag[] }) => data)
  .handler(async ({ data }) => {
    if (!rateLimit("live:refresh", 6, 60_000)) {
      throw new Error("Слишком часто. Подождите минуту.");
    }
    const { bustTags } = await import("./cache");
    const tags = (data.tags ?? []).filter(isLiveTag);
    bustTags(tags.length ? tags : undefined);
    return { ok: true as const, versions: snapshot(), tags: tags.length ? tags : [...LIVE_TAGS] };
  });
