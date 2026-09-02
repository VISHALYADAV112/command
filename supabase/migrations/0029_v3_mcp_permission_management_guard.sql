-- OAuth access tokens use the authenticated role. They may read the exact
-- permission row enforced by Command MCP, but only a first-party browser
-- session (which has no OAuth client_id claim) may manage grants.

drop policy "mcp_client_permissions_select_own" on public.mcp_client_permissions;
drop policy "mcp_client_permissions_insert_own" on public.mcp_client_permissions;
drop policy "mcp_client_permissions_update_own" on public.mcp_client_permissions;
drop policy "mcp_client_permissions_delete_own" on public.mcp_client_permissions;

create policy "mcp_client_permissions_select_own"
  on public.mcp_client_permissions for select
  using (
    user_id = auth.uid()
    and (
      auth.jwt() ->> 'client_id' is null
      or client_id = auth.jwt() ->> 'client_id'
    )
  );
create policy "mcp_client_permissions_insert_first_party"
  on public.mcp_client_permissions for insert
  with check (
    user_id = auth.uid()
    and auth.jwt() ->> 'client_id' is null
  );
create policy "mcp_client_permissions_update_first_party"
  on public.mcp_client_permissions for update
  using (
    user_id = auth.uid()
    and auth.jwt() ->> 'client_id' is null
  )
  with check (
    user_id = auth.uid()
    and auth.jwt() ->> 'client_id' is null
  );
create policy "mcp_client_permissions_delete_first_party"
  on public.mcp_client_permissions for delete
  using (
    user_id = auth.uid()
    and auth.jwt() ->> 'client_id' is null
  );
