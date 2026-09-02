-- Command v3 Phase 7: first-party registry administration and atomic
-- behaviour-plugin outcomes. This migration is append-only.

create function public.write_v3_entity_type(
  p_id uuid,
  p_type_key text,
  p_singular_name text,
  p_plural_name text,
  p_icon_key text,
  p_schema_version integer,
  p_field_schema jsonb,
  p_default_sort_field text,
  p_default_sort_direction text,
  p_group_by_field text,
  p_allowed_commitment_kinds text[],
  p_plugin_key text,
  p_is_active boolean
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_owner uuid;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'authentication required';
  end if;
  if auth.jwt() ->> 'client_id' is not null then
    raise exception using errcode = '42501', message = 'OAuth clients must use Command MCP tools';
  end if;
  if p_id is null then
    raise exception using errcode = '22023', message = 'invalid entity type request';
  end if;

  select user_id into existing_owner
  from public.entity_types
  where id = p_id
  for update;
  if found and existing_owner <> current_user_id then
    raise exception using errcode = '42501', message = 'entity type not found';
  end if;
  if not found and p_schema_version <> 1 then
    raise exception using errcode = '23514', message = 'new entity types start at schema version 1';
  end if;

  if not public.valid_entity_type_definition(
    p_field_schema, p_default_sort_field, p_group_by_field, p_allowed_commitment_kinds
  ) then
    raise exception using errcode = '23514', message = 'invalid entity type definition';
  end if;

  if p_plugin_key = 'spaced_repetition' and (
    not ('review' = any(p_allowed_commitment_kinds))
    or not exists (
      select 1 from jsonb_array_elements(p_field_schema) field
      where field ->> 'key' = 'confidence'
        and field ->> 'kind' = 'number'
        and coalesce((field ->> 'required')::boolean, false)
        and not coalesce((field ->> 'deprecated')::boolean, false)
    )
    or not exists (
      select 1 from jsonb_array_elements(p_field_schema) field
      where field ->> 'key' = 'mastery_hits'
        and field ->> 'kind' = 'number'
        and coalesce((field ->> 'required')::boolean, false)
        and not coalesce((field ->> 'deprecated')::boolean, false)
    )
    or not exists (
      select 1 from jsonb_array_elements(p_field_schema) field
      where field ->> 'key' = 'last_reviewed_on'
        and field ->> 'kind' = 'date'
        and not coalesce((field ->> 'deprecated')::boolean, false)
    )
  ) then
    raise exception using errcode = '23514', message = 'spaced repetition requires review, confidence, mastery_hits, and last_reviewed_on';
  end if;

  if existing_owner is null then
    insert into public.entity_types (
      id, user_id, type_key, singular_name, plural_name, icon_key,
      schema_version, field_schema, default_sort_field,
      default_sort_direction, group_by_field, allowed_commitment_kinds,
      plugin_key, is_active
    ) values (
      p_id, current_user_id, p_type_key, p_singular_name, p_plural_name,
      p_icon_key, p_schema_version, p_field_schema, p_default_sort_field,
      p_default_sort_direction, p_group_by_field, p_allowed_commitment_kinds,
      p_plugin_key, p_is_active
    );
  else
    update public.entity_types
    set type_key = p_type_key,
      singular_name = p_singular_name,
      plural_name = p_plural_name,
      icon_key = p_icon_key,
      schema_version = p_schema_version,
      field_schema = p_field_schema,
      default_sort_field = p_default_sort_field,
      default_sort_direction = p_default_sort_direction,
      group_by_field = p_group_by_field,
      allowed_commitment_kinds = p_allowed_commitment_kinds,
      plugin_key = p_plugin_key,
      is_active = p_is_active
    where user_id = current_user_id and id = p_id;
  end if;

  return jsonb_build_object('entity_type_id', p_id, 'schema_version', p_schema_version);
end;
$$;

revoke all on function public.write_v3_entity_type(
  uuid, text, text, text, text, integer, jsonb, text, text, text,
  text[], text, boolean
) from public, anon;
grant execute on function public.write_v3_entity_type(
  uuid, text, text, text, text, integer, jsonb, text, text, text,
  text[], text, boolean
) to authenticated;

create function public.write_v3_plugin_outcome(
  p_commitment_id uuid,
  p_outcome text,
  p_completed_at timestamptz,
  p_recall text,
  p_next_commitment_id uuid,
  p_next_due_on date,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_event_id uuid;
  existing_entity_id uuid;
  existing_commitment_id uuid;
  entity_id uuid;
  entity_type_id uuid;
  entity_title text;
  entity_fields jsonb;
  entity_schema_version integer;
  entity_archived_at timestamptz;
  field_schema jsonb;
  commitment_kind text;
  commitment_action text;
  commitment_due_on date;
  commitment_state text;
  completed_at timestamptz := coalesce(p_completed_at, now());
  reviewed_on date;
  confidence integer;
  mastery_hits integer;
  updated_fields jsonb;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'authentication required';
  end if;
  if auth.jwt() ->> 'client_id' is not null then
    raise exception using errcode = '42501', message = 'OAuth clients must use Command MCP tools';
  end if;
  if p_commitment_id is null
    or p_idempotency_key is null
    or char_length(p_idempotency_key) not between 8 and 180
    or p_idempotency_key <> btrim(p_idempotency_key)
  then
    raise exception using errcode = '22023', message = 'invalid plugin outcome request';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    current_user_id::text || ':ui:' || p_idempotency_key, 0
  ));

  select id, entity_id, commitment_id
    into existing_event_id, existing_entity_id, existing_commitment_id
  from public.activity_events
  where user_id = current_user_id
    and source = 'ui'
    and client_id is null
    and idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'entity_id', existing_entity_id,
      'commitment_id', existing_commitment_id,
      'event_id', existing_event_id,
      'next_commitment_id', p_next_commitment_id,
      'replayed', true
    );
  end if;

  select commitment.entity_id, commitment.kind, commitment.action,
    commitment.due_on, commitment.state,
    entity.entity_type_id, entity.title, entity.fields,
    entity.schema_version, entity.archived_at, entity_type.field_schema
  into entity_id, commitment_kind, commitment_action,
    commitment_due_on, commitment_state,
    entity_type_id, entity_title, entity_fields,
    entity_schema_version, entity_archived_at, field_schema
  from public.commitments commitment
  join public.entities entity
    on entity.user_id = commitment.user_id and entity.id = commitment.entity_id
  join public.entity_types entity_type
    on entity_type.user_id = entity.user_id and entity_type.id = entity.entity_type_id
  where commitment.user_id = current_user_id
    and commitment.id = p_commitment_id
    and entity_type.plugin_key = 'spaced_repetition'
  for update of commitment, entity;

  if not found then
    raise exception using errcode = '42501', message = 'plugin commitment not found';
  end if;
  if commitment_state <> 'open' or commitment_kind <> 'review'
    or p_recall is null or p_recall not in ('instant', 'effort', 'struggled', 'blank')
  then
    raise exception using errcode = '23514', message = 'invalid spaced-repetition outcome';
  end if;
  if jsonb_typeof(entity_fields -> 'confidence') <> 'number'
    or jsonb_typeof(entity_fields -> 'mastery_hits') <> 'number'
  then
    raise exception using errcode = '23514', message = 'plugin fields are invalid';
  end if;

  confidence := greatest(1, least(5, (entity_fields ->> 'confidence')::integer
    + case p_recall when 'instant' then 1 when 'struggled' then -1 when 'blank' then -2 else 0 end));
  mastery_hits := case
    when confidence = 5 and p_recall = 'instant'
      then greatest(0, (entity_fields ->> 'mastery_hits')::integer) + 1
    else 0
  end;
  reviewed_on := (completed_at at time zone 'Asia/Kolkata')::date;
  updated_fields := jsonb_set(
    jsonb_set(
      jsonb_set(entity_fields, '{confidence}', to_jsonb(confidence), true),
      '{mastery_hits}', to_jsonb(mastery_hits), true
    ),
    '{last_reviewed_on}', to_jsonb(reviewed_on::text), true
  );

  if not public.valid_entity_fields(updated_fields, field_schema) then
    raise exception using errcode = '23514', message = 'plugin fields do not match the current schema';
  end if;
  if mastery_hits >= 2 then
    if p_next_commitment_id is not null or p_next_due_on is not null then
      raise exception using errcode = '23514', message = 'mastered items do not schedule another review';
    end if;
  elsif p_next_commitment_id is null or p_next_due_on is null or p_next_due_on < reviewed_on then
    raise exception using errcode = '23514', message = 'the next review date is required';
  end if;

  perform public.write_v3_commitment(
    p_commitment_id, entity_id, commitment_kind, commitment_action,
    commitment_due_on, 'completed', p_outcome, completed_at,
    p_idempotency_key
  );
  perform public.write_v3_entity(
    entity_id, entity_type_id, entity_title, updated_fields,
    entity_schema_version, entity_archived_at, p_idempotency_key || ':entity'
  );
  if p_next_commitment_id is not null then
    perform public.write_v3_commitment(
      p_next_commitment_id, entity_id, 'review', commitment_action,
      p_next_due_on, 'open', null, null,
      p_idempotency_key || ':follow-up'
    );
  end if;

  return jsonb_build_object(
    'entity_id', entity_id,
    'commitment_id', p_commitment_id,
    'next_commitment_id', p_next_commitment_id,
    'replayed', false
  );
end;
$$;

revoke all on function public.write_v3_plugin_outcome(
  uuid, text, timestamptz, text, uuid, date, text
) from public, anon;
grant execute on function public.write_v3_plugin_outcome(
  uuid, text, timestamptz, text, uuid, date, text
) to authenticated;
