-- Family digest sources + ranked snapshot (cron refreshes, UI reads).
create table if not exists hub_digest_sources (
  id         text primary key,
  user_id    text,
  name       text not null,
  url        text not null unique,
  kind       text not null default 'rss',
  enabled    boolean not null default true,
  rank       integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists hub_digest_sources_rank_idx on hub_digest_sources (enabled, rank);

create table if not exists hub_digest_items (
  id            text primary key,
  source_id     text,
  url           text not null unique,
  title         text not null,
  summary       text,
  published_at  timestamptz,
  score         double precision not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists hub_digest_items_score_idx on hub_digest_items (score, published_at);

create table if not exists hub_digest_meta (
  id           text primary key,
  refreshed_at timestamptz,
  item_count   integer not null default 0,
  brief        text
);
