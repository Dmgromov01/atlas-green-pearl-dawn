import { getSql } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto/aes";
import { requireHubUser } from "./hub-auth.server";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_API = "https://www.googleapis.com/calendar/v3";

type GcalRow = {
  user_id: string;
  client_id: string;
  client_secret_enc: string;
  refresh_token_enc: string;
  access_token_enc: string | null;
  access_expires_at: string | Date | null;
  email: string | null;
  primary_id: string;
  family_id: string | null;
  family_emails: string | null;
};

export type GcalListItem = {
  id: string;
  summary: string;
  primary: boolean;
  color: string;
  accessRole: string;
};

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

function envFallback() {
  const clientId = (process.env.GOOGLE_CALENDAR_CLIENT_ID || "").trim();
  const clientSecret = (process.env.GOOGLE_CALENDAR_CLIENT_SECRET || "").trim();
  const refreshToken = (process.env.GOOGLE_CALENDAR_REFRESH_TOKEN || "").trim();
  if (!clientId || !clientSecret || !refreshToken) return null;
  return {
    clientId,
    clientSecret,
    refreshToken,
    primaryId: (process.env.GOOGLE_CALENDAR_PRIMARY_ID || "primary").trim(),
    familyId: (process.env.GOOGLE_CALENDAR_FAMILY_ID || "").trim() || null,
  };
}

async function loadRow(userId: string): Promise<GcalRow | null> {
  const sql = await getSql();
  const rows = await sql<GcalRow>`select * from hub_gcal where user_id = ${userId} limit 1`;
  return rows[0] ?? null;
}

async function googleJson(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(20000) });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = { error: text.slice(0, 200) };
  }
  if (!res.ok) {
    const err = json.error as { message?: string } | string | undefined;
    const msg =
      typeof err === "string"
        ? err
        : err?.message || (typeof json.error_description === "string" ? json.error_description : "");
    if (res.status === 401 || res.status === 403) {
      throw new Error(msg || "Google отклонил доступ. Нужны права на запись в календарь.");
    }
    throw new Error(msg || `Google Calendar ${res.status}`);
  }
  return json;
}

