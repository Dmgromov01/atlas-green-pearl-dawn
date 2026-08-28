-- Voice/text reminders delivered over Telegram, not browser push.
create table if not exists hub_reminders (
  id           text primary key,
  user_id      text not null references hub_users (id) on delete cascade,
  text         text not null,
  due_at       timestamptz not null,
  recurrence   text not null default 'none',
  source       text not null default 'user',
  confirmed    boolean not null default true,
  delivered_at timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists hub_reminders_due_idx on hub_reminders (due_at);
create index if not exists hub_reminders_user_idx on hub_reminders (user_id, due_at);
