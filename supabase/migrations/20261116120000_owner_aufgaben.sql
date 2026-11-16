-- Owner: Aufgaben (To-dos) und Notizzettel – nur für den Plattform-Owner (Rolle 1) – 16.11.2026

-- ---------- Teil 1: Tabellen und Zugriff ----------
create table if not exists public.owner_todos (
  id bigserial primary key,
  title text not null check (char_length(btrim(title)) between 1 and 300),
  category text check (category is null or char_length(category) <= 40),
  due_date date,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.owner_notes (
  id bigserial primary key,
  title text not null default '' check (char_length(title) <= 200),
  body text not null default '' check (char_length(body) <= 20000),
  color text not null default 'gelb' check (color in ('gelb', 'gruen', 'blau', 'rosa')),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.owner_todos enable row level security;
alter table public.owner_notes enable row level security;

drop policy if exists owner_todos_all on public.owner_todos;
create policy owner_todos_all on public.owner_todos for all to authenticated
  using (public.current_role_id() = 1) with check (public.current_role_id() = 1);
drop policy if exists owner_notes_all on public.owner_notes;
create policy owner_notes_all on public.owner_notes for all to authenticated
  using (public.current_role_id() = 1) with check (public.current_role_id() = 1);

grant select, insert, update, delete on public.owner_todos, public.owner_notes to authenticated;
grant usage, select on sequence public.owner_todos_id_seq, public.owner_notes_id_seq to authenticated;
revoke all on public.owner_todos, public.owner_notes from anon;

-- ---------- Teil 2: Startliste (nur wenn noch leer) ----------
insert into public.owner_todos (title, category, due_date)
select t.title, t.category, t.due_date::date
from (values
  ('Ratgeber: Aufmaß für Geschäftskunden', 'Ratgeber', null),
  ('Ratgeber: Software für Malerbetriebe Checkliste', 'Ratgeber', null),
  ('Ratgeber: Wandfläche berechnen Maler', 'Ratgeber', null),
  ('Ratgeber: Aufmaß nach VOB Malerarbeiten', 'Ratgeber', null),
  ('Ratgeber: Stundenverrechnungssatz Maler berechnen', 'Ratgeber', null),
  ('Ratgeber: Farbverbrauch pro m² berechnen', 'Ratgeber', null),
  ('Ratgeber: Angebot Malerarbeiten schreiben', 'Ratgeber', null),
  ('Ratgeber: Stundenzettel Maler Vorlage', 'Ratgeber', null),
  ('Ratgeber: Nachkalkulation Malerbetrieb', 'Ratgeber', null),
  ('Ratgeber: E-Rechnung Pflicht Handwerker 2027', 'Ratgeber', null),
  ('Ratgeber: Abschlagsrechnung Malerarbeiten', 'Ratgeber', null),
  ('Ratgeber: Zahlungserinnerung Mahnung Handwerkerrechnung', 'Ratgeber', null),
  ('Ratgeber: Arbeitszeiterfassung Baustelle Pflicht', 'Ratgeber', null),
  ('Ratgeber: Offerte Malerarbeiten Schweiz', 'Ratgeber', null),
  ('Ratgeber: Aufmaß Malerarbeiten Österreich ÖNORM', 'Ratgeber', null),
  ('Texte für Capterra, OMR Reviews & Co. (Google-Plan Punkt 4)', 'Google', null),
  ('Meta/Instagram einrichten (Profi-Konto, Verknüpfung, 2FA, Sofortantwort, Bio-Link)', 'Instagram', '2026-11-20'),
  ('Antwort der Gestoría einarbeiten', 'Steuer', null)
) as t(title, category, due_date)
where not exists (select 1 from public.owner_todos);
