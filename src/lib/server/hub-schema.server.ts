import { getSql, type Sql } from "@/lib/db";

const STATEMENTS = [
  `create table if not exists hub_webauthn (
    id text primary key,
    user_id text not null,
    public_key text not null,
    counter integer not null default 0,
    device_type text,
    backed_up boolean not null default false,
    transports text,
    label text,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists hub_webauthn_user_idx on hub_webauthn (user_id)`,
  `create table if not exists hub_invites (
    id text primary key,
    token_hash text not null unique,
    created_by text not null,
    role text not null default 'user',
    display_name text,
    expires_at timestamptz not null,
    used_by text,
    used_at timestamptz,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists hub_invites_exp_idx on hub_invites (expires_at)`,
  `create table if not exists hub_webauthn_challenges (
    id text primary key,
    user_id text,
    challenge text not null,
    kind text not null,
    expires_at timestamptz not null,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists hub_webauthn_challenges_exp_idx on hub_webauthn_challenges (expires_at)`,
  `create table if not exists hub_reminders (
    id text primary key,
    user_id text not null,
    text text not null,
    due_at timestamptz not null,
    recurrence text not null default 'none',
    source text not null default 'user',
    confirmed boolean not null default true,
    delivered_at timestamptz,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists hub_reminders_due_idx on hub_reminders (due_at)`,
  `create index if not exists hub_reminders_user_idx on hub_reminders (user_id, due_at)`,
  `create table if not exists hub_digest_sources (
    id text primary key,
    user_id text,
    name text not null,
    url text not null unique,
    kind text not null default 'rss',
    enabled boolean not null default true,
    rank integer not null default 0,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists hub_digest_sources_rank_idx on hub_digest_sources (enabled, rank)`,
  `create table if not exists hub_digest_items (
    id text primary key,
    source_id text,
    url text not null unique,
    title text not null,
    summary text,
    published_at timestamptz,
    score double precision not null default 0,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists hub_digest_items_score_idx on hub_digest_items (score, published_at)`,
  `create table if not exists hub_digest_meta (
    id text primary key,
    refreshed_at timestamptz,
    item_count integer not null default 0,
    brief text
  )`,
];

const globalRef = globalThis as typeof globalThis & { __hubSchemaPromise__?: Promise<void> };

export async function ensureHubSchema(sql?: Sql) {
  globalRef.__hubSchemaPromise__ ??= (async () => {
    const db = sql ?? (await getSql());
    for (const stmt of STATEMENTS) {
      try {
        await db.query(stmt);
      } catch (err) {
        console.error("[hub-schema] statement failed:", stmt.slice(0, 60), err);
      }
    }
  })().catch((err) => {
    globalRef.__hubSchemaPromise__ = undefined;
    throw err;
  });
  return globalRef.__hubSchemaPromise__;
}
