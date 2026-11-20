-- Neue Preise und Zusatzmitarbeiter – 20.11.2026
-- Starter 3 / Professional 6 / Business 9 / Enterprise 12 Mitarbeiter mit App-Zugang,
-- jeder weitere Mitarbeiter mit App-Zugang 19 € im Monat (190 € im Jahr).
-- Business 220 € statt 399 €, Enterprise 349 € statt 799 €.
-- Kann gefahrlos mehrfach ausgeführt werden.

-- ---------- Teil 1: Zusatzplätze im Abo ----------
alter table public.subscriptions
  add column if not exists extra_seats integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'subscriptions_extra_seats_check') then
    alter table public.subscriptions
      add constraint subscriptions_extra_seats_check check (extra_seats between 0 and 500);
  end if;
end $$;

-- Mitarbeiter mit App-Zugang, die im Tarif enthalten sind
create or replace function public.plan_base_users(p_plan text)
returns integer
language sql
immutable
as $$
  select case p_plan
    when 'starter' then 3
    when 'professional' then 6
    when 'business' then 9
    when 'enterprise' then 12
    else 3
  end;
$$;

-- ---------- Teil 2: Stripe-Preise (monatlich) ----------
create or replace function public.get_stripe_price_id_for_plan(p_plan text)
returns text
language plpgsql
as $$
begin
  if p_plan = 'starter' then return 'price_1U935f2QOB8iolrWZzQQlchr'; end if;
  if p_plan = 'professional' then return 'price_1U935f2QOB8iolrWvG3ND1a3'; end if;
  if p_plan = 'business' then return 'price_1Udqnl2QOB8iolrWAwc5SbzV'; end if;      -- 220 €
  if p_plan = 'enterprise' then return 'price_1Udqs12QOB8iolrWHG1zbAZV'; end if;    -- 349 €
  raise exception 'Unbekannter Plan: %', p_plan;
end;
$$;

-- ---------- Teil 3: Stripe-Preise (jährlich) ----------
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
    when 'starter' then 'price_1UcrJ52QOB8iolrWS82CHRL7'        -- 790 €
    when 'professional' then 'price_1UcrMP2QOB8iolrW9MrpgL3v'   -- 1.490 €
    when 'business' then 'price_1Udqoh2QOB8iolrWZ7sC077X'       -- 2.200 €
    when 'enterprise' then 'price_1Udqtx2QOB8iolrWEAjE5g0H'     -- 3.490 €
    else null
  end;
end;
$$;

-- Zusätzlicher Mitarbeiter: 19 € im Monat bzw. 190 € im Jahr
create or replace function public.get_stripe_seat_price_id(p_interval text)
returns text
language sql
immutable
as $$
  select case when p_interval = 'year'
    then 'price_1UdqzZ2QOB8iolrWYIWhMqvq'
    else 'price_1Udqx52QOB8iolrWn7FkS322'
  end;
$$;

-- ---------- Teil 4: Tarif setzen (Limits neu, Zusatzplätze werden dazugezählt) ----------
-- Funktionen je Tarif bleiben unverändert.
create or replace function public.upgrade_subscription(p_tenant_id bigint, p_plan text)
returns void
language plpgsql
as $function$
declare
  base_features jsonb := jsonb_build_object(
    'customers', jsonb_build_object('enabled', true, 'status', 'active'),
    'employees', jsonb_build_object('enabled', true, 'status', 'active'),
    'quotes', jsonb_build_object('enabled', true, 'status', 'active'),
    'quotePdf', jsonb_build_object('enabled', true, 'status', 'active'),
    'orders', jsonb_build_object('enabled', true, 'status', 'active'),
    'timeTracking', jsonb_build_object('enabled', true, 'status', 'active'),
    'progressNotes', jsonb_build_object('enabled', true, 'status', 'active'),
    'progressImages', jsonb_build_object('enabled', true, 'status', 'active'),
    'invoices', jsonb_build_object('enabled', true, 'status', 'active'),
    'invoicePdf', jsonb_build_object('enabled', true, 'status', 'active')
  );
  on_ jsonb := jsonb_build_object('enabled', true, 'status', 'active');
  off_ jsonb := jsonb_build_object('enabled', false, 'status', 'locked');
  v_price numeric;
  v_storage integer;
  v_images integer;
  v_extra jsonb;
