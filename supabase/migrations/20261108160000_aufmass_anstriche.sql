-- =====================================================================
-- Aufmaß: Anzahl Anstriche je Raum (Wände und Decke, 1–3)
--  * site_visit_rooms: neue Felder wall_coats, ceiling_coats (Standard 1 = wie bisher)
--  * Preisregeln: „Wände – jeder weitere Anstrich“ und „Decke – jeder weitere Anstrich“ (je m²)
--    für alle Firmen angelegt (Startwert 70 % des Grundpreises, frei änderbar);
--    neue Firmen bekommen sie automatisch, sobald ihre Grundpreise angelegt werden
--  * Angebot: weiterer Anstrich als eigene Position je Raum, z. B. „Wohnzimmer – 2. Anstrich Wände“
-- Bestehende Daten bleiben unverändert. Kann mehrfach ausgeführt werden.
-- =====================================================================

alter table public.site_visit_rooms
  add column if not exists wall_coats smallint not null default 1,
  add column if not exists ceiling_coats smallint not null default 1;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'site_visit_rooms_coats_check') then
    alter table public.site_visit_rooms
      add constraint site_visit_rooms_coats_check check (wall_coats between 1 and 3 and ceiling_coats between 1 and 3);
  end if;
end $$;

-- Preisregeln für weitere Anstriche (fehlende ergänzen)
create or replace function public.ensure_extra_coat_rules(p_tenant_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.quote_pricing_rules (tenant_id, rule_key, label, unit, unit_price, is_active)
  select p_tenant_id, x.rule_key, x.label, 'm²',
         coalesce((select round(r.unit_price * 0.7, 2) from public.quote_pricing_rules r
                    where r.tenant_id = p_tenant_id and r.rule_key = x.base_key limit 1), 0),
         true
    from (values
      ('paint_walls_extra_coat_sqm', 'Wände – jeder weitere Anstrich', 'paint_walls_sqm'),
      ('paint_ceiling_extra_coat_sqm', 'Decke – jeder weitere Anstrich', 'paint_ceiling_sqm')
    ) as x(rule_key, label, base_key)
   where not exists (select 1 from public.quote_pricing_rules q where q.tenant_id = p_tenant_id and q.rule_key = x.rule_key)
     and exists (select 1 from public.quote_pricing_rules b where b.tenant_id = p_tenant_id and b.rule_key = x.base_key);
end;
$$;

revoke all on function public.ensure_extra_coat_rules(bigint) from public, anon, authenticated;

-- alle bestehenden Firmen mit Grundpreisen
do $$
declare t bigint;
begin
  for t in select distinct tenant_id from public.quote_pricing_rules where rule_key in ('paint_walls_sqm', 'paint_ceiling_sqm') loop
    perform public.ensure_extra_coat_rules(t);
  end loop;
end $$;

-- neue Firmen: sobald der Grundpreis „Wände“ bzw. „Decke“ angelegt wird
create or replace function public.trg_extra_coat_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.rule_key in ('paint_walls_sqm', 'paint_ceiling_sqm') then
    perform public.ensure_extra_coat_rules(new.tenant_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_extra_coat_rules on public.quote_pricing_rules;
create trigger trg_extra_coat_rules
  after insert on public.quote_pricing_rules
  for each row execute function public.trg_extra_coat_rules();

-- Angebot aus dem Aufmaß (wie bisher mit VOB-Abzug) – jetzt mit weiteren Anstrichen
CREATE OR REPLACE FUNCTION public.generate_quote_from_site_visit(p_site_visit_id bigint)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare
  v_app_user_id bigint;
  v_tenant_id bigint;
  v_role_id integer;

  v_site_visit record;
  v_quote_id bigint;
  v_tax_rate numeric(5,2);

  v_discount_type text;
  v_discount_value numeric(10,2);
  v_discount_note text;

  v_price_walls numeric(12,2);
  v_price_ceiling numeric(12,2);
  v_price_window numeric(12,2);
  v_price_door numeric(12,2);
  v_price_radiator numeric(12,2);
  v_price_special numeric(12,2);

  v_sort_order integer := 1;

  v_room record;
  v_service record;
  v_room_title text;
  v_wall_area numeric(12,2);
  v_ceiling_area numeric(12,2);
  v_window_count integer;
  v_door_count integer;
  v_radiator_count integer;
  v_gross_wall numeric(12,2);
  v_deduction numeric(12,2);
  v_wall_note text;
  v_price_walls_extra numeric(12,2);
  v_price_ceiling_extra numeric(12,2);
  v_wall_coats integer;
  v_ceiling_coats integer;
begin
  select app_user_id, tenant_id, role_id
  into v_app_user_id, v_tenant_id, v_role_id
  from public.get_my_role_and_tenant();

  if v_app_user_id is null then
    raise exception 'Benutzerprofil nicht gefunden';
  end if;

  if v_role_id not in (1,2,3) then
    raise exception 'Kein Zugriff';
  end if;

  select *
  into v_site_visit
  from public.site_visits sv
  where sv.id = p_site_visit_id
    and sv.tenant_id = v_tenant_id;

  if not found then
    raise exception 'Besichtigung nicht gefunden';
  end if;

  select
    coalesce(tax_rate_default,19),
    coalesce(default_special_hourly_rate,0)
  into v_tax_rate, v_price_special
  from public.company_settings
  where tenant_id = v_tenant_id;

  select
    coalesce(c.discount_type,'percent'),
    coalesce(c.discount_value,0),
    c.discount_note
  into
    v_discount_type,
    v_discount_value,
    v_discount_note
  from public.customers c
  where c.id = v_site_visit.customer_id
    and c.tenant_id = v_tenant_id;

  select unit_price into v_price_walls
  from public.quote_pricing_rules
  where tenant_id = v_tenant_id
    and rule_key = 'paint_walls_sqm'
    and is_active = true;

  select unit_price into v_price_ceiling
  from public.quote_pricing_rules
  where tenant_id = v_tenant_id
    and rule_key = 'paint_ceiling_sqm'
    and is_active = true;

  select unit_price into v_price_walls_extra
  from public.quote_pricing_rules
  where tenant_id = v_tenant_id
    and rule_key = 'paint_walls_extra_coat_sqm'
    and is_active = true;

  select unit_price into v_price_ceiling_extra
  from public.quote_pricing_rules
  where tenant_id = v_tenant_id
    and rule_key = 'paint_ceiling_extra_coat_sqm'
    and is_active = true;

  -- ohne eigene Preisregel: weiterer Anstrich = 70 % des Grundpreises
  v_price_walls_extra := coalesce(v_price_walls_extra, round(coalesce(v_price_walls, 0) * 0.7, 2));
  v_price_ceiling_extra := coalesce(v_price_ceiling_extra, round(coalesce(v_price_ceiling, 0) * 0.7, 2));

  select unit_price into v_price_window
  from public.quote_pricing_rules
  where tenant_id = v_tenant_id
    and rule_key = 'paint_window_item'
    and is_active = true;

  select unit_price into v_price_door
  from public.quote_pricing_rules
  where tenant_id = v_tenant_id
    and rule_key = 'paint_door_item'
    and is_active = true;

  select unit_price into v_price_radiator
  from public.quote_pricing_rules
  where tenant_id = v_tenant_id
    and rule_key = 'paint_radiator_item'
    and is_active = true;

  insert into public.quotes (
    tenant_id,
    customer_id,
    title,
    description,
    address_street,
    address_zip,
    address_city,
    quote_date,
    tax_rate,
    discount_type,
    discount_value,
    notes,
    created_by
  )
  values (
    v_tenant_id,
    v_site_visit.customer_id,
    'Angebot zu ' || v_site_visit.title,
    null,
    v_site_visit.object_street,
    v_site_visit.object_zip,
    v_site_visit.object_city,
    current_date,
    v_tax_rate,
    v_discount_type,
    v_discount_value,
    case
      when v_discount_note is not null and btrim(v_discount_note) <> '' then
        coalesce(v_site_visit.notes,'') || E'\n\nRabattnotiz: ' || v_discount_note
      else
        v_site_visit.notes
    end,
    v_app_user_id
  )
  returning id into v_quote_id;

  for v_room in
    select
      r.id,
      r.room_name,
      r.length_m,
      r.width_m,
      r.height_m,
      r.wall_area_sqm,
      r.ceiling_area_sqm,
      r.paint_ceiling,
      r.manual_wall_area_sqm,
      r.wall_coats,
      r.ceiling_coats
    from public.site_visit_rooms r
    where r.site_visit_id = p_site_visit_id
    order by r.id
  loop
    v_room_title := coalesce(nullif(btrim(v_room.room_name),''),'Bereich');
    v_wall_coats := least(greatest(coalesce(v_room.wall_coats, 1), 1), 3);
    v_ceiling_coats := least(greatest(coalesce(v_room.ceiling_coats, 1), 1), 3);

    -- Wandfläche: manuelle Fläche hat Vorrang (ohne Abzug). Sonst 2 × (Länge + Breite) × Höhe
    -- abzüglich Öffnungen (Fenster/Türen) über 2,5 m² je Stück (VOB/C, DIN 18363).
    v_wall_note := null;
    if v_room.manual_wall_area_sqm is not null then
      v_wall_area := v_room.manual_wall_area_sqm;
    else
      v_gross_wall := coalesce(
        v_room.wall_area_sqm,
        ((2 * (coalesce(v_room.length_m,0) + coalesce(v_room.width_m,0))) * coalesce(v_room.height_m,0))
      );
      select coalesce(sum(o.count_items * o.width_m * o.height_m), 0)
        into v_deduction
        from (
          select coalesce(w.count_items,1) as count_items, w.width_m, w.height_m
            from public.site_visit_windows w
           where w.site_visit_id = p_site_visit_id and w.room_id = v_room.id
          union all
          select coalesce(d.count_items,1), d.width_m, d.height_m
            from public.site_visit_doors d
           where d.site_visit_id = p_site_visit_id and d.room_id = v_room.id
        ) o
       where o.width_m is not null and o.height_m is not null and o.width_m * o.height_m > 2.5;
      v_wall_area := greatest(coalesce(v_gross_wall,0) - coalesce(v_deduction,0), 0);
      if coalesce(v_deduction,0) > 0 then
        v_wall_note := 'Wandfläche ' || replace(to_char(round(v_gross_wall,2), 'FM999990.00'), '.', ',') || ' m² abzüglich Öffnungen über 2,5 m² ('
          || replace(to_char(round(v_deduction,2), 'FM999990.00'), '.', ',') || ' m²) nach VOB/C';
      end if;
    end if;

    v_ceiling_area := case
      when v_room.paint_ceiling = true then
        coalesce(
          v_room.ceiling_area_sqm,
          (coalesce(v_room.length_m,0) * coalesce(v_room.width_m,0))
        )
      else 0
    end;

    select coalesce(sum(count_items),0)
      into v_window_count
    from public.site_visit_windows
    where site_visit_id = p_site_visit_id
      and room_id = v_room.id;

    select coalesce(sum(count_items),0)
      into v_door_count
    from public.site_visit_doors
    where site_visit_id = p_site_visit_id
      and room_id = v_room.id;

    select coalesce(sum(count_items),0)
      into v_radiator_count
    from public.site_visit_radiators
    where site_visit_id = p_site_visit_id
      and room_id = v_room.id;

    if coalesce(v_wall_area,0) > 0 then
      insert into public.quote_items
      (tenant_id, quote_id, sort_order, item_type, title, description, quantity, unit, unit_price)
      values
      (v_tenant_id, v_quote_id, v_sort_order, 'service', v_room_title || ' – Wände streichen', v_wall_note, round(v_wall_area,2), 'm²', coalesce(v_price_walls,0));
      v_sort_order := v_sort_order + 1;

      -- weitere Anstriche Wände (eigene Position, eigener Preis)
      if v_wall_coats > 1 then
        insert into public.quote_items
        (tenant_id, quote_id, sort_order, item_type, title, description, quantity, unit, unit_price)
        values
        (v_tenant_id, v_quote_id, v_sort_order, 'service',
         v_room_title || case when v_wall_coats = 2 then ' – 2. Anstrich Wände' else ' – 2. und 3. Anstrich Wände' end,
         case when v_wall_coats = 3 then 'je ' || replace(to_char(round(v_wall_area,2), 'FM999990.00'), '.', ',') || ' m², 2 weitere Anstriche' else null end,
         round(v_wall_area * (v_wall_coats - 1), 2), 'm²', v_price_walls_extra);
        v_sort_order := v_sort_order + 1;
      end if;
    end if;

    if coalesce(v_ceiling_area,0) > 0 then
      insert into public.quote_items
      (tenant_id, quote_id, sort_order, item_type, title, quantity, unit, unit_price)
      values
      (v_tenant_id, v_quote_id, v_sort_order, 'service', v_room_title || ' – Decke streichen', round(v_ceiling_area,2), 'm²', coalesce(v_price_ceiling,0));
      v_sort_order := v_sort_order + 1;

      -- weitere Anstriche Decke
      if v_ceiling_coats > 1 then
        insert into public.quote_items
        (tenant_id, quote_id, sort_order, item_type, title, description, quantity, unit, unit_price)
        values
        (v_tenant_id, v_quote_id, v_sort_order, 'service',
         v_room_title || case when v_ceiling_coats = 2 then ' – 2. Anstrich Decke' else ' – 2. und 3. Anstrich Decke' end,
         case when v_ceiling_coats = 3 then 'je ' || replace(to_char(round(v_ceiling_area,2), 'FM999990.00'), '.', ',') || ' m², 2 weitere Anstriche' else null end,
         round(v_ceiling_area * (v_ceiling_coats - 1), 2), 'm²', v_price_ceiling_extra);
        v_sort_order := v_sort_order + 1;
      end if;
    end if;

    if coalesce(v_window_count,0) > 0 then
      insert into public.quote_items
      (tenant_id, quote_id, sort_order, item_type, title, quantity, unit, unit_price)
      values
      (v_tenant_id, v_quote_id, v_sort_order, 'service', v_room_title || ' – Fenster lackieren', v_window_count, 'Stk', coalesce(v_price_window,0));
      v_sort_order := v_sort_order + 1;
    end if;

    if coalesce(v_door_count,0) > 0 then
      insert into public.quote_items
      (tenant_id, quote_id, sort_order, item_type, title, quantity, unit, unit_price)
      values
      (v_tenant_id, v_quote_id, v_sort_order, 'service', v_room_title || ' – Türen lackieren', v_door_count, 'Stk', coalesce(v_price_door,0));
      v_sort_order := v_sort_order + 1;
    end if;

    if coalesce(v_radiator_count,0) > 0 then
      insert into public.quote_items
      (tenant_id, quote_id, sort_order, item_type, title, quantity, unit, unit_price)
      values
      (v_tenant_id, v_quote_id, v_sort_order, 'service', v_room_title || ' – Heizkörper lackieren', v_radiator_count, 'Stk', coalesce(v_price_radiator,0));
      v_sort_order := v_sort_order + 1;
    end if;
  end loop;

  for v_service in
    select title, description, hours
    from public.site_visit_custom_services
    where site_visit_id = p_site_visit_id
    order by id
  loop
    if coalesce(v_service.hours,0) > 0 then
      insert into public.quote_items
      (
        tenant_id,
        quote_id,
        sort_order,
        item_type,
        title,
        description,
        quantity,
        unit,
        unit_price
      )
      values
      (
        v_tenant_id,
        v_quote_id,
        v_sort_order,
        'service',
        v_service.title,
        v_service.description,
        round(v_service.hours,2),
        'Std.',
        coalesce(v_price_special,0)
      );

      v_sort_order := v_sort_order + 1;
    end if;
  end loop;

  perform public.refresh_quote_totals(v_quote_id);

  return v_quote_id;
end;
$function$;
