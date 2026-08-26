/**
 * In-process live bus + RFC6455 WebSocket for /hub/live.
 * State lives on globalThis[Symbol.for("hub.live.bus")] so Vite SSR
 * (cached()/publish) and this HTTP upgrade handler share one map.
 */
import { createHash } from "node:crypto";

export const HUB_LIVE_PATH = "/hub/live";
export const LIVE_TAGS = ["weather", "rates", "digest", "ics", "share"];

const BUS = Symbol.for("hub.live.bus");
const BUST = Symbol.for("hub.live.bust");
const MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const MAX_PAYLOAD = 8_192;
const PING_MS = 20_000;
const STALE_MS = 45_000;

export function getBus() {
  if (!globalThis[BUS]) {
    globalThis[BUS] = { versions: new Map(), clients: new Set() };
  }
  return globalThis[BUS];
}

export function snapshot() {
  const bus = getBus();
  const out = {};
  for (const tag of LIVE_TAGS) out[tag] = bus.versions.get(tag) ?? 0;
  return out;
}

export function publish(tag, extra) {
  if (!LIVE_TAGS.includes(tag)) return;
  const bus = getBus();
  const v = (bus.versions.get(tag) ?? 0) + 1;
  bus.versions.set(tag, v);
  const payload = JSON.stringify({ type: "invalidate", tag, v, ...(extra || {}) });
  for (const client of bus.clients) {
    if (!client.tags || client.tags.size === 0 || client.tags.has(tag)) {
      try {
        client.send(payload);
      } catch {
        /* drop */
      }
    }
  }
}

export function addClient(send, tags) {
  const client = {
    send,
    tags: new Set(Array.isArray(tags) && tags.length ? tags.filter((t) => LIVE_TAGS.includes(t)) : LIVE_TAGS),
  };
  getBus().clients.add(client);
  return client;
}

export function removeClient(client) {
  getBus().clients.delete(client);
}

export function runBust(tags) {
  const fn = globalThis[BUST];
  if (typeof fn === "function") fn(tags);
}

function encodeFrame(opcode, payload) {
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  const len = data.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | opcode;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, data]);
}

function makeReader(onFrame) {
  let buf = Buffer.alloc(0);
  return (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (true) {
      if (buf.length < 2) return;
      const fin = (buf[0] & 0x80) !== 0;
      const opcode = buf[0] & 0x0f;
      const masked = (buf[1] & 0x80) !== 0;
      let len = buf[1] & 0x7f;
      let offset = 2;
      if (len === 126) {
        if (buf.length < 4) return;
        len = buf.readUInt16BE(2);
        offset = 4;
      } else if (len === 127) {
        if (buf.length < 10) return;
        const big = buf.readBigUInt64BE(2);
        if (big > BigInt(MAX_PAYLOAD)) {
          buf = Buffer.alloc(0);
          onFrame(0x8, Buffer.alloc(0));
          return;
        }
        len = Number(big);
        offset = 10;
      }
      if (!fin) {
        buf = Buffer.alloc(0);
        onFrame(0x8, Buffer.alloc(0));
        return;
      }
      if (len > MAX_PAYLOAD) {
        buf = Buffer.alloc(0);
        onFrame(0x8, Buffer.alloc(0));
        return;
      }
      const maskLen = masked ? 4 : 0;
      if (buf.length < offset + maskLen + len) return;
      let payload = buf.subarray(offset + maskLen, offset + maskLen + len);
      if (masked) {
        const mask = buf.subarray(offset, offset + 4);
        payload = Buffer.from(payload);
        for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      }
      buf = buf.subarray(offset + maskLen + len);
      onFrame(opcode, payload);
    }
  };
}

function bindSocket(socket) {
  let alive = true;
  let lastRx = Date.now();
  const sendRaw = (opcode, payload) => {
    if (!alive) return;
    try {
      socket.write(encodeFrame(opcode, payload));
    } catch {
      alive = false;
    }
  };
  const sendText = (text) => sendRaw(0x1, text);
  const client = addClient(sendText);

  sendText(JSON.stringify({ type: "hello", v: 1, versions: snapshot() }));

  const pingId = setInterval(() => {
    if (!alive) return;
    if (Date.now() - lastRx > STALE_MS) {
      alive = false;
      sendRaw(0x8, Buffer.alloc(0));
      socket.destroy();
      return;
    }
    sendRaw(0x9, Buffer.alloc(0));
  }, PING_MS);

  const drop = () => {
    if (!alive && !getBus().clients.has(client)) return;
    alive = false;
    clearInterval(pingId);
    removeClient(client);
  };

  const onFrame = (opcode, payload) => {
    lastRx = Date.now();
    if (opcode === 0x8) {
      sendRaw(0x8, Buffer.alloc(0));
      socket.destroy();
      return;
    }
    if (opcode === 0x9) {
      sendRaw(0xa, payload);
      return;
    }
    if (opcode === 0xa) return;
    if (opcode !== 0x1) return;
    let msg;
    try {
      msg = JSON.parse(payload.toString("utf8"));
    } catch {
      return;
    }
    if (msg?.type === "sub" && Array.isArray(msg.tags)) {
      client.tags = new Set(msg.tags.filter((t) => LIVE_TAGS.includes(t)));
      if (client.tags.size === 0) LIVE_TAGS.forEach((t) => client.tags.add(t));
    } else if (msg?.type === "ping") {
      sendText(JSON.stringify({ type: "pong" }));
    }
  };

  const read = makeReader(onFrame);
  socket.on("data", read);
  socket.on("error", drop);
  socket.on("close", drop);
  socket.on("end", drop);
  socket.setNoDelay(true);
  socket.setKeepAlive(true, 15_000);
}

export function handleUpgrade(req, socket, head) {
  const key = req.headers["sec-websocket-key"];
  if (!key || typeof key !== "string" || (req.headers.upgrade || "").toLowerCase() !== "websocket") {
    socket.destroy();
    return;
  }
  const accept = createHash("sha1").update(key + MAGIC).digest("base64");
  socket.write(
    "HTTP/1.1 101 Switching Protocols\r\n" +
      "Upgrade: websocket\r\n" +
      "Connection: Upgrade\r\n" +
      `Sec-WebSocket-Accept: ${accept}\r\n` +
      "\r\n",
  );
  if (head && head.length) socket.unshift(head);
  bindSocket(socket);
}

export function attachHubLive(httpServer) {
  if (!httpServer || httpServer.__hubLiveAttached) return;
  httpServer.__hubLiveAttached = true;
  httpServer.on("upgrade", (req, socket, head) => {
    const path = (req.url || "").split("?")[0];
    if (path !== HUB_LIVE_PATH) return;
    try {
      handleUpgrade(req, socket, head);
    } catch {
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
    }
  });
}
