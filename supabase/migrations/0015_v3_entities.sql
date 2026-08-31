-- Command v3 data foundation, slice 2: canonical typed entities.
-- Commitments and event/proposal tables remain intentionally deferred.

create or replace function public.valid_entity_fields(
  p_fields jsonb,
  p_schema jsonb
) returns boolean
language plpgsql
immutable
set search_path = pg_catalog, public
as $$
declare
  field_definition jsonb;
  field_key text;
  field_kind text;
  field_value jsonb;
  field_count integer;
begin
  if p_fields is null
    or jsonb_typeof(p_fields) <> 'object'
    or octet_length(p_fields::text) > 65536
    or not public.valid_entity_field_schema(p_schema)
  then
    return false;
  end if;

  select count(*)::integer into field_count from jsonb_object_keys(p_fields);
  if field_count > 50 then
    return false;
  end if;

  for field_definition in select value from jsonb_array_elements(p_schema)
  loop
    field_key := field_definition ->> 'key';
    if not coalesce((field_definition ->> 'deprecated')::boolean, false)
      and coalesce((field_definition ->> 'required')::boolean, false)
      and (
        not p_fields ? field_key
        or jsonb_typeof(p_fields -> field_key) = 'null'
      )
    then
      return false;
    end if;
  end loop;

  for field_key, field_value in select key, value from jsonb_each(p_fields)
  loop
    select value into field_definition
    from jsonb_array_elements(p_schema)
    where value ->> 'key' = field_key;

    if not found then
      return false;
    end if;
    if jsonb_typeof(field_value) = 'null' then
      continue;
    end if;

    field_kind := field_definition ->> 'kind';
    if field_kind = 'text' then
      if jsonb_typeof(field_value) <> 'string'
        or char_length(field_value #>> '{}') > 500
      then
        return false;
      end if;
    elsif field_kind = 'textarea' then
      if jsonb_typeof(field_value) <> 'string'
        or char_length(field_value #>> '{}') > 10000
      then
        return false;
      end if;
    elsif field_kind = 'number' then
      if jsonb_typeof(field_value) <> 'number' then
        return false;
      end if;
    elsif field_kind = 'boolean' then
      if jsonb_typeof(field_value) <> 'boolean' then
        return false;
      end if;
    elsif field_kind = 'date' then
      if jsonb_typeof(field_value) <> 'string'
        or field_value #>> '{}' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      then
        return false;
      end if;
      begin
        perform make_date(
          substring(field_value #>> '{}', 1, 4)::integer,
          substring(field_value #>> '{}', 6, 2)::integer,
          substring(field_value #>> '{}', 9, 2)::integer
        );
      exception when others then
        return false;
      end;
    elsif field_kind = 'url' then
      if jsonb_typeof(field_value) <> 'string'
        or char_length(field_value #>> '{}') > 2000
        or field_value #>> '{}' !~ '^https?://[^[:space:]]+$'
      then
        return false;
      end if;
    elsif field_kind = 'single_select' then
      if jsonb_typeof(field_value) <> 'string'
        or not exists (
          select 1
          from jsonb_array_elements_text(field_definition -> 'options') option_value
          where option_value = field_value #>> '{}'
        )
      then
        return false;
      end if;
    else
      return false;
    end if;
  end loop;

  return true;
end;
$$;

revoke all on function public.valid_entity_fields(jsonb, jsonb) from public, anon, authenticated;

create table public.entities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  entity_type_id uuid not null,
  title text not null check (
    nullif(btrim(title), '') is not null and char_length(title) <= 200
  ),
  fields jsonb not null default '{}'::jsonb,
  schema_version integer not null check (schema_version > 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint entities_user_id_id_unique unique (user_id, id),
  constraint entities_owned_type_fk foreign key (user_id, entity_type_id)
    references public.entity_types (user_id, id) on delete restrict
);

create index entities_user_archive_updated_idx
  on public.entities (user_id, archived_at, updated_at desc);
create index entities_user_type_archive_updated_idx
  on public.entities (user_id, entity_type_id, archived_at, updated_at desc);

create or replace function public.enforce_entity_contract()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  active_schema jsonb;
  active_schema_version integer;
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      raise exception using errcode = '23514', message = 'entity ids are permanent';
    end if;
    if new.user_id is distinct from old.user_id then
      raise exception using errcode = '23514', message = 'entity ownership cannot change';
    end if;
    if new.entity_type_id is distinct from old.entity_type_id then
      raise exception using errcode = '23514', message = 'entity types are permanent';
    end if;
    if new.created_at is distinct from old.created_at then
      raise exception using errcode = '23514', message = 'entity creation timestamps are permanent';
    end if;

    if new.fields is not distinct from old.fields
      and new.schema_version is not distinct from old.schema_version
    then
      return new;
    end if;
  end if;

  select field_schema, schema_version
    into active_schema, active_schema_version
  from public.entity_types
  where id = new.entity_type_id
    and user_id = new.user_id
    and is_active;

  if not found then
    raise exception using errcode = '23514', message = 'entity writes require an active owned type';
  end if;
  if new.schema_version <> active_schema_version then
    raise exception using errcode = '23514', message = 'entity schema version must match the active type';
  end if;
  if not public.valid_entity_fields(new.fields, active_schema) then
    raise exception using errcode = '23514', message = 'entity fields do not match the active type schema';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_entity_contract() from public, anon, authenticated;

create trigger entities_enforce_contract
  before insert or update on public.entities
  for each row execute function public.enforce_entity_contract();
create trigger entities_set_updated_at
  before update on public.entities
  for each row execute function public.set_updated_at();

alter table public.entities enable row level security;
revoke all on public.entities from anon, authenticated;
grant select, insert, update on public.entities to authenticated;
grant all on public.entities to service_role;

create policy "entities_select_own" on public.entities
  for select using (user_id = auth.uid());
create policy "entities_insert_own" on public.entities
  for insert with check (user_id = auth.uid());
create policy "entities_update_own" on public.entities
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
