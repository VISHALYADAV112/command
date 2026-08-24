-- Command — relocate private integration tables to public
-- Hosted PostgREST would not reliably expose the custom "private" schema,
-- so the tables move to public behind equivalent hardening:
--   * all privileges revoked from anon/authenticated
--   * row level security enabled with NO policies (deny by default)
-- Only the service role (edge functions) retains access.

alter table private.integration_accounts set schema public;
alter table private.integration_links set schema public;
alter table private.oauth_states set schema public;
alter table private.owner_emails set schema public;

alter table public.integration_accounts enable row level security;
alter table public.integration_links enable row level security;
alter table public.oauth_states enable row level security;
alter table public.owner_emails enable row level security;

revoke all on public.integration_accounts from anon, authenticated;
revoke all on public.integration_links from anon, authenticated;
revoke all on public.oauth_states from anon, authenticated;
revoke all on public.owner_emails from anon, authenticated;

grant all on public.integration_accounts to service_role;
grant all on public.integration_links to service_role;
grant all on public.oauth_states to service_role;
grant all on public.owner_emails to service_role;

-- The signup guard read the allow-list via search_path = private, public;
-- repoint it now that owner_emails lives in public.
create or replace function public.restrict_signup_to_owners()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is null or not exists (
    select 1 from public.owner_emails o where o.email = lower(new.email)
  ) then
    raise exception 'signup is restricted to the owner allow-list';
  end if;
  return new;
end;
$$;
