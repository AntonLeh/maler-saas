-- =====================================================================
-- Firma vollständig löschen (ersetzt die alte Funktion delete_tenant_completely)
--  * löscht automatisch ALLE Tabellen mit Spalte tenant_id (auch künftige) – in mehreren Durchgängen,
--    bis keine Verknüpfungen mehr im Weg sind; dazu die Pausen der Zeiterfassung (time_breaks)
--  * hebt dafür nur innerhalb dieses Aufrufs die Löschsperre für Rechnungen und Belege auf
--  * gibt zurück, wie viele Zeilen je Tabelle gelöscht wurden
--  * darf NUR noch von der Server-Funktion „delete-tenant“ (Dienstkonto) aufgerufen werden –
--    vorher konnte jeder angemeldete Nutzer sie aufrufen
-- Dateien, Zugänge, Telefonnummer, KI-Assistent und Domain entfernt die Server-Funktion.
-- Kann mehrfach ausgeführt werden.
-- =====================================================================

drop function if exists public.delete_tenant_completely(bigint);

create function public.delete_tenant_completely(p_tenant_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining text[];
  v_next text[];
  v_table text;
  v_rows bigint;
  v_counts jsonb := '{}'::jsonb;
  v_pass int;
  v_col text;
begin
  if p_tenant_id is null then
    raise exception 'Keine Firma angegeben.';
  end if;
  if not exists (select 1 from public.tenants where id = p_tenant_id) then
    raise exception 'Firma % nicht gefunden.', p_tenant_id;
  end if;

  -- Löschsperren (GoBD) nur für diesen Vorgang aufheben
  perform set_config('malersaas.allow_invoice_delete', 'on', true);
  perform set_config('malersaas.allow_expense_delete', 'on', true);

  -- Pausen der Zeiterfassung hängen über die Zeiteinträge an der Firma
  if to_regclass('public.time_breaks') is not null then
    select column_name into v_col
      from information_schema.columns
     where table_schema = 'public' and table_name = 'time_breaks'
       and column_name in ('time_entry_id', 'entry_id', 'time_entries_id')
     limit 1;
    if v_col is not null then
      execute format('delete from public.time_breaks where %I in (select id from public.time_entries where tenant_id = $1)', v_col)
        using p_tenant_id;
      get diagnostics v_rows = row_count;
      v_counts := v_counts || jsonb_build_object('time_breaks', v_rows);
    end if;
  end if;

  -- alle Tabellen mit tenant_id
  select coalesce(array_agg(c.table_name::text order by c.table_name), '{}')
    into v_remaining
    from information_schema.columns c
    join information_schema.tables t
      on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
   where c.table_schema = 'public' and c.column_name = 'tenant_id' and c.table_name <> 'tenants';

  for v_pass in 1..20 loop
    exit when cardinality(v_remaining) = 0;
    v_next := '{}';
    foreach v_table in array v_remaining loop
      begin
        execute format('delete from public.%I where tenant_id = $1', v_table) using p_tenant_id;
        get diagnostics v_rows = row_count;
        v_counts := v_counts || jsonb_build_object(v_table, coalesce((v_counts ->> v_table)::bigint, 0) + v_rows);
      exception when foreign_key_violation then
        v_next := v_next || v_table; -- im nächsten Durchgang erneut versuchen
      end;
    end loop;
    if cardinality(v_next) = cardinality(v_remaining) then
      raise exception 'Folgende Tabellen konnten wegen Verknüpfungen nicht gelöscht werden: %', array_to_string(v_next, ', ');
    end if;
    v_remaining := v_next;
  end loop;

  delete from public.tenants where id = p_tenant_id;
  v_counts := v_counts || jsonb_build_object('tenants', 1);
  return v_counts;
end;
$$;

-- nur die Server-Funktion (Dienstkonto) darf löschen
revoke all on function public.delete_tenant_completely(bigint) from public;
revoke all on function public.delete_tenant_completely(bigint) from anon;
revoke all on function public.delete_tenant_completely(bigint) from authenticated;
grant execute on function public.delete_tenant_completely(bigint) to service_role;
