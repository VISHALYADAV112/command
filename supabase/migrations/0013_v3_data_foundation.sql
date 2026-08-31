-- Command v3 data foundation, slice 1: the owned entity-type registry.
-- Dependent v3 tables are intentionally added only after this contract passes.

create or replace function public.valid_entity_field_schema(p_schema jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  field jsonb;
  option_value jsonb;
  field_key text;
  field_kind text;
  seen_keys text[] := '{}';
  seen_options text[];
begin
  if p_schema is null
    or jsonb_typeof(p_schema) <> 'array'
    or jsonb_array_length(p_schema) > 50
    or pg_column_size(p_schema) > 32768
  then
    return false;
  end if;

  for field in select value from jsonb_array_elements(p_schema)
  loop
    if jsonb_typeof(field) <> 'object'
      or field - array[
        'key', 'label', 'kind', 'required', 'list_visible',
        'filterable', 'deprecated', 'options'
      ]::text[] <> '{}'::jsonb
    then
      return false;
    end if;

    field_key := field ->> 'key';
    field_kind := field ->> 'kind';
    if field_key is null
      or field_key !~ '^[a-z][a-z0-9_]{0,62}$'
      or field_key = any(seen_keys)
      or nullif(btrim(field ->> 'label'), '') is null
      or char_length(field ->> 'label') > 80
      or field_kind not in ('text', 'textarea', 'number', 'boolean', 'date', 'url', 'single_select')
    then
      return false;
    end if;

    if (field ? 'required' and jsonb_typeof(field -> 'required') <> 'boolean')
      or (field ? 'list_visible' and jsonb_typeof(field -> 'list_visible') <> 'boolean')
      or (field ? 'filterable' and jsonb_typeof(field -> 'filterable') <> 'boolean')
      or (field ? 'deprecated' and jsonb_typeof(field -> 'deprecated') <> 'boolean')
    then
      return false;
    end if;

    if coalesce((field ->> 'deprecated')::boolean, false)
      and (
        coalesce((field ->> 'required')::boolean, false)
        or coalesce((field ->> 'list_visible')::boolean, false)
        or coalesce((field ->> 'filterable')::boolean, false)
      )
    then
      return false;
    end if;

    if field ? 'options' then
      if field_kind <> 'single_select'
        or jsonb_typeof(field -> 'options') <> 'array'
        or jsonb_array_length(field -> 'options') > 100
      then
        return false;
      end if;
      seen_options := '{}';
      for option_value in select value from jsonb_array_elements(field -> 'options')
      loop
        if jsonb_typeof(option_value) <> 'string'
          or nullif(btrim(option_value #>> '{}'), '') is null
          or char_length(option_value #>> '{}') > 100
          or option_value #>> '{}' = any(seen_options)
        then
          return false;
        end if;
        seen_options := array_append(seen_options, option_value #>> '{}');
      end loop;
    end if;

    seen_keys := array_append(seen_keys, field_key);
  end loop;

  return true;
end;
$$;

create or replace function public.valid_entity_type_definition(
  p_schema jsonb,
  p_default_sort_field text,
  p_group_by_field text,
  p_commitment_kinds text[]
) returns boolean
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  value text;
  seen_kinds text[] := '{}';
begin
  if not public.valid_entity_field_schema(p_schema)
    or p_default_sort_field is null
    or cardinality(p_commitment_kinds) > 6
  then
    return false;
  end if;

  if p_default_sort_field not in ('title', 'created_at', 'updated_at')
    and not exists (
      select 1 from jsonb_array_elements(p_schema) field
      where field ->> 'key' = p_default_sort_field
        and not coalesce((field ->> 'deprecated')::boolean, false)
    )
  then
    return false;
  end if;

  if p_group_by_field is not null
    and not exists (
      select 1 from jsonb_array_elements(p_schema) field
      where field ->> 'key' = p_group_by_field
        and not coalesce((field ->> 'deprecated')::boolean, false)
    )
  then
    return false;
  end if;

  foreach value in array p_commitment_kinds
  loop
    if value not in ('follow-up', 'deadline', 'review', 'contact', 'drill', 'milestone')
      or value = any(seen_kinds)
    then
      return false;
    end if;
    seen_kinds := array_append(seen_kinds, value);
  end loop;

  return true;
end;
$$;

create table public.entity_types (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type_key text not null check (type_key ~ '^[a-z][a-z0-9_]{0,62}$'),
  singular_name text not null check (
    nullif(btrim(singular_name), '') is not null and char_length(singular_name) <= 80
  ),
  plural_name text not null check (
    nullif(btrim(plural_name), '') is not null and char_length(plural_name) <= 80
  ),
  icon_key text not null default 'generic' check (
    icon_key in ('application', 'person', 'project', 'learning', 'note', 'generic')
  ),
  schema_version integer not null default 1 check (schema_version > 0),
  field_schema jsonb not null default '[]'::jsonb,
  default_sort_field text not null default 'updated_at',
  default_sort_direction text not null default 'desc' check (
    default_sort_direction in ('asc', 'desc')
  ),
  group_by_field text,
  allowed_commitment_kinds text[] not null default '{}',
  plugin_key text check (plugin_key in ('spaced_repetition')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entity_types_user_key_unique unique (user_id, type_key),
  constraint entity_types_user_id_id_unique unique (user_id, id),
  constraint entity_types_definition_valid check (
    public.valid_entity_type_definition(
      field_schema, default_sort_field, group_by_field, allowed_commitment_kinds
    )
  )
);

create index entity_types_user_active_key_idx
  on public.entity_types (user_id, is_active, type_key);

create trigger entity_types_set_updated_at
  before update on public.entity_types
  for each row execute function public.set_updated_at();

create or replace function public.enforce_entity_type_evolution()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  old_field jsonb;
  replacement jsonb;
begin
  if new.user_id is distinct from old.user_id then
    raise exception using errcode = '23514', message = 'entity type ownership cannot change';
  end if;
  if new.type_key is distinct from old.type_key then
    raise exception using errcode = '23514', message = 'entity type keys are permanent';
  end if;

  if new.field_schema is distinct from old.field_schema then
    if new.schema_version <> old.schema_version + 1 then
      raise exception using errcode = '23514', message = 'schema changes require the next schema version';
    end if;
    for old_field in select value from jsonb_array_elements(old.field_schema)
    loop
      select value into replacement
      from jsonb_array_elements(new.field_schema)
      where value ->> 'key' = old_field ->> 'key';
      if replacement is null then
        raise exception using errcode = '23514', message = 'existing field keys must be retained and deprecated';
      end if;
      if replacement ->> 'kind' is distinct from old_field ->> 'kind' then
        raise exception using errcode = '23514', message = 'field kinds are permanent; add a new field and migrate';
      end if;
    end loop;
  elsif new.schema_version <> old.schema_version then
    raise exception using errcode = '23514', message = 'schema version changes require a schema change';
  end if;

  return new;
end;
$$;

create trigger entity_types_enforce_evolution
  before update on public.entity_types
  for each row execute function public.enforce_entity_type_evolution();

alter table public.entity_types enable row level security;
revoke all on public.entity_types from anon, authenticated;
grant select, insert, update on public.entity_types to authenticated;
grant all on public.entity_types to service_role;

create policy "entity_types_select_own" on public.entity_types
  for select using (user_id = auth.uid());
create policy "entity_types_insert_own" on public.entity_types
  for insert with check (user_id = auth.uid());
create policy "entity_types_update_own" on public.entity_types
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.seed_default_entity_types(p_user_id uuid)
returns void
language sql
security definer
set search_path = pg_catalog, public
as $$
  insert into public.entity_types (
    user_id, type_key, singular_name, plural_name, icon_key,
    allowed_commitment_kinds, plugin_key
  )
  select p_user_id, seed.type_key, seed.singular_name, seed.plural_name,
    seed.icon_key, seed.allowed_commitment_kinds, seed.plugin_key
  from (values
    ('application', 'Application', 'Applications', 'application', array['follow-up', 'deadline', 'milestone']::text[], null::text),
    ('person', 'Person', 'People', 'person', array['contact', 'follow-up']::text[], null::text),
    ('project', 'Project', 'Projects', 'project', array['deadline', 'review', 'milestone']::text[], null::text),
    ('learning', 'Learning item', 'Learning', 'learning', array['review', 'drill']::text[], 'spaced_repetition'::text),
    ('note', 'Note', 'Notes', 'note', '{}'::text[], null::text)
  ) as seed(
    type_key, singular_name, plural_name, icon_key,
    allowed_commitment_kinds, plugin_key
  )
  on conflict (user_id, type_key) do nothing;
$$;

revoke all on function public.seed_default_entity_types(uuid) from public, anon, authenticated;

create or replace function public.seed_default_entity_types_after_profile()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  perform public.seed_default_entity_types(new.id);
  return new;
end;
$$;

revoke all on function public.seed_default_entity_types_after_profile() from public, anon, authenticated;

create trigger entity_types_seed_after_profile
  after insert on public.profiles
  for each row execute function public.seed_default_entity_types_after_profile();

do $$
begin
  perform public.seed_default_entity_types(id) from public.profiles;
end;
$$;
