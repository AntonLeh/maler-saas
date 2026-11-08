-- =====================================================================
-- Angebote: Sicherheitslücke in den Zugriffsregeln (RLS) schließen
-- In den bisherigen Regeln stand z. B. "q.tenant_id = q.tenant_id" – das ist immer wahr.
-- Dadurch hätte eine Firma theoretisch Positionen an ein Angebot einer ANDEREN Firma hängen
-- oder ein Angebot mit dem Kunden einer anderen Firma anlegen können.
-- Jetzt wird geprüft, dass Angebot, Kunde und Ersteller zur eigenen Firma gehören.
-- Sonst unverändert (nur Inhaber/Admin, Rollen 1 und 2). Kann mehrfach ausgeführt werden.
-- =====================================================================

-- Positionen (quote_items)
drop policy if exists quote_items_select on public.quote_items;
drop policy if exists quote_items_insert on public.quote_items;
drop policy if exists quote_items_update on public.quote_items;
drop policy if exists quote_items_delete on public.quote_items;

create policy quote_items_select on public.quote_items for select
  using (
    tenant_id = current_tenant_id()
    and current_role_id() = any (array[1, 2])
    and exists (select 1 from public.quotes q where q.id = quote_items.quote_id and q.tenant_id = quote_items.tenant_id)
  );

create policy quote_items_insert on public.quote_items for insert
  with check (
    tenant_id = current_tenant_id()
    and current_role_id() = any (array[1, 2])
    and exists (select 1 from public.quotes q where q.id = quote_items.quote_id and q.tenant_id = quote_items.tenant_id)
  );

create policy quote_items_update on public.quote_items for update
  using (
    tenant_id = current_tenant_id()
    and current_role_id() = any (array[1, 2])
    and exists (select 1 from public.quotes q where q.id = quote_items.quote_id and q.tenant_id = quote_items.tenant_id)
  )
  with check (
    tenant_id = current_tenant_id()
    and current_role_id() = any (array[1, 2])
    and exists (select 1 from public.quotes q where q.id = quote_items.quote_id and q.tenant_id = quote_items.tenant_id)
  );

create policy quote_items_delete on public.quote_items for delete
  using (
    tenant_id = current_tenant_id()
    and current_role_id() = any (array[1, 2])
    and exists (select 1 from public.quotes q where q.id = quote_items.quote_id and q.tenant_id = quote_items.tenant_id)
  );

-- Angebote (quotes): Kunde und Ersteller müssen zur eigenen Firma gehören
drop policy if exists quotes_insert on public.quotes;
drop policy if exists quotes_update on public.quotes;

create policy quotes_insert on public.quotes for insert
  with check (
    tenant_id = current_tenant_id()
    and current_role_id() = any (array[1, 2])
    and exists (select 1 from public.customers c where c.id = quotes.customer_id and c.tenant_id = quotes.tenant_id)
    and (created_by is null or exists (select 1 from public.app_users au where au.id = quotes.created_by and au.tenant_id = quotes.tenant_id))
  );

create policy quotes_update on public.quotes for update
  using (
    tenant_id = current_tenant_id()
    and current_role_id() = any (array[1, 2])
  )
  with check (
    tenant_id = current_tenant_id()
    and current_role_id() = any (array[1, 2])
    and exists (select 1 from public.customers c where c.id = quotes.customer_id and c.tenant_id = quotes.tenant_id)
    and (created_by is null or exists (select 1 from public.app_users au where au.id = quotes.created_by and au.tenant_id = quotes.tenant_id))
  );
