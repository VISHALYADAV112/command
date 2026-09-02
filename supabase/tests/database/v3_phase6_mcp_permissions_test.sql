begin;

select plan(18);

select has_table('public', 'mcp_client_permissions', 'MCP client permissions table exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.mcp_client_permissions'::regclass),
  'MCP client permissions use RLS'
);
select is(
  (select count(*)::integer from pg_policies
    where schemaname = 'public' and tablename = 'mcp_client_permissions'),
  5,
  'MCP client permissions define owner policies plus direct-OAuth isolation'
);
select ok(has_table_privilege('authenticated', 'public.mcp_client_permissions', 'select'), 'authenticated users may read their client permissions');
select ok(has_table_privilege('authenticated', 'public.mcp_client_permissions', 'insert'), 'authenticated users may grant client permissions');
select ok(has_table_privilege('authenticated', 'public.mcp_client_permissions', 'update'), 'authenticated users may narrow client permissions');
select ok(has_table_privilege('authenticated', 'public.mcp_client_permissions', 'delete'), 'authenticated users may remove client permissions');
select ok(not has_table_privilege('anon', 'public.mcp_client_permissions', 'select'), 'anonymous users have no client permission access');

set local session_replication_role = replica;
insert into public.profiles (id, email) values
  ('b1000000-0000-4000-8000-000000000001', 'permissions-one@example.test'),
  ('b2000000-0000-4000-8000-000000000002', 'permissions-two@example.test');
set local session_replication_role = origin;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'b1000000-0000-4000-8000-000000000001', true);

select lives_ok(
  $$
    insert into public.mcp_client_permissions (
      user_id, client_id, can_read_types, can_read_data, can_write_proposals
    ) values (
      'b1000000-0000-4000-8000-000000000001', 'phase6-client', true, true, true
    )
  $$,
  'an owner may grant a client bounded Command permissions'
);
select throws_ok(
  $$
    insert into public.mcp_client_permissions (user_id, client_id, can_read_types)
    values ('b2000000-0000-4000-8000-000000000002', 'foreign-client', true)
  $$,
  '42501',
  'new row violates row-level security policy for table "mcp_client_permissions"',
  'a user cannot grant permissions for another owner'
);
select is(
  (select count(*)::integer from public.mcp_client_permissions),
  1,
  'a user sees only their own client permission rows'
);
select lives_ok(
  $$
    update public.mcp_client_permissions
    set can_access_people = true
    where client_id = 'phase6-client'
  $$,
  'an owner may explicitly add the people-data grant'
);

reset role;
insert into public.mcp_client_permissions (
  user_id, client_id, can_read_types, can_read_data
) values (
  'b1000000-0000-4000-8000-000000000001', 'other-client', true, true
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated","client_id":"phase6-client"}', true);

select is(
  (select count(*)::integer from public.mcp_client_permissions),
  0,
  'an OAuth client cannot inspect application grants directly'
);
select lives_ok(
  $$
    update public.mcp_client_permissions
    set can_read_types = false
    where client_id = 'phase6-client'
  $$,
  'an OAuth-client permission escalation attempt is safely filtered by RLS'
);
select lives_ok(
  $$ delete from public.mcp_client_permissions where client_id = 'phase6-client' $$,
  'an OAuth-client grant deletion attempt is safely filtered by RLS'
);

reset role;
select is(
  (select can_read_types from public.mcp_client_permissions where client_id = 'phase6-client'),
  true,
  'an OAuth client cannot change its own grants'
);
select is(
  (select count(*)::integer from public.mcp_client_permissions where client_id = 'phase6-client'),
  1,
  'an OAuth client cannot delete its own grant'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated","client_id":"phase6-client"}', true);
select throws_ok(
  $$
    insert into public.mcp_client_permissions (user_id, client_id, can_read_types)
    values ('b1000000-0000-4000-8000-000000000001', 'escalated-client', true)
  $$,
  '42501',
  'new row violates row-level security policy for table "mcp_client_permissions"',
  'an OAuth client cannot create another grant'
);

select * from finish();
rollback;
