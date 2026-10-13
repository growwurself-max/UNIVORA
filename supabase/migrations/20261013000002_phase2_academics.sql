-- Univora Phase 2 - Migration 2 of 3
-- Student, Faculty & Academic Management: subjects, courses, faculty, students,
-- classes (sections) and class enrollments, all institution-scoped with RLS.
-- Apply after 20261013000001_phase0_phase1_core.sql. Idempotent; safe to re-run.

begin;

-- ---------------------------------------------------------------------------
-- Same-institution guard. Ensures every institution-scoped foreign key points
-- at a row that belongs to the caller's own institution. Configured per table
-- with (column, referenced_table) pairs passed as trigger arguments.
-- Runs AFTER INSERT/UPDATE so the BEFORE institution trigger has already run.
-- ---------------------------------------------------------------------------
create or replace function public.univora_enforce_same_institution()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row jsonb := to_jsonb(new);
  v_institution uuid := coalesce(new.institution_id, public.current_institution_id());
  i int;
  v_column text;
  v_table text;
  v_ref_text text;
  v_ref_institution uuid;
begin
  if public.is_service_role() or v_institution is null then
    return new;
  end if;

  for i in 0 .. (tg_nargs - 1) by 2 loop
    v_column := tg_argv[i];
    v_table := tg_argv[i + 1];
    v_ref_text := v_row ->> v_column;

    if v_ref_text is not null then
      execute format('select institution_id from public.%I where id = $1', v_table)
        into v_ref_institution
        using v_ref_text::uuid;

      if v_ref_institution is not null and v_ref_institution is distinct from v_institution then
        raise exception 'Referenced % must belong to the same institution', v_table;
      end if;
    end if;
  end loop;

  return new;
end;
$$;

revoke execute on function public.univora_enforce_same_institution()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- subjects
-- ---------------------------------------------------------------------------
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  department_id uuid references public.departments (id) on delete set null,
  name text not null,
  code text,
  credit_hours numeric(4, 1),
  description text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subjects_status_check check (status in ('active', 'inactive')),
  constraint subjects_credit_hours_check check (credit_hours is null or (credit_hours >= 0 and credit_hours <= 60)),
  constraint subjects_institution_code_key unique (institution_id, code)
);

create index if not exists subjects_institution_idx on public.subjects (institution_id);
create index if not exists subjects_department_idx on public.subjects (department_id);

-- ---------------------------------------------------------------------------
-- faculty (may or may not be linked to an auth user profile)
-- ---------------------------------------------------------------------------
create table if not exists public.faculty (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  employee_id text not null,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  department_id uuid references public.departments (id) on delete set null,
  designation text,
  status text not null default 'active',
  hired_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint faculty_status_check check (status in ('active', 'inactive', 'on_leave', 'terminated')),
  constraint faculty_institution_employee_key unique (institution_id, employee_id),
  constraint faculty_profile_key unique (profile_id)
);

create index if not exists faculty_institution_idx on public.faculty (institution_id);
create index if not exists faculty_department_idx on public.faculty (department_id);

-- ---------------------------------------------------------------------------
-- courses
-- ---------------------------------------------------------------------------
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  department_id uuid references public.departments (id) on delete set null,
  subject_id uuid references public.subjects (id) on delete set null,
  name text not null,
  code text,
  credit_hours numeric(4, 1),
  level text,
  description text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint courses_status_check check (status in ('active', 'inactive')),
  constraint courses_credit_hours_check check (credit_hours is null or (credit_hours >= 0 and credit_hours <= 60)),
  constraint courses_institution_code_key unique (institution_id, code)
);

create index if not exists courses_institution_idx on public.courses (institution_id);
create index if not exists courses_department_idx on public.courses (department_id);
create index if not exists courses_subject_idx on public.courses (subject_id);

-- ---------------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------------
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  admission_number text not null,
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  date_of_birth date,
  gender text,
  address text,
  guardian_name text,
  guardian_phone text,
  department_id uuid references public.departments (id) on delete set null,
  status text not null default 'active',
  admission_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint students_status_check check (status in ('active', 'inactive', 'graduated', 'suspended', 'withdrawn')),
  constraint students_gender_check check (gender is null or gender in ('male', 'female', 'other')),
  constraint students_institution_admission_key unique (institution_id, admission_number),
  constraint students_profile_key unique (profile_id)
);

create index if not exists students_institution_idx on public.students (institution_id);
create index if not exists students_department_idx on public.students (department_id);

-- ---------------------------------------------------------------------------
-- classes (sections)
-- ---------------------------------------------------------------------------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  term_id uuid references public.terms (id) on delete set null,
  subject_id uuid references public.subjects (id) on delete set null,
  faculty_id uuid references public.faculty (id) on delete set null,
  name text not null,
  section text,
  room text,
  capacity integer,
  schedule text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint classes_status_check check (status in ('active', 'inactive', 'archived')),
  constraint classes_capacity_check check (capacity is null or capacity > 0)
);

