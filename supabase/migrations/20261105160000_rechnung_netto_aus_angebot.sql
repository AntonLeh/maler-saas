-- =====================================================================
-- Rechnungen: Betrag aus dem Netto-Betrag des Angebots + aktuellem Steuersatz
-- (bisher: Bruttobetrag des Angebots mit dem heutigen Satz zurückgerechnet -> Netto passte nicht zu den Positionen,
--  wenn das Angebot mit einem anderen Steuersatz erstellt wurde).
-- Außerdem: Angebot (mit Rabatt) wird in die eingefrorenen Angaben übernommen.
-- Setzt 20261105150000_rechnungen_rechtssicher.sql voraus. Kann mehrfach ausgeführt werden.
-- =====================================================================

create or replace function public.invoices_freeze()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_company jsonb;
  v_customer jsonb;
  v_order jsonb;
  v_quote_id bigint;
  v_quote jsonb;
  v_items jsonb := '[]'::jsonb;
  v_partials jsonb := '[]'::jsonb;
  v_private boolean;
  v_rc boolean;
  v_share numeric;
  v_rate numeric;
  v_paid_net numeric;
  v_open_net numeric;
  v_override text;
begin
  -- Stornorechnungen bringen ihre Angaben selbst mit
  if new.document_type = 'cancellation' then
    return new;
  end if;
  if new.snapshot is not null then
    return new;
  end if;

  select to_jsonb(cs) into v_company from public.company_settings cs where cs.tenant_id = new.tenant_id order by cs.id desc limit 1;
  select to_jsonb(c) into v_customer from public.customers c where c.id = new.customer_id and c.tenant_id = new.tenant_id;
  select to_jsonb(o) into v_order from public.orders o where o.id = new.order_id and o.tenant_id = new.tenant_id;

  -- Positionen aus dem angenommenen Angebot (wie bisher im PDF)
  v_quote_id := coalesce(
    nullif(v_order->>'accepted_quote_id', '')::bigint,
    nullif(v_order->>'quote_id', '')::bigint,
    nullif(v_order->>'generated_quote_id', '')::bigint
  );
  if v_quote_id is null and new.order_id is not null then
    select q.id into v_quote_id from public.quotes q
    where q.order_id = new.order_id and q.tenant_id = new.tenant_id and q.status = 'accepted'
    order by q.created_at desc limit 1;
  end if;
  if v_quote_id is not null then
    select coalesce(jsonb_agg(to_jsonb(qi) order by qi.id), '[]'::jsonb) into v_items
    from public.quote_items qi where qi.quote_id = v_quote_id;
  end if;
  if v_quote_id is not null then
    select to_jsonb(q) into v_quote from public.quotes q where q.id = v_quote_id and q.tenant_id = new.tenant_id;
  end if;

  -- Kundenart
  v_rc := coalesce((v_customer->>'reverse_charge')::boolean, false);
  v_private := not coalesce(
    (v_customer->>'is_business')::boolean,
    nullif(trim(coalesce(v_customer->>'company_name', '')), '') is not null
  );
  if v_rc then
    v_private := false;
  end if;

  -- § 13b: ohne Umsatzsteuer abrechnen (Beträge netto)
  if v_rc then
    v_rate := coalesce(new.tax_rate, 0);
    if new.invoice_type = 'final' then
      select coalesce(sum(i.subtotal), 0) into v_paid_net from public.invoices i
      where i.order_id = new.order_id and i.tenant_id = new.tenant_id and i.invoice_type = 'partial'
        and i.document_type = 'invoice' and i.status = 'paid';
      select coalesce(sum(i.subtotal), 0) into v_open_net from public.invoices i
      where i.order_id = new.order_id and i.tenant_id = new.tenant_id and i.invoice_type = 'partial'
        and i.document_type = 'invoice' and i.status in ('open', 'reminder1', 'reminder2', 'final_notice');
      new.base_amount := round(coalesce(new.base_amount, 0) / (1 + v_rate / 100), 2);
      new.paid_partial_amount := v_paid_net;
      new.open_partial_amount := v_open_net;
      new.subtotal := round(new.base_amount - v_paid_net, 2);
    elsif new.base_amount is not null then
      new.base_amount := round(new.base_amount / (1 + v_rate / 100), 2);
    end if;
    new.tax_rate := 0;
    new.tax_amount := 0;
    new.total_amount := new.subtotal;
  end if;

  -- Abschläge, die in der Schlussrechnung verrechnet werden (Stand bei Erstellung)
  if new.invoice_type = 'final' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id, 'invoice_number', i.invoice_number, 'invoice_date', i.invoice_date,
      'subtotal', i.subtotal, 'tax_amount', i.tax_amount, 'total_amount', i.total_amount,
      'status', i.status, 'paid_at', i.paid_at, 'partial_type', i.partial_type, 'partial_value', i.partial_value
    ) order by i.invoice_date, i.id), '[]'::jsonb) into v_partials
    from public.invoices i
    where i.order_id = new.order_id and i.tenant_id = new.tenant_id and i.invoice_type = 'partial'
      and i.document_type = 'invoice' and i.status <> 'cancelled';
  end if;

  -- § 35a: Lohnanteil für Privatkunden (Anteil am Rechnungsbetrag inkl. USt)
  if v_private then
    v_override := current_setting('malersaas.labor_share', true);
    v_share := coalesce(nullif(v_override, '')::numeric, (v_company->>'labor_share_percent')::numeric, 70);
    v_share := greatest(0, least(100, v_share));
    new.labor_share_percent := v_share;
    new.labor_amount := round(coalesce(new.total_amount, 0) * v_share / 100, 2);
  end if;

  -- Leistungszeitraum aus dem Auftrag
  new.service_period_start := nullif(v_order->>'start_date', '')::date;
  new.service_period_end := coalesce(
    nullif(v_order->>'end_date', '')::date,
    case when new.invoice_type = 'final' then new.invoice_date end
  );

  new.reverse_charge := v_rc;
  new.is_private_customer := v_private;
  new.snapshot := jsonb_build_object(
    'version', 1,
    'frozen_at', now(),
    'company', v_company,
    'customer', v_customer,
    'order', v_order,
    'quote', v_quote,
    'items', v_items,
    'partials', v_partials
  );
  return new;
