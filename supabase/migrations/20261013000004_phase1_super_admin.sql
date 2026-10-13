-- Univora Phase 1 - Migration 4 of 4
-- Super Admin & Institution Management: super_admin role, institution status/plan
-- fields, audit log, platform-wide RLS for super admins, and tenant guards.
-- Apply after 20261013000003_phase0_academics.sql. Idempotent; safe to re-run.

begin;

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

-- No INSERT/UPDATE/DELETE policies: audit entries are created by the backend
-- service (which bypasses RLS) and are immutable.

-- ---------------------------------------------------------------------------
-- RLS: super admins get platform-wide access. Everything else stays isolated
-- to the caller's own institution.
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
-- Grants for super-admin (and institution owner) writes through the API
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update on public.institutions to authenticated;
grant select on public.profiles to authenticated;
grant select on public.audit_logs to authenticated;

commit;