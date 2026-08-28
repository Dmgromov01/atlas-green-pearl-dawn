import type { H3Event } from "nitro";

export default async function tick(event: H3Event) {
  const { authorizeTick, runHubTick } = await import("../../../src/lib/server/hub-tick.server");
  if (!authorizeTick(event.req)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const out = await runHubTick();
  return Response.json(out);
}
