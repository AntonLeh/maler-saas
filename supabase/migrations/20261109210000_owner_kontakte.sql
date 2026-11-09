-- Owner: Kontakte & Anschreiben (Innungen, Kammern, Verbände) – 09.11.2026
-- Erstkontakt per Brief; E-Mail nur mit dokumentierter Grundlage (Antwort, Anfrage, Einwilligung).
-- Nur Plattform-Inhaber (Rolle 1).

create table if not exists public.owner_contacts (
  id bigserial primary key,
  organisation text not null,
  kind text not null default 'innung' check (kind in ('innung', 'kammer', 'landesverband', 'fachverband', 'presse', 'sonstiges')),
  country text not null default 'DE' check (country in ('DE', 'AT', 'CH')),
  region text,
  salutation text check (salutation in ('herr', 'frau', '') or salutation is null),
  title text,
  first_name text,
  last_name text,
  position text,
  street text,
  zip text,
  city text,
  email text,
  phone text,
  website text,
  source text,
  status text not null default 'neu' check (status in ('neu', 'brief', 'antwort', 'gespraech', 'partner', 'kein_interesse')),
  next_followup date,
  blocked boolean not null default false,
  blocked_at timestamptz,
  blocked_reason text,
  consent_basis text check (consent_basis in ('antwort', 'anfrage', 'einwilligung') or consent_basis is null),
  consent_date date,
  consent_note text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists owner_contacts_status_idx on public.owner_contacts (status);

create table if not exists public.owner_contact_events (
  id bigserial primary key,
  contact_id bigint not null references public.owner_contacts (id) on delete cascade,
  kind text not null check (kind in ('brief', 'brief_pingen', 'email', 'notiz', 'status', 'einwilligung', 'sperre')),
  subject text,
  body text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists owner_contact_events_contact_idx on public.owner_contact_events (contact_id, created_at desc);

create table if not exists public.owner_outreach_templates (
  id bigserial primary key,
  kind text not null check (kind in ('brief', 'email')),
  name text not null,
  subject text not null default '',
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.owner_contacts enable row level security;
alter table public.owner_contact_events enable row level security;
alter table public.owner_outreach_templates enable row level security;

drop policy if exists owner_contacts_all on public.owner_contacts;
create policy owner_contacts_all on public.owner_contacts for all to authenticated
  using (public.current_role_id() = 1) with check (public.current_role_id() = 1);

drop policy if exists owner_contact_events_all on public.owner_contact_events;
create policy owner_contact_events_all on public.owner_contact_events for all to authenticated
  using (public.current_role_id() = 1) with check (public.current_role_id() = 1);

drop policy if exists owner_outreach_templates_all on public.owner_outreach_templates;
create policy owner_outreach_templates_all on public.owner_outreach_templates for all to authenticated
  using (public.current_role_id() = 1) with check (public.current_role_id() = 1);
