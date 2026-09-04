-- Keep Week's actionable missed count aligned with Due and Calendar.
-- Completed and cancelled history remains visible after an entity is archived.

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
          and entity.archived_at is null
          and commitment.due_on between week_start and least(week_end, local_day - 1)
      )::integer commitments_missed
    from public.commitments commitment
    join public.entities entity
      on entity.user_id = commitment.user_id and entity.id = commitment.entity_id
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
