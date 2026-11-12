-- Urlaub Teil B: Anträge über die Mitarbeiter-App – 12.11.2026

alter table public.absences add column if not exists decision_note text;

-- Eigenes Urlaubskonto lesen (Anspruch, Arbeitstage, Feiertags-Region) – nur für sich selbst
create or replace function public.my_leave()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'vacation_days', l.vacation_days,
    'work_weekdays', coalesce(l.work_weekdays, '{1,2,3,4,5}'::smallint[]),
    'entry_date', l.entry_date,
    'years', coalesce(l.years, '{}'::jsonb),
    'exit_date', u.exit_date,
    'employment_type', u.employment_type,
    'country', cs.country,
    'holiday_region', cs.holiday_region
  )
  from public.app_users u
  left join public.employee_leave l on l.user_id = u.id
  left join public.company_settings cs on cs.tenant_id = u.tenant_id
  where u.id = public.current_app_user_id();
$$;
revoke all on function public.my_leave() from public, anon;
grant execute on function public.my_leave() to authenticated;

-- Antrag stellen (Urlaub, Überstundenabbau, unbezahlter Urlaub) – Chef bekommt eine Nachricht
create or replace function public.absence_request(p_kind text, p_start date, p_end date, p_start_half boolean, p_end_half boolean, p_note text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid bigint := public.current_app_user_id();
  v_tenant bigint := public.current_tenant_id();
  v_id bigint;
  v_name text;
  v_what text;
begin
  if v_uid is null or v_tenant is null then raise exception 'Nicht angemeldet.'; end if;
  if exists (select 1 from public.app_users where id = v_uid and (role_id not in (3, 4) or employment_type in ('leiharbeit', 'sub'))) then
    raise exception 'Urlaub kann hier nur von eigenen Mitarbeitern beantragt werden.';
  end if;
  if p_kind not in ('urlaub', 'ueberstunden', 'unbezahlt') then raise exception 'Diese Art kann nicht beantragt werden.'; end if;
  if p_start is null or p_end is null or p_end < p_start then raise exception 'Bitte einen gültigen Zeitraum wählen.'; end if;
  if p_start < current_date then raise exception 'Urlaub kann nicht rückwirkend beantragt werden.'; end if;
  if p_end - p_start > 60 then raise exception 'Bitte höchstens 60 Tage am Stück beantragen.'; end if;
  if (select count(*) from public.absences where user_id = v_uid and status = 'beantragt') >= 10 then
    raise exception 'Es sind schon zu viele Anträge offen.';
  end if;
  if exists (select 1 from public.absences where user_id = v_uid and status <> 'abgelehnt' and start_date <= p_end and end_date >= p_start) then
    raise exception 'In diesem Zeitraum ist schon eine Abwesenheit eingetragen oder beantragt.';
  end if;

  insert into public.absences (tenant_id, user_id, kind, start_date, end_date, start_half, end_half, note, status, created_by)
  values (v_tenant, v_uid, p_kind, p_start, p_end, coalesce(p_start_half, false), coalesce(p_end_half, false),
          nullif(left(trim(coalesce(p_note, '')), 300), ''), 'beantragt', v_uid)
  returning id into v_id;

  select trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')) into v_name from public.app_users where id = v_uid;
  v_what := case p_kind when 'urlaub' then 'Urlaubsantrag' when 'ueberstunden' then 'Antrag auf Überstundenabbau' else 'Antrag auf unbezahlten Urlaub' end;
  begin
    insert into public.messages (tenant_id, sender_id, recipient_id, order_id, message_type, message, image_url)
    select v_tenant, v_uid, u.id, null, 'direct',
           '🏖 ' || v_what || ' von ' || v_name || ': ' || to_char(p_start, 'DD.MM.YYYY')
           || case when p_end <> p_start then ' – ' || to_char(p_end, 'DD.MM.YYYY') else '' end
           || ' – bitte unter „Urlaub & Abwesenheiten“ genehmigen oder ablehnen.',
           null
    from public.app_users u
    where u.tenant_id = v_tenant and u.role_id = 2;
  exception when others then null; -- Antrag bleibt gültig, auch wenn die Nachricht nicht klappt
  end;
  return v_id;
end;
$$;
revoke all on function public.absence_request(text, date, date, boolean, boolean, text) from public, anon;
grant execute on function public.absence_request(text, date, date, boolean, boolean, text) to authenticated;

-- Eigenen offenen Antrag zurückziehen
create or replace function public.absence_cancel(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.absences where id = p_id and user_id = public.current_app_user_id() and status = 'beantragt';
  if not found then raise exception 'Nur offene Anträge können zurückgezogen werden. Bitte sonst den Chef fragen.'; end if;
end;
$$;
revoke all on function public.absence_cancel(bigint) from public, anon;
grant execute on function public.absence_cancel(bigint) to authenticated;
