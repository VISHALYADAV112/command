-- Command v3 Phase 3, slice 1: finalize the five built-in type schemas.
-- This migration is append-only.  The v1 seeds created in 0013 intentionally
-- had empty schemas so that the registry could be secured before backfill.

create or replace function public.v3_default_entity_type_definitions()
returns table (
  type_key text,
  singular_name text,
  plural_name text,
  icon_key text,
  field_schema jsonb,
  default_sort_field text,
  default_sort_direction text,
  group_by_field text,
  allowed_commitment_kinds text[],
  plugin_key text
)
language sql
immutable
set search_path = pg_catalog, public
as $$
  select *
  from (values
    (
      'application', 'Application', 'Applications', 'application',
      '[
        {"key":"company","label":"Company","kind":"text","required":true,"list_visible":true,"filterable":true},
        {"key":"role","label":"Role","kind":"text","required":true,"list_visible":true,"filterable":true},
        {"key":"lane","label":"Lane","kind":"single_select","required":true,"list_visible":false,"filterable":true,"options":["sde","ai_ml"]},
        {"key":"channel","label":"Channel","kind":"single_select","required":true,"list_visible":false,"filterable":true,"options":["india_product","gcc","remote_intl","services"]},
        {"key":"status","label":"Status","kind":"single_select","required":true,"list_visible":true,"filterable":true,"options":["researching","applied","oa","phone","onsite","offer","rejected"]},
        {"key":"applied_on","label":"Applied on","kind":"date","required":false,"list_visible":false,"filterable":true},
        {"key":"has_referral","label":"Has referral","kind":"boolean","required":true,"list_visible":false,"filterable":true},
        {"key":"ctc_lpa","label":"CTC (LPA)","kind":"number","required":false,"list_visible":false,"filterable":false},
        {"key":"referrer_id","label":"Referrer id","kind":"text","required":false,"list_visible":false,"filterable":false},
        {"key":"job_url","label":"Job URL","kind":"url","required":false,"list_visible":false,"filterable":false},
        {"key":"resume_version","label":"Resume version","kind":"text","required":false,"list_visible":false,"filterable":false},
        {"key":"resume_drive_url","label":"Resume Drive URL","kind":"url","required":false,"list_visible":false,"filterable":false},
        {"key":"next_action","label":"Next action","kind":"textarea","required":false,"list_visible":true,"filterable":false},
        {"key":"notes","label":"Notes","kind":"textarea","required":false,"list_visible":false,"filterable":false}
      ]'::jsonb,
      'updated_at', 'desc', 'status', array['follow-up','deadline','milestone']::text[], null::text
    ),
    (
      'person', 'Person', 'People', 'person',
      '[
        {"key":"company","label":"Company","kind":"text","required":false,"list_visible":true,"filterable":true},
        {"key":"email","label":"Email","kind":"text","required":false,"list_visible":false,"filterable":false},
        {"key":"linkedin_url","label":"LinkedIn URL","kind":"url","required":false,"list_visible":false,"filterable":false},
        {"key":"how_known","label":"How known","kind":"single_select","required":false,"list_visible":false,"filterable":true,"options":["cold","alumni","linkedin","ex_colleague","referred_by"]},
        {"key":"status","label":"Status","kind":"single_select","required":true,"list_visible":true,"filterable":true,"options":["to_reach_out","talking","referred","cold"]},
        {"key":"last_contacted_on","label":"Last contacted on","kind":"date","required":false,"list_visible":false,"filterable":true},
        {"key":"notes","label":"Notes","kind":"textarea","required":false,"list_visible":false,"filterable":false}
      ]'::jsonb,
      'title', 'asc', 'status', array['contact','follow-up']::text[], null::text
    ),
    (
      'project', 'Project', 'Projects', 'project',
      '[
        {"key":"project_type","label":"Type","kind":"single_select","required":true,"list_visible":true,"filterable":true,"options":["internship","freelance","portfolio"]},
        {"key":"status","label":"Status","kind":"single_select","required":true,"list_visible":true,"filterable":true,"options":["active","blocked","review","done"]},
        {"key":"client","label":"Client","kind":"text","required":false,"list_visible":true,"filterable":true},
        {"key":"payment_status","label":"Payment status","kind":"single_select","required":true,"list_visible":false,"filterable":true,"options":["na","unpaid","invoiced","paid"]},
        {"key":"amount","label":"Amount","kind":"number","required":false,"list_visible":false,"filterable":false},
        {"key":"currency","label":"Currency","kind":"text","required":true,"list_visible":false,"filterable":false},
        {"key":"is_public","label":"Public","kind":"boolean","required":true,"list_visible":true,"filterable":true},
        {"key":"repo_url","label":"Repository URL","kind":"url","required":false,"list_visible":false,"filterable":false},
        {"key":"demo_url","label":"Demo URL","kind":"url","required":false,"list_visible":false,"filterable":false},
        {"key":"drive_folder_url","label":"Drive folder URL","kind":"url","required":false,"list_visible":false,"filterable":false},
        {"key":"next_action","label":"Next action","kind":"textarea","required":false,"list_visible":true,"filterable":false},
        {"key":"content_markdown","label":"Content","kind":"textarea","required":false,"list_visible":false,"filterable":false}
      ]'::jsonb,
      'updated_at', 'desc', 'status', array['deadline','review','milestone']::text[], null::text
    ),
    (
      'learning', 'Learning item', 'Learning', 'learning',
      '[
        {"key":"stack","label":"Stack","kind":"single_select","required":true,"list_visible":false,"filterable":true,"options":["job","brain"]},
        {"key":"track","label":"Track","kind":"single_select","required":true,"list_visible":true,"filterable":true,"options":["node","dsa","math"]},
        {"key":"item_type","label":"Item type","kind":"single_select","required":true,"list_visible":false,"filterable":true,"options":["concept","pattern","snippet","formula"]},
        {"key":"confidence","label":"Confidence","kind":"number","required":true,"list_visible":true,"filterable":true},
        {"key":"difficulty","label":"Difficulty","kind":"single_select","required":false,"list_visible":false,"filterable":true,"options":["easy","medium","hard"]},
        {"key":"last_reviewed_on","label":"Last reviewed on","kind":"date","required":false,"list_visible":false,"filterable":true},
        {"key":"mastery_hits","label":"Mastery hits","kind":"number","required":true,"list_visible":false,"filterable":false},
        {"key":"source_url","label":"Source URL","kind":"url","required":false,"list_visible":false,"filterable":false},
        {"key":"content_markdown","label":"Content","kind":"textarea","required":false,"list_visible":false,"filterable":false}
      ]'::jsonb,
      'updated_at', 'desc', 'track', array['review','drill']::text[], 'spaced_repetition'::text
    ),
    (
      'note', 'Note', 'Notes', 'note',
      '[
        {"key":"tag","label":"Tag","kind":"single_select","required":true,"list_visible":true,"filterable":true,"options":["idea"]},
        {"key":"problem","label":"Problem","kind":"textarea","required":false,"list_visible":false,"filterable":false},
        {"key":"target_market","label":"Target market","kind":"textarea","required":false,"list_visible":false,"filterable":false},
        {"key":"monetization","label":"Monetization","kind":"textarea","required":false,"list_visible":false,"filterable":false},
        {"key":"status","label":"Status","kind":"single_select","required":true,"list_visible":true,"filterable":true,"options":["captured","exploring","validating","dropped"]},
        {"key":"next_action","label":"Next action","kind":"textarea","required":false,"list_visible":true,"filterable":false}
      ]'::jsonb,
      'updated_at', 'desc', 'status', '{}'::text[], null::text
    )
  ) as seed(
    type_key, singular_name, plural_name, icon_key, field_schema,
    default_sort_field, default_sort_direction, group_by_field,
    allowed_commitment_kinds, plugin_key
  );
