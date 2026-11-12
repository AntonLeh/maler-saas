-- Stunden nachtragen (Admin/Projektleiter) + Fremdleistungen (Subunternehmer-Rechnungen) – 12.11.2026

-- 1) Nachgetragene Stunden kennzeichnen
alter table public.time_entries add column if not exists entered_by bigint references public.app_users (id) on delete set null;
alter table public.time_entries add column if not exists entry_note text;

create or replace function public.time_entry_add_manual(
  p_user_id bigint, p_order_id bigint, p_start timestamptz, p_end timestamptz,
  p_break_minutes integer default 0, p_note text default null
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.app_users;
  t public.app_users;
  v_order_tenant bigint;
  v_status text;
  v_id bigint;
  v_minutes numeric;
begin
  select * into c from public.app_users where auth_user_id = auth.uid() limit 1;
  if c.id is null or c.role_id not in (2, 3) then raise exception 'Keine Berechtigung.'; end if;

  select * into t from public.app_users where id = p_user_id and tenant_id = c.tenant_id;
  if t.id is null or t.role_id not in (3, 4) then raise exception 'Person nicht gefunden.'; end if;

  select tenant_id into v_order_tenant from public.orders where id = p_order_id;
  if v_order_tenant is distinct from c.tenant_id then raise exception 'Auftrag nicht gefunden.'; end if;
  if c.role_id = 3 and not public.pm_can_manage_order(p_order_id) then
    raise exception 'Projektleiter können Stunden nur bei ihren eigenen Aufträgen nachtragen.';
  end if;

  if p_start is null or p_end is null or p_end <= p_start then raise exception 'Das Ende muss nach dem Beginn liegen.'; end if;
  if p_end - p_start > interval '16 hours' then raise exception 'Ein Eintrag darf höchstens 16 Stunden lang sein.'; end if;
  if p_start > now() + interval '10 minutes' then raise exception 'Stunden können nicht im Voraus eingetragen werden.'; end if;
  v_minutes := extract(epoch from (p_end - p_start)) / 60;
  if coalesce(p_break_minutes, 0) < 0 or coalesce(p_break_minutes, 0) >= v_minutes then raise exception 'Die Pause ist ungültig.'; end if;
  if t.exit_date is not null and (p_start at time zone 'Europe/Berlin')::date > t.exit_date then
    raise exception 'Die Person ist am % ausgeschieden.', to_char(t.exit_date, 'DD.MM.YYYY');
  end if;
  if exists (
    select 1 from public.time_entries e
     where e.user_id = p_user_id and e.started_at < p_end and coalesce(e.ended_at, now()) > p_start
  ) then
    raise exception 'In diesem Zeitraum gibt es für die Person schon einen Eintrag.';
  end if;

  -- denselben Status wie abgeschlossene Stechuhr-Einträge verwenden
  select status into v_status from public.time_entries
   where tenant_id = c.tenant_id and ended_at is not null and status is not null
   group by status order by count(*) desc limit 1;

  insert into public.time_entries (tenant_id, user_id, order_id, work_date, started_at, ended_at, total_break_minutes, status, entered_by, entry_note)
  values (c.tenant_id, p_user_id, p_order_id, (p_start at time zone 'Europe/Berlin')::date, p_start, p_end,
          coalesce(p_break_minutes, 0), coalesce(v_status, 'completed'), c.id, nullif(btrim(p_note), ''))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.time_entry_delete_manual(p_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.app_users;
  e public.time_entries;
begin
  select * into c from public.app_users where auth_user_id = auth.uid() limit 1;
  select * into e from public.time_entries where id = p_id;
  if e.id is null or c.id is null or e.tenant_id <> c.tenant_id then raise exception 'Eintrag nicht gefunden.'; end if;
  if e.entered_by is null then raise exception 'Nur nachgetragene Stunden können hier gelöscht werden.'; end if;
  if not (c.role_id = 2 or (c.role_id = 3 and e.entered_by = c.id)) then raise exception 'Keine Berechtigung.'; end if;
  delete from public.time_entries where id = p_id;
end;
$$;

revoke all on function public.time_entry_add_manual(bigint, bigint, timestamptz, timestamptz, integer, text) from public, anon;
revoke all on function public.time_entry_delete_manual(bigint) from public, anon;
grant execute on function public.time_entry_add_manual(bigint, bigint, timestamptz, timestamptz, integer, text) to authenticated;
grant execute on function public.time_entry_delete_manual(bigint) to authenticated;