create index if not exists classes_institution_idx on public.classes (institution_id);
create index if not exists classes_course_idx on public.classes (course_id);
create index if not exists classes_term_idx on public.classes (term_id);
create index if not exists classes_faculty_idx on public.classes (faculty_id);

-- A class is unique by (institution, course, term, name); null terms collapse so
-- duplicate "Section A" rows cannot be created for the same course without a term.
create unique index if not exists classes_unique_idx
  on public.classes (
    institution_id,
    course_id,
    coalesce(term_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(name)
  );

-- ---------------------------------------------------------------------------
-- enrollments
-- ---------------------------------------------------------------------------
create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  status text not null default 'enrolled',
  enrolled_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enrollments_status_check check (status in ('enrolled', 'dropped', 'completed')),
  constraint enrollments_class_student_key unique (class_id, student_id)
);

create index if not exists enrollments_institution_idx on public.enrollments (institution_id);
create index if not exists enrollments_class_idx on public.enrollments (class_id);
create index if not exists enrollments_student_idx on public.enrollments (student_id);

-- ---------------------------------------------------------------------------
-- Triggers: force institution on insert + maintain updated_at
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['subjects', 'courses', 'faculty', 'students', 'classes', 'enrollments'] loop
    execute format('drop trigger if exists univora_%s_set_institution on public.%I', t, t);
    execute format(
      'create trigger univora_%s_set_institution before insert on public.%I '
      'for each row execute function public.univora_set_institution_id()', t, t);

    execute format('drop trigger if exists univora_%s_set_updated_at on public.%I', t, t);
    execute format(
      'create trigger univora_%s_set_updated_at before update on public.%I '
      'for each row execute function public.univora_set_updated_at()', t, t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Same-institution guards for every cross-entity reference.
-- ---------------------------------------------------------------------------
drop trigger if exists univora_subjects_same_institution on public.subjects;
create trigger univora_subjects_same_institution
  after insert or update on public.subjects
  for each row execute function public.univora_enforce_same_institution('department_id', 'departments');

drop trigger if exists univora_faculty_same_institution on public.faculty;
create trigger univora_faculty_same_institution
  after insert or update on public.faculty
  for each row execute function public.univora_enforce_same_institution('department_id', 'departments');

drop trigger if exists univora_courses_same_institution on public.courses;
create trigger univora_courses_same_institution
  after insert or update on public.courses
  for each row execute function public.univora_enforce_same_institution(
    'department_id', 'departments',
    'subject_id', 'subjects'
  );

drop trigger if exists univora_students_same_institution on public.students;
create trigger univora_students_same_institution
  after insert or update on public.students
  for each row execute function public.univora_enforce_same_institution('department_id', 'departments');

drop trigger if exists univora_classes_same_institution on public.classes;
create trigger univora_classes_same_institution
  after insert or update on public.classes
  for each row execute function public.univora_enforce_same_institution(
    'course_id', 'courses',
    'term_id', 'terms',
    'subject_id', 'subjects',
    'faculty_id', 'faculty'
  );

drop trigger if exists univora_enrollments_same_institution on public.enrollments;
create trigger univora_enrollments_same_institution
  after insert or update on public.enrollments
  for each row execute function public.univora_enforce_same_institution(
    'class_id', 'classes',
    'student_id', 'students'
  );

-- Also guard terms -> academic_years (defined here since terms predates this file).
drop trigger if exists univora_terms_same_institution on public.terms;
create trigger univora_terms_same_institution
  after insert or update on public.terms
  for each row execute function public.univora_enforce_same_institution('academic_year_id', 'academic_years');

-- ---------------------------------------------------------------------------
-- RLS: members of an institution may read its rows; admins/owners may write;
-- super admins keep platform-wide access.
-- ---------------------------------------------------------------------------
alter table public.subjects enable row level security;
alter table public.courses enable row level security;
alter table public.faculty enable row level security;
alter table public.students enable row level security;
alter table public.classes enable row level security;
alter table public.enrollments enable row level security;

do $$
declare
  t text;
  tables text[] := array['subjects', 'courses', 'faculty', 'students', 'classes', 'enrollments'];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated '
      'using (institution_id = public.current_institution_id() or public.is_super_admin())',
      t || '_select', t);

    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using (public.is_admin() and institution_id = public.current_institution_id()) '
      'with check (public.is_admin() and institution_id = public.current_institution_id())',
      t || '_admin_all', t);

    execute format('drop policy if exists %I on public.%I', t || '_super_admin_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using (public.is_super_admin()) with check (public.is_super_admin())',
      t || '_super_admin_all', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants (RLS remains the real gate)
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.subjects, public.courses,
  public.faculty, public.students, public.classes, public.enrollments to authenticated;

commit;
