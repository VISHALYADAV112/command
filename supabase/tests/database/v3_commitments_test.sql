begin;

select plan(38);

select has_table('public', 'commitments', 'commitments table exists');
select ok(
  to_regclass('public.commitments_user_state_due_idx') is not null,
  'commitments has an owner/state/due index'
);
select ok(
  to_regclass('public.commitments_user_entity_state_due_idx') is not null,
  'commitments has an owner/entity/state/due index'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.commitments'::regclass),
  'commitments has RLS enabled'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'commitments'),
  3,
  'commitments has select, insert, and update ownership policies'
);
select ok(
  has_table_privilege('authenticated', 'public.commitments', 'select'),
  'authenticated users may select commitments'
);
select ok(
  not has_table_privilege('authenticated', 'public.commitments', 'insert'),
  'authenticated users must use the transactional RPC to insert commitments'
);
select ok(
  not has_table_privilege('authenticated', 'public.commitments', 'update'),
  'authenticated users must use the transactional RPC to update commitments'
);
select ok(
  not has_table_privilege('authenticated', 'public.commitments', 'delete'),
  'normal workflows cannot hard-delete commitments'
);
select ok(
  not has_table_privilege('anon', 'public.commitments', 'select'),
  'anonymous users cannot read commitments'
);
select ok(
  has_function_privilege(
    'authenticated',
    'public.write_v3_commitment(uuid,uuid,text,text,date,text,text,timestamptz,text)',
    'execute'
  ),
  'authenticated users may call the transactional commitment writer'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.write_v3_commitment(uuid,uuid,text,text,date,text,text,timestamptz,text)',
    'execute'
  ),
  'anonymous users cannot call the commitment writer'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.commitments'::regclass
      and conname = 'commitments_owned_entity_fk'
      and contype = 'f'
  ),
  'commitments enforce same-owner entity integrity'
);

