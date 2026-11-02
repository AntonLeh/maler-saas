-- =====================================================================
-- Modul Website: KI-Schreibhilfe – Zähler für das Monatslimit
-- Einträge schreibt nur die Funktion website-ai-text (Service-Rolle).
-- Admins können die eigene Nutzung lesen. Kann gefahrlos mehrfach ausgeführt werden.
-- =====================================================================

begin;

create table if not exists public.website_ai_usage (
  id             bigserial primary key,
  tenant_id      bigint not null references public.tenants(id) on delete cascade,
  user_id        bigint,
  kind           text not null,
  model          text,
  input_tokens   int,
  output_tokens  int,
  created_at     timestamptz not null default now()
);
create index if not exists website_ai_usage_tenant_idx on public.website_ai_usage (tenant_id, created_at desc);

alter table public.website_ai_usage enable row level security;
drop policy if exists website_ai_usage_admin_select on public.website_ai_usage;
create policy website_ai_usage_admin_select on public.website_ai_usage
  for select using (public.website_is_admin(tenant_id));
grant select on public.website_ai_usage to authenticated;

commit;
