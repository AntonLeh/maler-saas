-- =====================================================================
-- Fachkräfte-Pool: Maler, Helfer und Subunternehmer tragen sich kostenlos ein,
-- Maler-SaaS-Betriebe finden sie in ihrer Nähe und schicken eine Kontaktanfrage.
-- Kontaktdaten sieht ein Betrieb erst, wenn die Fachkraft der Anfrage zustimmt.
--
-- Alle Zugriffe laufen über die Funktion talent-pool (Service-Rolle):
-- Die Tabellen sind für Browser-Zugriffe gesperrt (RLS ohne Richtlinien).
-- Kann gefahrlos mehrfach ausgeführt werden.
-- =====================================================================

begin;

create table if not exists public.talent_profiles (
  id              uuid primary key default gen_random_uuid(),
  status          text not null default 'pending',
  token_hash      text not null unique,
  first_name      text not null,
  last_name       text not null,
  email           text not null,
  phone           text,
  role            text not null,
  wants           text[] not null default '{}',
  skills          text[] not null default '{}',
  company_name    text,
  handwerksrolle  boolean,
  plz             text not null,
  ort             text,
  lat             double precision,
  lon             double precision,
  radius_km       int not null default 30,
  available_from  date,
  driving_license boolean not null default false,
  own_vehicle     boolean not null default false,
  languages       text,
  note            text,
  consent_at      timestamptz not null default now(),
  confirmed_at    timestamptz,
  last_active_at  timestamptz not null default now(),
  reminder_sent_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint talent_profiles_status check (status in ('pending', 'active', 'paused')),
  constraint talent_profiles_role check (role in ('geselle', 'meister', 'helfer', 'azubi', 'sonstiges')),
  constraint talent_profiles_radius check (radius_km between 5 and 500),
  constraint talent_profiles_plz check (plz ~ '^[0-9]{5}$')
);
create unique index if not exists talent_profiles_email_idx on public.talent_profiles (lower(email));
create index if not exists talent_profiles_status_idx on public.talent_profiles (status, last_active_at);

create table if not exists public.talent_contacts (
  id            bigserial primary key,
  profile_id    uuid not null references public.talent_profiles(id) on delete cascade,
  tenant_id     bigint not null references public.tenants(id) on delete cascade,
  requested_by  bigint,
  message       text,
  status        text not null default 'offen',
  token_hash    text not null unique,
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  constraint talent_contacts_status check (status in ('offen', 'angenommen', 'abgelehnt')),
  constraint talent_contacts_once unique (profile_id, tenant_id)
);
create index if not exists talent_contacts_tenant_idx on public.talent_contacts (tenant_id, created_at desc);

-- Zwischenspeicher für Postleitzahl -> Koordinaten (aus OpenStreetMap)
create table if not exists public.talent_geo_cache (
  plz        text primary key,
  lat        double precision,
  lon        double precision,
  ort        text,
  fetched_at timestamptz not null default now()
);

alter table public.talent_profiles enable row level security;
alter table public.talent_contacts enable row level security;
alter table public.talent_geo_cache enable row level security;
revoke all on public.talent_profiles from anon, authenticated;
revoke all on public.talent_contacts from anon, authenticated;
revoke all on public.talent_geo_cache from anon, authenticated;

commit;
