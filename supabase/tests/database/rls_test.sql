begin;

select plan(17);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.daily_logs'::regclass),
  'daily_logs has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.learning_items'::regclass),
  'learning_items has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.mcp_audit_log'::regclass),
  'MCP audit log has RLS enabled'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'daily_logs'),
  4,
  'daily_logs has select, insert, update, and delete policies'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'job_applications'),
  4,
  'job_applications has all CRUD policies'
);
select ok(
  not has_table_privilege('authenticated', 'public.integration_accounts', 'select'),
  'browser role cannot read integration accounts'
);
select ok(
  not has_table_privilege('authenticated', 'public.oauth_states', 'select'),
  'browser role cannot read OAuth states'
);
select ok(
  not has_table_privilege('authenticated', 'public.edge_rate_limits', 'select'),
  'browser role cannot inspect rate-limit state'
);
select has_function(
  'public',
  'consume_edge_rate_limit',
  array['uuid', 'text', 'integer', 'integer'],
  'atomic edge rate limiter exists'
);
select has_function(
  'public',
  'search_command',
  array['text', 'integer'],
  'user-scoped MCP search exists'
);
select ok(
  not has_table_privilege('authenticated', 'public.mcp_audit_log', 'insert'),
  'MCP clients cannot forge audit records'
);

set local session_replication_role = replica;
insert into public.profiles (id, email) values
  ('11111111-1111-4111-8111-111111111111', 'one@example.test'),
  ('22222222-2222-4222-8222-222222222222', 'two@example.test');
set local session_replication_role = origin;

insert into public.daily_logs (user_id, day, note) values
  ('11111111-1111-4111-8111-111111111111', '2026-08-24', 'one'),
  ('22222222-2222-4222-8222-222222222222', '2026-08-24', 'two');
insert into public.ideas (user_id, idea) values
  ('11111111-1111-4111-8111-111111111111', 'MCP idea one'),
  ('22222222-2222-4222-8222-222222222222', 'MCP idea two');
insert into public.mcp_audit_log (user_id, client_id, tool_name, success, duration_ms) values
  ('11111111-1111-4111-8111-111111111111', 'client-one', 'command_get_today', true, 1),
  ('22222222-2222-4222-8222-222222222222', 'client-two', 'command_get_today', true, 1);

set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);

select results_eq(
  'select note from public.daily_logs order by note',
  $$ values ('one'::text) $$,
  'a user sees only their own daily logs'
);
select is(
  (select count(*)::integer from public.profiles),
  1,
  'a user sees only their own profile'
);
select results_eq(
  $$ select title from public.search_command('MCP idea', 20) $$,
  $$ values ('MCP idea one'::text) $$,
  'MCP search returns only the authenticated user''s data'
);
select results_eq(
  $$ select client_id from public.mcp_audit_log $$,
  $$ values ('client-one'::text) $$,
  'a user sees only their own MCP audit records'
);
select throws_ok(
  $$ insert into public.daily_logs (user_id, day) values ('22222222-2222-4222-8222-222222222222', '2026-08-25') $$,
  '42501',
  'new row violates row-level security policy for table "daily_logs"',
  'a user cannot insert a log for another user'
);
select results_eq(
  $$ delete from public.daily_logs where user_id = '22222222-2222-4222-8222-222222222222' returning note $$,
  $$ select null::text where false $$,
  'a user cannot delete another user''s log'
);

select * from finish();
rollback;
