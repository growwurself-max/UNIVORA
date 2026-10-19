-- Univora Staff Management Phase 3: Role-Specific Access Control
-- Purpose: Implement granular RLS policies based on staff_assignments.
-- This migration implements horizontal restriction (assigned entity only).

begin;

create table if not exists public.staff_assignments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  assignment_type text not null
    check (assignment_type in ('department', 'class', 'subject', 'general')),
  assignment_id uuid,
  created_at timestamptz not null default now(),
  constraint staff_assignments_entity_check check (
    (assignment_type = 'general' and assignment_id is null)
    or (assignment_type <> 'general' and assignment_id is not null)
  )
);

create unique index if not exists staff_assignments_entity_unique_idx
  on public.staff_assignments (profile_id, assignment_type, assignment_id)
  where assignment_id is not null;
create unique index if not exists staff_assignments_general_unique_idx
  on public.staff_assignments (profile_id)
  where assignment_type = 'general';
create index if not exists staff_assignments_institution_idx
  on public.staff_assignments (institution_id);

create or replace function public.univora_validate_staff_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_institution uuid;
  v_entity_institution uuid;
  v_table text;
begin
  select institution_id into v_profile_institution
  from public.profiles
  where id = new.profile_id;

  if v_profile_institution is distinct from new.institution_id then
    raise exception 'Staff member must belong to the assigned institution';
  end if;

  if new.assignment_type = 'general' then
    return new;
  end if;

  v_table := case new.assignment_type
    when 'department' then 'departments'
    when 'class' then 'classes'
    when 'subject' then 'subjects'
  end;

  execute format('select institution_id from public.%I where id = $1', v_table)
    into v_entity_institution
    using new.assignment_id;

  if v_entity_institution is distinct from new.institution_id then
    raise exception 'Assigned entity must belong to the same institution';
  end if;

  return new;
end;
$$;

drop trigger if exists univora_staff_assignments_validate on public.staff_assignments;
create trigger univora_staff_assignments_validate
  before insert or update on public.staff_assignments
  for each row execute function public.univora_validate_staff_assignment();
revoke execute on function public.univora_validate_staff_assignment()
  from public, anon, authenticated;

alter table public.staff_assignments enable row level security;
drop policy if exists staff_assignments_select on public.staff_assignments;
create policy staff_assignments_select on public.staff_assignments
  for select to authenticated
  using (
    profile_id = auth.uid()
    or (public.is_admin() and institution_id = public.current_institution_id())
    or public.is_super_admin()
  );
drop policy if exists staff_assignments_admin_all on public.staff_assignments;
create policy staff_assignments_admin_all on public.staff_assignments
  for all to authenticated
  using (
    (public.is_admin() and institution_id = public.current_institution_id())
    or public.is_super_admin()
  )
  with check (
    (public.is_admin() and institution_id = public.current_institution_id())
    or public.is_super_admin()
  );
grant select, insert, update, delete on public.staff_assignments to authenticated;

-- Helper for policies that expose only explicitly assigned responsibilities.
create or replace function public.has_staff_assignment(v_entity_id uuid, v_type text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return exists (
    select 1 from public.staff_assignments
    where profile_id = auth.uid()
      and institution_id = public.current_institution_id()
      and assignment_type = v_type
      and assignment_id = v_entity_id
  );
end;
$$;
revoke execute on function public.has_staff_assignment(uuid, text) from public, anon;
grant execute on function public.has_staff_assignment(uuid, text) to authenticated;

-- Keep write operations administrative. Assignment-scoped reads are applied
-- in the following migration without granting assigned staff delete access.
drop policy if exists departments_admin_all on public.departments;
create policy departments_admin_all on public.departments
  for all to authenticated
  using (
    (public.is_admin() and institution_id = public.current_institution_id())
    or public.is_super_admin()
  )
  with check (
    (public.is_admin() and institution_id = public.current_institution_id())
    or public.is_super_admin()
  );

drop policy if exists classes_admin_all on public.classes;
create policy classes_admin_all on public.classes
  for all to authenticated
  using (
    (public.is_admin() and institution_id = public.current_institution_id())
    or public.is_super_admin()
  )
  with check (
    (public.is_admin() and institution_id = public.current_institution_id())
    or public.is_super_admin()
  );

drop policy if exists subjects_admin_all on public.subjects;
create policy subjects_admin_all on public.subjects
  for all to authenticated
  using (
    (public.is_admin() and institution_id = public.current_institution_id())
    or public.is_super_admin()
  )
  with check (
    (public.is_admin() and institution_id = public.current_institution_id())
    or public.is_super_admin()
  );

-- Student records managers are authorized on student rows, not on auth
-- profiles; keep privileged account/profile changes limited to administrators.
drop policy if exists profiles_update_institution_admin on public.profiles;
create policy profiles_update_institution_admin on public.profiles
  for update to authenticated
  using (public.is_admin() and institution_id = public.current_institution_id())
  with check (public.is_admin() and institution_id = public.current_institution_id());

commit;
