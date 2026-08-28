import { randomBytes } from "node:crypto";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { getSql } from "@/lib/db";
import { audit, issueSessionFor, requireHubUser, wipeSessions } from "./hub-auth.server";

type CredRow = {
  id: string;
  user_id: string;
  public_key: string;
  counter: number;
  transports: string | null;
  label: string | null;
};

function uid() {
  return randomBytes(16).toString("hex");
}

function rp() {
  const raw = (process.env.HUB_ORIGIN || "https://hub.gbkz.uk").trim();
  let origin = "https://hub.gbkz.uk";
  let rpID = "hub.gbkz.uk";
  try {
    const u = new URL(raw);
    origin = u.origin;
    rpID = u.hostname;
  } catch {
    /* keep defaults */
  }
  return { rpID, rpName: "AI Personal Hub", origin };
}

function fromB64url(s: string) {
  return new Uint8Array(Buffer.from(s, "base64url"));
}

function toB64url(buf: Uint8Array) {
  return Buffer.from(buf).toString("base64url");
}

async function saveChallenge(kind: string, challenge: string, userId?: string | null) {
  const sql = await getSql();
  await sql`delete from hub_webauthn_challenges where expires_at < now()`;
  const id = uid();
  const exp = new Date(Date.now() + 5 * 60_000).toISOString();
  await sql`
    insert into hub_webauthn_challenges (id, user_id, challenge, kind, expires_at)
    values (${id}, ${userId ?? null}, ${challenge}, ${kind}, ${exp})
  `;
  return id;
}

async function takeChallenge(kind: string, userId?: string | null) {
  const sql = await getSql();
  const rows = userId
    ? await sql<{ id: string; challenge: string }>`
        select id, challenge from hub_webauthn_challenges
        where kind = ${kind} and user_id = ${userId} and expires_at > now()
        order by created_at desc limit 1
      `
    : await sql<{ id: string; challenge: string }>`
        select id, challenge from hub_webauthn_challenges
        where kind = ${kind} and user_id is null and expires_at > now()
        order by created_at desc limit 1
      `;
  const row = rows[0];
  if (!row) return null;
  await sql`delete from hub_webauthn_challenges where id = ${row.id}`;
  return row.challenge;
}

export async function startRegisterPasskey(token?: string): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const { user } = await requireHubUser(token);
  const sql = await getSql();
  const existing = await sql<CredRow>`select * from hub_webauthn where user_id = ${user.id}`;
  const { rpID, rpName } = rp();
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.display_name || user.id.slice(0, 8),
    userDisplayName: user.display_name || "Семья",
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({
      id: c.id,
      transports: (c.transports ? (JSON.parse(c.transports) as AuthenticatorTransportFuture[]) : undefined) ?? undefined,
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
      authenticatorAttachment: "platform",
    },
  });
  await saveChallenge("register", options.challenge, user.id);
  return options;
}

export async function finishRegisterPasskey(
  token: string | undefined,
  response: RegistrationResponseJSON,
  label?: string,
) {
  const { user } = await requireHubUser(token);
  const challenge = await takeChallenge("register", user.id);
  if (!challenge) throw new Error("Сессия Face ID истекла. Повторите.");
  const { origin, rpID } = rp();
  const verified = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: false,
  });
  if (!verified.verified || !verified.registrationInfo) throw new Error("Face ID не подтверждён");
  const cred = verified.registrationInfo.credential;
  const sql = await getSql();
  const transports = cred.transports ? JSON.stringify(cred.transports) : null;
  await sql`
    insert into hub_webauthn (id, user_id, public_key, counter, device_type, backed_up, transports, label)
    values (
      ${cred.id},
      ${user.id},
      ${toB64url(cred.publicKey)},
      ${cred.counter},
      ${verified.registrationInfo.credentialDeviceType},
      ${verified.registrationInfo.credentialBackedUp},
      ${transports},
      ${(label || "Face ID").slice(0, 40)}
    )
  `;
  await wipeSessions(user.id);
  const ses = await issueSessionFor(user.id, "webauthn");
  await audit({ userId: user.id, action: "passkey_register", authMethod: "webauthn", detail: cred.id.slice(0, 12) });
  return { ok: true as const, token: ses.token, expiresAt: ses.expiresAt, user: ses.user };
}

export async function startLoginPasskey(): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const { rpID } = rp();
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
  });
  await saveChallenge("authenticate", options.challenge, null);
  return options;
}

export async function finishLoginPasskey(response: AuthenticationResponseJSON) {
  const challenge = await takeChallenge("authenticate", null);
  if (!challenge) throw new Error("Сессия Face ID истекла. Повторите.");
  const sql = await getSql();
  const rows = await sql<CredRow>`select * from hub_webauthn where id = ${response.id} limit 1`;
  const cred = rows[0];
  if (!cred) throw new Error("Этот Face ID не привязан к хабу");
  const { origin, rpID } = rp();
  const verified = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: false,
    credential: {
      id: cred.id,
      publicKey: fromB64url(cred.public_key),
      counter: Number(cred.counter),
      transports: cred.transports ? (JSON.parse(cred.transports) as AuthenticatorTransportFuture[]) : undefined,
    },
  });
  if (!verified.verified) throw new Error("Face ID не подтверждён");
  await sql`
    update hub_webauthn
    set counter = ${verified.authenticationInfo.newCounter}
    where id = ${cred.id}
  `;
  const ses = await issueSessionFor(cred.user_id, "webauthn");
  return ses;
}

export async function listPasskeysHub(token?: string) {
  const { user } = await requireHubUser(token);
  const sql = await getSql();
  return sql<{ id: string; label: string | null; created_at: string; device_type: string | null }>`
    select id, label, created_at::text as created_at, device_type
    from hub_webauthn
    where user_id = ${user.id}
    order by created_at desc
  `;
}

export async function deletePasskeyHub(token: string | undefined, credId: string) {
  const { user } = await requireHubUser(token);
  const sql = await getSql();
  await sql`delete from hub_webauthn where id = ${credId} and user_id = ${user.id}`;
  await wipeSessions(user.id);
  const remaining = await sql<{ n: number }>`
    select count(*)::int as n from hub_webauthn where user_id = ${user.id}
  `;
  const hasPasskey = Number(remaining[0]?.n ?? 0) > 0;
  const ses = await issueSessionFor(user.id, hasPasskey ? "webauthn" : "pin");
  await audit({ userId: user.id, action: "passkey_delete", authMethod: "webauthn", detail: credId.slice(0, 12) });
  return { ok: true as const, token: ses.token, expiresAt: ses.expiresAt, hasPasskey };
}
