-- =====================================================================
-- Rechtssichere Rechnungen (Deutschland, vorbereitet für Österreich/Schweiz)
--  A  Rechnungen gegen Ändern/Löschen sperren (GoBD) – nur Status/Zahlung/Storno-Verweis dürfen sich ändern
--  B  Beim Erstellen alle Angaben einfrieren (snapshot: Firma, Kunde, Auftrag, Positionen, Abschläge)
--  C  Leistungszeitraum aus dem Auftrag
--  E  Lohnanteil nach § 35a EStG für Privatkunden (Standard in den Einstellungen, pro Rechnung anpassbar)
--  F  § 13b UStG: Kunde „Bauunternehmen“ -> Rechnung ohne USt (Steuerschuldnerschaft des Leistungsempfängers)
--  G  Stornieren: Stornorechnung mit eigener Nummer, Original wird „storniert“
--  I  Abschlagsrechnungen ab Business (auch Enterprise und Testphase)
-- Bestehende Rechnungen bleiben unverändert (kein snapshot -> PDF wie bisher).
-- Kann mehrfach ausgeführt werden.
-- =====================================================================

-- ---------- Neue Spalten ----------
alter table public.company_settings
  add column if not exists labor_share_percent numeric(5,2) not null default 70;

alter table public.customers
  add column if not exists is_business boolean,               -- null = aus Firmenname ableiten
  add column if not exists reverse_charge boolean not null default false;  -- § 13b UStG

alter table public.invoices
  add column if not exists document_type text not null default 'invoice',  -- 'invoice' | 'cancellation'
  add column if not exists snapshot jsonb,
  add column if not exists service_period_start date,
  add column if not exists service_period_end date,
  add column if not exists reverse_charge boolean not null default false,
  add column if not exists is_private_customer boolean,
  add column if not exists labor_share_percent numeric(5,2),
  add column if not exists labor_amount numeric(12,2),
  add column if not exists cancels_invoice_id bigint references public.invoices(id),
  add column if not exists cancelled_by_invoice_id bigint references public.invoices(id),
  add column if not exists cancel_reason text;

do $$ begin
  alter table public.company_settings add constraint company_settings_labor_share_chk check (labor_share_percent between 0 and 100);
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.invoices add constraint invoices_document_type_chk check (document_type in ('invoice', 'cancellation'));
exception when duplicate_object then null; end $$;

-- ---------- B/C/E/F: beim Erstellen einfrieren ----------
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
    'items', v_items,
    'partials', v_partials
  );
  return new;
end;
$$;

drop trigger if exists invoices_freeze on public.invoices;
create trigger invoices_freeze
  before insert on public.invoices
  for each row execute function public.invoices_freeze();

-- ---------- A: Sperre gegen Ändern und Löschen ----------
create or replace function public.invoices_guard()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_allowed text[] := array['status', 'paid_at', 'updated_at', 'notes', 'cancelled_by_invoice_id'];
begin
  if tg_op = 'DELETE' then
    -- nur für spätere, geregelte Löschung nach Aufbewahrungsfrist (z. B. Konto-Löschung)
    if coalesce(current_setting('malersaas.allow_invoice_delete', true), '') = 'on' then
      return old;
    end if;
    raise exception 'Rechnungen dürfen nicht gelöscht werden. Bitte stattdessen stornieren.';
  end if;

  if (to_jsonb(new) - v_allowed) is distinct from (to_jsonb(old) - v_allowed) then
    raise exception 'Eine erstellte Rechnung kann nicht mehr geändert werden. Bitte stornieren und neu erstellen.';
  end if;
  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'Eine stornierte Rechnung kann nicht wieder aktiviert werden.';
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_guard on public.invoices;
create trigger invoices_guard
  before update or delete on public.invoices
  for each row execute function public.invoices_guard();

-- Admins dürfen Rechnungen nur noch lesen; Anlegen/Ändern läuft über die Funktionen unten
drop policy if exists admins_can_manage_invoices on public.invoices;
drop policy if exists admins_can_read_invoices on public.invoices;
create policy admins_can_read_invoices on public.invoices
  for select using (
    exists (
      select 1 from public.app_users au
      where au.auth_user_id = auth.uid()
        and au.tenant_id = invoices.tenant_id
        and au.role_id = any (array[1::bigint, 2::bigint])
    )
  );

-- ---------- Rechnung aus Auftrag (unverändert + optionaler Lohnanteil) ----------
drop function if exists public.create_invoice_from_order(bigint);
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

  v_base_amount := COALESCE(v_order.accepted_quote_total, 0);
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

-- ---------- Abschlagsrechnung (ab Business, auch Enterprise und Testphase) ----------
drop function if exists public.create_partial_invoice_from_order(bigint);
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

  v_base_amount := COALESCE(v_order.accepted_quote_total, 0);
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

  SELECT COALESCE(cs.tax_rate_default, 19), COALESCE(cs.partial_payment_term_days, 14)
  INTO v_tax_rate, v_payment_term_days
  FROM public.company_settings cs WHERE cs.tenant_id = v_tenant_id;
  v_tax_rate := COALESCE(v_tax_rate, 19);
  v_payment_term_days := COALESCE(v_payment_term_days, 14);

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

