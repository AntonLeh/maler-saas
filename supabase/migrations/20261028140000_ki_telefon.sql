-- =====================================================================
-- Modul: KI-Telefon (nur Business / Enterprise)
-- Neue Tabellen + 3 neue Spalten in der Termin-Tabelle "appointments"
-- (die gehört zum Terminkalender-Modul). Andere Tabellen bleiben unverändert.
-- Ausführen: Supabase Dashboard -> SQL Editor -> Inhalt einfügen -> Run
-- Die Datei kann gefahrlos mehrfach ausgeführt werden.
-- =====================================================================

begin;

-- ---------------------------------------------------------------
-- Termine: Herkunft und Kontaktdaten des Anrufers
-- ---------------------------------------------------------------
alter table public.appointments add column if not exists source        text not null default 'manuell';
alter table public.appointments add column if not exists contact_name  text;
alter table public.appointments add column if not exists contact_phone text;

-- ---------------------------------------------------------------
-- Einstellungen pro Betrieb
-- ---------------------------------------------------------------
create table if not exists public.ai_phone_settings (
  tenant_id               bigint primary key references public.tenants(id) on delete cascade,
  enabled                 boolean not null default false,
  -- geheimer Schlüssel für die Schnittstellen-Adresse (identifiziert den Betrieb)
  webhook_key             text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  phone_number            text,
  company_name            text,
  greeting                text,
  assistant_instructions  text,
  timezone                text not null default 'Europe/Berlin',
  visit_duration_minutes  integer not null default 60  check (visit_duration_minutes between 15 and 480),
  buffer_minutes          integer not null default 30  check (buffer_minutes between 0 and 240),
  min_notice_hours        integer not null default 24  check (min_notice_hours between 0 and 336),
  booking_horizon_days    integer not null default 21  check (booking_horizon_days between 1 and 90),
  slot_step_minutes       integer not null default 30  check (slot_step_minutes between 15 and 120),
  -- Wochentag (1 = Montag ... 7 = Sonntag) -> Liste von Zeitfenstern ["von","bis"]
  availability            jsonb   not null default '{"1":[["09:00","12:00"],["13:00","17:00"]],"2":[["09:00","12:00"],["13:00","17:00"]],"3":[["09:00","12:00"],["13:00","17:00"]],"4":[["09:00","12:00"],["13:00","17:00"]],"5":[["09:00","13:00"]],"6":[],"7":[]}'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- Rückrufwünsche
-- ---------------------------------------------------------------
create table if not exists public.ai_callback_requests (
  id                bigint generated always as identity primary key,
  tenant_id         bigint not null references public.tenants(id) on delete cascade,
  caller_name       text,
  caller_phone      text,
  concern           text,
  preferred_time    text,
  status            text not null default 'offen',
  provider_call_id  text,
  handled_by        bigint references public.app_users(id) on delete set null,
  handled_at        timestamptz,
  note              text,
  created_at        timestamptz not null default now(),
  constraint ai_callback_status_check check (status in ('offen', 'erledigt'))
);

create index if not exists ai_callback_tenant_idx on public.ai_callback_requests (tenant_id, status, created_at desc);

-- ---------------------------------------------------------------
-- Anrufprotokoll (Zusammenfassung, Dauer -> Minutenabrechnung)
-- ---------------------------------------------------------------
create table if not exists public.ai_calls (
  id                bigint generated always as identity primary key,
  tenant_id         bigint not null references public.tenants(id) on delete cascade,
  provider          text not null default 'unbekannt',
  provider_call_id  text not null,
  caller_number     text,
  started_at        timestamptz,
  ended_at          timestamptz,
  duration_seconds  integer,
  summary           text,
  outcome           text,
  appointment_id    bigint references public.appointments(id) on delete set null,
  callback_id       bigint references public.ai_callback_requests(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint ai_calls_unique_call unique (tenant_id, provider_call_id)
);

create index if not exists ai_calls_tenant_idx on public.ai_calls (tenant_id, created_at desc);

-- ---------------------------------------------------------------
-- Zugriffsrechte: Admins (role_id 1, 2) des eigenen Betriebs.
-- Die Schnittstelle (Edge Function) arbeitet mit dem Service-Key.
-- ---------------------------------------------------------------
alter table public.ai_phone_settings    enable row level security;
alter table public.ai_callback_requests enable row level security;
alter table public.ai_calls             enable row level security;

drop policy if exists ai_phone_settings_admin on public.ai_phone_settings;
create policy ai_phone_settings_admin on public.ai_phone_settings
  for all
  using (exists (select 1 from public.app_users u where u.auth_user_id = auth.uid() and u.tenant_id = ai_phone_settings.tenant_id and u.role_id in (1, 2)))
  with check (exists (select 1 from public.app_users u where u.auth_user_id = auth.uid() and u.tenant_id = ai_phone_settings.tenant_id and u.role_id in (1, 2)));

drop policy if exists ai_callback_admin on public.ai_callback_requests;
create policy ai_callback_admin on public.ai_callback_requests
  for all
  using (exists (select 1 from public.app_users u where u.auth_user_id = auth.uid() and u.tenant_id = ai_callback_requests.tenant_id and u.role_id in (1, 2)))
  with check (exists (select 1 from public.app_users u where u.auth_user_id = auth.uid() and u.tenant_id = ai_callback_requests.tenant_id and u.role_id in (1, 2)));

drop policy if exists ai_calls_admin_select on public.ai_calls;
create policy ai_calls_admin_select on public.ai_calls
  for select
  using (exists (select 1 from public.app_users u where u.auth_user_id = auth.uid() and u.tenant_id = ai_calls.tenant_id and u.role_id in (1, 2)));

commit;
