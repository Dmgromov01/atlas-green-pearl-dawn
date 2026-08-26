-- Shared household items + reminder log (one hub = one family).
create table if not exists hub_share (
  id          text primary key,
  kind        text not null,
  owner_id    text not null references hub_users (id) on delete cascade,
  payload     text not null,
  updated_at  timestamptz not null default now()
);

create index if not exists hub_share_kind_idx on hub_share (kind, updated_at desc);

create table if not exists hub_nudge (
  id          text primary key,
  user_id     text not null references hub_users (id) on delete cascade,
  stamp       text not null,
  created_at  timestamptz not null default now(),
  unique (user_id, stamp)
);
