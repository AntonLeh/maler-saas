-- Mitarbeiter: Austritt eintragen statt löschen (Stunden bleiben erhalten) – 10.11.2026
alter table public.app_users add column if not exists exit_date date;
alter table public.app_users add column if not exists exit_reason text;
