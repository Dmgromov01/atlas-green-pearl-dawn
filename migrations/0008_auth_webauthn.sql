-- Passkeys, one-time family invites, short-lived WebAuthn challenges.
create table if not exists hub_webauthn (
  id           text primary key,
  user_id      text not null references hub_users (id) on delete cascade,
  public_key   text not null,
  counter      bigint not null default 0,
  device_type  text,
  backed_up    boolean not null default false,
  transports   text,
  label        text,
  created_at   timestamptz not null default now()
);

create index if not exists hub_webauthn_user_idx on hub_webauthn (user_id);

create table if not exists hub_invites (
  id           text primary key,
  token_hash   text not null unique,
  created_by   text not null references hub_users (id) on delete cascade,
  role         text not null default 'user',
  display_name text,
  expires_at   timestamptz not null,
  used_by      text references hub_users (id) on delete set null,
  used_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists hub_invites_exp_idx on hub_invites (expires_at);

create table if not exists hub_webauthn_challenges (
  id           text primary key,
  user_id      text references hub_users (id) on delete cascade,
  challenge    text not null,
  kind         text not null,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now()
);

create index if not exists hub_webauthn_challenges_exp_idx on hub_webauthn_challenges (expires_at);
