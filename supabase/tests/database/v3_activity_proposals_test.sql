begin;

select plan(77);

select has_table('public', 'activity_events', 'activity_events table exists');
select has_table('public', 'agent_proposals', 'agent_proposals table exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.activity_events'::regclass),
  'activity events have RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.agent_proposals'::regclass),
  'agent proposals have RLS enabled'
);
select is(
  (select count(*)::integer from pg_policies
    where schemaname = 'public' and tablename = 'activity_events'),
  1,
  'activity events expose only an owner-select policy'
);
select is(
  (select count(*)::integer from pg_policies
    where schemaname = 'public' and tablename = 'agent_proposals'),
  1,
  'agent proposals expose only an owner-select policy'
);
select ok(
  has_table_privilege('authenticated', 'public.activity_events', 'select'),
  'authenticated users may read their activity events'
);
select ok(
  not has_table_privilege('authenticated', 'public.activity_events', 'insert'),
  'authenticated users cannot forge activity events'
);
select ok(
  not has_table_privilege('authenticated', 'public.activity_events', 'update'),
  'authenticated users cannot update activity events'
);
select ok(
  not has_table_privilege('authenticated', 'public.activity_events', 'delete'),
  'authenticated users cannot delete activity events'
);
select ok(
  has_table_privilege('authenticated', 'public.agent_proposals', 'select'),
  'authenticated users may read their proposals'
);
select ok(
  not has_table_privilege('authenticated', 'public.agent_proposals', 'insert'),
  'authenticated users cannot forge agent proposals'
);
select ok(
  not has_table_privilege('authenticated', 'public.agent_proposals', 'update'),
  'authenticated users cannot bypass proposal decisions'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.create_agent_proposal(uuid,text,text,uuid,uuid,uuid,jsonb,jsonb,text,timestamptz)',
    'execute'
  ),
  'the service role may create validated proposals'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.create_agent_proposal(uuid,text,text,uuid,uuid,uuid,jsonb,jsonb,text,timestamptz)',
    'execute'
  ),
  'authenticated users cannot create agent proposals directly'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.decide_agent_proposal(uuid,text,jsonb,jsonb,text)',
    'execute'
  ),
  'authenticated users may decide their own proposals'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.decide_agent_proposal(uuid,text,jsonb,jsonb,text)',
    'execute'
  ),
  'anonymous users cannot decide proposals'
);
select ok(
  to_regclass('public.activity_events_idempotency_idx') is not null,
  'activity events have a source/client/user idempotency index'
);
select ok(
  to_regclass('public.agent_proposals_idempotency_idx') is not null,
  'agent proposals have a client/user idempotency index'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.valid_agent_proposal_payload(uuid,text,uuid,uuid,uuid,jsonb,jsonb)',
    'execute'
  ),
  'authenticated users cannot invoke the privileged proposal validator'
);

