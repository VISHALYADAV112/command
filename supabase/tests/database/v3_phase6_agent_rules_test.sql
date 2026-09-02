begin;

select plan(10);

set local session_replication_role = replica;
insert into public.profiles (id, email) values
  ('a1000000-0000-4000-8000-000000000001', 'phase6@example.test');
set local session_replication_role = origin;

insert into public.entity_types (
  id, user_id, type_key, singular_name, plural_name,
  field_schema, allowed_commitment_kinds
) values (
  'a2000000-0000-4000-8000-000000000002',
  'a1000000-0000-4000-8000-000000000001',
  'phase6_record', 'Phase 6 record', 'Phase 6 records', '[]'::jsonb,
  array['follow-up']::text[]
);

insert into public.entities (
  id, user_id, entity_type_id, title, fields, schema_version, archived_at
) values
  (
    'a3000000-0000-4000-8000-000000000003',
    'a1000000-0000-4000-8000-000000000001',
    'a2000000-0000-4000-8000-000000000002',
    'Current record', '{}'::jsonb, 1, null
  ),
  (
    'a4000000-0000-4000-8000-000000000004',
    'a1000000-0000-4000-8000-000000000001',
    'a2000000-0000-4000-8000-000000000002',
    'Archived record', '{}'::jsonb, 1, now()
  );

insert into public.commitments (
  id, user_id, entity_id, kind, action, due_on, state, outcome, completed_at, origin_source
) values
  (
    'a5000000-0000-4000-8000-000000000005',
    'a1000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000003',
    'follow-up', 'Open follow-up', '2026-09-10', 'open', null, null, 'ui'
  ),
  (
    'a6000000-0000-4000-8000-000000000006',
    'a1000000-0000-4000-8000-000000000001',
    'a3000000-0000-4000-8000-000000000003',
    'follow-up', 'Closed follow-up', '2026-09-09', 'completed', 'Done', now(), 'ui'
  );

select throws_ok(
  $$
    select public.create_agent_proposal(
      'a1000000-0000-4000-8000-000000000001', 'phase6-client', 'schedule',
      'a2000000-0000-4000-8000-000000000002',
      'a4000000-0000-4000-8000-000000000004', null, null,
      '{"kind":"follow-up","action":"Should not schedule","due_on":"2026-09-12"}'::jsonb,
      'phase6-archived-schedule', null
    )
  $$,
  '23514',
  'agent proposal target is not current',
  'an archived entity cannot receive a schedule proposal'
);

select throws_ok(
  $$
    select public.create_agent_proposal(
      'a1000000-0000-4000-8000-000000000001', 'phase6-client', 'complete',
      'a2000000-0000-4000-8000-000000000002',
      'a3000000-0000-4000-8000-000000000003',
      'a6000000-0000-4000-8000-000000000006', null,
      '{"outcome":"Again"}'::jsonb, 'phase6-closed-complete', null
    )
  $$,
  '23514',
  'agent proposal target is not current',
  'a closed commitment cannot receive another completion proposal'
);

select lives_ok(
  $$
    select public.create_agent_proposal(
      'a1000000-0000-4000-8000-000000000001', 'phase6-client', 'schedule',
      'a2000000-0000-4000-8000-000000000002',
      'a3000000-0000-4000-8000-000000000003', null, null,
      '{"kind":"follow-up","action":"Review later","due_on":"2026-09-12"}'::jsonb,
      'phase6-current-schedule', null
    )
  $$,
  'a current entity accepts a valid schedule proposal'
);

select lives_ok(
  $$
    select public.create_agent_proposal(
      'a1000000-0000-4000-8000-000000000001', 'phase6-client', 'complete',
      'a2000000-0000-4000-8000-000000000002',
      'a3000000-0000-4000-8000-000000000003',
      'a5000000-0000-4000-8000-000000000005', null,
      '{"outcome":"Answered"}'::jsonb, 'phase6-current-complete', null
    )
  $$,
  'an open commitment accepts a valid completion proposal'
);

update public.entities
set archived_at = now()
where id = 'a3000000-0000-4000-8000-000000000003';

set local role authenticated;
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);

select throws_ok(
  $$
    select public.decide_agent_proposal(
      (select id from public.agent_proposals where idempotency_key = 'phase6-current-schedule'),
      'approve', null, null, null
    )
  $$,
  '23514',
  'agent proposal target is not current',
  'approval rechecks an entity archived after schedule proposal creation'
);

select is(
  (select count(*)::integer from public.commitments where action = 'Review later'),
  0,
  'a failed schedule approval leaves no commitment behind'
);

select throws_ok(
  $$
    select public.decide_agent_proposal(
      (select id from public.agent_proposals where idempotency_key = 'phase6-current-complete'),
      'approve', null, null, null
    )
  $$,
  '23514',
  'agent proposal target is not current',
  'approval rechecks an entity archived after completion proposal creation'
);

select is(
  (select state from public.commitments where id = 'a5000000-0000-4000-8000-000000000005'),
  'open',
  'a failed completion approval rolls its canonical mutation back'
);

select lives_ok(
  $$
    select public.decide_agent_proposal(
      (select id from public.agent_proposals where idempotency_key = 'phase6-current-schedule'),
      'reject', null, null, 'Target became stale'
    )
  $$,
  'a stale schedule proposal can still be rejected'
);

select is(
  (select state from public.agent_proposals where idempotency_key = 'phase6-current-schedule'),
  'rejected',
  'stale proposal rejection remains permanent'
);

select * from finish();
rollback;
