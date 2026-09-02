-- Security-definer UI RPCs bypass RLS by design. Keep their public signatures
-- for the first-party app, but reject OAuth-client tokens before the original
-- implementation can read or mutate canonical data.

alter function public.write_v3_entity(
  uuid, uuid, text, jsonb, integer, timestamptz, text
) rename to write_v3_entity_first_party_impl;

revoke all on function public.write_v3_entity_first_party_impl(
  uuid, uuid, text, jsonb, integer, timestamptz, text
) from public, anon, authenticated;

create function public.write_v3_entity(
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
  return public.write_v3_entity_first_party_impl(
    p_id, p_entity_type_id, p_title, p_fields, p_schema_version,
    p_archived_at, p_idempotency_key
  );
end;
$$;

revoke all on function public.write_v3_entity(
  uuid, uuid, text, jsonb, integer, timestamptz, text
) from public, anon;
grant execute on function public.write_v3_entity(
  uuid, uuid, text, jsonb, integer, timestamptz, text
) to authenticated;

alter function public.write_v3_commitment(
  uuid, uuid, text, text, date, text, text, timestamptz, text
) rename to write_v3_commitment_first_party_impl;

revoke all on function public.write_v3_commitment_first_party_impl(
  uuid, uuid, text, text, date, text, text, timestamptz, text
) from public, anon, authenticated;

create function public.write_v3_commitment(
  p_id uuid,
  p_entity_id uuid,
  p_kind text,
  p_action text,
  p_due_on date,
  p_state text,
  p_outcome text,
  p_completed_at timestamptz,
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
  return public.write_v3_commitment_first_party_impl(
    p_id, p_entity_id, p_kind, p_action, p_due_on, p_state,
    p_outcome, p_completed_at, p_idempotency_key
  );
end;
$$;

revoke all on function public.write_v3_commitment(
  uuid, uuid, text, text, date, text, text, timestamptz, text
) from public, anon;
grant execute on function public.write_v3_commitment(
  uuid, uuid, text, text, date, text, text, timestamptz, text
) to authenticated;

alter function public.decide_agent_proposal(
  uuid, text, jsonb, jsonb, text
) rename to decide_agent_proposal_first_party_impl;

revoke all on function public.decide_agent_proposal_first_party_impl(
  uuid, text, jsonb, jsonb, text
) from public, anon, authenticated;

create function public.decide_agent_proposal(
  p_proposal_id uuid,
  p_decision text,
  p_entity_payload jsonb default null,
  p_commitment_payload jsonb default null,
  p_decision_note text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if auth.jwt() ->> 'client_id' is not null then
    raise exception using errcode = '42501', message = 'OAuth clients must use Command MCP tools';
  end if;
  return public.decide_agent_proposal_first_party_impl(
    p_proposal_id, p_decision, p_entity_payload,
    p_commitment_payload, p_decision_note
  );
end;
$$;

revoke all on function public.decide_agent_proposal(
  uuid, text, jsonb, jsonb, text
) from public, anon;
grant execute on function public.decide_agent_proposal(
  uuid, text, jsonb, jsonb, text
) to authenticated;
