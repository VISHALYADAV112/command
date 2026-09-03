-- Atomic production backfill and verification gate for Command v3 Phase 8.
-- The first failed assertion rolls the transaction back. The second backfill
-- pass proves idempotency before the transaction is committed.

begin isolation level serializable;

lock table
  public.profiles,
  public.job_applications,
  public.people,
  public.projects,
  public.learning_items,
  public.ideas,
  public.daily_logs,
  public.integration_links
in share mode;

do $phase8$
declare
  owner_id uuid;
  owner_count integer;
  issue_count integer;
  legacy_before jsonb;
  csv_source_table text;
  first_entity_maps bigint;
  first_commitment_maps bigint;
  first_entities bigint;
  first_commitments bigint;
  first_migration_events bigint;
  second_entity_maps bigint;
  second_commitment_maps bigint;
  second_entities bigint;
  second_commitments bigint;
  second_migration_events bigint;
  expected_migration_events bigint;
  pending_calendar_links bigint;
begin
  select count(*) into owner_count from public.profiles;
  if owner_count <> 1 then
    raise exception 'Phase 8 requires exactly one production profile; found %', owner_count;
  end if;
  select id into owner_id from public.profiles limit 1;

  select count(*) into issue_count
  from public.v3_migration_preflight(owner_id);
  if issue_count <> 0 then
    raise exception 'Phase 8 preflight found % issue(s); inspect v3_migration_preflight before retrying',
      issue_count;
  end if;

  select public.v3_migration_legacy_json(owner_id) into legacy_before;
  perform public.v3_migration_backfill(owner_id);

  select count(*) into first_entity_maps
  from public.v3_legacy_entity_map where user_id = owner_id;
  select count(*) into first_commitment_maps
  from public.v3_legacy_commitment_map where user_id = owner_id;
  select count(*) into first_entities
  from public.entities where user_id = owner_id;
  select count(*) into first_commitments
  from public.commitments where user_id = owner_id;
  select count(*) into first_migration_events
  from public.activity_events where user_id = owner_id and source = 'migration';

  perform public.v3_migration_backfill(owner_id);

  select count(*) into second_entity_maps
  from public.v3_legacy_entity_map where user_id = owner_id;
  select count(*) into second_commitment_maps
  from public.v3_legacy_commitment_map where user_id = owner_id;
  select count(*) into second_entities
  from public.entities where user_id = owner_id;
  select count(*) into second_commitments
  from public.commitments where user_id = owner_id;
  select count(*) into second_migration_events
  from public.activity_events where user_id = owner_id and source = 'migration';

  if (first_entity_maps, first_commitment_maps, first_entities, first_commitments,
      first_migration_events) is distinct from
     (second_entity_maps, second_commitment_maps, second_entities, second_commitments,
      second_migration_events) then
    raise exception 'The second v3 backfill pass changed canonical or mapping counts';
  end if;

  if legacy_before is distinct from public.v3_migration_legacy_json(owner_id) then
    raise exception 'The v3 backfill changed one or more legacy source rows';
  end if;

  if public.v3_migration_legacy_json(owner_id) is distinct from
     public.v3_migration_compatibility_json(owner_id) then
    raise exception 'The v3 compatibility JSON does not exactly match the legacy export';
  end if;

  foreach csv_source_table in array array[
    'job_applications', 'people', 'projects', 'learning_items', 'ideas', 'daily_logs'
  ]
  loop
    if public.v3_migration_csv(owner_id, 'before', csv_source_table) is distinct from
       public.v3_migration_csv(owner_id, 'after', csv_source_table) then
      raise exception 'The v3 compatibility CSV does not match for %', csv_source_table;
    end if;
  end loop;

  if exists (
    select 1
    from public.v3_migration_report(owner_id) report
    where report.source_rows <> report.mapped_entities
       or report.source_rows <> report.compatibility_rows
       or report.migration_events <> case
         when report.source_table = 'daily_logs' then 0
         else report.mapped_entities + report.mapped_commitments
       end
  ) then
    raise exception 'The v3 row, compatibility, or core migration-event report does not balance';
  end if;

  if exists (
    with expected(source_table, commitment_rows) as (
      select 'job_applications', count(*) filter (where follow_up_on is not null)
        + count(*) filter (where window_closes_on is not null)
      from public.job_applications where user_id = owner_id
      union all select 'people', count(*) filter (where next_follow_up_on is not null)
        from public.people where user_id = owner_id
      union all select 'projects', count(*) filter (where deadline_on is not null)
        from public.projects where user_id = owner_id
      union all select 'learning_items', count(*) filter (where next_review_on is not null)
        from public.learning_items where user_id = owner_id
      union all select 'ideas', 0::bigint
      union all select 'daily_logs', 0::bigint
    )
    select 1
    from expected
    join public.v3_migration_report(owner_id) report using (source_table)
    where expected.commitment_rows <> report.mapped_commitments
  ) then
    raise exception 'One or more dated legacy rows do not have the expected commitment mapping';
  end if;

  if first_entities <> first_entity_maps or first_commitments <> first_commitment_maps then
    raise exception 'Unexpected pre-cutover canonical rows exist outside the legacy maps';
  end if;

  if exists (
    select 1 from public.entities entity
    join public.entity_types type on type.id = entity.entity_type_id
    where entity.user_id <> type.user_id
  ) or exists (
    select 1 from public.commitments commitment
    join public.entities entity on entity.id = commitment.entity_id
    where commitment.user_id <> entity.user_id
  ) or exists (
    select 1 from public.activity_events event
    left join public.entities entity on entity.id = event.entity_id
    left join public.commitments commitment on commitment.id = event.commitment_id
    where (event.entity_id is not null and event.user_id is distinct from entity.user_id)
       or (event.commitment_id is not null and event.user_id is distinct from commitment.user_id)
  ) then
    raise exception 'A canonical relationship crosses owner boundaries';
  end if;

  -- Derive the exact total independently from maps plus eligible historical
  -- outcome rows.
  select first_entity_maps + first_commitment_maps
    + (select count(*) from public.job_applications
       where user_id = owner_id and applied_on is not null)
    + (select count(*) from public.people
       where user_id = owner_id and last_contacted_on is not null)
  into expected_migration_events;

  if first_migration_events <> expected_migration_events then
    raise exception 'Migration provenance count is %, expected %',
      first_migration_events, expected_migration_events;
  end if;

  select pending into pending_calendar_links
  from public.v3_migration_calendar_report(owner_id);
  if pending_calendar_links <> 0 then
    raise exception '% legacy Calendar link(s) remain pending; resolve them before frontend deployment',
      pending_calendar_links;
  end if;
end
$phase8$;

commit;

with owner as (
  select id from public.profiles
), migration_report as (
  select report.*
  from owner
  cross join lateral public.v3_migration_report(owner.id) report
), calendar_report as (
  select report.*
  from owner
  cross join lateral public.v3_migration_calendar_report(owner.id) report
)
select jsonb_pretty(jsonb_build_object(
  'owner_count', (select count(*) from owner),
  'exact_json_match', (select public.v3_migration_legacy_json(owner.id)
    = public.v3_migration_compatibility_json(owner.id) from owner),
  'migration_report', (select jsonb_agg(to_jsonb(migration_report)
    order by source_table) from migration_report),
  'calendar_report', (select to_jsonb(calendar_report) from calendar_report),
  'entity_type_count', (select count(*) from public.entity_types),
  'entity_count', (select count(*) from public.entities),
  'commitment_count', (select count(*) from public.commitments),
  'migration_event_count', (select count(*) from public.activity_events
    where source = 'migration')
)) as phase8_post_backfill_report;
