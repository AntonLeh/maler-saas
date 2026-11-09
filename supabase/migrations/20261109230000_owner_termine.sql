-- Owner: Terminkalender (eigene Termine des Plattform-Inhabers) – 09.11.2026
-- Nur Rolle 1. Abo-Link (iCal) über Edge Function owner-calendar mit geheimem Token.

create table if not exists public.owner_appointments (
  id bigserial primary key,
  title text not null,
  kind text not null default 'sonstiges' check (kind in ('innung', 'vorfuehrung', 'gestoria', 'steuer', 'privat', 'sonstiges')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  location text,
  url text,
  notes text,
  contact_id bigint references public.owner_contacts (id) on delete set null,
  recur text not null default 'none' check (recur in ('none', 'weekly', 'monthly', 'quarterly', 'yearly')),
  recur_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint owner_appointments_time_check check (ends_at >= starts_at)
);
create index if not exists owner_appointments_starts_idx on public.owner_appointments (starts_at);
create index if not exists owner_appointments_contact_idx on public.owner_appointments (contact_id);

create table if not exists public.owner_calendar_feed (
  id smallint primary key default 1 check (id = 1),
  token text not null check (length(token) >= 32),
  created_at timestamptz not null default now()
);

alter table public.owner_appointments enable row level security;
alter table public.owner_calendar_feed enable row level security;

drop policy if exists owner_appointments_all on public.owner_appointments;
create policy owner_appointments_all on public.owner_appointments for all to authenticated
  using (public.current_role_id() = 1) with check (public.current_role_id() = 1);

drop policy if exists owner_calendar_feed_all on public.owner_calendar_feed;
create policy owner_calendar_feed_all on public.owner_calendar_feed for all to authenticated
  using (public.current_role_id() = 1) with check (public.current_role_id() = 1);
