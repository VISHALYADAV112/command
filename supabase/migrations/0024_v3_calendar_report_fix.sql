-- Report both already-relinked and still-legacy Calendar rows accurately.

create or replace function public.v3_migration_calendar_report(p_user_id uuid)
returns table (relinkable bigint, relinked bigint, pending bigint)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with legacy_candidates as (
    select link.id, map.commitment_id,
      exists (
        select 1 from public.integration_links existing
        where existing.user_id = link.user_id and existing.provider = link.provider
          and existing.external_type = link.external_type and existing.entity_type = 'commitment'
          and existing.entity_id = map.commitment_id and existing.id <> link.id
      ) conflict
    from public.integration_links link
    join public.v3_legacy_commitment_map map on map.user_id = link.user_id
      and map.source_id = link.entity_id
      and ((link.entity_type = 'application_deadline' and map.source_table = 'job_applications' and map.source_field = 'window_closes_on')
        or (link.entity_type = 'project_deadline' and map.source_table = 'projects' and map.source_field = 'deadline_on'))
    where link.user_id = p_user_id and link.provider = 'google' and link.external_type = 'calendar_event'
  ), relinked_links as (
    select link.id
    from public.integration_links link
    join public.v3_legacy_commitment_map map on map.user_id = link.user_id
      and map.commitment_id = link.entity_id
      and ((map.source_table = 'job_applications' and map.source_field = 'window_closes_on')
        or (map.source_table = 'projects' and map.source_field = 'deadline_on'))
    where link.user_id = p_user_id and link.provider = 'google'
      and link.external_type = 'calendar_event' and link.entity_type = 'commitment'
  )
  select
    (select count(*) from legacy_candidates where not conflict),
    (select count(*) from relinked_links),
    (select count(*) from legacy_candidates where conflict);
$$;

revoke all on function public.v3_migration_calendar_report(uuid) from public, anon, authenticated;
grant execute on function public.v3_migration_calendar_report(uuid) to service_role;
