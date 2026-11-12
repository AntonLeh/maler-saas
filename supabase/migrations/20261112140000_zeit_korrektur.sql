-- Arbeitszeiten korrigieren (nur Admin) mit Pflicht-Begründung und Verlauf – 12.11.2026
create table if not exists public.time_entry_corrections (
  id bigserial primary key,
  tenant_id bigint not null,
  time_entry_id bigint not null references public.time_entries (id) on delete cascade,
  old_started_at timestamptz,
  old_ended_at timestamptz,
  old_break_minutes integer,
  new_started_at timestamptz,
  new_ended_at timestamptz,
  new_break_minutes integer,
  reason text not null,
  corrected_by bigint references public.app_users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists time_entry_corrections_entry_idx on public.time_entry_corrections (time_entry_id);

alter table public.time_entry_corrections enable row level security;
drop policy if exists tec_select on public.time_entry_corrections;
create policy tec_select on public.time_entry_corrections for select to authenticated
  using (tenant_id = public.current_tenant_id() and public.current_role_id() = 2);

create or replace function public.time_entry_correct(
  p_id bigint, p_start timestamptz, p_end timestamptz, p_break_minutes integer, p_reason text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.app_users; e public.time_entries; v_status text; v_minutes numeric; v_col text;
begin
  select * into c from public.app_users where auth_user_id = auth.uid() limit 1;
  if c.id is null or c.role_id <> 2 then raise exception 'Nur der Inhaber/Admin darf Arbeitszeiten korrigieren.'; end if;
  select * into e from public.time_entries where id = p_id for update;
  if e.id is null or e.tenant_id <> c.tenant_id then raise exception 'Eintrag nicht gefunden.'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'Bitte eine Begründung angeben.'; end if;
  if p_start is null or p_end is null or p_end <= p_start then raise exception 'Das Ende muss nach dem Beginn liegen.'; end if;
  if p_end - p_start > interval '16 hours' then raise exception 'Ein Eintrag darf höchstens 16 Stunden lang sein.'; end if;
  if p_end > now() + interval '10 minutes' then raise exception 'Das Ende darf nicht in der Zukunft liegen.'; end if;
  v_minutes := extract(epoch from (p_end - p_start)) / 60;
  if coalesce(p_break_minutes, 0) < 0 or coalesce(p_break_minutes, 0) >= v_minutes then raise exception 'Die Pause ist ungültig.'; end if;
  if exists (select 1 from public.time_entries x
              where x.user_id = e.user_id and x.id <> e.id and x.started_at < p_end and coalesce(x.ended_at, now()) > p_start) then
    raise exception 'Der neue Zeitraum überschneidet sich mit einem anderen Eintrag der Person.';
  end if;

  insert into public.time_entry_corrections (tenant_id, time_entry_id, old_started_at, old_ended_at, old_break_minutes,
                                             new_started_at, new_ended_at, new_break_minutes, reason, corrected_by)
  values (e.tenant_id, e.id, e.started_at, e.ended_at, e.total_break_minutes, p_start, p_end, coalesce(p_break_minutes, 0), btrim(p_reason), c.id);

  -- offene Einträge (vergessen auszustempeln) werden dabei abgeschlossen
  if e.ended_at is null then
    select status into v_status from public.time_entries
     where tenant_id = c.tenant_id and ended_at is not null and status is not null
     group by status order by count(*) desc limit 1;
    -- laufende Pause der Stechuhr beenden (Spaltenname je nach Datenbank)
    select column_name into v_col from information_schema.columns
     where table_schema = 'public' and table_name = 'time_breaks'
       and column_name in ('time_entry_id', 'entry_id', 'time_entries_id') limit 1;
    if v_col is not null then
      begin
        execute format('update public.time_breaks set ended_at = $2 where %I = $1 and ended_at is null', v_col) using e.id, p_end;
      exception when others then null;
      end;
    end if;
  end if;

  update public.time_entries
     set started_at = p_start, ended_at = p_end, total_break_minutes = coalesce(p_break_minutes, 0),
         work_date = (p_start at time zone 'Europe/Berlin')::date,
         status = case when e.ended_at is null then coalesce(v_status, 'completed') else status end
   where id = e.id;
end;
$$;

revoke all on function public.time_entry_correct(bigint, timestamptz, timestamptz, integer, text) from public, anon;
grant execute on function public.time_entry_correct(bigint, timestamptz, timestamptz, integer, text) to authenticated;
