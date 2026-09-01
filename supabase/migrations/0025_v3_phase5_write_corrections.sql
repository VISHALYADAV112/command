-- Command v3 Phase 5 correction: canonical outcome provenance and atomic capture.

create or replace function public.write_v3_entity_with_outcome(
  p_id uuid,
  p_entity_type_id uuid,
  p_title text,
  p_fields jsonb,
  p_schema_version integer,
  p_archived_at timestamptz,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_user_id uuid := auth.uid();
  previous_fields jsonb;
  type_key text;
  timezone_name text;
  outcome_day date;
  previous_day date;
  outcome_event_type text;
  outcome_event_id uuid;
  result jsonb;
begin
  if current_user_id is null then
    raise exception using errcode = '28000', message = 'authentication required';
  end if;
  if p_idempotency_key is null
    or char_length(p_idempotency_key) not between 8 and 180
    or p_idempotency_key <> btrim(p_idempotency_key)
  then
    raise exception using errcode = '22023', message = 'invalid entity write request';
  end if;

  select entity.fields into previous_fields
  from public.entities entity
  where entity.user_id = current_user_id and entity.id = p_id;

  result := public.write_v3_entity(
    p_id, p_entity_type_id, p_title, p_fields, p_schema_version,
    p_archived_at, p_idempotency_key
  );

  -- Replaying the original write must never create a new historical outcome,
  -- especially after a later UI edit has changed the canonical fields.
  if coalesce((result ->> 'replayed')::boolean, false) then
    return result;
  end if;

  select entity_type.type_key, coalesce(profile.timezone, 'Asia/Kolkata')
    into type_key, timezone_name
  from public.entity_types entity_type
  join public.profiles profile on profile.id = current_user_id
  where entity_type.user_id = current_user_id and entity_type.id = p_entity_type_id;

  if type_key = 'application' then
    outcome_event_type := 'application.submitted';
    outcome_day := nullif(p_fields ->> 'applied_on', '')::date;
    previous_day := nullif(previous_fields ->> 'applied_on', '')::date;
  elsif type_key = 'person' then
    outcome_event_type := 'person.contacted';
    outcome_day := nullif(p_fields ->> 'last_contacted_on', '')::date;
    previous_day := nullif(previous_fields ->> 'last_contacted_on', '')::date;
  end if;

  if outcome_event_type is not null
    and outcome_day is not null
    and outcome_day is distinct from previous_day
  then
    outcome_event_id := gen_random_uuid();
    insert into public.activity_events (
      id, user_id, entity_id, event_type, payload, source,
      idempotency_key, occurred_at
    ) values (
      outcome_event_id, current_user_id, p_id, outcome_event_type,
      jsonb_build_object('day', outcome_day), 'ui',
      p_idempotency_key || ':outcome',
      outcome_day::timestamp at time zone timezone_name
    );
    result := result || jsonb_build_object('outcome_event_id', outcome_event_id);
  end if;

  return result;
end;
$$;

revoke all on function public.write_v3_entity_with_outcome(
  uuid, uuid, text, jsonb, integer, timestamptz, text
) from public, anon;
grant execute on function public.write_v3_entity_with_outcome(
  uuid, uuid, text, jsonb, integer, timestamptz, text
) to authenticated;

create or replace function public.write_v3_capture(
  p_entity_id uuid,
  p_entity_type_id uuid,
  p_title text,
  p_fields jsonb,
  p_schema_version integer,
  p_commitment_id uuid,
  p_commitment_kind text,
  p_commitment_action text,
  p_due_on date,
  p_idempotency_key text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  entity_result jsonb;
  commitment_result jsonb;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'authentication required';
  end if;
  if p_idempotency_key is null
    or char_length(p_idempotency_key) not between 8 and 160
    or p_idempotency_key <> btrim(p_idempotency_key)
  then
    raise exception using errcode = '22023', message = 'invalid capture request';
  end if;

  entity_result := public.write_v3_entity_with_outcome(
    p_entity_id, p_entity_type_id, p_title, p_fields, p_schema_version,
    null, p_idempotency_key || ':entity'
  );
  commitment_result := public.write_v3_commitment(
    p_commitment_id, p_entity_id, p_commitment_kind,
    p_commitment_action, p_due_on, 'open', null, null,
    p_idempotency_key || ':commitment'
  );

  return jsonb_build_object(
    'entity', entity_result,
    'commitment', commitment_result,
    'replayed',
      coalesce((entity_result ->> 'replayed')::boolean, false)
      and coalesce((commitment_result ->> 'replayed')::boolean, false)
  );
end;
$$;

revoke all on function public.write_v3_capture(
  uuid, uuid, text, jsonb, integer, uuid, text, text, date, text
) from public, anon;
grant execute on function public.write_v3_capture(
  uuid, uuid, text, jsonb, integer, uuid, text, text, date, text
) to authenticated;
