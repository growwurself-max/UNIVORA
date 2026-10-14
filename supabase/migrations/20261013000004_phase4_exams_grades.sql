-- Univora Phase 4 - Migration 4 of 4
-- Exams, Grades & Results: configurable exam types, exams (class/subject/
-- academic year/term schedules with duplicate protection), per-student marks
-- (with range validation), configurable grading scales + bands, and
-- institution-scoped RLS. Apply after 20261013000003_phase3_attendance_timetable.sql.
-- Idempotent; safe to re-run.

begin;

-- ---------------------------------------------------------------------------
-- Student self-access helper. Lets a student read only their own marks via
-- their linked profile, while staff keep full institution-wide access.
-- ---------------------------------------------------------------------------
create or replace function public.univora_is_own_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.students s
    where s.id = p_student_id
      and s.profile_id = auth.uid()
  );
$$;

revoke execute on function public.univora_is_own_student(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- exam_types: configurable categories (Midterm, Final, Quiz, ...).
-- ---------------------------------------------------------------------------
create table if not exists public.exam_types (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  name text not null,
  code text,
  weight numeric(5, 2),
  status text not null default 'active',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exam_types_status_check check (status in ('active', 'inactive')),
  constraint exam_types_weight_check check (weight is null or (weight >= 0 and weight <= 100)),
  constraint exam_types_institution_name_key unique (institution_id, name)
);

create index if not exists exam_types_institution_idx on public.exam_types (institution_id);

-- ---------------------------------------------------------------------------
-- grading_scales: configurable grading schemes. One default per institution.
-- ---------------------------------------------------------------------------
create table if not exists public.grading_scales (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  name text not null,
  is_default boolean not null default false,
  status text not null default 'active',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grading_scales_status_check check (status in ('active', 'inactive')),
  constraint grading_scales_institution_name_key unique (institution_id, name)
);

create index if not exists grading_scales_institution_idx on public.grading_scales (institution_id);

-- At most one default scale per institution.
create unique index if not exists grading_scales_default_idx
  on public.grading_scales (institution_id)
  where is_default;

-- ---------------------------------------------------------------------------
-- grading_scale_bands: percentage bands that map a score to a grade.
-- A percentage falling in [min_percentage, max_percentage] resolves to a band.
-- ---------------------------------------------------------------------------
create table if not exists public.grading_scale_bands (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  grading_scale_id uuid not null references public.grading_scales (id) on delete cascade,
  grade_label text not null,
  min_percentage numeric(5, 2) not null,
  max_percentage numeric(5, 2) not null,
  grade_point numeric(4, 2),
  is_pass boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint grading_scale_bands_range_check
    check (min_percentage >= 0 and max_percentage <= 100 and min_percentage < max_percentage),
  constraint grading_scale_bands_grade_point_check
    check (grade_point is null or (grade_point >= 0 and grade_point <= 100)),
  constraint grading_scale_bands_scale_label_key unique (grading_scale_id, grade_label)
);

create index if not exists grading_scale_bands_institution_idx
  on public.grading_scale_bands (institution_id);
create index if not exists grading_scale_bands_scale_idx
  on public.grading_scale_bands (grading_scale_id);

-- ---------------------------------------------------------------------------
-- exams: a scheduled assessment for a class/subject in an academic year.
-- ---------------------------------------------------------------------------
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  exam_type_id uuid not null references public.exam_types (id) on delete restrict,
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  term_id uuid references public.terms (id) on delete set null,
  class_id uuid not null references public.classes (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  name text not null,
  exam_date date,
  start_time time,
  end_time time,
  max_marks numeric(6, 2) not null default 100,
  pass_marks numeric(6, 2),
  status text not null default 'scheduled',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exams_status_check check (status in ('scheduled', 'ongoing', 'completed', 'cancelled')),
  constraint exams_max_marks_check check (max_marks > 0),
  constraint exams_pass_marks_check check (pass_marks is null or (pass_marks >= 0 and pass_marks <= max_marks)),
  constraint exams_time_check check (end_time is null or start_time is null or end_time > start_time)
);

create index if not exists exams_institution_idx on public.exams (institution_id);
create index if not exists exams_exam_type_idx on public.exams (exam_type_id);
create index if not exists exams_academic_year_idx on public.exams (academic_year_id);
create index if not exists exams_term_idx on public.exams (term_id);
create index if not exists exams_class_idx on public.exams (class_id);
create index if not exists exams_subject_idx on public.exams (subject_id);
create index if not exists exams_date_idx on public.exams (institution_id, exam_date);

-- Duplicate protection: an institution cannot hold two exams with the same
-- type/name for the same class/subject/year/term. Nullable columns collapse so
-- duplicates are still blocked when they are omitted.
create unique index if not exists exams_unique_idx
  on public.exams (
    institution_id,
    class_id,
    exam_type_id,
    academic_year_id,
    coalesce(subject_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(term_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(name)
  );

-- ---------------------------------------------------------------------------
-- exam_marks: one score per student per exam.
-- ---------------------------------------------------------------------------
create table if not exists public.exam_marks (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  exam_id uuid not null references public.exams (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  marks_obtained numeric(6, 2),
  is_absent boolean not null default false,
  remarks text,
  graded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exam_marks_marks_check check (marks_obtained is null or marks_obtained >= 0),
  constraint exam_marks_exam_student_key unique (exam_id, student_id)
);

create index if not exists exam_marks_institution_idx on public.exam_marks (institution_id);
create index if not exists exam_marks_exam_idx on public.exam_marks (exam_id);
create index if not exists exam_marks_student_idx on public.exam_marks (student_id);

-- ---------------------------------------------------------------------------
-- Marks range guard: a score may never exceed the exam's maximum. Also forces
-- absent students to carry no score so they cannot inflate results.
-- ---------------------------------------------------------------------------
create or replace function public.univora_validate_exam_mark()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_max numeric;
begin
  if new.marks_obtained is null then
    return new;
  end if;

  select max_marks into v_max from public.exams where id = new.exam_id;

  if v_max is not null and new.marks_obtained > v_max then
    raise exception 'Marks obtained cannot exceed the exam maximum'
      using
        errcode = '23514',
        detail = format('Maximum marks for this exam is %s.', v_max);
  end if;

  return new;
end;
$$;

revoke execute on function public.univora_validate_exam_mark() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Triggers: force institution on insert + maintain updated_at
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'exam_types', 'grading_scales', 'grading_scale_bands', 'exams', 'exam_marks'
  ] loop
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
drop trigger if exists univora_grading_scale_bands_same_institution on public.grading_scale_bands;
create trigger univora_grading_scale_bands_same_institution
  after insert or update on public.grading_scale_bands
  for each row execute function public.univora_enforce_same_institution(
    'grading_scale_id', 'grading_scales'
  );

drop trigger if exists univora_exams_same_institution on public.exams;
create trigger univora_exams_same_institution
  after insert or update on public.exams
  for each row execute function public.univora_enforce_same_institution(
    'exam_type_id', 'exam_types',
    'academic_year_id', 'academic_years',
    'term_id', 'terms',
    'class_id', 'classes',
    'subject_id', 'subjects'
  );

drop trigger if exists univora_exam_marks_same_institution on public.exam_marks;
create trigger univora_exam_marks_same_institution
  after insert or update on public.exam_marks
  for each row execute function public.univora_enforce_same_institution(
    'exam_id', 'exams',
    'student_id', 'students'
  );

drop trigger if exists univora_exam_marks_validate on public.exam_marks;
create trigger univora_exam_marks_validate
  before insert or update on public.exam_marks
  for each row execute function public.univora_validate_exam_mark();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.exam_types enable row level security;
alter table public.grading_scales enable row level security;
alter table public.grading_scale_bands enable row level security;
alter table public.exams enable row level security;
alter table public.exam_marks enable row level security;

do $$
declare
  t text;
begin
  -- Exam types + grading configuration: members read, admins manage.
  foreach t in array array['exam_types', 'grading_scales', 'grading_scale_bands'] loop
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

  -- Exams: members read; staff (faculty and above) create and manage.
  execute format('drop policy if exists exams_select on public.exams');
  execute format(
    'create policy exams_select on public.exams for select to authenticated '
    'using (institution_id = public.current_institution_id() or public.is_super_admin())');

  execute format('drop policy if exists exams_staff_all on public.exams');
  execute format(
    'create policy exams_staff_all on public.exams for all to authenticated '
    'using (public.is_staff() and institution_id = public.current_institution_id()) '
    'with check (public.is_staff() and institution_id = public.current_institution_id())');

  execute format('drop policy if exists exams_super_admin_all on public.exams');
  execute format(
    'create policy exams_super_admin_all on public.exams for all to authenticated '
    'using (public.is_super_admin()) with check (public.is_super_admin())');

  -- Marks: staff read/write; a student may read only their own marks.
  execute format('drop policy if exists exam_marks_select on public.exam_marks');
  execute format(
    'create policy exam_marks_select on public.exam_marks for select to authenticated '
    'using (institution_id = public.current_institution_id() '
    'and (public.is_staff() or public.univora_is_own_student(student_id)) '
    'or public.is_super_admin())');

  execute format('drop policy if exists exam_marks_staff_all on public.exam_marks');
  execute format(
    'create policy exam_marks_staff_all on public.exam_marks for all to authenticated '
    'using (public.is_staff() and institution_id = public.current_institution_id()) '
    'with check (public.is_staff() and institution_id = public.current_institution_id())');

  execute format('drop policy if exists exam_marks_super_admin_all on public.exam_marks');
  execute format(
    'create policy exam_marks_super_admin_all on public.exam_marks for all to authenticated '
    'using (public.is_super_admin()) with check (public.is_super_admin())');
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants (RLS remains the real gate).
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.exam_types to authenticated;
grant select, insert, update, delete on public.grading_scales to authenticated;
grant select, insert, update, delete on public.grading_scale_bands to authenticated;
grant select, insert, update, delete on public.exams to authenticated;
grant select, insert, update, delete on public.exam_marks to authenticated;

commit;