set local session_replication_role = replica;
insert into public.profiles (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'one-commitment@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'two-commitment@example.test');
set local session_replication_role = origin;

insert into public.entity_types (
  id, user_id, type_key, singular_name, plural_name, allowed_commitment_kinds
) values
  (
    '33333333-3333-4333-8333-333333333333',
    '11111111-1111-4111-8111-111111111111',
    'task_record', 'Task record', 'Task records',
    array['follow-up', 'deadline']::text[]
  ),
  (
    '44444444-4444-4444-8444-444444444444',
    '22222222-2222-4222-8222-222222222222',
    'foreign_task', 'Foreign task', 'Foreign tasks',
    array['follow-up']::text[]
  );

insert into public.entities (
  id, user_id, entity_type_id, title, fields, schema_version
) values
  (
    '55555555-5555-4555-8555-555555555555',
    '11111111-1111-4111-8111-111111111111',
    '33333333-3333-4333-8333-333333333333',
    'Owned task', '{}'::jsonb, 1
  ),
  (
    '66666666-6666-4666-8666-666666666666',
    '22222222-2222-4222-8222-222222222222',
    '44444444-4444-4444-8444-444444444444',
    'Foreign task', '{}'::jsonb, 1
  );

insert into public.commitments (
  id, user_id, entity_id, kind, action, due_on, origin_source
) values (
  '77777777-7777-4777-8777-777777777777',
  '22222222-2222-4222-8222-222222222222',
  '66666666-6666-4666-8666-666666666666',
  'follow-up', 'Foreign follow-up', '2026-09-01', 'ui'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

select is(
  (select count(*)::integer from public.commitments),
  0,
  'a user cannot see another owner''s commitments'
);
select lives_ok(
  $$
    select public.write_v3_commitment(
      '88888888-8888-4888-8888-888888888888',
      '55555555-5555-4555-8555-555555555555',
      'follow-up', 'Send a concise follow-up', '2026-09-02',
      'open', null, null, 'commitment-create-001'
    )
  $$,
  'the transactional writer creates an allowed open commitment'
);
select results_eq(
  $$
    select kind, action, due_on::text, state, origin_source
    from public.commitments
    where id = '88888888-8888-4888-8888-888888888888'
  $$,
  $$ values ('follow-up', 'Send a concise follow-up', '2026-09-02', 'open', 'ui') $$,
  'the canonical commitment stores its lifecycle and origin'
);
select is(
  (select count(*)::integer from public.activity_events
    where commitment_id = '88888888-8888-4888-8888-888888888888'),
  1,
  'the canonical insert appends one activity event in the same transaction'
);
select is(
  (public.write_v3_commitment(
    '88888888-8888-4888-8888-888888888888',
    '55555555-5555-4555-8555-555555555555',
    'follow-up', 'Retry payload', '2026-09-30',
    'open', null, null, 'commitment-create-001'
  ) ->> 'replayed')::boolean,
  true,
  'an idempotent retry returns the existing result'
);
select is(
  (select count(*)::integer from public.commitments
    where id = '88888888-8888-4888-8888-888888888888'),
  1,
  'an idempotent retry does not duplicate the commitment'
);
select lives_ok(
  $$
    select public.write_v3_commitment(
      '88888888-8888-4888-8888-888888888888',
      '55555555-5555-4555-8555-555555555555',
      'follow-up', 'UI-edited follow-up', '2026-09-03',
      'open', null, null, 'commitment-update-002'
    )
  $$,
  'a later UI mutation updates the commitment with a new key'
);
select is(
  (public.write_v3_commitment(
    '88888888-8888-4888-8888-888888888888',
    '55555555-5555-4555-8555-555555555555',
    'follow-up', 'Stale retry', '2026-09-30',
    'open', null, null, 'commitment-create-001'
  ) ->> 'replayed')::boolean,
  true,
  'the original retry remains a replay after a later edit'
);
select is(
  (select action from public.commitments
    where id = '88888888-8888-4888-8888-888888888888'),
  'UI-edited follow-up',
  'an old idempotent retry cannot overwrite a later UI edit'
);
select throws_ok(
  $$
    select public.write_v3_commitment(
      '99999999-9999-4999-8999-999999999999',
      '55555555-5555-4555-8555-555555555555',
      'review', 'Disallowed review', '2026-09-04',
      'open', null, null, 'commitment-invalid-kind'
    )
  $$,
  '23514',
  'commitment kind is not allowed for the entity type',
  'the registry rejects disallowed commitment kinds'
);
select is(
  (select count(*)::integer from public.activity_events
    where idempotency_key = 'commitment-invalid-kind'),
  0,
  'a failed canonical mutation does not leave an audit event'
);
select throws_ok(
  $$
    select public.write_v3_commitment(
      '99999999-9999-4999-8999-999999999998',
      '66666666-6666-4666-8666-666666666666',
      'follow-up', 'Cross-owner follow-up', '2026-09-04',
      'open', null, null, 'commitment-foreign-entity'
    )
  $$,
  '23514',
  'commitment writes require an owned entity',
  'the RPC cannot attach a commitment to another owner''s entity'
);
select lives_ok(
  $$
    select public.write_v3_commitment(
      '88888888-8888-4888-8888-888888888888',
      '55555555-5555-4555-8555-555555555555',
      'follow-up', 'UI-edited follow-up', '2026-09-03',
      'completed', 'Reply received', null, 'commitment-complete-003'
    )
  $$,
  'an open commitment can be completed with an outcome'
);
select results_eq(
  $$
    select state, outcome, completed_at is not null
    from public.commitments
    where id = '88888888-8888-4888-8888-888888888888'
  $$,
  $$ values ('completed', 'Reply received', true) $$,
  'completion stores its outcome and completion timestamp'
);
select throws_ok(
  $$
    select public.write_v3_commitment(
      '88888888-8888-4888-8888-888888888888',
      '55555555-5555-4555-8555-555555555555',
      'follow-up', 'Reopened', '2026-09-05',
      'open', null, null, 'commitment-reopen-004'
    )
  $$,
  '23514',
  'closed commitment states are terminal',
  'completed commitments cannot be reopened'
);
select throws_ok(
  $$
    insert into public.commitments (
      user_id, entity_id, kind, action, due_on, origin_source
    ) values (
      '11111111-1111-4111-8111-111111111111',
      '55555555-5555-4555-8555-555555555555',
      'deadline', 'Direct insert', '2026-09-05', 'ui'
    )
  $$,
  '42501',
  'permission denied for table commitments',
  'authenticated users cannot bypass the transactional insert path'
);
select throws_ok(
  $$ update public.commitments set action = 'Direct edit' where id = '88888888-8888-4888-8888-888888888888' $$,
  '42501',
  'permission denied for table commitments',
  'authenticated users cannot bypass the transactional update path'
);
select throws_ok(
  $$ delete from public.commitments where id = '88888888-8888-4888-8888-888888888888' $$,
  '42501',
  'permission denied for table commitments',
  'hard delete is unavailable to authenticated users'
);
select is(
  (select count(*)::integer from public.commitments),
  1,
  'RLS continues to expose only the owner''s commitment'
);

reset role;

select throws_ok(
  $$
    insert into public.commitments (
      user_id, entity_id, kind, action, due_on, state, origin_source
    ) values (
      '11111111-1111-4111-8111-111111111111',
      '55555555-5555-4555-8555-555555555555',
      'deadline', 'Cancelled without outcome', '2026-09-05', 'cancelled', 'ui'
    )
  $$,
  '23514',
  'new row for relation "commitments" violates check constraint "commitments_state_details_valid"',
  'cancelled commitments require an outcome'
);
select throws_ok(
  $$ update public.commitments set id = gen_random_uuid() where id = '88888888-8888-4888-8888-888888888888' $$,
  '23514',
  'commitment ids are permanent',
  'commitment ids cannot change'
);
select throws_ok(
  $$
    update public.commitments
    set user_id = '22222222-2222-4222-8222-222222222222'
    where id = '88888888-8888-4888-8888-888888888888'
  $$,
  '23514',
  'commitment ownership cannot change',
  'commitment ownership cannot change'
);
select throws_ok(
  $$
    update public.commitments
    set entity_id = '66666666-6666-4666-8666-666666666666'
    where id = '88888888-8888-4888-8888-888888888888'
  $$,
  '23514',
  'commitment entities are permanent',
  'commitment entity relationships cannot change'
);
select throws_ok(
  $$
    update public.commitments
    set origin_source = 'migration'
    where id = '88888888-8888-4888-8888-888888888888'
  $$,
  '23514',
  'commitment origin cannot change',
  'commitment provenance cannot be rewritten'
);
select throws_ok(
  $$
    insert into public.commitments (
      user_id, entity_id, kind, action, due_on, origin_source
    ) values (
      '11111111-1111-4111-8111-111111111111',
      '55555555-5555-4555-8555-555555555555',
      'review', 'Disallowed direct kind', '2026-09-05', 'ui'
    )
  $$,
  '23514',
  'commitment kind is not allowed for the entity type',
  'the storage trigger also enforces registry kinds'
);

select * from finish();
rollback;
