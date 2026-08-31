-- Keep the entity-type validators genuinely immutable and explicitly typed.
-- This follows 0013 rather than rewriting a migration already applied locally.

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
  seen_keys text[] := array[]::text[];
  seen_options text[];
begin
  if p_schema is null
    or jsonb_typeof(p_schema) <> 'array'
    or jsonb_array_length(p_schema) > 50
    or octet_length(p_schema::text) > 32768
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
      seen_options := array[]::text[];
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
  seen_kinds text[] := array[]::text[];
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
