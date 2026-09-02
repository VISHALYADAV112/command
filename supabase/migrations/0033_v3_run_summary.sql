-- Command v3 Phase 7: bounded monthly readiness summary.
-- The five marker formulas are derived from existing canonical rows and
-- immutable activity; no marker-specific storage is introduced.

create or replace function public.get_v3_run(p_day date default null)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
declare
  current_user_id uuid := auth.uid();
  timezone_name text;
  local_day date;
  as_of_day date;
  current_month_start date;
  history_start date;
  history_end date;
  profile_day date;
  history_coverage boolean;
  result jsonb;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'authentication required';
  end if;

  select profile.timezone,
    (profile.created_at at time zone profile.timezone)::date
  into timezone_name, profile_day
  from public.profiles profile
  where profile.id = current_user_id;

  if not found then
    raise exception using errcode = '42501', message = 'profile not found';
  end if;

  local_day := (now() at time zone timezone_name)::date;
  as_of_day := coalesce(p_day, local_day);
  current_month_start := date_trunc('month', as_of_day::timestamp)::date;
  history_start := (current_month_start - interval '3 months')::date;
  history_end := current_month_start - 1;
  history_coverage := profile_day <= history_start;

  with months as (
    select generated.month_start::date month_start,
      (generated.month_start + interval '1 month - 1 day')::date month_end
    from generate_series(
      history_start::timestamp,
      (current_month_start - interval '1 month')::timestamp,
      interval '1 month'
    ) generated(month_start)
  ), owned_entities as (
    select entity.id, entity.archived_at, entity.fields,
      (entity.created_at at time zone timezone_name)::date created_day,
      (entity.updated_at at time zone timezone_name)::date updated_day,
      entity_type.type_key
    from public.entities entity
    join public.entity_types entity_type
      on entity_type.user_id = entity.user_id
      and entity_type.id = entity.entity_type_id
    where entity.user_id = current_user_id
  ), qualified_portfolios as (
    select entity.id, entity.updated_day qualified_day
    from owned_entities entity
    where entity.type_key = 'project'
      and entity.archived_at is null
      and entity.fields ->> 'project_type' = 'portfolio'
      and entity.fields ->> 'status' = 'done'
      and entity.fields ->> 'is_public' = 'true'
      and nullif(btrim(entity.fields ->> 'content_markdown'), '') is not null
      and (
        nullif(btrim(entity.fields ->> 'repo_url'), '') is not null
        or nullif(btrim(entity.fields ->> 'demo_url'), '') is not null
      )
      and entity.updated_day <= as_of_day
  ), dsa_patterns as (
    select entity.id, entity.created_day,
      case
        when entity.fields ->> 'last_reviewed_on' is null then null
        else (entity.fields ->> 'last_reviewed_on')::date
      end mastered_day,
      entity.fields ->> 'confidence' = '5'
        and coalesce((entity.fields ->> 'mastery_hits')::numeric, 0) >= 2
        and entity.fields ->> 'last_reviewed_on' is not null mastered
    from owned_entities entity
    where entity.type_key = 'learning'
      and entity.archived_at is null
      and entity.fields ->> 'track' = 'dsa'
      and entity.fields ->> 'item_type' = 'pattern'
      and entity.created_day <= as_of_day
  ), mock_interviews as (
    select commitment.id,
      (commitment.completed_at at time zone timezone_name)::date completed_day
    from public.commitments commitment
    where commitment.user_id = current_user_id
      and commitment.state = 'completed'
      and commitment.kind = 'drill'
      and btrim(commitment.action) ~* '^mock interview($|[-[:space:]:])'
      and (commitment.completed_at at time zone timezone_name)::date <= as_of_day
  ), referral_firsts as (
    select commitment.entity_id,
      min((commitment.completed_at at time zone timezone_name)::date) completed_day
    from public.commitments commitment
    join owned_entities entity on entity.id = commitment.entity_id
    where commitment.user_id = current_user_id
      and entity.type_key = 'person'
      and commitment.state = 'completed'
      and commitment.kind = 'contact'
      and (commitment.completed_at at time zone timezone_name)::date <= as_of_day
    group by commitment.entity_id
  ), latest_submissions as (
    select distinct on (event.entity_id)
      event.entity_id,
      (event.occurred_at at time zone timezone_name)::date submitted_day,
      entity.fields ->> 'status' status
    from public.activity_events event
    join owned_entities entity
      on entity.id = event.entity_id and entity.type_key = 'application'
    where event.user_id = current_user_id
      and event.event_type = 'application.submitted'
      and (event.occurred_at at time zone timezone_name)::date <= as_of_day
    order by event.entity_id, event.created_at desc, event.id desc
  ), portfolio_history as (
    select month.month_start, count(portfolio.id)::integer value
    from months month
    left join qualified_portfolios portfolio on portfolio.qualified_day <= month.month_end
    group by month.month_start
  ), pattern_history as (
    select month.month_start, count(pattern.id)::integer value
    from months month
    left join dsa_patterns pattern
      on pattern.mastered and pattern.mastered_day <= month.month_end
    group by month.month_start
  ), mock_history as (
    select month.month_start, count(mock.id)::integer value
    from months month
    left join mock_interviews mock on mock.completed_day <= month.month_end
    group by month.month_start
  ), referral_history as (
    select month.month_start, count(referral.entity_id)::integer value
    from months month
    left join referral_firsts referral on referral.completed_day <= month.month_end
    group by month.month_start
  ), conversion_history as (
    select month.month_start,
      count(submission.entity_id)::integer denominator,
      count(submission.entity_id) filter (
        where submission.status in ('phone', 'onsite', 'offer')
      )::integer numerator
    from months month
    left join latest_submissions submission
      on submission.submitted_day between month.month_start and month.month_end
    group by month.month_start
  ), conversion_current as (
    select count(*)::integer denominator,
      count(*) filter (where status in ('phone', 'onsite', 'offer'))::integer numerator
    from latest_submissions
  )
  select jsonb_build_object(
    'as_of_day', as_of_day,
    'history_start', history_start,
    'history_end', history_end,
    'markers', jsonb_build_object(
      'public_portfolio', jsonb_build_object(
        'current', (select count(*)::integer from qualified_portfolios),
        'target', 3,
        'history_ready', history_coverage,
        'history', (select jsonb_agg(jsonb_build_object(
          'month', to_char(month_start, 'YYYY-MM'), 'value', value
        ) order by month_start) from portfolio_history)
      ),
      'dsa_patterns', jsonb_build_object(
        'current', (select count(*)::integer from dsa_patterns where mastered),
        'covered', (select count(*)::integer from dsa_patterns),
        'target', 24,
        'history_ready', history_coverage,
        'history', (select jsonb_agg(jsonb_build_object(
          'month', to_char(month_start, 'YYYY-MM'), 'value', value
        ) order by month_start) from pattern_history)
      ),
      'mock_interviews', jsonb_build_object(
        'current', (select count(*)::integer from mock_interviews),
        'target', 10,
        'history_ready', history_coverage,
        'history', (select jsonb_agg(jsonb_build_object(
          'month', to_char(month_start, 'YYYY-MM'), 'value', value
        ) order by month_start) from mock_history)
      ),
      'application_conversion', jsonb_build_object(
        'current', (select case when denominator = 0 then null else
          round(numerator * 100.0 / denominator, 1) end from conversion_current),
        'numerator', (select numerator from conversion_current),
        'denominator', (select denominator from conversion_current),
        'target', 25,
        'history_ready', history_coverage and not exists (
          select 1 from conversion_history where denominator = 0
        ),
        'history', (select jsonb_agg(jsonb_build_object(
          'month', to_char(month_start, 'YYYY-MM'),
          'value', case when denominator = 0 then null else
            round(numerator * 100.0 / denominator, 1) end
        ) order by month_start) from conversion_history)
      ),
      'referral_conversations', jsonb_build_object(
        'current', (select count(*)::integer from referral_firsts),
        'target', 12,
        'history_ready', history_coverage,
        'history', (select jsonb_agg(jsonb_build_object(
          'month', to_char(month_start, 'YYYY-MM'), 'value', value
        ) order by month_start) from referral_history)
      )
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_v3_run(date) from public, anon;
grant execute on function public.get_v3_run(date) to authenticated;
