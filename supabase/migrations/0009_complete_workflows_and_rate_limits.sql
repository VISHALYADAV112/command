-- Complete application fields and add an atomic edge-function rate limiter.

alter table public.job_applications
  add column if not exists applied_on date,
  add column if not exists has_referral boolean not null default false;

update public.job_applications
set has_referral = true
where referrer_id is not null and has_referral = false;

alter table public.job_applications
  add constraint active_application_has_next_action
  check (
    status in ('offer', 'rejected')
    or nullif(btrim(next_action), '') is not null
  ) not valid;

create table public.edge_rate_limits (
  user_id uuid not null references public.profiles (id) on delete cascade,
  bucket text not null,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  primary key (user_id, bucket)
);

alter table public.edge_rate_limits enable row level security;
revoke all on public.edge_rate_limits from anon, authenticated;
grant all on public.edge_rate_limits to service_role;

create or replace function public.consume_edge_rate_limit(
  p_user_id uuid,
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
begin
  insert into public.edge_rate_limits (user_id, bucket, request_count)
  values (p_user_id, p_bucket, 1)
  on conflict (user_id, bucket) do update
  set
    window_started_at = case
      when edge_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
        then now()
      else edge_rate_limits.window_started_at
    end,
    request_count = case
      when edge_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
        then 1
      else edge_rate_limits.request_count + 1
    end
  returning request_count into current_count;

  return current_count <= p_limit;
end;
$$;

revoke all on function public.consume_edge_rate_limit(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_edge_rate_limit(uuid, text, integer, integer) to service_role;
