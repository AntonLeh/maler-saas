-- =====================================================================
-- KI-Telefon: eigene Telefonnummer pro Betrieb (Antrag über Twilio)
-- Neue Tabelle. Schreiben darf nur die Schnittstelle ai-phone-number
-- (Service-Key), Admins dürfen ihren eigenen Antrag nur lesen.
-- Die hochgeladenen Nachweise werden NICHT gespeichert, sondern direkt
-- an Twilio weitergereicht.
-- Kann gefahrlos mehrfach ausgeführt werden.
-- =====================================================================

begin;

create table if not exists public.ai_phone_numbers (
  tenant_id                   bigint primary key references public.tenants(id) on delete cascade,
  -- entwurf | eingereicht | abgelehnt | freigegeben | aktiv | fehler
  status                      text not null default 'entwurf',

  -- Angaben des Betriebs (müssen zum Nachweis passen)
  business_name               text,
  registration_number         text,
  rep_first_name              text,
  rep_last_name               text,
  rep_email                   text,
  website                     text,
  street                      text,
  postal_code                 text,
  city                        text,
  region                      text,
  area_code                   text,   -- Ortsvorwahl ohne 0, z. B. 6571
  document_issue_date         date,

  -- Twilio
  twilio_address_sid          text,
  twilio_end_user_sid         text,
  twilio_document_sids        jsonb not null default '[]'::jsonb,
  twilio_bundle_sid           text,
  bundle_status               text,
  failure_reason              text,
  evaluation                  jsonb,
  twilio_number_sid           text,
  phone_number                text,

  -- ElevenLabs
  elevenlabs_phone_number_id  text,

  last_error                  text,
  submitted_at                timestamptz,
  approved_at                 timestamptz,
  activated_at                timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create index if not exists ai_phone_numbers_bundle_idx on public.ai_phone_numbers (twilio_bundle_sid);

alter table public.ai_phone_numbers enable row level security;

drop policy if exists ai_phone_numbers_admin_select on public.ai_phone_numbers;
create policy ai_phone_numbers_admin_select on public.ai_phone_numbers
  for select
  using (exists (select 1 from public.app_users u where u.auth_user_id = auth.uid() and u.tenant_id = ai_phone_numbers.tenant_id and u.role_id in (1, 2)));

commit;
