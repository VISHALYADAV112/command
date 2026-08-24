-- Command — owner-only signup restriction
-- Google OAuth will happily authenticate anyone; this guard rejects the
-- auth.users insert itself unless the verified email is on the owner list,
-- so no profile/settings rows are ever created for strangers.

create table private.owner_emails (
  email text primary key,
  added_at timestamptz not null default now()
);

revoke all on private.owner_emails from anon, authenticated;
revoke all on all tables in schema private from anon, authenticated;

create or replace function public.restrict_signup_to_owners()
returns trigger language plpgsql security definer set search_path = private, public as $$
begin
  if new.email is null or not exists (
    select 1 from private.owner_emails o where o.email = lower(new.email)
  ) then
    raise exception 'signup is restricted to the owner allow-list';
  end if;
  return new;
end;
$$;

create trigger on_auth_user_before_created
  before insert on auth.users
  for each row execute function public.restrict_signup_to_owners();

insert into private.owner_emails (email)
values ('vishalyadavdev108@gmail.com')
on conflict (email) do nothing;
