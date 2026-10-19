-- Enforce role- and assignment-scoped reads for sensitive academic records.
-- Apply after 20261013000008_role_specific_access.sql.

begin;

-- Institution membership is assigned by the trusted server, never by a
-- caller updating their own or another profile.
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
    select id into v_pending from public.roles where name = 'Pending';
    if v_pending is null then
      raise exception 'The Pending role is not configured';
    end if;
    new.role_id := v_pending;
    new.institution_id := null;
    new.is_demo := false;
    return new;
  end if;

  if new.institution_id is distinct from old.institution_id then
    raise exception 'Institution assignment can only be changed by the service';
  end if;

  if new.is_demo is distinct from old.is_demo then
    raise exception 'Demo status can only be changed by the service';
  end if;

  if new.role_id is distinct from old.role_id then
    if not public.is_admin() then
      raise exception 'Only administrators can change roles';
    end if;

    select rank into v_target_rank from public.roles where id = new.role_id;
    if v_target_rank is null then
      raise exception 'Unknown role';
    end if;
    if v_target_rank > public.current_role_rank() then
      raise exception 'Cannot assign a role higher than your own';
    end if;
    if (select name from public.roles where id = new.role_id) = 'Super Admin'
       and public.current_role_name() <> 'Super Admin' then
      raise exception 'Only a Super Admin can assign the Super Admin role';
    end if;
  end if;

  return new;
end;
$$;

-- Check staff assignment against the requested class/subject/department.
create or replace function public.univora_can_access_class(p_class_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.classes c
    left join public.courses co on co.id = c.course_id
    where c.id = p_class_id
      and c.institution_id = public.current_institution_id()
      and public.current_role_name() in ('Teacher', 'Department Head', 'Exam Coordinator')
      and (
        public.has_staff_assignment(c.id, 'class')
        or (c.subject_id is not null and public.has_staff_assignment(c.subject_id, 'subject'))
        or (
          public.current_role_name() = 'Department Head'
          and co.department_id is not null
          and public.has_staff_assignment(co.department_id, 'department')
        )
      )
  );
$$;

create or replace function public.univora_can_access_student(p_student_id uuid)
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
      and s.institution_id = public.current_institution_id()
      and (
        s.profile_id = auth.uid()
        or public.current_role_name() = 'Student Records Manager'
        or exists (
          select 1
          from public.enrollments e
          where e.student_id = s.id
            and e.institution_id = s.institution_id
            and e.status = 'enrolled'
            and public.univora_can_access_class(e.class_id)
        )
      )
  );
$$;