end;
$$;

create or replace function public.create_invoice_from_order(p_order_id bigint, p_labor_share numeric default null)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_app_user_id bigint;
  v_tenant_id bigint;
  v_role_id integer;
  v_order record;
  v_invoice_id bigint;
  v_invoice_number text;
  v_tax_rate numeric(5,2);
  v_payment_term_days integer;
  v_base_amount numeric(12,2);
  v_paid_partial_amount numeric(12,2) := 0;
  v_open_partial_amount numeric(12,2) := 0;
  v_total numeric(12,2);
  v_subtotal numeric(12,2);
  v_tax_amount numeric(12,2);
  v_quote_net numeric(12,2);
BEGIN
  SELECT app_user_id, tenant_id, role_id
  INTO v_app_user_id, v_tenant_id, v_role_id
  FROM public.get_my_role_and_tenant();

  IF v_app_user_id IS NULL THEN
    RAISE EXCEPTION 'Benutzerprofil nicht gefunden';
  END IF;
  IF v_role_id NOT IN (1, 2) THEN
    RAISE EXCEPTION 'Kein Zugriff';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id AND tenant_id = v_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auftrag nicht gefunden';
  END IF;
  IF v_order.status <> 'fertig' THEN
    RAISE EXCEPTION 'Rechnung kann nur für fertige Aufträge erstellt werden';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.order_id = p_order_id AND i.tenant_id = v_tenant_id
      AND i.invoice_type = 'final' AND i.document_type = 'invoice' AND i.status <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'Für diesen Auftrag existiert bereits eine Schlussrechnung';
  END IF;

  SELECT COALESCE(cs.tax_rate_default, 19), COALESCE(cs.payment_term_days, 14)
  INTO v_tax_rate, v_payment_term_days
  FROM public.company_settings cs WHERE cs.tenant_id = v_tenant_id;
  v_tax_rate := COALESCE(v_tax_rate, 19);
  v_payment_term_days := COALESCE(v_payment_term_days, 14);


  -- Basis: Netto-Betrag des Angebots (nach Rabatt) + aktueller Steuersatz, damit Positionen, Netto und Steuer zusammenpassen.
  -- Nur alte Aufträge ohne Angebot nutzen weiter den gespeicherten Bruttobetrag.
  SELECT COALESCE(q.subtotal_after_discount, q.subtotal) INTO v_quote_net
  FROM public.quotes q WHERE q.id = v_order.quote_id AND q.tenant_id = v_tenant_id;
  IF v_quote_net IS NOT NULL AND v_quote_net > 0 THEN
    v_base_amount := round(v_quote_net * (1 + v_tax_rate / 100), 2);
  ELSE
    v_base_amount := COALESCE(v_order.accepted_quote_total, 0);
  END IF;
  IF v_base_amount <= 0 THEN
    RAISE EXCEPTION 'Der Auftrag hat keinen gültigen Rechnungsbetrag';
  END IF;

  SELECT COALESCE(SUM(i.total_amount), 0) INTO v_paid_partial_amount
  FROM public.invoices i
  WHERE i.order_id = p_order_id AND i.tenant_id = v_tenant_id
    AND i.invoice_type = 'partial' AND i.document_type = 'invoice' AND i.status = 'paid';

  SELECT COALESCE(SUM(i.total_amount), 0) INTO v_open_partial_amount
  FROM public.invoices i
  WHERE i.order_id = p_order_id AND i.tenant_id = v_tenant_id
    AND i.invoice_type = 'partial' AND i.document_type = 'invoice'
    AND i.status IN ('open', 'reminder1', 'reminder2', 'final_notice');

  IF v_paid_partial_amount > v_base_amount THEN
    RAISE EXCEPTION 'Die bezahlten Abschlagsrechnungen übersteigen den Auftragswert';
  END IF;

  v_total := round(v_base_amount - v_paid_partial_amount, 2);
  IF v_total < 0 THEN
    RAISE EXCEPTION 'Der berechnete Schlussrechnungsbetrag ist ungültig';
  END IF;
  v_subtotal := round(v_total / (1 + (v_tax_rate / 100)), 2);
  v_tax_amount := round(v_total - v_subtotal, 2);

  IF p_labor_share IS NOT NULL THEN
    PERFORM set_config('malersaas.labor_share', greatest(0, least(100, p_labor_share))::text, true);
  END IF;

  v_invoice_number := public.get_next_invoice_number(v_tenant_id, current_date);

  INSERT INTO public.invoices (
    tenant_id, order_id, customer_id, invoice_number, invoice_date, due_date,
    subtotal, tax_rate, tax_amount, total_amount, status, created_by,
    invoice_type, base_amount, paid_partial_amount, open_partial_amount
  )
  VALUES (
    v_tenant_id, v_order.id, v_order.customer_id, v_invoice_number, current_date, current_date + v_payment_term_days,
    v_subtotal, v_tax_rate, v_tax_amount, v_total, 'open', v_app_user_id,
    'final', v_base_amount, v_paid_partial_amount, v_open_partial_amount
  )
  RETURNING id INTO v_invoice_id;

  UPDATE public.invoices
  SET status = 'credited', updated_at = now()
  WHERE order_id = p_order_id AND tenant_id = v_tenant_id
    AND invoice_type = 'partial' AND document_type = 'invoice'
    AND status IN ('open', 'reminder1', 'reminder2', 'final_notice');

  RETURN v_invoice_id;
