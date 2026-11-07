-- =====================================================================
-- Kündigung im Stripe-Kundenportal sichtbar machen
--  * cancel_at_period_end: Kündigung zum Ende des Abrechnungszeitraums vorgemerkt
--  * cancel_at: Zeitpunkt, zu dem das Abo endet
-- Die Funktion „stripe-webhook“ füllt die Felder; bei Abo-Ende wird der Status „canceled“.
-- Nur neue Spalten – bestehende Daten bleiben unverändert. Kann mehrfach ausgeführt werden.
-- =====================================================================

alter table public.subscriptions
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists cancel_at timestamptz;

-- Abo-Angaben für die Seite „Abrechnung & Abo“ (eigene Firma, neuester Eintrag)
create or replace function public.get_my_billing_status()
returns table (
  plan text,
  status text,
  trial_ends_at timestamptz,
  expires_at timestamptz,
  cancel_at_period_end boolean,
  cancel_at timestamptz,
  has_stripe_subscription boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select s.plan::text, s.status::text, s.trial_ends_at, s.expires_at,
         coalesce(s.cancel_at_period_end, false), s.cancel_at,
         s.stripe_subscription_id is not null
    from public.subscriptions s
   where s.tenant_id = (select u.tenant_id from public.app_users u where u.auth_user_id = auth.uid() limit 1)
   order by s.id desc
   limit 1;
$$;

revoke all on function public.get_my_billing_status() from public, anon;
grant execute on function public.get_my_billing_status() to authenticated;
