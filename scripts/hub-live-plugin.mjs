import { attachHubLive } from "./hub-live.mjs";

/**
 * Attaches /hub/live WebSocket to the Vite (dev) and preview HTTP servers.
 * Cache invalidation itself is published from SSR via Symbol.for("hub.live.bus").
 */
export function hubLivePlugin() {
  return {
    name: "hub-live-ws",
    configureServer(server) {
      return () => {
        const http = server.httpServer;
        if (!http) return;
        attachHubLive(http);
        void server.ssrLoadModule("/src/lib/server/cache.ts").catch(() => {});
      };
    },
    configurePreviewServer(server) {
      return () => {
        const http = server.httpServer;
        if (!http) return;
        attachHubLive(http);
      };
    },
  };
}
