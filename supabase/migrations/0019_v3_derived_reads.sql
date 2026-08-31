-- Command v3 data foundation, slice 6: approved targets and bounded derived reads.

alter table public.user_settings
  add column weekly_application_target integer not null default 15
    check (weekly_application_target between 0 and 10000),
  add column weekly_people_contact_target integer not null default 2
    check (weekly_people_contact_target between 0 and 10000);

create or replace function public.get_v3_due(
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
security invoker
set search_path = pg_catalog, public
as $$
declare
  current_user_id uuid := auth.uid();
  local_day date;
  week_end date;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'authentication required';
  end if;
  if p_window not in ('overdue', 'today', 'week', 'all') then
    raise exception using errcode = '22023', message = 'invalid due window';
  end if;

  select coalesce(
    p_day,
    (now() at time zone coalesce(profile.timezone, 'Asia/Kolkata'))::date
  ) into local_day
  from public.profiles profile
  where profile.id = current_user_id;
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
  where commitment.user_id = current_user_id
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

revoke all on function public.get_v3_due(date, text, text, integer, integer) from public, anon;
grant execute on function public.get_v3_due(date, text, text, integer, integer) to authenticated;

create or replace function public.get_v3_today(
  p_day date default null,
  p_limit integer default 5
) returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  current_user_id uuid := auth.uid();
  local_day date;
  week_start date;
  week_end date;
  timezone_name text;
  result jsonb;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'authentication required';
  end if;

  select profile.timezone into timezone_name
  from public.profiles profile
  where profile.id = current_user_id;
  if not found then
    raise exception using errcode = '42501', message = 'profile not found';
  end if;
  local_day := coalesce(p_day, (now() at time zone timezone_name)::date);
  week_start := local_day - (extract(isodow from local_day)::integer - 1);
  week_end := week_start + 6;

  with settings_row as (
    select coalesce(settings.node_floor_minutes, 30) node_target,
      coalesce(settings.dsa_floor_minutes, 60) dsa_target,
      coalesce(settings.math_floor_minutes, 30) math_target,
      coalesce(settings.weekly_application_target, 15) application_target,
      coalesce(settings.weekly_people_contact_target, 2) people_target
    from (select 1) singleton
    left join public.user_settings settings on settings.user_id = current_user_id
  ), log_row as (
    select coalesce(log.node_minutes, 0) node_minutes,
      coalesce(log.dsa_minutes, 0) dsa_minutes,
      coalesce(log.math_minutes, 0) math_minutes
    from (select 1) singleton
    left join public.daily_logs log
      on log.user_id = current_user_id and log.day = local_day
  ), weekly_outcomes as (
    select count(distinct event.entity_id) filter (
        where event.event_type = 'application.submitted'
      )::integer applications_submitted,
      count(distinct event.entity_id) filter (
        where event.event_type = 'person.contacted'
      )::integer people_contacted
    from public.activity_events event
    where event.user_id = current_user_id
      and (event.occurred_at at time zone timezone_name)::date between week_start and week_end
  ), overdue as (
    select count(*)::integer overdue_count
    from public.commitments commitment
    join public.entities entity
      on entity.user_id = commitment.user_id and entity.id = commitment.entity_id
    where commitment.user_id = current_user_id
      and commitment.state = 'open'
      and commitment.due_on < local_day
      and entity.archived_at is null
  ), lead_item as (
    select to_jsonb(item) lead
    from public.get_v3_due(local_day, 'overdue', null, 1, 0) item
  ), queue_items as (
    select coalesce(jsonb_agg(to_jsonb(item) order by item.due_on, item.commitment_id), '[]'::jsonb) queue
    from public.get_v3_due(local_day, 'all', null, p_limit, 0) item
  ), proposals as (
    select count(*)::integer pending_count
    from public.agent_proposals proposal
    where proposal.user_id = current_user_id and proposal.state = 'pending'
  )
  select jsonb_build_object(
    'day', local_day,
    'overdue_count', overdue.overdue_count,
    'lead', lead_item.lead,
    'floors', jsonb_build_object(
      'node', jsonb_build_object(
        'minutes', log_row.node_minutes, 'target', settings_row.node_target,
        'met', log_row.node_minutes >= settings_row.node_target
      ),
      'dsa', jsonb_build_object(
        'minutes', log_row.dsa_minutes, 'target', settings_row.dsa_target,
        'met', log_row.dsa_minutes >= settings_row.dsa_target
      ),
      'math', jsonb_build_object(
        'minutes', log_row.math_minutes, 'target', settings_row.math_target,
        'met', log_row.math_minutes >= settings_row.math_target
      )
    ),
    'weekly', jsonb_build_object(
      'applications_submitted', weekly_outcomes.applications_submitted,
      'application_target', settings_row.application_target,
      'people_contacted', weekly_outcomes.people_contacted,
      'people_target', settings_row.people_target
    ),
    'queue', queue_items.queue,
    'pending_proposals', proposals.pending_count
  ) into result
  from settings_row, log_row, weekly_outcomes, overdue, queue_items, proposals
  left join lead_item on true;

  return result;
end;
$$;

revoke all on function public.get_v3_today(date, integer) from public, anon;
grant execute on function public.get_v3_today(date, integer) to authenticated;

create or replace function public.get_v3_week(p_week_start date default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  current_user_id uuid := auth.uid();
  local_day date;
  week_start date;
  week_end date;
  timezone_name text;
  result jsonb;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'authentication required';
  end if;
  select profile.timezone into timezone_name
  from public.profiles profile
  where profile.id = current_user_id;
  if not found then
    raise exception using errcode = '42501', message = 'profile not found';
  end if;

  local_day := (now() at time zone timezone_name)::date;
  week_start := coalesce(p_week_start, local_day);
  week_start := week_start - (extract(isodow from week_start)::integer - 1);
  week_end := week_start + 6;

  with days as (
    select generated.day::date
    from generate_series(week_start, week_end, interval '1 day') generated(day)
  ), day_rows as (
    select days.day,
      days.day > local_day is_future,
      log.node_minutes, log.dsa_minutes, log.math_minutes,
      log.meditation, log.gym, log.diet
    from days
    left join public.daily_logs log
      on log.user_id = current_user_id and log.day = days.day
    order by days.day
  ), totals as (
    select coalesce(sum(log.node_minutes), 0)::integer node_minutes,
      coalesce(sum(log.dsa_minutes), 0)::integer dsa_minutes,
      coalesce(sum(log.math_minutes), 0)::integer math_minutes
    from public.daily_logs log
    where log.user_id = current_user_id and log.day between week_start and week_end
  ), settings_row as (
    select coalesce(settings.node_weekly_minutes, 420) node_target,
      coalesce(settings.dsa_weekly_minutes, 840) dsa_target,
      coalesce(settings.math_weekly_minutes, 420) math_target,
      coalesce(settings.weekly_application_target, 15) application_target,
      coalesce(settings.weekly_people_contact_target, 2) people_target
    from (select 1) singleton
    left join public.user_settings settings on settings.user_id = current_user_id
  ), event_counts as (
    select count(distinct event.entity_id) filter (
        where event.event_type = 'application.submitted'
      )::integer applications_submitted,
      count(distinct event.entity_id) filter (
        where event.event_type = 'person.contacted'
      )::integer people_contacted,
      count(*) filter (where event.event_type = 'commitment.cancelled')::integer commitments_cancelled
    from public.activity_events event
    where event.user_id = current_user_id
      and (event.occurred_at at time zone timezone_name)::date between week_start and week_end
  ), commitment_counts as (
    select count(*) filter (
        where commitment.state = 'completed'
          and (commitment.completed_at at time zone timezone_name)::date between week_start and week_end
      )::integer commitments_completed,
      count(*) filter (
        where commitment.state = 'open'
          and commitment.due_on between week_start and least(week_end, local_day - 1)
      )::integer commitments_missed
    from public.commitments commitment
    where commitment.user_id = current_user_id
  ), proposal_counts as (
    select count(*) filter (
        where (proposal.created_at at time zone timezone_name)::date between week_start and week_end
      )::integer proposed,
      count(*) filter (
        where proposal.state = 'approved'
          and (proposal.decided_at at time zone timezone_name)::date between week_start and week_end
      )::integer approved,
      count(*) filter (
        where proposal.state = 'rejected'
          and (proposal.decided_at at time zone timezone_name)::date between week_start and week_end
      )::integer rejected
    from public.agent_proposals proposal
    where proposal.user_id = current_user_id
  )
  select jsonb_build_object(
    'week_start', week_start,
    'week_end', week_end,
    'days', (select jsonb_agg(to_jsonb(day_rows) order by day) from day_rows),
    'practice', jsonb_build_object(
      'node', jsonb_build_object('minutes', totals.node_minutes, 'target', settings_row.node_target),
      'dsa', jsonb_build_object('minutes', totals.dsa_minutes, 'target', settings_row.dsa_target),
      'math', jsonb_build_object('minutes', totals.math_minutes, 'target', settings_row.math_target)
    ),
    'applications_submitted', event_counts.applications_submitted,
    'application_target', settings_row.application_target,
    'people_contacted', event_counts.people_contacted,
    'people_target', settings_row.people_target,
    'commitments', jsonb_build_object(
      'completed', commitment_counts.commitments_completed,
      'cancelled', event_counts.commitments_cancelled,
      'missed', commitment_counts.commitments_missed
    ),
    'proposals', to_jsonb(proposal_counts)
  ) into result
  from totals, settings_row, event_counts, commitment_counts, proposal_counts;

  return result;
end;
$$;

revoke all on function public.get_v3_week(date) from public, anon;
grant execute on function public.get_v3_week(date) to authenticated;

create or replace function public.get_v3_readiness_inputs(
  p_from date,
  p_to date,
  p_limit integer default 100
) returns table (
  event_type text,
  entity_type_key text,
  event_count bigint,
  distinct_entity_count bigint
)
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  current_user_id uuid := auth.uid();
  timezone_name text;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'authentication required';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to > p_from + 366 then
    raise exception using errcode = '22023', message = 'invalid readiness range';
  end if;
  select profile.timezone into timezone_name
  from public.profiles profile
  where profile.id = current_user_id;

  return query
  select event.event_type, entity_type.type_key,
    count(*) event_count, count(distinct event.entity_id) distinct_entity_count
  from public.activity_events event
  left join public.entities entity
    on entity.user_id = event.user_id and entity.id = event.entity_id
  left join public.entity_types entity_type
    on entity_type.user_id = entity.user_id and entity_type.id = entity.entity_type_id
  where event.user_id = current_user_id
    and (event.occurred_at at time zone timezone_name)::date between p_from and p_to
  group by event.event_type, entity_type.type_key
  order by event_count desc, event.event_type, entity_type.type_key nulls last
  limit least(greatest(coalesce(p_limit, 100), 1), 100);
end;
$$;

revoke all on function public.get_v3_readiness_inputs(date, date, integer) from public, anon;
grant execute on function public.get_v3_readiness_inputs(date, date, integer) to authenticated;
