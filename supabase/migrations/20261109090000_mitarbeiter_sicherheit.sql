-- Mitarbeiter-Dashboard: Sicherheit (09.11.2026)
-- 1) Mitarbeiter dürfen Arbeitszeiten NICHT mehr direkt in time_entries schreiben
--    (sonst ließen sich beliebige Start-/Endzeiten eintragen). Die Stechuhr läuft
--    ausschließlich über employee_start_work / _end_work (security definer).
-- 2) Fortschrittsnotizen nur noch für zugeteilte Aufträge (die Regel ohne Zuteilungs-Prüfung fällt weg;
--    order_progress_insert_assigned_users deckt Mitarbeiter und Projektleiter ab).
-- 3) Auftragsstatus: Mitarbeiter können abgeschlossene Aufträge (fertig/abgerechnet/storniert)
--    nicht mehr zurück auf „in Arbeit“ setzen.
-- 4) time_breaks: Zeilenschutz einschalten (Zugriff nur noch über die Stechuhr-Funktionen).
-- 5) Neue Lesefunktion: Beginn der laufenden Pause (für die Live-Uhr im Dashboard).

drop policy if exists employees_can_insert_own_time_entries on public.time_entries;
drop policy if exists progress_employee_insert_own on public.order_progress;

create or replace function public.employee_update_order_status(p_order_id text, p_new_status text)
returns table(updated_order_id text, updated_status text)
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $function$
declare
  v_app_user_id bigint;
  v_tenant_id bigint;
  v_role_id integer;
begin
  select id, tenant_id, role_id
  into v_app_user_id, v_tenant_id, v_role_id
  from public.app_users
  where auth_user_id = auth.uid()
  limit 1;

  if v_app_user_id is null then
    raise exception 'Benutzerprofil nicht gefunden';
  end if;

  if v_role_id not in (3, 4) then
    raise exception 'Nur Mitarbeiter oder Projektleiter dürfen diese Funktion verwenden';
  end if;

  if p_new_status not in ('in_arbeit', 'pausiert', 'zur_pruefung') then
    raise exception 'Ungültiger Status';
  end if;

  return query
  with upd as (
    update public.orders o
    set status = p_new_status
    where o.id::text = p_order_id
      and o.tenant_id = v_tenant_id
      and o.status in ('neu', 'geplant', 'in_arbeit', 'pausiert', 'zur_pruefung')
      and exists (
        select 1
        from public.order_assignments oa
        where oa.order_id = o.id
          and oa.tenant_id = o.tenant_id
          and oa.user_id = v_app_user_id
          and oa.assignment_role in ('employee', 'project_manager')
      )
    returning o.id::text as order_id_out, o.status::text as status_out
  )
  select
    upd.order_id_out as updated_order_id,
    upd.status_out as updated_status
  from upd;

  if not found then
    raise exception 'Auftrag nicht gefunden oder keine Berechtigung';
  end if;
end;
$function$;

do $$
begin
  if to_regclass('public.time_breaks') is not null then
    execute 'alter table public.time_breaks enable row level security';
    execute 'drop policy if exists time_breaks_select_tenant on public.time_breaks';
    -- Lesen: eigene Pausen; Inhaber/Admin/Projektleiter alle Pausen der Firma (für Auswertungen)
    execute $p$
      create policy time_breaks_select_tenant on public.time_breaks for select
      using (exists (
        select 1 from public.time_entries te
        where te.id = time_breaks.time_entry_id
          and te.tenant_id = public.current_tenant_id()
          and (public.current_role_id() in (1, 2, 3) or te.user_id = public.current_app_user_id())
      ))
    $p$;
  end if;
end $$;

create or replace function public.employee_open_break_started_at(p_time_entry_id bigint)
returns timestamptz
language sql
stable
security definer
set search_path to 'public'
as $function$
  select tb.started_at
  from public.time_breaks tb
  join public.time_entries te on te.id = tb.time_entry_id
  join public.app_users au on au.id = te.user_id and au.tenant_id = te.tenant_id
  where tb.time_entry_id = p_time_entry_id
    and tb.ended_at is null
    and au.auth_user_id = auth.uid()
  order by tb.started_at desc
  limit 1
$function$;

revoke all on function public.employee_open_break_started_at(bigint) from public, anon;
grant execute on function public.employee_open_break_started_at(bigint) to authenticated;
