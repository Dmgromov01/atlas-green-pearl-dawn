import { getSql } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto/aes";
import { requireHubUser } from "./hub-auth.server";

const START = "https://caldav.icloud.com/";

export type IcloudCal = { href: string; name: string; family: boolean };

type Row = {
  user_id: string;
  apple_id: string;
  password_enc: string;
  base_url: string | null;
  home_url: string | null;
  primary_href: string | null;
  family_href: string | null;
};

function authHeader(appleId: string, password: string) {
  return `Basic ${Buffer.from(`${appleId}:${password}`, "utf8").toString("base64")}`;
}

function absUrl(base: string, href: string) {
  if (!href) return base;
  const raw = /^https?:\/\//i.test(href) ? href : new URL(href, base.endsWith("/") ? base : `${base}/`).href;
  try {
    const u = new URL(raw);
    if (u.port === "443" && u.protocol === "https:") u.port = "";
    return u.href;
  } catch {
    return raw;
  }
}

function xmlInner(xml: string, local: string) {
  const re = new RegExp(`<(?:[\\w.-]+:)?${local}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w.-]+:)?${local}>`, "i");
  const m = xml.match(re);
  return m?.[1]?.trim() ?? "";
}

function xmlHref(block: string) {
  const inner = xmlInner(block, "href");
  return inner.replace(/<!\[CDATA\[|\]\]>/g, "").trim();
}

function splitResponses(xml: string) {
  return xml.split(/<(?:[\w.-]+:)?response(?:\s[^>]*)?>/i).slice(1);
}

