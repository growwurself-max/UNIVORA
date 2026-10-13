-- Univora Phase 0 - Migration 3 of 3
-- Academic core: academic_years, departments, terms + institution-scoped RLS.
-- Apply after 20261013000002_phase0_profiles_authz.sql. Idempotent; safe to re-run.

begin;

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

-- terms (extra guard: the academic year must belong to the same institution)
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

-- ---------------------------------------------------------------------------
-- Grants (RLS remains the real gate; explicit grants keep the contract clear)
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.academic_years, public.departments, public.terms to authenticated;

commit;