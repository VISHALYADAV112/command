-- Command v3 Phase 3: source maps, compatibility proof, and idempotent backfill.
-- The functions in this migration are operational helpers.  They are exposed
-- only to service_role; applying this migration does not touch production data
-- until the normal migration/cutover procedure runs.

create table public.v3_legacy_entity_map (
  user_id uuid not null references public.profiles (id) on delete cascade,
  source_table text not null check (source_table in (
    'job_applications', 'people', 'projects', 'learning_items', 'ideas'
  )),
  source_id uuid not null,
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, source_table, source_id),
  unique (user_id, entity_id),
  constraint v3_legacy_entity_map_entity_fk foreign key (user_id, entity_id)
    references public.entities (user_id, id) on delete restrict
);

create table public.v3_legacy_commitment_map (
  user_id uuid not null references public.profiles (id) on delete cascade,
  source_table text not null check (source_table in (
    'job_applications', 'people', 'projects', 'learning_items'
  )),
  source_id uuid not null,
  source_field text not null check (source_field in (
    'follow_up_on', 'window_closes_on', 'next_follow_up_on',
    'deadline_on', 'next_review_on'
  )),
  commitment_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, source_table, source_id, source_field),
  unique (user_id, commitment_id),
  constraint v3_legacy_commitment_map_commitment_fk foreign key (user_id, commitment_id)
    references public.commitments (user_id, id) on delete restrict
);

create index v3_legacy_entity_map_destination_idx
  on public.v3_legacy_entity_map (user_id, entity_id);
create index v3_legacy_commitment_map_destination_idx
  on public.v3_legacy_commitment_map (user_id, commitment_id);

alter table public.v3_legacy_entity_map enable row level security;
alter table public.v3_legacy_commitment_map enable row level security;
revoke all on public.v3_legacy_entity_map from anon, authenticated;
revoke all on public.v3_legacy_commitment_map from anon, authenticated;
grant all on public.v3_legacy_entity_map to service_role;
grant all on public.v3_legacy_commitment_map to service_role;

