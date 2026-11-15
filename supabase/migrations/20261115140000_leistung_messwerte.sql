-- Leistungsmanagement: Messwerte wirklich berechnen + automatisch bewerten, sobald ein Auftrag fertig ist – 15.11.2026
-- Bestehende Punkte bleiben. Neu berechnet wird nur bei „Fertig“, bei neuen Kundenbewertungen oder wenn der Chef es anstößt.

-- ---------- Teil 1: Fertig-Zeitpunkt merken (für „Pünktlichkeit“) ----------
alter table public.orders add column if not exists completed_at timestamptz;

create or replace function public.orders_set_completed_at()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('fertig', 'abgerechnet') and new.completed_at is null then
    new.completed_at := now();
  elsif new.status not in ('fertig', 'abgerechnet') then
    new.completed_at := null; -- wieder geöffnet
  end if;
  return new;
end;
$$;

drop trigger if exists orders_completed_at on public.orders;
create trigger orders_completed_at
  before insert or update of status on public.orders
  for each row execute function public.orders_set_completed_at();

-- ---------- Teil 2: Messwerte ----------
-- Rückgabe NULL = „nicht messbar“ (z. B. noch keine Kundenbewertung) → die Regel wird dann übersprungen
create or replace function public.get_performance_metric_value(p_evaluation_key text, p_employee_id bigint, p_order_id bigint)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_value numeric;
begin
  if p_evaluation_key = 'order_completed' then
    select case when o.status in ('fertig', 'abgerechnet') then 1 else 0 end into v_value
    from public.orders o where o.id = p_order_id;
    return coalesce(v_value, 0);

  elsif p_evaluation_key = 'photos_uploaded' then
    select count(*) into v_value
    from public.order_progress_images i
    join public.order_progress p on p.id = i.progress_id
    where p.order_id = p_order_id and p.user_id = p_employee_id;
    return coalesce(v_value, 0);

  elsif p_evaluation_key = 'work_time' then
    select round(coalesce(sum(greatest(extract(epoch from (t.ended_at - t.started_at)) / 3600.0
                                       - coalesce(t.total_break_minutes, 0) / 60.0, 0)), 0)::numeric, 2)
    into v_value
    from public.time_entries t
    where t.order_id = p_order_id and t.user_id = p_employee_id and t.ended_at is not null;
    return coalesce(v_value, 0);

  elsif p_evaluation_key = 'customer_rating' then
    -- eigene Sterne des Mitarbeiters; sonst Gesamtnote des Kunden; ohne Bewertung: nicht messbar
    select round(avg(e.rating)::numeric, 2) into v_value
    from public.customer_review_employees e
    join public.customer_reviews r on r.id = e.review_id
    where r.order_id = p_order_id and e.employee_id = p_employee_id;
    if v_value is null then
      select round(avg(r.overall_rating)::numeric, 2) into v_value
      from public.customer_reviews r where r.order_id = p_order_id;
    end if;
    return v_value;

  elsif p_evaluation_key = 'punctuality' then
    -- 1 = am oder vor dem geplanten Enddatum fertig; ohne Enddatum oder noch nicht fertig: nicht messbar
    select case
             when o.end_date is null or o.status not in ('fertig', 'abgerechnet') then null
             when coalesce(o.completed_at, now())::date <= o.end_date then 1
             else 0
           end
    into v_value
    from public.orders o where o.id = p_order_id;
    return v_value;
  end if;

  return null; -- Reklamationen, Materialverbrauch: noch nicht messbar
end;
$$;

-- ---------- Teil 3: Berechnung – nicht messbare Regeln überspringen statt mit 0 zu werten ----------
-- (gleich wie bisher, nur: Messwert NULL → Regel wird übersprungen und nicht gezählt)
create or replace function public.calculate_employee_performance(p_order_id bigint)
returns table(employee_id bigint, order_id bigint, performance_score numeric, total_rules integer, successful_rules integer,
              failed_rules integer, stars integer, reward_name text, reward_type text, reward_value numeric)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tenant_id bigint; v_employee record; v_criterion record;
  v_metric_value numeric; v_rule_matched boolean; v_points integer;
  v_total_points integer; v_total_rules integer; v_successful_rules integer; v_failed_rules integer; v_rule_results jsonb;
  v_reward_id bigint; v_reward_name text; v_reward_type text; v_reward_value numeric; v_stars integer;
