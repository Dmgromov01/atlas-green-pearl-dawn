create table if not exists hub_icloud (
  user_id       text primary key references hub_users (id) on delete cascade,
  apple_id      text not null,
  password_enc  text not null,
  base_url      text,
  home_url      text,
  primary_href  text,
  family_href   text,
  updated_at    timestamptz not null default now()
);
