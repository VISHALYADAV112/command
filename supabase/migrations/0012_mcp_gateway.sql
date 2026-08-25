-- Command MCP: user-scoped search plus a private, reviewable tool audit.

create table public.mcp_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  client_id text not null,
  tool_name text not null,
  input_summary jsonb not null default '{}'::jsonb,
  success boolean not null,
  error_message text,
  duration_ms integer not null check (duration_ms >= 0),
  created_at timestamptz not null default now()
);

create index mcp_audit_user_created_idx
  on public.mcp_audit_log (user_id, created_at desc);

alter table public.mcp_audit_log enable row level security;
revoke all on public.mcp_audit_log from anon, authenticated;
grant select, delete on public.mcp_audit_log to authenticated;
grant all on public.mcp_audit_log to service_role;

create policy "mcp_audit_select_own" on public.mcp_audit_log
  for select using (user_id = auth.uid());
create policy "mcp_audit_delete_own" on public.mcp_audit_log
  for delete using (user_id = auth.uid());

create or replace function public.search_command(
  p_query text,
  p_limit integer default 20
) returns table (
  entity_type text,
  entity_id uuid,
  title text,
  detail text,
  status text,
  due_on date
)
language sql
stable
security invoker
set search_path = public
as $$
  select result.entity_type, result.entity_id, result.title,
    result.detail, result.status, result.due_on
  from (
    select 'learning'::text, id, concept, content_markdown,
      track, next_review_on
    from public.learning_items
    where user_id = auth.uid()
      and concat_ws(' ', concept, content_markdown, track, item_type) ilike '%' || p_query || '%'
    union all
    select 'person', id, name, concat_ws(' · ', company, notes),
      status, next_follow_up_on
    from public.people
    where user_id = auth.uid()
      and concat_ws(' ', name, company, email, notes) ilike '%' || p_query || '%'
    union all
    select 'application', id, concat_ws(' — ', company, role),
      concat_ws(' · ', next_action, notes), status,
      coalesce(follow_up_on, window_closes_on)
    from public.job_applications
    where user_id = auth.uid()
      and concat_ws(' ', company, role, next_action, notes) ilike '%' || p_query || '%'
    union all
    select 'project', id, name, concat_ws(' · ', next_action, content_markdown),
      status, deadline_on
    from public.projects
    where user_id = auth.uid()
      and concat_ws(' ', name, client, next_action, content_markdown) ilike '%' || p_query || '%'
    union all
    select 'idea', id, idea, concat_ws(' · ', problem, next_action),
      status, null::date
    from public.ideas
    where user_id = auth.uid()
      and concat_ws(' ', idea, problem, target_market, next_action) ilike '%' || p_query || '%'
    union all
    select 'daily_log', id, day::text, note, diet, day
    from public.daily_logs
    where user_id = auth.uid()
      and concat_ws(' ', day::text, note, diet) ilike '%' || p_query || '%'
  ) as result(entity_type, entity_id, title, detail, status, due_on)
  where length(btrim(p_query)) between 2 and 100
  order by result.due_on nulls last, result.title
  limit least(greatest(p_limit, 1), 50);
$$;

revoke all on function public.search_command(text, integer) from public, anon;
grant execute on function public.search_command(text, integer) to authenticated;
