-- Owner-Werbung: Content- & Planungs-Agent – 13.11.2026
-- Teil 1: neue Felder an den Beiträgen + Agent-Einstellungen (nur Plattform-Inhaber, Rolle 1)

alter table public.owner_marketing_posts add column if not exists source text not null default 'manuell';
alter table public.owner_marketing_posts add column if not exists agent_reason text;
alter table public.owner_marketing_posts add column if not exists hook text;
alter table public.owner_marketing_posts add column if not exists channels text[] not null default '{facebook,instagram,linkedin}';
alter table public.owner_marketing_posts add column if not exists approved_at timestamptz;
alter table public.owner_marketing_posts add column if not exists plan_month text;
alter table public.owner_marketing_posts add column if not exists prepare_error text;

alter table public.owner_marketing_posts drop constraint if exists owner_marketing_posts_source_check;
alter table public.owner_marketing_posts add constraint owner_marketing_posts_source_check check (source in ('manuell', 'agent'));

create table if not exists public.owner_marketing_agent (
  id smallint primary key default 1 check (id = 1),
  auto_enabled boolean not null default false,
  per_week smallint not null default 3 check (per_week between 1 and 7),
  weekdays smallint[] not null default '{2,4,6}',
  channels text[] not null default '{facebook,instagram,linkedin}',
  mix jsonb not null default '{"tipp": 40, "funktion": 30, "testphase": 20, "saison": 10}'::jsonb,
  youtube_per_month smallint not null default 0 check (youtube_per_month between 0 and 8),
  last_plan_month text,
  notified_month text,
  updated_at timestamptz not null default now()
);
insert into public.owner_marketing_agent (id) values (1) on conflict (id) do nothing;

alter table public.owner_marketing_agent enable row level security;
drop policy if exists owner_marketing_agent_all on public.owner_marketing_agent;
create policy owner_marketing_agent_all on public.owner_marketing_agent for all to authenticated
  using (public.current_role_id() = 1) with check (public.current_role_id() = 1);
grant select, insert, update on public.owner_marketing_agent to authenticated;
