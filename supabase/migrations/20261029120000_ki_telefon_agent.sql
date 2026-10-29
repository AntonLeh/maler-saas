-- =====================================================================
-- KI-Telefon: automatisch angelegter KI-Agent pro Betrieb
-- Neue Tabelle. Schreiben darf nur die Schnittstelle (Service-Key),
-- Admins dürfen ihren eigenen Eintrag nur lesen.
-- Kann gefahrlos mehrfach ausgeführt werden.
-- =====================================================================

begin;

create table if not exists public.ai_phone_agents (
  tenant_id     bigint primary key references public.tenants(id) on delete cascade,
  provider      text not null default 'elevenlabs',
  agent_id      text,
  tool_ids      jsonb not null default '{}'::jsonb,
  phone_number  text,
  status        text not null default 'neu',
  last_error    text,
  synced_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.ai_phone_agents enable row level security;

drop policy if exists ai_phone_agents_admin_select on public.ai_phone_agents;
create policy ai_phone_agents_admin_select on public.ai_phone_agents
  for select
  using (exists (select 1 from public.app_users u where u.auth_user_id = auth.uid() and u.tenant_id = ai_phone_agents.tenant_id and u.role_id in (1, 2)));

commit;
