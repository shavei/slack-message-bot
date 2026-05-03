create extension if not exists pgcrypto;

create table if not exists public.oauth_states (
  state_hash text primary key,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  session_hash text not null unique,
  encrypted_slack_user_token text not null,
  slack_user_id text not null,
  slack_user_name text,
  slack_team_id text,
  slack_team_name text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  channel_id text not null,
  slack_ts text not null,
  text text not null default '',
  sent_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (channel_id, slack_ts)
);

alter table public.oauth_states enable row level security;
alter table public.sessions enable row level security;
alter table public.messages enable row level security;

create index if not exists oauth_states_expires_at_idx on public.oauth_states (expires_at);
create index if not exists sessions_expires_at_idx on public.sessions (expires_at);
create index if not exists sessions_slack_user_id_idx on public.sessions (slack_user_id);
create index if not exists messages_sent_at_idx on public.messages (sent_at desc);
create index if not exists messages_channel_id_idx on public.messages (channel_id);
