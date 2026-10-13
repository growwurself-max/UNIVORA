-- Univora Phase 0 + Phase 1 - Migration 1 of 3
-- Core: institutions, roles, updated_at helper, profiles + security helpers +
-- triggers + RLS, academic core (academic_years, departments, terms),
-- super_admin role, institution status/plan fields, audit_logs, and the
-- platform-wide RLS granted to super admins.
-- Apply in order: 1 -> 2 -> 3. Idempotent; safe to re-run.

begin;

-- ===========================================================================
-- Part 1/4: Foundation - institutions, roles, updated_at helper
-- ===========================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.univora_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Trigger functions are invoked by the engine; no direct EXECUTE needed by app roles.
revoke execute on function public.univora_set_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- institutions
-- ---------------------------------------------------------------------------
create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  domain text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists univora_institutions_set_updated_at on public.institutions;
create trigger univora_institutions_set_updated_at
  before update on public.institutions
  for each row execute function public.univora_set_updated_at();

-- ---------------------------------------------------------------------------
-- roles (system lookup, ranked so privilege escalation can be prevented)
-- ---------------------------------------------------------------------------
create table if not exists public.roles (
  id smallint generated always as identity primary key,
  name text not null unique,
  description text,
  rank smallint not null default 0,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.roles (name, description, rank) values
  ('owner',   'Institution owner with full control', 100),
  ('admin',   'Institution administrator',            80),
  ('faculty', 'Faculty member',                       60),
  ('staff',   'Administrative staff',                 40),
  ('student', 'Student',                              20),
  ('pending', 'Awaiting institution assignment',       0)
on conflict (name) do nothing;

-- ===========================================================================
-- Part 2/4: profiles + security helpers + triggers + RLS
-- ===========================================================================

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
       and public.current_role_name() not in ('owner', 'super_admin') then
      raise exception 'Only an owner or super admin can assign the owner role';
    end if;
    if v_target_rank > public.current_role_rank() then
      raise exception 'Cannot assign a role higher than your own';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- NOTE: the definition above already incorporates the Phase 1 change that lets
-- super admins assign the owner role. Part 4 below re-asserts it idempotently.
-- ---------------------------------------------------------------------------
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

-- ===========================================================================
-- Part 3/4: Academic core - academic_years, departments, terms + RLS
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Force a row into the caller's own institution on INSERT.
-- Client-supplied institution IDs are never trusted for non-service writes.
-- ---------------------------------------------------------------------------
create or replace function public.univora_set_institution_id()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_service_role() then
    new.institution_id := public.current_institution_id();
  end if;
  return new;
end;
$$;

-- Trigger functions are invoked by the engine; no direct EXECUTE needed by app roles.
revoke execute on function public.univora_set_institution_id() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- academic_years
-- ---------------------------------------------------------------------------
create table if not exists public.academic_years (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint academic_years_institution_name_key unique (institution_id, name),
  constraint academic_years_dates_valid check (end_date > start_date)
);

drop trigger if exists univora_academic_years_set_institution on public.academic_years;
create trigger univora_academic_years_set_institution
  before insert on public.academic_years
  for each row execute function public.univora_set_institution_id();

drop trigger if exists univora_academic_years_set_updated_at on public.academic_years;
create trigger univora_academic_years_set_updated_at
  before update on public.academic_years
  for each row execute function public.univora_set_updated_at();

create index if not exists academic_years_institution_idx on public.academic_years (institution_id);

-- ---------------------------------------------------------------------------
-- departments
-- ---------------------------------------------------------------------------
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  name text not null,
  code text,
  head_profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint departments_institution_code_key unique (institution_id, code)
);

drop trigger if exists univora_departments_set_institution on public.departments;
create trigger univora_departments_set_institution
  before insert on public.departments
  for each row execute function public.univora_set_institution_id();

drop trigger if exists univora_departments_set_updated_at on public.departments;
create trigger univora_departments_set_updated_at
  before update on public.departments
  for each row execute function public.univora_set_updated_at();

create index if not exists departments_institution_idx on public.departments (institution_id);
create index if not exists departments_head_idx on public.departments (head_profile_id);

