-- Command — secure data core (part 2: people, applications, projects, ideas)

-- PEOPLE ------------------------------------------------------------------
create table public.people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  company text,
  email text,
  linkedin_url text,
  how_known text check (how_known in ('cold', 'alumni', 'linkedin', 'ex_colleague', 'referred_by')),
  status text not null default 'to_reach_out' check (status in ('to_reach_out', 'talking', 'referred', 'cold')),
  last_contacted_on date,
  next_follow_up_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index people_user_next_follow_up_idx on public.people (user_id, next_follow_up_on);
create index people_user_status_idx on public.people (user_id, status);

alter table public.people enable row level security;

create policy "people_select" on public.people
  for select using (user_id = auth.uid());
create policy "people_insert" on public.people
  for insert with check (user_id = auth.uid());
create policy "people_update" on public.people
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- JOB APPLICATIONS ------------------------------------------------------------
create table public.job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  company text not null,
  role text not null,
  lane text not null check (lane in ('sde', 'ai_ml')),
  channel text not null check (channel in ('india_product', 'gcc', 'remote_intl', 'services')),
  status text not null default 'researching' check (status in ('researching', 'applied', 'oa', 'phone', 'onsite', 'offer', 'rejected')),
  referrer_id uuid references public.people (id),
  ctc_lpa numeric,
  next_action text,
  follow_up_on date,
  window_closes_on date,
  job_url text,
  resume_version text,
  resume_drive_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index job_applications_user_status_idx on public.job_applications (user_id, status);
create index job_applications_user_follow_up_idx on public.job_applications (user_id, follow_up_on);
create index job_applications_user_window_idx on public.job_applications (user_id, window_closes_on);

alter table public.job_applications enable row level security;

create policy "job_applications_select" on public.job_applications
  for select using (user_id = auth.uid());
create policy "job_applications_insert" on public.job_applications
  for insert with check (user_id = auth.uid());
create policy "job_applications_update" on public.job_applications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Referrer must belong to the same user -------------------------------------
create or replace function public.validate_application_referrer()
returns trigger language plpgsql security invoker as $$
begin
  if new.referrer_id is not null then
    if not exists (
      select 1 from public.people p
      where p.id = new.referrer_id and p.user_id = new.user_id
    ) then
      raise exception 'referrer_id must belong to the same user';
    end if;
  end if;
  return new;
end;
$$;

create trigger job_applications_referrer_check
  before insert or update of referrer_id on public.job_applications
  for each row execute function public.validate_application_referrer();
-- PROJECTS ------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  project_type text not null check (project_type in ('internship', 'freelance', 'portfolio')),
  status text not null default 'active' check (status in ('active', 'blocked', 'review', 'done')),
  client text,
  payment_status text not null default 'na' check (payment_status in ('na', 'unpaid', 'invoiced', 'paid')),
  amount numeric,
  currency char(3) not null default 'INR',
  is_public boolean not null default false,
  deadline_on date,
  repo_url text,
  demo_url text,
  drive_folder_url text,
  next_action text,
  content_markdown text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index projects_user_status_idx on public.projects (user_id, status);
create index projects_user_deadline_idx on public.projects (user_id, deadline_on);

alter table public.projects enable row level security;

create policy "projects_select" on public.projects
  for select using (user_id = auth.uid());
create policy "projects_insert" on public.projects
  for insert with check (user_id = auth.uid());
create policy "projects_update" on public.projects
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- IDEAS ------------------------------------------------------------------------------
create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  idea text not null,
  problem text,
  target_market text,
  monetization text,
  status text not null default 'captured' check (status in ('captured', 'exploring', 'validating', 'dropped')),
  next_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ideas_user_status_idx on public.ideas (user_id, status);

alter table public.ideas enable row level security;

create policy "ideas_select" on public.ideas
  for select using (user_id = auth.uid());
create policy "ideas_insert" on public.ideas
  for insert with check (user_id = auth.uid());
create policy "ideas_update" on public.ideas
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- updated_at maintenance -----------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger user_settings_set_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();
create trigger daily_logs_set_updated_at before update on public.daily_logs
  for each row execute function public.set_updated_at();
create trigger learning_items_set_updated_at before update on public.learning_items
  for each row execute function public.set_updated_at();
create trigger people_set_updated_at before update on public.people
  for each row execute function public.set_updated_at();
create trigger job_applications_set_updated_at before update on public.job_applications
  for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger ideas_set_updated_at before update on public.ideas
  for each row execute function public.set_updated_at();