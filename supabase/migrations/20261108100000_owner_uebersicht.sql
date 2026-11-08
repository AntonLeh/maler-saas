-- =====================================================================
-- Owner-Dashboard: alle Kennzahlen je Firma in EINER Abfrage (statt 4 Abfragen pro Firma)
--  * owner_overview(): nur für den Plattform-Inhaber (role_id = 1)
--  * liefert je Firma: Stammdaten, aktuelles Abo, Nutzung (Anzahl), letzte Anmeldung,
--    KI-Verbrauch im laufenden Monat, Website-Status, Zustimmungsnachweis (AGB/AVV)
--  * KEINE Umsätze der Kunden (AVV § 2 Abs. 4: keine Nutzung für eigene Zwecke)
-- Ändert keine Tabellen. Kann mehrfach ausgeführt werden.
-- =====================================================================

create or replace function public.owner_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_month timestamptz := date_trunc('month', now());
  v_result jsonb;
begin
  if not exists (select 1 from public.app_users u where u.auth_user_id = auth.uid() and u.role_id = 1) then
    raise exception 'Nur für den Plattform-Inhaber.';
  end if;

  select coalesce(jsonb_agg(row_data order by (row_data ->> 'created_at') desc), '[]'::jsonb)
    into v_result
    from (
      select jsonb_build_object(
        'id', t.id,
        'company_name', t.company_name,
        'email', t.email,
        'phone', t.phone,
        'city', t.city,
        'country', t.country,
        'status', t.status,
        'created_at', t.created_at,
        'is_platform', exists (select 1 from public.app_users o where o.tenant_id = t.id and o.role_id = 1),
        'subscription', (
          select jsonb_build_object(
            'id', s.id, 'plan', s.plan, 'status', s.status, 'monthly_price', s.monthly_price, 'currency', s.currency,
            'trial_ends_at', s.trial_ends_at, 'expires_at', s.expires_at,
            'cancel_at_period_end', s.cancel_at_period_end, 'cancel_at', s.cancel_at,
            'has_stripe', s.stripe_subscription_id is not null
          )
            from public.subscriptions s
           where s.tenant_id = t.id
           order by s.id desc
           limit 1
        ),
        'users', (select count(*) from public.app_users u where u.tenant_id = t.id and coalesce(u.is_active, true)),
        'customers', (select count(*) from public.customers c where c.tenant_id = t.id),
        'orders', (select count(*) from public.orders o where o.tenant_id = t.id),
        'invoices', (select count(*) from public.invoices i where i.tenant_id = t.id),
        'last_sign_in', (
          select max(au.last_sign_in_at)
            from public.app_users u
            join auth.users au on au.id = u.auth_user_id
           where u.tenant_id = t.id
        ),
        'phone_balance_seconds', (select b.balance_seconds from public.ai_phone_billing b where b.tenant_id = t.id),
        'phone_seconds_month', (
          select coalesce(sum(-l.delta_seconds), 0) from public.ai_minute_ledger l
           where l.tenant_id = t.id and l.reason = 'gespraech' and l.created_at >= v_month
        ),
        'ai_texts_month', (select count(*) from public.website_ai_usage w where w.tenant_id = t.id and w.created_at >= v_month),
        'ai_receipts_month', (select count(*) from public.expense_ai_log e where e.tenant_id = t.id and e.created_at >= v_month),
        'website', (
          select jsonb_build_object('slug', w.slug, 'published', w.published, 'custom_domain', w.custom_domain)
            from public.websites w where w.tenant_id = t.id
        ),
        'legal', (
          select au.raw_user_meta_data -> 'legal_accepted'
            from public.app_users u
            join auth.users au on au.id = u.auth_user_id
           where u.tenant_id = t.id and au.raw_user_meta_data ->> 'signup_type' = 'company'
           order by au.created_at
           limit 1
        )
      ) as row_data
      from public.tenants t
    ) x;

  return v_result;
end;
$$;

revoke all on function public.owner_overview() from public, anon;
grant execute on function public.owner_overview() to authenticated;
