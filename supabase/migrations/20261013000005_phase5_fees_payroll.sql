-- Univora Phase 5 - Migration 5 of 5
-- Fees, Payments & Payroll: configurable fee types and fee structures
-- (class/academic-year/fee-type), per-student fee assignments with discounts and
-- outstanding tracking, payments with auto-numbered receipts (no live gateway),
-- salary structures with allowance/deduction components, monthly payroll runs
-- and records, and institution-scoped RLS. Apply after
-- 20261013000004_phase4_exams_grades.sql. Idempotent; safe to re-run.

begin;

-- ---------------------------------------------------------------------------
-- Global receipt sequence used to mint unique, human-readable receipt numbers.
-- ---------------------------------------------------------------------------
create sequence if not exists public.univora_receipt_seq;

-- ---------------------------------------------------------------------------
-- fee_types: configurable fee categories (Tuition, Transport, Lab, ...).
-- ---------------------------------------------------------------------------
create table if not exists public.fee_types (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  name text not null,
  code text,
  description text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fee_types_status_check check (status in ('active', 'inactive')),
  constraint fee_types_institution_name_key unique (institution_id, name)
);

create index if not exists fee_types_institution_idx on public.fee_types (institution_id);

-- ---------------------------------------------------------------------------
-- fee_structures: the amount a class is charged for a fee type in a given
-- academic year (optionally scoped to a term).
-- ---------------------------------------------------------------------------
create table if not exists public.fee_structures (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  fee_type_id uuid not null references public.fee_types (id) on delete restrict,
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  class_id uuid not null references public.classes (id) on delete cascade,
  term_id uuid references public.terms (id) on delete set null,
  name text not null,
  amount numeric(12, 2) not null,
  currency text not null default 'USD',
  frequency text not null default 'one_time',
  due_date date,
  status text not null default 'active',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fee_structures_status_check check (status in ('active', 'inactive')),
  constraint fee_structures_frequency_check
    check (frequency in ('one_time', 'monthly', 'termly', 'annual')),
  constraint fee_structures_amount_check check (amount > 0)
);

create index if not exists fee_structures_institution_idx on public.fee_structures (institution_id);
create index if not exists fee_structures_fee_type_idx on public.fee_structures (fee_type_id);
create index if not exists fee_structures_academic_year_idx on public.fee_structures (academic_year_id);
create index if not exists fee_structures_class_idx on public.fee_structures (class_id);
create index if not exists fee_structures_term_idx on public.fee_structures (term_id);

