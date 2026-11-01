-- =====================================================================
-- KI-Telefon: Benachrichtigung per E-Mail / SMS
-- Ergänzt nur die Tabelle ai_phone_settings (gehört zum KI-Telefon-Modul).
-- Kann gefahrlos mehrfach ausgeführt werden.
-- =====================================================================

begin;

alter table public.ai_phone_settings add column if not exists notify_email              text;
alter table public.ai_phone_settings add column if not exists notify_phone              text;
alter table public.ai_phone_settings add column if not exists notify_callback_email     boolean not null default true;
alter table public.ai_phone_settings add column if not exists notify_callback_sms       boolean not null default false;
alter table public.ai_phone_settings add column if not exists notify_appointment_email  boolean not null default true;
alter table public.ai_phone_settings add column if not exists notify_appointment_sms    boolean not null default false;

commit;
