-- Stechuhr durch den Projektleiter für Personen OHNE App (Leiharbeiter, Subunternehmer …) – 12.11.2026
-- Der PL (bzw. Admin) startet und beendet die Arbeitszeit; Eintrag mit entered_by = PL.

create or replace function public.pm_clock_status()
returns table (user_id bigint, entry_id bigint, order_id bigint, started_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select e.user_id, e.id, e.order_id, e.started_at
    from public.time_entries e
    join public.app_users t on t.id = e.user_id
    join public.app_users c on c.auth_user_id = auth.uid()
   where e.ended_at is null
     and t.tenant_id = c.tenant_id
     and c.role_id in (2, 3)
     and coalesce(t.app_access, true) = false;
$$;

create or replace function public.pm_clock_start(p_user_id bigint, p_order_id bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.app_users; t public.app_users; v_tenant bigint; v_id bigint;
begin
  select * into c from public.app_users where auth_user_id = auth.uid() limit 1;
  if c.id is null or c.role_id not in (2, 3) then raise exception 'Keine Berechtigung.'; end if;
  select * into t from public.app_users where id = p_user_id and tenant_id = c.tenant_id;
  if t.id is null or t.role_id not in (3, 4) then raise exception 'Person nicht gefunden.'; end if;
  if coalesce(t.app_access, true) then raise exception 'Diese Person hat einen eigenen App-Zugang und stempelt selbst.'; end if;
  if t.is_active = false then raise exception 'Die Person ist ausgeschieden.'; end if;
  select tenant_id into v_tenant from public.orders where id = p_order_id;
  if v_tenant is distinct from c.tenant_id then raise exception 'Auftrag nicht gefunden.'; end if;
  if c.role_id = 3 and not public.pm_can_manage_order(p_order_id) then raise exception 'Nur bei Ihren eigenen Aufträgen möglich.'; end if;
  if exists (select 1 from public.time_entries where user_id = p_user_id and ended_at is null) then
    raise exception 'Für diese Person läuft schon eine Arbeitszeit.';
  end if;

  insert into public.time_entries (tenant_id, user_id, order_id, work_date, started_at, ended_at, total_break_minutes, status, entered_by)
  values (c.tenant_id, p_user_id, p_order_id, (now() at time zone 'Europe/Berlin')::date, now(), null, 0, 'working', c.id)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.pm_clock_stop(p_user_id bigint, p_break_minutes integer default 0)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.app_users; e public.time_entries; v_status text; v_minutes numeric;
begin
  select * into c from public.app_users where auth_user_id = auth.uid() limit 1;
  if c.id is null or c.role_id not in (2, 3) then raise exception 'Keine Berechtigung.'; end if;
  select * into e from public.time_entries
   where user_id = p_user_id and tenant_id = c.tenant_id and ended_at is null
   order by started_at desc limit 1;
  if e.id is null then raise exception 'Für diese Person läuft keine Arbeitszeit.'; end if;
  if c.role_id = 3 and not public.pm_can_manage_order(e.order_id) then raise exception 'Nur bei Ihren eigenen Aufträgen möglich.'; end if;
  v_minutes := extract(epoch from (now() - e.started_at)) / 60;
  if coalesce(p_break_minutes, 0) < 0 or (coalesce(p_break_minutes, 0) > 0 and p_break_minutes >= v_minutes) then
    raise exception 'Die Pause ist länger als die Arbeitszeit.';
  end if;

  select status into v_status from public.time_entries
   where tenant_id = c.tenant_id and ended_at is not null and status is not null
   group by status order by count(*) desc limit 1;

  update public.time_entries
     set ended_at = now(), total_break_minutes = coalesce(p_break_minutes, 0), status = coalesce(v_status, 'completed'),
         entered_by = coalesce(entered_by, c.id)
   where id = e.id;
end;
$$;

revoke all on function public.pm_clock_status() from public, anon;
revoke all on function public.pm_clock_start(bigint, bigint) from public, anon;
revoke all on function public.pm_clock_stop(bigint, integer) from public, anon;
grant execute on function public.pm_clock_status() to authenticated;
grant execute on function public.pm_clock_start(bigint, bigint) to authenticated;
grant execute on function public.pm_clock_stop(bigint, integer) to authenticated;
