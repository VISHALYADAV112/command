begin;

select plan(18);

select is(
  (select count(*)::integer from pg_policies
    where schemaname = 'public'
      and policyname = 'first_party_or_service_only'
      and permissive = 'RESTRICTIVE'),
  15,
  'all user-facing public data tables deny direct OAuth-client access'
);
select ok(
  has_function_privilege(
    'service_role', 'public.get_v3_due_for_mcp(uuid,date,text,text,integer,integer)', 'execute'
  ),
  'only the Edge Function service role can execute the MCP due reader'
);
select ok(
  not has_function_privilege(
    'authenticated', 'public.get_v3_due_for_mcp(uuid,date,text,text,integer,integer)', 'execute'
  ),
  'OAuth-authenticated clients cannot execute the MCP due reader directly'
);

set local session_replication_role = replica;
insert into public.profiles (id, email) values
  ('c1000000-0000-4000-8000-000000000001', 'oauth-isolation@example.test');
set local session_replication_role = origin;

insert into public.entity_types (
  id, user_id, type_key, singular_name, plural_name,
  field_schema, allowed_commitment_kinds
) values (
  'c2000000-0000-4000-8000-000000000002',
  'c1000000-0000-4000-8000-000000000001',
  'oauth_record', 'OAuth record', 'OAuth records', '[]'::jsonb,
  array['follow-up']::text[]
);
insert into public.entities (
  id, user_id, entity_type_id, title, fields, schema_version
) values (
  'c3000000-0000-4000-8000-000000000003',
  'c1000000-0000-4000-8000-000000000001',
  'c2000000-0000-4000-8000-000000000002',
  'Private canonical record', '{}'::jsonb, 1
);
insert into public.commitments (
  id, user_id, entity_id, kind, action, due_on, origin_source
) values (
  'c4000000-0000-4000-8000-000000000004',
  'c1000000-0000-4000-8000-000000000001',
  'c3000000-0000-4000-8000-000000000003',
  'follow-up', 'Private commitment', '2026-09-03', 'ui'
);
insert into public.mcp_client_permissions (
  user_id, client_id, can_read_types, can_read_data, can_write_proposals
) values (
  'c1000000-0000-4000-8000-000000000001', 'isolated-client', true, true, true
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"c1000000-0000-4000-8000-000000000001","role":"authenticated","client_id":"isolated-client"}', true);

select is((select count(*)::integer from public.profiles), 0, 'OAuth clients cannot query profiles directly');
select is((select count(*)::integer from public.entity_types), 0, 'OAuth clients cannot query registry rows directly');
select is((select count(*)::integer from public.entities), 0, 'OAuth clients cannot query entities directly');
select is((select count(*)::integer from public.commitments), 0, 'OAuth clients cannot query commitments directly');
select is((select count(*)::integer from public.mcp_client_permissions), 0, 'OAuth clients cannot query application grants directly');
select throws_ok(
  $$ select * from public.get_v3_due_for_mcp(
    'c1000000-0000-4000-8000-000000000001', '2026-09-02', 'all', null, 20, 0
  ) $$,
  '42501',
  'permission denied for function get_v3_due_for_mcp',
  'OAuth clients cannot call the service-only reader'
);
select throws_ok(
  $$ select public.write_v3_entity(
    'c5000000-0000-4000-8000-000000000005',
    'c2000000-0000-4000-8000-000000000002',
    'Bypass attempt', '{}'::jsonb, 1, null, 'oauth-bypass-entity'
  ) $$,
  '42501',
  'OAuth clients must use Command MCP tools',
  'OAuth clients cannot bypass proposal review through the UI entity RPC'
);
select throws_ok(
  $$ select public.write_v3_commitment(
    'c6000000-0000-4000-8000-000000000006',
    'c3000000-0000-4000-8000-000000000003',
    'follow-up', 'Bypass attempt', '2026-09-04', 'open', null, null,
    'oauth-bypass-commitment'
  ) $$,
  '42501',
  'OAuth clients must use Command MCP tools',
  'OAuth clients cannot bypass proposal review through the UI commitment RPC'
);
select throws_ok(
  $$ select public.write_v3_entity_with_outcome(
    'c5000000-0000-4000-8000-000000000005',
    'c2000000-0000-4000-8000-000000000002',
    'Derived bypass attempt', '{}'::jsonb, 1, null, 'oauth-derived-entity'
  ) $$,
  '42501',
  'OAuth clients must use Command MCP tools',
  'OAuth clients cannot bypass the guard through the outcome-aware entity RPC'
);
select throws_ok(
  $$ select public.write_v3_capture(
    'c5000000-0000-4000-8000-000000000005',
    'c2000000-0000-4000-8000-000000000002',
    'Capture bypass attempt', '{}'::jsonb, 1,
    'c6000000-0000-4000-8000-000000000006',
    'follow-up', 'Bypass attempt', '2026-09-04', 'oauth-capture-bypass'
  ) $$,
  '42501',
  'OAuth clients must use Command MCP tools',
  'OAuth clients cannot bypass the guard through the atomic capture RPC'
);
select throws_ok(
  $$ select public.decide_agent_proposal(
    'c7000000-0000-4000-8000-000000000007', 'reject', null, null, null
  ) $$,
  '42501',
  'OAuth clients must use Command MCP tools',
  'OAuth clients cannot decide proposals through the first-party review RPC'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.write_v3_entity_first_party_impl(uuid,uuid,text,jsonb,integer,timestamp with time zone,text)',
    'execute'
  ),
  'the unguarded entity implementation is not executable by OAuth clients'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.write_v3_entity_with_outcome_first_party_impl(uuid,uuid,text,jsonb,integer,timestamp with time zone,text)',
    'execute'
  ),
  'the unguarded outcome-aware entity implementation is not executable by OAuth clients'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.write_v3_capture_first_party_impl(uuid,uuid,text,jsonb,integer,uuid,text,text,date,text)',
    'execute'
  ),
  'the unguarded atomic capture implementation is not executable by OAuth clients'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.decide_agent_proposal_first_party_impl(uuid,text,jsonb,jsonb,text)',
    'execute'
  ),
  'the unguarded proposal-decision implementation is not executable by OAuth clients'
);

select * from finish();
rollback;
