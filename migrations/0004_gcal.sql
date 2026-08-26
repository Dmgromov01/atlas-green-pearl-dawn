-- Google Calendar OAuth (write to personal + family calendars)
create table if not exists hub_gcal (
  user_id            text primary key references hub_users (id) on delete cascade,
  client_id          text not null,
  client_secret_enc  text not null,
  refresh_token_enc  text not null,
  access_token_enc   text,
  access_expires_at  timestamptz,
  email              text,
  primary_id         text not null default 'primary',
  family_id          text,
  updated_at         timestamptz not null default now()
);
