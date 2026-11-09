-- Materialverwaltung Stufe 1 (09.11.2026): Bestand immer korrekt, Lücken geschlossen
--  * material_assign_to_order  : Zuweisung + Lagerbuchung in EINEM Schritt (alles oder nichts)
--  * material_cancel_assignment: Zuweisung stornieren (solange nicht übernommen) → zurück ins Lager
--  * material_confirm_handover : Mitarbeiter bestätigt Übernahme (statt Direktänderung der Zuweisung)
--  * material_book_usage       : Verbrauch / Rückgabe / Beschädigt / Auf Baustelle – mit Restmengen-Prüfung
--  * material_stock_in         : Anfangsbestand / Wareneingang (auch für Rolle 1)
--  * Direkte Schreibrechte für Mitarbeiter auf Zuweisungen und Verbrauchsbuchungen entfernt.

-- Interne Lagerbuchung (nicht direkt aufrufbar)
create or replace function public.material_move_internal(
  p_tenant_id bigint, p_user_id bigint, p_material_id bigint, p_movement_type text, p_quantity numeric,
  p_from text, p_from_id bigint, p_to text, p_to_id bigint, p_order_id bigint,
  p_reference_type text, p_reference_id bigint, p_note text
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_before numeric(12,2);
  v_after numeric(12,2);
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Die Menge muss größer als 0 sein.';
  end if;

  select coalesce(m.stock_quantity, 0) into v_before
  from public.materials m
  where m.id = p_material_id and m.tenant_id = p_tenant_id
  for update;
  if not found then
    raise exception 'Material wurde nicht gefunden.';
  end if;

  if p_from = 'warehouse' and p_to is distinct from 'warehouse' then
    v_after := v_before - p_quantity;
  elsif p_to = 'warehouse' and p_from is distinct from 'warehouse' then
    v_after := v_before + p_quantity;
  else
    v_after := v_before;
  end if;

  if v_after < 0 then
    raise exception 'Nicht genügend Material im Lager. Bestand: %, angefordert: %.', v_before, p_quantity;
  end if;

  update public.materials set stock_quantity = v_after, updated_at = now()
  where id = p_material_id and tenant_id = p_tenant_id;

  insert into public.material_stock_movements (
    tenant_id, material_id, movement_type, quantity, stock_before, stock_after, order_id, performed_by,
    note, reference_type, reference_id, from_holder_type, from_holder_id, to_holder_type, to_holder_id, created_at
  ) values (
    p_tenant_id, p_material_id, p_movement_type, p_quantity, v_before, v_after, p_order_id, p_user_id,
    nullif(trim(p_note), ''), p_reference_type, p_reference_id, p_from, p_from_id, p_to, p_to_id, now()
  );
end;
$function$;

revoke all on function public.material_move_internal(bigint, bigint, bigint, text, numeric, text, bigint, text, bigint, bigint, text, bigint, text) from public, anon, authenticated;

-- 1) Material einem Auftrag zuweisen
create or replace function public.material_assign_to_order(
  p_order_id bigint, p_material_id bigint, p_user_id bigint, p_quantity numeric
) returns bigint
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me bigint; v_tenant bigint; v_role int;
  v_unit text; v_name text;
  v_assignment_id bigint;
begin
  select id, tenant_id, role_id into v_me, v_tenant, v_role
  from public.app_users where auth_user_id = auth.uid() and coalesce(is_active, true) limit 1;
  if v_me is null then raise exception 'Benutzerprofil nicht gefunden.'; end if;
  if v_role not in (1, 2, 3) then raise exception 'Nur Inhaber, Admin oder Projektleiter dürfen Material zuweisen.'; end if;
  if not public.pm_can_manage_order(p_order_id) then
    raise exception 'Auftrag nicht gefunden oder keine Berechtigung.';
  end if;
  if not exists (
    select 1 from public.app_users au
    where au.id = p_user_id and au.tenant_id = v_tenant and au.role_id in (3, 4) and coalesce(au.is_active, true)
  ) then
    raise exception 'Der Empfänger wurde nicht gefunden.';
  end if;

  select unit, name into v_unit, v_name from public.materials
  where id = p_material_id and tenant_id = v_tenant and is_active = true;
  if v_name is null then raise exception 'Material wurde nicht gefunden oder ist deaktiviert.'; end if;

  perform public.material_move_internal(
    v_tenant, v_me, p_material_id, 'assignment', p_quantity,
    'warehouse', null, 'employee', p_user_id, p_order_id, 'order', p_order_id,
    'Aus dem Lager entnommen und zugewiesen.'
  );

  insert into public.order_material_assignments (
    tenant_id, order_id, material_id, assigned_to_user_id, assigned_by_user_id, quantity, unit, status, assigned_at, updated_at
  ) values (
    v_tenant, p_order_id, p_material_id, p_user_id, v_me, p_quantity, coalesce(v_unit, 'Stk'), 'reserved', now(), now()
  ) returning id into v_assignment_id;

  return v_assignment_id;
