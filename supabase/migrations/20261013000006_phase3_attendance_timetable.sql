-- Univora Phase 3 - Migration 6
-- Attendance & Timetable: per-institution timetable entries (with conflict
-- detection), attendance sessions + per-student records, and configurable
-- low-attendance alerting. All institution-scoped with RLS.
-- Apply after 20261013000005_phase2_academics.sql. Idempotent; safe to re-run.

begin;

-- ---------------------------------------------------------------------------
-- Staff helper (faculty and above). Used by attendance RLS so faculty members
-- can mark attendance without being institution administrators.
-- ---------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_role_rank() >= 60, false);
$$;

revoke execute on function public.is_staff() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- timetable_entries: one scheduled slot for a class.
-- day_of_week follows ISO-8601 (1 = Monday .. 7 = Sunday).
-- ---------------------------------------------------------------------------
create table if not exists public.timetable_entries (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  subject_id uuid references public.subjects (id) on delete set null,
  faculty_id uuid references public.faculty (id) on delete set null,
  term_id uuid references public.terms (id) on delete set null,
  room text,
  day_of_week smallint not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timetable_entries_day_check check (day_of_week between 1 and 7),
  constraint timetable_entries_time_check check (end_time > start_time),
  constraint timetable_entries_status_check check (status in ('active', 'inactive')),
  constraint timetable_entries_slot_key unique (institution_id, class_id, day_of_week, start_time, end_time)
);

create index if not exists timetable_entries_institution_idx on public.timetable_entries (institution_id);
create index if not exists timetable_entries_class_idx on public.timetable_entries (class_id);
create index if not exists timetable_entries_faculty_idx on public.timetable_entries (faculty_id);
create index if not exists timetable_entries_term_idx on public.timetable_entries (term_id);
create index if not exists timetable_entries_day_idx on public.timetable_entries (institution_id, day_of_week, start_time);

-- ---------------------------------------------------------------------------
-- attendance_sessions: a dated occurrence of a class (optionally linked to a
-- timetable slot). One session per class/date/start time.
-- ---------------------------------------------------------------------------
create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  timetable_entry_id uuid references public.timetable_entries (id) on delete set null,
  subject_id uuid references public.subjects (id) on delete set null,
  faculty_id uuid references public.faculty (id) on delete set null,
  session_date date not null,
  start_time time,
  end_time time,
  status text not null default 'open',
  notes text,
  marked_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_sessions_status_check check (status in ('open', 'closed')),
  constraint attendance_sessions_time_check check (end_time is null or start_time is null or end_time > start_time)
);

create index if not exists attendance_sessions_institution_idx on public.attendance_sessions (institution_id);
create index if not exists attendance_sessions_class_idx on public.attendance_sessions (class_id);
create index if not exists attendance_sessions_date_idx on public.attendance_sessions (session_date);
create index if not exists attendance_sessions_faculty_idx on public.attendance_sessions (faculty_id);

-- A class cannot have two sessions on the same date starting at the same time.
-- Null start times collapse so duplicates are still prevented.
create unique index if not exists attendance_sessions_unique_idx
  on public.attendance_sessions (
    institution_id,
    class_id,
    session_date,
    coalesce(start_time, '00:00'::time)
  );

-- ---------------------------------------------------------------------------
-- attendance_records: one status per student per session.
-- ---------------------------------------------------------------------------
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  session_id uuid not null references public.attendance_sessions (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  status text not null default 'present',
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_records_status_check check (status in ('present', 'absent', 'late', 'excused')),
  constraint attendance_records_session_student_key unique (session_id, student_id)
);

create index if not exists attendance_records_institution_idx on public.attendance_records (institution_id);
create index if not exists attendance_records_session_idx on public.attendance_records (session_id);
create index if not exists attendance_records_student_idx on public.attendance_records (student_id);

-- ---------------------------------------------------------------------------
-- attendance_settings: one row per institution, configurable alert threshold.
-- ---------------------------------------------------------------------------
create table if not exists public.attendance_settings (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  low_attendance_threshold numeric(5, 2) not null default 75,
  alerts_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attendance_settings_threshold_check check (low_attendance_threshold >= 0 and low_attendance_threshold <= 100),
  constraint attendance_settings_institution_key unique (institution_id)
);

create index if not exists attendance_settings_institution_idx on public.attendance_settings (institution_id);

-- ---------------------------------------------------------------------------
-- Timetable conflict detection. Rejects overlapping active slots that share a
-- class, faculty member or room on the same day. Surfaces as SQLSTATE 23P01
-- (exclusion_violation) which the API maps to HTTP 409.
-- ---------------------------------------------------------------------------
create or replace function public.univora_timetable_conflict()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_room text := nullif(lower(trim(new.room)), '');
  v_reason text;
  v_end_time time;