$$;

create or replace function public.seed_default_entity_types(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.entity_types (
    user_id, type_key, singular_name, plural_name, icon_key, schema_version,
    field_schema, default_sort_field, default_sort_direction, group_by_field,
    allowed_commitment_kinds, plugin_key
  )
  select p_user_id, seed.type_key, seed.singular_name, seed.plural_name,
    seed.icon_key, 2, seed.field_schema, seed.default_sort_field,
    seed.default_sort_direction, seed.group_by_field,
    seed.allowed_commitment_kinds, seed.plugin_key
  from public.v3_default_entity_type_definitions() seed
  on conflict (user_id, type_key) do nothing;
end;
$$;

revoke all on function public.v3_default_entity_type_definitions() from public, anon, authenticated;
revoke all on function public.seed_default_entity_types(uuid) from public, anon, authenticated;
grant execute on function public.seed_default_entity_types(uuid) to service_role;

-- Upgrade only the untouched v1 seeds.  A manually changed registry entry is
-- left alone and is reported by the Phase 3 preflight rather than overwritten.
with defaults as (
  select * from public.v3_default_entity_type_definitions()
)
update public.entity_types existing
set schema_version = 2,
  field_schema = defaults.field_schema,
  default_sort_field = defaults.default_sort_field,
  default_sort_direction = defaults.default_sort_direction,
  group_by_field = defaults.group_by_field,
  allowed_commitment_kinds = defaults.allowed_commitment_kinds,
  plugin_key = defaults.plugin_key
from defaults
where existing.type_key = defaults.type_key
  and existing.schema_version = 1
  and existing.field_schema = '[]'::jsonb;

-- New profiles use the v2 seed function above through the existing trigger.
do $$
begin
  perform public.seed_default_entity_types(profile.id)
  from public.profiles profile
  where not exists (
    select 1 from public.entity_types entity_type
    where entity_type.user_id = profile.id
      and entity_type.type_key = 'application'
      and entity_type.schema_version = 2
  );
end;
$$;