create or replace function public.v3_migration_csv_escape(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog, public
as $$
  select case
    when p_value is null then ''
    when p_value ~ '[",\r\n]' then '"' || replace(p_value, '"', '""') || '"'
    else p_value
  end;
$$;

create or replace function public.v3_migration_legacy_json(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'job_applications', coalesce((select jsonb_agg(to_jsonb(row) order by row.id)
      from public.job_applications row where row.user_id = p_user_id), '[]'::jsonb),
    'people', coalesce((select jsonb_agg(to_jsonb(row) order by row.id)
      from public.people row where row.user_id = p_user_id), '[]'::jsonb),
    'projects', coalesce((select jsonb_agg(to_jsonb(row) order by row.id)
      from public.projects row where row.user_id = p_user_id), '[]'::jsonb),
    'learning_items', coalesce((select jsonb_agg(to_jsonb(row) order by row.id)
      from public.learning_items row where row.user_id = p_user_id), '[]'::jsonb),
    'ideas', coalesce((select jsonb_agg(to_jsonb(row) order by row.id)
      from public.ideas row where row.user_id = p_user_id), '[]'::jsonb),
    'daily_logs', coalesce((select jsonb_agg(to_jsonb(row) order by row.day, row.id)
      from public.daily_logs row where row.user_id = p_user_id), '[]'::jsonb)
  );
$$;

create or replace function public.v3_migration_compatibility_json(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with application_rows as (
    select jsonb_build_object(
      'id', source.id, 'user_id', source.user_id,
      'company', entity.fields -> 'company', 'role', entity.fields -> 'role',
      'lane', entity.fields -> 'lane', 'channel', entity.fields -> 'channel',
      'status', entity.fields -> 'status',
      'referrer_id', entity.fields -> 'referrer_id',
      'ctc_lpa', entity.fields -> 'ctc_lpa',
      'next_action', entity.fields -> 'next_action',
      'follow_up_on', (select to_jsonb(commitment.due_on)
        from public.v3_legacy_commitment_map map
        join public.commitments commitment on commitment.user_id = map.user_id
          and commitment.id = map.commitment_id
        where map.user_id = source.user_id and map.source_table = 'job_applications'
          and map.source_id = source.id and map.source_field = 'follow_up_on'),
      'window_closes_on', (select to_jsonb(commitment.due_on)
        from public.v3_legacy_commitment_map map
        join public.commitments commitment on commitment.user_id = map.user_id
          and commitment.id = map.commitment_id
        where map.user_id = source.user_id and map.source_table = 'job_applications'
          and map.source_id = source.id and map.source_field = 'window_closes_on'),
      'job_url', entity.fields -> 'job_url',
      'resume_version', entity.fields -> 'resume_version',
      'resume_drive_url', entity.fields -> 'resume_drive_url',
      'notes', entity.fields -> 'notes',
      'applied_on', entity.fields -> 'applied_on',
      'has_referral', entity.fields -> 'has_referral',
      'created_at', to_jsonb(entity.created_at), 'updated_at', to_jsonb(entity.updated_at)
    ) row
    from public.job_applications source
    join public.v3_legacy_entity_map map
      on map.user_id = source.user_id and map.source_table = 'job_applications'
      and map.source_id = source.id
    join public.entities entity on entity.user_id = map.user_id and entity.id = map.entity_id
    where source.user_id = p_user_id
  ), person_rows as (
    select jsonb_build_object(
      'id', source.id, 'user_id', source.user_id, 'name', entity.title,
      'company', entity.fields -> 'company', 'email', entity.fields -> 'email',
      'linkedin_url', entity.fields -> 'linkedin_url', 'how_known', entity.fields -> 'how_known',
      'status', entity.fields -> 'status', 'last_contacted_on', entity.fields -> 'last_contacted_on',
      'next_follow_up_on', (select to_jsonb(commitment.due_on)
        from public.v3_legacy_commitment_map map
        join public.commitments commitment on commitment.user_id = map.user_id
          and commitment.id = map.commitment_id
        where map.user_id = source.user_id and map.source_table = 'people'
          and map.source_id = source.id and map.source_field = 'next_follow_up_on'),
      'notes', entity.fields -> 'notes',
      'created_at', to_jsonb(entity.created_at), 'updated_at', to_jsonb(entity.updated_at)
    ) row
    from public.people source
    join public.v3_legacy_entity_map map
      on map.user_id = source.user_id and map.source_table = 'people' and map.source_id = source.id
    join public.entities entity on entity.user_id = map.user_id and entity.id = map.entity_id
    where source.user_id = p_user_id
  ), project_rows as (
    select jsonb_build_object(
      'id', source.id, 'user_id', source.user_id, 'name', entity.title,
      'project_type', entity.fields -> 'project_type', 'status', entity.fields -> 'status',
      'client', entity.fields -> 'client', 'payment_status', entity.fields -> 'payment_status',
      'amount', entity.fields -> 'amount', 'currency', entity.fields -> 'currency',
      'is_public', entity.fields -> 'is_public',
      'deadline_on', (select to_jsonb(commitment.due_on)
        from public.v3_legacy_commitment_map map
        join public.commitments commitment on commitment.user_id = map.user_id
          and commitment.id = map.commitment_id
        where map.user_id = source.user_id and map.source_table = 'projects'
          and map.source_id = source.id and map.source_field = 'deadline_on'),
      'repo_url', entity.fields -> 'repo_url', 'demo_url', entity.fields -> 'demo_url',
      'drive_folder_url', entity.fields -> 'drive_folder_url',
      'next_action', entity.fields -> 'next_action',
      'content_markdown', entity.fields -> 'content_markdown',
      'created_at', to_jsonb(entity.created_at), 'updated_at', to_jsonb(entity.updated_at)
    ) row
    from public.projects source
    join public.v3_legacy_entity_map map
      on map.user_id = source.user_id and map.source_table = 'projects' and map.source_id = source.id
    join public.entities entity on entity.user_id = map.user_id and entity.id = map.entity_id
    where source.user_id = p_user_id
  ), learning_rows as (
    select jsonb_build_object(
      'id', source.id, 'user_id', source.user_id, 'concept', entity.title,
      'stack', entity.fields -> 'stack', 'track', entity.fields -> 'track',
      'item_type', entity.fields -> 'item_type', 'confidence', entity.fields -> 'confidence',
      'difficulty', entity.fields -> 'difficulty',
      'next_review_on', (select to_jsonb(commitment.due_on)
        from public.v3_legacy_commitment_map map
        join public.commitments commitment on commitment.user_id = map.user_id
          and commitment.id = map.commitment_id
        where map.user_id = source.user_id and map.source_table = 'learning_items'
          and map.source_id = source.id and map.source_field = 'next_review_on'),
      'last_reviewed_on', entity.fields -> 'last_reviewed_on',
      'mastery_hits', entity.fields -> 'mastery_hits', 'source_url', entity.fields -> 'source_url',
      'content_markdown', entity.fields -> 'content_markdown',
      'created_at', to_jsonb(entity.created_at), 'updated_at', to_jsonb(entity.updated_at)
    ) row
    from public.learning_items source
    join public.v3_legacy_entity_map map
      on map.user_id = source.user_id and map.source_table = 'learning_items' and map.source_id = source.id
    join public.entities entity on entity.user_id = map.user_id and entity.id = map.entity_id
    where source.user_id = p_user_id
  ), idea_rows as (
    select jsonb_build_object(
      'id', source.id, 'user_id', source.user_id, 'idea', entity.title,
      'problem', entity.fields -> 'problem', 'target_market', entity.fields -> 'target_market',
      'monetization', entity.fields -> 'monetization', 'status', entity.fields -> 'status',
      'next_action', entity.fields -> 'next_action',
      'created_at', to_jsonb(entity.created_at), 'updated_at', to_jsonb(entity.updated_at)
    ) row
    from public.ideas source
    join public.v3_legacy_entity_map map
      on map.user_id = source.user_id and map.source_table = 'ideas' and map.source_id = source.id
    join public.entities entity on entity.user_id = map.user_id and entity.id = map.entity_id
    where source.user_id = p_user_id
  )
  select jsonb_build_object(
    'job_applications', coalesce((select jsonb_agg(row order by row ->> 'id') from application_rows), '[]'::jsonb),
    'people', coalesce((select jsonb_agg(row order by row ->> 'id') from person_rows), '[]'::jsonb),
    'projects', coalesce((select jsonb_agg(row order by row ->> 'id') from project_rows), '[]'::jsonb),
    'learning_items', coalesce((select jsonb_agg(row order by row ->> 'id') from learning_rows), '[]'::jsonb),
    'ideas', coalesce((select jsonb_agg(row order by row ->> 'id') from idea_rows), '[]'::jsonb),
    'daily_logs', coalesce((select jsonb_agg(to_jsonb(row) order by row.day, row.id)
      from public.daily_logs row where row.user_id = p_user_id), '[]'::jsonb)
  );
$$;

create or replace function public.v3_migration_csv(
  p_user_id uuid,
  p_side text,
  p_source_table text
) returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  rows jsonb;
  row_value jsonb;
  header text;
  output text := '';
  columns text[];
  column_name text;
  row_number integer := 0;
begin
  if p_side not in ('before', 'after') or p_source_table not in (
    'job_applications', 'people', 'projects', 'learning_items', 'ideas', 'daily_logs'
  ) then
    raise exception using errcode = '22023', message = 'invalid migration export request';
  end if;

  columns := case p_source_table
    when 'job_applications' then array['id','user_id','company','role','lane','channel','status','referrer_id','ctc_lpa','next_action','follow_up_on','window_closes_on','job_url','resume_version','resume_drive_url','notes','applied_on','has_referral','created_at','updated_at']
    when 'people' then array['id','user_id','name','company','email','linkedin_url','how_known','status','last_contacted_on','next_follow_up_on','notes','created_at','updated_at']
    when 'projects' then array['id','user_id','name','project_type','status','client','payment_status','amount','currency','is_public','deadline_on','repo_url','demo_url','drive_folder_url','next_action','content_markdown','created_at','updated_at']
    when 'learning_items' then array['id','user_id','concept','stack','track','item_type','confidence','difficulty','next_review_on','last_reviewed_on','mastery_hits','source_url','content_markdown','created_at','updated_at']
    when 'ideas' then array['id','user_id','idea','problem','target_market','monetization','status','next_action','created_at','updated_at']
    else array['id','user_id','day','meditation','gym','diet','node_minutes','dsa_minutes','math_minutes','job_hunt_minutes','note','created_at','updated_at']
  end;
  header := array_to_string(columns, ',');
  output := header;

  rows := case when p_side = 'before'
    then public.v3_migration_legacy_json(p_user_id)
    else public.v3_migration_compatibility_json(p_user_id)
  end -> p_source_table;

  for row_value in select value from jsonb_array_elements(rows)
  loop
    output := output || chr(10);
    row_number := 0;
    foreach column_name in array columns
    loop
      row_number := row_number + 1;
      if row_number > 1 then output := output || ','; end if;
      output := output || public.v3_migration_csv_escape(row_value ->> column_name);
    end loop;
  end loop;
  return output;
end;
$$;

create or replace function public.v3_migration_preflight(p_user_id uuid)
returns table (source_table text, source_id uuid, issue text)
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
begin
  return query
  select 'entity_type'::text, null::uuid,
    format('missing or incomplete v2 type schema: %s', wanted.type_key)
  from public.v3_default_entity_type_definitions() wanted
  where not exists (
    select 1 from public.entity_types actual
    where actual.user_id = p_user_id and actual.type_key = wanted.type_key
      and actual.schema_version = 2
      and actual.field_schema = wanted.field_schema
  );

  return query
  select 'job_applications', source.id,
    case
      when nullif(btrim(source.company), '') is null or nullif(btrim(source.role), '') is null
        then 'company and role are required for the entity title'
      when char_length(source.company || ' — ' || source.role) > 200
        then 'company and role produce a title longer than 200 characters'
      when not public.valid_entity_fields(jsonb_build_object(
        'company', source.company, 'role', source.role, 'lane', source.lane,
        'channel', source.channel, 'status', source.status, 'applied_on', source.applied_on,
        'has_referral', source.has_referral, 'ctc_lpa', source.ctc_lpa,
        'referrer_id', source.referrer_id::text, 'job_url', source.job_url,
        'resume_version', source.resume_version, 'resume_drive_url', source.resume_drive_url,
        'next_action', source.next_action, 'notes', source.notes
      ), wanted.field_schema)
        then 'one or more legacy values do not match the v2 schema bounds'
      else null
    end
  from public.job_applications source
  join public.v3_default_entity_type_definitions() wanted on wanted.type_key = 'application'
  where source.user_id = p_user_id
    and (nullif(btrim(source.company), '') is null or nullif(btrim(source.role), '') is null
      or char_length(source.company || ' — ' || source.role) > 200
      or not public.valid_entity_fields(jsonb_build_object(
        'company', source.company, 'role', source.role, 'lane', source.lane,
        'channel', source.channel, 'status', source.status, 'applied_on', source.applied_on,
        'has_referral', source.has_referral, 'ctc_lpa', source.ctc_lpa,
        'referrer_id', source.referrer_id::text, 'job_url', source.job_url,
        'resume_version', source.resume_version, 'resume_drive_url', source.resume_drive_url,
        'next_action', source.next_action, 'notes', source.notes
      ), wanted.field_schema));

  return query
  select 'people', source.id,
    case
      when nullif(btrim(source.name), '') is null or char_length(source.name) > 200
        then 'name is required and must be at most 200 characters'
      when not public.valid_entity_fields(jsonb_build_object(
        'company', source.company, 'email', source.email, 'linkedin_url', source.linkedin_url,
        'how_known', source.how_known, 'status', source.status,
        'last_contacted_on', source.last_contacted_on, 'notes', source.notes
      ), wanted.field_schema)
        then 'one or more legacy values do not match the v2 schema bounds'
      else null
    end
  from public.people source
  join public.v3_default_entity_type_definitions() wanted on wanted.type_key = 'person'
  where source.user_id = p_user_id
    and (nullif(btrim(source.name), '') is null or char_length(source.name) > 200
      or not public.valid_entity_fields(jsonb_build_object(
        'company', source.company, 'email', source.email, 'linkedin_url', source.linkedin_url,
        'how_known', source.how_known, 'status', source.status,
        'last_contacted_on', source.last_contacted_on, 'notes', source.notes
      ), wanted.field_schema));

  return query
  select 'projects', source.id,
    case
      when nullif(btrim(source.name), '') is null or char_length(source.name) > 200
        then 'name is required and must be at most 200 characters'
      when not public.valid_entity_fields(jsonb_build_object(
        'project_type', source.project_type, 'status', source.status, 'client', source.client,
        'payment_status', source.payment_status, 'amount', source.amount, 'currency', source.currency,
        'is_public', source.is_public, 'repo_url', source.repo_url, 'demo_url', source.demo_url,
        'drive_folder_url', source.drive_folder_url, 'next_action', source.next_action,
        'content_markdown', source.content_markdown
      ), wanted.field_schema)
        then 'one or more legacy values do not match the v2 schema bounds'
      else null
    end
  from public.projects source
  join public.v3_default_entity_type_definitions() wanted on wanted.type_key = 'project'
  where source.user_id = p_user_id
    and (nullif(btrim(source.name), '') is null or char_length(source.name) > 200
      or not public.valid_entity_fields(jsonb_build_object(
        'project_type', source.project_type, 'status', source.status, 'client', source.client,
        'payment_status', source.payment_status, 'amount', source.amount, 'currency', source.currency,
        'is_public', source.is_public, 'repo_url', source.repo_url, 'demo_url', source.demo_url,
        'drive_folder_url', source.drive_folder_url, 'next_action', source.next_action,
        'content_markdown', source.content_markdown
      ), wanted.field_schema));

  return query
  select 'learning_items', source.id,
    case
      when nullif(btrim(source.concept), '') is null or char_length(source.concept) > 200
        then 'concept is required and must be at most 200 characters'
      when not public.valid_entity_fields(jsonb_build_object(
        'stack', source.stack, 'track', source.track, 'item_type', source.item_type,
        'confidence', source.confidence, 'difficulty', source.difficulty,
        'last_reviewed_on', source.last_reviewed_on, 'mastery_hits', source.mastery_hits,
        'source_url', source.source_url, 'content_markdown', source.content_markdown
      ), wanted.field_schema)
        then 'one or more legacy values do not match the v2 schema bounds'
      else null
    end
  from public.learning_items source
  join public.v3_default_entity_type_definitions() wanted on wanted.type_key = 'learning'
  where source.user_id = p_user_id
    and (nullif(btrim(source.concept), '') is null or char_length(source.concept) > 200
      or not public.valid_entity_fields(jsonb_build_object(
        'stack', source.stack, 'track', source.track, 'item_type', source.item_type,
        'confidence', source.confidence, 'difficulty', source.difficulty,
        'last_reviewed_on', source.last_reviewed_on, 'mastery_hits', source.mastery_hits,
        'source_url', source.source_url, 'content_markdown', source.content_markdown
      ), wanted.field_schema));

  return query
  select 'ideas', source.id,
    case
      when nullif(btrim(source.idea), '') is null or char_length(source.idea) > 200
        then 'idea is required and must be at most 200 characters'
      when not public.valid_entity_fields(jsonb_build_object(
        'tag', 'idea', 'problem', source.problem, 'target_market', source.target_market,
        'monetization', source.monetization, 'status', source.status, 'next_action', source.next_action
      ), wanted.field_schema)
        then 'one or more legacy values do not match the v2 schema bounds'
      else null
    end
  from public.ideas source
  join public.v3_default_entity_type_definitions() wanted on wanted.type_key = 'note'
  where source.user_id = p_user_id
    and (nullif(btrim(source.idea), '') is null or char_length(source.idea) > 200
      or not public.valid_entity_fields(jsonb_build_object(
        'tag', 'idea', 'problem', source.problem, 'target_market', source.target_market,
        'monetization', source.monetization, 'status', source.status, 'next_action', source.next_action
      ), wanted.field_schema));
end;
$$;

create or replace function public.v3_migration_backfill(p_user_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  profile_id uuid;
  issue_count integer;
begin
  for profile_id in
    select profile.id from public.profiles profile
    where p_user_id is null or profile.id = p_user_id
    order by profile.id
  loop
    select count(*)::integer into issue_count
    from public.v3_migration_preflight(profile_id);
    if issue_count > 0 then
      raise exception using errcode = '23514',
        message = format('v3 migration preflight failed for %s (%s issue(s))', profile_id, issue_count),
        detail = 'Inspect public.v3_migration_preflight(user_id) before retrying.';
    end if;

    insert into public.v3_legacy_entity_map (user_id, source_table, source_id, entity_id)
      select source.user_id, 'job_applications', source.id, gen_random_uuid()
      from public.job_applications source where source.user_id = profile_id
      on conflict (user_id, source_table, source_id) do nothing;
    insert into public.v3_legacy_entity_map (user_id, source_table, source_id, entity_id)
      select source.user_id, 'people', source.id, gen_random_uuid()
      from public.people source where source.user_id = profile_id
      on conflict (user_id, source_table, source_id) do nothing;
    insert into public.v3_legacy_entity_map (user_id, source_table, source_id, entity_id)
      select source.user_id, 'projects', source.id, gen_random_uuid()
      from public.projects source where source.user_id = profile_id
      on conflict (user_id, source_table, source_id) do nothing;
    insert into public.v3_legacy_entity_map (user_id, source_table, source_id, entity_id)
      select source.user_id, 'learning_items', source.id, gen_random_uuid()
      from public.learning_items source where source.user_id = profile_id
      on conflict (user_id, source_table, source_id) do nothing;
    insert into public.v3_legacy_entity_map (user_id, source_table, source_id, entity_id)
      select source.user_id, 'ideas', source.id, gen_random_uuid()
      from public.ideas source where source.user_id = profile_id
      on conflict (user_id, source_table, source_id) do nothing;

    insert into public.entities (
      id, user_id, entity_type_id, title, fields, schema_version, created_at, updated_at
    )
    select map.entity_id, source.user_id, type.id,
      left(source.company || ' — ' || source.role, 200),
      jsonb_build_object(
        'company', source.company, 'role', source.role, 'lane', source.lane,
        'channel', source.channel, 'status', source.status, 'applied_on', source.applied_on,
        'has_referral', source.has_referral, 'ctc_lpa', source.ctc_lpa,
        'referrer_id', source.referrer_id::text, 'job_url', source.job_url,
        'resume_version', source.resume_version, 'resume_drive_url', source.resume_drive_url,
        'next_action', source.next_action, 'notes', source.notes
      ), 2, source.created_at, source.updated_at
    from public.job_applications source
    join public.v3_legacy_entity_map map on map.user_id = source.user_id
      and map.source_table = 'job_applications' and map.source_id = source.id
    join public.entity_types type on type.user_id = source.user_id and type.type_key = 'application'
    where source.user_id = profile_id and not exists (
      select 1 from public.entities entity where entity.user_id = map.user_id and entity.id = map.entity_id
    );

    insert into public.entities (
      id, user_id, entity_type_id, title, fields, schema_version, created_at, updated_at
    )
    select map.entity_id, source.user_id, type.id, source.name,
      jsonb_build_object(
        'company', source.company, 'email', source.email, 'linkedin_url', source.linkedin_url,
        'how_known', source.how_known, 'status', source.status,
        'last_contacted_on', source.last_contacted_on, 'notes', source.notes
      ), 2, source.created_at, source.updated_at
    from public.people source
    join public.v3_legacy_entity_map map on map.user_id = source.user_id
      and map.source_table = 'people' and map.source_id = source.id
    join public.entity_types type on type.user_id = source.user_id and type.type_key = 'person'
    where source.user_id = profile_id and not exists (
      select 1 from public.entities entity where entity.user_id = map.user_id and entity.id = map.entity_id
    );

    insert into public.entities (
      id, user_id, entity_type_id, title, fields, schema_version, created_at, updated_at
    )
    select map.entity_id, source.user_id, type.id, source.name,
      jsonb_build_object(
        'project_type', source.project_type, 'status', source.status, 'client', source.client,
        'payment_status', source.payment_status, 'amount', source.amount, 'currency', source.currency,
        'is_public', source.is_public, 'repo_url', source.repo_url, 'demo_url', source.demo_url,
        'drive_folder_url', source.drive_folder_url, 'next_action', source.next_action,
        'content_markdown', source.content_markdown
      ), 2, source.created_at, source.updated_at
    from public.projects source
    join public.v3_legacy_entity_map map on map.user_id = source.user_id
      and map.source_table = 'projects' and map.source_id = source.id
    join public.entity_types type on type.user_id = source.user_id and type.type_key = 'project'
    where source.user_id = profile_id and not exists (
      select 1 from public.entities entity where entity.user_id = map.user_id and entity.id = map.entity_id
    );

    insert into public.entities (
      id, user_id, entity_type_id, title, fields, schema_version, created_at, updated_at
    )
    select map.entity_id, source.user_id, type.id, source.concept,
      jsonb_build_object(
        'stack', source.stack, 'track', source.track, 'item_type', source.item_type,
        'confidence', source.confidence, 'difficulty', source.difficulty,
        'last_reviewed_on', source.last_reviewed_on, 'mastery_hits', source.mastery_hits,
        'source_url', source.source_url, 'content_markdown', source.content_markdown
      ), 2, source.created_at, source.updated_at
    from public.learning_items source
    join public.v3_legacy_entity_map map on map.user_id = source.user_id
      and map.source_table = 'learning_items' and map.source_id = source.id
    join public.entity_types type on type.user_id = source.user_id and type.type_key = 'learning'
    where source.user_id = profile_id and not exists (
      select 1 from public.entities entity where entity.user_id = map.user_id and entity.id = map.entity_id
    );

    insert into public.entities (
      id, user_id, entity_type_id, title, fields, schema_version, created_at, updated_at
    )
    select map.entity_id, source.user_id, type.id, source.idea,
      jsonb_build_object(
        'tag', 'idea', 'problem', source.problem, 'target_market', source.target_market,
        'monetization', source.monetization, 'status', source.status, 'next_action', source.next_action
      ), 2, source.created_at, source.updated_at
    from public.ideas source
    join public.v3_legacy_entity_map map on map.user_id = source.user_id
      and map.source_table = 'ideas' and map.source_id = source.id
    join public.entity_types type on type.user_id = source.user_id and type.type_key = 'note'
    where source.user_id = profile_id and not exists (
      select 1 from public.entities entity where entity.user_id = map.user_id and entity.id = map.entity_id
    );

    insert into public.v3_legacy_commitment_map (user_id, source_table, source_id, source_field, commitment_id)
      select source.user_id, 'job_applications', source.id, fields.source_field, gen_random_uuid()
      from public.job_applications source
      cross join lateral (values ('follow_up_on'::text, source.follow_up_on), ('window_closes_on'::text, source.window_closes_on)) fields(source_field, due_on)
      where source.user_id = profile_id and fields.due_on is not null
      on conflict (user_id, source_table, source_id, source_field) do nothing;
    insert into public.v3_legacy_commitment_map (user_id, source_table, source_id, source_field, commitment_id)
      select source.user_id, 'people', source.id, 'next_follow_up_on', gen_random_uuid()
      from public.people source where source.user_id = profile_id and source.next_follow_up_on is not null
      on conflict (user_id, source_table, source_id, source_field) do nothing;
    insert into public.v3_legacy_commitment_map (user_id, source_table, source_id, source_field, commitment_id)
      select source.user_id, 'projects', source.id, 'deadline_on', gen_random_uuid()
      from public.projects source where source.user_id = profile_id and source.deadline_on is not null
      on conflict (user_id, source_table, source_id, source_field) do nothing;
    insert into public.v3_legacy_commitment_map (user_id, source_table, source_id, source_field, commitment_id)
      select source.user_id, 'learning_items', source.id, 'next_review_on', gen_random_uuid()
      from public.learning_items source where source.user_id = profile_id and source.next_review_on is not null
      on conflict (user_id, source_table, source_id, source_field) do nothing;

    insert into public.commitments (
      id, user_id, entity_id, kind, action, due_on, origin_source, created_at, updated_at
    )
    select map.commitment_id, source.user_id, entity.entity_id, kinds.kind,
      left(coalesce(nullif(btrim(case when map.source_field = 'follow_up_on' then source.next_action else null end), ''), kinds.default_action), 500),
      case map.source_field when 'follow_up_on' then source.follow_up_on else source.window_closes_on end,
      'migration', source.created_at, source.updated_at
    from public.v3_legacy_commitment_map map
    join public.job_applications source on source.user_id = map.user_id and source.id = map.source_id
    join public.v3_legacy_entity_map entity on entity.user_id = source.user_id
      and entity.source_table = 'job_applications' and entity.source_id = source.id
    cross join lateral (values
      ('follow_up_on'::text, 'follow-up'::text, 'Follow up on application'::text),
      ('window_closes_on'::text, 'deadline'::text, 'Application window closes'::text)
    ) kinds(source_field, kind, default_action)
    where map.user_id = profile_id and map.source_table = 'job_applications'
      and map.source_field = kinds.source_field and not exists (
        select 1 from public.commitments commitment where commitment.user_id = map.user_id and commitment.id = map.commitment_id
      );

    insert into public.commitments (
      id, user_id, entity_id, kind, action, due_on, origin_source, created_at, updated_at
    )
    select map.commitment_id, source.user_id, entity.entity_id, 'contact',
      left('Contact ' || source.name, 500), source.next_follow_up_on,
      'migration', source.created_at, source.updated_at
    from public.v3_legacy_commitment_map map
    join public.people source on source.user_id = map.user_id and source.id = map.source_id
    join public.v3_legacy_entity_map entity on entity.user_id = source.user_id
      and entity.source_table = 'people' and entity.source_id = source.id
    where map.user_id = profile_id and map.source_table = 'people'
      and map.source_field = 'next_follow_up_on' and not exists (
        select 1 from public.commitments commitment where commitment.user_id = map.user_id and commitment.id = map.commitment_id
      );

    insert into public.commitments (
      id, user_id, entity_id, kind, action, due_on, origin_source, created_at, updated_at
    )
    select map.commitment_id, source.user_id, entity.entity_id, 'deadline',
      left(coalesce(nullif(btrim(source.next_action), ''), 'Project deadline'), 500), source.deadline_on,
      'migration', source.created_at, source.updated_at
    from public.v3_legacy_commitment_map map
    join public.projects source on source.user_id = map.user_id and source.id = map.source_id
    join public.v3_legacy_entity_map entity on entity.user_id = source.user_id
      and entity.source_table = 'projects' and entity.source_id = source.id
    where map.user_id = profile_id and map.source_table = 'projects'
      and map.source_field = 'deadline_on' and not exists (
        select 1 from public.commitments commitment where commitment.user_id = map.user_id and commitment.id = map.commitment_id
      );

    insert into public.commitments (
      id, user_id, entity_id, kind, action, due_on, origin_source, created_at, updated_at
    )
    select map.commitment_id, source.user_id, entity.entity_id, 'review',
      left('Review ' || source.concept, 500), source.next_review_on,
      'migration', source.created_at, source.updated_at
    from public.v3_legacy_commitment_map map
    join public.learning_items source on source.user_id = map.user_id and source.id = map.source_id
    join public.v3_legacy_entity_map entity on entity.user_id = source.user_id
      and entity.source_table = 'learning_items' and entity.source_id = source.id
    where map.user_id = profile_id and map.source_table = 'learning_items'
      and map.source_field = 'next_review_on' and not exists (
        select 1 from public.commitments commitment where commitment.user_id = map.user_id and commitment.id = map.commitment_id
      );

    insert into public.activity_events (
      user_id, entity_id, event_type, payload, source, idempotency_key, occurred_at
    )
    select map.user_id, map.entity_id, 'entity.migrated',
      jsonb_build_object('source_table', map.source_table, 'source_id', map.source_id, 'migration', 'command-v3'),
      'migration', 'migration:entity:' || map.source_table || ':' || map.source_id, source.created_at
    from public.v3_legacy_entity_map map
    join lateral (select coalesce(
      (select source.created_at from public.job_applications source where map.source_table = 'job_applications' and source.user_id = map.user_id and source.id = map.source_id),
      (select source.created_at from public.people source where map.source_table = 'people' and source.user_id = map.user_id and source.id = map.source_id),
      (select source.created_at from public.projects source where map.source_table = 'projects' and source.user_id = map.user_id and source.id = map.source_id),
      (select source.created_at from public.learning_items source where map.source_table = 'learning_items' and source.user_id = map.user_id and source.id = map.source_id),
      (select source.created_at from public.ideas source where map.source_table = 'ideas' and source.user_id = map.user_id and source.id = map.source_id)
    ) created_at) source on true
    where map.user_id = profile_id and not exists (
      select 1 from public.activity_events event where event.user_id = map.user_id
        and event.source = 'migration' and event.idempotency_key = 'migration:entity:' || map.source_table || ':' || map.source_id
    );

    insert into public.activity_events (
      user_id, entity_id, commitment_id, event_type, payload, source, idempotency_key, occurred_at
    )
    select map.user_id, entity.entity_id, map.commitment_id, 'commitment.migrated',
      jsonb_build_object('source_table', map.source_table, 'source_id', map.source_id,
        'source_field', map.source_field, 'migration', 'command-v3'),
      'migration', 'migration:commitment:' || map.source_table || ':' || map.source_id || ':' || map.source_field,
      commitment.created_at
    from public.v3_legacy_commitment_map map
    join public.v3_legacy_entity_map entity on entity.user_id = map.user_id
      and entity.source_table = map.source_table and entity.source_id = map.source_id
    join public.commitments commitment on commitment.user_id = map.user_id and commitment.id = map.commitment_id
    where map.user_id = profile_id and not exists (
      select 1 from public.activity_events event where event.user_id = map.user_id
        and event.source = 'migration'
        and event.idempotency_key = 'migration:commitment:' || map.source_table || ':' || map.source_id || ':' || map.source_field
    );

    insert into public.activity_events (
      user_id, entity_id, event_type, payload, source, idempotency_key, occurred_at
    )
    select source.user_id, map.entity_id, 'application.submitted',
      jsonb_build_object('source_table', 'job_applications', 'source_id', source.id, 'migration', 'command-v3'),
      'migration', 'migration:application-submitted:' || source.id,
      source.applied_on::timestamp at time zone profile.timezone
    from public.job_applications source
    join public.v3_legacy_entity_map map on map.user_id = source.user_id
      and map.source_table = 'job_applications' and map.source_id = source.id
    join public.profiles profile on profile.id = source.user_id
    where source.user_id = profile_id and source.applied_on is not null and not exists (
      select 1 from public.activity_events event where event.user_id = source.user_id
        and event.source = 'migration' and event.idempotency_key = 'migration:application-submitted:' || source.id
    );

    insert into public.activity_events (
      user_id, entity_id, event_type, payload, source, idempotency_key, occurred_at
    )
    select source.user_id, map.entity_id, 'person.contacted',
      jsonb_build_object('source_table', 'people', 'source_id', source.id, 'migration', 'command-v3'),
      'migration', 'migration:person-contacted:' || source.id,
      source.last_contacted_on::timestamp at time zone profile.timezone
    from public.people source
    join public.v3_legacy_entity_map map on map.user_id = source.user_id
      and map.source_table = 'people' and map.source_id = source.id
    join public.profiles profile on profile.id = source.user_id
    where source.user_id = profile_id and source.last_contacted_on is not null and not exists (
      select 1 from public.activity_events event where event.user_id = source.user_id
        and event.source = 'migration' and event.idempotency_key = 'migration:person-contacted:' || source.id
    );

    -- Existing Calendar rows are changed only when the corresponding mapped
    -- commitment is available and no target link already occupies that key.
    update public.integration_links link
    set entity_type = 'commitment', entity_id = commitment_map.commitment_id
    from public.v3_legacy_commitment_map commitment_map
    where link.user_id = profile_id and link.provider = 'google'
      and link.external_type = 'calendar_event'
      and (
        (link.entity_type = 'application_deadline' and commitment_map.source_table = 'job_applications'
          and commitment_map.source_field = 'window_closes_on' and commitment_map.source_id = link.entity_id)
        or (link.entity_type = 'project_deadline' and commitment_map.source_table = 'projects'
          and commitment_map.source_field = 'deadline_on' and commitment_map.source_id = link.entity_id)
      )
      and commitment_map.user_id = link.user_id
      and not exists (
        select 1 from public.integration_links existing
        where existing.user_id = link.user_id and existing.provider = link.provider
          and existing.external_type = link.external_type and existing.entity_type = 'commitment'
          and existing.entity_id = commitment_map.commitment_id and existing.id <> link.id
      );
  end loop;

  return jsonb_build_object(
    'profiles', (select count(*) from public.profiles where p_user_id is null or id = p_user_id),
    'entities', (select count(*) from public.v3_legacy_entity_map where p_user_id is null or user_id = p_user_id),
    'commitments', (select count(*) from public.v3_legacy_commitment_map where p_user_id is null or user_id = p_user_id),
    'events', (select count(*) from public.activity_events where source = 'migration' and (p_user_id is null or user_id = p_user_id))
  );
end;
$$;

create or replace function public.v3_migration_report(p_user_id uuid)
returns table (
  source_table text,
  source_rows bigint,
  mapped_entities bigint,
  compatibility_rows bigint,
  mapped_commitments bigint,
  migration_events bigint,
  calendar_links_relinked bigint,
  calendar_links_pending bigint
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with sources(source_table) as (values
    ('job_applications'::text), ('people'::text), ('projects'::text),
    ('learning_items'::text), ('ideas'::text), ('daily_logs'::text)
  )
  select source.source_table,
    case source.source_table
      when 'job_applications' then (select count(*) from public.job_applications where user_id = p_user_id)
      when 'people' then (select count(*) from public.people where user_id = p_user_id)
      when 'projects' then (select count(*) from public.projects where user_id = p_user_id)
      when 'learning_items' then (select count(*) from public.learning_items where user_id = p_user_id)
      when 'ideas' then (select count(*) from public.ideas where user_id = p_user_id)
      else (select count(*) from public.daily_logs where user_id = p_user_id)
    end,
    case when source.source_table = 'daily_logs' then
      (select count(*) from public.daily_logs where user_id = p_user_id)
      else (select count(*) from public.v3_legacy_entity_map where user_id = p_user_id and source_table = source.source_table)
    end,
    case source.source_table
      when 'job_applications' then jsonb_array_length(public.v3_migration_compatibility_json(p_user_id) -> 'job_applications')
      when 'people' then jsonb_array_length(public.v3_migration_compatibility_json(p_user_id) -> 'people')
      when 'projects' then jsonb_array_length(public.v3_migration_compatibility_json(p_user_id) -> 'projects')
      when 'learning_items' then jsonb_array_length(public.v3_migration_compatibility_json(p_user_id) -> 'learning_items')
      when 'ideas' then jsonb_array_length(public.v3_migration_compatibility_json(p_user_id) -> 'ideas')
      else jsonb_array_length(public.v3_migration_compatibility_json(p_user_id) -> 'daily_logs')
    end,
    case when source.source_table in ('daily_logs') then 0 else
      (select count(*) from public.v3_legacy_commitment_map map where map.user_id = p_user_id and map.source_table = source.source_table)
    end,
    case when source.source_table = 'daily_logs' then 0 else
      (select count(*) from public.activity_events event where event.user_id = p_user_id
        and event.source = 'migration' and event.event_type in ('entity.migrated', 'commitment.migrated')
        and event.payload ->> 'source_table' = source.source_table)
    end,
    case when source.source_table in ('job_applications', 'projects') then
      (select count(*) from public.integration_links link where link.user_id = p_user_id
        and link.external_type = 'calendar_event' and link.entity_type = 'commitment'
        and exists (select 1 from public.v3_legacy_commitment_map map where map.user_id = link.user_id and map.commitment_id = link.entity_id
          and ((source.source_table = 'job_applications' and map.source_table = 'job_applications' and map.source_field = 'window_closes_on')
            or (source.source_table = 'projects' and map.source_table = 'projects' and map.source_field = 'deadline_on'))))
      else 0
    end,
    case when source.source_table in ('job_applications', 'projects') then
      (select count(*) from public.integration_links link where link.user_id = p_user_id
        and link.external_type = 'calendar_event'
        and ((source.source_table = 'job_applications' and link.entity_type = 'application_deadline')
          or (source.source_table = 'projects' and link.entity_type = 'project_deadline')))
      else 0
    end
  from sources source
  order by source.source_table;
$$;

create or replace function public.v3_migration_calendar_report(p_user_id uuid)
returns table (relinkable bigint, relinked bigint, pending bigint)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with candidates as (
    select link.id, map.commitment_id,
      exists (select 1 from public.integration_links existing
        where existing.user_id = link.user_id and existing.provider = link.provider
          and existing.external_type = link.external_type and existing.entity_type = 'commitment'
          and existing.entity_id = map.commitment_id and existing.id <> link.id) conflict
    from public.integration_links link
    join public.v3_legacy_commitment_map map on map.user_id = link.user_id
      and map.source_id = link.entity_id
      and ((link.entity_type = 'application_deadline' and map.source_table = 'job_applications' and map.source_field = 'window_closes_on')
        or (link.entity_type = 'project_deadline' and map.source_table = 'projects' and map.source_field = 'deadline_on'))
    where link.user_id = p_user_id and link.provider = 'google' and link.external_type = 'calendar_event'
  )
  select count(*) filter (where not conflict),
    count(*) filter (where not conflict and not exists (select 1 from public.integration_links current_link where current_link.id = candidates.id and current_link.entity_type <> 'application_deadline' and current_link.entity_type <> 'project_deadline')),
    count(*) filter (where conflict)
  from candidates;
$$;

revoke all on function public.v3_migration_legacy_json(uuid) from public, anon, authenticated;
revoke all on function public.v3_migration_compatibility_json(uuid) from public, anon, authenticated;
revoke all on function public.v3_migration_csv(uuid, text, text) from public, anon, authenticated;
revoke all on function public.v3_migration_preflight(uuid) from public, anon, authenticated;
revoke all on function public.v3_migration_backfill(uuid) from public, anon, authenticated;
revoke all on function public.v3_migration_report(uuid) from public, anon, authenticated;
revoke all on function public.v3_migration_calendar_report(uuid) from public, anon, authenticated;
grant execute on function public.v3_migration_legacy_json(uuid) to service_role;
grant execute on function public.v3_migration_compatibility_json(uuid) to service_role;
grant execute on function public.v3_migration_csv(uuid, text, text) to service_role;
grant execute on function public.v3_migration_preflight(uuid) to service_role;
grant execute on function public.v3_migration_backfill(uuid) to service_role;
grant execute on function public.v3_migration_report(uuid) to service_role;
grant execute on function public.v3_migration_calendar_report(uuid) to service_role;