end;
$function$;

-- 2) Zuweisung stornieren (nur solange nicht übernommen und nichts gebucht)
create or replace function public.material_cancel_assignment(p_assignment_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me bigint; v_tenant bigint; v_role int;
  a public.order_material_assignments%rowtype;
begin
  select id, tenant_id, role_id into v_me, v_tenant, v_role
  from public.app_users where auth_user_id = auth.uid() and coalesce(is_active, true) limit 1;
  if v_me is null then raise exception 'Benutzerprofil nicht gefunden.'; end if;
  if v_role not in (1, 2, 3) then raise exception 'Keine Berechtigung.'; end if;

  select * into a from public.order_material_assignments
  where id = p_assignment_id and tenant_id = v_tenant for update;
  if not found then raise exception 'Zuweisung nicht gefunden.'; end if;
  if not public.pm_can_manage_order(a.order_id) then raise exception 'Auftrag nicht gefunden oder keine Berechtigung.'; end if;
  if a.status <> 'reserved'
     or exists (select 1 from public.material_handover_confirmations c where c.assignment_id = a.id)
     or exists (select 1 from public.material_consumption_logs l where l.assignment_id = a.id) then
    raise exception 'Das Material wurde schon übernommen und kann nicht mehr storniert werden.';
  end if;

  perform public.material_move_internal(
    v_tenant, v_me, a.material_id, 'return', a.quantity,
    'employee', a.assigned_to_user_id, 'warehouse', null, a.order_id, 'order', a.order_id,
    'Zuweisung storniert – zurück ins Lager.'
  );

  delete from public.order_material_assignments where id = a.id;
end;
$function$;

-- 3) Übernahme bestätigen (Mitarbeiter, dem das Material zugewiesen ist)
create or replace function public.material_confirm_handover(p_assignment_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me bigint; v_tenant bigint;
  a public.order_material_assignments%rowtype;
begin
  select id, tenant_id into v_me, v_tenant
  from public.app_users where auth_user_id = auth.uid() and coalesce(is_active, true) limit 1;
  if v_me is null then raise exception 'Benutzerprofil nicht gefunden.'; end if;

  select * into a from public.order_material_assignments
  where id = p_assignment_id and tenant_id = v_tenant for update;
  if not found or a.assigned_to_user_id <> v_me then raise exception 'Zuweisung nicht gefunden.'; end if;
  if a.status = 'handed_over' then return; end if;

  insert into public.material_handover_confirmations (tenant_id, assignment_id, confirmed_by_user_id, confirmation_text)
  values (v_tenant, a.id, v_me, 'Materialübernahme digital bestätigt.');

  update public.order_material_assignments set status = 'handed_over', updated_at = now() where id = a.id;
end;
$function$;

-- 4) Verbrauch / Rückgabe buchen
create or replace function public.material_book_usage(
  p_assignment_id bigint, p_quantity numeric, p_action text, p_note text default null
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me bigint; v_tenant bigint; v_role int;
  a public.order_material_assignments%rowtype;
  m public.materials%rowtype;
  v_booked numeric; v_remaining numeric;
  v_before numeric; v_after numeric;
begin
  select id, tenant_id, role_id into v_me, v_tenant, v_role
  from public.app_users where auth_user_id = auth.uid() and coalesce(is_active, true) limit 1;
  if v_me is null then raise exception 'Benutzerprofil nicht gefunden.'; end if;
  if p_action not in ('used', 'returned', 'damaged', 'left_on_site') then raise exception 'Ungültige Buchungsart.'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Die Menge muss größer als 0 sein.'; end if;

  select * into a from public.order_material_assignments
  where id = p_assignment_id and tenant_id = v_tenant for update;
  if not found then raise exception 'Zuweisung nicht gefunden.'; end if;
  if not (a.assigned_to_user_id = v_me or (v_role in (1, 2, 3) and public.pm_can_manage_order(a.order_id))) then
    raise exception 'Zuweisung nicht gefunden.';
  end if;

  select coalesce(sum(quantity), 0) into v_booked from public.material_consumption_logs where assignment_id = a.id;
  v_remaining := a.quantity - v_booked;
  if p_quantity > v_remaining then
    raise exception 'Es sind nur noch % % offen.', v_remaining, a.unit;
  end if;

  select * into m from public.materials where id = a.material_id and tenant_id = v_tenant;
  select coalesce(stock_quantity, 0) into v_before from public.materials where id = a.material_id for update;

  -- Der bestehende Trigger bucht 'returned' automatisch zurück ins Lager
  insert into public.material_consumption_logs (
    tenant_id, assignment_id, order_id, material_id, user_id, quantity, action, note,
    material_name_at_use, unit_at_use, material_supplier_at_use, material_price_at_use
  ) values (
    v_tenant, a.id, a.order_id, a.material_id, v_me, p_quantity, p_action, nullif(trim(coalesce(p_note, '')), ''),
    m.name, m.unit, m.supplier, m.purchase_price
  );

  if p_action = 'returned' then
    select coalesce(stock_quantity, 0) into v_after from public.materials where id = a.material_id;
    insert into public.material_stock_movements (
      tenant_id, material_id, movement_type, quantity, stock_before, stock_after, order_id, performed_by,
      note, reference_type, reference_id, from_holder_type, from_holder_id, to_holder_type, to_holder_id, created_at
    ) values (
      v_tenant, a.material_id, 'return', p_quantity, v_before, v_after, a.order_id, v_me,
      'Restmaterial zurück ins Lager.', 'order', a.order_id, 'employee', a.assigned_to_user_id, 'warehouse', null, now()
    );
  end if;
end;
$function$;

-- 5) Anfangsbestand / Wareneingang
create or replace function public.material_stock_in(
  p_material_id bigint, p_quantity numeric, p_initial boolean default false, p_note text default null
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me bigint; v_tenant bigint; v_role int;
begin
  select id, tenant_id, role_id into v_me, v_tenant, v_role
  from public.app_users where auth_user_id = auth.uid() and coalesce(is_active, true) limit 1;
  if v_me is null then raise exception 'Benutzerprofil nicht gefunden.'; end if;
  if v_role not in (1, 2, 3) then raise exception 'Keine Berechtigung.'; end if;

  perform public.material_move_internal(
    v_tenant, v_me, p_material_id, case when p_initial then 'initial_stock' else 'purchase' end, p_quantity,
    'supplier', null, 'warehouse', null, null, 'purchase', p_material_id,
    coalesce(nullif(trim(p_note), ''), case when p_initial then 'Anfangsbestand' else 'Wareneingang' end)
  );
end;
$function$;

revoke all on function public.material_assign_to_order(bigint, bigint, bigint, numeric) from public, anon;
revoke all on function public.material_cancel_assignment(bigint) from public, anon;
revoke all on function public.material_confirm_handover(bigint) from public, anon;
revoke all on function public.material_book_usage(bigint, numeric, text, text) from public, anon;
revoke all on function public.material_stock_in(bigint, numeric, boolean, text) from public, anon;
grant execute on function public.material_assign_to_order(bigint, bigint, bigint, numeric) to authenticated;
grant execute on function public.material_cancel_assignment(bigint) to authenticated;
grant execute on function public.material_confirm_handover(bigint) to authenticated;
grant execute on function public.material_book_usage(bigint, numeric, text, text) to authenticated;
grant execute on function public.material_stock_in(bigint, numeric, boolean, text) to authenticated;

-- Lücken schließen: Mitarbeiter schreiben nur noch über die Funktionen oben
drop policy if exists oma_update_by_assigned_user_handover on public.order_material_assignments;
drop policy if exists mcl_insert_by_user on public.material_consumption_logs;

-- Verlauf lesen (für die Material-Historie)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'material_stock_movements' and cmd = 'SELECT') then
    execute 'alter table public.material_stock_movements enable row level security';
    execute $p$
      create policy msm_select_staff on public.material_stock_movements for select to authenticated
      using (public.material_staff(tenant_id))
    $p$;
  end if;
end $$;
