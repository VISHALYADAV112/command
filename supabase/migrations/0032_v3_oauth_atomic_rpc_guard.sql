-- Complete the first-party write boundary for the Phase 5 atomic RPCs.
-- Their nested writes were already guarded, but connected OAuth clients must
-- be rejected before either security-definer implementation does any work.

alter function public.write_v3_entity_with_outcome(
  uuid, uuid, text, jsonb, integer, timestamptz, text
) rename to write_v3_entity_with_outcome_first_party_impl;

revoke all on function public.write_v3_entity_with_outcome_first_party_impl(
  uuid, uuid, text, jsonb, integer, timestamptz, text
) from public, anon, authenticated;

create function public.write_v3_entity_with_outcome(
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
begin
  if auth.jwt() ->> 'client_id' is not null then
    raise exception using errcode = '42501', message = 'OAuth clients must use Command MCP tools';
  end if;
  return public.write_v3_entity_with_outcome_first_party_impl(
    p_id, p_entity_type_id, p_title, p_fields, p_schema_version,
    p_archived_at, p_idempotency_key
  );
end;
$$;

revoke all on function public.write_v3_entity_with_outcome(
  uuid, uuid, text, jsonb, integer, timestamptz, text
) from public, anon;
grant execute on function public.write_v3_entity_with_outcome(
  uuid, uuid, text, jsonb, integer, timestamptz, text
) to authenticated;

alter function public.write_v3_capture(
  uuid, uuid, text, jsonb, integer, uuid, text, text, date, text
) rename to write_v3_capture_first_party_impl;

revoke all on function public.write_v3_capture_first_party_impl(
  uuid, uuid, text, jsonb, integer, uuid, text, text, date, text
) from public, anon, authenticated;

create function public.write_v3_capture(
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
begin
  if auth.jwt() ->> 'client_id' is not null then
    raise exception using errcode = '42501', message = 'OAuth clients must use Command MCP tools';
  end if;
  return public.write_v3_capture_first_party_impl(
    p_entity_id, p_entity_type_id, p_title, p_fields, p_schema_version,
    p_commitment_id, p_commitment_kind, p_commitment_action, p_due_on,
    p_idempotency_key
  );
end;
$$;

revoke all on function public.write_v3_capture(
  uuid, uuid, text, jsonb, integer, uuid, text, text, date, text
) from public, anon;
grant execute on function public.write_v3_capture(
  uuid, uuid, text, jsonb, integer, uuid, text, text, date, text
) to authenticated;
