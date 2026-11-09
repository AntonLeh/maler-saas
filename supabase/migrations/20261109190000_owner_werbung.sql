-- Owner-Werbung (Social Media für MalerSaaS) – 09.11.2026
-- Beiträge (Texte je Kanal, Grafiken, Redaktionsplan). Nur Plattform-Inhaber (Rolle 1).

create table if not exists public.owner_marketing_posts (
  id bigserial primary key,
  topic text not null,
  goal text not null default 'funktion',
  keywords text,
  title text not null default '',
  texts jsonb not null default '{}'::jsonb,
  images jsonb not null default '[]'::jsonb,
  graphic jsonb,
  utm_campaign text,
  status text not null default 'entwurf' check (status in ('entwurf', 'geplant', 'veroeffentlicht')),
  planned_for date,
  published_channels text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists owner_marketing_posts_plan_idx on public.owner_marketing_posts (planned_for);

alter table public.owner_marketing_posts enable row level security;
drop policy if exists owner_marketing_posts_all on public.owner_marketing_posts;
create policy owner_marketing_posts_all on public.owner_marketing_posts for all to authenticated
  using (public.current_role_id() = 1) with check (public.current_role_id() = 1);

insert into storage.buckets (id, name, public)
values ('owner-marketing', 'owner-marketing', false)
on conflict (id) do nothing;

drop policy if exists owner_marketing_files on storage.objects;
create policy owner_marketing_files on storage.objects for all to authenticated
  using (bucket_id = 'owner-marketing' and public.current_role_id() = 1)
  with check (bucket_id = 'owner-marketing' and public.current_role_id() = 1);