async function refreshAccess(row: {
  client_id: string;
  client_secret: string;
  refresh_token: string;
}) {
  const body = new URLSearchParams({
    client_id: row.client_id,
    client_secret: row.client_secret,
    refresh_token: row.refresh_token,
    grant_type: "refresh_token",
  });
  const json = await googleJson(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const access = String(json.access_token || "");
  if (!access) throw new Error("Google не выдал access token");
  const expires = Date.now() + (Number(json.expires_in || 3500) - 60) * 1000;
  return { access, expires };
}

async function credsFor(userId: string) {
  const row = await loadRow(userId);
  const env = envFallback();
  if (!row && !env) return null;
  const clientId = row?.client_id || env!.clientId;
  const clientSecret = row ? decryptSecret(row.client_secret_enc) : env!.clientSecret;
  const refreshToken = row ? decryptSecret(row.refresh_token_enc) : env!.refreshToken;
  const primaryId = row?.primary_id || env?.primaryId || "primary";
  const familyId = row?.family_id || env?.familyId || null;
  const email = row?.email || null;
  const familyEmails = parseEmails(row?.family_emails);

  const exp = row?.access_expires_at ? new Date(row.access_expires_at).getTime() : 0;
  if (row?.access_token_enc && exp > Date.now() + 15_000) {
    return {
      access: decryptSecret(row.access_token_enc),
      clientId,
      primaryId,
      familyId,
      email,
      familyEmails,
    };
  }

  const fresh = await refreshAccess({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });
  if (row) {
    const sql = await getSql();
    await sql`
      update hub_gcal
      set access_token_enc = ${encryptSecret(fresh.access)},
          access_expires_at = ${new Date(fresh.expires).toISOString()}
      where user_id = ${userId}
    `;
  }
  return { access: fresh.access, clientId, primaryId, familyId, email, familyEmails };
}

async function fetchEmail(access: string) {
  try {
    const json = await googleJson(`${CAL_API}/users/me/calendarList/primary`, {
      headers: { authorization: `Bearer ${access}` },
    });
    return String(json.id || json.summary || "");
  } catch {
    return "";
  }
}

export async function saveGcalCreds(data: {
  token: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}) {
  const { user } = await requireHubUser(data.token);
  const clientId = data.clientId.trim();
  const clientSecret = data.clientSecret.trim();
  const refreshToken = data.refreshToken.trim();
  if (!clientId || !clientSecret || refreshToken.length < 10) {
    throw new Error("Нужны client id, secret и refresh token");
  }
  const fresh = await refreshAccess({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });
  const email = await fetchEmail(fresh.access);
  const sql = await getSql();
  await sql`
    insert into hub_gcal (
      user_id, client_id, client_secret_enc, refresh_token_enc,
      access_token_enc, access_expires_at, email, primary_id, updated_at
    ) values (
      ${user.id}, ${clientId}, ${encryptSecret(clientSecret)}, ${encryptSecret(refreshToken)},
      ${encryptSecret(fresh.access)}, ${new Date(fresh.expires).toISOString()}, ${email || null},
      'primary', now()
    )
    on conflict (user_id) do update set
      client_id = excluded.client_id,
      client_secret_enc = excluded.client_secret_enc,
      refresh_token_enc = excluded.refresh_token_enc,
      access_token_enc = excluded.access_token_enc,
      access_expires_at = excluded.access_expires_at,
      email = excluded.email,
      updated_at = now()
  `;
  const calendars = await listCalendarsWith(fresh.access);
  return { ok: true as const, email: email || null, calendars };
}

export async function saveGcalCalendars(data: {
  token: string;
  primaryId: string;
  familyId: string;
}) {
  const { user } = await requireHubUser(data.token);
  const sql = await getSql();
  const row = await loadRow(user.id);
  if (!row && !envFallback()) throw new Error("Сначала подключите Google");
  if (row) {
    await sql`
      update hub_gcal
      set primary_id = ${data.primaryId.trim() || "primary"},
          family_id = ${data.familyId.trim() || null},
          updated_at = now()
      where user_id = ${user.id}
    `;
  }
  return { ok: true as const };
}

export async function disconnectGcal(token: string) {
  const { user } = await requireHubUser(token);
  const sql = await getSql();
  await sql`delete from hub_gcal where user_id = ${user.id}`;
  return { ok: true as const };
}

async function listCalendarsWith(access: string): Promise<GcalListItem[]> {
  const json = await googleJson(`${CAL_API}/users/me/calendarList?maxResults=100`, {
    headers: { authorization: `Bearer ${access}` },
  });
  const items = Array.isArray(json.items) ? json.items : [];
  return items
    .map((raw) => {
      const it = raw as {
        id?: string;
        summary?: string;
        primary?: boolean;
        backgroundColor?: string;
        hidden?: boolean;
        accessRole?: string;
      };
      if (it.hidden) return null;
      const id = String(it.id || "");
      if (!id) return null;
      return {
        id,
        summary: String(it.summary || it.id || "Календарь"),
        primary: Boolean(it.primary),
        color: normalizeHex(it.backgroundColor) || "#4285F4",
        accessRole: String(it.accessRole || "reader"),
      };
    })
    .filter((c): c is GcalListItem => Boolean(c));
}

function normalizeHex(raw?: string) {
  const hex = String(raw || "")
    .replace(/^#/, "")
    .replace(/[^0-9a-f]/gi, "");
  if (hex.length >= 6) return `#${hex.slice(0, 6).toUpperCase()}`;
  return "";
}

export async function statusGcal(token: string) {
  const { user } = await requireHubUser(token);
  try {
    const creds = await credsFor(user.id);
    if (!creds) return { connected: false as const, calendars: [] as GcalListItem[] };
    const calendars = await listCalendarsWith(creds.access);
    return {
      connected: true as const,
      email: creds.email,
      primaryId: creds.primaryId,
      familyId: creds.familyId,
      familyEmails: creds.familyEmails,
      calendars,
    };
  } catch (err) {
    return {
      connected: false as const,
      calendars: [] as GcalListItem[],
      error: err instanceof Error ? err.message : "Google недоступен",
    };
  }
}

function isoEnd(startIso: string, endIso?: string) {
  if (endIso) return endIso;
  const t = new Date(startIso).getTime();
  if (!Number.isFinite(t)) return new Date(Date.now() + 3600_000).toISOString();
  return new Date(t + 3600_000).toISOString();
}

export async function upsertGcalEvent(data: {
  token: string;
  localId: string;
  summary: string;
  start: string;
  end?: string;
  shared?: boolean;
  tz?: string;
  googleEventId?: string;
}) {
  const { user } = await requireHubUser(data.token);
  const creds = await credsFor(user.id);
  if (!creds) return { skipped: true as const };
  const calId = data.shared ? creds.familyId || creds.primaryId : creds.primaryId;
  if (data.shared && !creds.familyId) {
    throw new Error("Семейный календарь не выбран в настройках");
  }
  const tz = (data.tz || "Europe/Moscow").trim();
  const attendees = data.shared
    ? creds.familyEmails
        .filter((e) => e !== (creds.email || "").toLowerCase())
        .map((email) => ({ email }))
    : [];
  const body: Record<string, unknown> = {
    summary: data.summary.trim().slice(0, 120),
    start: { dateTime: data.start, timeZone: tz },
    end: { dateTime: isoEnd(data.start, data.end), timeZone: tz },
    extendedProperties: { private: { hubId: data.localId } },
  };
  if (attendees.length) body.attendees = attendees;
  const encodedCal = encodeURIComponent(calId);
  const q = attendees.length ? "?sendUpdates=all" : "";
  if (data.googleEventId) {
    const json = await googleJson(
      `${CAL_API}/calendars/${encodedCal}/events/${encodeURIComponent(data.googleEventId)}${q}`,
      {
        method: "PATCH",
        headers: { authorization: `Bearer ${creds.access}`, "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
    return { skipped: false as const, googleEventId: String(json.id), calendarId: calId };
  }
  const json = await googleJson(`${CAL_API}/calendars/${encodedCal}/events${q}`, {
    method: "POST",
    headers: { authorization: `Bearer ${creds.access}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { skipped: false as const, googleEventId: String(json.id), calendarId: calId };
}

export async function deleteGcalEvent(data: {
  token: string;
  googleEventId: string;
  calendarId?: string;
  shared?: boolean;
}) {
  const { user } = await requireHubUser(data.token);
  const creds = await credsFor(user.id);
  if (!creds) return { skipped: true as const };
  const calId = data.calendarId || (data.shared ? creds.familyId : creds.primaryId) || creds.primaryId;
  const url = `${CAL_API}/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(data.googleEventId)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { authorization: `Bearer ${creds.access}` },
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 404 || res.status === 410) return { skipped: false as const };
  if (!res.ok && res.status !== 204) throw new Error(`Не удалось удалить в Google (${res.status})`);
  return { skipped: false as const };
}

export async function createFamilyCalendar(token: string) {
  const { user } = await requireHubUser(token);
  const creds = await credsFor(user.id);
  if (!creds) throw new Error("Сначала подключите Google");
  const json = await googleJson(`${CAL_API}/calendars`, {
    method: "POST",
    headers: { authorization: `Bearer ${creds.access}`, "content-type": "application/json" },
    body: JSON.stringify({ summary: "Семья", timeZone: "Europe/Moscow" }),
  });
  const id = String(json.id || "");
  if (!id) throw new Error("Google не создал календарь");
  const sql = await getSql();
  await sql`update hub_gcal set family_id = ${id}, updated_at = now() where user_id = ${user.id}`;
  const calendars = await listCalendarsWith(creds.access);
  return { ok: true as const, familyId: id, calendars };
}

export async function shareFamilyCalendar(data: { token: string; emails: string }) {
  const { user } = await requireHubUser(data.token);
  const creds = await credsFor(user.id);
  if (!creds) throw new Error("Сначала подключите Google");
  if (!creds.familyId) throw new Error("Сначала создайте или выберите семейный календарь");
  const emails = parseEmails(data.emails);
  if (!emails.length) throw new Error("Укажите почты семьи");
  const encodedCal = encodeURIComponent(creds.familyId);
  for (const email of emails) {
    if (email === (creds.email || "").toLowerCase()) continue;
    await googleJson(`${CAL_API}/calendars/${encodedCal}/acl?sendNotifications=true`, {
      method: "POST",
      headers: { authorization: `Bearer ${creds.access}`, "content-type": "application/json" },
      body: JSON.stringify({
        role: "writer",
        scope: { type: "user", value: email },
      }),
    });
  }
  const sql = await getSql();
  await sql`
    update hub_gcal
    set family_emails = ${emails.join(",")}, updated_at = now()
    where user_id = ${user.id}
  `;
  return { ok: true as const, emails };
}

export type GcalInvitee = {
  email: string;
  name: string;
  status: "accepted" | "declined" | "pending";
  access: "read" | "write";
};

async function patchColor(access: string, id: string, color: string) {
  const hex = normalizeHex(color) || "#4285F4";
  await googleJson(`${CAL_API}/users/me/calendarList/${encodeURIComponent(id)}?colorRgbFormat=true`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${access}`, "content-type": "application/json" },
    body: JSON.stringify({ backgroundColor: hex, selected: true }),
  });
}

async function shareWith(access: string, id: string, emails: string[], write: boolean) {
  const encoded = encodeURIComponent(id);
  const role = write ? "writer" : "reader";
  for (const email of emails) {
    await googleJson(`${CAL_API}/calendars/${encoded}/acl?sendNotifications=true`, {
      method: "POST",
      headers: { authorization: `Bearer ${access}`, "content-type": "application/json" },
      body: JSON.stringify({ role, scope: { type: "user", value: email } }),
    });
  }
}

async function setPublic(access: string, id: string, publish: boolean) {
  const encoded = encodeURIComponent(id);
  if (publish) {
    await googleJson(`${CAL_API}/calendars/${encoded}/acl?sendNotifications=false`, {
      method: "POST",
      headers: { authorization: `Bearer ${access}`, "content-type": "application/json" },
      body: JSON.stringify({ role: "reader", scope: { type: "default" } }),
    }).catch(() => undefined);
    return;
  }
  const res = await fetch(`${CAL_API}/calendars/${encoded}/acl/default`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${access}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error("Не удалось скрыть публичную ссылку");
  }
}

async function assignRoles(userId: string, data: { id: string; asFamily?: boolean; asPrimary?: boolean }) {
  const sql = await getSql();
  if (data.asFamily) {
    await sql`update hub_gcal set family_id = ${data.id}, updated_at = now() where user_id = ${userId}`;
  }
  if (data.asPrimary) {
    await sql`update hub_gcal set primary_id = ${data.id}, updated_at = now() where user_id = ${userId}`;
  }
}

export async function createGcalCalendar(data: {
  token: string;
  name: string;
  color: string;
  asFamily?: boolean;
  asPrimary?: boolean;
  emails?: string;
  publish?: boolean;
}) {
  const { user } = await requireHubUser(data.token);
  const creds = await credsFor(user.id);
  if (!creds) throw new Error("Сначала подключите Google");
  const name = data.name.trim().slice(0, 80);
  if (!name) throw new Error("Название календаря");
  const json = await googleJson(`${CAL_API}/calendars`, {
    method: "POST",
    headers: { authorization: `Bearer ${creds.access}`, "content-type": "application/json" },
    body: JSON.stringify({ summary: name, timeZone: "Europe/Moscow" }),
  });
  const id = String(json.id || "");
  if (!id) throw new Error("Google не создал календарь");
  await patchColor(creds.access, id, data.color).catch(() => undefined);
  const emails = parseEmails(data.emails);
  if (emails.length) {
    await shareWith(creds.access, id, emails.filter((e) => e !== (creds.email || "").toLowerCase()), true);
  }
  if (data.publish) await setPublic(creds.access, id, true).catch(() => undefined);
  await assignRoles(user.id, {
    id,
    asFamily: data.asFamily || /семь|family/i.test(name),
    asPrimary: data.asPrimary,
  });
  if (emails.length) {
    const sql = await getSql();
    await sql`
      update hub_gcal
      set family_emails = ${emails.join(",")}, updated_at = now()
      where user_id = ${user.id}
    `;
  }
  const calendars = await listCalendarsWith(creds.access);
  return { ok: true as const, id, calendars };
}

export async function updateGcalCalendar(data: {
  token: string;
  id: string;
  name: string;
  color: string;
  asFamily?: boolean;
  asPrimary?: boolean;
  publish?: boolean;
}) {
  const { user } = await requireHubUser(data.token);
  const creds = await credsFor(user.id);
  if (!creds) throw new Error("Сначала подключите Google");
  const name = data.name.trim().slice(0, 80);
  if (!name) throw new Error("Название календаря");
  const encoded = encodeURIComponent(data.id);
  await googleJson(`${CAL_API}/calendars/${encoded}`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${creds.access}`, "content-type": "application/json" },
    body: JSON.stringify({ summary: name }),
  });
  await patchColor(creds.access, data.id, data.color).catch(() => undefined);
  if (typeof data.publish === "boolean") {
    await setPublic(creds.access, data.id, data.publish).catch(() => undefined);
  }
  await assignRoles(user.id, data);
  const calendars = await listCalendarsWith(creds.access);
  return { ok: true as const, calendars };
}

export async function deleteGcalCalendar(data: { token: string; id: string }) {
  const { user } = await requireHubUser(data.token);
  const creds = await credsFor(user.id);
  if (!creds) throw new Error("Сначала подключите Google");
  if (data.id === creds.email || data.id === "primary") {
    throw new Error("Основной календарь Google удалить нельзя");
  }
  const res = await fetch(`${CAL_API}/calendars/${encodeURIComponent(data.id)}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${creds.access}` },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok && res.status !== 204 && res.status !== 404 && res.status !== 410) {
    const text = await res.text();
    throw new Error(text.slice(0, 160) || `Google ${res.status}`);
  }
  const sql = await getSql();
  await sql`
    update hub_gcal
    set
      primary_id = case when primary_id = ${data.id} then 'primary' else primary_id end,
      family_id = case when family_id = ${data.id} then null else family_id end,
      updated_at = now()
    where user_id = ${user.id}
  `;
  const calendars = await listCalendarsWith(creds.access).catch(() => [] as GcalListItem[]);
  return { ok: true as const, calendars };
}

export async function shareGcalCalendar(data: {
  token: string;
  id: string;
  emails: string;
  write?: boolean;
}) {
  const { user } = await requireHubUser(data.token);
  const creds = await credsFor(user.id);
  if (!creds) throw new Error("Сначала подключите Google");
  const emails = parseEmails(data.emails).filter((e) => e !== (creds.email || "").toLowerCase());
  if (!emails.length) throw new Error("Укажите почту");
  await shareWith(creds.access, data.id, emails, data.write !== false);
  const info = await calendarInfoGcal({ token: data.token, id: data.id });
  return { ok: true as const, invitees: info.invitees };
}

export async function unshareGcalCalendar(data: { token: string; id: string; email: string }) {
  const { user } = await requireHubUser(data.token);
  const creds = await credsFor(user.id);
  if (!creds) throw new Error("Сначала подключите Google");
  const ruleId = `user:${data.email.trim().toLowerCase()}`;
  const res = await fetch(`${CAL_API}/calendars/${encodeURIComponent(data.id)}/acl/${encodeURIComponent(ruleId)}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${creds.access}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok && res.status !== 204 && res.status !== 404 && res.status !== 410) {
    throw new Error("Не удалось убрать человека");
  }
  const info = await calendarInfoGcal({ token: data.token, id: data.id });
  return { ok: true as const, invitees: info.invitees };
}

export async function calendarInfoGcal(data: { token: string; id: string }) {
  const { user } = await requireHubUser(data.token);
  const creds = await credsFor(user.id);
  if (!creds) throw new Error("Сначала подключите Google");
  const json = await googleJson(`${CAL_API}/calendars/${encodeURIComponent(data.id)}/acl`, {
    headers: { authorization: `Bearer ${creds.access}` },
  });
  const items = Array.isArray(json.items) ? json.items : [];
  const invitees: GcalInvitee[] = [];
  let publish = false;
  for (const raw of items) {
    const it = raw as {
      role?: string;
      scope?: { type?: string; value?: string };
    };
    const type = String(it.scope?.type || "");
    if (type === "default") {
      publish = true;
      continue;
    }
    if (type !== "user") continue;
    const email = String(it.scope?.value || "").toLowerCase();
    if (!email || email === (creds.email || "").toLowerCase()) continue;
    if (it.role === "owner") continue;
    invitees.push({
      email,
      name: email.split("@")[0] || email,
      status: "accepted",
      access: it.role === "writer" || it.role === "owner" ? "write" : "read",
    });
  }
  const publishUrl = publish
    ? `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(data.id)}`
    : "";
  return { invitees, publish, publishUrl };
}