async function dav(url: string, appleId: string, password: string, method: string, body?: string, extra?: Record<string, string>) {
  const res = await fetch(url, {
    method,
    headers: {
      authorization: authHeader(appleId, password),
      "user-agent": "PersonalAIHub/1.0",
      ...(body ? { "content-type": "application/xml; charset=utf-8" } : {}),
      ...extra,
    },
    body,
    redirect: "follow",
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  if (res.status === 401 || res.status === 403) {
    throw new Error("Apple ID отклонён. Нужен пароль приложения, не обычный пароль iCloud.");
  }
  if (!res.ok && res.status !== 207 && res.status !== 201 && res.status !== 204 && res.status !== 404) {
    throw new Error(text.slice(0, 160) || `iCloud ${res.status}`);
  }
  return { status: res.status, text, url: res.url || url };
}

async function discover(appleId: string, password: string) {
  const principalBody = `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop><d:current-user-principal/></d:prop>
</d:propfind>`;
  const first = await dav(START, appleId, password, "PROPFIND", principalBody, { depth: "0" });
  const base = new URL(first.url).origin + "/";
  const principalHref = xmlHref(xmlInner(first.text, "current-user-principal")) || xmlHref(first.text);
  if (!principalHref) throw new Error("iCloud не отдал календарь. Проверьте Apple ID и пароль приложения.");
  const principalUrl = absUrl(base, principalHref);

  const homeBody = `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><c:calendar-home-set/></d:prop>
</d:propfind>`;
  const homeRes = await dav(principalUrl, appleId, password, "PROPFIND", homeBody, { depth: "0" });
  const homeHref = xmlHref(xmlInner(homeRes.text, "calendar-home-set")) || xmlHref(homeRes.text);
  if (!homeHref) throw new Error("Не найден список календарей iCloud");
  const homeUrl = absUrl(base, homeHref);
  const calendars = await listCalendars(homeUrl, appleId, password);
  return { base, homeUrl, calendars };
}

async function listCalendars(homeUrl: string, appleId: string, password: string): Promise<IcloudCal[]> {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/" xmlns:ic="http://apple.com/ns/ical/">
  <d:prop>
    <d:displayname/>
    <d:resourcetype/>
    <c:supported-calendar-component-set/>
    <ic:calendar-color/>
    <cs:getctag/>
  </d:prop>
</d:propfind>`;
  const res = await dav(homeUrl, appleId, password, "PROPFIND", body, { depth: "1" });
  const origin = new URL(homeUrl).origin;
  const out: IcloudCal[] = [];
  for (const block of splitResponses(res.text)) {
    const href = xmlHref(block);
    const types = xmlInner(block, "resourcetype").toLowerCase();
    if (!href || !types.includes("calendar")) continue;
    const comps = xmlInner(block, "supported-calendar-component-set").toLowerCase();
    if (comps && !comps.includes("vevent") && comps.includes("vtodo")) continue;
    const name = xmlInner(block, "displayname").replace(/<[^>]+>/g, "").trim() || "";
    if (!name || /reminder|notification|уведомл/i.test(name)) continue;
    out.push({
      href: absUrl(origin + "/", href),
      name,
      family: /семь|family/i.test(name) || types.includes("shared-owner"),
    });
  }
  return out;
}

async function loadRow(userId: string) {
  const sql = await getSql();
  const rows = await sql<Row>`select * from hub_icloud where user_id = ${userId} limit 1`;
  return rows[0] ?? null;
}

function envApple() {
  const appleId = (process.env.ICLOUD_APPLE_ID || "").trim();
  const password = (process.env.ICLOUD_APP_PASSWORD || "").replace(/\s+/g, "");
  if (!appleId || password.length < 8) return null;
  return {
    appleId,
    password,
    primary: (process.env.ICLOUD_PRIMARY_HREF || "").trim() || null,
    family: (process.env.ICLOUD_FAMILY_HREF || "").trim() || null,
  };
}

function pickHref(calendars: IcloudCal[], family: boolean) {
  if (family) {
    return (
      calendars.find((c) => c.family)?.href ||
      calendars.find((c) => /семь|family/i.test(c.name))?.href ||
      null
    );
  }
  return (
    calendars.find((c) => /home|личный|personal/i.test(c.name) && !c.family)?.href ||
    calendars.find((c) => !c.family)?.href ||
    null
  );
}

type Creds = {
  appleId: string;
  password: string;
  base: string | null;
  home: string | null;
  primary: string | null;
  family: string | null;
};

const envMemo = { at: 0, value: null as Creds | null };

async function creds(userId: string): Promise<Creds | null> {
  const row = await loadRow(userId);
  const env = envApple();
  if (!row && !env) return null;
  if (row) {
    return {
      appleId: row.apple_id,
      password: decryptSecret(row.password_enc),
      base: row.base_url,
      home: row.home_url,
      primary: row.primary_href || env?.primary || null,
      family: row.family_href || env?.family || null,
    };
  }
  if (envMemo.value && Date.now() - envMemo.at < 10 * 60_000) return envMemo.value;
  const found = await discover(env!.appleId, env!.password);
  const value: Creds = {
    appleId: env!.appleId,
    password: env!.password,
    base: found.base,
    home: found.homeUrl,
    primary: env!.primary || pickHref(found.calendars, false),
    family: env!.family || pickHref(found.calendars, true),
  };
  envMemo.at = Date.now();
  envMemo.value = value;
  return value;
}

export async function saveIcloud(data: { token: string; appleId: string; password: string }) {
  const { user } = await requireHubUser(data.token);
  const appleId = data.appleId.trim();
  const password = data.password.replace(/\s+/g, "");
  if (!appleId.includes("@") || password.length < 8) {
    throw new Error("Нужны Apple ID и пароль приложения");
  }
  const found = await discover(appleId, password);
  const personal = found.calendars.find((c) => !c.family) || found.calendars[0];
  const family = found.calendars.find((c) => c.family) || null;
  const sql = await getSql();
  await sql`
    insert into hub_icloud (user_id, apple_id, password_enc, base_url, home_url, primary_href, family_href, updated_at)
    values (
      ${user.id}, ${appleId}, ${encryptSecret(password)}, ${found.base}, ${found.homeUrl},
      ${personal?.href ?? null}, ${family?.href ?? null}, now()
    )
    on conflict (user_id) do update set
      apple_id = excluded.apple_id,
      password_enc = excluded.password_enc,
      base_url = excluded.base_url,
      home_url = excluded.home_url,
      primary_href = coalesce(excluded.primary_href, hub_icloud.primary_href),
      family_href = coalesce(excluded.family_href, hub_icloud.family_href),
      updated_at = now()
  `;
  return {
    ok: true as const,
    appleId,
    calendars: found.calendars,
    primaryHref: personal?.href ?? "",
    familyHref: family?.href ?? "",
  };
}

export async function saveIcloudCalendars(data: { token: string; primaryHref: string; familyHref: string }) {
  const { user } = await requireHubUser(data.token);
  const sql = await getSql();
  await sql`
    update hub_icloud
    set primary_href = ${data.primaryHref || null},
        family_href = ${data.familyHref || null},
        updated_at = now()
    where user_id = ${user.id}
  `;
  return { ok: true as const };
}

export async function disconnectIcloud(token: string) {
  const { user } = await requireHubUser(token);
  const sql = await getSql();
  await sql`delete from hub_icloud where user_id = ${user.id}`;
  return { ok: true as const };
}

export async function statusIcloud(token: string) {
  const { user } = await requireHubUser(token);
  try {
    const c = await creds(user.id);
    if (!c) return { connected: false as const, calendars: [] as IcloudCal[] };
    const home = c.home || (await discover(c.appleId, c.password)).homeUrl;
    const calendars = await listCalendars(home, c.appleId, c.password);
    return {
      connected: true as const,
      appleId: c.appleId,
      primaryHref: c.primary,
      familyHref: c.family,
      calendars,
    };
  } catch (err) {
    return {
      connected: false as const,
      calendars: [] as IcloudCal[],
      error: err instanceof Error ? err.message : "iCloud недоступен",
    };
  }
}

function icsUtc(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function icsText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

function vevent(data: { uid: string; summary: string; start: string; end?: string }) {
  const start = icsUtc(data.start);
  const end = icsUtc(data.end || new Date(new Date(data.start).getTime() + 3600_000).toISOString());
  const stamp = icsUtc(new Date().toISOString());
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Personal AI Hub//RU",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${data.uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${icsText(data.summary)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Напоминание",
    "TRIGGER:-PT1H",
    "END:VALARM",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Через 15 минут",
    "TRIGGER:-PT15M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export async function upsertIcloudEvent(data: {
  token: string;
  localId: string;
  summary: string;
  start: string;
  end?: string;
  shared?: boolean;
  href?: string;
}) {
  const { user } = await requireHubUser(data.token);
  const c = await creds(user.id);
  if (!c) return { skipped: true as const };
  const cal = data.shared ? c.family || c.primary : c.primary;
  if (!cal) throw new Error("Календарь iCloud не выбран");
  const href = data.href || `${cal.replace(/\/?$/, "/")}${data.localId}.ics`;
  const body = vevent({ uid: `${data.localId}@hub`, summary: data.summary, start: data.start, end: data.end });
  await dav(href, c.appleId, c.password, "PUT", body, { "content-type": "text/calendar; charset=utf-8" });
  return { skipped: false as const, href };
}

export async function deleteIcloudEvent(data: { token: string; href?: string; localId: string; shared?: boolean }) {
  const { user } = await requireHubUser(data.token);
  const c = await creds(user.id);
  if (!c) return { skipped: true as const };
  const cal = data.shared ? c.family || c.primary : c.primary;
  const href = data.href || (cal ? `${cal.replace(/\/?$/, "/")}${data.localId}.ics` : "");
  if (!href) return { skipped: true as const };
  await dav(href, c.appleId, c.password, "DELETE");
  return { skipped: false as const };
}
