-- Jahreszahlung („2 Monate geschenkt“) – 17.11.2026
-- Bestehende Monatsabos bleiben unverändert (billing_interval = 'month').

-- ---------- Teil 1: Abrechnungsart im Abo ----------
alter table public.subscriptions
  add column if not exists billing_interval text not null default 'month';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'subscriptions_billing_interval_check') then
    alter table public.subscriptions
      add constraint subscriptions_billing_interval_check check (billing_interval in ('month', 'year'));
  end if;
end $$;

-- ---------- Teil 2: Stripe-Preis je Tarif und Abrechnungsart ----------
create or replace function public.get_stripe_price_id_for_plan_interval(p_plan text, p_interval text)
returns text
language plpgsql
stable
as $$
begin
  if coalesce(p_interval, 'month') = 'month' then
    return public.get_stripe_price_id_for_plan(p_plan);
  end if;
  if p_interval <> 'year' then
    raise exception 'Unbekannte Abrechnungsart: %', p_interval;
  end if;
  return case p_plan
    when 'starter' then 'price_1UcrJ52QOB8iolrWS82CHRL7'
    when 'professional' then 'price_1UcrMP2QOB8iolrW9MrpgL3v'
    when 'business' then 'price_1UcrRQ2QOB8iolrW4FONtK8l'
    when 'enterprise' then 'price_1UcrVJ2QOB8iolrWgKfvSSt4'
    else null
  end;
end;
$$;

-- Umgekehrt: zu welchem Tarif und welcher Abrechnungsart gehört ein Stripe-Preis?
create or replace function public.get_plan_for_stripe_price(p_price_id text)
returns table (plan text, billing_interval text)
language plpgsql
stable
as $$
declare
  p text;
  i text;
begin
  foreach i in array array['month', 'year'] loop
    foreach p in array array['starter', 'professional', 'business', 'enterprise'] loop
      if public.get_stripe_price_id_for_plan_interval(p, i) = p_price_id then
        plan := p;
        billing_interval := i;
        return next;
        return;
      end if;
    end loop;
  end loop;
end;
$$;

-- ---------- Teil 3: Abrechnungsart des eigenen Betriebs lesen (für die Tarifseite) ----------
create or replace function public.my_billing_interval()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select s.billing_interval from public.subscriptions s where s.tenant_id = public.current_tenant_id() limit 1),
    'month'
  );
$$;

revoke all on function public.my_billing_interval() from public, anon;
grant execute on function public.my_billing_interval() to authenticated;
