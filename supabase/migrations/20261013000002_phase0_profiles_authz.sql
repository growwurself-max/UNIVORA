-- Univora Phase 0 - Migration 2 of 3
-- profiles + security helpers + triggers + RLS.
-- Apply after 20261013000001_phase0_foundation.sql. Idempotent; safe to re-run.

begin;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  institution_id uuid references public.institutions (id) on delete set null,
  role_id smallint not null references public.roles (id),
  full_name text,
  email text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists univora_profiles_set_updated_at on public.profiles;
create trigger univora_profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.univora_set_updated_at();

create index if not exists profiles_institution_idx on public.profiles (institution_id);
create index if not exists profiles_role_idx on public.profiles (role_id);

-- ---------------------------------------------------------------------------
-- Security helpers (SECURITY DEFINER so policies do not recurse into profiles)
-- ---------------------------------------------------------------------------

-- True when the request is the service role or a direct (non-API) SQL session.
-- Client (anon/authenticated) JWTs always carry an explicit role claim.
create or replace function public.is_service_role()
returns boolean
language sql
stable
as $$
  select current_setting('request.jwt.claims', true) is null
    or current_setting('request.jwt.claims', true)::jsonb ->> 'role' = 'service_role'
    or current_setting('request.jwt.claim.role', true) = 'service_role';
$$;

create or replace function public.current_institution_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select institution_id
  from public.profiles
  where id = auth.uid();
$$;

create or replace function public.current_role_name()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.name
  from public.profiles p
  join public.roles r on r.id = p.role_id
  where p.id = auth.uid();
$$;

create or replace function public.current_role_rank()
returns smallint
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.rank
  from public.profiles p
  join public.roles r on r.id = p.role_id
  where p.id = auth.uid();
$$;

-- admins and owners (rank >= 80) can administer their institution
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_role_rank() >= 80, false);
$$;

-- ---------------------------------------------------------------------------
-- Auto-create a profile when a Supabase auth user is created.
-- Never trusts client-supplied role/institution: only raw_app_meta_data
-- (server-controlled) feeds the demo flag; name is copied for convenience.
-- ---------------------------------------------------------------------------
create or replace function public.univora_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pending smallint;
  v_is_demo boolean;
begin
  select id into v_pending from public.roles where name = 'pending';
  if v_pending is null then
    select id into v_pending from public.roles order by rank asc limit 1;
  end if;

  v_is_demo := coalesce((new.raw_app_meta_data ->> 'is_demo')::boolean, false);

  insert into public.profiles (id, institution_id, role_id, full_name, email, is_demo)
  values (
    new.id,
    null,
    v_pending,
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    new.email,
    v_is_demo
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists univora_on_auth_user_created on auth.users;
create trigger univora_on_auth_user_created
  after insert on auth.users
  for each row execute function public.univora_handle_new_user();

-- Trigger functions are invoked by the engine; no direct EXECUTE needed by app roles.
revoke execute on function public.univora_handle_new_user() from public, anon, authenticated;
revoke execute on function public.enforce_profile_privileges() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Privilege escalation guard.
-- Only the service role may assign privileged fields on INSERT.
-- On UPDATE, only administrators may change role/institution/demo status, and
-- no one may raise a role above their own or grant the owner role.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pending smallint;
  v_target_rank smallint;
begin
  if public.is_service_role() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    select id into v_pending from public.roles where name = 'pending';
    if v_pending is null then
      select id into v_pending from public.roles order by rank asc limit 1;
    end if;
    -- Force safe defaults; ignore anything the client tried to set.
    new.role_id := coalesce(v_pending, new.role_id);
    new.institution_id := null;
    new.is_demo := false;
    return new;
  end if;

  -- UPDATE: privileged fields are locked down
  if new.role_id is distinct from old.role_id
     or new.institution_id is distinct from old.institution_id
     or new.is_demo is distinct from old.is_demo then
    if not public.is_admin() then
      raise exception 'Only administrators can change role, institution, or demo status';
    end if;
    if new.is_demo is distinct from old.is_demo then
      raise exception 'Demo status can only be changed by the service';
    end if;
  end if;

  if new.role_id is distinct from old.role_id then
    select rank into v_target_rank from public.roles where id = new.role_id;
    if v_target_rank is null then
      raise exception 'Unknown role';
    end if;
    if (select name from public.roles where id = new.role_id) = 'owner'
       and public.current_role_name() <> 'owner' then
      raise exception 'Only an owner can assign the owner role';
    end if;
    if v_target_rank > public.current_role_rank() then
      raise exception 'Cannot assign a role higher than your own';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_enforce_privileges on public.profiles;
create trigger profiles_enforce_privileges
  before insert or update on public.profiles
  for each row execute function public.enforce_profile_privileges();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.institutions enable row level security;
alter table public.roles enable row level security;
alter table public.profiles enable row level security;

drop policy if exists institutions_select_member on public.institutions;
create policy institutions_select_member on public.institutions
  for select to authenticated
  using (id = public.current_institution_id());

drop policy if exists institutions_update_owner on public.institutions;
create policy institutions_update_owner on public.institutions
  for update to authenticated
  using (public.current_role_name() = 'owner' and id = public.current_institution_id())
  with check (id = public.current_institution_id());

drop policy if exists roles_select_authenticated on public.roles;
create policy roles_select_authenticated on public.roles
  for select to authenticated
  using (true);

drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select to authenticated
  using (id = auth.uid());

drop policy if exists profiles_select_institution_admin on public.profiles;
create policy profiles_select_institution_admin on public.profiles
  for select to authenticated
  using (
    public.is_admin()
    and institution_id is not null
    and institution_id = public.current_institution_id()
  );

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_update_institution_admin on public.profiles;
create policy profiles_update_institution_admin on public.profiles
  for update to authenticated
  using (public.is_admin() and institution_id = public.current_institution_id())
  with check (public.is_admin() and institution_id = public.current_institution_id());

-- No INSERT/DELETE policies: profiles are created automatically by the
-- auth-user trigger and destroyed when the auth user is deleted. Service role
-- bypasses RLS and may manage them directly.

-- Backfill profiles for auth users created before this migration.
insert into public.profiles (id, role_id, full_name, email)
select
  u.id,
  coalesce((select id from public.roles where name = 'pending'),
           (select id from public.roles order by rank asc limit 1)),
  nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
  u.email
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Grants (RLS remains the real gate; explicit grants keep the contract clear)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on public.roles to authenticated, anon;
grant select on public.institutions to authenticated;
grant select, update on public.profiles to authenticated;

commit;