begin
  if public.is_service_role() or coalesce(new.status, 'active') <> 'active' then
    return new;
  end if;

  select
    case
      when new.faculty_id is not null and t.faculty_id = new.faculty_id then 'faculty member'
      when v_room is not null and lower(trim(coalesce(t.room, ''))) = v_room then 'room'
      else 'class'
    end,
    t.end_time
    into v_reason, v_end_time
  from public.timetable_entries t
  where t.institution_id = new.institution_id
    and t.status = 'active'
    and t.day_of_week = new.day_of_week
    and t.id is distinct from new.id
    and t.start_time < new.end_time
    and t.end_time > new.start_time
    and coalesce(t.term_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(new.term_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and (
      (new.faculty_id is not null and t.faculty_id = new.faculty_id)
      or (v_room is not null and lower(coalesce(trim(t.room), '')) = v_room)
      or (t.class_id = new.class_id)
    )
  limit 1;

  if v_reason is not null then
    raise exception 'Timetable conflict'
      using
        errcode = '23P01',
        detail = format(
          'The %s is already booked on %s from %s. Choose a different time or resource.',
          v_reason,
          to_char(new.start_time, 'HH24:MI'),
          to_char(v_end_time, 'HH24:MI')
        );
  end if;

  return new;
end;
$$;

revoke execute on function public.univora_timetable_conflict() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Triggers: force institution on insert + maintain updated_at
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['timetable_entries', 'attendance_sessions', 'attendance_records', 'attendance_settings'] loop
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
drop trigger if exists univora_timetable_entries_same_institution on public.timetable_entries;
create trigger univora_timetable_entries_same_institution
  after insert or update on public.timetable_entries
  for each row execute function public.univora_enforce_same_institution(
    'class_id', 'classes',
    'subject_id', 'subjects',
    'faculty_id', 'faculty',
    'term_id', 'terms'
  );

drop trigger if exists univora_attendance_sessions_same_institution on public.attendance_sessions;
create trigger univora_attendance_sessions_same_institution
  after insert or update on public.attendance_sessions
  for each row execute function public.univora_enforce_same_institution(
    'class_id', 'classes',
    'timetable_entry_id', 'timetable_entries',
    'subject_id', 'subjects',
    'faculty_id', 'faculty'
  );

drop trigger if exists univora_attendance_records_same_institution on public.attendance_records;
create trigger univora_attendance_records_same_institution
  after insert or update on public.attendance_records
  for each row execute function public.univora_enforce_same_institution(
    'session_id', 'attendance_sessions',
    'student_id', 'students'
  );

-- Conflict trigger must run before the row lands.
drop trigger if exists univora_timetable_entries_conflict on public.timetable_entries;
create trigger univora_timetable_entries_conflict
  before insert or update on public.timetable_entries
  for each row execute function public.univora_timetable_conflict();

-- ---------------------------------------------------------------------------
-- RLS: members read; admins manage the timetable; staff manage attendance.
-- ---------------------------------------------------------------------------
alter table public.timetable_entries enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;
alter table public.attendance_settings enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['timetable_entries', 'attendance_sessions', 'attendance_records', 'attendance_settings'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated '
      'using (institution_id = public.current_institution_id() or public.is_super_admin())',
      t || '_select', t);

    execute format('drop policy if exists %I on public.%I', t || '_super_admin_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using (public.is_super_admin()) with check (public.is_super_admin())',
      t || '_super_admin_all', t);
  end loop;

  -- Timetable writes are administrative.
  foreach t in array array['timetable_entries', 'attendance_settings'] loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using (public.is_admin() and institution_id = public.current_institution_id()) '
      'with check (public.is_admin() and institution_id = public.current_institution_id())',
      t || '_admin_all', t);
  end loop;

  -- Attendance session/record writes are available to staff (faculty and above).
  foreach t in array array['attendance_sessions', 'attendance_records'] loop
    execute format('drop policy if exists %I on public.%I', t || '_staff_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      'using (public.is_staff() and institution_id = public.current_institution_id()) '
      'with check (public.is_staff() and institution_id = public.current_institution_id())',
      t || '_staff_all', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants (RLS remains the real gate).
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.timetable_entries to authenticated;
grant select, insert, update, delete on public.attendance_sessions to authenticated;
grant select, insert, update, delete on public.attendance_records to authenticated;
grant select, insert, update, delete on public.attendance_settings to authenticated;

commit;
