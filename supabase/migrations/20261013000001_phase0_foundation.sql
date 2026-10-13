-- Univora Phase 0 - Migration 1 of 3
-- Foundation: institutions, roles, updated_at helper.
-- Apply in order: 1 -> 2 -> 3. Idempotent; safe to re-run.

begin;

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.univora_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Trigger functions are invoked by the engine; no direct EXECUTE needed by app roles.
revoke execute on function public.univora_set_updated_at() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- institutions
-- ---------------------------------------------------------------------------
create table if not exists public.institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  domain text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists univora_institutions_set_updated_at on public.institutions;
create trigger univora_institutions_set_updated_at
  before update on public.institutions
  for each row execute function public.univora_set_updated_at();

-- ---------------------------------------------------------------------------
-- roles (system lookup, ranked so privilege escalation can be prevented)
-- ---------------------------------------------------------------------------
create table if not exists public.roles (
  id smallint generated always as identity primary key,
  name text not null unique,
  description text,
  rank smallint not null default 0,
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.roles (name, description, rank) values
  ('owner',   'Institution owner with full control', 100),
  ('admin',   'Institution administrator',            80),
  ('faculty', 'Faculty member',                       60),
  ('staff',   'Administrative staff',                 40),
  ('student', 'Student',                              20),
  ('pending', 'Awaiting institution assignment',       0)
on conflict (name) do nothing;

commit;