-- ---------------------------------------------------------------------------
-- terms
-- ---------------------------------------------------------------------------
create table if not exists public.terms (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  name text not null,
  term_number smallint not null check (term_number > 0),
  start_date date,
  end_date date,
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint terms_academic_year_number_key unique (academic_year_id, term_number),
  constraint terms_dates_valid check (end_date is null or start_date is null or end_date > start_date)
);

drop trigger if exists univora_terms_set_institution on public.terms;
create trigger univora_terms_set_institution
  before insert on public.terms
  for each row execute function public.univora_set_institution_id();

drop trigger if exists univora_terms_set_updated_at on public.terms;
create trigger univora_terms_set_updated_at
  before update on public.terms
  for each row execute function public.univora_set_updated_at();

create index if not exists terms_institution_idx on public.terms (institution_id);
create index if not exists terms_academic_year_idx on public.terms (academic_year_id);

-- ---------------------------------------------------------------------------
-- RLS: each row is only visible/editable within the caller's own institution.
-- ---------------------------------------------------------------------------
alter table public.academic_years enable row level security;
alter table public.departments enable row level security;
alter table public.terms enable row level security;

-- academic_years
drop policy if exists academic_years_select on public.academic_years;
create policy academic_years_select on public.academic_years
  for select to authenticated
  using (institution_id = public.current_institution_id());

drop policy if exists academic_years_admin_all on public.academic_years;
create policy academic_years_admin_all on public.academic_years
  for all to authenticated
  using (public.is_admin() and institution_id = public.current_institution_id())
  with check (public.is_admin() and institution_id = public.current_institution_id());

-- departments
drop policy if exists departments_select on public.departments;
create policy departments_select on public.departments
  for select to authenticated
  using (institution_id = public.current_institution_id());

drop policy if exists departments_admin_all on public.departments;
create policy departments_admin_all on public.departments
  for all to authenticated
  using (public.is_admin() and institution_id = public.current_institution_id())
  with check (public.is_admin() and institution_id = public.current_institution_id());

-- terms
drop policy if exists terms_select on public.terms;
create policy terms_select on public.terms
  for select to authenticated
  using (institution_id = public.current_institution_id());

drop policy if exists terms_admin_all on public.terms;
create policy terms_admin_all on public.terms
  for all to authenticated
  using (public.is_admin() and institution_id = public.current_institution_id())
  with check (
    public.is_admin()
    and institution_id = public.current_institution_id()
    and exists (
      select 1
      from public.academic_years ay
      where ay.id = academic_year_id
        and ay.institution_id = institution_id
    )
  );

-- ===========================================================================
-- Part 4/4: Super Admin & Institution Management
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- super_admin role (platform-level, ranks above institution owner)
-- ---------------------------------------------------------------------------
insert into public.roles (name, description, rank) values
  ('super_admin', 'Platform super administrator', 1000)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- is_super_admin helper (used by RLS policies and triggers)
-- ---------------------------------------------------------------------------
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_role_name() = 'super_admin';
$$;

-- ---------------------------------------------------------------------------
-- Institution status / subscription fields
-- ---------------------------------------------------------------------------
alter table public.institutions
  add column if not exists status text,
  add column if not exists subscription_plan text,
  add column if not exists suspended_at timestamptz,
  add column if not exists activated_at timestamptz,
  add column if not exists subscription_expires_at date;

-- Backfill existing rows (idempotent).
update public.institutions
  set status = case when is_active then 'active' else 'suspended' end
  where status is null;

update public.institutions
  set subscription_plan = 'free'
  where subscription_plan is null;

alter table public.institutions
  alter column status set not null,
  alter column subscription_plan set not null,
  alter column status set default 'active',
  alter column subscription_plan set default 'free';

-- Enforce allowed values and keep is_active consistent with status.
alter table public.institutions drop constraint if exists institutions_status_check;
alter table public.institutions add constraint institutions_status_check
  check (status in ('active', 'suspended'));

alter table public.institutions drop constraint if exists institutions_plan_check;
alter table public.institutions add constraint institutions_plan_check
  check (subscription_plan in ('free', 'basic', 'pro', 'enterprise'));

alter table public.institutions drop constraint if exists institutions_is_active_check;
alter table public.institutions add constraint institutions_is_active_check
  check (is_active = (status = 'active'));

