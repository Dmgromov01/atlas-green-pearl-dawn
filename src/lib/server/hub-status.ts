import { createServerFn } from "@tanstack/react-start";

export const hubSystemStatus = createServerFn({ method: "POST" })
  .validator((data?: { token?: string }) => data ?? {})
  .handler(async ({ data }) => {
    const { systemStatusHub } = await import("./hub-status.server");
    return systemStatusHub(data.token);
  });

export const hubActivityFeed = createServerFn({ method: "POST" })
  .validator((data?: { token?: string }) => data ?? {})
  .handler(async ({ data }) => {
    const { activityFeedHub } = await import("./hub-status.server");
    return activityFeedHub(data.token);
  });
