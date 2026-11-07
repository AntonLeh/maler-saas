-- =====================================================================
-- Kontaktformular der Startseite: Nachrichten (Nachweis + Schutz vor Massen-Spam)
-- Schreiben nur die Funktion „contact-form“ (Dienstkonto), lesen nur der Plattform-Inhaber.
-- Die IP-Adresse wird nicht gespeichert, nur ein nicht umkehrbarer Prüfwert (für die Begrenzung).
-- Kann mehrfach ausgeführt werden.
-- =====================================================================

create table if not exists public.contact_messages (
  id          bigserial primary key,
  name        text not null,
  company     text,
  email       text not null,
  phone       text,
  message     text not null,
  ip_hash     text,
  created_at  timestamptz not null default now()
);
create index if not exists contact_messages_created_idx on public.contact_messages (created_at desc);
create index if not exists contact_messages_ip_idx on public.contact_messages (ip_hash, created_at desc);

alter table public.contact_messages enable row level security;

drop policy if exists contact_messages_owner_select on public.contact_messages;
create policy contact_messages_owner_select on public.contact_messages
  for select using (exists (select 1 from public.app_users u where u.auth_user_id = auth.uid() and u.role_id = 1));