-- ---------- G: Stornieren ----------
create or replace function public.cancel_invoice(p_invoice_id bigint, p_reason text default null)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_app_user_id bigint;
  v_tenant_id bigint;
  v_role_id integer;
  v_inv record;
  v_number text;
  v_new_id bigint;
  v_snapshot jsonb;
begin
  select app_user_id, tenant_id, role_id into v_app_user_id, v_tenant_id, v_role_id
  from public.get_my_role_and_tenant();
  if v_app_user_id is null then
    raise exception 'Benutzerprofil nicht gefunden';
  end if;
  if v_role_id not in (1, 2) then
    raise exception 'Kein Zugriff';
  end if;

  select * into v_inv from public.invoices
  where id = p_invoice_id and tenant_id = v_tenant_id
  for update;
  if not found then
    raise exception 'Rechnung nicht gefunden';
  end if;
  if v_inv.document_type = 'cancellation' then
    raise exception 'Eine Stornorechnung kann nicht storniert werden';
  end if;
  if v_inv.status = 'cancelled' then
    raise exception 'Diese Rechnung ist bereits storniert';
  end if;
  if v_inv.invoice_type = 'partial' and exists (
    select 1 from public.invoices i
    where i.order_id = v_inv.order_id and i.tenant_id = v_tenant_id
      and i.invoice_type = 'final' and i.document_type = 'invoice' and i.status <> 'cancelled'
  ) then
    raise exception 'Bitte zuerst die Schlussrechnung dieses Auftrags stornieren';
  end if;

  -- Angaben der Originalrechnung übernehmen (bei alten Rechnungen: heutiger Stand)
  v_snapshot := v_inv.snapshot;
  if v_snapshot is null then
    v_snapshot := jsonb_build_object(
      'version', 1,
      'frozen_at', now(),
      'company', (select to_jsonb(cs) from public.company_settings cs where cs.tenant_id = v_tenant_id order by cs.id desc limit 1),
      'customer', (select to_jsonb(c) from public.customers c where c.id = v_inv.customer_id and c.tenant_id = v_tenant_id),
      'order', (select to_jsonb(o) from public.orders o where o.id = v_inv.order_id and o.tenant_id = v_tenant_id),
      'items', '[]'::jsonb,
      'partials', '[]'::jsonb
    );
  end if;
  v_snapshot := v_snapshot || jsonb_build_object(
    'cancels', jsonb_build_object('invoice_number', v_inv.invoice_number, 'invoice_date', v_inv.invoice_date)
  );

  v_number := public.get_next_invoice_number(v_tenant_id, current_date);

  insert into public.invoices (
    tenant_id, order_id, customer_id, invoice_number, invoice_date, due_date,
    subtotal, tax_rate, tax_amount, total_amount, status, created_by,
    invoice_type, partial_type, partial_value, base_amount, paid_partial_amount, open_partial_amount,
    document_type, cancels_invoice_id, cancel_reason, snapshot,
    service_period_start, service_period_end, reverse_charge, is_private_customer,
    labor_share_percent, labor_amount
  )
  values (
    v_tenant_id, v_inv.order_id, v_inv.customer_id, v_number, current_date, current_date,
    -coalesce(v_inv.subtotal, 0), v_inv.tax_rate, -coalesce(v_inv.tax_amount, 0), -coalesce(v_inv.total_amount, 0), 'cancelled', v_app_user_id,
    v_inv.invoice_type, v_inv.partial_type, v_inv.partial_value, v_inv.base_amount, v_inv.paid_partial_amount, v_inv.open_partial_amount,
    'cancellation', v_inv.id, nullif(trim(coalesce(p_reason, '')), ''), v_snapshot,
    v_inv.service_period_start, v_inv.service_period_end, v_inv.reverse_charge, v_inv.is_private_customer,
    v_inv.labor_share_percent, case when v_inv.labor_amount is null then null else -v_inv.labor_amount end
  )
  returning id into v_new_id;

  update public.invoices
  set status = 'cancelled', cancelled_by_invoice_id = v_new_id, updated_at = now()
  where id = v_inv.id;

  -- offene Mahnungen dieser Rechnung zurückziehen
  update public.invoice_reminders
  set status = 'cancelled', updated_at = now()
  where invoice_id = v_inv.id and tenant_id = v_tenant_id and status = 'created';

  -- Schlussrechnung storniert: verrechnete Abschläge wieder öffnen, Auftrag wieder abrechenbar
  if v_inv.invoice_type = 'final' then
    update public.invoices
    set status = 'open', updated_at = now()
    where order_id = v_inv.order_id and tenant_id = v_tenant_id
      and invoice_type = 'partial' and document_type = 'invoice' and status = 'credited';
    update public.orders
    set status = 'fertig'
    where id = v_inv.order_id and tenant_id = v_tenant_id and status = 'abgerechnet';
  end if;

  return v_new_id;
end;
$$;

grant execute on function public.create_invoice_from_order(bigint, numeric) to authenticated;
grant execute on function public.create_partial_invoice_from_order(bigint, numeric) to authenticated;
grant execute on function public.cancel_invoice(bigint, text) to authenticated;
