-- Hub identity, sessions, BYOK keys, quotas, audit (Telegram Mini App).
create table if not exists hub_users (
  id               text primary key,
  telegram_id      text unique,
  username         text,
  display_name     text not null default '',
  role             text not null default 'user',
  allowed          boolean not null default false,
  pin_salt         text,
  pin_hash         text,
  ai_mode          text not null default 'off',
  allow_global_ai  boolean not null default false,
  quota_daily      integer not null default 40,
  quota_used       integer not null default 0,
  quota_reset_on   date,
  byok_provider    text,
  byok_base_url    text,
  byok_key_enc     text,
  byok_key_hint    text,
  created_at       timestamptz not null default now(),
  last_seen_at     timestamptz
);

create index if not exists hub_users_telegram_idx on hub_users (telegram_id);
create index if not exists hub_users_role_idx on hub_users (role);

create table if not exists hub_sessions (
  id           text primary key,
  user_id      text not null references hub_users (id) on delete cascade,
  token_hash   text not null unique,
  auth_method  text not null,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now()
);

create index if not exists hub_sessions_user_idx on hub_sessions (user_id);
create index if not exists hub_sessions_exp_idx on hub_sessions (expires_at);

create table if not exists hub_audit (
  id           serial primary key,
  user_id      text,
  telegram_id  text,
  action       text not null,
  auth_method  text,
  key_source   text,
  detail       text,
  created_at   timestamptz not null default now()
);

create index if not exists hub_audit_user_idx on hub_audit (user_id, created_at desc);
create index if not exists hub_audit_created_idx on hub_audit (created_at desc);
