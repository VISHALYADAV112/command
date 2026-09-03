-- Read-only production check for the Phase 8 export gate.
-- Run only after explicit production-cutover authorization and redirect the
-- output to the private cutover directory described in docs/phase8-cutover.md.

do $phase8$
declare
  profile_count integer;
  existing_v3_relations integer;
begin
  select count(*) into profile_count from public.profiles;
  if profile_count <> 1 then
    raise exception 'Phase 8 requires exactly one production profile; found %', profile_count;
  end if;

  select count(*) into existing_v3_relations
  from (values
    ('entity_types'),
    ('entities'),
    ('commitments'),
    ('activity_events'),
    ('agent_proposals'),
    ('v3_legacy_entity_map'),
    ('v3_legacy_commitment_map')
  ) as expected(relation_name)
  where to_regclass('public.' || expected.relation_name) is not null;

  if existing_v3_relations <> 0 then
    raise exception 'Production already contains % v3 relations; stop and audit migration history',
      existing_v3_relations;
  end if;
end
$phase8$;

with legacy_counts(source_table, source_rows) as (
  select 'job_applications', count(*) from public.job_applications
  union all select 'people', count(*) from public.people
  union all select 'projects', count(*) from public.projects
  union all select 'learning_items', count(*) from public.learning_items
  union all select 'ideas', count(*) from public.ideas
  union all select 'daily_logs', count(*) from public.daily_logs
), operational_counts(source_table, source_rows) as (
  select 'integration_accounts', count(*) from public.integration_accounts
  union all select 'integration_links', count(*) from public.integration_links
  union all select 'oauth_states', count(*) from public.oauth_states
  union all select 'mcp_audit_log', count(*) from public.mcp_audit_log
)
select jsonb_pretty(jsonb_build_object(
  'profile_count', (select count(*) from public.profiles),
  'legacy_rows', (select jsonb_object_agg(source_table, source_rows order by source_table)
    from legacy_counts),
  'operational_rows', (select jsonb_object_agg(source_table, source_rows order by source_table)
    from operational_counts),
  'v3_relations_present', 0
)) as phase8_pre_migration_report;