END;
$function$;

create or replace function public.create_partial_invoice_from_order(p_order_id bigint, p_labor_share numeric default null)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $function$
DECLARE
  v_app_user_id bigint;
  v_tenant_id bigint;
  v_role_id integer;
  v_order record;
  v_quote record;
  v_invoice_id bigint;
  v_invoice_number text;
  v_tax_rate numeric(5,2) := 19;
  v_payment_term_days integer := 14;
  v_base_amount numeric(12,2);
  v_total numeric(12,2);
  v_subtotal numeric(12,2);
  v_tax_amount numeric(12,2);
  v_quote_net numeric(12,2);
BEGIN
  SELECT app_user_id, tenant_id, role_id
  INTO v_app_user_id, v_tenant_id, v_role_id
  FROM public.get_my_role_and_tenant();

  IF v_app_user_id IS NULL THEN
    RAISE EXCEPTION 'Benutzerprofil nicht gefunden';
  END IF;
  IF v_role_id NOT IN (1, 2) THEN
    RAISE EXCEPTION 'Kein Zugriff';
  END IF;

  -- ab Business (Business, Enterprise) oder in der Testphase
  IF NOT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.tenant_id = v_tenant_id
      AND (
        (s.plan IN ('business', 'enterprise') AND s.status IN ('active', 'trialing'))
        OR s.status = 'trialing'
      )
  ) THEN
    RAISE EXCEPTION 'Abschlagsrechnungen sind ab dem Tarif Business verfügbar';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id AND tenant_id = v_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auftrag nicht gefunden';
  END IF;
  IF v_order.status = 'abgerechnet' THEN
    RAISE EXCEPTION 'Für einen bereits abgerechneten Auftrag kann keine Abschlagsrechnung erstellt werden';
  END IF;
  IF v_order.quote_id IS NULL THEN
    RAISE EXCEPTION 'Der Auftrag ist keinem Angebot zugeordnet';
  END IF;

  SELECT * INTO v_quote FROM public.quotes WHERE id = v_order.quote_id AND tenant_id = v_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Zugehöriges Angebot nicht gefunden';
  END IF;
  IF COALESCE(v_quote.deposit_enabled, false) = false THEN
    RAISE EXCEPTION 'Für dieses Angebot wurde keine Abschlagszahlung vereinbart';
  END IF;
  IF v_quote.deposit_type NOT IN ('percent', 'fixed') THEN
    RAISE EXCEPTION 'Die Abschlagsart im Angebot ist ungültig';
  END IF;
  IF v_quote.deposit_value IS NULL OR v_quote.deposit_value <= 0 THEN
    RAISE EXCEPTION 'Der Abschlagswert im Angebot ist ungültig';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.order_id = p_order_id AND i.tenant_id = v_tenant_id
      AND i.invoice_type = 'partial' AND i.document_type = 'invoice' AND i.status <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'Für diesen Auftrag existiert bereits eine Abschlagsrechnung';
  END IF;

  SELECT COALESCE(cs.tax_rate_default, 19), COALESCE(cs.partial_payment_term_days, 14)
  INTO v_tax_rate, v_payment_term_days
  FROM public.company_settings cs WHERE cs.tenant_id = v_tenant_id;
  v_tax_rate := COALESCE(v_tax_rate, 19);
  v_payment_term_days := COALESCE(v_payment_term_days, 14);

  -- Basis: Netto-Betrag des Angebots (nach Rabatt) + aktueller Steuersatz, damit Positionen, Netto und Steuer zusammenpassen.
  -- Nur alte Aufträge ohne Angebot nutzen weiter den gespeicherten Bruttobetrag.
  SELECT COALESCE(q.subtotal_after_discount, q.subtotal) INTO v_quote_net
  FROM public.quotes q WHERE q.id = v_order.quote_id AND q.tenant_id = v_tenant_id;
  IF v_quote_net IS NOT NULL AND v_quote_net > 0 THEN
    v_base_amount := round(v_quote_net * (1 + v_tax_rate / 100), 2);
  ELSE
    v_base_amount := COALESCE(v_order.accepted_quote_total, 0);
  END IF;
  IF v_base_amount <= 0 THEN
    RAISE EXCEPTION 'Der Auftrag hat keinen gültigen Auftragswert';
  END IF;

  IF v_quote.deposit_type = 'percent' THEN
    IF v_quote.deposit_value > 100 THEN
      RAISE EXCEPTION 'Der Abschlag darf nicht mehr als 100 Prozent betragen';
    END IF;
    v_total := round(v_base_amount * (v_quote.deposit_value / 100), 2);
  ELSE
    v_total := round(v_quote.deposit_value, 2);
  END IF;
  IF v_total <= 0 THEN
    RAISE EXCEPTION 'Der berechnete Abschlagsbetrag ist ungültig';
  END IF;
  IF v_total > v_base_amount THEN
    RAISE EXCEPTION 'Der Abschlagsbetrag darf den Auftragswert nicht überschreiten';
  END IF;


  v_subtotal := round(v_total / (1 + (v_tax_rate / 100)), 2);
  v_tax_amount := round(v_total - v_subtotal, 2);

  IF p_labor_share IS NOT NULL THEN
    PERFORM set_config('malersaas.labor_share', greatest(0, least(100, p_labor_share))::text, true);
  END IF;

  v_invoice_number := public.get_next_invoice_number(v_tenant_id, current_date);

  INSERT INTO public.invoices (
    tenant_id, order_id, customer_id, invoice_number, invoice_date, due_date,
    subtotal, tax_rate, tax_amount, total_amount, status, created_by,
    invoice_type, partial_type, partial_value, base_amount
  )
  VALUES (
    v_tenant_id, v_order.id, v_order.customer_id, v_invoice_number, current_date, current_date + v_payment_term_days,
    v_subtotal, v_tax_rate, v_tax_amount, v_total, 'open', v_app_user_id,
    'partial', v_quote.deposit_type, v_quote.deposit_value, v_base_amount
  )
  RETURNING id INTO v_invoice_id;

  RETURN v_invoice_id;
END;
$function$;