set local session_replication_role = replica;
insert into public.profiles (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'one-proposal@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'two-proposal@example.test');
set local session_replication_role = origin;

insert into public.entity_types (
  id, user_id, type_key, singular_name, plural_name,
  field_schema, allowed_commitment_kinds
) values
  (
    '33333333-3333-4333-8333-333333333333',
    '11111111-1111-4111-8111-111111111111',
    'proposal_record', 'Proposal record', 'Proposal records',
    '[{"key":"company","label":"Company","kind":"text","required":true}]'::jsonb,
    array['follow-up', 'deadline']::text[]
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    '22222222-2222-4222-8222-222222222222',
    'foreign_record', 'Foreign record', 'Foreign records',
    '[{"key":"company","label":"Company","kind":"text","required":true}]'::jsonb,
    array['follow-up']::text[]
  );

insert into public.entities (
  id, user_id, entity_type_id, title, fields, schema_version
) values
  (
    '55555555-5555-4555-8555-555555555555',
    '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333',
    'Base record', '{"company":"Base"}'::jsonb, 1
  ),
  (
    '66666666-6666-4666-8666-666666666666',
    '22222222-2222-4222-8222-222222222222',
    '44444444-4444-4444-8444-444444444444',
    'Foreign record', '{"company":"Foreign"}'::jsonb, 1
  );

insert into public.commitments (
  id, user_id, entity_id, kind, action, due_on, origin_source
) values
  (
    '88888888-8888-4888-8888-888888888888',
    '11111111-1111-4111-8111-111111111111',
    '55555555-5555-4555-8555-555555555555',
    'deadline', 'Base deadline', '2026-09-10', 'ui'
  ),
  (
    '99999999-9999-4999-8999-999999999999',
    '22222222-2222-4222-8222-222222222222',
    '66666666-6666-4666-8666-666666666666',
    'follow-up', 'Foreign follow-up', '2026-09-10', 'ui'
  );

insert into public.activity_events (
  id, user_id, entity_id, event_type, payload, source, idempotency_key
) values (
  '12121212-1212-4212-8212-121212121212',
  '22222222-2222-4222-8222-222222222222',
  '66666666-6666-4666-8666-666666666666',
  'entity.created', '{}'::jsonb, 'ui', 'foreign-event-001'
);

do $$
begin
  perform public.create_agent_proposal(
    '22222222-2222-4222-8222-222222222222', 'foreign-client', 'capture',
    '44444444-4444-4444-8444-444444444444', null, null,
    '{"title":"Foreign proposed","fields":{"company":"Foreign"},"schema_version":1}'::jsonb,
    null, 'foreign-proposal-001', null
  );
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

select is(
  (select count(*)::integer from public.activity_events),
  0,
  'a user cannot see another owner''s activity events'
);
select is(
  (select count(*)::integer from public.agent_proposals),
  0,
  'a user cannot see another owner''s proposals'
);
select lives_ok(
  $$
    select public.write_v3_entity(
      '77777777-7777-4777-8777-777777777777',
      '33333333-3333-4333-8333-333333333333',
      'UI-created record', '{"company":"Acme"}'::jsonb, 1, null,
      'entity-create-ui-001'
    )
  $$,
  'the entity writer creates canonical state and provenance transactionally'
);
select results_eq(
  $$
    select entity.title, count(event.id)::integer
    from public.entities entity
    left join public.activity_events event
      on event.entity_id = entity.id
    where entity.id = '77777777-7777-4777-8777-777777777777'
    group by entity.title
  $$,
  $$ values ('UI-created record', 1) $$,
  'an entity mutation stores one matching event'
);
select is(
  (public.write_v3_entity(
    '77777777-7777-4777-8777-777777777777',
    '33333333-3333-4333-8333-333333333333',
    'Stale create retry', '{"company":"Stale"}'::jsonb, 1, null,
    'entity-create-ui-001'
  ) ->> 'replayed')::boolean,
  true,
  'an entity retry returns its existing transaction result'
);
select lives_ok(
  $$
    select public.write_v3_entity(
      '77777777-7777-4777-8777-777777777777',
      '33333333-3333-4333-8333-333333333333',
      'Later UI edit', '{"company":"Updated"}'::jsonb, 1, null,
      'entity-update-ui-002'
    )
  $$,
  'a later entity edit uses a new idempotency key'
);
select is(
  (public.write_v3_entity(
    '77777777-7777-4777-8777-777777777777',
    '33333333-3333-4333-8333-333333333333',
    'Old retry', '{"company":"Old"}'::jsonb, 1, null,
    'entity-create-ui-001'
  ) ->> 'replayed')::boolean,
  true,
  'the original entity key remains a replay after later edits'
);
select is(
  (select title from public.entities where id = '77777777-7777-4777-8777-777777777777'),
  'Later UI edit',
  'an old entity retry cannot overwrite a later UI edit'
);
select lives_ok(
  $$
    select public.write_v3_entity(
      '77777777-7777-4777-8777-777777777777',
      '33333333-3333-4333-8333-333333333333',
      'Later UI edit', '{"company":"Updated"}'::jsonb, 1, now(),
      'entity-archive-ui-003'
    )
  $$,
  'the transactional entity writer archives records'
);
select is(
  (select archived_at is not null from public.entities
    where id = '77777777-7777-4777-8777-777777777777'),
  true,
  'the archived entity remains stored'
);
select lives_ok(
  $$
    select public.write_v3_entity(
      '77777777-7777-4777-8777-777777777777',
      '33333333-3333-4333-8333-333333333333',
      'Later UI edit', '{"company":"Updated"}'::jsonb, 1, null,
      'entity-restore-ui-004'
    )
  $$,
  'the transactional entity writer restores records'
);
select is(
  (select archived_at is null from public.entities
    where id = '77777777-7777-4777-8777-777777777777'),
  true,
  'the restored entity returns to active state'
);
select throws_ok(
  $$
    select public.write_v3_commitment(
      'abababab-abab-4bab-8bab-abababababab',
      '77777777-7777-4777-8777-777777777777',
      'follow-up', 'Wrong mutation key', '2026-09-11',
      'open', null, null, 'entity-create-ui-001'
    )
  $$,
  '23514',
  'idempotency key belongs to another mutation',
  'an idempotency key cannot be reused for another mutation kind'
);
select is(
  (select count(*)::integer from public.commitments
    where id = 'abababab-abab-4bab-8bab-abababababab'),
  0,
  'a rejected idempotency collision leaves canonical state unchanged'
);

reset role;

select lives_ok(
  $$
    select public.create_agent_proposal(
      '11111111-1111-4111-8111-111111111111', 'test-client', 'capture',
      '33333333-3333-4333-8333-333333333333', null, null,
      '{"title":"Agent original","fields":{"company":"Agent Co"},"schema_version":1}'::jsonb,
      null, 'proposal-capture-001', null
    )
  $$,
  'the service creates a schema-valid pending capture proposal'
);
select is(
  (select proposed_entity ? 'id' from public.agent_proposals
    where idempotency_key = 'proposal-capture-001'),
  true,
  'proposal capture assigns a stable canonical entity id'
);
select is(
  (public.create_agent_proposal(
    '11111111-1111-4111-8111-111111111111', 'test-client', 'capture',
    '33333333-3333-4333-8333-333333333333', null, null,
    '{"title":"Retry overwrite","fields":{"company":"Wrong"},"schema_version":1}'::jsonb,
    null, 'proposal-capture-001', null
  ) ->> 'replayed')::boolean,
  true,
  'a proposal retry returns the existing proposal'
);
select results_eq(
  $$
    select count(*)::integer, min(proposed_entity ->> 'title')
    from public.agent_proposals
    where idempotency_key = 'proposal-capture-001'
  $$,
  $$ values (1, 'Agent original') $$,
  'a proposal retry neither duplicates nor overwrites the pending payload'
);
select throws_ok(
  $$
    select public.create_agent_proposal(
      '11111111-1111-4111-8111-111111111111', 'test-client', 'capture',
      '33333333-3333-4333-8333-333333333333', null, null,
      '{"title":"Invalid","fields":{},"schema_version":1}'::jsonb,
      null, 'proposal-invalid-002', null
    )
  $$,
  '23514',
  'agent proposal payload is invalid',
  'invalid proposed entity fields are rejected before storage'
);
select is(
  (select count(*)::integer from public.agent_proposals
    where idempotency_key = 'proposal-invalid-002'),
  0,
  'a rejected proposal payload leaves no pending row'
);

do $$
begin
  perform public.create_agent_proposal(
    '22222222-2222-4222-8222-222222222222', 'foreign-client', 'capture',
    '44444444-4444-4444-8444-444444444444', null, null,
    '{"title":"Second foreign","fields":{"company":"Foreign"},"schema_version":1}'::jsonb,
    null, 'foreign-proposal-002', null
  );
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

select is(
  (select count(*)::integer from public.agent_proposals),
  1,
  'proposal RLS exposes only the owner''s pending capture'
);
select throws_ok(
  $$
    select public.decide_agent_proposal(
      (select id from public.agent_proposals where user_id = '22222222-2222-4222-8222-222222222222' limit 1),
      'approve', null, null, null
    )
  $$,
  '42501',
  'agent proposal not found',
  'a user cannot decide another owner''s proposal'
);
select is(
  (select count(*)::integer from public.entities where title = 'Agent original'),
  0,
  'pending proposals do not enter canonical entity reads'
);
select lives_ok(
  $$
    select public.decide_agent_proposal(
      proposal.id,
      'approve',
      jsonb_build_object(
        'id', proposal.proposed_entity ->> 'id',
        'title', 'Agent edited and approved',
        'fields', jsonb_build_object('company', 'Reviewed Co'),
        'schema_version', 1
      ),
      null,
      'Reviewed before approval'
    )
    from public.agent_proposals proposal
    where proposal.idempotency_key = 'proposal-capture-001'
  $$,
  'edit-and-approve applies a reviewed payload transactionally'
);
select results_eq(
  $$
    select state, result_entity_id is not null, result_event_id is not null,
      decision_note
    from public.agent_proposals
    where idempotency_key = 'proposal-capture-001'
  $$,
  $$ values ('approved', true, true, 'Reviewed before approval') $$,
  'approval stores one canonical entity and matching result event'
);
select is(
  (select title from public.entities where id = (
    select result_entity_id from public.agent_proposals
    where idempotency_key = 'proposal-capture-001'
  )),
  'Agent edited and approved',
  'edit-and-approve stores the reviewed canonical values'
);
select results_eq(
  $$
    select event.source, event.client_id, event.event_type
    from public.activity_events event
    join public.agent_proposals proposal on proposal.result_event_id = event.id
    where proposal.idempotency_key = 'proposal-capture-001'
  $$,
  $$ values ('mcp', 'test-client', 'entity.created') $$,
  'approved agent changes retain MCP client provenance'
);
select throws_ok(
  $$
    select public.decide_agent_proposal(
      (select id from public.agent_proposals where idempotency_key = 'proposal-capture-001'),
      'approve', null, null, null
    )
  $$,
  '23514',
  'agent proposal was already decided',
  'only the first proposal decision can win'
);

reset role;

do $$
begin
  perform public.create_agent_proposal(
    '11111111-1111-4111-8111-111111111111', 'test-client', 'capture',
    '33333333-3333-4333-8333-333333333333', null, null,
    '{"title":"Rejected entity","fields":{"company":"No"},"schema_version":1}'::jsonb,
    null, 'proposal-reject-003', null
  );
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select lives_ok(
  $$
    select public.decide_agent_proposal(
      (select id from public.agent_proposals where idempotency_key = 'proposal-reject-003'),
      'reject', null, null, 'Not useful'
    )
  $$,
  'a proposal may be rejected without touching canonical state'
);
select is(
  (select state from public.agent_proposals where idempotency_key = 'proposal-reject-003'),
  'rejected',
  'the rejected decision is permanent'
);
select is(
  (select count(*)::integer from public.entities where title = 'Rejected entity'),
  0,
  'rejected proposed data never enters canonical entities'
);

reset role;
set local session_replication_role = replica;
insert into public.agent_proposals (
  id, user_id, client_id, operation, entity_type_id,
  proposed_entity, idempotency_key, created_at, expires_at
) values (
  '13131313-1313-4313-8313-131313131313',
  '11111111-1111-4111-8111-111111111111',
  'test-client', 'capture', '33333333-3333-4333-8333-333333333333',
  '{"id":"14141414-1414-4414-8414-141414141414","title":"Expired entity","fields":{"company":"Old"},"schema_version":1}'::jsonb,
  'proposal-expired-004', now() - interval '2 days', now() - interval '1 day'
);
set local session_replication_role = origin;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select is(
  public.decide_agent_proposal(
    '13131313-1313-4313-8313-131313131313', 'approve', null, null, null
  ) ->> 'state',
  'expired',
  'an expired proposal is marked expired instead of applied'
);
select results_eq(
  $$
    select proposal.state, count(entity.id)::integer
    from public.agent_proposals proposal
    left join public.entities entity
      on entity.id = '14141414-1414-4414-8414-141414141414'
    where proposal.id = '13131313-1313-4313-8313-131313131313'
    group by proposal.state
  $$,
  $$ values ('expired', 0) $$,
  'expiration leaves canonical state untouched'
);

reset role;

do $$
begin
  perform public.create_agent_proposal(
    '11111111-1111-4111-8111-111111111111', 'test-client', 'update_entity',
    '33333333-3333-4333-8333-333333333333',
    '77777777-7777-4777-8777-777777777777', null,
    '{"title":"Agent update","fields":{"company":"Agent updated"},"schema_version":1}'::jsonb,
    null, 'proposal-update-005', null
  );
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select lives_ok(
  $$
    select public.decide_agent_proposal(
      (select id from public.agent_proposals where idempotency_key = 'proposal-update-005'),
      'approve', null, null, null
    )
  $$,
  'approval applies a current-target entity update'
);
select is(
  (select title from public.entities where id = '77777777-7777-4777-8777-777777777777'),
  'Agent update',
  'the approved update reaches canonical state'
);

reset role;
do $$
begin
  perform public.create_agent_proposal(
    '11111111-1111-4111-8111-111111111111', 'test-client', 'archive_entity',
    '33333333-3333-4333-8333-333333333333',
    '77777777-7777-4777-8777-777777777777', null,
    '{"archived":true}'::jsonb, null, 'proposal-archive-006', null
  );
end;
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select lives_ok(
  $$
    select public.decide_agent_proposal(
      (select id from public.agent_proposals where idempotency_key = 'proposal-archive-006'),
      'approve', null, null, null
    )
  $$,
  'approval can archive a current entity'
);
select is(
  (select archived_at is not null from public.entities where id = '77777777-7777-4777-8777-777777777777'),
  true,
  'approved archive keeps the entity recoverable'
);

reset role;
do $$
begin
  perform public.create_agent_proposal(
    '11111111-1111-4111-8111-111111111111', 'test-client', 'archive_entity',
    '33333333-3333-4333-8333-333333333333',
    '77777777-7777-4777-8777-777777777777', null,
    '{"archived":false}'::jsonb, null, 'proposal-restore-007', null
  );
end;
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select lives_ok(
  $$
    select public.decide_agent_proposal(
      (select id from public.agent_proposals where idempotency_key = 'proposal-restore-007'),
      'approve', null, null, null
    )
  $$,
  'approval can restore an archived entity'
);
select is(
  (select archived_at is null from public.entities where id = '77777777-7777-4777-8777-777777777777'),
  true,
  'approved restore returns the canonical entity to active state'
);

reset role;
do $$
begin
  perform public.create_agent_proposal(
    '11111111-1111-4111-8111-111111111111', 'test-client', 'schedule',
    '33333333-3333-4333-8333-333333333333',
    '77777777-7777-4777-8777-777777777777', null, null,
    '{"id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","kind":"follow-up","action":"Agent follow-up","due_on":"2026-09-12"}'::jsonb,
    'proposal-schedule-008', null
  );
end;
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select lives_ok(
  $$
    select public.decide_agent_proposal(
      (select id from public.agent_proposals where idempotency_key = 'proposal-schedule-008'),
      'approve', null, null, null
    )
  $$,
  'approval can schedule a commitment'
);
select results_eq(
  $$
    select commitment.state, commitment.origin_source, event.event_type
    from public.commitments commitment
    join public.agent_proposals proposal on proposal.result_commitment_id = commitment.id
    join public.activity_events event on event.id = proposal.result_event_id
    where proposal.idempotency_key = 'proposal-schedule-008'
  $$,
  $$ values ('open', 'mcp', 'commitment.created') $$,
  'approved schedules store canonical state and MCP provenance'
);

reset role;
do $$
begin
  perform public.create_agent_proposal(
    '11111111-1111-4111-8111-111111111111', 'test-client', 'complete',
    '33333333-3333-4333-8333-333333333333',
    '77777777-7777-4777-8777-777777777777',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', null,
    '{"outcome":"Follow-up answered"}'::jsonb,
    'proposal-complete-009', null
  );
end;
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select lives_ok(
  $$
    select public.decide_agent_proposal(
      (select id from public.agent_proposals where idempotency_key = 'proposal-complete-009'),
      'approve', null, null, null
    )
  $$,
  'approval can complete an open commitment'
);
select results_eq(
  $$
    select state, outcome, completed_at is not null
    from public.commitments where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  $$,
  $$ values ('completed', 'Follow-up answered', true) $$,
  'approved completion stores outcome and completion time'
);

reset role;
do $$
begin
  perform public.create_agent_proposal(
    '11111111-1111-4111-8111-111111111111', 'test-client', 'cancel',
    '33333333-3333-4333-8333-333333333333',
    '55555555-5555-4555-8555-555555555555',
    '88888888-8888-4888-8888-888888888888', null,
    '{"outcome":"No longer needed"}'::jsonb,
    'proposal-cancel-010', null
  );
end;
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select lives_ok(
  $$
    select public.decide_agent_proposal(
      (select id from public.agent_proposals where idempotency_key = 'proposal-cancel-010'),
      'approve', null, null, null
    )
  $$,
  'approval can cancel an open commitment'
);
select results_eq(
  $$
    select state, outcome, completed_at is null
    from public.commitments where id = '88888888-8888-4888-8888-888888888888'
  $$,
  $$ values ('cancelled', 'No longer needed', true) $$,
  'approved cancellation stores its reason without a completion timestamp'
);

reset role;
do $$
begin
  perform public.create_agent_proposal(
    '11111111-1111-4111-8111-111111111111', 'test-client', 'update_entity',
    '33333333-3333-4333-8333-333333333333',
    '77777777-7777-4777-8777-777777777777', null,
    '{"title":"Stale agent update","fields":{"company":"Stale"},"schema_version":1}'::jsonb,
    null, 'proposal-stale-011', null
  );
end;
$$;
set local session_replication_role = replica;
update public.entities
set title = 'Concurrent UI edit', updated_at = updated_at + interval '1 second'
where id = '77777777-7777-4777-8777-777777777777';
set local session_replication_role = origin;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select throws_ok(
  $$
    select public.decide_agent_proposal(
      (select id from public.agent_proposals where idempotency_key = 'proposal-stale-011'),
      'approve', null, null, null
    )
  $$,
  '40001',
  'proposal target changed; review a new proposal',
  'stale approval cannot overwrite a later canonical edit'
);
select is(
  (select state from public.agent_proposals where idempotency_key = 'proposal-stale-011'),
  'pending',
  'a stale approval failure leaves the proposal pending for review'
);
select is(
  (select count(*)::integer from public.activity_events event
    join public.agent_proposals proposal
      on event.idempotency_key = proposal.id::text
    where proposal.idempotency_key = 'proposal-stale-011'),
  0,
  'a stale approval failure leaves no partial activity event'
);

reset role;
do $$
begin
  perform public.create_agent_proposal(
    '11111111-1111-4111-8111-111111111111', 'test-client', 'capture',
    '33333333-3333-4333-8333-333333333333', null, null,
    '{"title":"Atomic candidate","fields":{"company":"Valid"},"schema_version":1}'::jsonb,
    null, 'proposal-atomic-012', null
  );
end;
$$;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select throws_ok(
  $$
    select public.decide_agent_proposal(
      proposal.id, 'approve',
      jsonb_build_object(
        'id', proposal.proposed_entity ->> 'id',
        'title', 'Invalid edited approval',
        'fields', '{}'::jsonb,
        'schema_version', 1
      ),
      null, null
    )
    from public.agent_proposals proposal
    where proposal.idempotency_key = 'proposal-atomic-012'
  $$,
  '23514',
  'agent proposal payload is invalid',
  'edit-and-approve revalidates the final payload'
);
select is(
  (select state from public.agent_proposals where idempotency_key = 'proposal-atomic-012'),
  'pending',
  'failed revalidation does not decide the proposal'
);
select is(
  (select count(*)::integer
    from public.entities entity
    join public.agent_proposals proposal
      on entity.id = (proposal.proposed_entity ->> 'id')::uuid
    where proposal.idempotency_key = 'proposal-atomic-012'),
  0,
  'failed approval revalidation creates no canonical entity'
);

reset role;

select throws_ok(
  $$
    update public.activity_events
    set payload = '{"rewritten":true}'::jsonb
    where idempotency_key = 'entity-create-ui-001'
  $$,
  '23514',
  'activity events are immutable',
  'even privileged updates cannot rewrite activity history'
);
select throws_ok(
  $$ delete from public.activity_events where idempotency_key = 'entity-create-ui-001' $$,
  '23514',
  'activity events are immutable',
  'even privileged deletes cannot erase activity history'
);
select throws_ok(
  $$
    insert into public.activity_events (
      user_id, entity_id, event_type, payload, source, idempotency_key
    ) values (
      '11111111-1111-4111-8111-111111111111',
      '77777777-7777-4777-8777-777777777777',
      'entity.updated', '{}'::jsonb, 'ui', 'entity-create-ui-001'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "activity_events_idempotency_idx"',
  'activity idempotency is unique per owner/source/client'
);
select is(
  public.valid_activity_payload(jsonb_build_object('value', repeat('x', 5001))),
  false,
  'activity payload strings are bounded'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
select throws_ok(
  $$
    update public.agent_proposals
    set state = 'rejected', decided_at = now()
    where idempotency_key = 'proposal-stale-011'
  $$,
  '42501',
  'permission denied for table agent_proposals',
  'authenticated users cannot bypass the decision RPC'
);

reset role;
select throws_ok(
  $$
    update public.agent_proposals
    set proposed_entity = jsonb_set(proposed_entity, '{title}', '"Rewritten"'::jsonb)
    where idempotency_key = 'proposal-stale-011'
  $$,
  '23514',
  'agent proposal decisions are permanent',
  'pending proposal payloads cannot be rewritten outside approval'
);

select * from finish();
rollback;
