-- Leistungsmanagement: Leistungsregeln und Bonusregeln vollständig speichern (neu anlegen UND ändern) – 15.11.2026
-- Nur der Chef (Rolle 2), nur im eigenen Betrieb. Die alten Funktionen bleiben unverändert.

-- ---------- Teil 1: Leistungsregel ----------
create or replace function public.perf_save_criterion(
  p_id bigint,
  p_category text,
  p_name text,
  p_description text,
  p_mode text,
  p_default_points integer,
  p_evaluation_key text,
  p_operator text,
  p_value numeric,
  p_points_success integer,
  p_points_failure integer,
  p_active boolean
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant bigint := public.current_tenant_id();
  v_id bigint;
  v_auto boolean := p_mode = 'automatic';
begin
  if public.current_role_id() is distinct from 2 or v_tenant is null then
    raise exception 'Nur der Chef kann Leistungsregeln speichern.';
  end if;
  if coalesce(btrim(p_name), '') = '' or coalesce(btrim(p_category), '') = '' then
    raise exception 'Bitte Kategorie und Kriterium ausfüllen.';
  end if;
  if p_mode not in ('manual', 'automatic') then
    raise exception 'Unbekannter Regeltyp.';
  end if;
  if v_auto then
    if p_evaluation_key not in ('order_completed', 'photo_documentation', 'customer_rating', 'material_usage',
                                'no_complaints', 'on_time_completion', 'safety_compliance', 'punctuality') then
      raise exception 'Bitte einen Messwert auswählen.';
    end if;
    if p_operator not in ('=', '!=', '>', '>=', '<', '<=') or p_value is null then
      raise exception 'Bitte Vergleich und Vergleichswert angeben.';
    end if;
    if p_points_success is null then
      raise exception 'Bitte die Punkte bei Erfolg angeben.';
    end if;
  elsif p_default_points is null then
    raise exception 'Bitte die Punkte angeben.';
  end if;

  if p_id is null then
    insert into public.performance_criteria (
      tenant_id, category, name, description, default_points, is_active,
      evaluation_mode, auto_evaluation_enabled, evaluation_key, evaluation_operator, evaluation_value,
      points_on_success, points_on_failure, sort_order)
    values (
      v_tenant, btrim(p_category), btrim(p_name), nullif(btrim(p_description), ''),
      case when v_auto then p_points_success else p_default_points end, coalesce(p_active, true),
      p_mode, v_auto,
      case when v_auto then p_evaluation_key end, case when v_auto then p_operator end, case when v_auto then p_value end,
      case when v_auto then p_points_success end, case when v_auto then coalesce(p_points_failure, 0) end,
      coalesce((select max(sort_order) + 1 from public.performance_criteria where tenant_id = v_tenant), 1))
    returning id into v_id;
  else
    update public.performance_criteria set
      category = btrim(p_category),
      name = btrim(p_name),
      description = nullif(btrim(p_description), ''),
      default_points = case when v_auto then p_points_success else p_default_points end,
      is_active = coalesce(p_active, true),
      evaluation_mode = p_mode,
      auto_evaluation_enabled = v_auto,
      evaluation_key = case when v_auto then p_evaluation_key end,
      evaluation_operator = case when v_auto then p_operator end,
      evaluation_value = case when v_auto then p_value end,
      points_on_success = case when v_auto then p_points_success end,
      points_on_failure = case when v_auto then coalesce(p_points_failure, 0) end
    where id = p_id and tenant_id = v_tenant
    returning id into v_id;
    if v_id is null then
      raise exception 'Leistungsregel nicht gefunden.';
    end if;
  end if;
  return v_id;
end;
$$;

-- ---------- Teil 2: Bonusregel ----------
create or replace function public.perf_save_reward(
  p_id bigint,
  p_name text,
  p_stars integer,
  p_min_points integer,
  p_max_points integer,
  p_type text,
  p_value numeric,
  p_description text,
  p_active boolean
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant bigint := public.current_tenant_id();
  v_id bigint;
begin
  if public.current_role_id() is distinct from 2 or v_tenant is null then
    raise exception 'Nur der Chef kann Bonusregeln speichern.';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'Bitte einen Namen angeben, z. B. Gold.';
  end if;
  if p_stars is null or p_stars not between 1 and 5 then
    raise exception 'Bitte 1 bis 5 Sterne wählen.';
  end if;
  if p_min_points is null or (p_max_points is not null and p_max_points < p_min_points) then
    raise exception 'Bitte einen gültigen Punktebereich angeben.';
  end if;
  if p_type not in ('money', 'vacation', 'voucher', 'material') then
    raise exception 'Unbekannte Bonusart.';
  end if;
  if p_value is null or p_value < 0 then
    raise exception 'Bitte einen gültigen Wert angeben.';
  end if;

  if p_id is null then
    insert into public.performance_rewards (
      tenant_id, reward_name, badge_name, stars, min_points, max_points, reward_type, reward_value, description, is_active)
    values (
      v_tenant, btrim(p_name), btrim(p_name), p_stars, p_min_points, p_max_points, p_type, p_value,
      nullif(btrim(p_description), ''), coalesce(p_active, true))
    returning id into v_id;
  else
    update public.performance_rewards set
      reward_name = btrim(p_name),
      badge_name = btrim(p_name),
      stars = p_stars,
      min_points = p_min_points,
      max_points = p_max_points,
      reward_type = p_type,
      reward_value = p_value,
      description = nullif(btrim(p_description), ''),
      is_active = coalesce(p_active, true)
    where id = p_id and tenant_id = v_tenant
    returning id into v_id;
    if v_id is null then
      raise exception 'Bonusregel nicht gefunden.';
    end if;
  end if;
  return v_id;
end;
$$;

revoke all on function public.perf_save_criterion(bigint, text, text, text, text, integer, text, text, numeric, integer, integer, boolean) from public, anon;
grant execute on function public.perf_save_criterion(bigint, text, text, text, text, integer, text, text, numeric, integer, integer, boolean) to authenticated;
revoke all on function public.perf_save_reward(bigint, text, integer, integer, integer, text, numeric, text, boolean) from public, anon;
grant execute on function public.perf_save_reward(bigint, text, integer, integer, integer, text, numeric, text, boolean) to authenticated;
