-- Univora Phase 6 - Migration 6 of 6
-- Reports, Notifications & Settings

begin;

-- -----------------------------------------------------------------------------
-- Notifications
-- -----------------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  type text not null,
  title text not null,
  message text not null,
  data jsonb default '{}',
  is_read boolean not null default false,
  read_at timestamptz,
  related_entity_type text,
  related_entity_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notifications_type_check check (type in ('low_attendance','upcoming_exam','overdue_fees','admin_update','general'))
);

create index if not exists notifications_institution_idx on public.notifications (institution_id);
create index if not exists notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (recipient_id, is_read, created_at desc);

drop trigger if exists univora_notifications_set_institution on public.notifications;
create trigger univora_notifications_set_institution before insert on public.notifications for each row execute function public.univora_set_institution_id();

drop trigger if exists univora_notifications_set_updated_at on public.notifications;
create trigger univora_notifications_set_updated_at before update on public.notifications for each row execute function public.univora_set_updated_at();

-- -----------------------------------------------------------------------------
-- Institution settings
-- -----------------------------------------------------------------------------
create table if not exists public.institution_settings (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions (id) on delete cascade,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint institution_settings_institution_key unique (institution_id)
);

create index if not exists institution_settings_institution_idx on public.institution_settings (institution_id);

drop trigger if exists univora_institution_settings_set_institution on public.institution_settings;
create trigger univora_institution_settings_set_institution before insert on public.institution_settings for each row execute function public.univora_set_institution_id();

drop trigger if exists univora_institution_settings_set_updated_at on public.institution_settings;
create trigger univora_institution_settings_set_updated_at before update on public.institution_settings for each row execute function public.univora_set_updated_at();

-- -----------------------------------------------------------------------------
-- User preferences
-- -----------------------------------------------------------------------------
create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions (id) on delete set null,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  preferences jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_preferences_profile_key unique (profile_id)
);

create index if not exists user_preferences_institution_idx on public.user_preferences (institution_id);
create index if not exists user_preferences_profile_idx on public.user_preferences (profile_id);

drop trigger if exists univora_user_preferences_set_institution on public.user_preferences;
create trigger univora_user_preferences_set_institution before insert on public.user_preferences for each row execute function public.univora_set_institution_id();

drop trigger if exists univora_user_preferences_set_updated_at on public.user_preferences;
create trigger univora_user_preferences_set_updated_at before update on public.user_preferences for each row execute function public.univora_set_updated_at();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.notifications enable row level security;
alter table public.institution_settings enable row level security;
alter table public.user_preferences enable row level security;

drop policy if exists notifications_select_self on public.notifications;
create policy notifications_select_self on public.notifications for select to authenticated using (recipient_id = auth.uid() or public.is_admin() and institution_id = public.current_institution_id());

drop policy if exists notifications_insert_admin on public.notifications;
create policy notifications_insert_admin on public.notifications for insert to authenticated with check ((public.is_admin() and institution_id = public.current_institution_id()) or public.is_super_admin());

drop policy if exists notifications_update_self on public.notifications;
create policy notifications_update_self on public.notifications for update to authenticated using (recipient_id = auth.uid() and institution_id = public.current_institution_id()) with check (recipient_id = auth.uid());

drop policy if exists notifications_admin_all on public.notifications;
create policy notifications_admin_all on public.notifications for all to authenticated using ((public.is_admin() and institution_id = public.current_institution_id()) or public.is_super_admin()) with check ((public.is_admin() and institution_id = public.current_institution_id()) or public.is_super_admin());

drop policy if exists institution_settings_admin_all on public.institution_settings;
create policy institution_settings_admin_all on public.institution_settings for all to authenticated using ((public.is_admin() and institution_id = public.current_institution_id()) or public.is_super_admin()) with check ((public.is_admin() and institution_id = public.current_institution_id()) or public.is_super_admin());

drop policy if exists user_preferences_self on public.user_preferences;
create policy user_preferences_self on public.user_preferences for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

grant select, insert, update, delete on public.notifications to authenticated;
grant select, insert, update, delete on public.institution_settings to authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;

commit;