-- Accountants need names/admission numbers in financial screens, not access
-- to full student records. This function returns only those display fields.
create or replace function public.univora_finance_student_directory(p_student_ids uuid[] default null)
returns table (
  id uuid,
  admission_number text,
  first_name text,
  last_name text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select s.id, s.admission_number, s.first_name, s.last_name
  from public.students s
  where (p_student_ids is null or s.id = any(p_student_ids))
    and (
      public.is_super_admin()
      or (
        s.institution_id = public.current_institution_id()
        and (
          public.is_admin()
          or s.profile_id = auth.uid()
          or public.univora_can_access_student(s.id)
          or (
            public.current_role_name() = 'Accountant'
            and (
              exists (
                select 1 from public.student_fees sf
                where sf.student_id = s.id
                  and sf.institution_id = s.institution_id
              )
              or exists (
                select 1 from public.payments p
                where p.student_id = s.id
                  and p.institution_id = s.institution_id
              )
            )
          )
        )
      )
    );
$$;

revoke execute on function public.univora_can_access_class(uuid) from public, anon;
revoke execute on function public.univora_can_access_student(uuid) from public, anon;
revoke execute on function public.univora_finance_student_directory(uuid[]) from public, anon;
grant execute on function public.univora_can_access_class(uuid) to authenticated;
grant execute on function public.univora_can_access_student(uuid) to authenticated;
grant execute on function public.univora_finance_student_directory(uuid[]) to authenticated;
grant execute on function public.univora_is_own_student(uuid) to authenticated;

-- Prevent direct table writes from forging payment actors, mismatching a
-- payment with a different student's fee, or overspending an outstanding fee.
create or replace function public.univora_validate_payment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fee public.student_fees%rowtype;
  v_available numeric(12, 2);
begin
  if not public.is_service_role() then
    new.recorded_by := auth.uid();
  end if;

  if new.student_fee_id is null then
    return new;
  end if;

  select * into v_fee
  from public.student_fees
  where id = new.student_fee_id
  for update;

  if not found
     or v_fee.student_id is distinct from new.student_id
     or v_fee.institution_id is distinct from new.institution_id then
    raise exception 'Payment must match a fee assignment for the same student and institution'
      using errcode = '23514';
  end if;

  v_available := v_fee.outstanding;
  if tg_op = 'UPDATE' and old.student_fee_id = new.student_fee_id then
    v_available := v_available + old.amount;
  end if;

  if new.amount > v_available then
    raise exception 'Payment exceeds the fee assignment balance'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- Do not allow authenticated clients to choose a receipt number; the receipt
-- trigger runs after institution assignment and always allocates a fresh one.
create or replace function public.univora_set_receipt_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.receipt_number :=
    'RCPT-' || to_char(now(), 'YYYY') || '-' ||
    lpad(nextval('public.univora_receipt_seq')::text, 5, '0');
  return new;
end;
$$;
revoke execute on function public.univora_set_receipt_number()
  from public, anon, authenticated;

drop trigger if exists univora_payments_validate on public.payments;
create trigger univora_payments_validate
  before insert or update on public.payments
  for each row execute function public.univora_validate_payment();
revoke execute on function public.univora_validate_payment()
  from public, anon, authenticated;

-- Only payments may change the paid total; authenticated users may update
-- other editable fee fields but cannot directly forge amount_paid.
revoke insert, update on public.student_fees from authenticated;
grant insert (
  student_id, fee_structure_id, academic_year_id, amount_due, discount, due_date, status, notes
) on public.student_fees to authenticated;
grant update (
  student_id, fee_structure_id, academic_year_id, amount_due, discount, due_date, status, notes
) on public.student_fees to authenticated;

-- Payments are append/void records. Corrections use a void plus a new entry;
-- ordinary authenticated clients cannot rewrite a receipt or payment history.
revoke update on public.payments from authenticated;

-- Absent candidates cannot have a numeric mark, and the grader is always the
-- authenticated actor rather than a caller-supplied profile ID.
create or replace function public.univora_validate_exam_mark()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_max numeric;
begin
  if not public.is_service_role() then
    new.graded_by := auth.uid();
  end if;

  if new.is_absent and new.marks_obtained is not null then
    raise exception 'Absent students cannot have marks recorded'
      using errcode = '23514';
  end if;

  if new.marks_obtained is null then
    return new;
  end if;

  select max_marks into v_max
  from public.exams
  where id = new.exam_id;

  if v_max is not null and new.marks_obtained > v_max then
    raise exception 'Marks obtained cannot exceed the exam maximum'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.univora_set_attendance_actor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_service_role() then
    new.marked_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists univora_attendance_sessions_actor on public.attendance_sessions;
create trigger univora_attendance_sessions_actor
  before insert or update on public.attendance_sessions
  for each row execute function public.univora_set_attendance_actor();
revoke execute on function public.univora_set_attendance_actor()
  from public, anon, authenticated;

-- Students may read their own record; Records Managers work within their
-- institution; Teachers/Department Heads/Exam Coordinators see assigned rosters.
drop policy if exists students_select on public.students;
create policy students_select on public.students
  for select to authenticated
  using (
    public.is_super_admin()
    or (
      institution_id = public.current_institution_id()
      and public.univora_can_access_student(id)
    )
    or (
      institution_id = public.current_institution_id()
      and public.is_admin()
    )
  );

drop policy if exists faculty_select on public.faculty;
create policy faculty_select on public.faculty
  for select to authenticated
  using (
    public.is_super_admin()
    or (
      institution_id = public.current_institution_id()
      and (
        public.is_admin()
        or profile_id = auth.uid()
        or (
          public.current_role_name() = 'Department Head'
          and department_id is not null
          and public.has_staff_assignment(department_id, 'department')
        )
      )
    )
  );

drop policy if exists departments_select on public.departments;
create policy departments_select on public.departments
  for select to authenticated
  using (
    public.is_super_admin()
    or (
      institution_id = public.current_institution_id()
      and (
        public.is_admin()
        or public.current_role_name() = 'Student Records Manager'
        or (
          public.current_role_name() = 'Department Head'
          and public.has_staff_assignment(id, 'department')
        )
      )
    )
  );

drop policy if exists courses_select on public.courses;
create policy courses_select on public.courses
  for select to authenticated
  using (
    public.is_super_admin()
    or (
      institution_id = public.current_institution_id()
      and (
        public.is_admin()
        or public.current_role_name() = 'Student Records Manager'
        or exists (
          select 1 from public.classes c
          where c.course_id = courses.id
            and (
              public.univora_can_access_class(c.id)
              or exists (
                select 1
                from public.enrollments e
                join public.students s on s.id = e.student_id
                where e.class_id = c.id
                  and e.status = 'enrolled'
                  and s.profile_id = auth.uid()
              )
            )
        )
      )
    )
  );

drop policy if exists subjects_select on public.subjects;
create policy subjects_select on public.subjects
  for select to authenticated
  using (
    public.is_super_admin()
    or (
      institution_id = public.current_institution_id()
      and (
        public.is_admin()
        or public.current_role_name() = 'Student Records Manager'
        or public.has_staff_assignment(id, 'subject')
        or (
          public.current_role_name() = 'Department Head'
          and department_id is not null
          and public.has_staff_assignment(department_id, 'department')
        )
        or exists (
          select 1 from public.classes c
          where c.subject_id = subjects.id
            and public.univora_can_access_class(c.id)
        )
      )
    )
  );

drop policy if exists classes_select on public.classes;
create policy classes_select on public.classes
  for select to authenticated
  using (
    public.is_super_admin()
    or (
      institution_id = public.current_institution_id()
      and (
        public.is_admin()
        or public.current_role_name() in ('Accountant', 'Student Records Manager')
        or public.univora_can_access_class(id)
        or exists (
          select 1
          from public.enrollments e
          join public.students s on s.id = e.student_id
          where e.class_id = classes.id
            and e.status = 'enrolled'
            and s.profile_id = auth.uid()
        )
      )
    )
  );

drop policy if exists enrollments_select on public.enrollments;
create policy enrollments_select on public.enrollments
  for select to authenticated
  using (
    public.is_super_admin()
    or (
      institution_id = public.current_institution_id()
      and (
        public.is_admin()
        or public.current_role_name() in ('Accountant', 'Student Records Manager')
        or public.univora_can_access_class(class_id)
        or public.univora_is_own_student(student_id)
      )
    )
  );

-- Timetable and attendance visibility follows assigned classes or the
-- student's own enrolled classes. Staff write access is also assignment-bound.
drop policy if exists timetable_entries_select on public.timetable_entries;
create policy timetable_entries_select on public.timetable_entries
  for select to authenticated
  using (
    public.is_super_admin()
    or (
      institution_id = public.current_institution_id()
      and (
        public.is_admin()
        or public.univora_can_access_class(class_id)
        or exists (
          select 1 from public.enrollments e
          where e.class_id = timetable_entries.class_id
            and e.status = 'enrolled'
            and public.univora_is_own_student(e.student_id)
        )
      )
    )
  );

drop policy if exists attendance_sessions_select on public.attendance_sessions;
create policy attendance_sessions_select on public.attendance_sessions
  for select to authenticated
  using (
    public.is_super_admin()
    or (
      institution_id = public.current_institution_id()
      and (
        public.is_admin()
        or public.univora_can_access_class(class_id)
        or exists (
          select 1 from public.enrollments e
          where e.class_id = attendance_sessions.class_id
            and e.status = 'enrolled'
            and public.univora_is_own_student(e.student_id)
        )
      )
    )
  );

drop policy if exists attendance_records_select on public.attendance_records;
create policy attendance_records_select on public.attendance_records
  for select to authenticated
  using (
    public.is_super_admin()
    or (
      institution_id = public.current_institution_id()
      and (
        public.is_admin()
        or public.univora_is_own_student(student_id)
        or exists (
          select 1 from public.attendance_sessions s
          where s.id = attendance_records.session_id
            and public.univora_can_access_class(s.class_id)
        )
      )
    )
  );

drop policy if exists attendance_sessions_staff_all on public.attendance_sessions;
create policy attendance_sessions_staff_all on public.attendance_sessions
  for all to authenticated
  using (
    public.is_admin() and institution_id = public.current_institution_id()
    or public.univora_can_access_class(class_id)
  )
  with check (
    public.is_admin() and institution_id = public.current_institution_id()
    or public.univora_can_access_class(class_id)
  );

drop policy if exists attendance_records_staff_all on public.attendance_records;
create policy attendance_records_staff_all on public.attendance_records
  for all to authenticated
  using (
    public.is_admin() and institution_id = public.current_institution_id()
    or exists (
      select 1 from public.attendance_sessions s
      where s.id = attendance_records.session_id
        and public.univora_can_access_class(s.class_id)
    )
  )
  with check (
    public.is_admin() and institution_id = public.current_institution_id()
    or exists (
      select 1 from public.attendance_sessions s
      where s.id = attendance_records.session_id
        and public.univora_can_access_class(s.class_id)
    )
  );

-- Exam Coordinators and Teachers manage only exams for assigned classes.
drop policy if exists exams_select on public.exams;
create policy exams_select on public.exams
  for select to authenticated
  using (
    public.is_super_admin()
    or (
      institution_id = public.current_institution_id()
      and (
        public.is_admin()
        or public.univora_can_access_class(class_id)
        or exists (
          select 1 from public.enrollments e
          where e.class_id = exams.class_id
            and e.status = 'enrolled'
            and public.univora_is_own_student(e.student_id)
        )
      )
    )
  );

drop policy if exists exams_staff_all on public.exams;
create policy exams_staff_all on public.exams
  for all to authenticated
  using (
    public.is_admin() and institution_id = public.current_institution_id()
    or public.univora_can_access_class(class_id)
  )
  with check (
    public.is_admin() and institution_id = public.current_institution_id()
    or public.univora_can_access_class(class_id)
  );

drop policy if exists exam_marks_select on public.exam_marks;
create policy exam_marks_select on public.exam_marks
  for select to authenticated
  using (
    public.is_super_admin()
    or (
      institution_id = public.current_institution_id()
      and (
        public.is_admin()
        or public.univora_is_own_student(student_id)
        or exists (
          select 1 from public.exams e
          where e.id = exam_marks.exam_id
            and public.univora_can_access_class(e.class_id)
        )
      )
    )
  );

drop policy if exists exam_marks_staff_all on public.exam_marks;
create policy exam_marks_staff_all on public.exam_marks
  for all to authenticated
  using (
    public.is_admin() and institution_id = public.current_institution_id()
    or exists (
      select 1 from public.exams e
      where e.id = exam_marks.exam_id
        and public.univora_can_access_class(e.class_id)
    )
  )
  with check (
    public.is_admin() and institution_id = public.current_institution_id()
    or exists (
      select 1 from public.exams e
      where e.id = exam_marks.exam_id
        and public.univora_can_access_class(e.class_id)
    )
  );

commit;
