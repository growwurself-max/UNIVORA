-- Univora RBAC Migration
-- Step 2: Role-Based Access Control Implementation

begin;

-- Insert canonical roles and remap existing profiles without deleting legacy
-- role rows. This preserves account data and is safe to rerun.
do $$
begin
  insert into public.roles (name, description, rank) values
    ('Super Admin', 'Manage the platform and institutions', 1000),
    ('College Admin', 'Manage operations within their own institution', 80),
    ('Teacher', 'Access assigned classes and permitted academic records', 60),
    ('Accountant', 'Manage fees, payments and authorized financial reports', 40),
    ('Student', 'Read permitted records linked to their account', 20),
    ('Pending', 'Awaiting institution assignment', 0),
    ('Student Records Manager', 'Manage student records within their institution', 40),
    ('Office Staff', 'Perform authorized office responsibilities', 30),
    ('Department Head', 'Manage assigned department responsibilities', 60),
    ('Exam Coordinator', 'Manage assigned examination responsibilities', 60)
  on conflict (name) do update
    set description = excluded.description, rank = excluded.rank;
end;
$$;

with role_map(legacy_name, canonical_name) as (
  values
    ('super_admin', 'Super Admin'),
    ('owner', 'College Admin'),
    ('admin', 'College Admin'),
    ('faculty', 'Teacher'),
    ('staff', 'Accountant'),
    ('student', 'Student'),
    ('pending', 'Pending')
)
update public.profiles p
set role_id = canonical.id
from public.roles legacy
join role_map on role_map.legacy_name = legacy.name
join public.roles canonical on canonical.name = role_map.canonical_name
where p.role_id = legacy.id
  and legacy.id <> canonical.id;

-- 3. Security Helpers Updates
-- We need to update is_admin() and other helpers to use the new role names.

create or replace function public.is_college_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_role_name() = 'College Admin', false);
$$;

create or replace function public.is_teacher()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_role_name() = 'Teacher', false);
$$;

create or replace function public.is_accountant()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_role_name() = 'Accountant', false);
$$;

create or replace function public.is_student()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_role_name() = 'Student', false);
$$;

-- Update is_admin to be an alias for College Admin or Super Admin
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_role_name() in ('College Admin', 'Super Admin'), false);
$$;

-- 4. Refine RLS Policies

-- Finance/Fees: Accountant and College Admin can manage. Student can read own.
-- Payroll: ONLY College Admin and Super Admin.

-- Update student_fees and payments policies
do $$
declare
  t text;
begin
  -- Update select policy for student_fees and payments
  foreach t in array array['student_fees', 'payments'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated '
      'using (institution_id = public.current_institution_id() '
      'and (public.is_college_admin() or public.is_accountant() or public.univora_is_own_student(student_id)) '
      'or public.current_role_name() = ''Super Admin'')',
      t || '_select', t);
  end loop;

  -- Update management policy for student_fees and payments
  foreach t in array array['student_fees', 'payments'] loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using ( (public.is_college_admin() or public.is_accountant()) and institution_id = public.current_institution_id()) '
      'with check ( (public.is_college_admin() or public.is_accountant()) and institution_id = public.current_institution_id())',
      t || '_admin_all', t);
  end loop;
end $$;

-- Payroll: Strict restriction
do $$
declare
  t text;
begin
  foreach t in array array[
    'salary_structures', 'salary_components', 'payroll_runs', 'payroll_records'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using (public.is_college_admin() and institution_id = public.current_institution_id()) '
      'with check (public.is_college_admin() and institution_id = public.current_institution_id())',
      t || '_admin_all', t);
  end loop;
end $$;

commit;
