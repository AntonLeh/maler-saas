-- =====================================================================
-- Löschfristen (AGB Punkt 21): 30 Tage nach Ende der Testphase bzw. nach Vertragsende
--  * tenant_deletion_schedule(): Liste aller Firmen mit Ende-Datum und Löschdatum (nur Plattform-Inhaber)
--  * tenant_deletion_due(): dieselbe Liste für die Server-Funktion „deletion-check“ (nur Dienstkonto)
--  * tenant_deletion_warnings: wann welche Firma per E-Mail vorgewarnt wurde
-- Gelöscht wird weiterhin von Hand im Owner-Dashboard. Kann mehrfach ausgeführt werden.
-- =====================================================================

create table if not exists public.tenant_deletion_warnings (
  tenant_id   bigint primary key references public.tenants(id) on delete cascade,
  due_at      timestamptz not null,
  warned_at   timestamptz not null default now(),
  email       text
);
alter table public.tenant_deletion_warnings enable row level security;
-- keine Regeln: nur Dienstkonto bzw. die Funktionen unten

-- gemeinsame Berechnung
create or replace function public.tenant_deletion_list()
returns table (
  tenant_id bigint,
  company_name text,
  email text,
  plan text,
  status text,
  ended_at timestamptz,
  due_at timestamptz,
  reason text,
  warned_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with sub as (
    select distinct on (s.tenant_id) s.*
      from public.subscriptions s
     order by s.tenant_id, s.id desc
  ),
  base as (
    select
      t.id as tenant_id,
      coalesce(nullif(cs.company_name, ''), nullif(t.company_name, ''), 'Firma ' || t.id) as company_name,
      coalesce(nullif(cs.email, ''), (select u.email from public.app_users u where u.tenant_id = t.id and u.role_id = 2 and u.email is not null order by u.id limit 1)) as email,
      sub.plan::text as plan,
      sub.status::text as status,
      case
        -- Abo beendet / gekündigt
        when sub.status in ('canceled', 'cancelled', 'expired', 'unpaid', 'incomplete_expired') then coalesce(sub.expires_at, sub.updated_at)
        -- Testphase ohne Abo abgelaufen
        when sub.status = 'trialing' and sub.stripe_subscription_id is null and sub.trial_ends_at is not null and sub.trial_ends_at < now() then sub.trial_ends_at
        -- gar kein Abo-Eintrag
        when sub.tenant_id is null then t.created_at
        else null
      end as ended_at,
      case
        when sub.status in ('canceled', 'cancelled', 'expired', 'unpaid', 'incomplete_expired') then 'Abo beendet'
        when sub.status = 'trialing' and sub.stripe_subscription_id is null and sub.trial_ends_at is not null and sub.trial_ends_at < now() then 'Testphase abgelaufen'
        when sub.tenant_id is null then 'kein Abo'
        else null
      end as reason
    from public.tenants t
    left join sub on sub.tenant_id = t.id
    left join public.company_settings cs on cs.tenant_id = t.id
    -- die Plattform-Firma selbst nie
    where not exists (select 1 from public.app_users o where o.tenant_id = t.id and o.role_id = 1)
  )
  select b.tenant_id, b.company_name, b.email, b.plan, b.status, b.ended_at,
         b.ended_at + interval '30 days' as due_at, b.reason, w.warned_at
    from base b
    left join public.tenant_deletion_warnings w on w.tenant_id = b.tenant_id
   where b.ended_at is not null
   order by b.ended_at + interval '30 days';
$$;

revoke all on function public.tenant_deletion_list() from public, anon, authenticated;
grant execute on function public.tenant_deletion_list() to service_role;

-- für das Owner-Dashboard (prüft den Plattform-Inhaber)
drop function if exists public.tenant_deletion_schedule();

create function public.tenant_deletion_schedule()
returns table (
  tenant_id bigint,
  company_name text,
  email text,
  plan text,
  status text,
  ended_at timestamptz,
  due_at timestamptz,
  reason text,
  warned_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.app_users u where u.auth_user_id = auth.uid() and u.role_id = 1) then
    raise exception 'Nur für den Plattform-Inhaber.';
  end if;
  return query select * from public.tenant_deletion_list();
end;
$$;

revoke all on function public.tenant_deletion_schedule() from public, anon;
grant execute on function public.tenant_deletion_schedule() to authenticated;
