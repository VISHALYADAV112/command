-- Command — profile bootstrap + integration support tables
-- integration_accounts and integration_links live in a private schema that
-- browser roles (anon/authenticated) cannot read; only Edge Functions using
-- the service role may access them.

-- ---------------------------------------------------------------------------
-- Auto-create profile + settings on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Private integration schema
-- ---------------------------------------------------------------------------
create schema if not exists private;

create table private.integration_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null default 'google',
  provider_account_id text not null,
  email text,
  scopes text[] not null default '{}',
  refresh_secret_id uuid,
  status text not null default 'connected' check (status in ('connected', 'expired', 'revoked', 'error')),
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table private.integration_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null default 'google',
  entity_type text not null,
  entity_id uuid not null,
  external_type text not null check (external_type in ('calendar_event', 'task', 'contact', 'drive_file')),
  external_id text not null,
  external_url text,
  idempotency_key text not null,
  fingerprint text,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, provider, entity_type, entity_id, external_type)
);

create index integration_links_user_idx on private.integration_links (user_id);
create index integration_accounts_user_idx on private.integration_accounts (user_id);

create table private.oauth_states (
  id uuid primary key default gen_random_uuid(),
  state text not null unique,
  code_verifier text not null,
  user_id uuid not null,
  created_at timestamptz not null default now()
);
revoke all on private.oauth_states from anon, authenticated;

-- Browser roles get nothing in the private schema.
revoke all on schema private from anon, authenticated;
revoke all on all tables in schema private from anon, authenticated;
grant usage on schema private to service_role;
grant all on all tables in schema private to service_role;