begin
  select o.tenant_id into v_tenant_id from public.orders o where o.id = p_order_id;
  if v_tenant_id is null then raise exception 'Auftrag nicht gefunden.'; end if;

  for v_employee in
    select distinct oa.user_id as app_employee_id from public.order_assignments oa
    where oa.order_id = p_order_id and oa.assignment_role in ('employee', 'project_manager')
  loop
    v_total_points := 0; v_total_rules := 0; v_successful_rules := 0; v_failed_rules := 0; v_rule_results := '[]'::jsonb;
    delete from public.employee_performance ep
    where ep.employee_id = v_employee.app_employee_id and ep.order_id = p_order_id and ep.source_type = 'automatic';

    for v_criterion in
      select pc.* from public.performance_criteria pc
      where pc.tenant_id = v_tenant_id and pc.is_active = true and pc.evaluation_mode = 'automatic' and pc.auto_evaluation_enabled = true
      order by pc.sort_order asc, pc.id asc
    loop
      v_metric_value := public.get_performance_metric_value(v_criterion.evaluation_key, v_employee.app_employee_id, p_order_id);
      if v_metric_value is null then
        v_rule_results := v_rule_results || jsonb_build_array(jsonb_build_object(
          'criterion_id', v_criterion.id, 'name', v_criterion.name, 'evaluation_key', v_criterion.evaluation_key, 'skipped', true));
        continue;
      end if;
      v_total_rules := v_total_rules + 1;
      v_rule_matched := public.evaluate_performance_rule(v_metric_value, v_criterion.evaluation_operator, v_criterion.evaluation_value);
      v_points := public.calculate_rule_points(v_metric_value, v_criterion.evaluation_operator, v_criterion.evaluation_value,
                                               v_criterion.points_on_success, v_criterion.points_on_failure);
      if v_rule_matched then v_successful_rules := v_successful_rules + 1; else v_failed_rules := v_failed_rules + 1; end if;
      v_total_points := v_total_points + coalesce(v_points, 0);

      insert into public.employee_performance (tenant_id, employee_id, criterion_id, order_id, points, note, created_by, source_type, source_id)
      values (v_tenant_id, v_employee.app_employee_id, v_criterion.id, p_order_id, coalesce(v_points, 0),
              concat('Automatische Bewertung: ', v_criterion.name, ' | Messwert: ', coalesce(v_metric_value::text, '0'), ' ',
                     coalesce(v_criterion.evaluation_operator, ''), ' ', coalesce(v_criterion.evaluation_value::text, '')),
              null, 'automatic', p_order_id);

      v_rule_results := v_rule_results || jsonb_build_array(jsonb_build_object(
        'criterion_id', v_criterion.id, 'name', v_criterion.name, 'evaluation_key', v_criterion.evaluation_key,
        'metric_value', v_metric_value, 'operator', v_criterion.evaluation_operator, 'rule_value', v_criterion.evaluation_value,
        'matched', v_rule_matched, 'points', v_points));
    end loop;

    v_reward_id := null; v_reward_name := null; v_reward_type := null; v_reward_value := null; v_stars := null;
    select pr.id, pr.reward_name, pr.reward_type, pr.reward_value, pr.stars
    into v_reward_id, v_reward_name, v_reward_type, v_reward_value, v_stars
    from public.performance_rewards pr
    where pr.tenant_id = v_tenant_id and pr.is_active = true and v_total_points >= pr.min_points
      and (pr.max_points is null or v_total_points <= pr.max_points)
    order by pr.min_points desc limit 1;

    insert into public.employee_performance_results (
      tenant_id, employee_id, order_id, evaluation_date, performance_score, bonus_points, rule_results,
      successful_rules, failed_rules, total_rules, reward_id, reward_name, reward_type, reward_value, stars, calculated_at)
    values (v_tenant_id, v_employee.app_employee_id, p_order_id, current_date, v_total_points, v_total_points, v_rule_results,
            v_successful_rules, v_failed_rules, v_total_rules, v_reward_id, v_reward_name, v_reward_type, v_reward_value, v_stars, now())
    on conflict on constraint employee_performance_results_unique do update set
      evaluation_date = excluded.evaluation_date, performance_score = excluded.performance_score, bonus_points = excluded.bonus_points,
      rule_results = excluded.rule_results, successful_rules = excluded.successful_rules, failed_rules = excluded.failed_rules,
      total_rules = excluded.total_rules, reward_id = excluded.reward_id, reward_name = excluded.reward_name,
      reward_type = excluded.reward_type, reward_value = excluded.reward_value, stars = excluded.stars,
      calculated_at = excluded.calculated_at, updated_at = now();

    return query select v_employee.app_employee_id, p_order_id, v_total_points::numeric, v_total_rules,
                        v_successful_rules, v_failed_rules, v_stars, v_reward_name, v_reward_type, v_reward_value;
  end loop;
end;
$function$;

-- ---------- Teil 4: automatisch auslösen ----------
-- Fehler bei der Bewertung dürfen das Speichern des Auftrags bzw. der Kundenbewertung nie verhindern
create or replace function public.perf_recalc_order(p_order_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_order_id is null or not exists (
    select 1 from public.performance_criteria pc join public.orders o on o.tenant_id = pc.tenant_id
    where o.id = p_order_id and pc.is_active and pc.evaluation_mode = 'automatic' and pc.auto_evaluation_enabled) then
    return; -- keine automatischen Regeln → nichts zu tun
  end if;
  perform public.calculate_employee_performance(p_order_id);
exception when others then
  raise warning 'Leistungsbewertung für Auftrag % fehlgeschlagen: %', p_order_id, sqlerrm;
end;
$$;

create or replace function public.perf_on_order_done()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('fertig', 'abgerechnet') and coalesce(old.status, '') not in ('fertig', 'abgerechnet') then
    perform public.perf_recalc_order(new.id);
  end if;
  return null;
end;
$$;

create or replace function public.perf_on_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'customer_reviews' then
    perform public.perf_recalc_order(new.order_id);
  else
    perform public.perf_recalc_order((select r.order_id from public.customer_reviews r where r.id = new.review_id));
  end if;
  return null;
end;
$$;

drop trigger if exists perf_order_done on public.orders;
create trigger perf_order_done after update of status on public.orders
  for each row execute function public.perf_on_order_done();
drop trigger if exists perf_review_added on public.customer_reviews;
create trigger perf_review_added after insert on public.customer_reviews
  for each row execute function public.perf_on_review();
drop trigger if exists perf_review_employee_added on public.customer_review_employees;
create trigger perf_review_employee_added after insert on public.customer_review_employees
  for each row execute function public.perf_on_review();

revoke all on function public.perf_recalc_order(bigint) from public, anon, authenticated;
