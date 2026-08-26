import { emptyVersions, isLiveTag, LIVE_TAGS, type LiveTag } from "./tags";

const BUS = Symbol.for("hub.live.bus");
const BUST = Symbol.for("hub.live.bust");

type Client = {
  send: (text: string) => void;
  tags: Set<LiveTag>;
};

type Bus = {
  versions: Map<LiveTag, number>;
  clients: Set<Client>;
};

type G = typeof globalThis & {
  [BUS]?: Bus;
  [BUST]?: (tags?: LiveTag[]) => void;
};

function root(): G {
  return globalThis as G;
}

export function getBus(): Bus {
  const g = root();
  if (!g[BUS]) {
    g[BUS] = { versions: new Map(), clients: new Set() };
  }
  return g[BUS];
}

export function snapshot(): Record<LiveTag, number> {
  const bus = getBus();
  const out = emptyVersions();
  for (const tag of LIVE_TAGS) out[tag] = bus.versions.get(tag) ?? 0;
  return out;
}

export function publish(tag: LiveTag, extra?: Record<string, unknown>) {
  if (!isLiveTag(tag)) return;
  const bus = getBus();
  const v = (bus.versions.get(tag) ?? 0) + 1;
  bus.versions.set(tag, v);
  const payload = JSON.stringify({ type: "invalidate", tag, v, ...extra });
  for (const client of bus.clients) {
    if (client.tags.size === 0 || client.tags.has(tag)) {
      try {
        client.send(payload);
      } catch {
        /* drop */
      }
    }
  }
}

export function addClient(send: (text: string) => void, tags?: LiveTag[]): Client {
  const client: Client = {
    send,
    tags: new Set(tags?.length ? tags.filter(isLiveTag) : LIVE_TAGS),
  };
  getBus().clients.add(client);
  return client;
}

export function removeClient(client: Client) {
  getBus().clients.delete(client);
}

export function registerBust(fn: (tags?: LiveTag[]) => void) {
  root()[BUST] = fn;
}

export function runBust(tags?: LiveTag[]) {
  root()[BUST]?.(tags);
}
