import { fireDueReminders } from "./reminders.server";
import { refreshDigestSnapshot } from "./digest-snapshot.server";
import { ensureHubSchema } from "./hub-schema.server";

const globalRef = globalThis as typeof globalThis & { __hubTickChain__?: Promise<void> };

async function executeHubTick() {
  await ensureHubSchema().catch((err) => console.error("[tick] schema", err));
  const reminders = await fireDueReminders().catch((err) => {
    console.error("[tick] reminders", err);
    return { sent: 0, error: String(err) };
  });
  const digest = await refreshDigestSnapshot().catch((err) => {
    console.error("[tick] digest", err);
    return { items: 0, error: String(err) };
  });
  return { ok: true as const, at: new Date().toISOString(), reminders, digest };
}

export function runHubTick() {
  const queued = (globalRef.__hubTickChain__ ?? Promise.resolve()).then(executeHubTick);
  globalRef.__hubTickChain__ = queued.then(() => undefined, () => undefined);
  return queued;
}

export function authorizeTick(request: Request) {
  const secret = (process.env.INTERNAL_CRON_SECRET || "").trim();
  const hdr = request.headers.get("x-cron-secret") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (secret) return hdr === secret;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "";
}
