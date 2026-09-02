-- Supabase OAuth access tokens use the normal authenticated database role.
-- Connected MCP clients must not bypass Command's tool permissions by calling
-- PostgREST directly. First-party sessions have no client_id claim; the MCP
-- Edge Function uses the service role and applies an explicit owner filter.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'user_settings', 'daily_logs', 'learning_items', 'people',
    'job_applications', 'projects', 'ideas', 'entity_types', 'entities',
    'commitments', 'activity_events', 'agent_proposals', 'mcp_audit_log',
    'mcp_client_permissions'
  ] loop
    execute format(
      'create policy "first_party_or_service_only" on public.%I as restrictive for all to authenticated using (auth.jwt() ->> ''client_id'' is null) with check (auth.jwt() ->> ''client_id'' is null)',
      table_name
    );
  end loop;
end;
$$;

create function public.get_v3_due_for_mcp(
  p_user_id uuid,
  p_day date default null,
  p_window text default 'all',
  p_type_key text default null,
  p_limit integer default 50,
  p_offset integer default 0
) returns table (
  commitment_id uuid,
  entity_id uuid,
  entity_type_id uuid,
  type_key text,
  entity_title text,
  kind text,
  action text,
  due_on date,
  state text,
  origin_source text,
  due_status text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  local_day date;
  week_end date;
begin
  if p_user_id is null then
    raise exception using errcode = '22023', message = 'owner is required';
  end if;
  if p_window not in ('overdue', 'today', 'week', 'all') then
    raise exception using errcode = '22023', message = 'invalid due window';
  end if;

  select coalesce(
    p_day,
    (now() at time zone coalesce(profile.timezone, 'Asia/Kolkata'))::date
  ) into local_day
  from public.profiles profile
  where profile.id = p_user_id;
  if local_day is null then
    raise exception using errcode = '42501', message = 'profile not found';
  end if;
  week_end := local_day + (7 - extract(isodow from local_day)::integer);

  return query
  select commitment.id, entity.id, entity_type.id, entity_type.type_key,
    entity.title, commitment.kind, commitment.action, commitment.due_on,
    commitment.state, commitment.origin_source,
    case
      when commitment.due_on < local_day then 'overdue'
      when commitment.due_on = local_day then 'today'
      else 'upcoming'
    end
  from public.commitments commitment
  join public.entities entity
    on entity.user_id = commitment.user_id and entity.id = commitment.entity_id
  join public.entity_types entity_type
    on entity_type.user_id = entity.user_id and entity_type.id = entity.entity_type_id
  where commitment.user_id = p_user_id
    and commitment.state = 'open'
    and entity.archived_at is null
    and (p_type_key is null or entity_type.type_key = p_type_key)
    and (
      p_window = 'all'
      or (p_window = 'overdue' and commitment.due_on < local_day)
      or (p_window = 'today' and commitment.due_on = local_day)
      or (p_window = 'week' and commitment.due_on between local_day and week_end)
    )
  order by commitment.due_on, commitment.id
  limit least(greatest(coalesce(p_limit, 50), 1), 100)
  offset least(greatest(coalesce(p_offset, 0), 0), 10000);
end;
$$;

revoke all on function public.get_v3_due_for_mcp(uuid, date, text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.get_v3_due_for_mcp(uuid, date, text, text, integer, integer)
  to service_role;
