-- =====================================================================
-- Nachweis der Zustimmung zu AGB, AVV und Datenschutz bei der Registrierung
--  * Die App speichert bei der Registrierung, welche Fassung (Stand-Datum) akzeptiert wurde
--    – in den Anmeldedaten des Zugangs (auth.users, Feld legal_accepted).
--  * Zeitpunkt = Anlage des Zugangs (vom Server gesetzt, nicht vom Browser).
--  * legal_acceptances() listet das für alle Firmen auf – nur im SQL-Editor bzw. für das Dienstkonto.
-- Ändert keine Tabellen. Kann mehrfach ausgeführt werden.
--
-- Abfrage im SQL-Editor:
--   select * from public.legal_acceptances();
--   select * from public.legal_acceptances() where company_name ilike '%Muster%';
-- =====================================================================

create or replace function public.legal_acceptances()
returns table (
  tenant_id bigint,
  company_name text,
  email text,
  accepted_at timestamptz,
  agb text,
  avv text,
  datenschutz text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.tenant_id,
    coalesce(nullif(t.company_name, ''), u.raw_user_meta_data ->> 'company_name') as company_name,
    u.email::text,
    u.created_at as accepted_at,
    coalesce(u.raw_user_meta_data -> 'legal_accepted' ->> 'agb', 'vor Einführung des Nachweises') as agb,
    coalesce(u.raw_user_meta_data -> 'legal_accepted' ->> 'avv', 'vor Einführung des Nachweises') as avv,
    coalesce(u.raw_user_meta_data -> 'legal_accepted' ->> 'datenschutz', 'vor Einführung des Nachweises') as datenschutz
  from auth.users u
  left join public.app_users a on a.auth_user_id = u.id
  left join public.tenants t on t.id = a.tenant_id
  where u.raw_user_meta_data ->> 'signup_type' = 'company'
  order by u.created_at desc;
$$;

revoke all on function public.legal_acceptances() from public, anon, authenticated;
grant execute on function public.legal_acceptances() to service_role;
