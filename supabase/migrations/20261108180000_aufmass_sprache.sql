-- =====================================================================
-- Aufmaß per Sprache: Zähler je Diktat (für das Monatslimit)
-- Gespeichert werden nur Firma, Benutzer, Zeitpunkt und Textlänge – keine Aufnahme, kein Text.
-- Nur die Server-Funktion schreibt hier (Zugriffsregeln: kein Zugriff aus der App).
-- Kann mehrfach ausgeführt werden.
-- =====================================================================

create table if not exists public.aufmass_voice_log (
  id bigserial primary key,
  tenant_id bigint not null references public.tenants(id) on delete cascade,
  user_id bigint references public.app_users(id) on delete set null,
  chars integer,
  created_at timestamptz not null default now()
);

create index if not exists aufmass_voice_log_tenant_month on public.aufmass_voice_log (tenant_id, created_at);

alter table public.aufmass_voice_log enable row level security;
-- bewusst keine Regeln: nur der Server (Service-Schlüssel) liest und schreibt
