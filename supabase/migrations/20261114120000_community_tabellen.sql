-- Community Stufe 1: Tabellen – 14.11.2026
-- Alles läuft über Funktionen (security definer). Die Tabellen selbst haben RLS ohne Richtlinien = kein direkter Zugriff.

create table if not exists public.community_settings (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default false,          -- false = nur Owner und Beta-Betriebe sehen die Community
  beta_tenants bigint[] not null default '{}',
  rules_version text not null default 'entwurf-2026-11-14',
  updated_at timestamptz not null default now()
);
insert into public.community_settings (id) values (1) on conflict (id) do nothing;

create table if not exists public.community_members (
  id bigserial primary key,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  app_user_id bigint unique references public.app_users(id) on delete cascade,
  tenant_id bigint,
  kind text not null check (kind in ('team', 'betrieb', 'mitarbeiter', 'zulieferer', 'privat')),
  display_name text not null,
  company text,
  trade text,
  region text,
  bio text,
  status text not null default 'wartet' check (status in ('wartet', 'aktiv', 'gesperrt')),
  is_moderator boolean not null default false,
  warnings int not null default 0,
  rules_version text,
  rules_accepted_at timestamptz,
  approved_by bigint,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists community_members_tenant_idx on public.community_members (tenant_id, status);

create table if not exists public.community_posts (
  id bigserial primary key,
  author_id bigint not null references public.community_members(id) on delete cascade,
  kind text not null check (kind in ('frage', 'projekt', 'tipp', 'anzeige')),
  topic text not null,
  body text not null check (char_length(body) between 1 and 5000),
  images text[] not null default '{}',
  status text not null default 'sichtbar' check (status in ('sichtbar', 'pruefung', 'ausgeblendet', 'geloescht')),
  hidden_reason text,
  solution_comment_id bigint,
  helpful_count int not null default 0,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  last_activity_at timestamptz not null default now()
);
create index if not exists community_posts_feed_idx on public.community_posts (status, id desc);
create index if not exists community_posts_author_idx on public.community_posts (author_id);

create table if not exists public.community_comments (
  id bigserial primary key,
  post_id bigint not null references public.community_posts(id) on delete cascade,
  author_id bigint not null references public.community_members(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  status text not null default 'sichtbar' check (status in ('sichtbar', 'pruefung', 'ausgeblendet', 'geloescht')),
  hidden_reason text,
  helpful_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists community_comments_post_idx on public.community_comments (post_id, id);

create table if not exists public.community_reactions (
  id bigserial primary key,
  member_id bigint not null references public.community_members(id) on delete cascade,
  post_id bigint references public.community_posts(id) on delete cascade,
  comment_id bigint references public.community_comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  check ((post_id is null) <> (comment_id is null))
);
create unique index if not exists community_reactions_post_uq on public.community_reactions (member_id, post_id) where post_id is not null;
create unique index if not exists community_reactions_comment_uq on public.community_reactions (member_id, comment_id) where comment_id is not null;

create table if not exists public.community_decisions (
  id bigserial primary key,
  target_type text not null check (target_type in ('post', 'comment', 'member')),
  target_id bigint not null,
  member_id bigint references public.community_members(id) on delete set null,   -- betroffenes Mitglied
  action text not null check (action in ('freigeben', 'ausblenden', 'loeschen', 'verwarnen', 'sperren', 'entsperren')),
  rule text not null,
  note text,
  excerpt text,
  automated boolean not null default false,
  decided_by bigint references public.community_members(id) on delete set null,
  appeal_text text,
  appeal_at timestamptz,
  appeal_result text check (appeal_result in ('bestaetigt', 'aufgehoben')),
  appeal_note text,
  appeal_decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.community_reports (
  id bigserial primary key,
  reporter_id bigint references public.community_members(id) on delete set null,
  target_type text not null check (target_type in ('post', 'comment', 'member')),
  target_id bigint not null,
  reason text not null check (reason in ('beleidigung', 'spam', 'werbung', 'kundendaten', 'rechtswidrig', 'gefahr', 'sonstiges')),
  note text,
  status text not null default 'offen' check (status in ('offen', 'erledigt')),
  decision_id bigint references public.community_decisions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);
create index if not exists community_reports_open_idx on public.community_reports (status, target_type, target_id);

create table if not exists public.community_notices (
  id bigserial primary key,
  member_id bigint not null references public.community_members(id) on delete cascade,
  kind text not null default 'moderation' check (kind in ('moderation', 'meldung', 'antwort', 'loesung', 'freigabe')),
  decision_id bigint references public.community_decisions(id) on delete cascade,
  post_id bigint references public.community_posts(id) on delete cascade,
  text text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists community_notices_member_idx on public.community_notices (member_id, id desc);

alter table public.community_settings enable row level security;
alter table public.community_members enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_reactions enable row level security;
alter table public.community_decisions enable row level security;
alter table public.community_reports enable row level security;
alter table public.community_notices enable row level security;
