import { createServerFn } from "@tanstack/react-start";

export const digestSnapshot = createServerFn({ method: "GET" }).handler(async () => {
  const { readDigestSnapshot } = await import("./digest-snapshot.server");
  return readDigestSnapshot();
});

export const digestRefresh = createServerFn({ method: "POST" })
  .validator((data?: { token?: string }) => data ?? {})
  .handler(async ({ data }) => {
    const { requireHubUser } = await import("./hub-auth.server");
    await requireHubUser(data.token);
    const { refreshDigestSnapshot } = await import("./digest-snapshot.server");
    return refreshDigestSnapshot();
  });

export const digestSyncSources = createServerFn({ method: "POST" })
  .validator(
    (data: {
      token?: string;
      sources: { id: string; title: string; name: string; type: "rss" | "tg"; enabled: boolean }[];
    }) => data,
  )
  .handler(async ({ data }) => {
    const { syncDigestSources } = await import("./digest-snapshot.server");
    return syncDigestSources(data.token, data.sources);
  });
