-- Supabase OAuth currently provides identity scopes only. Command application
-- permissions therefore live in an owner/client row selected during consent.

create table public.mcp_client_permissions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  client_id text not null check (
    nullif(btrim(client_id), '') is not null
    and client_id = btrim(client_id)
    and char_length(client_id) <= 200
  ),
  can_read_types boolean not null default false,
  can_read_data boolean not null default false,
  can_write_proposals boolean not null default false,
  can_access_people boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, client_id)
);

create trigger mcp_client_permissions_set_updated_at
  before update on public.mcp_client_permissions
  for each row execute function public.set_updated_at();

alter table public.mcp_client_permissions enable row level security;
revoke all on public.mcp_client_permissions from anon, authenticated;
grant select, insert, update, delete on public.mcp_client_permissions to authenticated;
grant all on public.mcp_client_permissions to service_role;

create policy "mcp_client_permissions_select_own"
  on public.mcp_client_permissions for select
  using (user_id = auth.uid());
create policy "mcp_client_permissions_insert_own"
  on public.mcp_client_permissions for insert
  with check (user_id = auth.uid());
create policy "mcp_client_permissions_update_own"
  on public.mcp_client_permissions for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "mcp_client_permissions_delete_own"
  on public.mcp_client_permissions for delete
  using (user_id = auth.uid());
