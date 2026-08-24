-- Command — secure data core (part 1: profiles, settings, daily logs, learning)
-- All user tables: RLS, same-user referential integrity, maintained timestamps.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles (one row per authenticated user)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  timezone text not null default 'Asia/Kolkata',
  week_starts_on smallint not null default 1 check (week_starts_on between 0 and 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());
create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- user settings (floors / budgets)
-- ---------------------------------------------------------------------------
create table public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  node_floor_minutes integer not null default 30 check (node_floor_minutes >= 0),
  dsa_floor_minutes integer not null default 60 check (dsa_floor_minutes >= 0),
  math_floor_minutes integer not null default 30 check (math_floor_minutes >= 0),
  job_hunt_floor_minutes integer not null default 60 check (job_hunt_floor_minutes >= 0),
  node_weekly_minutes integer not null default 420 check (node_weekly_minutes >= 0),
  dsa_weekly_minutes integer not null default 840 check (dsa_weekly_minutes >= 0),
  math_weekly_minutes integer not null default 420 check (math_weekly_minutes >= 0),
  job_hunt_weekly_minutes integer not null default 420 check (job_hunt_weekly_minutes >= 0),
  theme text not null default 'dark',
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "user_settings_select" on public.user_settings
  for select using (user_id = auth.uid());
create policy "user_settings_insert" on public.user_settings
  for insert with check (user_id = auth.uid());
create policy "user_settings_update" on public.user_settings
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- DAILY LOGS
-- ---------------------------------------------------------------------------
create table public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  meditation boolean not null default false,
  gym boolean not null default false,
  diet text check (diet in ('on_track', 'loose', 'off', null)),
  node_minutes integer not null default 0 check (node_minutes >= 0),
  dsa_minutes integer not null default 0 check (dsa_minutes >= 0),
  math_minutes integer not null default 0 check (math_minutes >= 0),
  job_hunt_minutes integer not null default 0 check (job_hunt_minutes >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day)
);

create index daily_logs_user_day_idx on public.daily_logs (user_id, day);

alter table public.daily_logs enable row level security;

create policy "daily_logs_select" on public.daily_logs
  for select using (user_id = auth.uid());
create policy "daily_logs_insert" on public.daily_logs
  for insert with check (user_id = auth.uid());
create policy "daily_logs_update" on public.daily_logs
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- LEARNING ITEMS
-- ---------------------------------------------------------------------------
create table public.learning_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  concept text not null,
  stack text not null check (stack in ('job', 'brain')),
  track text not null check (track in ('node', 'dsa', 'math')),
  item_type text not null check (item_type in ('concept', 'pattern', 'snippet', 'formula')),
  confidence smallint not null default 3 check (confidence between 1 and 5),
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  next_review_on date,
  last_reviewed_on date,
  mastery_hits smallint not null default 0 check (mastery_hits >= 0),
  source_url text,
  content_markdown text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index learning_items_user_next_review_idx on public.learning_items (user_id, next_review_on);
create index learning_items_user_track_idx on public.learning_items (user_id, track);

alter table public.learning_items enable row level security;

create policy "learning_items_select" on public.learning_items
  for select using (user_id = auth.uid());
create policy "learning_items_insert" on public.learning_items
  for insert with check (user_id = auth.uid());
create policy "learning_items_update" on public.learning_items
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());