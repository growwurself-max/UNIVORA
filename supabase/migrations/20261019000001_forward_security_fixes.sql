-- Forward-only security hardening for populated Univora installations.
-- Does not alter historical migration files or existing application data.

begin;

-- Preserve trusted operational deletion while blocking client-side payment
-- history deletion regardless of permissive FOR ALL policies.
revoke delete on public.payments from public, anon, authenticated;
grant delete on public.payments to service_role;

drop policy if exists payments_no_authenticated_delete on public.payments;
create policy payments_no_authenticated_delete on public.payments
  as restrictive for delete to authenticated
  using (false);

-- Support both role labels present in deployed Univora installations.
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    public.current_role_name() in ('Super Admin', 'super_admin'),
    false
  );
$$;

-- Keep notification updates in the row's tenant and require the recipient
-- and optional sender to belong to that same institution.
drop policy if exists notifications_update_self on public.notifications;
create policy notifications_update_self on public.notifications
  for update to authenticated
  using (
    recipient_id = auth.uid()
    and institution_id = public.current_institution_id()
  )
  with check (
    recipient_id = auth.uid()
    and institution_id = public.current_institution_id()
  );

drop policy if exists notifications_update_tenant_guard on public.notifications;
create policy notifications_update_tenant_guard on public.notifications
  as restrictive for update to authenticated
  using (
    (
      public.is_super_admin()
      or institution_id = public.current_institution_id()
    )
    and exists (
      select 1
      from public.profiles recipient
      where recipient.id = notifications.recipient_id
        and recipient.institution_id = notifications.institution_id
    )
    and (
      notifications.sender_id is null
      or exists (
        select 1
        from public.profiles sender
        where sender.id = notifications.sender_id
          and sender.institution_id = notifications.institution_id
      )
    )
  )
  with check (
    (
      public.is_super_admin()
      or institution_id = public.current_institution_id()
    )
    and exists (
      select 1
      from public.profiles recipient
      where recipient.id = notifications.recipient_id
        and recipient.institution_id = notifications.institution_id
    )
    and (
      notifications.sender_id is null
      or exists (
        select 1
        from public.profiles sender
        where sender.id = notifications.sender_id
          and sender.institution_id = notifications.institution_id
      )
    )
  );

drop policy if exists notifications_insert_tenant_guard on public.notifications;
create policy notifications_insert_tenant_guard on public.notifications
  as restrictive for insert to authenticated
  with check (
    (
      public.is_super_admin()
      or institution_id = public.current_institution_id()
    )
    and exists (
      select 1
      from public.profiles recipient
      where recipient.id = notifications.recipient_id
        and recipient.institution_id = notifications.institution_id
    )
    and (
      notifications.sender_id is null
      or exists (
        select 1
        from public.profiles sender
        where sender.id = notifications.sender_id
          and sender.institution_id = notifications.institution_id
      )
    )
  );

-- Recipients may update read state only. Admins and the trusted service role
-- retain existing notification-management workflows.
create or replace function public.univora_guard_notification_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_service_role()
     or public.is_admin()
     or public.is_super_admin() then
    return new;
  end if;

  if old.recipient_id is distinct from auth.uid()
     or new.recipient_id is distinct from auth.uid()
     or (to_jsonb(new) - array['is_read', 'read_at', 'updated_at'])
        is distinct from
        (to_jsonb(old) - array['is_read', 'read_at', 'updated_at']) then
    raise exception 'Recipients may only update notification read status'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists univora_notifications_guard_update on public.notifications;
create trigger univora_notifications_guard_update
  before update on public.notifications
  for each row execute function public.univora_guard_notification_update();
revoke execute on function public.univora_guard_notification_update()
  from public, anon, authenticated;

-- Extend the existing exam-mark validator without replacing its trigger.
-- Enrollment must be active, and all related rows must share the institution.
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

  if not exists (
    select 1
    from public.exams e
    join public.classes c
      on c.id = e.class_id
     and c.institution_id = e.institution_id
    join public.enrollments en
      on en.class_id = e.class_id
     and en.student_id = new.student_id
     and en.institution_id = e.institution_id
     and en.status = 'enrolled'
    join public.students s
      on s.id = en.student_id
     and s.institution_id = e.institution_id
    where e.id = new.exam_id
      and e.institution_id = new.institution_id
  ) then
    raise exception 'Exam mark student must be enrolled in the exam class'
      using errcode = '23514';
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
      using
        errcode = '23514',
        detail = format('Maximum marks for this exam is %s.', v_max);
  end if;

  return new;
end;
$$;

revoke execute on function public.univora_validate_exam_mark()
  from public, anon, authenticated;

-- Validate class, enrolled student, and institution consistency for every
-- attendance record insert or update. Replacing this named trigger is safe
-- and rerunnable; other institution-consistency triggers remain untouched.
create or replace function public.univora_validate_attendance_record()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.attendance_sessions session
    join public.classes c
      on c.id = session.class_id
     and c.institution_id = session.institution_id
    join public.enrollments en
      on en.class_id = session.class_id
     and en.student_id = new.student_id
     and en.institution_id = session.institution_id
     and en.status = 'enrolled'
    join public.students s
      on s.id = en.student_id
     and s.institution_id = session.institution_id
    where session.id = new.session_id
      and session.institution_id = new.institution_id
  ) then
    raise exception 'Attendance record student must be enrolled in the session class'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists univora_attendance_records_validate
  on public.attendance_records;
create trigger univora_attendance_records_validate
  before insert or update on public.attendance_records
  for each row execute function public.univora_validate_attendance_record();
revoke execute on function public.univora_validate_attendance_record()
  from public, anon, authenticated;

commit;
