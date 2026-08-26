import { getSql } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto/aes";
import { requireHubUser } from "./hub-auth.server";

const START = "https://caldav.icloud.com/";

export type IcloudCal = { href: string; name: string; family: boolean; color: string };

export type IcloudInvitee = {
  email: string;
  name: string;
  status: "accepted" | "declined" | "pending";
  access: "read" | "write";
};

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

function escapeXml(value: string) {
  const map: Record<string, string> = {
    "&": "\u0026amp;",
    "<": "\u0026lt;",
    ">": "\u0026gt;",
    '"': "\u0026quot;",
    "'": "\u0026apos;",
  };
  return value.replace(/[&<>"']/g, (ch) => map[ch] ?? ch);
}

export function parseEmails(raw: string | null | undefined) {
  return Array.from(
    new Set(
      String(raw || "")
        .split(/[\s,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)),
    ),
  ).slice(0, 12);
}

export function normalizeColor(raw: string | null | undefined) {
  const hex = String(raw || "")
    .replace(/#/g, "")
    .replace(/[^0-9a-f]/gi, "");
  if (hex.length >= 6) return `#${hex.slice(0, 6).toUpperCase()}`;
  return "#FF3B30";
}

function colorForIcloud(raw: string) {
  const hex = normalizeColor(raw);
  return `${hex}FF`;
}

function parseColor(block: string) {
  const inner = xmlInner(block, "calendar-color").replace(/<[^>]+>/g, "").trim();
  const attr = block.match(/calendar-color[^>]*\brgb="([^"]+)"/i)?.[1] ?? "";
  return normalizeColor(inner || attr);
}

function parseInvitees(xml: string): IcloudInvitee[] {
  const out: IcloudInvitee[] = [];
  const parts = xml.split(/<(?:[\w.-]+:)?user(?:\s[^>]*)?>/i).slice(1);
  for (const block of parts) {
    const href = xmlHref(block).replace(/^mailto:/i, "").trim().toLowerCase();
    if (!href.includes("@")) continue;
    const name = xmlInner(block, "common-name").replace(/<[^>]+>/g, "").trim() || href;
    const status = /invite-accepted/i.test(block)
      ? "accepted"
      : /invite-declined/i.test(block)
        ? "declined"
        : "pending";
    const access = /read-write/i.test(block) ? "write" : "read";
    out.push({ email: href, name, status, access });
  }
  return out;
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
  if (res.status === 401) {
    throw new Error("Apple ID отклонён. Нужен пароль приложения, не обычный пароль iCloud.");
  }
  if (res.status === 403) {
    const root = /caldav\.icloud\.com\/?$/i.test(url);
    if (root && method === "PROPFIND") {
      throw new Error("Apple ID отклонён. Нужен пароль приложения, не обычный пароль iCloud.");
    }
    throw new Error("iCloud не разрешил это. Календарь «Семья» из Семейного доступа меняется на iPhone.");
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
      color: parseColor(block),
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

async function requireCreds(token: string) {
  const { user } = await requireHubUser(token);
  const c = await creds(user.id);
  if (!c) throw new Error("Сначала подключите iCloud");
  const home = c.home || (await discover(c.appleId, c.password)).homeUrl;
  return { user, c: { ...c, home } };
}

async function propPatchCalendar(
  href: string,
  appleId: string,
  password: string,
  patch: { name?: string; color?: string },
) {
  const props: string[] = [];
  if (patch.name) props.push(`<D:displayname>${escapeXml(patch.name)}</D:displayname>`);
  if (patch.color) {
    const color = colorForIcloud(patch.color);
    props.push(
      `<ICAL:calendar-color xmlns:ICAL="http://apple.com/ns/ical/">${escapeXml(color)}</ICAL:calendar-color>`,
    );
  }
  if (!props.length) return;
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<D:propertyupdate xmlns:D="DAV:">
  <D:set>
    <D:prop>
      ${props.join("\n      ")}
    </D:prop>
  </D:set>
</D:propertyupdate>`;
  await dav(href, appleId, password, "PROPPATCH", body, { depth: "0" });
}

async function mkCalendar(homeUrl: string, appleId: string, password: string, name: string, color: string) {
  const uuid = crypto.randomUUID().toUpperCase();
  const href = `${homeUrl.replace(/\/?$/, "/")}${uuid}/`;
  const color8 = colorForIcloud(color);
  const mkCalBody = `<?xml version="1.0" encoding="UTF-8"?>
<C:mkcalendar xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:ICAL="http://apple.com/ns/ical/">
  <D:set>
    <D:prop>
      <D:displayname>${escapeXml(name)}</D:displayname>
      <ICAL:calendar-color>${escapeXml(color8)}</ICAL:calendar-color>
      <C:supported-calendar-component-set>
        <C:comp name="VEVENT"/>
      </C:supported-calendar-component-set>
    </D:prop>
  </D:set>
</C:mkcalendar>`;
  try {
    await dav(href, appleId, password, "MKCALENDAR", mkCalBody, { depth: "0", overwrite: "F" });
  } catch {
    const mkColBody = `<?xml version="1.0" encoding="UTF-8"?>
<D:mkcol xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:set>
    <D:prop>
      <D:resourcetype>
        <D:collection/>
        <C:calendar/>
      </D:resourcetype>
      <D:displayname>${escapeXml(name)}</D:displayname>
    </D:prop>
  </D:set>
</D:mkcol>`;
    try {
      await dav(href, appleId, password, "MKCOL", mkColBody, { depth: "0", overwrite: "F" });
    } catch {
      await dav(href, appleId, password, "MKCOL", undefined, { depth: "0", overwrite: "F" });
    }
  }
  await propPatchCalendar(href, appleId, password, { name, color }).catch(() => undefined);
  return href;
}

async function shareCal(href: string, appleId: string, password: string, emails: string[], write: boolean) {
  if (!emails.length) return;
  const sets = emails
    .map(
      (email) => `
  <CS:set>
    <D:href>mailto:${escapeXml(email)}</D:href>
    <CS:common-name>${escapeXml(email.split("@")[0] || email)}</CS:common-name>
    <CS:summary>Календарь</CS:summary>
    ${write ? "<CS:read-write/>" : "<CS:read/>"}
  </CS:set>`,
    )
    .join("");
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<CS:share xmlns:CS="http://calendarserver.org/ns/" xmlns:D="DAV:">
${sets}
</CS:share>`;
  await dav(href, appleId, password, "POST", body);
}

async function unshareCal(href: string, appleId: string, password: string, email: string) {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<CS:share xmlns:CS="http://calendarserver.org/ns/" xmlns:D="DAV:">
  <CS:remove>
    <D:href>mailto:${escapeXml(email)}</D:href>
  </CS:remove>
</CS:share>`;
  await dav(href, appleId, password, "POST", body);
}

async function setPublish(href: string, appleId: string, password: string, on: boolean) {
  const tag = on ? "publish-calendar" : "unpublish-calendar";
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<CS:${tag} xmlns:CS="http://calendarserver.org/ns/"/>`;
  await dav(href, appleId, password, "POST", body);
}

async function markRoles(userId: string, href: string, asFamily?: boolean, asPrimary?: boolean) {
  if (!asFamily && !asPrimary) return;
  const sql = await getSql();
  if (asFamily && asPrimary) {
    await sql`
      update hub_icloud
      set family_href = ${href}, primary_href = ${href}, updated_at = now()
      where user_id = ${userId}
    `;
    return;
  }
  if (asFamily) {
    await sql`
      update hub_icloud
      set family_href = ${href}, updated_at = now()
      where user_id = ${userId}
    `;
  }
  if (asPrimary) {
    await sql`
      update hub_icloud
      set primary_href = ${href}, updated_at = now()
      where user_id = ${userId}
    `;
  }
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

export async function createIcloudCalendar(data: {
  token: string;
  name: string;
  color: string;
  asFamily?: boolean;
  asPrimary?: boolean;
  emails?: string;
  publish?: boolean;
  allowInvite?: boolean;
}) {
  const { user, c } = await requireCreds(data.token);
  const name = data.name.trim().slice(0, 80);
  if (!name) throw new Error("Напишите название календаря");
  const color = normalizeColor(data.color);
  const href = await mkCalendar(c.home!, c.appleId, c.password, name, color);
  const emails = parseEmails(data.emails);
  if (emails.length) {
    await shareCal(href, c.appleId, c.password, emails, data.allowInvite !== false).catch((err) => {
      throw new Error(
        `Календарь создан, но приглашения не ушли: ${err instanceof Error ? err.message : "ошибка шаринга"}`,
      );
    });
  }
  if (data.publish) {
    await setPublish(href, c.appleId, c.password, true).catch(() => undefined);
  }
  const asFamily = data.asFamily || /семь|family/i.test(name);
  await markRoles(user.id, href, asFamily, data.asPrimary);
  const calendars = await listCalendars(c.home!, c.appleId, c.password);
  return { ok: true as const, href, calendars };
}

export async function updateIcloudCalendar(data: {
  token: string;
  href: string;
  name: string;
  color: string;
  asFamily?: boolean;
  asPrimary?: boolean;
  publish?: boolean;
}) {
  const { user, c } = await requireCreds(data.token);
  const name = data.name.trim().slice(0, 80);
  if (!name) throw new Error("Напишите название календаря");
  if (!data.href) throw new Error("Календарь не выбран");
  await propPatchCalendar(data.href, c.appleId, c.password, { name, color: normalizeColor(data.color) });
  if (typeof data.publish === "boolean") {
    await setPublish(data.href, c.appleId, c.password, data.publish).catch(() => undefined);
  }
  await markRoles(user.id, data.href, data.asFamily, data.asPrimary);
  const calendars = await listCalendars(c.home!, c.appleId, c.password);
  return { ok: true as const, calendars };
}

export async function deleteIcloudCalendar(data: { token: string; href: string }) {
  const { user, c } = await requireCreds(data.token);
  if (!data.href) throw new Error("Календарь не выбран");
  await dav(data.href, c.appleId, c.password, "DELETE");
  const sql = await getSql();
  await sql`
    update hub_icloud
    set
      primary_href = case when primary_href = ${data.href} then null else primary_href end,
      family_href = case when family_href = ${data.href} then null else family_href end,
      updated_at = now()
    where user_id = ${user.id}
  `;
  const calendars = await listCalendars(c.home!, c.appleId, c.password);
  return { ok: true as const, calendars };
}

export async function shareIcloudCalendar(data: { token: string; href: string; emails: string; write?: boolean }) {
  const { c } = await requireCreds(data.token);
  const emails = parseEmails(data.emails);
  if (!emails.length) throw new Error("Укажите почту iCloud или Apple ID");
  await shareCal(data.href, c.appleId, c.password, emails, data.write !== false);
  return { ok: true as const, emails };
}

export async function unshareIcloudCalendar(data: { token: string; href: string; email: string }) {
  const { c } = await requireCreds(data.token);
  const email = data.email.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("Некорректная почта");
  await unshareCal(data.href, c.appleId, c.password, email);
  return { ok: true as const };
}

export async function calendarInfoIcloud(data: { token: string; href: string }) {
  const { c } = await requireCreds(data.token);
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<D:propfind xmlns:D="DAV:" xmlns:CS="http://calendarserver.org/ns/" xmlns:ICAL="http://apple.com/ns/ical/">
  <D:prop>
    <D:displayname/>
    <ICAL:calendar-color/>
    <CS:invite/>
    <CS:publish-url/>
  </D:prop>
</D:propfind>`;
  const res = await dav(data.href, c.appleId, c.password, "PROPFIND", body, { depth: "0" });
  const publishBlock = xmlInner(res.text, "publish-url");
  return {
    name: xmlInner(res.text, "displayname").replace(/<[^>]+>/g, "").trim(),
    color: parseColor(res.text),
    invitees: parseInvitees(res.text),
    publishUrl: xmlHref(publishBlock) || "",
  };
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
