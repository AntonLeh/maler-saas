-- =====================================================================
-- Hilfe-Chat auf maler-saas.com (Besucher der Startseite + angemeldete Kunden in der App)
-- Verläufe werden nach 90 Tagen automatisch gelöscht (durch die Funktion help-chat).
-- Nur der Server (Service-Rolle) greift darauf zu – keine Richtlinien = kein Zugriff aus dem Browser.
-- Kann mehrfach ausgeführt werden.
-- =====================================================================

create table if not exists public.help_chats (
  id uuid primary key default gen_random_uuid(),
  mode text not null default 'public' check (mode in ('public', 'app')),
  tenant_id bigint references public.tenants(id) on delete cascade,
  page text,
  messages jsonb not null default '[]'::jsonb,
  bot_replies integer not null default 0,
  support_sent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists help_chats_created_idx on public.help_chats (created_at);
create index if not exists help_chats_updated_idx on public.help_chats (updated_at);

alter table public.help_chats enable row level security;
revoke all on public.help_chats from anon, authenticated;