begin
  if p_plan = 'starter' then
    v_price := 79.00; v_storage := 5; v_images := 500;
    v_extra := jsonb_build_object('customerPortal', off_, 'materials', off_, 'projectManagers', off_,
                                  'advancedReports', off_, 'whiteLabel', off_, 'apiAccess', off_);
  elsif p_plan = 'professional' then
    v_price := 149.00; v_storage := 50; v_images := 5000;
    v_extra := jsonb_build_object('customerPortal', on_, 'materials', on_, 'projectManagers', on_,
                                  'advancedReports', on_, 'whiteLabel', off_, 'apiAccess', off_);
  elsif p_plan = 'business' then
    v_price := 220.00; v_storage := 250; v_images := 25000;
    v_extra := jsonb_build_object('customerPortal', on_, 'materials', on_, 'projectManagers', on_,
                                  'advancedReports', on_, 'whiteLabel', off_, 'apiAccess', on_);
  elsif p_plan = 'enterprise' then
    v_price := 349.00; v_storage := 1000; v_images := 100000;
    v_extra := jsonb_build_object('customerPortal', on_, 'materials', on_, 'projectManagers', on_,
                                  'advancedReports', on_, 'whiteLabel', on_, 'apiAccess', on_);
  else
    return; -- unbekannter Tarif: nichts ändern (wie bisher)
  end if;

  update public.subscriptions
  set
    plan = p_plan,
    monthly_price = v_price,
    max_users = public.plan_base_users(p_plan) + coalesce(extra_seats, 0),
    storage_limit_gb = v_storage,
    image_limit = v_images,
    features = base_features || v_extra
  where tenant_id = p_tenant_id;
end;
$function$;

-- ---------- Teil 5: Zusatzplätze setzen (nur Server-Funktionen) ----------
create or replace function public.set_extra_seats(p_tenant_id bigint, p_seats integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.subscriptions
  set extra_seats = greatest(0, least(500, coalesce(p_seats, 0))),
      max_users = public.plan_base_users(plan) + greatest(0, least(500, coalesce(p_seats, 0)))
  where tenant_id = p_tenant_id;
end;
$$;

-- Diese Funktionen dürfen nur die Server-Funktionen (Stripe) aufrufen, nicht angemeldete Nutzer.
revoke all on function public.set_extra_seats(bigint, integer) from public, anon, authenticated;
grant execute on function public.set_extra_seats(bigint, integer) to service_role;
revoke all on function public.activate_subscription_plan(bigint, text) from public, anon, authenticated;
grant execute on function public.activate_subscription_plan(bigint, text) to service_role;

-- Bestehende Abos auf die neuen Grenzen bringen (Preise nur für Anzeige/Statistik)
update public.subscriptions
set max_users = public.plan_base_users(plan) + coalesce(extra_seats, 0),
    monthly_price = case plan when 'business' then 220.00 when 'enterprise' then 349.00 else monthly_price end
where plan in ('starter', 'professional', 'business', 'enterprise');

-- Abo-Daten des eigenen Betriebs für die Anzeige (Zusatzplätze, Mitarbeiter mit Zugang)
create or replace function public.my_seat_info()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'plan', s.plan,
    'extra_seats', coalesce(s.extra_seats, 0),
    'max_users', s.max_users,
    'base_users', public.plan_base_users(s.plan)
  )
  from public.subscriptions s
  where s.tenant_id = public.current_tenant_id()
  order by s.id desc
  limit 1;
$$;

revoke all on function public.my_seat_info() from public, anon;
grant execute on function public.my_seat_info() to authenticated;