-- Keep is_active and status timestamps in sync regardless of the write path.
create or replace function public.univora_institutions_normalize_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status is null then
    new.status := 'active';
  end if;
  new.status := lower(new.status);
  new.is_active := (new.status = 'active');

  if new.status = 'active' then
    new.suspended_at := null;
    if new.activated_at is null then
      new.activated_at := now();
    end if;
  elsif new.status = 'suspended' then
    if tg_op = 'UPDATE' and old.suspended_at is not null then
      new.suspended_at := old.suspended_at;
    else
      new.suspended_at := coalesce(new.suspended_at, now());
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists univora_institutions_normalize_status on public.institutions;
create trigger univora_institutions_normalize_status
  before insert or update on public.institutions
  for each row execute function public.univora_institutions_normalize_status();

-- Only super admins may manage status/plan. Owners may edit their institution
-- profile (name/slug/domain) but never billing/status fields.
create or replace function public.enforce_institution_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_super_admin() then
    return new;
  end if;

  if new.status is distinct from old.status
     or new.subscription_plan is distinct from old.subscription_plan
     or new.is_active is distinct from old.is_active
     or new.subscription_expires_at is distinct from old.subscription_expires_at
     or new.suspended_at is distinct from old.suspended_at
     or new.activated_at is distinct from old.activated_at then
    raise exception 'Only platform super administrators can manage status or subscription fields';
  end if;

  return new;
end;
$$;

drop trigger if exists univora_institutions_enforce_admin_fields on public.institutions;
create trigger univora_institutions_enforce_admin_fields
  before update on public.institutions
  for each row execute function public.enforce_institution_admin_fields();

revoke execute on function public.univora_institutions_normalize_status()
  from public, anon, authenticated;
revoke execute on function public.enforce_institution_admin_fields()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Update the profile escalation guard so super admins may assign owner and
-- super_admin roles (rank 1000 is above every other role; only a super admin
-- can grant super_admin, and owners can still grant owner).
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
       and public.current_role_name() not in ('owner', 'super_admin') then
      raise exception 'Only an owner or super admin can assign the owner role';
    end if;
    if v_target_rank > public.current_role_rank() then
      raise exception 'Cannot assign a role higher than your own';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- audit_logs (administrative actions; written via service role only)
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete cascade,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  metadata jsonb,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_entity_idx
  on public.audit_logs (entity_type, entity_id, created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id);

alter table public.audit_logs enable row level security;

-- Users may view their own actions; super admins may view everything.
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs
  for select to authenticated
  using (actor_id = auth.uid() or public.is_super_admin());

-- ---------------------------------------------------------------------------
-- Platform-wide RLS for super admins (institutions, profiles, academics).
-- ---------------------------------------------------------------------------
-- institutions
drop policy if exists institutions_select_super_admin on public.institutions;
create policy institutions_select_super_admin on public.institutions
  for select to authenticated
  using (public.is_super_admin());

drop policy if exists institutions_insert_super_admin on public.institutions;
create policy institutions_insert_super_admin on public.institutions
  for insert to authenticated
  with check (public.is_super_admin());

drop policy if exists institutions_update_super_admin on public.institutions;
create policy institutions_update_super_admin on public.institutions
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- profiles
drop policy if exists profiles_select_super_admin on public.profiles;
create policy profiles_select_super_admin on public.profiles
  for select to authenticated
  using (public.is_super_admin());

drop policy if exists profiles_update_super_admin on public.profiles;
create policy profiles_update_super_admin on public.profiles
  for update to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Read-only platform-wide statistics for academics (no writes at this tier).
drop policy if exists academic_years_select_super_admin on public.academic_years;
create policy academic_years_select_super_admin on public.academic_years
  for select to authenticated
  using (public.is_super_admin());

drop policy if exists departments_select_super_admin on public.departments;
create policy departments_select_super_admin on public.departments
  for select to authenticated
  using (public.is_super_admin());

drop policy if exists terms_select_super_admin on public.terms;
create policy terms_select_super_admin on public.terms
  for select to authenticated
  using (public.is_super_admin());

-- ---------------------------------------------------------------------------
-- Grants
-- RLS remains the real gate; explicit grants keep the contract clear.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on public.roles to authenticated, anon;
grant select on public.institutions to authenticated;
grant select, insert, update on public.institutions to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.audit_logs to authenticated;
grant select, insert, update, delete on public.academic_years, public.departments, public.terms to authenticated;

commit;