-- Duplicate protection: one structure per class/year/fee-type/term combination.
create unique index if not exists fee_structures_unique_idx
  on public.fee_structures (
    institution_id,
    class_id,
    academic_year_id,
    fee_type_id,
    coalesce(term_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- ---------------------------------------------------------------------------
-- student_fees: a fee structure assigned to one student. Outstanding balance is
-- the generated column amount_due - discount - amount_paid.
-- ---------------------------------------------------------------------------
create table if not exists public.student_fees (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  fee_structure_id uuid not null references public.fee_structures (id) on delete restrict,
  academic_year_id uuid not null references public.academic_years (id) on delete cascade,
  amount_due numeric(12, 2) not null,
  discount numeric(12, 2) not null default 0,
  amount_paid numeric(12, 2) not null default 0,
  outstanding numeric(12, 2) generated always as (amount_due - discount - amount_paid) stored,
  due_date date,
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_fees_status_check
    check (status in ('pending', 'partial', 'paid', 'waived', 'cancelled')),
  constraint student_fees_amount_due_check check (amount_due > 0),
  constraint student_fees_discount_check check (discount >= 0 and discount <= amount_due),
  constraint student_fees_amount_paid_check check (amount_paid >= 0),
  constraint student_fees_student_structure_key unique (student_id, fee_structure_id)
);

create index if not exists student_fees_institution_idx on public.student_fees (institution_id);
create index if not exists student_fees_student_idx on public.student_fees (student_id);
create index if not exists student_fees_structure_idx on public.student_fees (fee_structure_id);
create index if not exists student_fees_academic_year_idx on public.student_fees (academic_year_id);
create index if not exists student_fees_status_idx on public.student_fees (institution_id, status);

-- ---------------------------------------------------------------------------
-- payments: money received against a student fee assignment. Receipt numbers are
-- minted by a trigger so they are unique and client input can never forge them.
-- ---------------------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  student_fee_id uuid references public.student_fees (id) on delete set null,
  amount numeric(12, 2) not null,
  method text not null default 'cash',
  reference text,
  receipt_number text,
  paid_at timestamptz not null default now(),
  notes text,
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_method_check
    check (method in ('cash', 'bank_transfer', 'card', 'cheque', 'online', 'other')),
  constraint payments_amount_check check (amount > 0)
);

create index if not exists payments_institution_idx on public.payments (institution_id);
create index if not exists payments_student_idx on public.payments (student_id);
create index if not exists payments_student_fee_idx on public.payments (student_fee_id);
create index if not exists payments_paid_at_idx on public.payments (institution_id, paid_at);
create unique index if not exists payments_receipt_key on public.payments (receipt_number);

-- ---------------------------------------------------------------------------
-- salary_structures: per faculty/staff salary configuration.
-- ---------------------------------------------------------------------------
create table if not exists public.salary_structures (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  faculty_id uuid references public.faculty (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete cascade,
  name text not null,
  base_salary numeric(12, 2) not null,
  currency text not null default 'USD',
  pay_frequency text not null default 'monthly',
  effective_from date,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint salary_structures_frequency_check
    check (pay_frequency in ('monthly', 'biweekly', 'weekly')),
  constraint salary_structures_status_check check (status in ('active', 'inactive')),
  constraint salary_structures_base_check check (base_salary > 0),
  constraint salary_structures_employee_check check (faculty_id is not null or profile_id is not null)
);

create index if not exists salary_structures_institution_idx on public.salary_structures (institution_id);
create index if not exists salary_structures_faculty_idx on public.salary_structures (faculty_id);

-- One active salary structure per employee (faculty or profile).
create unique index if not exists salary_structures_faculty_key
  on public.salary_structures (institution_id, faculty_id)
  where faculty_id is not null;
create unique index if not exists salary_structures_profile_key
  on public.salary_structures (institution_id, profile_id)
  where profile_id is not null;

-- ---------------------------------------------------------------------------
-- salary_components: allowances and deductions attached to a salary structure.
-- When is_percentage is true, amount is a percentage of the base salary.
-- ---------------------------------------------------------------------------
create table if not exists public.salary_components (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  salary_structure_id uuid not null references public.salary_structures (id) on delete cascade,
  name text not null,
  type text not null,
  amount numeric(12, 2) not null default 0,
  is_percentage boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint salary_components_type_check check (type in ('allowance', 'deduction')),
  constraint salary_components_amount_check
    check (amount >= 0 and (is_percentage = false or amount <= 100)),
  constraint salary_components_structure_name_key unique (salary_structure_id, name)
);

create index if not exists salary_components_institution_idx on public.salary_components (institution_id);
create index if not exists salary_components_structure_idx on public.salary_components (salary_structure_id);

-- ---------------------------------------------------------------------------
-- payroll_runs: one payroll per institution per month.
-- ---------------------------------------------------------------------------
create table if not exists public.payroll_runs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  period_month smallint not null,
  period_year integer not null,
  name text,
  status text not null default 'draft',
  total_gross numeric(14, 2) not null default 0,
  total_deductions numeric(14, 2) not null default 0,
  total_net numeric(14, 2) not null default 0,
  notes text,
  processed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payroll_runs_status_check
    check (status in ('draft', 'processing', 'approved', 'paid', 'cancelled')),
  constraint payroll_runs_month_check check (period_month between 1 and 12),
  constraint payroll_runs_year_check check (period_year between 2000 and 2100),
  constraint payroll_runs_period_key unique (institution_id, period_year, period_month)
);

create index if not exists payroll_runs_institution_idx on public.payroll_runs (institution_id);
create index if not exists payroll_runs_period_idx on public.payroll_runs (institution_id, period_year, period_month);

-- ---------------------------------------------------------------------------
-- payroll_records: one payslip line per employee in a run. net_salary is a
-- generated column so it can never drift from base + allowances - deductions.
-- ---------------------------------------------------------------------------
create table if not exists public.payroll_records (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  payroll_run_id uuid not null references public.payroll_runs (id) on delete cascade,
  faculty_id uuid references public.faculty (id) on delete set null,
  profile_id uuid references public.profiles (id) on delete set null,
  base_salary numeric(12, 2) not null,
  allowances numeric(12, 2) not null default 0,
  deductions numeric(12, 2) not null default 0,
  net_salary numeric(12, 2) generated always as (base_salary + allowances - deductions) stored,
  status text not null default 'pending',
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payroll_records_status_check
    check (status in ('pending', 'paid', 'cancelled')),
  constraint payroll_records_base_check check (base_salary >= 0),
  constraint payroll_records_allowances_check check (allowances >= 0),
  constraint payroll_records_deductions_check check (deductions >= 0),
  constraint payroll_records_employee_check check (faculty_id is not null or profile_id is not null)
);

create index if not exists payroll_records_institution_idx on public.payroll_records (institution_id);
create index if not exists payroll_records_run_idx on public.payroll_records (payroll_run_id);
create index if not exists payroll_records_faculty_idx on public.payroll_records (faculty_id);

create unique index if not exists payroll_records_run_faculty_key
  on public.payroll_records (payroll_run_id, faculty_id)
  where faculty_id is not null;
create unique index if not exists payroll_records_run_profile_key
  on public.payroll_records (payroll_run_id, profile_id)
  where profile_id is not null;

-- ---------------------------------------------------------------------------
-- Receipt minting: assign a unique, readable receipt number on insert.
-- ---------------------------------------------------------------------------
create or replace function public.univora_set_receipt_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.receipt_number is null or btrim(new.receipt_number) = '' then
    new.receipt_number :=
      'RCPT-' || to_char(now(), 'YYYY') || '-' ||
      lpad(nextval('public.univora_receipt_seq')::text, 5, '0');
  end if;
  return new;
end;
$$;

revoke execute on function public.univora_set_receipt_number() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Keep a student fee's paid total in sync with its payments. Status is derived
-- by the student_fees BEFORE trigger below, so only amount_paid is written here.
-- ---------------------------------------------------------------------------
create or replace function public.univora_sync_student_fee_paid()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fee_id uuid;
  v_paid numeric(12, 2);
begin
  if tg_op = 'DELETE' then
    v_fee_id := old.student_fee_id;
  else
    v_fee_id := new.student_fee_id;
  end if;

  if v_fee_id is not null then
    select coalesce(sum(amount), 0) into v_paid
    from public.payments
    where student_fee_id = v_fee_id;

    update public.student_fees
      set amount_paid = v_paid,
          updated_at = now()
      where id = v_fee_id;
  end if;

  -- When a payment is moved between fee assignments, refresh the old one too.
  if tg_op = 'UPDATE' and old.student_fee_id is distinct from new.student_fee_id
     and old.student_fee_id is not null then
    select coalesce(sum(amount), 0) into v_paid
    from public.payments
    where student_fee_id = old.student_fee_id;

    update public.student_fees
      set amount_paid = v_paid,
          updated_at = now()
      where id = old.student_fee_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke execute on function public.univora_sync_student_fee_paid() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Derive a student fee's status from its amounts. Manually waived/cancelled
-- rows are preserved so finance staff can override the derived value.
-- ---------------------------------------------------------------------------
create or replace function public.univora_set_student_fee_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from 'waived' and new.status is distinct from 'cancelled' then
    new.status := case
      when new.amount_paid + new.discount >= new.amount_due then 'paid'
      when new.amount_paid > 0 then 'partial'
      else 'pending'
    end;
  end if;
  return new;
end;
$$;

revoke execute on function public.univora_set_student_fee_status() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Keep payroll run totals in sync with their records.
-- ---------------------------------------------------------------------------
create or replace function public.univora_sync_payroll_totals()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run_id uuid;
  v_gross numeric(14, 2);
  v_deductions numeric(14, 2);
  v_net numeric(14, 2);
begin
  if tg_op = 'DELETE' then
    v_run_id := old.payroll_run_id;
  else
    v_run_id := new.payroll_run_id;
  end if;

  if v_run_id is not null then
    select
      coalesce(sum(base_salary + allowances), 0),
      coalesce(sum(deductions), 0),
      coalesce(sum(net_salary), 0)
    into v_gross, v_deductions, v_net
    from public.payroll_records
    where payroll_run_id = v_run_id;

    update public.payroll_runs
      set total_gross = v_gross,
          total_deductions = v_deductions,
          total_net = v_net,
          updated_at = now()
      where id = v_run_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke execute on function public.univora_sync_payroll_totals() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Triggers: institution + updated_at on every table.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'fee_types', 'fee_structures', 'student_fees', 'payments',
    'salary_structures', 'salary_components', 'payroll_runs', 'payroll_records'
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
drop trigger if exists univora_fee_structures_same_institution on public.fee_structures;
create trigger univora_fee_structures_same_institution
  after insert or update on public.fee_structures
  for each row execute function public.univora_enforce_same_institution(
    'fee_type_id', 'fee_types',
    'academic_year_id', 'academic_years',
    'class_id', 'classes',
    'term_id', 'terms'
  );

drop trigger if exists univora_student_fees_same_institution on public.student_fees;
create trigger univora_student_fees_same_institution
  after insert or update on public.student_fees
  for each row execute function public.univora_enforce_same_institution(
    'student_id', 'students',
    'fee_structure_id', 'fee_structures',
    'academic_year_id', 'academic_years'
  );

drop trigger if exists univora_payments_same_institution on public.payments;
create trigger univora_payments_same_institution
  after insert or update on public.payments
  for each row execute function public.univora_enforce_same_institution(
    'student_id', 'students',
    'student_fee_id', 'student_fees'
  );

drop trigger if exists univora_salary_structures_same_institution on public.salary_structures;
create trigger univora_salary_structures_same_institution
  after insert or update on public.salary_structures
  for each row execute function public.univora_enforce_same_institution(
    'faculty_id', 'faculty',
    'profile_id', 'profiles'
  );

drop trigger if exists univora_salary_components_same_institution on public.salary_components;
create trigger univora_salary_components_same_institution
  after insert or update on public.salary_components
  for each row execute function public.univora_enforce_same_institution(
    'salary_structure_id', 'salary_structures'
  );

drop trigger if exists univora_payroll_records_same_institution on public.payroll_records;
create trigger univora_payroll_records_same_institution
  after insert or update on public.payroll_records
  for each row execute function public.univora_enforce_same_institution(
    'payroll_run_id', 'payroll_runs',
    'faculty_id', 'faculty',
    'profile_id', 'profiles'
  );

-- ---------------------------------------------------------------------------
-- Behavioural triggers.
-- ---------------------------------------------------------------------------
drop trigger if exists univora_payments_receipt on public.payments;
create trigger univora_payments_receipt
  before insert on public.payments
  for each row execute function public.univora_set_receipt_number();

drop trigger if exists univora_student_fees_status on public.student_fees;
create trigger univora_student_fees_status
  before insert or update on public.student_fees
  for each row execute function public.univora_set_student_fee_status();

drop trigger if exists univora_payments_sync_fee on public.payments;
create trigger univora_payments_sync_fee
  after insert or update or delete on public.payments
  for each row execute function public.univora_sync_student_fee_paid();

drop trigger if exists univora_payroll_records_sync_totals on public.payroll_records;
create trigger univora_payroll_records_sync_totals
  after insert or update or delete on public.payroll_records
  for each row execute function public.univora_sync_payroll_totals();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.fee_types enable row level security;
alter table public.fee_structures enable row level security;
alter table public.student_fees enable row level security;
alter table public.payments enable row level security;
alter table public.salary_structures enable row level security;
alter table public.salary_components enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payroll_records enable row level security;

do $$
declare
  t text;
begin
  -- Fee configuration + structures: members read, admins manage.
  foreach t in array array['fee_types', 'fee_structures'] loop
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

  -- Student fees + payments: staff read all; a student may read only their own.
  foreach t in array array['student_fees', 'payments'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format(
      'create policy %I on public.%I for select to authenticated '
      'using (institution_id = public.current_institution_id() '
      'and (public.is_staff() or public.univora_is_own_student(student_id)) '
      'or public.is_super_admin())',
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

  -- Payroll is sensitive: restricted to institution admins (and super admins).
  foreach t in array array[
    'salary_structures', 'salary_components', 'payroll_runs', 'payroll_records'
  ] loop
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
-- Grants (RLS remains the real gate).
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.fee_types to authenticated;
grant select, insert, update, delete on public.fee_structures to authenticated;
grant select, insert, update, delete on public.student_fees to authenticated;
grant select, insert, update, delete on public.payments to authenticated;
grant select, insert, update, delete on public.salary_structures to authenticated;
grant select, insert, update, delete on public.salary_components to authenticated;
grant select, insert, update, delete on public.payroll_runs to authenticated;
grant select, insert, update, delete on public.payroll_records to authenticated;

-- ---------------------------------------------------------------------------
-- Policy helper functions used inside RLS policies must be executable by the
-- role the policies apply to. Phase 3/4 revoked EXECUTE from authenticated,
-- which makes every policy that references these helpers fail with
-- "permission denied for function ...". Grant it back explicitly.
-- ---------------------------------------------------------------------------
grant execute on function public.is_staff() to authenticated;
grant execute on function public.univora_is_own_student(uuid) to authenticated;

commit;
